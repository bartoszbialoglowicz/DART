from django.db import transaction
from django.db.models import Max, Q
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from .models import (
    MatchLeg, MatchStatistic, Tournament, TournamentCycle, CycleEvent,
    _bracket_has_pending_matches, _iter_matches, compute_cycle_standings,
    find_bot_simulation_lock_violations,
    find_locked_result_changes, strip_legs_from_bracket, sync_participants,
)
from .serializers import (
    MatchStatisticSerializer, TournamentSerializer,
    TournamentCycleSerializer, CycleEventSerializer,
)
from core.permissions import IsOwnerOrReadOnly


class TournamentViewSet(viewsets.ModelViewSet):
    serializer_class   = TournamentSerializer
    http_method_names  = ['get', 'post', 'patch', 'put', 'delete', 'head', 'options']
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def get_queryset(self):
        qs   = Tournament.objects.select_related('owner').prefetch_related('match_legs').all()
        user = self.request.user

        if not user.is_authenticated:
            return qs.filter(is_private=False)

        q = Q(is_private=False) | Q(owner=user)
        player = getattr(user, 'player_profile', None)
        if player:
            q |= Q(participants__player=player)
        return qs.filter(q).distinct()

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
        sync_participants(serializer.instance)

    def perform_update(self, serializer):
        bracket = serializer.validated_data.get('bracket')
        if bracket:
            locked = find_locked_result_changes(serializer.instance.bracket, bracket)
            if locked:
                raise ValidationError({
                    'bracket': f"Match result already recorded and cannot be changed: {', '.join(locked)}",
                })

            simulating_ids = {
                ml.match_id for ml in MatchLeg.objects.filter(tournament=serializer.instance)
                if ml.current_leg
            }
            blocked = find_bot_simulation_lock_violations(serializer.instance.bracket, bracket, simulating_ids)
            if blocked:
                raise ValidationError({
                    'bracket': f"Match is currently being simulated live: {', '.join(blocked)}",
                })

            cleaned, legs_dict = strip_legs_from_bracket(bracket)

            for mid, data in legs_dict.items():
                MatchLeg.objects.update_or_create(
                    tournament=serializer.instance,
                    match_id=mid,
                    defaults=data,
                )

            # Force-clear the live-simulation lock for any match this update newly
            # decides, regardless of what stray `currentLeg` the client's bracket
            # snapshot happened to carry — the client also clears its own copy via
            # a separate match-legs request first, but that's just a best-effort
            # ordering hint; this is the actual source of truth. Cleared directly
            # against the DB (not via legs_dict's defaults) so an already-saved
            # `legs` history for a match_id absent from this payload is never
            # clobbered back to empty.
            old_results = {m['id']: m.get('result') for m in _iter_matches(serializer.instance.bracket) if m.get('id')}
            newly_decided_ids = {
                m['id'] for m in _iter_matches(bracket)
                if m.get('id') and m.get('result') and not old_results.get(m['id'])
            }
            if newly_decided_ids:
                MatchLeg.objects.filter(
                    tournament=serializer.instance, match_id__in=newly_decided_ids,
                ).update(current_leg=None)

            serializer.save(bracket=cleaned, is_active=_bracket_has_pending_matches(cleaned))
            sync_participants(serializer.instance)
        else:
            serializer.save(is_active=serializer.instance.is_active)

    @action(detail=True, methods=['put', 'patch'], url_path=r'match-legs/(?P<match_id>[^/.]+)')
    def update_match_leg(self, request, pk=None, match_id=None):
        tournament = self.get_object()
        if tournament.owner != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        obj, _ = MatchLeg.objects.update_or_create(
            tournament=tournament,
            match_id=match_id,
            defaults={
                'legs':        request.data.get('legs', []),
                'current_leg': request.data.get('currentLeg'),
            },
        )
        return Response({'match_id': obj.match_id, 'legs': obj.legs, 'currentLeg': obj.current_leg})

    @action(detail=True, methods=['get', 'put'], url_path='statistics')
    def statistics(self, request, pk=None):
        tournament = self.get_object()

        if request.method == 'GET':
            qs = MatchStatistic.objects.filter(tournament=tournament)
            return Response(MatchStatisticSerializer(qs, many=True).data)

        if tournament.owner != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)

        items = request.data if isinstance(request.data, list) else []
        saved = []

        with transaction.atomic():
            for item in items:
                match_id    = item.get('match_id', '')
                player_name = item.get('player_name', '')
                player_id   = item.get('player_id') or None
                if not match_id or not player_name:
                    continue

                stat_defaults = {
                    'match_average':   item.get('match_average', 0),
                    'count_180':       item.get('count_180', 0),
                    'high_checkouts':  item.get('high_checkouts', 0),
                    'short_legs':      item.get('short_legs', 0),
                    'double_attempts': item.get('double_attempts', 0),
                    'double_hits':     item.get('double_hits', 0),
                    'darts_per_leg':   item.get('darts_per_leg', 0),
                }

                if player_id:
                    # Remove any orphan record saved earlier without player_id for
                    # the same (tournament, match_id, player_name) to avoid the
                    # unique-constraint gap where both a FK record and a name-only
                    # record can coexist for the same logical player+match.
                    MatchStatistic.objects.filter(
                        tournament=tournament,
                        match_id=match_id,
                        player_name=player_name,
                        player__isnull=True,
                    ).delete()
                    lookup   = {'tournament': tournament, 'match_id': match_id, 'player_id': player_id}
                    defaults = {'player_name': player_name, **stat_defaults}
                else:
                    lookup   = {'tournament': tournament, 'match_id': match_id, 'player_name': player_name, 'player': None}
                    defaults = stat_defaults

                obj, _ = MatchStatistic.objects.update_or_create(**lookup, defaults=defaults)
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
