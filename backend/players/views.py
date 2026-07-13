from django.db.models import Avg, Count, Max, Sum
from django.db.models import Q
from django.utils import timezone
from rest_framework import filters, permissions, viewsets
from rest_framework.authentication import TokenAuthentication
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Player, TrainingSession, HighscoreSession, SectorPracticeSession, PendingMatchResult
from .serializers import (
    PlayerSerializer, TrainingSessionSerializer, HighscoreSessionSerializer,
    SectorPracticeSessionSerializer, PendingMatchResultSerializer,
)


class PlayerViewSet(viewsets.ModelViewSet):
    serializer_class = PlayerSerializer
    filter_backends  = [filters.SearchFilter, filters.OrderingFilter]
    search_fields    = ['first_name', 'last_name']
    ordering_fields  = ['last_name', 'average', 'created_at']

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated:
            return Player.objects.filter(Q(cpu=False) | Q(owner=user, cpu=True))
        return Player.objects.filter(cpu=False)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(
        detail=False,
        methods=['post'],
        url_path='setup-profile',
        authentication_classes=[TokenAuthentication],
        permission_classes=[permissions.IsAuthenticated],
    )
    def setup_profile(self, request):
        if hasattr(request.user, 'player_profile'):
            return Response({'error': 'Profil gracza już istnieje.'}, status=400)
        serializer = PlayerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        player = serializer.save(user=request.user, owner=request.user, cpu=False)
        return Response(PlayerSerializer(player).data, status=201)

    @action(
        detail=False,
        methods=['get'],
        url_path='my-stats',
        authentication_classes=[TokenAuthentication],
        permission_classes=[permissions.IsAuthenticated],
    )
    def my_stats(self, request):
        if not hasattr(request.user, 'player_profile'):
            return Response({'error': 'Brak profilu gracza.'}, status=404)

        player = request.user.player_profile
        agg = player.statistics.aggregate(
            matches_played=Count('id'),
            avg_average=Avg('match_average'),
            total_double_attempts=Sum('double_attempts'),
            total_double_hits=Sum('double_hits'),
            avg_darts_per_leg=Avg('darts_per_leg'),
            total_180=Sum('count_180'),
            total_high_checkouts=Sum('high_checkouts'),
            total_short_legs=Sum('short_legs'),
        )

        da = agg['total_double_attempts'] or 0
        dh = agg['total_double_hits'] or 0
        double_accuracy = round(dh / da * 100, 1) if da > 0 else None

        return Response({
            'player': PlayerSerializer(player).data,
            'stats': {
                'matches_played':   agg['matches_played'] or 0,
                'match_average':    round(agg['avg_average'] or 0, 2),
                'double_accuracy':  double_accuracy,
                'darts_per_leg':    round(agg['avg_darts_per_leg'] or 0, 1),
                'count_180':        agg['total_180'] or 0,
                'high_checkouts':   agg['total_high_checkouts'] or 0,
                'short_legs':       agg['total_short_legs'] or 0,
            },
        })


    @action(
        detail=False,
        methods=['get'],
        url_path='my-events',
        authentication_classes=[TokenAuthentication],
        permission_classes=[permissions.IsAuthenticated],
    )
    def my_events(self, request):
        player = getattr(request.user, 'player_profile', None)
        if not player:
            return Response([])

        today = timezone.now().date()
        events = []

        # ── Mecze ligowe ──────────────────────────────────────────────────────
        from leagues.models import LeagueMatch
        matches = (
            LeagueMatch.objects
            .filter(
                Q(home__player=player) | Q(away__player=player),
                scheduled_at__isnull=False,
                scheduled_at__date__gte=today,
                status='pending',
            )
            .select_related('home', 'away', 'home__league')
            .order_by('scheduled_at')[:30]
        )
        for m in matches:
            is_home = m.home.player_id == player.pk
            opponent = m.away.display_name if is_home else m.home.display_name
            events.append({
                'type':      'league_match',
                'date':      m.scheduled_at.date().isoformat(),
                'title':     f'vs. {opponent}',
                'subtitle':  m.home.league.name,
                'league_id': m.home.league_id,
                'matchday':  m.matchday,
            })

        # ── Turnieje ──────────────────────────────────────────────────────────
        from tournaments.models import Tournament
        tournaments = (
            Tournament.objects
            .filter(
                participants__player=player,
                start_date__isnull=False,
                start_date__date__gte=today,
            )
            .distinct()
            .order_by('start_date')[:30]
        )
        for t in tournaments:
            events.append({
                'type':          'tournament',
                'date':          t.start_date.date().isoformat(),
                'title':         t.name,
                'subtitle':      'Turniej',
                'tournament_id': t.id,
            })

        events.sort(key=lambda e: e['date'])
        return Response(events[:20])


class TrainingSessionViewSet(viewsets.ModelViewSet):
    serializer_class   = TrainingSessionSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    http_method_names  = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        if not hasattr(self.request.user, 'player_profile'):
            return TrainingSession.objects.none()
        return TrainingSession.objects.filter(player=self.request.user.player_profile)

    def perform_create(self, serializer):
        serializer.save(player=self.request.user.player_profile)


class HighscoreSessionViewSet(viewsets.ModelViewSet):
    serializer_class   = HighscoreSessionSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    http_method_names  = ['get', 'post', 'delete', 'head', 'options']

    def get_queryset(self):
        if not hasattr(self.request.user, 'player_profile'):
            return HighscoreSession.objects.none()
        return HighscoreSession.objects.filter(player=self.request.user.player_profile)

    def perform_create(self, serializer):
        serializer.save(player=self.request.user.player_profile)


class SectorPracticeSessionViewSet(viewsets.ModelViewSet):
    serializer_class   = SectorPracticeSessionSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    http_method_names  = ['get', 'post', 'delete', 'head', 'options']

    def get_queryset(self):
        if not hasattr(self.request.user, 'player_profile'):
            return SectorPracticeSession.objects.none()
        return SectorPracticeSession.objects.filter(player=self.request.user.player_profile)

    def perform_create(self, serializer):
        serializer.save(player=self.request.user.player_profile)


class PendingMatchResultViewSet(viewsets.GenericViewSet,
                                viewsets.mixins.ListModelMixin,
                                viewsets.mixins.CreateModelMixin,
                                viewsets.mixins.DestroyModelMixin):
    serializer_class       = PendingMatchResultSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes     = [permissions.IsAuthenticated]

    def get_queryset(self):
        player = getattr(self.request.user, 'player_profile', None)
        if not player:
            return PendingMatchResult.objects.none()
        return PendingMatchResult.objects.filter(for_player=player)

    def perform_create(self, serializer):
        try:
            for_player = Player.objects.get(pk=self.request.data.get('for_player_id'))
        except Player.DoesNotExist:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'for_player_id': 'Gracz nie istnieje.'})
        serializer.save(for_player=for_player)

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        pending = self.get_object()
        player  = getattr(request.user, 'player_profile', None)
        if not player or pending.for_player != player:
            from rest_framework.response import Response
            from rest_framework import status as http_status
            return Response({'detail': 'Brak uprawnień.'}, status=http_status.HTTP_403_FORBIDDEN)

        legs_total = pending.legs_won + pending.legs_lost
        TrainingSession.objects.create(
            player          = player,
            played_at       = pending.played_at,
            average         = pending.average,
            legs            = legs_total,
            double_attempts = pending.double_attempts,
            double_hits     = pending.double_hits,
        )
        pending.delete()
        from rest_framework.response import Response
        return Response(status=204)
