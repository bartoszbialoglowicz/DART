from django.conf import settings
from django.db import models


class League(models.Model):
    FORMAT_CHOICES = [('legs', 'Legi'), ('sets', 'Sety')]
    STATUS_CHOICES = [('draft', 'Szkic'), ('active', 'Aktywna'), ('finished', 'Zakończona')]

    name             = models.CharField(max_length=200)
    owner            = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='owned_leagues',
    )
    is_private       = models.BooleanField(default=False)
    matches_per_pair = models.PositiveIntegerField(default=2)
    points_win       = models.PositiveIntegerField(default=3)
    points_draw      = models.PositiveIntegerField(default=1)
    match_format     = models.CharField(max_length=10, choices=FORMAT_CHOICES, default='legs')
    sets             = models.PositiveIntegerField(default=1)
    legs             = models.PositiveIntegerField(default=3)
    status           = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    created_at       = models.DateTimeField(auto_now_add=True)
    updated_at       = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class LeagueMember(models.Model):
    STATUS_CHOICES = [('active', 'Aktywny'), ('pending', 'Oczekuje')]

    league       = models.ForeignKey(League, on_delete=models.CASCADE, related_name='members')
    # null when placeholder (unregistered player)
    player       = models.ForeignKey(
        'players.Player',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='league_memberships',
    )
    display_name = models.CharField(max_length=100)
    # 'pending' = placeholder not yet linked to an account
    status       = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    joined_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['display_name']
        constraints = [
            # Enforce uniqueness only when player is not null
            models.UniqueConstraint(
                fields=['league', 'player'],
                condition=models.Q(player__isnull=False),
                name='unique_league_player',
            ),
        ]

    def __str__(self):
        return f'{self.display_name} @ {self.league}'


class LeagueMatch(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Oczekuje'),
        ('awaiting_approval', 'Do akceptacji'),
        ('finished', 'Zakończony'),
    ]

    league       = models.ForeignKey(League, on_delete=models.CASCADE, related_name='matches')
    home         = models.ForeignKey(LeagueMember, on_delete=models.CASCADE, related_name='home_matches')
    away         = models.ForeignKey(LeagueMember, on_delete=models.CASCADE, related_name='away_matches')
    matchday     = models.PositiveIntegerField()
    scheduled_at = models.DateTimeField(null=True, blank=True)
    status       = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    home_score   = models.PositiveIntegerField(null=True, blank=True)
    away_score   = models.PositiveIntegerField(null=True, blank=True)
    played_at    = models.DateTimeField(null=True, blank=True)

    # Who last submitted the score currently sitting on this row — used to
    # decide finished-vs-awaiting_approval on submit, and shown to the owner
    # as "zgłoszone przez X" while a result is awaiting approval.
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )

    # Per-side match stats, entered manually (or computed from live-play legs)
    # alongside the score — same granularity as tournaments.MatchStatistic.
    home_count_180        = models.PositiveIntegerField(default=0)
    away_count_180        = models.PositiveIntegerField(default=0)
    home_high_checkouts   = models.PositiveIntegerField(default=0)
    away_high_checkouts   = models.PositiveIntegerField(default=0)
    home_short_legs       = models.PositiveIntegerField(default=0)
    away_short_legs       = models.PositiveIntegerField(default=0)

    # Leg-by-leg live-play state, same shape as tournaments.MatchLeg — no
    # separate model needed since LeagueMatch is already a plain row (not
    # JSON embedded in a bracket like tournament matches are).
    legs        = models.JSONField(default=list, blank=True)
    current_leg = models.JSONField(null=True, blank=True)

    class Meta:
        ordering = ['matchday', 'id']

    def __str__(self):
        return f'MD{self.matchday}: {self.home} vs {self.away}'
