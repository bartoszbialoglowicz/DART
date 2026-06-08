from rest_framework import serializers
from .models import Player


class PlayerSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Player
        fields = ['id', 'first_name', 'last_name', 'average', 'photo', 'winner_img', 'cpu', 'created_at']
        read_only_fields = ['id', 'created_at']
