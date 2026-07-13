from rest_framework import serializers
from .models import Player, TrainingSession, HighscoreSession, SectorPracticeSession, PendingMatchResult


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


class HighscoreSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model  = HighscoreSession
        fields = ['id', 'played_at', 'darts', 'score', 'created_at']
        read_only_fields = ['id', 'created_at']


class SectorPracticeSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model  = SectorPracticeSession
        fields = ['id', 'played_at', 'sector', 'hit_rate', 'score', 'created_at']
        read_only_fields = ['id', 'created_at']


class PendingMatchResultSerializer(serializers.ModelSerializer):
    class Meta:
        model  = PendingMatchResult
        fields = ['id', 'opponent_name', 'played_at', 'average', 'legs_won', 'legs_lost',
                  'double_attempts', 'double_hits', 'created_at']
        read_only_fields = ['id', 'created_at']
