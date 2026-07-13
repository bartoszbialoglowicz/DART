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


def find_locked_result_changes(old_bracket: dict, new_bracket: dict) -> list[str]:
    """
    Match ids whose already-recorded result the incoming bracket would change.

    Once a match has a result it is locked — the client can still resend the
    identical bracket (e.g. an idempotent retry of the same PATCH), just not
    alter or clear a result that was already saved. Without this, anything
    that can reach the update endpoint with a stale/tampered bracket (e.g. a
    client that reopened the live match screen for an already-finished match
    via the browser back button) could silently rewrite a decided match.
    """
    old_results = {m['id']: m['result'] for m in _iter_matches(old_bracket) if m.get('id') and m.get('result')}
    if not old_results:
        return []
    new_results = {m['id']: m.get('result') for m in _iter_matches(new_bracket) if m.get('id')}
    return [mid for mid, result in old_results.items() if new_results.get(mid) != result]


def find_bot_simulation_lock_violations(
    old_bracket: dict, new_bracket: dict, simulating_match_ids: set[str],
) -> list[str]:
    """
    Match ids where the incoming bracket newly sets a result for a bot-vs-bot
    match while "Symuluj na żywo" is still running for it (MatchLeg.current_leg
    is set). Scoped to bot-vs-bot matches only — human live matches already
    clear their MatchLeg lock and save the result as two separate requests
    without a shared transaction, and this must not start rejecting those.

    Without this, a second device signed into the same account could fire
    "Symuluj" or "Wpisz wynik" for the same match while the first device's
    live simulation is still playing out, saving a competing result.
    """
    if not simulating_match_ids:
        return []
    old_results = {m['id']: m.get('result') for m in _iter_matches(old_bracket) if m.get('id')}
    violations = []
    for m in _iter_matches(new_bracket):
        mid = m.get('id')
        if mid not in simulating_match_ids or old_results.get(mid) or not m.get('result'):
            continue
        if m.get('top', {}).get('isCpu') and m.get('bottom', {}).get('isCpu'):
            violations.append(mid)
    return violations


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


class TournamentParticipant(models.Model):
    """Denormalized list of players in each tournament — derived from bracket JSON."""
    tournament   = models.ForeignKey('Tournament', on_delete=models.CASCADE, related_name='participants')
    player       = models.ForeignKey(
        'players.Player',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='tournament_participations',
    )
    display_name = models.CharField(max_length=200)

    class Meta:
        ordering = ['display_name']
        constraints = [
            models.UniqueConstraint(
                fields=['tournament', 'player'],
                condition=Q(player__isnull=False),
                name='unique_tournament_player',
            ),
        ]

    def __str__(self):
        return f'{self.display_name} @ {self.tournament}'


def sync_participants(tournament):
    """Rebuild TournamentParticipant rows from the bracket JSON (idempotent)."""
    from players.models import Player

    bracket = tournament.bracket or {}
    seen: dict[int, str] = {}  # playerId → display_name

    def scan(matches):
        for m in matches:
            for side in ('top', 'bottom'):
                slot = m.get(side) or {}
                pid  = slot.get('playerId')
                name = (slot.get('playerName') or '').strip()
                if pid is not None and name and pid not in seen:
                    seen[pid] = name

    fmt = bracket.get('format')
    if fmt == 'knockout':
        for rnd in bracket.get('rounds', []):
            scan(rnd.get('matches', []))
    elif fmt == 'groups':
        for group in bracket.get('groups', []):
            scan(group.get('matches', []))
        for rnd in (bracket.get('playoff') or {}).get('rounds', []):
            scan(rnd.get('matches', []))

    player_map = {p.pk: p for p in Player.objects.filter(pk__in=seen)}

    TournamentParticipant.objects.filter(tournament=tournament).delete()
    TournamentParticipant.objects.bulk_create([
        TournamentParticipant(
            tournament=tournament,
            player=player_map.get(pid),
            display_name=name,
        )
        for pid, name in seen.items()
    ])


class Tournament(models.Model):
    FORMAT_CHOICES = [('knockout', 'SKO'), ('groups', 'Grupy')]

    name        = models.CharField(max_length=200)
    format      = models.CharField(max_length=20, choices=FORMAT_CHOICES)
    bracket     = models.JSONField()
    is_active   = models.BooleanField(default=True)
    is_private  = models.BooleanField(default=False)
    start_date  = models.DateTimeField(null=True, blank=True)
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


# ── Cycle standings ───────────────────────────────────────────────────────────
# A tournament only contributes once it's fully decided (is_active == False) —
# no partial credit for a cycle event that's still being played.

