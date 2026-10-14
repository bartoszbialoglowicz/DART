"""Every name-only league member becomes an account-less Player ("słup")
owned by the league's organizer — same as tournament placeholders — so it
can be linked to a registered player's account later."""
from django.db import migrations


def forward(apps, schema_editor):
    LeagueMember = apps.get_model('leagues', 'LeagueMember')
    Player       = apps.get_model('players', 'Player')
    for member in LeagueMember.objects.filter(player__isnull=True).select_related('league'):
        first, _, last = (member.display_name or 'Gracz').strip().partition(' ')
        member.player = Player.objects.create(
            owner_id=member.league.owner_id, first_name=first, last_name=last.strip(), cpu=False,
        )
        member.save(update_fields=['player'])


def backward(apps, schema_editor):
    LeagueMember = apps.get_model('leagues', 'LeagueMember')
    Player       = apps.get_model('players', 'Player')
    guests = list(LeagueMember.objects.filter(status='pending', player__isnull=False).values_list('player_id', flat=True))
    LeagueMember.objects.filter(status='pending').update(player=None)
    Player.objects.filter(pk__in=guests, user__isnull=True, merged_into__isnull=True, tournament_entries__isnull=True).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('leagues', '0002_leaguematch_away_count_180_and_more'),
        ('players', '0012_player_contact'),
        ('tournaments', '0015_drop_legacy_bracket_structures'),
    ]

    operations = [
        migrations.RunPython(forward, backward),
    ]
