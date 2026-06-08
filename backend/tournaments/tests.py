from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from .models import Tournament, _bracket_has_pending_matches


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


def make_bracket(with_result=False) -> dict:
    """Minimal 2-player knockout bracket (1 match, 1 round)."""
    result = {
        'topSetsWon': 2,
        'bottomSetsWon': 0,
        'displayScore': '2–0',
        'winner': 'top',
    } if with_result else None

    match = {
        'id': 'r0-m0',
        'top':    {'playerId': 1, 'playerName': 'A', 'playerAvg': 50.0, 'isCpu': False},
        'bottom': {'playerId': 2, 'playerName': 'B', 'playerAvg': 45.0, 'isCpu': False},
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
