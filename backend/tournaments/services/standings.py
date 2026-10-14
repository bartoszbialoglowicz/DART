"""Group tables."""
from dataclasses import dataclass, field

POINTS_PER_WIN = 2


@dataclass
class StandingRow:
    entry_id:     int
    played:       int = 0
    wins:         int = 0
    losses:       int = 0
    legs_for:     int = 0
    legs_against: int = 0
    points:       int = 0
    position:     int = field(default=0, repr=False)  # draw position, last tie-breaker

    @property
    def legs_diff(self) -> int:
        return self.legs_for - self.legs_against


def group_standings(members, matches) -> list[StandingRow]:
    """
    members: GroupMember rows of one group; matches: that group's Match rows.
    Sorted by points, then leg difference, then legs won, then draw position.
    Scores are the match headline score (legs in a single-set format), not
    the 1/0 set count the old client-side table summed up.
    """
    rows = {m.entry_id: StandingRow(entry_id=m.entry_id, position=m.position) for m in members}
    for match in matches:
        if match.status != 'finished':
            continue
        top, bottom = rows.get(match.top_entry_id), rows.get(match.bottom_entry_id)
        ts, bs = match.top_score or 0, match.bottom_score or 0
        for row, own, opp, won in ((top, ts, bs, match.winner == 'top'), (bottom, bs, ts, match.winner == 'bottom')):
            if row is None:
                continue
            row.played       += 1
            row.legs_for     += own
            row.legs_against += opp
            if won:
                row.wins   += 1
                row.points += POINTS_PER_WIN
            else:
                row.losses += 1
    return sorted(rows.values(), key=lambda r: (-r.points, -r.legs_diff, -r.legs_for, r.position))


def is_group_complete(matches) -> bool:
    return all(m.status in ('finished', 'bye') for m in matches)
