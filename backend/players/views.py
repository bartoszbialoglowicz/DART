from django.db.models import Avg, Count, Max, Sum
from django.db.models import Q
from rest_framework import filters, permissions, viewsets
from rest_framework.authentication import TokenAuthentication
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Player, TrainingSession
from .serializers import PlayerSerializer, TrainingSessionSerializer


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
