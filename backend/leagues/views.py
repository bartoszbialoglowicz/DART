from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import League, LeagueMember, LeagueMatch
from .serializers import (
    LeagueListSerializer,
    LeagueMemberSerializer,
    LeagueMatchSerializer,
    LeagueSerializer,
)
from players.models import Player


def _round_robin(members, matches_per_pair):
    """Return list of rounds; each round is a list of (home_id, away_id) member pk tuples."""
    lst = list(members)
    if len(lst) < 2:
        return []

    if len(lst) % 2 == 1:
        lst.append(None)  # bye

    n_half = len(lst) // 2
    rounds = []

    for _ in range(len(lst) - 1):
        round_pairs = []
        for i in range(n_half):
            home = lst[i]
            away = lst[len(lst) - 1 - i]
            if home is not None and away is not None:
                round_pairs.append((home.pk, away.pk))
        rounds.append(round_pairs)
        lst = [lst[0]] + [lst[-1]] + lst[1:-1]

    if matches_per_pair >= 2:
        reversed_rounds = [[(away, home) for home, away in r] for r in rounds]
        rounds = rounds + reversed_rounds

    return rounds


def _compute_standings(league):
    members    = list(league.members.all())
    matches    = league.matches.filter(status='finished')
    pw, pd     = league.points_win, league.points_draw

    table = {
        m.pk: {
            'member_id':    m.pk,
            'display_name': m.display_name,
            'player_id':    m.player_id,
            'status':       m.status,
            'played': 0, 'won': 0, 'drawn': 0, 'lost': 0,
            'score_for': 0, 'score_against': 0, 'points': 0,
        }
        for m in members
    }

    for match in matches:
        h, a = match.home_id, match.away_id
        hs, as_ = match.home_score or 0, match.away_score or 0

        if h not in table or a not in table:
            continue

        for row in (table[h], table[a]):
            row['played'] += 1

        table[h]['score_for']      += hs
        table[h]['score_against']  += as_
        table[a]['score_for']      += as_
        table[a]['score_against']  += hs

        if hs > as_:
            table[h]['won']    += 1;  table[h]['points'] += pw
            table[a]['lost']   += 1
        elif as_ > hs:
            table[a]['won']    += 1;  table[a]['points'] += pw
            table[h]['lost']   += 1
        else:
            table[h]['drawn']  += 1;  table[h]['points'] += pd
            table[a]['drawn']  += 1;  table[a]['points'] += pd

    rows = sorted(
        table.values(),
        key=lambda r: (-r['points'], -(r['score_for'] - r['score_against']), -r['score_for']),
    )
    for i, row in enumerate(rows, 1):
        row['position'] = i

    return rows


class LeagueViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return LeagueListSerializer
        return LeagueSerializer

    def get_queryset(self):
        user = self.request.user
        return League.objects.filter(owner=user).prefetch_related('members')

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    # ── Members ──────────────────────────────────────────────────────────────

    @action(detail=True, methods=['post'], url_path='members')
    def add_member(self, request, pk=None):
        league = self.get_object()
        if league.status != 'draft':
            return Response({'detail': 'Nie można modyfikować składu po zatwierdzeniu ligi.'}, status=status.HTTP_400_BAD_REQUEST)

        player_id    = request.data.get('player_id')
        display_name = request.data.get('display_name', '').strip()

        if player_id:
            try:
                player = Player.objects.get(pk=player_id)
            except Player.DoesNotExist:
                return Response({'detail': 'Gracz nie istnieje.'}, status=status.HTTP_404_NOT_FOUND)

            if league.members.filter(player=player).exists():
                return Response({'detail': 'Gracz jest już w lidze.'}, status=status.HTTP_400_BAD_REQUEST)

            member = LeagueMember.objects.create(
                league=league,
                player=player,
                display_name=f'{player.first_name} {player.last_name}',
                status='active',
            )
        else:
            if not display_name:
                return Response({'detail': 'Podaj imię i nazwisko.'}, status=status.HTTP_400_BAD_REQUEST)
            member = LeagueMember.objects.create(
                league=league,
                player=None,
                display_name=display_name,
                status='pending',
            )

        return Response(LeagueMemberSerializer(member).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path=r'members/(?P<member_id>\d+)')
    def remove_member(self, request, pk=None, member_id=None):
        league = self.get_object()
        if league.status != 'draft':
            return Response({'detail': 'Nie można modyfikować składu po zatwierdzeniu ligi.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            member = league.members.get(pk=member_id)
        except LeagueMember.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        member.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['patch'], url_path=r'members/(?P<member_id>\d+)/link-player')
    def link_player(self, request, pk=None, member_id=None):
        """Link a placeholder member to an existing Player account."""
        league = self.get_object()
        try:
            member = league.members.get(pk=member_id, status='pending')
        except LeagueMember.DoesNotExist:
            return Response({'detail': 'Nie znaleziono gracza oczekującego.'}, status=status.HTTP_404_NOT_FOUND)

        player_id = request.data.get('player_id')
        try:
            player = Player.objects.get(pk=player_id)
        except Player.DoesNotExist:
            return Response({'detail': 'Gracz nie istnieje.'}, status=status.HTTP_404_NOT_FOUND)

        if league.members.filter(player=player).exists():
            return Response({'detail': 'Ten gracz jest już w lidze.'}, status=status.HTTP_400_BAD_REQUEST)

        member.player       = player
        member.display_name = f'{player.first_name} {player.last_name}'
        member.status       = 'active'
        member.save()
        return Response(LeagueMemberSerializer(member).data)

    # ── Schedule ─────────────────────────────────────────────────────────────

    @action(detail=True, methods=['post'], url_path='generate-schedule')
    def generate_schedule(self, request, pk=None):
        league = self.get_object()

        if league.matches.exists():
            return Response(
                {'detail': 'Terminarz już istnieje. Usuń go najpierw.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        members = list(league.members.all())
        if len(members) < 2:
            return Response({'detail': 'Liga musi mieć co najmniej 2 graczy.'}, status=status.HTTP_400_BAD_REQUEST)

        rounds = _round_robin(members, league.matches_per_pair)
        to_create = []
        for matchday, pairs in enumerate(rounds, 1):
            for home_pk, away_pk in pairs:
                to_create.append(LeagueMatch(
                    league=league,
                    home_id=home_pk,
                    away_id=away_pk,
                    matchday=matchday,
                ))
        LeagueMatch.objects.bulk_create(to_create)

        matches = league.matches.all()
        return Response(LeagueMatchSerializer(matches, many=True).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get', 'delete'], url_path='schedule')
    def schedule(self, request, pk=None):
        league = self.get_object()
        if request.method == 'DELETE':
            league.matches.all().delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        matches = league.matches.select_related('home', 'away').all()
        return Response(LeagueMatchSerializer(matches, many=True).data)

    # ── Finalize ─────────────────────────────────────────────────────────────

    @action(detail=True, methods=['post'], url_path='finalize')
    def finalize(self, request, pk=None):
        league = self.get_object()
        if league.status != 'draft':
            return Response({'detail': 'Liga nie jest w stanie szkicu.'}, status=status.HTTP_400_BAD_REQUEST)
        if league.members.count() < 2:
            return Response({'detail': 'Liga musi mieć co najmniej 2 graczy.'}, status=status.HTTP_400_BAD_REQUEST)
        league.status = 'active'
        league.save(update_fields=['status'])
        return Response(LeagueSerializer(league).data)

    # ── Matchday date ─────────────────────────────────────────────────────────

    @action(detail=True, methods=['patch'], url_path=r'matchday/(?P<matchday>\d+)')
    def set_matchday_date(self, request, pk=None, matchday=None):
        league = self.get_object()
        date_str = request.data.get('date')  # expects "YYYY-MM-DD" or null
        count = league.matches.filter(matchday=matchday).update(scheduled_at=date_str or None)
        if count == 0:
            return Response({'detail': 'Kolejka nie istnieje.'}, status=status.HTTP_404_NOT_FOUND)
        matches = league.matches.filter(matchday=matchday)
        return Response(LeagueMatchSerializer(matches, many=True).data)

    # ── Standings ────────────────────────────────────────────────────────────

    @action(detail=True, methods=['get'], url_path='standings')
    def standings(self, request, pk=None):
        league = self.get_object()
        return Response(_compute_standings(league))

    # ── Match result ─────────────────────────────────────────────────────────

    @action(detail=True, methods=['patch'], url_path=r'matches/(?P<match_id>\d+)')
    def update_match(self, request, pk=None, match_id=None):
        league = self.get_object()
        try:
            match = league.matches.get(pk=match_id)
        except LeagueMatch.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        serializer = LeagueMatchSerializer(match, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        if 'home_score' in request.data or 'away_score' in request.data:
            serializer.save(status='finished', played_at=timezone.now())
        else:
            serializer.save()

        return Response(serializer.data)
