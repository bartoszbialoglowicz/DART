from django.db import migrations, models
import django.db.models.deletion


def populate_participants(apps, schema_editor):
    Tournament = apps.get_model('tournaments', 'Tournament')
    TournamentParticipant = apps.get_model('tournaments', 'TournamentParticipant')
    Player = apps.get_model('players', 'Player')

    player_cache: dict = {}

    def get_player(pid):
        if pid is None:
            return None
        if pid not in player_cache:
            try:
                player_cache[pid] = Player.objects.get(pk=pid)
            except Player.DoesNotExist:
                player_cache[pid] = None
        return player_cache[pid]

    def extract(bracket):
        seen: dict = {}
        def scan(matches):
            for m in matches:
                for side in ('top', 'bottom'):
                    slot = m.get(side) or {}
                    pid  = slot.get('playerId')
                    name = (slot.get('playerName') or '').strip()
                    if pid is not None and name and pid not in seen:
                        seen[pid] = name
        fmt = bracket.get('format')
        if fmt == 'knockout':
            for rnd in bracket.get('rounds', []):
                scan(rnd.get('matches', []))
        elif fmt == 'groups':
            for group in bracket.get('groups', []):
                scan(group.get('matches', []))
            for rnd in (bracket.get('playoff') or {}).get('rounds', []):
                scan(rnd.get('matches', []))
        return seen

    to_create = []
    for t in Tournament.objects.all():
        if not t.bracket:
            continue
        for pid, name in extract(t.bracket).items():
            to_create.append(TournamentParticipant(
                tournament=t,
                player=get_player(pid),
                display_name=name,
            ))

    TournamentParticipant.objects.bulk_create(to_create, ignore_conflicts=True)


class Migration(migrations.Migration):

    dependencies = [
        ('tournaments', '0008_add_is_private_and_start_date'),
        ('players',     '0008_add_pending_match_result'),
    ]

    operations = [
        migrations.CreateModel(
            name='TournamentParticipant',
            fields=[
                ('id',           models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('display_name', models.CharField(max_length=200)),
                ('tournament',   models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='participants', to='tournaments.tournament')),
                ('player',       models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='tournament_participations', to='players.player')),
            ],
            options={'ordering': ['display_name']},
        ),
        migrations.AddConstraint(
            model_name='tournamentparticipant',
            constraint=models.UniqueConstraint(
                condition=models.Q(player__isnull=False),
                fields=['tournament', 'player'],
                name='unique_tournament_player',
            ),
        ),
        migrations.RunPython(populate_participants, migrations.RunPython.noop),
    ]
