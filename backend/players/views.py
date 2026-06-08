from rest_framework import viewsets, filters
from .models import Player
from .serializers import PlayerSerializer


class PlayerViewSet(viewsets.ModelViewSet):
    queryset = Player.objects.all()
    serializer_class = PlayerSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields   = ['first_name', 'last_name']
    ordering_fields = ['last_name', 'average', 'created_at']
