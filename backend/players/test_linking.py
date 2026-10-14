from datetime import timedelta

from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from tournaments.models import MatchStatistic, TournamentCycle, CycleEvent
from tournaments.services import EntrySpec, create_tournament, record_result
from tournaments.services.cycles import compute_cycle_standings

from leagues.models import League, LeagueMember

from .models import Player, PlayerContact, PlayerLinkCode

BO3 = {'sets': 1, 'legs': 3}


class LinkingTestCase(APITestCase):
    """Organizer B runs tournaments with account-less players; A later
    registers and asks B to link A's old entries to A's profile."""

    def setUp(self):
        self.b, self.b_token = self.make_user('organizer')
        self.a, self.a_token = self.make_user('anna')
        self.a_profile = Player.objects.create(user=self.a, owner=self.a, first_name='Anna', last_name='Nowak')
        self.stranger, self.stranger_token = self.make_user('stranger')

        # B's tournament where Anna played without an account.
        self.other = Player.objects.create(owner=self.b, first_name='Olek', last_name='')
        self.t = create_tournament(
            owner=self.b, name='Środa', format='knockout', match_format=BO3, is_private=True,
            entries=[EntrySpec(name='Ania N'), EntrySpec(player_id=self.other.pk)],
        )
        self.slup = self.t.entries.get(display_name='Ania N').player

    def make_user(self, username):
        user = User.objects.create_user(username, password='pass')
        return user, Token.objects.create(user=user)

    def as_user(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def issue_code(self):
        self.as_user(self.a_token)
        return self.client.post(reverse('player-link-code')).data['code']

    def link(self, code, slup=None, token=None, **extra):
        self.as_user(token or self.b_token)
        return self.client.post(reverse('player-link', args=[(slup or self.slup).pk]), {'code': code, **extra}, format='json')

    def play_out(self, t):
        t.bracket_confirmed = True
        t.save()
        while (m := t.matches.filter(status='pending', top_entry__isnull=False, bottom_entry__isnull=False).first()):
            record_result(m, top_score=2, bottom_score=0)
        t.refresh_from_db()


class LinkCodeTests(LinkingTestCase):

    def test_registered_player_gets_a_readable_code(self):
        code = self.issue_code()
        self.assertRegex(code, r'^[A-Z2-9]{4}-[A-Z2-9]{4}$')
        self.assertEqual(self.client.get(reverse('player-link-code')).data['code'], code)

    def test_new_code_replaces_the_old_one(self):
        old = self.issue_code()
        self.issue_code()
        self.assertEqual(self.link(old).status_code, status.HTTP_400_BAD_REQUEST)

    def test_revoked_code_stops_working(self):
        code = self.issue_code()
        self.client.delete(reverse('player-link-code'))
        self.assertEqual(self.link(code).status_code, status.HTTP_400_BAD_REQUEST)

    def test_expired_code_is_rejected(self):
        code = self.issue_code()
        PlayerLinkCode.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.link(code).status_code, status.HTTP_400_BAD_REQUEST)
        self.as_user(self.a_token)
        self.assertIsNone(self.client.get(reverse('player-link-code')).data['code'])

    def test_user_without_profile_cannot_issue_a_code(self):
        self.as_user(self.stranger_token)
        self.assertEqual(self.client.post(reverse('player-link-code')).status_code, status.HTTP_400_BAD_REQUEST)

    def test_anonymous_cannot_issue_a_code(self):
        self.client.credentials()
        self.assertEqual(self.client.post(reverse('player-link-code')).status_code, status.HTTP_401_UNAUTHORIZED)


