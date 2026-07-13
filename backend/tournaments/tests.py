from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from .models import (
    MatchLeg, MatchStatistic, Tournament, TournamentCycle, CycleEvent,
    _bracket_has_pending_matches, compute_cycle_standings,
)


# ── Fixtures ─────────────────────────────────────────────────────────────────

def make_leg(winner='top') -> dict:
    """A completed 501 leg: two rounds, winner finishes on 0."""
    return {
        'rounds': [
            {
                'p0': {'score': 180, 'remaining': 321},
                'p1': {'score': 140, 'remaining': 361},
            },
            {
                'p0': {'score': 321, 'remaining': 0},
            },
        ],
        'winner': winner,
    }


def make_bracket_with_legs(legs=None, with_result=False) -> dict:
    bracket = make_bracket(with_result=with_result)
    if legs is not None:
        bracket['rounds'][0]['matches'][0]['legs'] = legs
    return bracket


def make_bracket(with_result=False, both_cpu=False) -> dict:
    """Minimal 2-player knockout bracket (1 match, 1 round)."""
    result = {
        'topSetsWon': 2,
        'bottomSetsWon': 0,
        'displayScore': '2–0',
        'winner': 'top',
    } if with_result else None

    match = {
        'id': 'r0-m0',
        'top':    {'playerId': 1, 'playerName': 'A', 'playerAvg': 50.0, 'isCpu': both_cpu},
        'bottom': {'playerId': 2, 'playerName': 'B', 'playerAvg': 45.0, 'isCpu': both_cpu},
    }
    if result:
        match['result'] = result

    return {
        'format': 'knockout',
        'name': 'Test',
        'playerCount': 2,
        'matchFormat': {'sets': 3, 'legs': 3},
        'rounds': [{'id': 'r0', 'label': 'Finał', 'matches': [match]}],
    }


def make_tournament(owner=None, **kwargs) -> Tournament:
    return Tournament.objects.create(
        name='Test Tournament',
        format='knockout',
        bracket=make_bracket(),
        owner=owner,
        **kwargs,
    )


# ── Helper mixin ─────────────────────────────────────────────────────────────

