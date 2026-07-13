from datetime import date

from django.conf import settings
from django.db import models


class Player(models.Model):
    user       = models.OneToOneField(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='player_profile')
    owner      = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE, related_name='owned_players')
    first_name = models.CharField(max_length=100)
    last_name  = models.CharField(max_length=100)
    average    = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    photo      = models.ImageField(upload_to='players/photos/',      blank=True, null=True)
    winner_img = models.ImageField(upload_to='players/winner_imgs/', blank=True, null=True)
    cpu        = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['last_name', 'first_name']

    def __str__(self) -> str:
        return f'{self.first_name} {self.last_name}'


class PendingMatchResult(models.Model):
    for_player      = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='pending_results')
    opponent_name   = models.CharField(max_length=200)
    played_at       = models.DateField()
    average         = models.FloatField()
    legs_won        = models.PositiveIntegerField()
    legs_lost       = models.PositiveIntegerField()
    double_attempts = models.PositiveIntegerField(default=0)
    double_hits     = models.PositiveIntegerField(default=0)
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-played_at', '-created_at']

    def __str__(self) -> str:
        return f'Pending for {self.for_player} vs {self.opponent_name} on {self.played_at}'


class TrainingSession(models.Model):
    player     = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='training_sessions')
    played_at        = models.DateField(default=date.today)
    average          = models.FloatField()
    legs             = models.PositiveIntegerField(default=1)
    double_attempts  = models.PositiveIntegerField(default=0)
    double_hits      = models.PositiveIntegerField(default=0)
    notes            = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-played_at', '-created_at']

    def __str__(self) -> str:
        return f'{self.player} — {self.played_at} ({self.average})'


class HighscoreSession(models.Model):
    """One completed Highscore run: N darts thrown, cumulative score (no countdown)."""
    player     = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='highscore_sessions')
    played_at  = models.DateField(default=date.today)
    darts      = models.PositiveIntegerField()
    score      = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-score', '-created_at']

    def __str__(self) -> str:
        return f'{self.player} — {self.darts} lotek ({self.score})'


class SectorPracticeSession(models.Model):
    """One completed 'Jeden sektor' run: hit-rate and score aiming at a single sector."""
    player     = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='sector_practice_sessions')
    played_at  = models.DateField(default=date.today)
    sector     = models.CharField(max_length=10)
    hit_rate   = models.FloatField()
    score      = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-played_at', '-created_at']

    def __str__(self) -> str:
        return f'{self.player} — sektor {self.sector} ({self.hit_rate:.0f}%, {self.score} pkt)'