class LinkTests(LinkingTestCase):

    def test_dry_run_shows_whose_code_it_is_without_linking(self):
        response = self.link(self.issue_code(), dry_run=True)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['linked_to'], 'Anna Nowak')
        self.slup.refresh_from_db()
        self.assertIsNone(self.slup.merged_into)

    def test_organizer_links_their_guest_with_the_code(self):
        code = self.issue_code()
        response = self.link(code.lower().replace('-', ' '))  # forgiving about case and separators
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.slup.refresh_from_db()
        self.assertEqual(self.slup.merged_into, self.a_profile)

    def test_only_the_guests_owner_can_link(self):
        response = self.link(self.issue_code(), token=self.stranger_token)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_only_account_less_players_can_be_linked(self):
        code = self.issue_code()
        bot = Player.objects.create(owner=self.b, first_name='Bot', last_name='', cpu=True)
        b_profile = Player.objects.create(user=self.b, owner=self.b, first_name='Bartek', last_name='')
        for target in (bot, b_profile):
            self.assertEqual(self.link(code, slup=target).status_code, status.HTTP_400_BAD_REQUEST)

    def test_already_linked_guest_is_rejected(self):
        code = self.issue_code()
        self.link(code)
        self.assertEqual(self.link(code).status_code, status.HTTP_400_BAD_REQUEST)

    def test_garbage_code_is_rejected(self):
        self.assertEqual(self.link('XXXX-XXXX').status_code, status.HTTP_400_BAD_REQUEST)

    def test_players_who_met_in_one_tournament_cannot_be_the_same_person(self):
        PlayerContact.objects.create(owner=self.b, player=self.a_profile)
        create_tournament(
            owner=self.b, name='Czwartek', format='knockout', match_format=BO3,
            entries=[EntrySpec(player_id=self.slup.pk), EntrySpec(player_id=self.a_profile.pk)],
        )
        response = self.link(self.issue_code())
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Czwartek', response.data['detail'])

    def test_one_code_links_several_guests(self):
        code = self.issue_code()
        t2 = create_tournament(
            owner=self.b, name='Piątek', format='knockout', match_format=BO3,
            entries=[EntrySpec(name='Anka'), EntrySpec(player_id=self.other.pk)],
        )
        second = t2.entries.get(display_name='Anka').player
        self.assertEqual(self.link(code).status_code, status.HTTP_200_OK)
        self.assertEqual(self.link(code, slup=second).status_code, status.HTTP_200_OK)
        self.assertEqual(self.a_profile.merged_aliases.count(), 2)


class UnlinkTests(LinkingTestCase):

    def setUp(self):
        super().setUp()
        self.link(self.issue_code())

    def unlink(self, token):
        self.as_user(token)
        return self.client.post(reverse('player-unlink', args=[self.slup.pk]))

    def test_organizer_can_unlink(self):
        self.assertEqual(self.unlink(self.b_token).status_code, status.HTTP_204_NO_CONTENT)
        self.slup.refresh_from_db()
        self.assertIsNone(self.slup.merged_into)

    def test_linked_player_can_unlink(self):
        self.assertEqual(self.unlink(self.a_token).status_code, status.HTTP_204_NO_CONTENT)

    def test_stranger_cannot_unlink(self):
        self.assertEqual(self.unlink(self.stranger_token).status_code, status.HTTP_403_FORBIDDEN)


