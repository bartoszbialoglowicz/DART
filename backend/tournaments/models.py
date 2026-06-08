import copy

from django.conf import settings
from django.db import models
from django.db.models import Q


def _bracket_has_pending_matches(bracket: dict) -> bool:
    fmt = bracket.get('format')

    if fmt == 'knockout':
        for rnd in bracket.get('rounds', []):
            for match in rnd.get('matches', []):
                if not match.get('result'):
                    return True
        return False

    if fmt == 'groups':
        for group in bracket.get('groups', []):
            for match in group.get('matches', []):
                if not match.get('result'):
                    return True
        # All group matches done — check playoff
        playoff = bracket.get('playoff')
        if not playoff:
            return True  # playoff not generated yet, tournament still active
        for rnd in playoff.get('rounds', []):
            for match in rnd.get('matches', []):
                if not match.get('result'):
                    return True
        return False

    return True


def _iter_matches(bracket: dict):
    """Yield every match dict in the bracket regardless of format."""
    if bracket.get('format') == 'knockout':
        for rnd in bracket.get('rounds', []):
            yield from rnd.get('matches', [])
    elif bracket.get('format') == 'groups':
        for group in bracket.get('groups', []):
            yield from group.get('matches', [])
        playoff = bracket.get('playoff')
        if playoff:
            for rnd in playoff.get('rounds', []):
                yield from rnd.get('matches', [])


def strip_legs_from_bracket(bracket: dict) -> tuple[dict, dict]:
    """
    Returns (cleaned_bracket, legs_dict).
    legs_dict: { match_id: {'legs': [...], 'current_leg': ...} }
    Cleaned bracket has 'legs' and 'currentLeg' removed from every match.
    """
    bracket = copy.deepcopy(bracket)
    legs_dict: dict = {}
    for match in _iter_matches(bracket):
        mid = match.get('id')
        if not mid:
            continue
        legs        = match.pop('legs', None)
        current_leg = match.pop('currentLeg', None)
        if legs or current_leg:
            legs_dict[mid] = {
                'legs':        legs or [],
                'current_leg': current_leg,
            }
    return bracket, legs_dict


def merge_legs_into_bracket(bracket: dict, match_legs_qs) -> dict:
    """
    Injects 'legs' and 'currentLeg' back from MatchLeg queryset into bracket dict.
    """
    ml_map = {ml.match_id: ml for ml in match_legs_qs}
    if not ml_map:
        return bracket
    bracket = copy.deepcopy(bracket)
    for match in _iter_matches(bracket):
        mid = match.get('id')
        if mid not in ml_map:
            continue
        ml = ml_map[mid]
        if ml.legs:
            match['legs'] = ml.legs
        if ml.current_leg:
            match['currentLeg'] = ml.current_leg
    return bracket


class MatchLeg(models.Model):
    tournament  = models.ForeignKey('Tournament', on_delete=models.CASCADE, related_name='match_legs')
    match_id    = models.CharField(max_length=50)
    legs        = models.JSONField(default=list)
    current_leg = models.JSONField(null=True, blank=True)

    class Meta:
        unique_together = [('tournament', 'match_id')]

    def __str__(self):
        return f'{self.tournament} / {self.match_id}'


class MatchStatistic(models.Model):
    tournament     = models.ForeignKey('Tournament', on_delete=models.CASCADE, related_name='statistics')
    match_id       = models.CharField(max_length=20)
    player         = models.ForeignKey(
        'players.Player',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='statistics',
    )
    player_name    = models.CharField(max_length=200)
    match_average    = models.FloatField(default=0)
    count_180        = models.IntegerField(default=0)
    high_checkouts   = models.IntegerField(default=0)
    short_legs       = models.IntegerField(default=0)
    double_attempts  = models.IntegerField(default=0)
    double_hits      = models.IntegerField(default=0)
    darts_per_leg    = models.FloatField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['tournament', 'match_id', 'player'],
                condition=Q(player__isnull=False),
                name='unique_stat_by_player_id',
            ),
            models.UniqueConstraint(
                fields=['tournament', 'match_id', 'player_name'],
                condition=Q(player__isnull=True),
                name='unique_stat_by_player_name',
            ),
        ]

    def __str__(self):
        return f'{self.tournament} / {self.match_id} / {self.player_name}'


class Tournament(models.Model):
    FORMAT_CHOICES = [('knockout', 'SKO'), ('groups', 'Grupy')]

    name        = models.CharField(max_length=200)
    format      = models.CharField(max_length=20, choices=FORMAT_CHOICES)
    bracket     = models.JSONField()
    is_active   = models.BooleanField(default=True)
    owner       = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tournaments',
    )
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name
