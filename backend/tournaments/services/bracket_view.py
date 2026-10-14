"""
Builds the legacy `bracket` JSON (src/types/bracket.ts BracketData) from the
normalized models, so the existing bracket UI keeps rendering unchanged while
writes go through the command endpoints. Extra fields the old JSON didn't
have: match `status` / `matchFormat`, slot `entryId`, group `standings`.
"""
from .common import avg_to_sigma
from .generation import phase_configs_of
from .standings import group_standings

EMPTY_SLOT = {'playerId': None, 'playerName': None, 'playerAvg': None, 'isCpu': False}


def _slot(entry) -> dict:
    if entry is None:
        return dict(EMPTY_SLOT)
    avg = float(entry.average_snapshot)
    slot = {
        # A deleted player's entry keeps a stable non-null id so the UI still
        # treats the slot as occupied.
        'playerId':   entry.player_id if entry.player_id is not None else -entry.id,
        'playerName': entry.display_name,
        'playerAvg':  avg,
        'isCpu':      entry.is_cpu,
        'entryId':    entry.id,
    }
    if entry.is_cpu:
        slot['cpuSigma'] = avg_to_sigma(avg)
    return slot


def _result(match, match_format) -> dict:
    top, bottom = match.top_score or 0, match.bottom_score or 0
    if match_format.get('sets', 1) == 1:
        top_sets, bottom_sets = (1, 0) if match.winner == 'top' else (0, 1)
    else:
        top_sets, bottom_sets = top, bottom
    return {
        'topSetsWon':    top_sets,
        'bottomSetsWon': bottom_sets,
        'displayScore':  f'{top}–{bottom}',
        'winner':        match.winner,
    }


def _match(match, entries, match_format) -> dict:
    data = {
        'id':          match.code,
        'top':         _slot(entries.get(match.top_entry_id)),
        'bottom':      _slot(entries.get(match.bottom_entry_id)),
        'status':      match.status,
        'matchFormat': match_format,
    }
    if match.status == 'finished':
        data['result'] = _result(match, match_format)
    if match.legs:
        data['legs'] = match.legs
    if match.current_leg:
        data['currentLeg'] = match.current_leg
    return data


def _round(rnd, entries, stage_format, phase_configs) -> dict:
    fmt = rnd.match_format or stage_format
    data = {'id': rnd.code, 'label': rnd.label}
    pc = phase_configs.get(rnd.code, {})
    if pc.get('date'):
        data['date'] = pc['date']
    if rnd.match_format:
        data['matchFormat'] = rnd.match_format
    data['matches'] = [_match(m, entries, fmt) for m in rnd.matches.all()]
    return data


def build_bracket(tournament) -> dict:
    entries = {e.id: e for e in tournament.entries.all()}
    stages  = list(
        tournament.stages.order_by('order').prefetch_related('groups__members', 'groups__matches', 'rounds__matches')
    )
    phase_configs = phase_configs_of(tournament)
    default_fmt   = tournament.match_format

    data = {
        'format':      tournament.format,
        'name':        tournament.name,
        'playerCount': len(entries),
        'matchFormat': default_fmt,
    }
    if phase_configs:
        data['phaseConfigs'] = phase_configs

    if tournament.format == 'knockout':
        stage = stages[0] if stages else None
        data['rounds'] = [_round(r, entries, default_fmt, phase_configs) for r in stage.rounds.all()] if stage else []
        return data

    group_stage = next((s for s in stages if s.kind == 'groups'), None)
    playoff     = next((s for s in stages if s.kind == 'knockout'), None)
    group_fmt   = (group_stage.match_format if group_stage else None) or default_fmt
    group_size  = group_stage.config.get('group_size', 4) if group_stage else 4
    data['matchFormat'] = group_fmt
    if tournament.board_count:
        data['board_count'] = tournament.board_count

    groups = []
    for group in (group_stage.groups.all() if group_stage else []):
        members = list(group.members.all())
        matches = list(group.matches.all())
        slots   = [_slot(entries.get(m.entry_id)) for m in members]
        slots  += [dict(EMPTY_SLOT) for _ in range(group_size - len(slots))]
        g = {
            'id':        f'group-{group.order}',
            'label':     group.label,
            'slots':     slots,
            'matches':   [_match(m, entries, group_fmt) for m in matches],
            'standings': [
                {
                    'entryId': row.entry_id, 'played': row.played, 'wins': row.wins, 'losses': row.losses,
                    'legsFor': row.legs_for, 'legsAgainst': row.legs_against, 'points': row.points,
                }
                for row in group_standings(members, matches)
            ],
        }
        if group.board:
            g['board'] = group.board
        groups.append(g)
    data['groups'] = groups

    # The playoff structure exists from creation, but the UI only shows it once
    # the organizer has confirmed advancement from the groups.
    if playoff and group_stage and group_stage.config.get('advanced'):
        data['playoff'] = {'rounds': [_round(r, entries, default_fmt, phase_configs) for r in playoff.rounds.all()]}
    return data
