"""
Tournament creation and draw — the server-side port of src/utils/bracket.ts
(generateBracket / redrawBracket / generatePlayoffFromGroups).

The whole structure, including the playoff of a group tournament, is created
up front; slots that depend on results carry a `source` and get filled by
progress.resolve_tournament.
"""
import random
from dataclasses import dataclass

from django.db import transaction
from django.db.models import Q

from players.models import Player

from ..models import Group, GroupMember, Match, Round, Stage, Tournament, TournamentEntry
from .common import (
    TournamentError, ConflictError, format_phase_datetime, next_power_of_2,
    parse_phase_datetime, round_label, round_tier,
)
from .progress import resolve_tournament

GROUP_SIZE_OPTIONS        = (3, 4, 5)
PLAYOFF_ADVANCE_PER_GROUP = 2

# Predefined match order per group size — interleaved so no player plays
# back-to-back more than once. Indices are positions within the group.
GROUP_MATCH_ORDER = {
    3: [(0, 2), (1, 2), (0, 1)],
    4: [(0, 2), (1, 3), (0, 3), (1, 2), (0, 1), (2, 3)],
    5: [(0, 2), (1, 3), (0, 4), (2, 3), (1, 4), (0, 3), (2, 4), (0, 1), (3, 4), (1, 2)],
}


@dataclass(frozen=True)
class EntrySpec:
    """A roster line from the wizard: an existing player, or just a name."""
    player_id: int | None = None
    name:      str | None = None


# ── Validation / entries ──────────────────────────────────────────────────────

def _validate_match_format(fmt, field='match_format') -> dict:
    if not isinstance(fmt, dict):
        raise TournamentError({field: 'Nieprawidłowy format meczu.'})
    sets, legs = fmt.get('sets'), fmt.get('legs')
    if not all(isinstance(v, int) and not isinstance(v, bool) and v >= 1 for v in (sets, legs)):
        raise TournamentError({field: 'Sety i legi muszą być liczbą ≥ 1.'})
    clean = {'sets': sets, 'legs': legs}
    max_darts = fmt.get('max_darts_per_leg')
    if max_darts is not None:
        if not isinstance(max_darts, int) or max_darts < 3 or max_darts % 3:
            raise TournamentError({field: 'Limit lotek musi być wielokrotnością 3.'})
        clean['max_darts_per_leg'] = max_darts
    return clean


def _clean_phase_configs(phase_configs) -> dict:
    clean = {}
    for code, pc in (phase_configs or {}).items():
        if not isinstance(pc, dict):
            continue
        item = {}
        if pc.get('date'):
            item['date'] = pc['date']
        if pc.get('matchFormat'):
            item['matchFormat'] = _validate_match_format(pc['matchFormat'], f'phase_configs.{code}')
        clean[code] = item
    return clean


def _split_name(name: str) -> tuple[str, str]:
    first, _, last = name.strip().partition(' ')
    return first, last.strip()


def _resolve_entries(owner, specs: list[EntrySpec]) -> list[Player]:
    """Existing players the owner may use, plus a new account-less Player
    ("słup") owned by the organizer for every name-only line."""
    ids = [s.player_id for s in specs if s.player_id is not None]
    if len(ids) != len(set(ids)):
        raise TournamentError({'entries': 'Ten sam gracz został dodany więcej niż raz.'})
    visible = Player.objects.filter(Q(cpu=False) | Q(cpu=True, owner=owner))
    found   = {p.pk: p for p in visible.filter(pk__in=ids)}
    missing = [pid for pid in ids if pid not in found]
    if missing:
        raise TournamentError({'entries': f'Nieznani gracze: {", ".join(map(str, missing))}.'})

    players = []
    for spec in specs:
        if spec.player_id is not None:
            players.append(found[spec.player_id])
            continue
        name = (spec.name or '').strip()
        if not name:
            raise TournamentError({'entries': 'Gracz bez konta musi mieć imię.'})
        first, last = _split_name(name)
        players.append(Player.objects.create(owner=owner, first_name=first, last_name=last, cpu=False))
    return players


def _entry_for(tournament, player: Player) -> TournamentEntry:
    return TournamentEntry(
        tournament=tournament,
        player=player,
        display_name=' '.join(filter(None, [player.first_name, player.last_name])),
        average_snapshot=player.average,
        is_cpu=player.cpu,
    )


# ── Structure builders ────────────────────────────────────────────────────────

def _create_rounds(stage, num_rounds: int, code_prefix: str, phase_configs: dict) -> list[Round]:
    rounds = []
    for i in range(num_rounds):
        code = f'{code_prefix}{i}'
        pc   = phase_configs.get(code, {})
        rounds.append(Round(
            stage=stage, order=i, code=code,
            label=round_label(i, num_rounds),
            tier=round_tier(i, num_rounds),
            starts_at=parse_phase_datetime(pc.get('date')),
            match_format=pc.get('matchFormat'),
        ))
    return Round.objects.bulk_create(rounds)


