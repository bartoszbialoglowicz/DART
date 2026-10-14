from django.conf import settings
from django.db import models
from django.db.models import Q

class MatchStatistic(models.Model):
    tournament     = models.ForeignKey('Tournament', on_delete=models.CASCADE, related_name='statistics')
    match_code     = models.CharField(max_length=50)
    # Identity of the row is (match, entry). match_code / player_name are a
    # snapshot kept for the API shape and for the 6 legacy rows whose match no
    # longer exists (tournaments #18–20, imported with match = NULL).
    match          = models.ForeignKey('Match', on_delete=models.CASCADE, null=True, blank=True, related_name='statistics')
    entry          = models.ForeignKey('TournamentEntry', on_delete=models.CASCADE, null=True, blank=True, related_name='statistics')
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
                fields=['match', 'entry'],
                condition=Q(match__isnull=False, entry__isnull=False),
                name='unique_stat_per_match_entry',
            ),
        ]

    def __str__(self):
        return f'{self.tournament} / {self.match_code} / {self.player_name}'


class Tournament(models.Model):
    FORMAT_CHOICES = [('knockout', 'SKO'), ('groups', 'Grupy')]

    name        = models.CharField(max_length=200)
    format      = models.CharField(max_length=20, choices=FORMAT_CHOICES)
    is_active   = models.BooleanField(default=True)
    bracket_confirmed = models.BooleanField(default=False)
    is_private  = models.BooleanField(default=False)
    start_date  = models.DateTimeField(null=True, blank=True)
    owner       = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tournaments',
    )
    # Default match format {sets, legs, max_darts_per_leg?} — a Stage or Round
    # may override it (see resolve_match_format).
    match_format = models.JSONField(default=dict)
    # Venue board count at creation time — groups are assigned boards round-robin.
    board_count  = models.PositiveIntegerField(null=True, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name


# ── Tournament structure ──────────────────────────────────────────────────────
# Normalized replacement for the `bracket` JSON: entries (who plays), stages
# (group phase / knockout), groups and rounds inside a stage, and matches that
# reference entries directly or via a `source` (winner of match X, place N in
# group A). See TOURNAMENT_MODELS_PLAN.md.

class TournamentEntry(models.Model):
    """One participant of a tournament. `player` is always set on creation —
    a name-only roster entry becomes an account-less Player ("słup") owned by
    the organizer — and only goes null if that Player is later deleted. The
    name/average/cpu fields are a snapshot from the day of the tournament."""
    tournament       = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name='entries')
    player           = models.ForeignKey(
        'players.Player',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tournament_entries',
    )
    display_name     = models.CharField(max_length=200)
    average_snapshot = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    is_cpu           = models.BooleanField(default=False)
    seed             = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ['id']
        constraints = [
            models.UniqueConstraint(
                fields=['tournament', 'player'],
                condition=Q(player__isnull=False),
                name='unique_entry_player',
            ),
        ]

    def __str__(self):
        return f'{self.display_name} @ {self.tournament}'


class Stage(models.Model):
    KIND_CHOICES = [('groups', 'Grupy'), ('knockout', 'Drabinka')]

    tournament   = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name='stages')
    order        = models.PositiveIntegerField()
    kind         = models.CharField(max_length=20, choices=KIND_CHOICES)
    label        = models.CharField(max_length=100, blank=True)
    match_format = models.JSONField(null=True, blank=True)
    starts_at    = models.DateTimeField(null=True, blank=True)
    # groups:   {'group_size': int, 'advance_per_group': int}
    # knockout: {'size': int}
    config       = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['order']
        constraints = [
            models.UniqueConstraint(fields=['tournament', 'order'], name='unique_stage_order'),
        ]

    def __str__(self):
        return f'{self.tournament} / {self.label or self.kind}'


class Group(models.Model):
    stage = models.ForeignKey(Stage, on_delete=models.CASCADE, related_name='groups')
    order = models.PositiveIntegerField()
    label = models.CharField(max_length=10)
    board = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ['order']
        constraints = [
            models.UniqueConstraint(fields=['stage', 'order'], name='unique_group_order'),
        ]

    def __str__(self):
        return f'{self.stage} / {self.label}'


class GroupMember(models.Model):
    group    = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='members')
    entry    = models.ForeignKey(TournamentEntry, on_delete=models.CASCADE, related_name='group_memberships')
    position = models.PositiveIntegerField()

    class Meta:
        ordering = ['position']
        constraints = [
            models.UniqueConstraint(fields=['group', 'entry'], name='unique_group_entry'),
            models.UniqueConstraint(fields=['group', 'position'], name='unique_group_position'),
        ]

    def __str__(self):
        return f'{self.group} / {self.entry.display_name}'


