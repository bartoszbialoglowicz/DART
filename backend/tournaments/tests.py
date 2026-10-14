import random

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from players.models import Player, PlayerContact

from .models import MatchStatistic, Stage, Tournament, TournamentCycle, CycleEvent
from .services import EntrySpec, create_tournament, record_result
from .services.cycles import compute_cycle_standings

BO3_LEGS = {'sets': 1, 'legs': 3}


# ── Fixtures ─────────────────────────────────────────────────────────────────

def make_leg(winner='top') -> dict:
    """A completed 501 leg: two rounds, winner finishes on 0."""
    return {
        'rounds': [
            {'p0': {'score': 180, 'remaining': 321}, 'p1': {'score': 140, 'remaining': 361}},
            {'p0': {'score': 321, 'remaining': 0}},
        ],
        'winner': winner,
    }


def make_players(owner, names, cpu=False):
    return [Player.objects.create(first_name=n, last_name='', cpu=cpu, owner=owner, average=50) for n in names]


def make_tournament(owner, names=('A', 'B'), confirmed=True, cpu=False, format='knockout', **kwargs) -> Tournament:
    players = make_players(owner, names, cpu=cpu)
    kwargs.setdefault('match_format', BO3_LEGS)
    t = create_tournament(
        owner=owner, name='Test Tournament', format=format,
        entries=[EntrySpec(player_id=p.pk) for p in players], rng=random.Random(1), **kwargs,
    )
    if confirmed:
        t.bracket_confirmed = True
        t.save(update_fields=['bracket_confirmed'])
    return t


def all_matches(bracket):
    for rnd in bracket.get('rounds') or []:
        yield from rnd['matches']
    for group in bracket.get('groups') or []:
        yield from group['matches']
    for rnd in (bracket.get('playoff') or {}).get('rounds') or []:
        yield from rnd['matches']


def find_match(bracket, code):
    return next(m for m in all_matches(bracket) if m['id'] == code)


