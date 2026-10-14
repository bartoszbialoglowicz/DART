"""
One-off conversion of the legacy `Tournament.bracket` JSON into the
normalized structure (entries, stages, groups, rounds, matches).

Used only by migration 0014, with historical models — the live
`Tournament` no longer has a `bracket` field (renamed in 0015, dropped
in 0016) and MatchLeg is gone, so don't call this with the real models.
Slots are copied exactly as the JSON has them — advancement was already
applied client-side — and the graph sources are rebuilt on top so future
results advance through the server. Match ids are kept as `Match.code`.
"""
import re
from dataclasses import dataclass, field

ROUND_TIERS_FROM_END = {0: 'final', 1: 'semifinal', 2: 'quarterfinal'}
DEFAULT_FORMAT = {'sets': 1, 'legs': 3}


@dataclass
class ImportReport:
    tournaments:      int = 0
    entries:          int = 0
    guest_players:    int = 0
    matches:          int = 0
    stats_linked:     int = 0
    orphan_stats:     list = field(default_factory=list)  # (tournament_id, stat_id, reason)
    warnings:         list = field(default_factory=list)

    def merge(self, other: 'ImportReport') -> None:
        for name in ('tournaments', 'entries', 'guest_players', 'matches', 'stats_linked'):
            setattr(self, name, getattr(self, name) + getattr(other, name))
        self.orphan_stats += other.orphan_stats
        self.warnings     += other.warnings


def _tier(index, total):
    return ROUND_TIERS_FROM_END.get(total - 1 - index, 'other')


def _next_power_of_2(n):
    size = 2
    while size < n:
        size *= 2
    return size


def _parse_dt(value):
    from tournaments.services.common import parse_phase_datetime
    return parse_phase_datetime(value)


def _scores(result):
    """Headline score from displayScore ('3–1'); falls back to the set count."""
    parts = re.split(r'\s*[–-]\s*', str(result.get('displayScore', '')).strip())
    if len(parts) == 2 and all(p.isdigit() for p in parts):
        return int(parts[0]), int(parts[1])
    return int(result.get('topSetsWon') or 0), int(result.get('bottomSetsWon') or 0)


