"""
Compares every tournament's legacy `bracket` JSON with the bracket rebuilt
from the normalized models (services.bracket_view) — the acceptance check for
migration 0014. Differences caused by the intentional bye fix are counted
separately from real mismatches.
"""
from collections import Counter

from django.core.management.base import BaseCommand

from tournaments.models import MatchStatistic, Tournament, TournamentCycle, compute_cycle_standings_from_json
from tournaments.services.cycles import compute_cycle_standings
from tournaments.services.bracket_view import build_bracket


def _matches(bracket):
    for rnd in bracket.get('rounds') or []:
        yield from rnd.get('matches', [])
    for group in bracket.get('groups') or []:
        yield from group.get('matches') or []
    for rnd in (bracket.get('playoff') or {}).get('rounds') or []:
        yield from rnd.get('matches', [])


def _score(result):
    return str(result.get('displayScore', '')).replace('-', '–').replace(' ', '')


def _name(slot):
    return (slot or {}).get('playerName') or None


class Command(BaseCommand):
    help = 'Porównuje drabinki JSON z drabinkami zbudowanymi z modeli.'

    def add_arguments(self, parser):
        parser.add_argument('--verbose-diffs', action='store_true', help='Wypisz każdą różnicę.')

    def handle(self, *args, verbose_diffs=False, **options):
        totals = Counter()
        for t in Tournament.objects.order_by('pk'):
            old = {m['id']: m for m in _matches(t.bracket or {})}
            new = {m['id']: m for m in _matches(build_bracket(t))}
            diffs = []

            for code, o in old.items():
                n = new.get(code)
                if n is None:
                    diffs.append(('missing', code, ''))
                    continue
                for side in ('top', 'bottom'):
                    if _name(o.get(side)) != _name(n.get(side)):
                        kind = 'bye-advance' if _name(o.get(side)) is None else 'slot'
                        diffs.append((kind, code, f'{side}: {_name(o.get(side))!r} → {_name(n.get(side))!r}'))
                o_res, n_res = o.get('result'), n.get('result')
                if bool(o_res) != bool(n_res) or (o_res and (
                    o_res.get('winner') != n_res.get('winner') or _score(o_res) != _score(n_res)
                )):
                    diffs.append(('result', code, f'{o_res} → {n_res}'))
                elif not o_res and n.get('status') == 'bye':
                    diffs.append(('bye', code, ''))
            for code in new.keys() - old.keys():
                diffs.append(('extra', code, ''))

            kinds = Counter(k for k, _, _ in diffs)
            totals.update(kinds)
            real = {k: v for k, v in kinds.items() if k not in ('bye', 'bye-advance')}
            if real or verbose_diffs and diffs:
                style = self.style.ERROR if real else self.style.WARNING
                self.stdout.write(style(f'#{t.pk} {t.name}: {dict(kinds)}'))
                if verbose_diffs or real:
                    for kind, code, detail in diffs:
                        if verbose_diffs or kind not in ('bye', 'bye-advance'):
                            self.stdout.write(f'    {kind:12} {code:14} {detail}')

        for cycle in TournamentCycle.objects.order_by('pk'):
            def table(rows):
                return {(r['player_id'] if r['player_id'] and r['player_id'] > 0 else r['player_name']): r['total_points'] for r in rows}
            old, new = table(compute_cycle_standings_from_json(cycle)), table(compute_cycle_standings(cycle))
            if old == new:
                self.stdout.write(f'Cykl #{cycle.pk} {cycle.name}: punktacja zgodna ({len(new)} graczy)')
            else:
                totals['cycle'] += 1
                self.stdout.write(self.style.ERROR(f'Cykl #{cycle.pk} {cycle.name}: punktacja różna'))
                for key in sorted(old.keys() | new.keys(), key=str):
                    if old.get(key) != new.get(key):
                        self.stdout.write(f'    {key!s:20} {old.get(key)} → {new.get(key)}')

        orphans = MatchStatistic.objects.filter(match__isnull=True).count()
        self.stdout.write('')
        self.stdout.write(f'Turnieje: {Tournament.objects.count()}  różnice: {dict(totals)}  '
                          f'statystyki bez meczu: {orphans}')
        bad = sum(v for k, v in totals.items() if k not in ('bye', 'bye-advance'))
        self.stdout.write(self.style.SUCCESS('OK — tylko zamierzone różnice (wolne losy).') if not bad
                          else self.style.ERROR(f'{bad} nieoczekiwanych różnic.'))
