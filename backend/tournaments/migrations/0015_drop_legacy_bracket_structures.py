from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):
    """Stage 6 cleanup: the bracket JSON was imported into the models by 0014
    and nothing reads it any more. It stays one more release as a read-only
    `legacy_bracket` column; MatchLeg (now Match.legs/current_leg) and
    TournamentParticipant (now TournamentEntry) are dropped."""

    dependencies = [
        ('tournaments', '0014_import_legacy_brackets'),
    ]

    operations = [
        migrations.RenameField(model_name='tournament', old_name='bracket', new_name='legacy_bracket'),
        migrations.AlterField(
            model_name='tournament',
            name='legacy_bracket',
            field=models.JSONField(blank=True, editable=False, null=True),
        ),
        migrations.RemoveConstraint(model_name='matchstatistic', name='unique_stat_by_player_id'),
        migrations.RemoveConstraint(model_name='matchstatistic', name='unique_stat_by_player_name'),
        migrations.AddConstraint(
            model_name='matchstatistic',
            constraint=models.UniqueConstraint(
                condition=Q(entry__isnull=False, match__isnull=False),
                fields=('match', 'entry'),
                name='unique_stat_per_match_entry',
            ),
        ),
        migrations.DeleteModel(name='MatchLeg'),
        migrations.DeleteModel(name='TournamentParticipant'),
    ]
