from django.db import migrations, models


class Migration(migrations.Migration):
    """Frees the `match_id` attname for the upcoming Match FK on MatchStatistic."""

    dependencies = [
        ('tournaments', '0011_tournament_bracket_confirmed'),
    ]

    operations = [
        migrations.RemoveConstraint(model_name='matchstatistic', name='unique_stat_by_player_id'),
        migrations.RemoveConstraint(model_name='matchstatistic', name='unique_stat_by_player_name'),
        migrations.RenameField(model_name='matchstatistic', old_name='match_id', new_name='match_code'),
        migrations.AlterField(
            model_name='matchstatistic',
            name='match_code',
            field=models.CharField(max_length=50),
        ),
    ]
