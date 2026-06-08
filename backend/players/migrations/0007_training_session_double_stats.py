from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('players', '0006_add_training_session'),
    ]

    operations = [
        migrations.AddField(
            model_name='trainingsession',
            name='double_attempts',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='trainingsession',
            name='double_hits',
            field=models.PositiveIntegerField(default=0),
        ),
    ]
