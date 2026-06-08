from django.conf import settings
from django.db import models


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


class MatchStatistic(models.Model):
    tournament     = models.ForeignKey('Tournament', on_delete=models.CASCADE, related_name='statistics')
    match_id       = models.CharField(max_length=20)
    player_name    = models.CharField(max_length=200)
    match_average  = models.FloatField(default=0)
    count_180      = models.IntegerField(default=0)
    high_checkouts = models.IntegerField(default=0)
    short_legs     = models.IntegerField(default=0)

    class Meta:
        unique_together = [('tournament', 'match_id', 'player_name')]

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
