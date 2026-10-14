"""Cycle standings over the normalized models.

A tournament only contributes once it's fully decided (is_active == False) —
no partial credit for a cycle event that's still being played. Players are
keyed by their Player id across tournaments — an account-less player linked
to a profile counts as that profile — and an entry whose player has been
deleted is keyed by the entry itself.
"""
from ..models import MatchStatistic, TournamentEntry
from .placement import match_win_counts, placement_tiers


def _key(entry) -> tuple:
    if entry.player_id is None:
        return ('entry', entry.id)
    return ('player', entry.player.merged_into_id or entry.player_id)


def _name(entry) -> str:
    """A linked słup shows under the profile's name; otherwise the name the
    player had in that tournament."""
    if entry.player_id and entry.player.merged_into_id:
        return entry.player.merged_into.display_name
    return entry.display_name


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

        entries = {
            e.id: e for e in
            TournamentEntry.objects.filter(tournament=tournament).select_related('player__merged_into')
        }
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
            key = _key(entry)
            row = totals.setdefault(key, {
                'player_id': key[1] if key[0] == 'player' else None, 'player_name': _name(entry),
                'total_points': 0, 'points_by_event': {},
            })
            row['player_name']   = _name(entry)  # latest name wins
            row['total_points'] += points
            row['points_by_event'][event.id] = row['points_by_event'].get(event.id, 0) + points

    return sorted(totals.values(), key=lambda r: r['total_points'], reverse=True)