class LinkedIdentityTests(LinkingTestCase):
    """After linking, the guest's history counts as Anna's."""

    def setUp(self):
        super().setUp()
        MatchStatistic.objects.create(
            tournament=self.t, match=self.t.matches.get(code='r0-m0'),
            entry=self.t.entries.get(player=self.slup), match_code='r0-m0',
            player=self.slup, player_name='Ania N', match_average=55.0, count_180=2,
        )

    def test_stats_include_linked_guest_history(self):
        self.as_user(self.a_token)
        before = self.client.get(reverse('player-my-stats')).data['stats']
        self.assertEqual(before['matches_played'], 0)
        self.link(self.issue_code())
        self.as_user(self.a_token)
        after = self.client.get(reverse('player-my-stats')).data['stats']
        self.assertEqual((after['matches_played'], after['count_180']), (1, 2))

    def test_private_tournament_of_the_guest_becomes_visible(self):
        detail = reverse('tournament-detail', args=[self.t.pk])
        self.as_user(self.a_token)
        self.assertEqual(self.client.get(detail).status_code, status.HTTP_404_NOT_FOUND)
        self.link(self.issue_code())
        self.as_user(self.a_token)
        self.assertEqual(self.client.get(detail).status_code, status.HTTP_200_OK)

    def test_unlinking_removes_the_history_again(self):
        self.link(self.issue_code())
        self.as_user(self.b_token)
        self.client.post(reverse('player-unlink', args=[self.slup.pk]))
        self.as_user(self.a_token)
        self.assertEqual(self.client.get(reverse('player-my-stats')).data['stats']['matches_played'], 0)

    def test_cycle_standings_merge_guest_and_profile(self):
        self.play_out(self.t)
        PlayerContact.objects.create(owner=self.b, player=self.a_profile)
        t2 = create_tournament(
            owner=self.b, name='Piątek', format='knockout', match_format=BO3,
            entries=[EntrySpec(player_id=self.a_profile.pk), EntrySpec(player_id=self.other.pk)],
        )
        self.play_out(t2)
        cycle = TournamentCycle.objects.create(name='Sezon', owner=self.b, scoring_mode='placement')
        CycleEvent.objects.create(cycle=cycle, name='1', tournament=self.t, order=0)
        CycleEvent.objects.create(cycle=cycle, name='2', tournament=t2, order=1)
        self.assertEqual(len(compute_cycle_standings(cycle)), 3)  # Ania N, Anna Nowak, Olek

        self.link(self.issue_code())
        rows = {r['player_name']: r for r in compute_cycle_standings(cycle)}
        self.assertEqual(set(rows), {'Anna Nowak', 'Olek'})
        self.assertEqual(rows['Anna Nowak']['player_id'], self.a_profile.pk)
        self.assertEqual(len(rows['Anna Nowak']['points_by_event']), 2)

    def test_linked_guest_disappears_from_the_player_list(self):
        self.link(self.issue_code())
        self.as_user(self.b_token)
        ids = [p['id'] for p in self.client.get(reverse('player-list')).data['results']]
        self.assertNotIn(self.slup.pk, ids)
        self.assertIn(self.a_profile.pk, ids)

    def test_picking_a_linked_guest_in_the_wizard_enters_the_profile(self):
        self.link(self.issue_code())
        t = create_tournament(
            owner=self.b, name='Sobota', format='knockout', match_format=BO3,
            entries=[EntrySpec(player_id=self.slup.pk), EntrySpec(player_id=self.other.pk)],
        )
        self.assertTrue(t.entries.filter(player=self.a_profile).exists())
        self.as_user(self.b_token)
        response = self.client.post(reverse('tournament-list'), {
            'name': 'Dubel', 'format': 'knockout', 'match_format': BO3,
            'entries': [{'player_id': self.slup.pk}, {'player_id': self.a_profile.pk}],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class ListingTests(LinkingTestCase):

    def test_organizer_sees_their_guests_with_tournaments(self):
        self.link(self.issue_code())
        self.as_user(self.b_token)
        rows = {r['name']: r for r in self.client.get(reverse('player-my-guests')).data}
        self.assertEqual(set(rows), {'Ania N', 'Olek'})
        self.assertEqual(rows['Ania N']['linked_to'], 'Anna Nowak')
        self.assertEqual([t['name'] for t in rows['Ania N']['tournaments']], ['Środa'])
        self.assertIsNone(rows['Olek']['linked_to'])

    def test_player_sees_who_linked_what(self):
        self.link(self.issue_code())
        self.as_user(self.a_token)
        rows = self.client.get(reverse('player-linked')).data
        self.assertEqual([(r['name'], r['owner_username']) for r in rows], [('Ania N', 'organizer')])
        self.assertEqual(rows[0]['tournaments'][0]['name'], 'Środa')

    def test_guest_lists_are_private(self):
        self.as_user(self.stranger_token)
        self.assertEqual(self.client.get(reverse('player-my-guests')).data, [])
        self.client.credentials()
        self.assertEqual(self.client.get(reverse('player-my-guests')).status_code, status.HTTP_401_UNAUTHORIZED)


class VisibilityTests(LinkingTestCase):
    """Organizers see their own bots and guests, their own profile and
    registered players who gave them a code — nobody else."""

    def list_ids(self, token=None):
        if token:
            self.as_user(token)
        else:
            self.client.credentials()
        return {p['id'] for p in self.client.get(reverse('player-list')).data['results']}

    def test_organizer_sees_only_own_players_and_contacts(self):
        bot = Player.objects.create(owner=self.b, first_name='Bot', last_name='', cpu=True)
        b_profile = Player.objects.create(user=self.b, owner=self.b, first_name='Bartek', last_name='')
        foreign_guest = Player.objects.create(owner=self.stranger, first_name='Obcy', last_name='')
        ids = self.list_ids(self.b_token)
        self.assertEqual(ids, {self.other.pk, self.slup.pk, bot.pk, b_profile.pk})
        self.assertNotIn(self.a_profile.pk, ids)
        self.assertNotIn(foreign_guest.pk, ids)

    def test_anonymous_sees_no_players(self):
        self.assertEqual(self.list_ids(), set())

    def test_code_adds_a_contact_who_then_appears(self):
        code = self.issue_code()
        self.as_user(self.b_token)
        check = self.client.post(reverse('player-contacts'), {'code': code, 'dry_run': True}, format='json')
        self.assertEqual((check.data['name'], check.data['added']), ('Anna Nowak', False))
        self.assertNotIn(self.a_profile.pk, self.list_ids(self.b_token))
        self.client.post(reverse('player-contacts'), {'code': code}, format='json')
        self.assertIn(self.a_profile.pk, self.list_ids(self.b_token))
        self.assertEqual(self.client.get(reverse('player-contacts')).data, [{'id': self.a_profile.pk, 'name': 'Anna Nowak'}])

    def test_own_code_cannot_be_added(self):
        code = self.issue_code()
        self.as_user(self.a_token)
        response = self.client.post(reverse('player-contacts'), {'code': code}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_linking_a_guest_also_makes_a_contact(self):
        self.link(self.issue_code())
        self.assertTrue(PlayerContact.objects.filter(owner=self.b, player=self.a_profile).exists())

    def test_either_side_can_remove_the_contact(self):
        PlayerContact.objects.create(owner=self.b, player=self.a_profile)
        self.as_user(self.a_token)
        self.assertEqual(self.client.get(reverse('player-organizers')).data, [{'id': self.b.pk, 'username': 'organizer'}])
        self.client.delete(reverse('player-remove-organizer', args=[self.b.pk]))
        self.assertNotIn(self.a_profile.pk, self.list_ids(self.b_token))

        PlayerContact.objects.create(owner=self.b, player=self.a_profile)
        self.as_user(self.b_token)
        self.client.delete(reverse('player-remove-contact', args=[self.a_profile.pk]))
        self.assertFalse(PlayerContact.objects.exists())

    def test_wizard_rejects_registered_players_without_a_code(self):
        self.as_user(self.b_token)
        response = self.client.post(reverse('tournament-list'), {
            'name': 'X', 'format': 'knockout', 'match_format': BO3,
            'entries': [{'player_id': self.a_profile.pk}, {'player_id': self.other.pk}],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_contact_can_be_linked_without_a_new_code(self):
        PlayerContact.objects.create(owner=self.b, player=self.a_profile)
        self.as_user(self.b_token)
        response = self.client.post(reverse('player-link', args=[self.slup.pk]), {'contact_id': self.a_profile.pk}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.slup.refresh_from_db()
        self.assertEqual(self.slup.merged_into, self.a_profile)

    def test_non_contact_cannot_be_linked_by_id(self):
        self.as_user(self.b_token)
        response = self.client.post(reverse('player-link', args=[self.slup.pk]), {'contact_id': self.a_profile.pk}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_only_the_owner_can_edit_or_delete_a_player(self):
        PlayerContact.objects.create(owner=self.b, player=self.a_profile)
        self.as_user(self.b_token)
        detail = reverse('player-detail', args=[self.a_profile.pk])
        self.assertEqual(self.client.patch(detail, {'first_name': 'X'}, format='json').status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.delete(detail).status_code, status.HTTP_404_NOT_FOUND)
        self.as_user(self.a_token)
        self.assertEqual(self.client.patch(detail, {'first_name': 'Ania'}, format='json').status_code, status.HTTP_200_OK)


class LeagueGuestTests(LinkingTestCase):
    """League placeholders are account-less players too, linked the same way."""

    def setUp(self):
        super().setUp()
        self.league = League.objects.create(name='Liga', owner=self.b)
        self.as_user(self.b_token)
        self.client.post(reverse('league-add-member', args=[self.league.pk]), {'display_name': 'Ania z ligi'}, format='json')
        self.client.post(reverse('league-add-member', args=[self.league.pk]), {'player_id': self.other.pk}, format='json')
        self.member = self.league.members.get(display_name='Ania z ligi')

    def test_name_only_member_is_an_account_less_player(self):
        self.assertEqual(self.member.status, 'pending')
        self.assertEqual((self.member.player.owner, self.member.player.user), (self.b, None))

    def test_registered_player_without_a_code_cannot_be_added(self):
        response = self.client.post(reverse('league-add-member', args=[self.league.pk]), {'player_id': self.a_profile.pk}, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_hub_lists_league_guests_with_their_league(self):
        rows = {r['name']: r for r in self.client.get(reverse('player-my-guests')).data}
        self.assertEqual([(e['kind'], e['name']) for e in rows['Ania z ligi']['tournaments']], [('league', 'Liga')])

    def test_linking_the_member_to_a_contact(self):
        link_url = reverse('league-link-player', args=[self.league.pk, self.member.pk])
        response = self.client.patch(link_url, {'player_id': self.a_profile.pk}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)  # not a contact yet

        PlayerContact.objects.create(owner=self.b, player=self.a_profile)
        response = self.client.patch(link_url, {'player_id': self.a_profile.pk}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual((response.data['player_id'], response.data['status']), (self.a_profile.pk, 'active'))
        self.member.player.refresh_from_db()
        self.assertEqual(self.member.player.merged_into, self.a_profile)

    def test_linked_player_sees_and_plays_the_league(self):
        self.link(self.issue_code(), slup=self.member.player)
        self.league.status = 'active'
        self.league.save()
        self.member.refresh_from_db()
        self.assertEqual(self.member.status, 'active')

        self.as_user(self.a_token)
        self.assertEqual(self.client.get(reverse('league-detail', args=[self.league.pk])).status_code, status.HTTP_200_OK)
        other_member = self.league.members.get(player=self.other)
        from leagues.models import LeagueMatch
        match = LeagueMatch.objects.create(league=self.league, home=self.member, away=other_member, matchday=1)
        leg_url = reverse('league-update-match-leg', args=[self.league.pk, match.pk])
        self.assertEqual(self.client.patch(leg_url, {'legs': []}, format='json').status_code, status.HTTP_200_OK)

    def test_unlinking_returns_the_member_to_pending(self):
        self.link(self.issue_code(), slup=self.member.player)
        self.as_user(self.b_token)
        self.client.post(reverse('player-unlink', args=[self.member.player.pk]))
        self.member.refresh_from_db()
        self.assertEqual(self.member.status, 'pending')
