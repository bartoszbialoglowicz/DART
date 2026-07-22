from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from players.models import Player
from .models import League, LeagueMatch, LeagueMember


class AuthMixin:
    def create_user_with_player(self, username, password='pass'):
        user = User.objects.create_user(username=username, password=password)
        token = Token.objects.create(user=user)
        player = Player.objects.create(user=user, first_name=username, last_name='Test')
        return user, token, player

    def auth(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def no_auth(self):
        self.client.credentials()


class MatchResultApprovalTests(AuthMixin, APITestCase):
    """Owner-submitted results are final immediately; anyone else's result
    goes to the owner as 'awaiting_approval' until accepted or edited."""

    def setUp(self):
        self.owner, self.owner_token, self.owner_player = self.create_user_with_player('owner')
        self.participant, self.participant_token, self.participant_player = (
            self.create_user_with_player('participant')
        )
        self.outsider, self.outsider_token, _ = self.create_user_with_player('outsider')

        self.league = League.objects.create(name='Test League', owner=self.owner, status='active')
        self.home = LeagueMember.objects.create(
            league=self.league, player=self.owner_player, display_name='owner',
        )
        self.away = LeagueMember.objects.create(
            league=self.league, player=self.participant_player, display_name='participant',
        )
        self.match = LeagueMatch.objects.create(
            league=self.league, home=self.home, away=self.away, matchday=1,
        )
        self.match_url = reverse('league-update-match', args=[self.league.id, self.match.id])
        self.approve_url = reverse('league-approve-match', args=[self.league.id, self.match.id])
        self.leg_url = reverse('league-update-match-leg', args=[self.league.id, self.match.id])

    def test_owner_submission_is_finished_immediately(self):
        self.auth(self.owner_token)
        response = self.client.patch(self.match_url, {'home_score': 3, 'away_score': 1}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.match.refresh_from_db()
        self.assertEqual(self.match.status, 'finished')
        self.assertEqual(self.match.submitted_by, self.owner)

    def test_participant_submission_awaits_approval(self):
        self.auth(self.participant_token)
        response = self.client.patch(
            self.match_url,
            {'home_score': 2, 'away_score': 3, 'home_count_180': 1, 'away_short_legs': 2},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.match.refresh_from_db()
        self.assertEqual(self.match.status, 'awaiting_approval')
        self.assertEqual(self.match.submitted_by, self.participant)
        self.assertEqual(self.match.home_count_180, 1)
        self.assertEqual(self.match.away_short_legs, 2)

    def test_outsider_cannot_submit(self):
        # An outsider has no relation to the league at all, so it's invisible
        # to them at the queryset level (404) before permission logic even runs.
        self.auth(self.outsider_token)
        response = self.client.patch(self.match_url, {'home_score': 3, 'away_score': 0}, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_owner_can_approve_pending_result_as_is(self):
        self.auth(self.participant_token)
        self.client.patch(self.match_url, {'home_score': 2, 'away_score': 3}, format='json')

        self.auth(self.owner_token)
        response = self.client.post(self.approve_url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.match.refresh_from_db()
        self.assertEqual(self.match.status, 'finished')
        self.assertEqual(self.match.home_score, 2)
        self.assertEqual(self.match.away_score, 3)

    def test_non_owner_cannot_approve(self):
        self.auth(self.participant_token)
        self.client.patch(self.match_url, {'home_score': 2, 'away_score': 3}, format='json')
        response = self.client.post(self.approve_url, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_cannot_approve_a_match_not_awaiting_approval(self):
        self.auth(self.owner_token)
        response = self.client.post(self.approve_url, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_owner_editing_a_pending_result_finalizes_it(self):
        self.auth(self.participant_token)
        self.client.patch(self.match_url, {'home_score': 2, 'away_score': 3}, format='json')

        self.auth(self.owner_token)
        response = self.client.patch(self.match_url, {'home_score': 3, 'away_score': 3}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.match.refresh_from_db()
        self.assertEqual(self.match.status, 'finished')
        self.assertEqual(self.match.home_score, 3)
        self.assertEqual(self.match.away_score, 3)

    def test_editing_a_finished_result_as_non_owner_reopens_approval(self):
        self.auth(self.owner_token)
        self.client.patch(self.match_url, {'home_score': 3, 'away_score': 1}, format='json')

        self.auth(self.participant_token)
        response = self.client.patch(self.match_url, {'home_score': 3, 'away_score': 2}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.match.refresh_from_db()
        self.assertEqual(self.match.status, 'awaiting_approval')

    def test_participant_can_save_live_match_legs(self):
        self.auth(self.participant_token)
        response = self.client.patch(
            self.leg_url,
            {'legs': [{'rounds': []}], 'currentLeg': {'rounds': [], 'activePlayer': 0}},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.match.refresh_from_db()
        self.assertEqual(self.match.legs, [{'rounds': []}])
        self.assertEqual(self.match.current_leg, {'rounds': [], 'activePlayer': 0})

    def test_outsider_cannot_save_live_match_legs(self):
        self.auth(self.outsider_token)
        response = self.client.patch(self.leg_url, {'legs': [], 'currentLeg': None}, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
