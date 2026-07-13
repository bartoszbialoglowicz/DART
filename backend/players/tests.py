from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from .models import HighscoreSession, SectorPracticeSession, Player


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


class HighscoreSessionTests(AuthMixin, APITestCase):
    def setUp(self):
        self.owner, self.owner_token, self.owner_player = self.create_user_with_player('owner')
        self.other, self.other_token, self.other_player = self.create_user_with_player('other')
        self.list_url = reverse('highscore-list')

    def test_anonymous_cannot_list(self):
        self.no_auth()
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonymous_cannot_create(self):
        self.no_auth()
        response = self.client.post(self.list_url, {'darts': 15, 'score': 300}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_user_can_create_session(self):
        self.auth(self.owner_token)
        response = self.client.post(self.list_url, {'darts': 15, 'score': 300}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['darts'], 15)
        self.assertEqual(response.data['score'], 300)

    def test_created_session_is_linked_to_the_requesting_players_profile(self):
        self.auth(self.owner_token)
        self.client.post(self.list_url, {'darts': 15, 'score': 300}, format='json')
        session = HighscoreSession.objects.get()
        self.assertEqual(session.player, self.owner_player)

    def test_list_only_returns_the_requesting_players_own_sessions(self):
        HighscoreSession.objects.create(player=self.owner_player, darts=9,  score=100)
        HighscoreSession.objects.create(player=self.other_player, darts=30, score=500)

        self.auth(self.owner_token)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data['results']
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['darts'], 9)

    def test_owner_cannot_delete_another_players_session(self):
        session = HighscoreSession.objects.create(player=self.other_player, darts=30, score=500)
        detail_url = reverse('highscore-detail', args=[session.pk])

        self.auth(self.owner_token)
        response = self.client.delete(detail_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(HighscoreSession.objects.filter(pk=session.pk).exists())


class SectorPracticeSessionTests(AuthMixin, APITestCase):
    def setUp(self):
        self.owner, self.owner_token, self.owner_player = self.create_user_with_player('owner')
        self.other, self.other_token, self.other_player = self.create_user_with_player('other')
        self.list_url = reverse('sector-practice-list')

    def test_anonymous_cannot_list(self):
        self.no_auth()
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonymous_cannot_create(self):
        self.no_auth()
        response = self.client.post(self.list_url, {'sector': '20', 'hit_rate': 40.0, 'score': 240}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_user_can_create_session(self):
        self.auth(self.owner_token)
        response = self.client.post(self.list_url, {'sector': '20', 'hit_rate': 40.0, 'score': 240}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['sector'], '20')
        self.assertEqual(response.data['hit_rate'], 40.0)
        self.assertEqual(response.data['score'], 240)

    def test_bull_sector_is_accepted(self):
        self.auth(self.owner_token)
        response = self.client.post(self.list_url, {'sector': 'BULL', 'hit_rate': 25.0, 'score': 150}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['sector'], 'BULL')

    def test_created_session_is_linked_to_the_requesting_players_profile(self):
        self.auth(self.owner_token)
        self.client.post(self.list_url, {'sector': '20', 'hit_rate': 40.0, 'score': 240}, format='json')
        session = SectorPracticeSession.objects.get()
        self.assertEqual(session.player, self.owner_player)

    def test_list_only_returns_the_requesting_players_own_sessions(self):
        SectorPracticeSession.objects.create(player=self.owner_player, sector='20',   hit_rate=40.0, score=240)
        SectorPracticeSession.objects.create(player=self.other_player, sector='BULL', hit_rate=25.0, score=150)

        self.auth(self.owner_token)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data['results']
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['sector'], '20')

    def test_owner_cannot_delete_another_players_session(self):
        session = SectorPracticeSession.objects.create(player=self.other_player, sector='20', hit_rate=40.0, score=240)
        detail_url = reverse('sector-practice-detail', args=[session.pk])

        self.auth(self.owner_token)
        response = self.client.delete(detail_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(SectorPracticeSession.objects.filter(pk=session.pk).exists())