class AuthMixin:
    def create_user(self, username, password='pass'):
        user = User.objects.create_user(username=username, password=password)
        token = Token.objects.create(user=user)
        return user, token

    def auth(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def no_auth(self):
        self.client.credentials()


# ── Permission tests ──────────────────────────────────────────────────────────

class TournamentPermissionTests(AuthMixin, APITestCase):

    def setUp(self):
        self.owner, self.owner_token       = self.create_user('owner')
        self.other, self.other_token       = self.create_user('other')
        self.tournament                    = make_tournament(owner=self.owner)
        self.list_url   = reverse('tournament-list')
        self.detail_url = reverse('tournament-detail', args=[self.tournament.pk])

    # ── List / Detail ─────────────────────────────────────────────────────────

    def test_anyone_can_list_tournaments(self):
        self.no_auth()
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_anyone_can_view_tournament(self):
        self.no_auth()
        response = self.client.get(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_response_includes_owner_username(self):
        response = self.client.get(self.detail_url)
        self.assertEqual(response.data['owner_username'], 'owner')

    # ── Create ────────────────────────────────────────────────────────────────

    def test_anonymous_cannot_create_tournament(self):
        self.no_auth()
        response = self.client.post(self.list_url, {
            'name': 'New', 'format': 'knockout', 'bracket': make_bracket(),
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_user_can_create_tournament(self):
        self.auth(self.other_token)
        response = self.client.post(self.list_url, {
            'name': 'New', 'format': 'knockout', 'bracket': make_bracket(),
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_create_sets_owner_to_current_user(self):
        self.auth(self.other_token)
        response = self.client.post(self.list_url, {
            'name': 'New', 'format': 'knockout', 'bracket': make_bracket(),
        }, format='json')
        self.assertEqual(response.data['owner_username'], 'other')

    # ── Update (bracket / results) ────────────────────────────────────────────

    def test_owner_can_update_bracket(self):
        self.auth(self.owner_token)
        response = self.client.patch(
            self.detail_url, {'bracket': make_bracket(with_result=True)}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_non_owner_cannot_update_bracket(self):
        self.auth(self.other_token)
        response = self.client.patch(
            self.detail_url, {'bracket': make_bracket(with_result=True)}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_anonymous_cannot_update_bracket(self):
        self.no_auth()
        response = self.client.patch(
            self.detail_url, {'bracket': make_bracket(with_result=True)}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # ── Delete ────────────────────────────────────────────────────────────────

    def test_owner_can_delete_tournament(self):
        self.auth(self.owner_token)
        response = self.client.delete(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Tournament.objects.filter(pk=self.tournament.pk).exists())

    def test_non_owner_cannot_delete_tournament(self):
        self.auth(self.other_token)
        response = self.client.delete(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Tournament.objects.filter(pk=self.tournament.pk).exists())

    def test_anonymous_cannot_delete_tournament(self):
        self.no_auth()
        response = self.client.delete(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


# ── Match result immutability ─────────────────────────────────────────────────

class MatchResultImmutabilityTests(AuthMixin, APITestCase):
    """
    Once a match has a recorded result, later PATCHes must not be able to
    change or clear it — e.g. a stale client that reopened an already-finished
    match's live screen (see LiveMatchPage's browser-back guard) must not be
    able to silently rewrite the decided result via the update endpoint.
    """

    def setUp(self):
        self.owner, self.token = self.create_user('owner')
        self.tournament = make_tournament(owner=self.owner)
        self.tournament.bracket = make_bracket(with_result=True)
        self.tournament.save()
        self.url = reverse('tournament-detail', args=[self.tournament.pk])
        self.auth(self.token)

    def test_changing_an_existing_result_is_rejected(self):
        tampered = make_bracket(with_result=True)
        tampered['rounds'][0]['matches'][0]['result'] = {
            'topSetsWon': 0, 'bottomSetsWon': 2, 'displayScore': '0–2', 'winner': 'bottom',
        }
        response = self.client.patch(self.url, {'bracket': tampered}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.tournament.refresh_from_db()
        self.assertEqual(self.tournament.bracket['rounds'][0]['matches'][0]['result']['winner'], 'top')

    def test_clearing_an_existing_result_is_rejected(self):
        response = self.client.patch(
            self.url, {'bracket': make_bracket(with_result=False)}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.tournament.refresh_from_db()
        self.assertIn('result', self.tournament.bracket['rounds'][0]['matches'][0])

    def test_resending_the_identical_result_is_accepted(self):
        response = self.client.patch(
            self.url, {'bracket': make_bracket(with_result=True)}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_adding_leg_details_to_a_decided_match_is_still_accepted(self):
        """Legs can still be attached for a decided match as long as its result is untouched."""
        bracket = make_bracket_with_legs(legs=[make_leg()], with_result=True)
        response = self.client.patch(self.url, {'bracket': bracket}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ── Bot-vs-bot "Symuluj na żywo" lock ─────────────────────────────────────────

class BotSimulationLockTests(AuthMixin, APITestCase):
    """
    While a bot-vs-bot match is being played out via "Symuluj na żywo",
    MatchLeg.current_leg is kept non-null as a lock. A second device signed
    into the same account must not be able to race it with "Symuluj" (instant)
    or "Wpisz wynik" for the same match.
    """

    def setUp(self):
        self.owner, self.token = self.create_user('owner')
        self.tournament = make_tournament(owner=self.owner)
        self.tournament.bracket = make_bracket(both_cpu=True)
        self.tournament.save()
        self.url = reverse('tournament-detail', args=[self.tournament.pk])
        self.auth(self.token)
        MatchLeg.objects.create(
            tournament=self.tournament,
            match_id='r0-m0',
            legs=[],
            current_leg={'rounds': [], 'activePlayer': 0},
        )

    def test_setting_result_while_simulation_locked_is_rejected(self):
        response = self.client.patch(
            self.url, {'bracket': make_bracket(with_result=True, both_cpu=True)}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.tournament.refresh_from_db()
        self.assertNotIn('result', self.tournament.bracket['rounds'][0]['matches'][0])

    def test_setting_result_after_lock_cleared_is_accepted(self):
        MatchLeg.objects.filter(tournament=self.tournament, match_id='r0-m0').update(current_leg=None)
        response = self.client.patch(
            self.url, {'bracket': make_bracket(with_result=True, both_cpu=True)}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_deciding_a_match_force_clears_its_own_lock(self):
        MatchLeg.objects.filter(tournament=self.tournament, match_id='r0-m0').update(current_leg=None)
        self.client.patch(
            self.url, {'bracket': make_bracket(with_result=True, both_cpu=True)}, format='json'
        )
        ml = MatchLeg.objects.get(tournament=self.tournament, match_id='r0-m0')
        self.assertIsNone(ml.current_leg)

    def test_human_match_is_not_blocked_by_a_stray_locked_current_leg(self):
        """The lock only applies to bot-vs-bot matches — a human match's result
        must never be blocked by this guard, even if some other match_id has
        a stale current_leg (e.g. the pre-existing human live-match race)."""
        self.tournament.bracket = make_bracket(both_cpu=False)
        self.tournament.save()
        response = self.client.patch(
            self.url, {'bracket': make_bracket(with_result=True, both_cpu=False)}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ── Leg details permission tests ──────────────────────────────────────────────

class LegDetailsPermissionTests(AuthMixin, APITestCase):
    """
    Leg details are saved by PATCHing the bracket — the same IsOwnerOrReadOnly
    rule applies. This explicitly verifies that non-owners cannot inject or
    overwrite leg data.
    """

    def setUp(self):
        self.owner, self.owner_token = self.create_user('owner')
        self.other, self.other_token = self.create_user('other')
        self.tournament = make_tournament(owner=self.owner)
        self.url = reverse('tournament-detail', args=[self.tournament.pk])

    def test_owner_can_save_leg_details(self):
        self.auth(self.owner_token)
        response = self.client.patch(
            self.url, {'bracket': make_bracket_with_legs(legs=[make_leg()])}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_non_owner_cannot_save_leg_details(self):
        self.auth(self.other_token)
        response = self.client.patch(
            self.url, {'bracket': make_bracket_with_legs(legs=[make_leg()])}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_anonymous_cannot_save_leg_details(self):
        self.no_auth()
        response = self.client.patch(
            self.url, {'bracket': make_bracket_with_legs(legs=[make_leg()])}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_non_owner_attempt_does_not_persist_leg_data(self):
        self.auth(self.other_token)
        self.client.patch(
            self.url, {'bracket': make_bracket_with_legs(legs=[make_leg()])}, format='json'
        )
        self.tournament.refresh_from_db()
        match = self.tournament.bracket['rounds'][0]['matches'][0]
        self.assertNotIn('legs', match)


# ── Leg details storage tests ─────────────────────────────────────────────────

class LegDetailsStorageTests(AuthMixin, APITestCase):
    """Leg details are correctly persisted and returned verbatim."""

    def setUp(self):
        self.owner, self.token = self.create_user('owner')
        self.tournament = make_tournament(owner=self.owner)
        self.url = reverse('tournament-detail', args=[self.tournament.pk])
        self.auth(self.token)

    def _patch_legs(self, legs):
        return self.client.patch(
            self.url, {'bracket': make_bracket_with_legs(legs=legs)}, format='json'
        )

    def test_single_leg_is_persisted(self):
        self._patch_legs([make_leg()])
        self.tournament.refresh_from_db()
        legs = self.tournament.bracket['rounds'][0]['matches'][0]['legs']
        self.assertEqual(len(legs), 1)
        self.assertEqual(legs[0]['winner'], 'top')

    def test_leg_data_is_returned_in_response(self):
        response = self._patch_legs([make_leg()])
        legs = response.data['bracket']['rounds'][0]['matches'][0]['legs']
        self.assertEqual(len(legs), 1)
        self.assertEqual(legs[0]['winner'], 'top')

    def test_multiple_legs_are_stored_in_order(self):
        legs_to_send = [make_leg('top'), make_leg('bottom'), make_leg('top')]
        self._patch_legs(legs_to_send)
        self.tournament.refresh_from_db()
        legs = self.tournament.bracket['rounds'][0]['matches'][0]['legs']
        self.assertEqual(len(legs), 3)
        self.assertEqual([l['winner'] for l in legs], ['top', 'bottom', 'top'])

    def test_leg_round_scores_are_stored(self):
        self._patch_legs([make_leg()])
        self.tournament.refresh_from_db()
        rounds = self.tournament.bracket['rounds'][0]['matches'][0]['legs'][0]['rounds']
        self.assertEqual(len(rounds), 2)
        self.assertEqual(rounds[0]['p0']['score'], 180)
        self.assertEqual(rounds[0]['p0']['remaining'], 321)
        self.assertEqual(rounds[0]['p1']['score'], 140)
        self.assertEqual(rounds[1]['p0']['remaining'], 0)

    def test_subsequent_patch_replaces_legs(self):
        """Each PATCH sends the full bracket; legs are overwritten, not appended."""
        self._patch_legs([make_leg('top')])
        self._patch_legs([make_leg('top'), make_leg('bottom')])
        self.tournament.refresh_from_db()
        legs = self.tournament.bracket['rounds'][0]['matches'][0]['legs']
        self.assertEqual(len(legs), 2)

    def test_leg_details_coexist_with_match_result(self):
        bracket = make_bracket_with_legs(legs=[make_leg(), make_leg()], with_result=True)
        response = self.client.patch(self.url, {'bracket': bracket}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.tournament.refresh_from_db()
        match = self.tournament.bracket['rounds'][0]['matches'][0]
        self.assertIn('result', match)
        self.assertEqual(len(match['legs']), 2)


# ── is_active tests ───────────────────────────────────────────────────────────

class TournamentIsActiveTests(AuthMixin, APITestCase):

    def setUp(self):
        self.owner, self.token = self.create_user('owner')
        self.tournament        = make_tournament(owner=self.owner)
        self.detail_url = reverse('tournament-detail', args=[self.tournament.pk])

    def test_new_tournament_is_active(self):
        self.assertTrue(self.tournament.is_active)

    def test_updating_with_all_results_marks_inactive(self):
        self.auth(self.token)
        self.client.patch(
            self.detail_url, {'bracket': make_bracket(with_result=True)}, format='json'
        )
        self.tournament.refresh_from_db()
        self.assertFalse(self.tournament.is_active)

    def test_updating_with_pending_matches_keeps_active(self):
        self.auth(self.token)
        self.client.patch(
            self.detail_url, {'bracket': make_bracket(with_result=False)}, format='json'
        )
        self.tournament.refresh_from_db()
        self.assertTrue(self.tournament.is_active)


# ── _bracket_has_pending_matches unit tests ───────────────────────────────────

class BracketHasPendingMatchesTests(APITestCase):

    def test_returns_true_when_match_has_no_result(self):
        self.assertTrue(_bracket_has_pending_matches(make_bracket(with_result=False)))

    def test_returns_false_when_all_matches_have_results(self):
        self.assertFalse(_bracket_has_pending_matches(make_bracket(with_result=True)))

    def test_groups_format_always_returns_true(self):
        bracket = {'format': 'groups', 'groups': []}
        self.assertTrue(_bracket_has_pending_matches(bracket))

    def test_empty_rounds_returns_false(self):
        bracket = {'format': 'knockout', 'rounds': []}
        self.assertFalse(_bracket_has_pending_matches(bracket))


# ── phaseConfigs in bracket ───────────────────────────────────────────────────

def make_bracket_with_phase_configs() -> dict:
    """Bracket with per-round date and matchFormat in phaseConfigs."""
    bracket = make_bracket()
    bracket['phaseConfigs'] = {
        'round-0': {
            'date': '2026-07-01T18:00',
            'matchFormat': {'sets': 1, 'legs': 9},
        },
    }
    return bracket


class PhaseConfigTests(AuthMixin, APITestCase):
    """phaseConfigs is stored and returned verbatim — backend is format-agnostic."""

    def setUp(self):
        self.owner, self.token = self.create_user('owner')
        self.list_url = reverse('tournament-list')

    def test_bracket_with_phase_configs_is_accepted(self):
        self.auth(self.token)
        response = self.client.post(
            self.list_url,
            {'name': 'Phased', 'format': 'knockout', 'bracket': make_bracket_with_phase_configs()},
            format='json',
        )
        self.assertEqual(response.status_code, 201)

    def test_phase_configs_are_returned_in_response(self):
        self.auth(self.token)
        response = self.client.post(
            self.list_url,
            {'name': 'Phased', 'format': 'knockout', 'bracket': make_bracket_with_phase_configs()},
            format='json',
        )
        phase_configs = response.data['bracket'].get('phaseConfigs', {})
        self.assertIn('round-0', phase_configs)
        self.assertEqual(phase_configs['round-0']['matchFormat']['legs'], 9)

    def test_phase_configs_survive_round_trip(self):
        self.auth(self.token)
        create_resp = self.client.post(
            self.list_url,
            {'name': 'Phased', 'format': 'knockout', 'bracket': make_bracket_with_phase_configs()},
            format='json',
        )
        detail_url = reverse('tournament-detail', args=[create_resp.data['id']])
        get_resp = self.client.get(detail_url)
        phase_configs = get_resp.data['bracket'].get('phaseConfigs', {})
        self.assertEqual(phase_configs['round-0']['date'], '2026-07-01T18:00')


# ── placeholder players (negative playerId) ───────────────────────────────────

def make_bracket_with_placeholder() -> dict:
    """Bracket where one slot has a negative playerId (placeholder)."""
    bracket = make_bracket()
    bracket['rounds'][0]['matches'][0]['top'] = {
        'playerId': -1,
        'playerName': 'Jan Kowalski',
        'playerAvg': 0.0,
        'isCpu': False,
    }
    return bracket


class PlaceholderPlayerTests(AuthMixin, APITestCase):
    """Brackets with negative playerIds (placeholders) are accepted and stored."""

    def setUp(self):
        self.owner, self.token = self.create_user('owner')
        self.list_url = reverse('tournament-list')
        self.auth(self.token)

    def test_bracket_with_placeholder_is_accepted(self):
        response = self.client.post(
            self.list_url,
            {'name': 'TBD', 'format': 'knockout', 'bracket': make_bracket_with_placeholder()},
            format='json',
        )
        self.assertEqual(response.status_code, 201)

    def test_placeholder_participant_has_no_player_fk(self):
        from .models import TournamentParticipant
        response = self.client.post(
            self.list_url,
            {'name': 'TBD', 'format': 'knockout', 'bracket': make_bracket_with_placeholder()},
            format='json',
        )
        t = Tournament.objects.get(pk=response.data['id'])
        placeholder = TournamentParticipant.objects.get(tournament=t, display_name='Jan Kowalski')
        self.assertIsNone(placeholder.player)

    def test_placeholder_display_name_is_stored(self):
        from .models import TournamentParticipant
        self.client.post(
            self.list_url,
            {'name': 'TBD', 'format': 'knockout', 'bracket': make_bracket_with_placeholder()},
            format='json',
        )
        t = Tournament.objects.latest('created_at')
        names = list(TournamentParticipant.objects.filter(tournament=t).values_list('display_name', flat=True))
        self.assertIn('Jan Kowalski', names)


# ── Privacy (is_private) ──────────────────────────────────────────────────────

class TournamentPrivacyTests(AuthMixin, APITestCase):
    """
    is_private=False: visible to everyone.
    is_private=True: visible only to the owner and to registered players
    (accounts with a linked Player) who are participants in it.
    """

    def setUp(self):
        from players.models import Player
        from .models import TournamentParticipant

        self.owner, self.owner_token           = self.create_user('owner')
        self.participant, self.participant_token = self.create_user('participant')
        self.outsider, self.outsider_token     = self.create_user('outsider')

        self.participant_player = Player.objects.create(
            user=self.participant, first_name='Part', last_name='Icipant',
        )

        self.public_tournament  = Tournament.objects.create(
            name='Public', format='knockout', bracket=make_bracket(), owner=self.owner, is_private=False,
        )
        self.private_tournament = Tournament.objects.create(
            name='Private', format='knockout', bracket=make_bracket(), owner=self.owner, is_private=True,
        )
        TournamentParticipant.objects.create(
            tournament=self.private_tournament, player=self.participant_player, display_name='Part Icipant',
        )

        self.list_url            = reverse('tournament-list')
        self.public_detail_url   = reverse('tournament-detail', args=[self.public_tournament.pk])
        self.private_detail_url  = reverse('tournament-detail', args=[self.private_tournament.pk])

    def test_anonymous_can_view_public_tournament(self):
        self.no_auth()
        response = self.client.get(self.public_detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_anonymous_cannot_view_private_tournament(self):
        self.no_auth()
        response = self.client.get(self.private_detail_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_anonymous_list_excludes_private_tournament(self):
        self.no_auth()
        response = self.client.get(self.list_url)
        ids = [t['id'] for t in response.data['results']]
        self.assertIn(self.public_tournament.pk, ids)
        self.assertNotIn(self.private_tournament.pk, ids)

    def test_unrelated_authenticated_user_cannot_view_private_tournament(self):
        self.auth(self.outsider_token)
        response = self.client.get(self.private_detail_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_unrelated_authenticated_user_list_excludes_private_tournament(self):
        self.auth(self.outsider_token)
        response = self.client.get(self.list_url)
        ids = [t['id'] for t in response.data['results']]
        self.assertNotIn(self.private_tournament.pk, ids)

    def test_owner_can_view_own_private_tournament(self):
        self.auth(self.owner_token)
        response = self.client.get(self.private_detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_registered_participant_can_view_private_tournament(self):
        self.auth(self.participant_token)
        response = self.client.get(self.private_detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_registered_participant_list_includes_private_tournament(self):
        self.auth(self.participant_token)
        response = self.client.get(self.list_url)
        ids = [t['id'] for t in response.data['results']]
        self.assertIn(self.private_tournament.pk, ids)


# ── Tournament cycles ─────────────────────────────────────────────────────────

class TournamentCycleTests(AuthMixin, APITestCase):
    def setUp(self):
        self.owner, self.owner_token = self.create_user('owner')
        self.other, self.other_token = self.create_user('other')
        self.list_url = reverse('tournament-cycle-list')

    def test_anonymous_can_view_public_cycle(self):
        cycle = TournamentCycle.objects.create(name='Sezon 2026', owner=self.owner, is_private=False)
        self.no_auth()
        response = self.client.get(reverse('tournament-cycle-detail', args=[cycle.pk]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_anonymous_cannot_view_private_cycle(self):
        cycle = TournamentCycle.objects.create(name='Sezon 2026', owner=self.owner, is_private=True)
        self.no_auth()
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
        self.no_auth()
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
        tournament = make_tournament(owner=self.owner)
        self.auth(self.owner_token)
        url = reverse('tournament-cycle-update-event', args=[cycle.pk, event.pk])
        response = self.client.patch(url, {'tournament_id': tournament.pk}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['tournament_id'], tournament.pk)

    def test_cannot_attach_someone_elses_tournament(self):
        cycle = TournamentCycle.objects.create(name='Sezon 2026', owner=self.owner)
        event = CycleEvent.objects.create(cycle=cycle, name='Etap 1')
        tournament = make_tournament(owner=self.other)
        self.auth(self.owner_token)
        url = reverse('tournament-cycle-update-event', args=[cycle.pk, event.pk])
        response = self.client.patch(url, {'tournament_id': tournament.pk}, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_attach_tournament_already_linked_to_another_event(self):
        cycle = TournamentCycle.objects.create(name='Sezon 2026', owner=self.owner)
        event_a = CycleEvent.objects.create(cycle=cycle, name='Etap 1')
        event_b = CycleEvent.objects.create(cycle=cycle, name='Etap 2')
        tournament = make_tournament(owner=self.owner)
        event_a.tournament = tournament
        event_a.save()

        self.auth(self.owner_token)
        url = reverse('tournament-cycle-update-event', args=[cycle.pk, event_b.pk])
        response = self.client.patch(url, {'tournament_id': tournament.pk}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# ── Cycle standings ───────────────────────────────────────────────────────────

def make_4p_knockout_bracket(with_results=True) -> dict:
    """4-player knockout: A beats B and C beats D in the semis, A beats C in the final."""
    def result(winner):
        return {'topSetsWon': 1, 'bottomSetsWon': 0, 'displayScore': '2–0', 'winner': winner} if with_results else None

    def match(mid, top_id, top_name, bot_id, bot_name):
        m = {
            'id': mid,
            'top':    {'playerId': top_id, 'playerName': top_name, 'playerAvg': 50.0, 'isCpu': False},
            'bottom': {'playerId': bot_id, 'playerName': bot_name, 'playerAvg': 50.0, 'isCpu': False},
        }
        r = result('top')
        if r:
            m['result'] = r
        return m

    return {
        'format': 'knockout',
        'name': 'Cup',
        'playerCount': 4,
        'matchFormat': {'sets': 1, 'legs': 3},
        'rounds': [
            {
                'id': 'round-0', 'label': 'Półfinał',
                'matches': [
                    match('r0-m0', 1, 'A', 2, 'B'),
                    match('r0-m1', 3, 'C', 4, 'D'),
                ],
            },
            {
                'id': 'round-1', 'label': 'Finał',
                'matches': [match('r1-m0', 1, 'A', 3, 'C')],
            },
        ],
    }


class CycleStandingsTests(AuthMixin, APITestCase):
    def setUp(self):
        self.owner, self.owner_token = self.create_user('owner')

    def make_cycle_with_event(self, **cycle_kwargs):
        cycle = TournamentCycle.objects.create(name='Sezon 2026', owner=self.owner, **cycle_kwargs)
        tournament = Tournament.objects.create(
            name='Cup', format='knockout', bracket=make_4p_knockout_bracket(),
            owner=self.owner, is_active=False,
        )
        event = CycleEvent.objects.create(cycle=cycle, name='Etap 1', tournament=tournament)
        return cycle, event, tournament

    def test_placement_mode_awards_tiers_by_round_reached(self):
        cycle, _, _ = self.make_cycle_with_event(scoring_mode='placement')
        rows = {r['player_name']: r['total_points'] for r in compute_cycle_standings(cycle)}
        self.assertEqual(rows['A'], 10)  # winner
        self.assertEqual(rows['C'], 7)   # final (runner-up)
        self.assertEqual(rows['B'], 5)   # semifinal
        self.assertEqual(rows['D'], 5)   # semifinal

    def test_standings_sorted_descending(self):
        cycle, _, _ = self.make_cycle_with_event(scoring_mode='placement')
        rows = compute_cycle_standings(cycle)
        totals = [r['total_points'] for r in rows]
        self.assertEqual(totals, sorted(totals, reverse=True))

    def test_match_wins_mode_counts_wins_not_placement(self):
        cycle, _, _ = self.make_cycle_with_event(scoring_mode='match_wins')
        rows = {r['player_name']: r['total_points'] for r in compute_cycle_standings(cycle)}
        self.assertEqual(rows['A'], 2)  # won semi + final
        self.assertEqual(rows['C'], 1)  # won semi only
        self.assertNotIn('B', rows)     # 0 wins — not listed
        self.assertNotIn('D', rows)

    def test_in_progress_tournament_is_not_counted_yet(self):
        cycle = TournamentCycle.objects.create(name='Sezon 2026', owner=self.owner, scoring_mode='placement')
        tournament = Tournament.objects.create(
            name='Cup', format='knockout', bracket=make_4p_knockout_bracket(with_results=False),
            owner=self.owner, is_active=True,
        )
        CycleEvent.objects.create(cycle=cycle, name='Etap 1', tournament=tournament)
        self.assertEqual(compute_cycle_standings(cycle), [])

    def test_event_without_tournament_attached_is_ignored(self):
        cycle = TournamentCycle.objects.create(name='Sezon 2026', owner=self.owner)
        CycleEvent.objects.create(cycle=cycle, name='Etap 1')
        self.assertEqual(compute_cycle_standings(cycle), [])

    def test_bonus_points_added_on_top_of_placement(self):
        cycle, event, tournament = self.make_cycle_with_event(scoring_mode='placement', bonus_180_points=5)
        from players.models import Player
        # Player pk must match the bracket's playerId=1 for A so the bonus merges
        # with the placement points (both keyed by (player_id, player_name)).
        player_a = Player.objects.create(pk=1, first_name='A', last_name='', average=0)
        MatchStatistic.objects.create(
            tournament=tournament, match_id='r1-m0', player=player_a, player_name='A',
            count_180=2,
        )
        rows = {r['player_name']: r['total_points'] for r in compute_cycle_standings(cycle)}
        self.assertEqual(rows['A'], 10 + 2 * 5)

    def test_placeholder_player_merges_placement_and_bonus_by_name(self):
        bracket = make_4p_knockout_bracket()
        bracket['rounds'][0]['matches'][0]['top'] = {
            'playerId': -1, 'playerName': 'Placeholder', 'playerAvg': None, 'isCpu': False,
        }
        bracket['rounds'][1]['matches'][0]['top'] = {
            'playerId': -1, 'playerName': 'Placeholder', 'playerAvg': None, 'isCpu': False,
        }
        cycle = TournamentCycle.objects.create(name='Sezon 2026', owner=self.owner, bonus_180_points=5)
        tournament = Tournament.objects.create(
            name='Cup', format='knockout', bracket=bracket, owner=self.owner, is_active=False,
        )
        CycleEvent.objects.create(cycle=cycle, name='Etap 1', tournament=tournament)
        MatchStatistic.objects.create(
            tournament=tournament, match_id='r1-m0', player=None, player_name='Placeholder', count_180=1,
        )
        rows = {r['player_name']: r['total_points'] for r in compute_cycle_standings(cycle)}
        self.assertEqual(rows['Placeholder'], 10 + 5)

    def test_standings_endpoint_returns_computed_rows(self):
        cycle, _, _ = self.make_cycle_with_event(scoring_mode='placement')
        self.auth(self.owner_token)
        url = reverse('tournament-cycle-standings', args=[cycle.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        winner_row = next(r for r in response.data if r['player_name'] == 'A')
        self.assertEqual(winner_row['total_points'], 10)
