from rest_framework import serializers
from .models import Venue


class VenueSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Venue
        fields = [
            'id', 'name', 'address', 'board_count',
            'default_sets', 'default_legs', 'max_darts_per_leg',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
