from rest_framework import serializers
from .models import MatchStatistic, Tournament


class TournamentSerializer(serializers.ModelSerializer):
    owner_username = serializers.CharField(source='owner.username', read_only=True, default=None)

    class Meta:
        model  = Tournament
        fields = ['id', 'name', 'format', 'bracket', 'is_active', 'owner_username', 'created_at', 'updated_at']
        read_only_fields = ['id', 'is_active', 'owner_username', 'created_at', 'updated_at']


class MatchStatisticSerializer(serializers.ModelSerializer):
    class Meta:
        model  = MatchStatistic
        fields = ['id', 'match_id', 'player_id', 'player_name', 'match_average', 'count_180', 'high_checkouts', 'short_legs', 'double_attempts', 'double_hits', 'darts_per_leg']
