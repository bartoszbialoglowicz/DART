from rest_framework import serializers
from .models import League, LeagueMember, LeagueMatch


class LeagueMemberSerializer(serializers.ModelSerializer):
    player_id = serializers.IntegerField(source='player.id', read_only=True, default=None)

    class Meta:
        model  = LeagueMember
        fields = ['id', 'player_id', 'display_name', 'status', 'joined_at']
        read_only_fields = ['id', 'player_id', 'joined_at']


class LeagueMatchSerializer(serializers.ModelSerializer):
    home_name = serializers.CharField(source='home.display_name', read_only=True)
    away_name = serializers.CharField(source='away.display_name', read_only=True)

    class Meta:
        model  = LeagueMatch
        fields = [
            'id', 'matchday', 'home', 'away', 'home_name', 'away_name',
            'scheduled_at', 'status', 'home_score', 'away_score', 'played_at',
        ]
        read_only_fields = ['id', 'home_name', 'away_name']


class LeagueSerializer(serializers.ModelSerializer):
    owner_username = serializers.CharField(source='owner.username', read_only=True)
    members        = LeagueMemberSerializer(many=True, read_only=True)
    member_count   = serializers.IntegerField(source='members.count', read_only=True)
    match_count    = serializers.IntegerField(source='matches.count', read_only=True)

    class Meta:
        model  = League
        fields = [
            'id', 'name', 'owner_username', 'is_private',
            'matches_per_pair', 'points_win', 'points_draw',
            'match_format', 'sets', 'legs',
            'status', 'created_at', 'updated_at',
            'members', 'member_count', 'match_count',
        ]
        read_only_fields = ['id', 'owner_username', 'created_at', 'updated_at', 'members', 'member_count', 'match_count']


class LeagueListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list view (no members/matches detail)."""
    owner_username = serializers.CharField(source='owner.username', read_only=True)
    member_count   = serializers.IntegerField(source='members.count', read_only=True)

    class Meta:
        model  = League
        fields = [
            'id', 'name', 'owner_username', 'is_private',
            'matches_per_pair', 'points_win', 'points_draw',
            'match_format', 'sets', 'legs',
            'status', 'created_at', 'member_count',
        ]
        read_only_fields = fields
