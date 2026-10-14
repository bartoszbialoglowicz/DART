"""
Who an organizer may see, and linking account-less players ("słupy") to a
registered player's profile.

Organizers never browse accounts. A registered player issues a short-lived
code and hands it to the organizer; with it the organizer can
- add the player as a contact (pick them in tournaments and leagues), and/or
- link one of their own słupy to the player's profile (history moves over).
The code is the player's consent; the organizer's action is the słup owner's.
Linking only sets `Player.merged_into`; tournament and league history is
untouched and is read through `identity_ids()` (profile + linked słupy).
"""
import re
import secrets
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone

from django.db.models import Q, QuerySet

from .models import Player, PlayerContact, PlayerLinkCode

CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  # no 0/O, 1/I
CODE_LENGTH   = 8
CODE_TTL      = timedelta(days=7)


class LinkError(Exception):
    status_code = 400


class LinkForbidden(LinkError):
    status_code = 403


# ── Identity ─────────────────────────────────────────────────────────────────

def canonical(player: Player) -> Player:
    """The profile a linked słup stands for (the player itself otherwise)."""
    return player.merged_into if player.merged_into_id else player


def identity_ids(player: Player) -> list[int]:
    """Every Player row that is this person: the profile and its linked słupy."""
    return [player.pk, *player.merged_aliases.values_list('pk', flat=True)]


def visible_players(user, *, include_linked_guests: bool = False) -> QuerySet:
    """Players this user may pick (tournament wizard, league roster): their
    own bots and account-less players, their own profile, and the registered
    players who gave them a code. Nobody else — anonymous users see no one.
    `include_linked_guests` also admits own słupy already linked to a profile
    (they resolve to that profile when used)."""
    if not user.is_authenticated:
        return Player.objects.none()
    own = Q(owner=user)
    if not include_linked_guests:
        own &= Q(merged_into__isnull=True)
    return Player.objects.filter(own | Q(user=user) | Q(contact_of__owner=user)).distinct()


# ── Codes ────────────────────────────────────────────────────────────────────

def normalize_code(raw: str) -> str:
    return re.sub(r'[^A-Z0-9]', '', (raw or '').upper())


def format_code(code: str) -> str:
    return f'{code[:4]}-{code[4:]}'


def active_code(player: Player) -> PlayerLinkCode | None:
    code = PlayerLinkCode.objects.filter(player=player).first()
    if code and code.expires_at <= timezone.now():
        return None
    return code


def issue_code(player: Player) -> PlayerLinkCode:
    """A fresh code for this profile; any previous one stops working."""
    if player.user_id is None:
        raise LinkError('Kod może wygenerować tylko gracz z kontem.')
    for _ in range(10):
        code = ''.join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
        try:
            with transaction.atomic():
                PlayerLinkCode.objects.filter(player=player).delete()
                return PlayerLinkCode.objects.create(player=player, code=code, expires_at=timezone.now() + CODE_TTL)
        except IntegrityError:
            continue  # astronomically unlikely collision — draw again
    raise LinkError('Nie udało się wygenerować kodu, spróbuj ponownie.')


def revoke_code(player: Player) -> None:
    PlayerLinkCode.objects.filter(player=player).delete()


def resolve_code(raw: str) -> Player:
    code = PlayerLinkCode.objects.select_related('player').filter(code=normalize_code(raw)).first()
    if code is None or code.expires_at <= timezone.now() or code.player.user_id is None:
        raise LinkError('Kod jest nieprawidłowy albo wygasł. Poproś gracza o nowy kod.')
    return code.player


# ── Contacts ─────────────────────────────────────────────────────────────────

def add_contact(owner, raw_code: str, *, dry_run: bool = False) -> Player:
    target = resolve_code(raw_code)
    if target.user_id == owner.pk:
        raise LinkError('To Twój własny kod.')
    if not dry_run:
        PlayerContact.objects.get_or_create(owner=owner, player=target)
    return target


def remove_contact(owner, player: Player) -> None:
    PlayerContact.objects.filter(owner=owner, player=player).delete()


# ── Linking ──────────────────────────────────────────────────────────────────

def _shared_tournament(slup: Player, target: Player):
    from tournaments.models import Tournament

    return Tournament.objects.filter(entries__player=slup).filter(
        pk__in=Tournament.objects.filter(entries__player__in=identity_ids(target)).values('pk')
    ).first()


def _sync_league_members(slup: Player) -> None:
    """A league member backed by this słup counts as registered once linked."""
    from leagues.models import LeagueMember
    LeagueMember.objects.filter(player=slup).update(status='active' if slup.merged_into_id else 'pending')


def link(owner, slup: Player, raw_code: str = '', *, contact_id: int | None = None, dry_run: bool = False) -> Player:
    """Link the organizer's słup to a registered player's profile — the one
    behind `raw_code`, or one of the organizer's contacts (`contact_id`: that
    player already gave a code). Linking with a code also makes the player a
    contact. With `dry_run` only validates and returns the target, so the
    organizer can confirm who it is before committing."""
    if slup.owner_id != owner.pk:
        raise LinkForbidden('Możesz powiązać tylko własnych graczy bez konta.')
    if slup.user_id or slup.cpu:
        raise LinkError('Powiązać można tylko gracza bez konta.')
    if slup.merged_into_id:
        raise LinkError('Ten gracz jest już powiązany z kontem.')

    if contact_id is not None:
        contact = PlayerContact.objects.select_related('player').filter(owner=owner, player_id=contact_id).first()
        if contact is None:
            raise LinkError('Tego gracza nie ma wśród Twoich graczy z kontem — poproś go o kod.')
        target = contact.player
    else:
        target = resolve_code(raw_code)
    if target.pk == slup.pk:
        raise LinkError('Nie można powiązać gracza z nim samym.')
    shared = _shared_tournament(slup, target)
    if shared:
        raise LinkError(
            f'{slup.display_name} i {target.display_name} grali w tym samym turnieju '
            f'(„{shared.name}”) — to nie może być ta sama osoba.'
        )

    if not dry_run:
        with transaction.atomic():
            slup.merged_into = target
            slup.save(update_fields=['merged_into'])
            PlayerContact.objects.get_or_create(owner=owner, player=target)
            _sync_league_members(slup)
    return target


def unlink(user, slup: Player) -> None:
    """Either side can undo: the słup's owner or the linked profile's owner."""
    if not slup.merged_into_id:
        raise LinkError('Ten gracz nie jest powiązany z żadnym kontem.')
    if user.pk not in (slup.owner_id, slup.merged_into.user_id):
        raise LinkForbidden('Nie możesz cofnąć tego powiązania.')
    with transaction.atomic():
        slup.merged_into = None
        slup.save(update_fields=['merged_into'])
        _sync_league_members(slup)
