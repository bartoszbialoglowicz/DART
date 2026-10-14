"""Cycle standings over the normalized models.

A tournament only contributes once it's fully decided (is_active == False) —
no partial credit for a cycle event that's still being played. Players are
keyed by their Player id across tournaments; an entry whose player has been
deleted is keyed by the entry itself.
"""
from ..models import MatchStatistic, TournamentEntry
from .placement import match_win_counts, placement_tiers


def _key(entry) -> tuple:
    return ('player', entry.player_id) if entry.player_id else ('entry', entry.id)


def compute_cycle_standings(cycle) -> list[dict]:
    """
    One row per player who scored at least one point across the cycle's decided
    events: {'player_id', 'player_name', 'total_points', 'points_by_event': {event_id: points}}.
    Sorted by total_points descending.
    """
    totals: dict = {}

    for event in cycle.events.select_related('tournament').all():
        tournament = event.tournament
        if not tournament or tournament.is_active:
            continue

        entries = {e.id: e for e in TournamentEntry.objects.filter(tournament=tournament)}
        if cycle.scoring_mode == 'placement':
            per_entry = {eid: cycle.placement_points.get(tier, 0) for eid, tier in placement_tiers(tournament).items()}
        else:
            per_entry = dict(match_win_counts(tournament))

        if cycle.bonus_180_points or cycle.bonus_high_checkout_points:
            stats = MatchStatistic.objects.filter(tournament=tournament, entry__isnull=False)
            for stat in stats:
                bonus = 0
                if cycle.bonus_180_points:
                    bonus += stat.count_180 * cycle.bonus_180_points
                if cycle.bonus_high_checkout_points:
                    bonus += stat.high_checkouts * cycle.bonus_high_checkout_points
                per_entry[stat.entry_id] = per_entry.get(stat.entry_id, 0) + bonus

        for entry_id, points in per_entry.items():
            entry = entries.get(entry_id)
            if entry is None or points <= 0:
                continue
            row = totals.setdefault(_key(entry), {
                'player_id': entry.player_id, 'player_name': entry.display_name,
                'total_points': 0, 'points_by_event': {},
            })
            row['player_name']   = entry.display_name  # latest name wins
            row['total_points'] += points
            row['points_by_event'][event.id] = row['points_by_event'].get(event.id, 0) + points

    return sorted(totals.values(), key=lambda r: r['total_points'], reverse=True)
