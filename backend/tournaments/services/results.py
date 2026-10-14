"""Recording match results and live leg state."""
from django.db import transaction
from django.utils import timezone

from ..models import Match, Stage, Tournament
from .common import ConflictError, TournamentError, resolve_match_format, score_to_win
from .progress import resolve_tournament
from .standings import is_group_complete


def _lock(match) -> tuple[Tournament, Match]:
    """Serialize every write that can move entries through one tournament's
    bracket by locking its row; then re-read the match under that lock."""
    tournament = Tournament.objects.select_for_update().get(pk=match.tournament_id)
    match = Match.objects.select_related('stage', 'round').get(pk=match.pk)
    match.tournament = tournament
    return tournament, match


def validate_score(match, top_score, bottom_score) -> None:
    if not all(isinstance(v, int) and not isinstance(v, bool) and v >= 0 for v in (top_score, bottom_score)):
        raise TournamentError({'score': 'Wynik musi składać się z nieujemnych liczb całkowitych.'})
    target = score_to_win(resolve_match_format(match))
    if not ((top_score == target and bottom_score < target) or (bottom_score == target and top_score < target)):
        raise TournamentError({'score': f'Zwycięzca musi mieć dokładnie {target}, przegrany mniej.'})


def record_result(match, *, top_score: int, bottom_score: int, legs=None, live: bool = False) -> Match:
    """
    Decides a match and advances the bracket.

    - A decided result is locked: resending the identical score is an
      idempotent no-op (optionally attaching leg details), anything else is
      a conflict.
    - `live=True` comes from the live-scoring screen, which owns the match's
      `current_leg`. Any other caller (Symuluj / Wpisz wynik from a second
      device) is rejected while a bot-vs-bot live simulation holds it.
    """
    with transaction.atomic():
        tournament, match = _lock(match)

        if not tournament.bracket_confirmed:
            raise ConflictError('Drabinka nie jest jeszcze zatwierdzona.')
        if match.status == 'bye':
            raise ConflictError('To jest wolny los — nie ma meczu do rozegrania.')
        if not (match.top_entry_id and match.bottom_entry_id):
            raise ConflictError('Mecz nie ma jeszcze obu graczy.')

        if match.status == 'finished':
            if (match.top_score, match.bottom_score) != (top_score, bottom_score):
                raise ConflictError(f'Wynik meczu {match.code} jest już zapisany i nie może zostać zmieniony.')
            if legs is not None:
                match.legs = legs
                match.save(update_fields=['legs', 'updated_at'])
            return match

        validate_score(match, top_score, bottom_score)

        if match.current_leg and not live and match.top_entry.is_cpu and match.bottom_entry.is_cpu:
            raise ConflictError(f'Mecz {match.code} jest właśnie symulowany na żywo.')

        match.top_score    = top_score
        match.bottom_score = bottom_score
        match.winner       = 'top' if top_score > bottom_score else 'bottom'
        match.status       = 'finished'
        match.finished_at  = timezone.now()
        match.current_leg  = None
        if legs is not None:
            match.legs = legs
        match.save()

        resolve_tournament(tournament)
    return match


def save_legs(match, *, legs, current_leg) -> Match:
    """Live-scoring progress. A decided match never takes a `current_leg`
    back — a late in-flight update must not make it look live again."""
    with transaction.atomic():
        _, match = _lock(match)
        match.legs = legs or []
        if match.status == 'finished':
            match.current_leg = None
        else:
            match.current_leg = current_leg
            if match.status == 'pending' and (match.legs or current_leg):
                match.status = 'live'
        match.save(update_fields=['legs', 'current_leg', 'status', 'updated_at'])
    return match


def advance_groups(stage: Stage) -> None:
    """Organizer confirms the group tables: fills every playoff slot sourced
    from this stage's group places."""
    with transaction.atomic():
        tournament = Tournament.objects.select_for_update().get(pk=stage.tournament_id)
        stage = Stage.objects.get(pk=stage.pk)
        if stage.kind != 'groups':
            raise TournamentError('Awans dotyczy tylko fazy grupowej.')
        if stage.config.get('advanced'):
            raise ConflictError('Awans z grup został już zatwierdzony.')
        if not is_group_complete(stage.matches.all()):
            raise ConflictError('Nie wszystkie mecze grupowe są rozegrane.')
        stage.config = {**stage.config, 'advanced': True}
        stage.save(update_fields=['config'])
        resolve_tournament(tournament)
