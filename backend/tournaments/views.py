from django.db import transaction
from django.db.models import Count, Max, Q
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from .models import Match, MatchStatistic, Tournament, TournamentCycle, CycleEvent
from .serializers import (
    MatchResultSerializer, MatchStatisticSerializer, TournamentCreateSerializer,
    TournamentListSerializer, TournamentSerializer, TournamentUpdateSerializer,
    TournamentCycleSerializer, CycleEventSerializer,
)
from . import services
from .services import TournamentError
from .services.cycles import compute_cycle_standings
from core.permissions import IsOwnerOrReadOnly
from players.linking import identity_ids


def _error(exc: TournamentError) -> Response:
    detail = exc.args[0] if exc.args else 'Błąd'
    return Response(detail if isinstance(detail, dict) else {'detail': detail}, status=exc.status_code)


class TournamentViewSet(viewsets.ModelViewSet):
    http_method_names  = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def get_queryset(self):
        # Explicit order_by: Django drops Meta.ordering from GROUP BY queries,
        # and the list is paginated — newest tournaments must be on page 1.
        qs   = (
            Tournament.objects.select_related('owner')
            .annotate(player_count=Count('entries', distinct=True))
            .order_by('-created_at')
        )
        user = self.request.user

        if not user.is_authenticated:
            return qs.filter(is_private=False)

        q = Q(is_private=False) | Q(owner=user)
        player = getattr(user, 'player_profile', None)
        if player:
            # The profile and every account-less player linked to it.
            q |= Q(pk__in=Tournament.objects.filter(entries__player__in=identity_ids(player)).values('pk'))
        return qs.filter(q)

    def get_serializer_class(self):
        if self.action == 'list':
            return TournamentListSerializer
        if self.action == 'partial_update':
            return TournamentUpdateSerializer
        return TournamentSerializer

    def _detail(self, tournament, status_code=status.HTTP_200_OK):
        tournament = self.get_queryset().get(pk=tournament.pk)
        return Response(TournamentSerializer(tournament, context=self.get_serializer_context()).data, status=status_code)

    # ── Create / metadata ─────────────────────────────────────────────────────

    def create(self, request, *args, **kwargs):
        serializer = TournamentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            tournament = services.create_tournament(owner=request.user, **serializer.validated_data)
        except TournamentError as exc:
            return _error(exc)
        return self._detail(tournament, status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        if not kwargs.get('partial'):
            return Response(status=status.HTTP_405_METHOD_NOT_ALLOWED)
        return self.partial_update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        tournament = self.get_object()
        serializer = TournamentUpdateSerializer(tournament, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return self._detail(tournament)

    # ── Draft ─────────────────────────────────────────────────────────────────

    @action(detail=True, methods=['post'], url_path='confirm-draft')
    def confirm_draft(self, request, pk=None):
        tournament = self.get_object()
        tournament.bracket_confirmed = True
        tournament.save(update_fields=['bracket_confirmed'])
        return self._detail(tournament)

    @action(detail=True, methods=['post'], url_path='redraw')
    def redraw(self, request, pk=None):
        tournament = self.get_object()
        try:
            services.redraw(tournament)
        except TournamentError as exc:
            return _error(exc)
        return self._detail(tournament)

    # ── Matches ───────────────────────────────────────────────────────────────

    def _match(self, tournament, code) -> Match:
        return get_object_or_404(Match, tournament=tournament, code=code)

    @action(detail=True, methods=['post'], url_path=r'matches/(?P<code>[^/]+)/result')
    def record_result(self, request, pk=None, code=None):
        tournament = self.get_object()
        serializer = MatchResultSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            services.record_result(self._match(tournament, code), **serializer.validated_data)
        except TournamentError as exc:
            return _error(exc)
        return self._detail(tournament)

    @action(detail=True, methods=['put', 'patch'], url_path=r'match-legs/(?P<match_id>[^/]+)')
    def update_match_leg(self, request, pk=None, match_id=None):
        tournament = self.get_object()
        legs = request.data.get('legs', [])
        if not isinstance(legs, list):
            raise ValidationError({'legs': 'Oczekiwano listy.'})
        match = services.save_legs(self._match(tournament, match_id), legs=legs, current_leg=request.data.get('currentLeg'))
        return Response({'match_id': match.code, 'legs': match.legs, 'currentLeg': match.current_leg})

    @action(detail=True, methods=['post'], url_path='advance-groups')
    def advance_groups(self, request, pk=None):
        tournament = self.get_object()
        stage = tournament.stages.filter(kind='groups').first()
        if stage is None:
            return Response({'detail': 'Ten turniej nie ma fazy grupowej.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            services.advance_groups(stage)
        except TournamentError as exc:
            return _error(exc)
        return self._detail(tournament)

    # ── Statistics ────────────────────────────────────────────────────────────

    @action(detail=True, methods=['get', 'put'], url_path='statistics')
    def statistics(self, request, pk=None):
        tournament = self.get_object()

        if request.method == 'GET':
            qs = MatchStatistic.objects.filter(tournament=tournament)
            return Response(MatchStatisticSerializer(qs, many=True).data)

        items   = request.data if isinstance(request.data, list) else []
        matches = {m.code: m for m in tournament.matches.all()}
        entries = list(tournament.entries.all())
        saved   = []

        def find_entry(player_id, player_name):
            # Slot playerId: the Player's id, or -entry.id for an entry whose
            # player was deleted (see bracket_view._slot).
            if player_id and player_id > 0:
                return next((e for e in entries if e.player_id == player_id), None)
            if player_id and player_id < 0:
                return next((e for e in entries if e.id == -player_id), None)
            named = [e for e in entries if e.display_name == player_name]
            return named[0] if len(named) == 1 else None

        with transaction.atomic():
            for item in items:
                match = matches.get(item.get('match_id', ''))
                entry = find_entry(item.get('player_id') or None, item.get('player_name', ''))
                if match is None or entry is None:
                    continue

                obj, _ = MatchStatistic.objects.update_or_create(
                    tournament=tournament, match=match, entry=entry,
                    defaults={
                        'match_code':      match.code,
                        'player':          entry.player,
                        'player_name':     entry.display_name,
                        'match_average':   item.get('match_average', 0),
                        'count_180':       item.get('count_180', 0),
                        'high_checkouts':  item.get('high_checkouts', 0),
                        'short_legs':      item.get('short_legs', 0),
                        'double_attempts': item.get('double_attempts', 0),
                        'double_hits':     item.get('double_hits', 0),
                        'darts_per_leg':   item.get('darts_per_leg', 0),
                    },
                )
                saved.append(obj)

        return Response(MatchStatisticSerializer(saved, many=True).data)


class TournamentCycleViewSet(viewsets.ModelViewSet):
    serializer_class   = TournamentCycleSerializer
    http_method_names  = ['get', 'post', 'patch', 'delete', 'head', 'options']
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def get_queryset(self):
        qs   = TournamentCycle.objects.select_related('owner').prefetch_related('events__tournament').all()
        user = self.request.user
        if not user.is_authenticated:
            return qs.filter(is_private=False)
        return qs.filter(Q(is_private=False) | Q(owner=user)).distinct()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cycle = serializer.save(owner=request.user)

        events = request.data.get('events') or []
        for i, ev in enumerate(events):
            CycleEvent.objects.create(
                cycle=cycle,
                name=(ev.get('name') or '').strip() or f'Wydarzenie {i + 1}',
                planned_date=ev.get('planned_date') or None,
                order=i,
            )

        return Response(self.get_serializer(cycle).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='events')
    def add_event(self, request, pk=None):
        cycle = self.get_object()
        if cycle.owner != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)

        name = (request.data.get('name') or '').strip()
        if not name:
            raise ValidationError({'name': 'Nazwa wydarzenia jest wymagana.'})

        next_order = (cycle.events.aggregate(Max('order'))['order__max'] or 0) + 1
        event = CycleEvent.objects.create(
            cycle=cycle,
            name=name,
            planned_date=request.data.get('planned_date') or None,
            order=next_order,
        )
        return Response(CycleEventSerializer(event).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch'], url_path=r'events/(?P<event_id>\d+)')
    def update_event(self, request, pk=None, event_id=None):
        cycle = self.get_object()
        if cycle.owner != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        event = get_object_or_404(CycleEvent, pk=event_id, cycle=cycle)

        if 'name' in request.data:
            name = (request.data['name'] or '').strip()
            if not name:
                raise ValidationError({'name': 'Nazwa wydarzenia jest wymagana.'})
            event.name = name

        if 'planned_date' in request.data:
            event.planned_date = request.data['planned_date'] or None

        if 'tournament_id' in request.data:
            tournament_id = request.data['tournament_id']
            if tournament_id is None:
                event.tournament = None
            else:
                tournament = get_object_or_404(Tournament, pk=tournament_id, owner=request.user)
                already_linked = CycleEvent.objects.filter(tournament=tournament).exclude(pk=event.pk).exists()
                if already_linked:
                    raise ValidationError({'tournament_id': 'Ten turniej jest już przypisany do innego wydarzenia.'})
                event.tournament = tournament

        event.save()
        return Response(CycleEventSerializer(event).data)

    @action(detail=True, methods=['get'], url_path='standings')
    def standings(self, request, pk=None):
        cycle = self.get_object()
        return Response(compute_cycle_standings(cycle))
