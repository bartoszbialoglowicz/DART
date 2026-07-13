from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import Venue
from .serializers import VenueSerializer


class VenueViewSet(viewsets.ModelViewSet):
    serializer_class   = VenueSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Venue.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