def _create_knockout_matches(tournament, stage, rounds, first_round) -> None:
    """first_round: [(top, bottom)] where each side is a TournamentEntry, a
    source dict, or None (bye). Later rounds take the winners pairwise."""
    matches = []
    for ri, rnd in enumerate(rounds):
        for mi in range(len(first_round) // (2 ** ri)):
            m = Match(tournament=tournament, stage=stage, round=rnd, code=f'r{ri}-m{mi}', order=mi)
            if ri == 0:
                for side, value in zip(('top', 'bottom'), first_round[mi]):
                    if isinstance(value, TournamentEntry):
                        setattr(m, f'{side}_entry', value)
                    elif value is not None:
                        setattr(m, f'{side}_source', value)
            else:
                m.top_source    = {'kind': 'winner', 'match': f'r{ri - 1}-m{mi * 2}'}
                m.bottom_source = {'kind': 'winner', 'match': f'r{ri - 1}-m{mi * 2 + 1}'}
            matches.append(m)
    Match.objects.bulk_create(matches)


def seed_positions(size: int) -> list[int]:
    """Standard bracket order of seed numbers: 8 → [1, 8, 4, 5, 2, 7, 3, 6].
    Pairs are (s, size + 1 - s), and seeds 1 and 2 sit in opposite halves,
    1–4 in different quarters… — so the top seeds meet as late as possible."""
    order = [1]
    while len(order) < size:
        n = len(order) * 2
        order = [x for s in order for x in (s, n + 1 - s)]
    return order


def _place_by_seed(seeded: list, size: int) -> list[tuple]:
    """First-round pairs for `seeded` (index 0 = seed 1). Missing seeds
    (len(seeded)+1 … size) are byes, so byes go to the top seeds and are
    spread across the bracket — two byes never share a first-round match and
    bye players only meet in round 2 when there are too many to avoid it."""
    slots = [seeded[s - 1] if s <= len(seeded) else None for s in seed_positions(size)]
    return list(zip(slots[0::2], slots[1::2]))


def _knockout_first_round(entries: list[TournamentEntry], rng) -> list[tuple]:
    """Random draw: players get seed numbers by lot, then standard positions."""
    return _place_by_seed(rng.sample(entries, len(entries)), next_power_of_2(len(entries)))


def _build_knockout(tournament, entries, phase_configs, rng) -> None:
    size  = next_power_of_2(len(entries))
    stage = Stage.objects.create(tournament=tournament, order=0, kind='knockout', label='Drabinka', config={'size': size})
    rounds = _create_rounds(stage, size.bit_length() - 1, 'round-', phase_configs)
    _create_knockout_matches(tournament, stage, rounds, _knockout_first_round(entries, rng))


def _group_pairs(n: int) -> list[tuple[int, int]]:
    if n in GROUP_MATCH_ORDER:
        return GROUP_MATCH_ORDER[n]
    return [(i, j) for i in range(n - 1) for j in range(i + 1, n)]


def _playoff_seeds(labels: list[str]) -> list[dict]:
    """Playoff seed list: group winners first (seeds 1…g, so any byes go to
    them), then runners-up. The runners-up order is the first rotation that
    keeps two players from the same group apart in the first round — for a
    power-of-two group count that's the classic cross-seed (A1 vs the last
    group's runner-up, B1 vs the one before…)."""
    def src(label, place):
        return {'kind': 'group', 'stage': 0, 'group': label, 'place': place}

    g, winners = len(labels), [src(label, 1) for label in labels]
    size = next_power_of_2(2 * g)
    best = None
    for r in range(g):
        runners = [src(label, 2) for label in labels[r:] + labels[:r]]
        seeds   = winners + runners
        clashes = sum(
            1 for a, b in _place_by_seed(seeds, size)
            if a and b and a['group'] == b['group']
        )
        if best is None or clashes < best[0]:
            best = (clashes, seeds)
        if clashes == 0:
            break
    return best[1]


def _build_groups(tournament, entries, group_size, phase_configs, rng) -> None:
    pc_groups   = phase_configs.get('groups', {})
    group_stage = Stage.objects.create(
        tournament=tournament, order=0, kind='groups', label='Faza grupowa',
        match_format=pc_groups.get('matchFormat'),
        starts_at=parse_phase_datetime(pc_groups.get('date')),
        config={'group_size': group_size, 'advance_per_group': PLAYOFF_ADVANCE_PER_GROUP},
    )

    seeded      = rng.sample(entries, len(entries))
    group_count = max(1, -(-len(entries) // group_size))
    matches     = []
    for gi in range(group_count):
        members = seeded[gi * group_size:(gi + 1) * group_size]
        group = Group.objects.create(
            stage=group_stage, order=gi, label=chr(65 + gi),
            board=(gi % tournament.board_count) + 1 if tournament.board_count else None,
        )
        GroupMember.objects.bulk_create(
            GroupMember(group=group, entry=e, position=pos) for pos, e in enumerate(members)
        )
        for idx, (i, j) in enumerate(_group_pairs(len(members))):
            matches.append(Match(
                tournament=tournament, stage=group_stage, group=group,
                code=f'group-{gi}-m{idx}', order=idx,
                top_entry=members[i], bottom_entry=members[j],
            ))
    Match.objects.bulk_create(matches)

    seeds = _playoff_seeds([chr(65 + gi) for gi in range(group_count)])
    size  = next_power_of_2(len(seeds))

    playoff = Stage.objects.create(tournament=tournament, order=1, kind='knockout', label='Playoff', config={'size': size})
    rounds  = _create_rounds(playoff, size.bit_length() - 1, 'r', phase_configs)
    _create_knockout_matches(tournament, playoff, rounds, _place_by_seed(seeds, size))


def _build_structure(tournament, entries, group_size, phase_configs, rng) -> None:
    if tournament.format == 'knockout':
        _build_knockout(tournament, entries, phase_configs, rng)
    else:
        _build_groups(tournament, entries, group_size, phase_configs, rng)
    resolve_tournament(tournament)


# ── Public API ────────────────────────────────────────────────────────────────

def create_tournament(
    *, owner, name: str, format: str, match_format: dict, entries: list[EntrySpec],
    group_size: int = 4, phase_configs: dict | None = None, board_count: int | None = None,
    is_private: bool = False, start_date=None, rng: random.Random | None = None,
) -> Tournament:
    name = (name or '').strip()
    if not name:
        raise TournamentError({'name': 'Nazwa turnieju jest wymagana.'})
    if format not in dict(Tournament.FORMAT_CHOICES):
        raise TournamentError({'format': 'Nieznany format turnieju.'})
    if format == 'groups' and group_size not in GROUP_SIZE_OPTIONS:
        raise TournamentError({'group_size': f'Rozmiar grupy musi być jednym z {GROUP_SIZE_OPTIONS}.'})
    if len(entries) < 2:
        raise TournamentError({'entries': 'Turniej wymaga co najmniej 2 graczy.'})
    match_format  = _validate_match_format(match_format)
    phase_configs = _clean_phase_configs(phase_configs)
    rng           = rng or random.Random()

    if start_date is None:
        first_phase = phase_configs.get('round-0') or phase_configs.get('groups') or {}
        start_date  = parse_phase_datetime(first_phase.get('date'))

    with transaction.atomic():
        players    = _resolve_entries(owner, entries)
        tournament = Tournament.objects.create(
            owner=owner, name=name, format=format, match_format=match_format,
            board_count=board_count or None, is_private=is_private, start_date=start_date,
        )
        created = TournamentEntry.objects.bulk_create(_entry_for(tournament, p) for p in players)
        _build_structure(tournament, created, group_size, phase_configs, rng)
    return tournament


def phase_configs_of(tournament) -> dict:
    """The wizard's `phaseConfigs` dict, rebuilt from stages and rounds."""
    configs = {}

    def put(code, starts_at, match_format):
        item = {}
        if starts_at:
            item['date'] = format_phase_datetime(starts_at)
        if match_format:
            item['matchFormat'] = match_format
        if item:
            configs[code] = item

    for stage in tournament.stages.prefetch_related('rounds'):
        if stage.kind == 'groups':
            put('groups', stage.starts_at, stage.match_format)
        for rnd in stage.rounds.all():
            put(rnd.code, rnd.starts_at, rnd.match_format)
    return configs


def redraw(tournament, rng: random.Random | None = None) -> Tournament:
    """New random draw of the same roster — only while the bracket is a draft."""
    with transaction.atomic():
        tournament = Tournament.objects.select_for_update().get(pk=tournament.pk)
        if tournament.bracket_confirmed:
            raise ConflictError('Drabinka jest już zatwierdzona — nie można jej ponownie wylosować.')
        phase_configs = phase_configs_of(tournament)
        group_stage   = tournament.stages.filter(kind='groups').first()
        group_size    = group_stage.config.get('group_size', 4) if group_stage else 4
        entries       = list(tournament.entries.order_by('id'))
        tournament.stages.all().delete()
        _build_structure(tournament, entries, group_size, phase_configs, rng or random.Random())
    return tournament
