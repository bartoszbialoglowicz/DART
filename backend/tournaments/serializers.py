from rest_framework import serializers
from .models import MatchLeg, MatchStatistic, Tournament, TournamentCycle, CycleEvent


class TournamentSerializer(serializers.ModelSerializer):
    owner_username = serializers.CharField(source='owner.username', read_only=True, default=None)
    match_legs     = serializers.SerializerMethodField(read_only=True)

    def get_match_legs(self, obj):
        return {
            ml.match_id: {'legs': ml.legs, 'currentLeg': ml.current_leg}
            for ml in obj.match_legs.all()
        }

    class Meta:
        model  = Tournament
        fields = ['id', 'name', 'format', 'bracket', 'is_active', 'is_private', 'start_date', 'owner_username', 'created_at', 'updated_at', 'match_legs']
        read_only_fields = ['id', 'is_active', 'owner_username', 'created_at', 'updated_at', 'match_legs']


class MatchStatisticSerializer(serializers.ModelSerializer):
    class Meta:
        model  = MatchStatistic
        fields = ['id', 'match_id', 'player_id', 'player_name', 'match_average', 'count_180', 'high_checkouts', 'short_legs', 'double_attempts', 'double_hits', 'darts_per_leg']


class CycleEventSerializer(serializers.ModelSerializer):
    tournament_id     = serializers.SerializerMethodField()
    tournament_name    = serializers.SerializerMethodField()
    tournament_active  = serializers.SerializerMethodField()

    class Meta:
        model  = CycleEvent
        fields = ['id', 'name', 'planned_date', 'order', 'tournament_id', 'tournament_name', 'tournament_active']
        read_only_fields = ['id', 'tournament_id', 'tournament_name', 'tournament_active']

    def get_tournament_id(self, obj):
        return obj.tournament_id

    def get_tournament_name(self, obj):
        return obj.tournament.name if obj.tournament_id else None

    def get_tournament_active(self, obj):
        return obj.tournament.is_active if obj.tournament_id else None


class TournamentCycleSerializer(serializers.ModelSerializer):
    owner_username = serializers.CharField(source='owner.username', read_only=True, default=None)
    events         = CycleEventSerializer(many=True, read_only=True)

    class Meta:
        model  = TournamentCycle
        fields = [
            'id', 'name', 'is_private', 'status', 'scoring_mode',
            'placement_points', 'bonus_180_points', 'bonus_high_checkout_points',
            'owner_username', 'events', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'status', 'owner_username', 'events', 'created_at', 'updated_at']