class _Importer:
    def __init__(self, M, tournament):
        self.M, self.t = M, tournament
        self.b = tournament.bracket or {}
        self.report = ImportReport(tournaments=1)
        self.entries: dict = {}   # identity key → TournamentEntry
        self.existing_players = {}
        self.match_legs = {ml.match_id: ml for ml in M.MatchLeg.objects.filter(tournament=tournament)}
        self.phase_configs = self.b.get('phaseConfigs') or {}

    # ── entries ──────────────────────────────────────────────────────────────

    def _key(self, slot):
        pid, name = slot.get('playerId'), (slot.get('playerName') or '').strip()
        if pid is not None and pid > 0:
            return ('id', pid)
        if pid is not None:
            return ('placeholder', pid)  # distinct placeholders stay distinct, even with equal names
        if name:
            return ('name', name)
        return None

    def entry(self, slot):
        if not slot:
            return None
        key = self._key(slot)
        if key is None:
            return None
        if key in self.entries:
            return self.entries[key]

        M, name = self.M, (slot.get('playerName') or '').strip()
        player = None
        if key[0] == 'id':
            player = M.Player.objects.filter(pk=key[1]).first()  # None = player deleted since
        else:
            first, _, last = (name or 'Gracz').partition(' ')
            player = M.Player.objects.create(
                owner_id=self.t.owner_id, first_name=first, last_name=last.strip(),
                cpu=False, average=0,
            )
            self.report.guest_players += 1

        entry = M.TournamentEntry.objects.create(
            tournament=self.t,
            player=player,
            display_name=name or (f'{player.first_name} {player.last_name}'.strip() if player else 'Gracz'),
            average_snapshot=round(float(slot.get('playerAvg') or 0), 2),
            is_cpu=bool(slot.get('isCpu')),
        )
        self.entries[key] = entry
        self.report.entries += 1
        return entry

    # ── matches ──────────────────────────────────────────────────────────────

    def make_match(self, raw, *, stage, order, rnd=None, group=None, top_source=None, bottom_source=None):
        M = self.M
        result = raw.get('result')
        ml     = self.match_legs.get(raw['id'])
        legs   = (ml.legs if ml else None) or raw.get('legs') or []
        current_leg = (ml.current_leg if ml else None) or raw.get('currentLeg')

        m = M.Match(
            tournament=self.t, stage=stage, round=rnd, group=group,
            code=raw['id'], order=order,
            top_entry=self.entry(raw.get('top')), bottom_entry=self.entry(raw.get('bottom')),
            top_source=top_source, bottom_source=bottom_source,
            legs=legs,
        )
        if result:
            m.top_score, m.bottom_score = _scores(result)
            m.winner = result.get('winner') or ('top' if m.top_score > m.bottom_score else 'bottom')
            m.status = 'finished'
            m.finished_at = self.t.updated_at
        else:
            m.current_leg = current_leg
            m.status = 'live' if (legs or current_leg) else 'pending'
        m.save()
        self.report.matches += 1
        return m

    def make_rounds(self, stage, raw_rounds, code_prefix, total):
        """Rounds as stored, padded up to `total` (a not-yet-generated playoff)."""
        rounds = []
        for i in range(total):
            raw  = raw_rounds[i] if i < len(raw_rounds) else {}
            code = raw.get('id') or f'{code_prefix}{i}'
            pc   = self.phase_configs.get(code, {})
            rounds.append(self.M.Round.objects.create(
                stage=stage, order=i, code=code,
                label=raw.get('label') or self.label(i, total),
                tier=_tier(i, total),
                starts_at=_parse_dt(raw.get('date') or pc.get('date')),
                match_format=raw.get('matchFormat') or pc.get('matchFormat'),
            ))
        return rounds

    @staticmethod
    def label(i, total):
        return {0: 'Finał', 1: 'Półfinał', 2: 'Ćwierćfinał'}.get(total - 1 - i, f'Runda {i + 1}')

    def knockout_matches(self, stage, rounds, raw_rounds, first_sources=None):
        """Creates every match of every round; for rounds missing from the JSON
        (playoff not generated yet) empty matches with sources only."""
        size = 2 ** len(rounds)
        prev_codes = None
        for ri, rnd in enumerate(rounds):
            raw_matches = raw_rounds[ri]['matches'] if ri < len(raw_rounds) else []
            count = size // (2 ** (ri + 1))
            codes = []
            for mi in range(count):
                raw = raw_matches[mi] if mi < len(raw_matches) else {'id': f'r{ri}-m{mi}'}
                if ri == 0:
                    top_src, bottom_src = (first_sources[mi] if first_sources else (None, None))
                else:
                    top_src    = {'kind': 'winner', 'match': prev_codes[mi * 2]}
                    bottom_src = {'kind': 'winner', 'match': prev_codes[mi * 2 + 1]}
                m = self.make_match(raw, stage=stage, order=mi, rnd=rnd, top_source=top_src, bottom_source=bottom_src)
                codes.append(m.code)
            prev_codes = codes

    # ── formats ──────────────────────────────────────────────────────────────

    def knockout(self):
        M, raw_rounds = self.M, self.b.get('rounds') or []
        if not raw_rounds:
            self.report.warnings.append((self.t.pk, 'drabinka bez rund'))
        stage = M.Stage.objects.create(
            tournament=self.t, order=0, kind='knockout', label='Drabinka',
            config={'size': 2 ** len(raw_rounds) if raw_rounds else 0},
        )
        rounds = self.make_rounds(stage, raw_rounds, 'round-', len(raw_rounds))
        self.knockout_matches(stage, rounds, raw_rounds)

    def groups(self):
        M = self.M
        raw_groups = self.b.get('groups') or []
        playoff    = self.b.get('playoff')
        pc_groups  = self.phase_configs.get('groups', {})
        group_size = len(raw_groups[0].get('slots') or []) if raw_groups else 4

        group_stage = M.Stage.objects.create(
            tournament=self.t, order=0, kind='groups', label='Faza grupowa',
            starts_at=_parse_dt(pc_groups.get('date')),
            config={'group_size': group_size, 'advance_per_group': 2, 'advanced': bool(playoff)},
        )
        labels = []
        for gi, raw in enumerate(raw_groups):
            label = raw.get('label') or chr(65 + gi)
            labels.append(label)
            group = M.Group.objects.create(stage=group_stage, order=gi, label=label, board=raw.get('board'))
            position = 0
            for slot in raw.get('slots') or []:
                entry = self.entry(slot)
                if entry and not M.GroupMember.objects.filter(group=group, entry=entry).exists():
                    M.GroupMember.objects.create(group=group, entry=entry, position=position)
                    position += 1
            if 'matches' not in raw:
                self.report.warnings.append((self.t.pk, f'grupa {label} bez meczów'))
            for mi, raw_match in enumerate(raw.get('matches') or []):
                self.make_match(raw_match, stage=group_stage, order=mi, group=group)

        # Playoff — same cross-seeding as the generator: A1 vs last group's 2nd…
        n = len(labels)
        seeds = []
        for gi in range(n):
            seeds.append({'kind': 'group', 'stage': 0, 'group': labels[gi], 'place': 1})
            seeds.append({'kind': 'group', 'stage': 0, 'group': labels[n - 1 - gi], 'place': 2})
        size = _next_power_of_2(max(len(seeds), 2))
        seeds += [None] * (size - len(seeds))
        first_sources = list(zip(seeds[0::2], seeds[1::2]))

        raw_rounds = (playoff or {}).get('rounds') or []
        total      = max(len(raw_rounds), size.bit_length() - 1)
        stage = M.Stage.objects.create(tournament=self.t, order=1, kind='knockout', label='Playoff', config={'size': 2 ** total})
        rounds = self.make_rounds(stage, raw_rounds, 'r', total)
        if len(first_sources) != 2 ** (total - 1):
            first_sources = None
            self.report.warnings.append((self.t.pk, 'playoff o nietypowym rozmiarze — bez źródeł grupowych'))
        self.knockout_matches(stage, rounds, raw_rounds, first_sources)

    # ── statistics ───────────────────────────────────────────────────────────

    def link_statistics(self):
        M = self.M
        matches = {m.code: m for m in M.Match.objects.filter(tournament=self.t)}
        by_player = {e.player_id: e for e in self.entries.values() if e.player_id}
        by_name: dict = {}
        for e in self.entries.values():
            by_name.setdefault(e.display_name, []).append(e)

        for stat in M.MatchStatistic.objects.filter(tournament=self.t):
            match = matches.get(stat.match_code)
            entry = by_player.get(stat.player_id) if stat.player_id else None
            if entry is None:
                candidates = by_name.get(stat.player_name, [])
                entry = candidates[0] if len(candidates) == 1 else None
            if match is None or entry is None:
                reason = 'brak meczu' if match is None else 'brak lub niejednoznaczny uczestnik'
                self.report.orphan_stats.append((self.t.pk, stat.pk, reason))
                continue
            stat.match, stat.entry = match, entry
            stat.save(update_fields=['match', 'entry'])
            self.report.stats_linked += 1

    # ── run ──────────────────────────────────────────────────────────────────

    def run(self) -> ImportReport:
        from tournaments.services.progress import resolve_tournament

        fmt = self.b.get('format') or self.t.format
        self.t.match_format = self.b.get('matchFormat') or DEFAULT_FORMAT
        self.t.board_count  = self.b.get('board_count')
        self.t.save(update_fields=['match_format', 'board_count'])

        if fmt == 'groups':
            self.groups()
        else:
            self.knockout()
        self.link_statistics()
        resolve_tournament(self.t)
        return self.report


def import_tournament(M, tournament) -> ImportReport:
    """M: namespace with Tournament, TournamentEntry, Stage, Group, GroupMember,
    Round, Match, MatchLeg, MatchStatistic and Player model classes."""
    if M.Stage.objects.filter(tournament=tournament).exists():
        return ImportReport()  # already imported — idempotent
    return _Importer(M, tournament).run()


def import_all(M) -> ImportReport:
    report = ImportReport()
    for tournament in M.Tournament.objects.order_by('pk'):
        report.merge(import_tournament(M, tournament))
    return report