def _player_key(player_id, player_name):
    """Normalizes a bracket slot / MatchStatistic row into a stable identity key.
    Placeholder players use a negative playerId in the bracket but MatchStatistic
    always stores player=None for them — both must collapse to the same (None, name)
    key or a placeholder's placement points and bonus points won't merge."""
    pid = player_id if (player_id is not None and player_id > 0) else None
    return (pid, player_name or '')


def _has_player(slot: dict) -> bool:
    return slot.get('playerId') is not None or bool(slot.get('playerName'))


def _placement_tiers(bracket: dict) -> dict:
    """{ (playerId, playerName): tier } for every eliminated/placed player, tier
    in {'winner','final','semifinal','quarterfinal','other'}."""
    tiers: dict = {}

    def apply_rounds(rounds):
        num_rounds = len(rounds)
        for ri, rnd in enumerate(rounds):
            from_end = num_rounds - 1 - ri
            tier = {0: 'final', 1: 'semifinal', 2: 'quarterfinal'}.get(from_end, 'other')
            for match in rnd.get('matches', []):
                result = match.get('result')
                if not result:
                    continue
                top, bottom = match.get('top') or {}, match.get('bottom') or {}
                winner_slot = top if result.get('winner') == 'top' else bottom
                loser_slot  = bottom if result.get('winner') == 'top' else top
                if tier == 'final' and _has_player(winner_slot):
                    tiers[_player_key(winner_slot.get('playerId'), winner_slot.get('playerName'))] = 'winner'
                if _has_player(loser_slot):
                    tiers[_player_key(loser_slot.get('playerId'), loser_slot.get('playerName'))] = tier

    fmt = bracket.get('format')
    if fmt == 'knockout':
        apply_rounds(bracket.get('rounds', []))
    elif fmt == 'groups':
        playoff = bracket.get('playoff') or {}
        playoff_rounds = playoff.get('rounds', [])
        playoff_keys = set()
        for rnd in playoff_rounds:
            for match in rnd.get('matches', []):
                for slot in (match.get('top') or {}, match.get('bottom') or {}):
                    if _has_player(slot):
                        playoff_keys.add(_player_key(slot.get('playerId'), slot.get('playerName')))
        # Group-stage-only players (didn't qualify for playoff) are simply "other".
        for group in bracket.get('groups', []):
            for slot in group.get('slots', []):
                if not _has_player(slot):
                    continue
                k = _player_key(slot.get('playerId'), slot.get('playerName'))
                if k not in playoff_keys:
                    tiers[k] = 'other'
        apply_rounds(playoff_rounds)

    return tiers


def _match_win_counts(bracket: dict) -> dict:
    """{ (playerId, playerName): number of match wins } across the whole tournament."""
    wins: dict = {}
    for match in _iter_matches(bracket):
        result = match.get('result')
        if not result:
            continue
        top, bottom = match.get('top') or {}, match.get('bottom') or {}
        winner_slot = top if result.get('winner') == 'top' else bottom
        if _has_player(winner_slot):
            k = _player_key(winner_slot.get('playerId'), winner_slot.get('playerName'))
            wins[k] = wins.get(k, 0) + 1
    return wins


def compute_cycle_standings(cycle: TournamentCycle) -> list[dict]:
    """
    One row per player who scored at least one point across the cycle's decided
    events: {'player_id', 'player_name', 'total_points', 'points_by_event': {event_id: points}}.
    Sorted by total_points descending.
    """
    totals: dict = {}

    for event in cycle.events.select_related('tournament').all():
        tournament = event.tournament
        if not tournament or tournament.is_active:
            continue  # no tournament attached yet, or still in progress

        bracket = tournament.bracket
        if cycle.scoring_mode == 'placement':
            tiers = _placement_tiers(bracket)
            base_points = {k: cycle.placement_points.get(tier, 0) for k, tier in tiers.items()}
        else:
            base_points = dict(_match_win_counts(bracket))

        bonus_points: dict = {}
        if cycle.bonus_180_points or cycle.bonus_high_checkout_points:
            for stat in MatchStatistic.objects.filter(tournament=tournament):
                k = _player_key(stat.player_id, stat.player_name)
                b = bonus_points.get(k, 0)
                if cycle.bonus_180_points:
                    b += stat.count_180 * cycle.bonus_180_points
                if cycle.bonus_high_checkout_points:
                    b += stat.high_checkouts * cycle.bonus_high_checkout_points
                bonus_points[k] = b

        for k in set(base_points) | set(bonus_points):
            points = base_points.get(k, 0) + bonus_points.get(k, 0)
            if points <= 0:
                continue
            row = totals.setdefault(k, {'player_id': k[0], 'player_name': k[1], 'total_points': 0, 'points_by_event': {}})
            row['total_points'] += points
            row['points_by_event'][event.id] = row['points_by_event'].get(event.id, 0) + points

    return sorted(totals.values(), key=lambda r: r['total_points'], reverse=True)
