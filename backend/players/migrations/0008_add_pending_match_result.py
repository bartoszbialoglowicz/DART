from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('players', '0007_training_session_double_stats'),
    ]

    operations = [
        migrations.CreateModel(
            name='PendingMatchResult',
            fields=[
                ('id',              models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('opponent_name',   models.CharField(max_length=200)),
                ('played_at',       models.DateField()),
                ('average',         models.FloatField()),
                ('legs_won',        models.PositiveIntegerField()),
                ('legs_lost',       models.PositiveIntegerField()),
                ('double_attempts', models.PositiveIntegerField(default=0)),
                ('double_hits',     models.PositiveIntegerField(default=0)),
                ('created_at',      models.DateTimeField(auto_now_add=True)),
                ('for_player',      models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='pending_results', to='players.player')),
            ],
            options={
                'ordering': ['-played_at', '-created_at'],
            },
        ),
    ]
