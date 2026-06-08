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


class TrainingSession(models.Model):
    player     = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='training_sessions')
    played_at  = models.DateField(default=date.today)
    average    = models.FloatField()
    legs       = models.PositiveIntegerField(default=1)
    notes      = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-played_at', '-created_at']

    def __str__(self) -> str:
        return f'{self.player} — {self.played_at} ({self.average})'
