"""
Propagates entries through the bracket graph.

A match slot is either seeded with an entry at draw time or has a `source`
(winner/loser of another match, place N in a group). `resolve_tournament`
runs to a fixpoint: it fills every slot whose source is now known, turns a
match with an empty side into a bye (auto-advancing the other side), and
recomputes `Tournament.is_active`. It is the single place where advancement
happens — results, group advancement and generation all call it.
"""
from .standings import group_standings

FILLED, EMPTY, WAITING = 'filled', 'empty', 'waiting'
SETTLED = ('finished', 'bye')


def _group_places(tournament) -> dict:
    """{(stage_order, group_label): [entry_id, …] in table order} for every
    group stage the organizer has already advanced."""
    places = {}
    for stage in tournament.stages.filter(kind='groups').prefetch_related('groups__members', 'groups__matches'):
        if not stage.config.get('advanced'):
            continue
        for group in stage.groups.all():
            table = group_standings(group.members.all(), group.matches.all())
            places[(stage.order, group.label)] = [row.entry_id for row in table]
    return places


def _source_entry(source, by_code, places):
    if not source:
        return None
    kind = source.get('kind')
    if kind in ('winner', 'loser'):
        other = by_code.get(source.get('match'))
        if other is None or not other.winner:
            return None
        if kind == 'loser':
            if other.status != 'finished':
                return None  # a bye has no loser
            return other.bottom_entry_id if other.winner == 'top' else other.top_entry_id
        return other.top_entry_id if other.winner == 'top' else other.bottom_entry_id
    if kind == 'group':
        table = places.get((source.get('stage', 0), source.get('group')))
        place = source.get('place', 0)
        if table is not None and 1 <= place <= len(table):
            return table[place - 1]
    return None


def _side_state(match, side, by_code, places) -> str:
    if getattr(match, f'{side}_entry_id'):
        return FILLED
    source = getattr(match, f'{side}_source')
    if not source:
        return EMPTY
    kind = source.get('kind')
    if kind in ('winner', 'loser'):
        other = by_code.get(source.get('match'))
        if other is None:
            return EMPTY
        if other.status == 'bye' and (kind == 'loser' or not other.winner):
            return EMPTY
        return WAITING
    if kind == 'group':
        # Advanced but the group was too small to have this place → nobody comes.
        if (source.get('stage', 0), source.get('group')) in places:
            return EMPTY
        return WAITING
    return EMPTY


def resolve_tournament(tournament) -> list:
    """Advance everything that can advance; returns the matches it changed."""
    matches = list(tournament.matches.all())
    by_code = {m.code: m for m in matches}
    places  = _group_places(tournament)
    dirty   = {}

    changed = True
    while changed:
        changed = False
        for m in matches:
            if m.status in SETTLED:
                continue
            for side in ('top', 'bottom'):
                if getattr(m, f'{side}_entry_id') is None:
                    entry_id = _source_entry(getattr(m, f'{side}_source'), by_code, places)
                    if entry_id is not None:
                        setattr(m, f'{side}_entry_id', entry_id)
                        dirty[m.pk] = m
                        changed = True

            top    = _side_state(m, 'top', by_code, places)
            bottom = _side_state(m, 'bottom', by_code, places)
            if WAITING in (top, bottom) or (top == FILLED and bottom == FILLED):
                continue
            m.status = 'bye'
            m.winner = 'top' if top == FILLED else 'bottom' if bottom == FILLED else ''
            dirty[m.pk] = m
            changed = True

    if dirty:
        type(matches[0]).objects.bulk_update(dirty.values(), ['top_entry', 'bottom_entry', 'status', 'winner'])

    is_active = any(m.status not in SETTLED for m in matches)
    if tournament.is_active != is_active:
        tournament.is_active = is_active
        tournament.save(update_fields=['is_active'])

    return list(dirty.values())
