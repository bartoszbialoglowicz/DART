from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import MatchLeg, MatchStatistic, Tournament, _bracket_has_pending_matches, strip_legs_from_bracket
from .serializers import MatchStatisticSerializer, TournamentSerializer


class IsOwnerOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.owner == request.user


class TournamentViewSet(viewsets.ModelViewSet):
    queryset           = Tournament.objects.select_related('owner').prefetch_related('match_legs').all()
    serializer_class   = TournamentSerializer
    http_method_names  = ['get', 'post', 'patch', 'put', 'delete', 'head', 'options']
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def perform_update(self, serializer):
        bracket = serializer.validated_data.get('bracket')
        if bracket:
            cleaned, legs_dict = strip_legs_from_bracket(bracket)
            for mid, data in legs_dict.items():
                MatchLeg.objects.update_or_create(
                    tournament=serializer.instance,
                    match_id=mid,
                    defaults=data,
                )
            serializer.save(bracket=cleaned, is_active=_bracket_has_pending_matches(cleaned))
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
        for item in items:
            match_id    = item.get('match_id', '')
            player_name = item.get('player_name', '')
            player_id   = item.get('player_id') or None
            if not match_id or not player_name:
                continue

            if player_id:
                lookup   = {'tournament': tournament, 'match_id': match_id, 'player_id': player_id}
                defaults = {'player_name': player_name}
            else:
                lookup   = {'tournament': tournament, 'match_id': match_id, 'player_name': player_name, 'player': None}
                defaults = {}

            defaults.update({
                'match_average':   item.get('match_average', 0),
                'count_180':       item.get('count_180', 0),
                'high_checkouts':  item.get('high_checkouts', 0),
                'short_legs':      item.get('short_legs', 0),
                'double_attempts': item.get('double_attempts', 0),
                'double_hits':     item.get('double_hits', 0),
                'darts_per_leg':   item.get('darts_per_leg', 0),
            })

            obj, _ = MatchStatistic.objects.update_or_create(**lookup, defaults=defaults)
            saved.append(obj)

        return Response(MatchStatisticSerializer(saved, many=True).data)
