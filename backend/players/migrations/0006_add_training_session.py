import datetime
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('players', '0005_add_user_and_owner_to_player'),
    ]

    operations = [
        migrations.CreateModel(
            name='TrainingSession',
            fields=[
                ('id',         models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('played_at',  models.DateField(default=datetime.date.today)),
                ('average',    models.FloatField()),
                ('legs',       models.PositiveIntegerField(default=1)),
                ('notes',      models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('player',     models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='training_sessions', to='players.player')),
            ],
            options={
                'ordering': ['-played_at', '-created_at'],
            },
        ),
    ]
