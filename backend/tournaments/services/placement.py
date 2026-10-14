"""Final placements and win counts — inputs to cycle standings."""


def placement_tiers(tournament) -> dict[int, str]:
    """
    {entry_id: tier}, tier in {'winner','final','semifinal','quarterfinal','other'}.
    A knockout loser gets their round's stored `tier`; the winner of a 'final'
    round is 'winner'. Group-stage players who never reached a knockout stage
    are 'other'.
    """
    tiers: dict[int, str] = {}
    stages = list(tournament.stages.order_by('order').prefetch_related('groups__members', 'rounds__matches'))

    knockout_entries = set()
    for stage in stages:
        if stage.kind != 'knockout':
            continue
        for rnd in stage.rounds.all():
            for m in rnd.matches.all():
                knockout_entries.update(e for e in (m.top_entry_id, m.bottom_entry_id) if e)

    for stage in stages:
        if stage.kind == 'groups':
            for group in stage.groups.all():
                for member in group.members.all():
                    if member.entry_id not in knockout_entries:
                        tiers[member.entry_id] = 'other'
            continue
        for rnd in stage.rounds.all():
            for m in rnd.matches.all():
                if m.status != 'finished':
                    continue
                winner, loser = (
                    (m.top_entry_id, m.bottom_entry_id) if m.winner == 'top' else (m.bottom_entry_id, m.top_entry_id)
                )
                if loser:
                    tiers[loser] = rnd.tier
                if rnd.tier == 'final' and winner:
                    tiers[winner] = 'winner'
    return tiers


def match_win_counts(tournament) -> dict[int, int]:
    """{entry_id: matches won} across the whole tournament (byes don't count)."""
    wins: dict[int, int] = {}
    for m in tournament.matches.filter(status='finished'):
        winner = m.top_entry_id if m.winner == 'top' else m.bottom_entry_id
        if winner:
            wins[winner] = wins.get(winner, 0) + 1
    return wins