class Round(models.Model):
    TIER_CHOICES = [
        ('final',        'Finał'),
        ('semifinal',    'Półfinał'),
        ('quarterfinal', 'Ćwierćfinał'),
        ('other',        'Inna'),
    ]

    stage        = models.ForeignKey(Stage, on_delete=models.CASCADE, related_name='rounds')
    order        = models.PositiveIntegerField()
    # Phase-config key the wizard uses: 'round-0' (knockout), 'r0' (playoff).
    code         = models.CharField(max_length=20)
    label        = models.CharField(max_length=100)
    starts_at    = models.DateTimeField(null=True, blank=True)
    match_format = models.JSONField(null=True, blank=True)
    # Placement credited to a player who loses in this round (winner of a
    # 'final' round is the tournament winner) — stored, not derived from the
    # round index, so custom bracket layouts can set it explicitly.
    tier         = models.CharField(max_length=20, choices=TIER_CHOICES, default='other')

    class Meta:
        ordering = ['order']
        constraints = [
            models.UniqueConstraint(fields=['stage', 'order'], name='unique_round_order'),
        ]

    def __str__(self):
        return f'{self.stage} / {self.label}'


class Match(models.Model):
    STATUS_CHOICES = [
        ('pending',  'Oczekuje'),
        ('live',     'Na żywo'),
        ('finished', 'Zakończony'),
        ('bye',      'Wolny los'),
    ]
    WINNER_CHOICES = [('', '—'), ('top', 'Góra'), ('bottom', 'Dół')]

    tournament    = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name='matches')
    stage         = models.ForeignKey(Stage, on_delete=models.CASCADE, related_name='matches')
    round         = models.ForeignKey(Round, on_delete=models.CASCADE, null=True, blank=True, related_name='matches')
    group         = models.ForeignKey(Group, on_delete=models.CASCADE, null=True, blank=True, related_name='matches')
    # Public id within the tournament ('r0-m3', 'group-1-m4') — kept from the
    # bracket JSON so URLs and statistics keep working.
    code          = models.CharField(max_length=50)
    order         = models.PositiveIntegerField()

    top_entry     = models.ForeignKey(TournamentEntry, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    bottom_entry  = models.ForeignKey(TournamentEntry, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    # Where a slot's entry comes from once it's known:
    #   {'kind': 'winner'|'loser', 'match': '<code>'}
    #   {'kind': 'group', 'group': '<label>', 'place': <1-based>}
    # null = seeded directly at draw time (or an empty slot = bye).
    top_source    = models.JSONField(null=True, blank=True)
    bottom_source = models.JSONField(null=True, blank=True)

    status        = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    winner        = models.CharField(max_length=10, choices=WINNER_CHOICES, blank=True, default='')
    # Headline score: legs when the format is a single set, sets otherwise.
    top_score     = models.PositiveIntegerField(null=True, blank=True)
    bottom_score  = models.PositiveIntegerField(null=True, blank=True)
    legs          = models.JSONField(default=list, blank=True)
    current_leg   = models.JSONField(null=True, blank=True)
    finished_at   = models.DateTimeField(null=True, blank=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['stage__order', 'group__order', 'round__order', 'order']
        constraints = [
            models.UniqueConstraint(fields=['tournament', 'code'], name='unique_match_code'),
        ]

    def __str__(self):
        return f'{self.tournament} / {self.code}'


# ── Tournament cycles ──────────────────────────────────────────────────────────
# A cycle groups several Tournaments under one combined points classification.
# Scoring itself (placement tiers / match wins / bonuses) lives in a later stage —
# this is just the container + calendar-of-events shape.

DEFAULT_PLACEMENT_POINTS = {
    'winner':       10,
    'final':        7,
    'semifinal':    5,
    'quarterfinal': 3,
    'other':        1,
}


def default_placement_points() -> dict:
    return dict(DEFAULT_PLACEMENT_POINTS)


class TournamentCycle(models.Model):
    SCORING_MODE_CHOICES = [('placement', 'Miejsce'), ('match_wins', 'Wygrane mecze')]
    STATUS_CHOICES       = [('draft', 'Szkic'), ('active', 'Aktywny'), ('finished', 'Zakończony')]

    name         = models.CharField(max_length=200)
    owner        = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='tournament_cycles',
    )
    is_private   = models.BooleanField(default=False)
    status       = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')

    scoring_mode = models.CharField(max_length=20, choices=SCORING_MODE_CHOICES, default='placement')
    # Points per placement tier — {'winner': int, 'final': int, 'semifinal': int, 'quarterfinal': int, 'other': int}
    placement_points = models.JSONField(default=default_placement_points)
    # Optional bonus points per occurrence, aggregated from MatchStatistic. null = bonus disabled.
    bonus_180_points           = models.PositiveIntegerField(null=True, blank=True)
    bonus_high_checkout_points = models.PositiveIntegerField(null=True, blank=True)

    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class CycleEvent(models.Model):
    """One slot on a cycle's calendar — a planned event that may later have a
    real Tournament attached once it's actually created and played."""
    cycle        = models.ForeignKey(TournamentCycle, on_delete=models.CASCADE, related_name='events')
    name         = models.CharField(max_length=200)
    planned_date = models.DateField(null=True, blank=True)
    tournament   = models.OneToOneField(
        Tournament,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cycle_event',
    )
    order        = models.PositiveIntegerField(default=0)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'planned_date', 'id']

    def __str__(self):
        return f'{self.cycle} — {self.name}'
