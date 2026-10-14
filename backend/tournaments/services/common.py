"""Shared helpers for the tournament domain services."""
import math

from django.utils import timezone
from django.utils.dateparse import parse_datetime


class TournamentError(Exception):
    """A request the tournament rules reject — views turn it into a 400/409."""
    status_code = 400


class ConflictError(TournamentError):
    status_code = 409


ROUND_LABELS_FROM_END = {0: 'Finał', 1: 'Półfinał', 2: 'Ćwierćfinał'}
ROUND_TIERS_FROM_END  = {0: 'final', 1: 'semifinal', 2: 'quarterfinal'}


def round_label(index: int, total: int) -> str:
    return ROUND_LABELS_FROM_END.get(total - 1 - index, f'Runda {index + 1}')


def round_tier(index: int, total: int) -> str:
    return ROUND_TIERS_FROM_END.get(total - 1 - index, 'other')


def next_power_of_2(n: int) -> int:
    return 2 ** math.ceil(math.log2(max(n, 2)))


def resolve_match_format(match) -> dict:
    """Round override → stage override → tournament default."""
    if match.round_id and match.round.match_format:
        return match.round.match_format
    if match.stage.match_format:
        return match.stage.match_format
    return match.tournament.match_format


def score_to_win(match_format: dict) -> int:
    """Headline score the winner must reach: legs in a single-set match, sets otherwise."""
    if match_format.get('sets', 1) == 1:
        return math.ceil(match_format.get('legs', 1) / 2)
    return math.ceil(match_format['sets'] / 2)


def avg_to_sigma(average: float) -> float:
    """Mirror of src/utils/dart501.ts avgToSigma — bot throw spread from its average."""
    if average <= 0 or not math.isfinite(average):
        return 55
    return (1036.2 / average) - 3.684


def parse_phase_datetime(value):
    """Wizard dates are `datetime-local` strings ('2026-06-26T00:17'), stored as
    UTC-naive the same way Tournament.start_date already is."""
    if not value:
        return None
    dt = parse_datetime(value)
    if dt is None:
        return None
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone.get_default_timezone())
    return dt


def format_phase_datetime(dt) -> str | None:
    if dt is None:
        return None
    return timezone.localtime(dt, timezone.get_default_timezone()).strftime('%Y-%m-%dT%H:%M')