class AuthMixin:
    def create_user(self, username, password='pass'):
        user = User.objects.create_user(username=username, password=password)
        token = Token.objects.create(user=user)
        return user, token

    def auth(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def no_auth(self):
        self.client.credentials()

    def result_url(self, t, code='r0-m0'):
        return reverse('tournament-record-result', args=[t.pk, code])

    def legs_url(self, t, code='r0-m0'):
        return reverse('tournament-update-match-leg', args=[t.pk, code])


# ── Permissions ──────────────────────────────────────────────────────────────

class TournamentPermissionTests(AuthMixin, APITestCase):

    def setUp(self):
        self.owner, self.owner_token = self.create_user('owner')
        self.other, self.other_token = self.create_user('other')
        self.tournament = make_tournament(self.owner)
        self.list_url   = reverse('tournament-list')
        self.detail_url = reverse('tournament-detail', args=[self.tournament.pk])

    def test_anyone_can_list_tournaments(self):
        self.assertEqual(self.client.get(self.list_url).status_code, status.HTTP_200_OK)

    def test_anyone_can_view_tournament(self):
        self.assertEqual(self.client.get(self.detail_url).status_code, status.HTTP_200_OK)

    def test_response_includes_owner_username(self):
        self.assertEqual(self.client.get(self.detail_url).data['owner_username'], 'owner')

    def test_anonymous_cannot_create_tournament(self):
        response = self.client.post(self.list_url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_owner_can_rename(self):
        self.auth(self.owner_token)
        response = self.client.patch(self.detail_url, {'name': 'Nowa'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Nowa')

    def test_non_owner_cannot_rename(self):
        self.auth(self.other_token)
        response = self.client.patch(self.detail_url, {'name': 'Nowa'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_full_put_is_not_supported(self):
        self.auth(self.owner_token)
        response = self.client.put(self.detail_url, {'name': 'Nowa'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_patching_the_bracket_is_rejected(self):
        self.auth(self.owner_token)
        response = self.client.patch(self.detail_url, {'bracket': {'format': 'knockout'}}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_owner_can_delete_tournament(self):
        self.auth(self.owner_token)
        self.assertEqual(self.client.delete(self.detail_url).status_code, status.HTTP_204_NO_CONTENT)

    def test_non_owner_cannot_delete_tournament(self):
        self.auth(self.other_token)
        self.assertEqual(self.client.delete(self.detail_url).status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Tournament.objects.filter(pk=self.tournament.pk).exists())

    def test_non_owner_cannot_record_result(self):
        self.auth(self.other_token)
        response = self.client.post(self.result_url(self.tournament), {'top_score': 2, 'bottom_score': 0}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_anonymous_cannot_record_result(self):
        response = self.client.post(self.result_url(self.tournament), {'top_score': 2, 'bottom_score': 0}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


# ── Create ───────────────────────────────────────────────────────────────────

class TournamentCreateTests(AuthMixin, APITestCase):

    def setUp(self):
        self.owner, self.token = self.create_user('owner')
        self.auth(self.token)
        self.players  = make_players(self.owner, ['A', 'B', 'C'])
        self.list_url = reverse('tournament-list')

    def payload(self, **overrides):
        data = {
            'name': 'Puchar', 'format': 'knockout', 'match_format': BO3_LEGS,
            'entries': [{'player_id': p.pk} for p in self.players] + [{'name': 'Jan Kowalski'}],
        }
        data.update(overrides)
        return data

    def test_creates_the_bracket_on_the_server(self):
        response = self.client.post(self.list_url, self.payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        bracket = response.data['bracket']
        self.assertEqual(bracket['format'], 'knockout')
        self.assertEqual(bracket['playerCount'], 4)
        self.assertEqual([r['id'] for r in bracket['rounds']], ['round-0', 'round-1'])
        self.assertEqual(response.data['owner_username'], 'owner')
        self.assertFalse(response.data['bracket_confirmed'])

    def test_guest_entry_becomes_an_account_less_player(self):
        response = self.client.post(self.list_url, self.payload(), format='json')
        t = Tournament.objects.get(pk=response.data['id'])
        guest = t.entries.get(display_name='Jan Kowalski')
        self.assertIsNotNone(guest.player)
        self.assertIsNone(guest.player.user)

    def test_phase_configs_survive_round_trip(self):
        pcs = {'round-0': {'date': '2026-07-01T18:00', 'matchFormat': {'sets': 1, 'legs': 9}}}
        response = self.client.post(self.list_url, self.payload(phase_configs=pcs), format='json')
        detail = self.client.get(reverse('tournament-detail', args=[response.data['id']]))
        self.assertEqual(detail.data['bracket']['phaseConfigs'], pcs)
        self.assertEqual(detail.data['bracket']['rounds'][0]['matchFormat'], {'sets': 1, 'legs': 9})
        self.assertTrue(detail.data['start_date'].startswith('2026-07-01T18:00'))

    def test_groups_tournament(self):
        response = self.client.post(self.list_url, self.payload(format='groups', group_size=4, board_count=2), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        bracket = response.data['bracket']
        self.assertEqual(len(bracket['groups']), 1)
        self.assertEqual(bracket['groups'][0]['board'], 1)
        self.assertNotIn('playoff', bracket)

    def test_invalid_payloads_are_rejected(self):
        bad = [
            self.payload(entries=[]),
            self.payload(entries=[{'player_id': self.players[0].pk}]),
            self.payload(entries=[{'foo': 1}, {'name': 'X'}]),
            self.payload(entries=[{'player_id': 999999}, {'name': 'X'}]),
            self.payload(format='swiss'),
            self.payload(match_format={'sets': 0, 'legs': 3}),
            self.payload(format='groups', group_size=8),
        ]
        for data in bad:
            response = self.client.post(self.list_url, data, format='json')
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, data)
        self.assertEqual(Tournament.objects.count(), 0)

    def test_list_starts_with_the_newest_tournament(self):
        first = self.client.post(self.list_url, self.payload(name='Pierwszy'), format='json').data['id']
        second = self.client.post(self.list_url, self.payload(name='Drugi', entries=[
            {'player_id': p.pk} for p in self.players
        ]), format='json').data['id']
        ids = [t['id'] for t in self.client.get(self.list_url).data['results']]
        self.assertEqual(ids[:2], [second, first])

    def test_list_is_lightweight(self):
        self.client.post(self.list_url, self.payload(), format='json')
        row = self.client.get(self.list_url).data['results'][0]
        self.assertNotIn('bracket', row)
        self.assertEqual(row['player_count'], 4)


# ── Draft ────────────────────────────────────────────────────────────────────

class DraftTests(AuthMixin, APITestCase):

    def setUp(self):
        self.owner, self.token = self.create_user('owner')
        self.auth(self.token)
        self.t = make_tournament(self.owner, names=('A', 'B', 'C', 'D', 'E'), confirmed=False)

    def test_redraw_while_draft(self):
        response = self.client.post(reverse('tournament-redraw', args=[self.t.pk]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['bracket']['playerCount'], 5)

    def test_confirm_then_redraw_is_rejected(self):
        response = self.client.post(reverse('tournament-confirm-draft', args=[self.t.pk]))
        self.assertTrue(response.data['bracket_confirmed'])
        response = self.client.post(reverse('tournament-redraw', args=[self.t.pk]))
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)

    def test_results_need_a_confirmed_bracket(self):
        code = next(m.code for m in self.t.matches.all() if m.top_entry_id and m.bottom_entry_id)
        response = self.client.post(self.result_url(self.t, code), {'top_score': 2, 'bottom_score': 0}, format='json')
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)


# ── Results ──────────────────────────────────────────────────────────────────

class MatchResultTests(AuthMixin, APITestCase):

    def setUp(self):
        self.owner, self.token = self.create_user('owner')
        self.auth(self.token)
        self.t = make_tournament(self.owner, names=('A', 'B', 'C', 'D'))

    def post(self, code, top, bottom, **extra):
        return self.client.post(self.result_url(self.t, code), {'top_score': top, 'bottom_score': bottom, **extra}, format='json')

    def test_result_is_saved_and_the_winner_advances(self):
        response = self.post('r0-m0', 2, 1)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        bracket = response.data['bracket']
        semi, final = find_match(bracket, 'r0-m0'), find_match(bracket, 'r1-m0')
        self.assertEqual(semi['result']['displayScore'], '2–1')
        self.assertEqual(final['top']['playerName'], semi['top']['playerName'])

    def test_invalid_score_is_rejected(self):
        self.assertEqual(self.post('r0-m0', 3, 0).status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.post('r0-m0', 1, 1).status_code, status.HTTP_400_BAD_REQUEST)

    def test_changing_an_existing_result_is_rejected(self):
        self.post('r0-m0', 2, 0)
        self.assertEqual(self.post('r0-m0', 0, 2).status_code, status.HTTP_409_CONFLICT)

    def test_resending_the_identical_result_is_accepted(self):
        self.post('r0-m0', 2, 0)
        self.assertEqual(self.post('r0-m0', 2, 0).status_code, status.HTTP_200_OK)

    def test_match_without_both_players_cannot_be_played(self):
        self.assertEqual(self.post('r1-m0', 2, 0).status_code, status.HTTP_409_CONFLICT)

    def test_unknown_match_is_404(self):
        self.assertEqual(self.post('r9-m9', 2, 0).status_code, status.HTTP_404_NOT_FOUND)

    def test_deciding_the_final_ends_the_tournament(self):
        self.post('r0-m0', 2, 0)
        self.post('r0-m1', 2, 0)
        response = self.post('r1-m0', 2, 0)
        self.assertFalse(response.data['is_active'])


class BotSimulationLockTests(AuthMixin, APITestCase):

    def setUp(self):
        self.owner, self.token = self.create_user('owner')
        self.auth(self.token)
        self.t = make_tournament(self.owner, cpu=True)
        self.client.put(self.legs_url(self.t), {'legs': [], 'currentLeg': {'rounds': [], 'activePlayer': 0}}, format='json')

    def test_setting_result_while_simulation_runs_is_rejected(self):
        response = self.client.post(self.result_url(self.t), {'top_score': 2, 'bottom_score': 0}, format='json')
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)

    def test_live_result_clears_its_own_lock(self):
        response = self.client.post(self.result_url(self.t), {'top_score': 2, 'bottom_score': 0, 'live': True}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn('currentLeg', find_match(response.data['bracket'], 'r0-m0'))

    def test_result_after_lock_cleared_is_accepted(self):
        self.client.put(self.legs_url(self.t), {'legs': [], 'currentLeg': None}, format='json')
        response = self.client.post(self.result_url(self.t), {'top_score': 2, 'bottom_score': 0}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_human_match_is_not_blocked_by_a_stray_current_leg(self):
        t = make_tournament(self.owner, names=('H1', 'H2'))
        self.client.put(self.legs_url(t), {'legs': [], 'currentLeg': {'rounds': [], 'activePlayer': 0}}, format='json')
        response = self.client.post(self.result_url(t), {'top_score': 2, 'bottom_score': 0}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ── Leg details ──────────────────────────────────────────────────────────────

class LegDetailsTests(AuthMixin, APITestCase):

    def setUp(self):
        self.owner, self.owner_token = self.create_user('owner')
        self.other, self.other_token = self.create_user('other')
        self.t = make_tournament(self.owner)
        self.detail_url = reverse('tournament-detail', args=[self.t.pk])

    def put_legs(self, legs, current=None):
        return self.client.put(self.legs_url(self.t), {'legs': legs, 'currentLeg': current}, format='json')

    def test_owner_can_save_legs_and_they_appear_in_the_bracket(self):
        self.auth(self.owner_token)
        response = self.put_legs([make_leg('top'), make_leg('bottom')])
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        match = find_match(self.client.get(self.detail_url).data['bracket'], 'r0-m0')
        self.assertEqual([l['winner'] for l in match['legs']], ['top', 'bottom'])
        self.assertEqual(match['legs'][0]['rounds'][0]['p0']['score'], 180)
        self.assertEqual(match['status'], 'live')

    def test_subsequent_put_replaces_legs(self):
        self.auth(self.owner_token)
        self.put_legs([make_leg('top')])
        self.put_legs([make_leg('bottom')])
        match = find_match(self.client.get(self.detail_url).data['bracket'], 'r0-m0')
        self.assertEqual([l['winner'] for l in match['legs']], ['bottom'])

    def test_legs_coexist_with_the_result(self):
        self.auth(self.owner_token)
        self.put_legs([make_leg('top'), make_leg('top')])
        self.client.post(self.result_url(self.t), {'top_score': 2, 'bottom_score': 0}, format='json')
        match = find_match(self.client.get(self.detail_url).data['bracket'], 'r0-m0')
        self.assertEqual(len(match['legs']), 2)
        self.assertEqual(match['result']['winner'], 'top')

    def test_non_owner_cannot_save_legs(self):
        self.auth(self.other_token)
        self.assertEqual(self.put_legs([make_leg()]).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.t.matches.get(code='r0-m0').legs, [])

    def test_anonymous_cannot_save_legs(self):
        self.no_auth()
        self.assertEqual(self.put_legs([make_leg()]).status_code, status.HTTP_401_UNAUTHORIZED)


# ── Groups → playoff ─────────────────────────────────────────────────────────

class AdvanceGroupsTests(AuthMixin, APITestCase):

    def setUp(self):
        self.owner, self.token = self.create_user('owner')
        self.auth(self.token)
        self.t = make_tournament(self.owner, names=('A', 'B', 'C', 'D'), format='groups', group_size=4)
        self.url = reverse('tournament-advance-groups', args=[self.t.pk])

    def test_cannot_advance_before_groups_finish(self):
        self.assertEqual(self.client.post(self.url).status_code, status.HTTP_409_CONFLICT)

    def test_advance_reveals_the_playoff(self):
        for m in self.t.matches.filter(stage__kind='groups'):
            record_result(m, top_score=2, bottom_score=0)
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        final = response.data['bracket']['playoff']['rounds'][0]['matches'][0]
        self.assertIsNotNone(final['top']['playerName'])
        self.assertIsNotNone(final['bottom']['playerName'])

    def test_knockout_tournament_has_no_groups_to_advance(self):
        t = make_tournament(self.owner, names=('X', 'Y'))
        response = self.client.post(reverse('tournament-advance-groups', args=[t.pk]))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# ── Statistics ───────────────────────────────────────────────────────────────

class StatisticsTests(AuthMixin, APITestCase):

    def setUp(self):
        self.owner, self.owner_token = self.create_user('owner')
        self.other, self.other_token = self.create_user('other')
        self.a = make_players(self.owner, ['A'])[0]
        self.t = create_tournament(
            owner=self.owner, name='Cup', format='knockout', match_format=BO3_LEGS,
            entries=[EntrySpec(player_id=self.a.pk), EntrySpec(name='Gość')],
        )
        self.url = reverse('tournament-statistics', args=[self.t.pk])

    def stat(self, **kw):
        return {'match_id': 'r0-m0', 'match_average': 60.5, 'count_180': 1, **kw}

    def test_owner_saves_stats_linked_to_match_and_entry(self):
        self.auth(self.owner_token)
        response = self.client.put(self.url, [
            self.stat(player_id=self.a.pk, player_name='A'),
            self.stat(player_id=None, player_name='Gość'),
        ], format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        self.assertTrue(all(s.match and s.entry for s in MatchStatistic.objects.all()))
        self.assertEqual(MatchStatistic.objects.get(entry__player=self.a).player, self.a)

    def test_resaving_updates_instead_of_duplicating(self):
        self.auth(self.owner_token)
        self.client.put(self.url, [self.stat(player_id=self.a.pk, player_name='A')], format='json')
        self.client.put(self.url, [self.stat(player_id=self.a.pk, player_name='A', count_180=3)], format='json')
        self.assertEqual(MatchStatistic.objects.get().count_180, 3)

    def test_unknown_match_or_player_is_skipped(self):
        self.auth(self.owner_token)
        response = self.client.put(self.url, [
            self.stat(match_id='nope', player_id=self.a.pk, player_name='A'),
            self.stat(player_id=None, player_name='Ktoś obcy'),
        ], format='json')
        self.assertEqual(response.data, [])

    def test_get_returns_legacy_shape(self):
        self.auth(self.owner_token)
        self.client.put(self.url, [self.stat(player_id=self.a.pk, player_name='A')], format='json')
        self.no_auth()
        row = self.client.get(self.url).data[0]
        self.assertEqual((row['match_id'], row['player_id'], row['player_name']), ('r0-m0', self.a.pk, 'A'))

    def test_non_owner_cannot_save(self):
        self.auth(self.other_token)
        response = self.client.put(self.url, [self.stat(player_id=self.a.pk, player_name='A')], format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


# ── Privacy (is_private) ─────────────────────────────────────────────────────

class TournamentPrivacyTests(AuthMixin, APITestCase):
    """
    is_private=False: visible to everyone.
    is_private=True: visible only to the owner and to registered players
    (accounts with a linked Player) who are entries in it.
    """

    def setUp(self):
        self.owner, self.owner_token             = self.create_user('owner')
        self.participant, self.participant_token = self.create_user('participant')
        self.outsider, self.outsider_token       = self.create_user('outsider')

        participant_player = Player.objects.create(user=self.participant, first_name='Part', last_name='Icipant')
        other = make_players(self.owner, ['B'])[0]
        # The organizer may only enter a registered player who gave them their code.
        PlayerContact.objects.create(owner=self.owner, player=participant_player)

        self.public_tournament = make_tournament(self.owner)
        self.private_tournament = create_tournament(
            owner=self.owner, name='Private', format='knockout', match_format=BO3_LEGS, is_private=True,
            entries=[EntrySpec(player_id=participant_player.pk), EntrySpec(player_id=other.pk)],
        )

        self.list_url           = reverse('tournament-list')
        self.public_detail_url  = reverse('tournament-detail', args=[self.public_tournament.pk])
        self.private_detail_url = reverse('tournament-detail', args=[self.private_tournament.pk])

    def list_ids(self):
        return [t['id'] for t in self.client.get(self.list_url).data['results']]

    def test_anonymous_can_view_public_tournament(self):
        self.assertEqual(self.client.get(self.public_detail_url).status_code, status.HTTP_200_OK)

    def test_anonymous_cannot_view_private_tournament(self):
        self.assertEqual(self.client.get(self.private_detail_url).status_code, status.HTTP_404_NOT_FOUND)

    def test_anonymous_list_excludes_private_tournament(self):
        ids = self.list_ids()
        self.assertIn(self.public_tournament.pk, ids)
        self.assertNotIn(self.private_tournament.pk, ids)

    def test_unrelated_authenticated_user_cannot_view_private_tournament(self):
        self.auth(self.outsider_token)
        self.assertEqual(self.client.get(self.private_detail_url).status_code, status.HTTP_404_NOT_FOUND)
        self.assertNotIn(self.private_tournament.pk, self.list_ids())

    def test_owner_can_view_own_private_tournament(self):
        self.auth(self.owner_token)
        self.assertEqual(self.client.get(self.private_detail_url).status_code, status.HTTP_200_OK)

    def test_registered_participant_can_view_private_tournament(self):
        self.auth(self.participant_token)
        self.assertEqual(self.client.get(self.private_detail_url).status_code, status.HTTP_200_OK)
        self.assertIn(self.private_tournament.pk, self.list_ids())


# ── Tournament cycles ────────────────────────────────────────────────────────

class TournamentCycleTests(AuthMixin, APITestCase):
    def setUp(self):
        self.owner, self.owner_token = self.create_user('owner')
        self.other, self.other_token = self.create_user('other')
        self.list_url = reverse('tournament-cycle-list')

    def test_anonymous_can_view_public_cycle(self):
        cycle = TournamentCycle.objects.create(name='Sezon 2026', owner=self.owner, is_private=False)
        response = self.client.get(reverse('tournament-cycle-detail', args=[cycle.pk]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_anonymous_cannot_view_private_cycle(self):
        cycle = TournamentCycle.objects.create(name='Sezon 2026', owner=self.owner, is_private=True)
        response = self.client.get(reverse('tournament-cycle-detail', args=[cycle.pk]))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_owner_can_create_cycle_with_initial_events(self):
        self.auth(self.owner_token)
        response = self.client.post(self.list_url, {
            'name': 'Sezon 2026',
            'scoring_mode': 'placement',
            'events': [
                {'name': 'Etap 1', 'planned_date': '2026-08-01'},
                {'name': 'Etap 2', 'planned_date': '2026-09-01'},
            ],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data['events']), 2)
        self.assertEqual(response.data['events'][0]['name'], 'Etap 1')
        self.assertEqual(response.data['events'][0]['planned_date'], '2026-08-01')
        self.assertEqual(response.data['status'], 'draft')

    def test_created_cycle_defaults_to_placement_points(self):
        self.auth(self.owner_token)
        response = self.client.post(self.list_url, {'name': 'Sezon 2026'}, format='json')
        self.assertEqual(response.data['placement_points']['winner'], 10)

    def test_anonymous_cannot_create_cycle(self):
        response = self.client.post(self.list_url, {'name': 'Sezon 2026'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_non_owner_cannot_delete_cycle(self):
        cycle = TournamentCycle.objects.create(name='Sezon 2026', owner=self.owner)
        self.auth(self.other_token)
        response = self.client.delete(reverse('tournament-cycle-detail', args=[cycle.pk]))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(TournamentCycle.objects.filter(pk=cycle.pk).exists())

    def test_owner_can_add_event_after_creation(self):
        cycle = TournamentCycle.objects.create(name='Sezon 2026', owner=self.owner)
        self.auth(self.owner_token)
        url = reverse('tournament-cycle-add-event', args=[cycle.pk])
        response = self.client.post(url, {'name': 'Etap 3', 'planned_date': '2026-10-01'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(cycle.events.count(), 1)

    def test_non_owner_cannot_add_event(self):
        cycle = TournamentCycle.objects.create(name='Sezon 2026', owner=self.owner)
        self.auth(self.other_token)
        url = reverse('tournament-cycle-add-event', args=[cycle.pk])
        response = self.client.post(url, {'name': 'Etap 3'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_can_edit_event_date(self):
        cycle = TournamentCycle.objects.create(name='Sezon 2026', owner=self.owner)
        event = CycleEvent.objects.create(cycle=cycle, name='Etap 1', planned_date='2026-08-01')
        self.auth(self.owner_token)
        url = reverse('tournament-cycle-update-event', args=[cycle.pk, event.pk])
        response = self.client.patch(url, {'planned_date': '2026-08-15'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        event.refresh_from_db()
        self.assertEqual(str(event.planned_date), '2026-08-15')

    def test_owner_can_attach_own_tournament_to_event(self):
        cycle = TournamentCycle.objects.create(name='Sezon 2026', owner=self.owner)
        event = CycleEvent.objects.create(cycle=cycle, name='Etap 1')
        tournament = make_tournament(self.owner)
        self.auth(self.owner_token)
        url = reverse('tournament-cycle-update-event', args=[cycle.pk, event.pk])
        response = self.client.patch(url, {'tournament_id': tournament.pk}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['tournament_id'], tournament.pk)

    def test_cannot_attach_someone_elses_tournament(self):
        cycle = TournamentCycle.objects.create(name='Sezon 2026', owner=self.owner)
        event = CycleEvent.objects.create(cycle=cycle, name='Etap 1')
        tournament = make_tournament(self.other)
        self.auth(self.owner_token)
        url = reverse('tournament-cycle-update-event', args=[cycle.pk, event.pk])
        response = self.client.patch(url, {'tournament_id': tournament.pk}, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_attach_tournament_already_linked_to_another_event(self):
        cycle = TournamentCycle.objects.create(name='Sezon 2026', owner=self.owner)
        event_a = CycleEvent.objects.create(cycle=cycle, name='Etap 1')
        event_b = CycleEvent.objects.create(cycle=cycle, name='Etap 2')
        tournament = make_tournament(self.owner)
        event_a.tournament = tournament
        event_a.save()

        self.auth(self.owner_token)
        url = reverse('tournament-cycle-update-event', args=[cycle.pk, event_b.pk])
        response = self.client.patch(url, {'tournament_id': tournament.pk}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# ── Cycle standings ──────────────────────────────────────────────────────────

class CycleStandingsTests(AuthMixin, APITestCase):
    """4-player knockout where the top slot always wins."""

    def setUp(self):
        self.owner, self.owner_token = self.create_user('owner')

    def play_out(self, t):
        while True:
            m = t.matches.filter(status='pending', top_entry__isnull=False, bottom_entry__isnull=False).first()
            if m is None:
                break
            record_result(m, top_score=2, bottom_score=0)
        t.refresh_from_db()

    def names_by_tier(self, t):
        final = t.matches.get(code='r1-m0')
        semis = t.matches.filter(code__startswith='r0-')
        return {
            'winner': final.top_entry.display_name,
            'final':  final.bottom_entry.display_name,
            'semis':  [m.bottom_entry.display_name for m in semis],
        }

    def make_cycle_with_event(self, played=True, **cycle_kwargs):
        cycle = TournamentCycle.objects.create(name='Sezon 2026', owner=self.owner, **cycle_kwargs)
        tournament = make_tournament(self.owner, names=('A', 'B', 'C', 'D'))
        if played:
            self.play_out(tournament)
        CycleEvent.objects.create(cycle=cycle, name='Etap 1', tournament=tournament)
        return cycle, tournament

    def test_placement_mode_awards_tiers_by_round_reached(self):
        cycle, t = self.make_cycle_with_event(scoring_mode='placement')
        rows  = {r['player_name']: r['total_points'] for r in compute_cycle_standings(cycle)}
        names = self.names_by_tier(t)
        self.assertEqual(rows[names['winner']], 10)
        self.assertEqual(rows[names['final']], 7)
        for n in names['semis']:
            self.assertEqual(rows[n], 5)

    def test_standings_sorted_descending(self):
        cycle, _ = self.make_cycle_with_event(scoring_mode='placement')
        totals = [r['total_points'] for r in compute_cycle_standings(cycle)]
        self.assertEqual(totals, sorted(totals, reverse=True))

    def test_match_wins_mode_counts_wins_not_placement(self):
        cycle, t = self.make_cycle_with_event(scoring_mode='match_wins')
        rows  = {r['player_name']: r['total_points'] for r in compute_cycle_standings(cycle)}
        names = self.names_by_tier(t)
        self.assertEqual(rows[names['winner']], 2)
        self.assertEqual(rows[names['final']], 1)
        for n in names['semis']:
            self.assertNotIn(n, rows)

    def test_in_progress_tournament_is_not_counted_yet(self):
        cycle, _ = self.make_cycle_with_event(played=False, scoring_mode='placement')
        self.assertEqual(compute_cycle_standings(cycle), [])

    def test_event_without_tournament_attached_is_ignored(self):
        cycle = TournamentCycle.objects.create(name='Sezon 2026', owner=self.owner)
        CycleEvent.objects.create(cycle=cycle, name='Etap 1')
        self.assertEqual(compute_cycle_standings(cycle), [])

    def test_bonus_points_added_on_top_of_placement(self):
        cycle, t = self.make_cycle_with_event(scoring_mode='placement', bonus_180_points=5)
        winner = t.matches.get(code='r1-m0').top_entry
        MatchStatistic.objects.create(
            tournament=t, match_code='r1-m0', match=t.matches.get(code='r1-m0'), entry=winner,
            player=winner.player, player_name=winner.display_name, count_180=2,
        )
        rows = {r['player_name']: r['total_points'] for r in compute_cycle_standings(cycle)}
        self.assertEqual(rows[winner.display_name], 10 + 2 * 5)

    def test_same_player_is_summed_across_events(self):
        cycle = TournamentCycle.objects.create(name='Sezon 2026', owner=self.owner, scoring_mode='match_wins')
        players = make_players(self.owner, ['P', 'Q'])
        for i in range(2):
            t = create_tournament(
                owner=self.owner, name=f'E{i}', format='knockout', match_format=BO3_LEGS,
                entries=[EntrySpec(player_id=p.pk) for p in players],
            )
            t.bracket_confirmed = True
            t.save()
            self.play_out(t)
            CycleEvent.objects.create(cycle=cycle, name=f'Etap {i}', tournament=t, order=i)
        rows = compute_cycle_standings(cycle)
        self.assertEqual(sum(r['total_points'] for r in rows), 2)
        self.assertTrue(all(r['player_id'] in {p.pk for p in players} for r in rows))

    def test_standings_endpoint_returns_computed_rows(self):
        cycle, t = self.make_cycle_with_event(scoring_mode='placement')
        self.auth(self.owner_token)
        response = self.client.get(reverse('tournament-cycle-standings', args=[cycle.pk]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        winner = self.names_by_tier(t)['winner']
        self.assertEqual(next(r for r in response.data if r['player_name'] == winner)['total_points'], 10)
