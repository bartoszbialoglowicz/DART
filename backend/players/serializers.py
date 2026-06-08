from rest_framework import serializers
from .models import Player, TrainingSession


class PlayerSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Player
        fields = ['id', 'user_id', 'first_name', 'last_name', 'average', 'photo', 'winner_img', 'cpu', 'created_at']
        read_only_fields = ['id', 'user_id', 'created_at']


class TrainingSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model  = TrainingSession
        fields = ['id', 'played_at', 'average', 'legs', 'double_attempts', 'double_hits', 'notes', 'created_at']
        read_only_fields = ['id', 'created_at']
