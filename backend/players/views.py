from django.db.models import Q
from rest_framework import filters, permissions, viewsets
from rest_framework.authentication import TokenAuthentication
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Player
from .serializers import PlayerSerializer


class PlayerViewSet(viewsets.ModelViewSet):
    serializer_class = PlayerSerializer
    filter_backends  = [filters.SearchFilter, filters.OrderingFilter]
    search_fields    = ['first_name', 'last_name']
    ordering_fields  = ['last_name', 'average', 'created_at']

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated:
            # Human profiles (always public) + own bots
            return Player.objects.filter(Q(cpu=False) | Q(owner=user, cpu=True))
        return Player.objects.filter(cpu=False)

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
