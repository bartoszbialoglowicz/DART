from rest_framework import serializers
from .models import MatchStatistic, Tournament, TournamentCycle, CycleEvent
from .services import EntrySpec
from .services.bracket_view import build_bracket


class TournamentListSerializer(serializers.ModelSerializer):
    """Lightweight row for lists — no bracket."""
    owner_username = serializers.CharField(source='owner.username', read_only=True, default=None)
    player_count   = serializers.SerializerMethodField()

    def get_player_count(self, obj):
        count = getattr(obj, 'player_count', None)
        return count if count is not None else obj.entries.count()

    class Meta:
        model  = Tournament
        fields = [
            'id', 'name', 'format', 'is_active', 'bracket_confirmed', 'is_private', 'start_date',
            'owner_username', 'player_count', 'created_at', 'updated_at',
        ]
        read_only_fields = fields


class TournamentSerializer(TournamentListSerializer):
    """Detail: the bracket in the legacy BracketData shape, built from the
    normalized models. Legs live on the matches now, so `match_legs` is
    always empty (kept so older clients still parse the response)."""
    bracket    = serializers.SerializerMethodField()
    match_legs = serializers.SerializerMethodField()

    def get_bracket(self, obj):
        return build_bracket(obj)

    def get_match_legs(self, obj):
        return {}

    class Meta(TournamentListSerializer.Meta):
        fields = TournamentListSerializer.Meta.fields + ['bracket', 'match_legs']
        read_only_fields = fields


class TournamentUpdateSerializer(serializers.ModelSerializer):
    """PATCH accepts metadata only — the structure changes through commands."""

    def validate(self, attrs):
        if 'bracket' in self.initial_data:
            raise serializers.ValidationError(
                {'bracket': 'Drabinki nie zapisuje się już w całości — użyj komend (wynik, losowanie, awans).'}
            )
        return attrs

    class Meta:
        model  = Tournament
        fields = ['name', 'is_private', 'start_date']


class EntryField(serializers.Field):
    """{'player_id': int} for an existing player, {'name': str} for a guest."""

    def to_internal_value(self, data):
        if not isinstance(data, dict):
            raise serializers.ValidationError('Oczekiwano obiektu {player_id} albo {name}.')
        player_id, name = data.get('player_id'), (data.get('name') or '').strip()
        if player_id is not None:
            if not isinstance(player_id, int) or isinstance(player_id, bool) or player_id <= 0:
                raise serializers.ValidationError('Nieprawidłowe player_id.')
            return EntrySpec(player_id=player_id)
        if name:
            return EntrySpec(name=name[:200])
        raise serializers.ValidationError('Podaj player_id albo name.')

    def to_representation(self, value):
        return {'player_id': value.player_id} if value.player_id else {'name': value.name}


class TournamentCreateSerializer(serializers.Serializer):
    name          = serializers.CharField(max_length=200)
    format        = serializers.ChoiceField(choices=Tournament.FORMAT_CHOICES)
    is_private    = serializers.BooleanField(default=False)
    start_date    = serializers.DateTimeField(required=False, allow_null=True, default=None)
    match_format  = serializers.DictField()
    group_size    = serializers.IntegerField(default=4)
    phase_configs = serializers.DictField(required=False, default=dict)
    board_count   = serializers.IntegerField(required=False, allow_null=True, default=None, min_value=1)
    entries       = serializers.ListField(child=EntryField(), allow_empty=False)


class MatchResultSerializer(serializers.Serializer):
    top_score    = serializers.IntegerField(min_value=0)
    bottom_score = serializers.IntegerField(min_value=0)
    legs         = serializers.ListField(required=False, allow_null=True, default=None)
    live         = serializers.BooleanField(default=False)


class MatchStatisticSerializer(serializers.ModelSerializer):
    match_id = serializers.CharField(source='match_code', read_only=True)

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
