"""Converts every legacy `Tournament.bracket` JSON into the normalized models.

Never fails the deploy on data it can't link: unmatched statistics are kept
(with `match`/`entry` left NULL) and listed in the printed report.
"""
from types import SimpleNamespace

from django.db import migrations


def _models(apps):
    return SimpleNamespace(**{
        name: apps.get_model('tournaments', name)
        for name in ('Tournament', 'TournamentEntry', 'Stage', 'Group', 'GroupMember',
                     'Round', 'Match', 'MatchLeg', 'MatchStatistic')
    }, Player=apps.get_model('players', 'Player'))


def forward(apps, schema_editor):
    from tournaments.legacy_import import import_all

    report = import_all(_models(apps))
    print(
        f'\n  bracket import: {report.tournaments} turniejów, {report.matches} meczów, '
        f'{report.entries} uczestników ({report.guest_players} nowych słupów), '
        f'{report.stats_linked} statystyk powiązanych, {len(report.orphan_stats)} osieroconych'
    )
    for tournament_id, stat_id, reason in report.orphan_stats:
        print(f'    ! statystyka #{stat_id} (turniej #{tournament_id}): {reason}')
    for tournament_id, message in report.warnings:
        print(f'    ~ turniej #{tournament_id}: {message}')


def backward(apps, schema_editor):
    M = _models(apps)
    M.MatchStatistic.objects.update(match=None, entry=None)
    M.Stage.objects.all().delete()
    M.TournamentEntry.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('tournaments', '0013_tournament_structure'),
        ('players', '0010_sectorpracticesession'),
    ]

    operations = [
        migrations.RunPython(forward, backward),
    ]
