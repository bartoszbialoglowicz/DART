import random

from django.contrib.auth.models import User
from django.test import TestCase

from players.models import Player

from .models import Match, Round, Stage, TournamentEntry
from .services import (
    ConflictError, EntrySpec, TournamentError, advance_groups, create_tournament,
    phase_configs_of, record_result, redraw, save_legs,
)
from .services.bracket_view import build_bracket
from .services.placement import match_win_counts, placement_tiers
from .services.standings import group_standings

BO3_LEGS = {'sets': 1, 'legs': 3}


# ── Fixtures ─────────────────────────────────────────────────────────────────

class ServiceTestCase(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user('owner', password='pass')

    def players(self, n, cpu=False, owner=None):
        return [
            Player.objects.create(first_name=f'P{i}', last_name='X', cpu=cpu, average=50, owner=owner or self.owner)
            for i in range(n)
        ]

    def create(self, n=4, format='knockout', seed=1, players=None, **kwargs):
        players = players if players is not None else self.players(n)
        kwargs.setdefault('match_format', BO3_LEGS)
        return create_tournament(
            owner=self.owner, name='Cup', format=format,
            entries=[EntrySpec(player_id=p.pk) for p in players],
            rng=random.Random(seed), **kwargs,
        )

    def confirm(self, t):
        t.bracket_confirmed = True
        t.save(update_fields=['bracket_confirmed'])
        return t

    def match(self, t, code) -> Match:
        return t.matches.get(code=code)

    def win(self, t, code, side='top'):
        """Decide a match 2–0 (BO3 legs) for `side`."""
        m = self.match(t, code)
        top, bottom = (2, 0) if side == 'top' else (0, 2)
        return record_result(m, top_score=top, bottom_score=bottom)

    def play_all(self, t, stage_kind=None):
        """Decide every playable match top-wins until nothing is left."""
        while True:
            qs = t.matches.filter(status__in=['pending', 'live'], top_entry__isnull=False, bottom_entry__isnull=False)
            if stage_kind:
                qs = qs.filter(stage__kind=stage_kind)
            m = qs.first()
            if m is None:
                return
            record_result(m, top_score=2, bottom_score=0)


# ── Generation ───────────────────────────────────────────────────────────────

class KnockoutGenerationTests(ServiceTestCase):

    def test_four_players_make_two_rounds(self):
        t = self.create(4)
        stage = t.stages.get()
        self.assertEqual(stage.kind, 'knockout')
        self.assertEqual(
            list(stage.rounds.values_list('code', 'label', 'tier')),
            [('round-0', 'Półfinał', 'semifinal'), ('round-1', 'Finał', 'final')],
        )
        self.assertEqual(sorted(t.matches.values_list('code', flat=True)), ['r0-m0', 'r0-m1', 'r1-m0'])
        final = self.match(t, 'r1-m0')
        self.assertEqual(final.top_source, {'kind': 'winner', 'match': 'r0-m0'})
        self.assertEqual(final.bottom_source, {'kind': 'winner', 'match': 'r0-m1'})
        self.assertTrue(t.is_active)

    def test_every_player_is_drawn_exactly_once(self):
        for n in range(2, 18):
            t = self.create(n, seed=n)
            first = t.matches.filter(round__order=0)
            drawn = [e for m in first for e in (m.top_entry_id, m.bottom_entry_id) if e]
            self.assertCountEqual(drawn, t.entries.values_list('id', flat=True), n)

    def test_byes_never_meet_each_other_and_advance_automatically(self):
        for n in (3, 5, 6, 7, 9, 13):
            t = self.create(n, seed=n)
            first = list(t.matches.filter(round__order=0))
            byes  = [m for m in first if m.status == 'bye']
            self.assertEqual(len(byes), len(first) * 2 - n, n)
            for m in byes:
                self.assertEqual(m.winner, 'top')
                self.assertIsNotNone(m.top_entry_id)
            # A bye's player already sits in the next round.
            second_round_entries = {
                e for m in t.matches.filter(round__order=1) for e in (m.top_entry_id, m.bottom_entry_id)
            }
            for m in byes:
                self.assertIn(m.top_entry_id, second_round_entries)

    def test_seed_positions_are_the_standard_bracket_order(self):
        from .services.generation import seed_positions
        self.assertEqual(seed_positions(2), [1, 2])
        self.assertEqual(seed_positions(8), [1, 8, 4, 5, 2, 7, 3, 6])

    def test_bye_players_meet_in_round_two_only_when_unavoidable(self):
        for n in range(3, 33):
            for seed in range(3):
                t = self.create(n, seed=seed)
                size = 2 ** t.stages.get().rounds.count()
                byes = size - n
                second = list(t.matches.filter(round__order=1))
                both_from_byes = sum(1 for m in second if m.top_entry_id and m.bottom_entry_id)
                # Round 2 has size/4 matches; byes beyond that must pair up.
                self.assertEqual(both_from_byes, max(0, byes - size // 4), (n, seed))
            t.delete()

    def test_name_only_entry_becomes_an_account_less_player(self):
        known = self.players(1)[0]
        t = create_tournament(
            owner=self.owner, name='Cup', format='knockout', match_format=BO3_LEGS,
            entries=[EntrySpec(player_id=known.pk), EntrySpec(name='Anna Kowalska')],
        )
        entry = t.entries.get(display_name='Anna Kowalska')
        self.assertIsNotNone(entry.player)
        self.assertIsNone(entry.player.user)
        self.assertEqual(entry.player.owner, self.owner)
        self.assertEqual((entry.player.first_name, entry.player.last_name), ('Anna', 'Kowalska'))

    def test_two_guests_with_the_same_name_stay_separate_players(self):
        t = create_tournament(
            owner=self.owner, name='Cup', format='knockout', match_format=BO3_LEGS,
            entries=[EntrySpec(name='Tomek'), EntrySpec(name='Tomek')],
        )
        self.assertEqual(t.entries.values('player').distinct().count(), 2)

    def test_rejects_duplicate_unknown_and_foreign_bot_players(self):
        p = self.players(2)
        other = User.objects.create_user('other')
        foreign_bot = Player.objects.create(first_name='Bot', last_name='', cpu=True, owner=other)
        cases = [
            [EntrySpec(player_id=p[0].pk), EntrySpec(player_id=p[0].pk)],
            [EntrySpec(player_id=p[0].pk), EntrySpec(player_id=999999)],
            [EntrySpec(player_id=p[0].pk), EntrySpec(player_id=foreign_bot.pk)],
            [EntrySpec(player_id=p[0].pk)],
        ]
        for entries in cases:
            with self.assertRaises(TournamentError):
                create_tournament(owner=self.owner, name='Cup', format='knockout', match_format=BO3_LEGS, entries=entries)

    def test_failed_creation_leaves_no_guest_players_behind(self):
        before = Player.objects.count()
        with self.assertRaises(TournamentError):
            create_tournament(
                owner=self.owner, name='Cup', format='knockout', match_format=BO3_LEGS,
                entries=[EntrySpec(name='Gość'), EntrySpec(player_id=999999)],
            )
        self.assertEqual(Player.objects.count(), before)

    def test_phase_configs_round_trip(self):
        pcs = {
            'round-0': {'date': '2026-11-01T18:30', 'matchFormat': {'sets': 1, 'legs': 5}},
            'round-1': {'date': '2026-11-02T20:00'},
        }
        t = self.create(4, phase_configs=pcs)
        self.assertEqual(phase_configs_of(t), pcs)
        self.assertEqual(t.start_date.isoformat(), '2026-11-01T18:30:00+00:00')

    def test_redraw_keeps_roster_and_phases_but_only_for_drafts(self):
        pcs = {'round-0': {'matchFormat': {'sets': 1, 'legs': 5}}}
        t = self.create(6, phase_configs=pcs)
        entries = set(t.entries.values_list('id', flat=True))
        redraw(t, rng=random.Random(99))
        self.assertEqual(set(t.entries.values_list('id', flat=True)), entries)
        self.assertEqual(phase_configs_of(t), pcs)
        self.assertEqual(t.matches.count(), 7)

        self.confirm(t)
        with self.assertRaises(ConflictError):
            redraw(t)


class GroupGenerationTests(ServiceTestCase):

    def test_eight_players_make_two_groups_and_a_four_player_playoff(self):
        t = self.create(8, format='groups', group_size=4)
        group_stage, playoff = t.stages.order_by('order')
        self.assertEqual(group_stage.kind, 'groups')
        self.assertEqual(list(group_stage.groups.values_list('label', flat=True)), ['A', 'B'])
        for g in group_stage.groups.all():
            self.assertEqual(g.members.count(), 4)
            self.assertEqual(g.matches.count(), 6)

        self.assertEqual(playoff.kind, 'knockout')
        self.assertEqual(list(playoff.rounds.values_list('code', flat=True)), ['r0', 'r1'])
        semis = list(t.matches.filter(round__stage=playoff, round__order=0))
        self.assertEqual(
            [(m.top_source['group'], m.top_source['place'], m.bottom_source['group'], m.bottom_source['place']) for m in semis],
            [('A', 1, 'B', 2), ('B', 1, 'A', 2)],
        )
        self.assertTrue(all(m.status == 'pending' for m in semis))

    def test_playoff_after_three_groups_has_byes_for_winners_and_no_same_group_pairs(self):
        t = self.create(12, format='groups', group_size=4)
        first = list(t.matches.filter(round__stage__kind='knockout', round__order=0))
        self.assertEqual(len(first), 4)
        for m in first:
            self.assertTrue(m.top_source or m.bottom_source, m.code)  # never empty vs empty
            if m.top_source and m.bottom_source:
                self.assertNotEqual(m.top_source['group'], m.bottom_source['group'], m.code)
        byes = [m for m in first if not (m.top_source and m.bottom_source)]
        self.assertEqual(len(byes), 2)
        self.assertTrue(all(m.top_source['place'] == 1 for m in byes))

    def test_playoff_never_pairs_a_group_with_itself_when_avoidable(self):
        for groups in range(2, 9):
            t = self.create(groups * 4, format='groups', group_size=4, seed=groups)
            for m in t.matches.filter(round__stage__kind='knockout', round__order=0):
                if m.top_source and m.bottom_source:
                    self.assertNotEqual(m.top_source['group'], m.bottom_source['group'], (groups, m.code))

    def test_group_match_order_follows_the_predefined_schedule(self):
        t = self.create(4, format='groups', group_size=4)
        group = Stage.objects.get(tournament=t, kind='groups').groups.get()
        pos = {m.entry_id: m.position for m in group.members.all()}
        pairs = [(pos[m.top_entry_id], pos[m.bottom_entry_id]) for m in group.matches.order_by('order')]
        self.assertEqual(pairs, [(0, 2), (1, 3), (0, 3), (1, 2), (0, 1), (2, 3)])

    def test_uneven_roster_leaves_a_smaller_last_group(self):
        t = self.create(6, format='groups', group_size=4)
        sizes = [g.members.count() for g in Stage.objects.get(tournament=t, kind='groups').groups.all()]
        self.assertEqual(sizes, [4, 2])

    def test_boards_are_assigned_round_robin(self):
        t = self.create(12, format='groups', group_size=4, board_count=2)
        boards = list(Stage.objects.get(tournament=t, kind='groups').groups.values_list('board', flat=True))
        self.assertEqual(boards, [1, 2, 1])

    def test_rejects_unsupported_group_size(self):
        with self.assertRaises(TournamentError):
            self.create(8, format='groups', group_size=7)


# ── Results ──────────────────────────────────────────────────────────────────

class RecordResultTests(ServiceTestCase):

    def setUp(self):
        super().setUp()
        self.t = self.confirm(self.create(4))

    def test_requires_a_confirmed_bracket(self):
        draft = self.create(4)
        with self.assertRaises(ConflictError):
            self.win(draft, 'r0-m0')

    def test_score_must_match_the_format(self):
        m = self.match(self.t, 'r0-m0')
        for top, bottom in ((3, 0), (1, 1), (2, 2), (1, 0), (-1, 2)):
            with self.assertRaises(TournamentError, msg=(top, bottom)):
                record_result(m, top_score=top, bottom_score=bottom)
        record_result(m, top_score=1, bottom_score=2)
        m.refresh_from_db()
        self.assertEqual((m.status, m.winner), ('finished', 'bottom'))

    def test_round_format_override_changes_the_target(self):
        t = self.confirm(self.create(4, phase_configs={'round-1': {'matchFormat': {'sets': 3, 'legs': 3}}}))
        self.win(t, 'r0-m0')
        self.win(t, 'r0-m1')
        final = self.match(t, 'r1-m0')
        with self.assertRaises(TournamentError):
            record_result(final, top_score=3, bottom_score=0)
        record_result(final, top_score=2, bottom_score=1)

    def test_winner_advances_to_the_next_round(self):
        self.win(self.t, 'r0-m0', 'bottom')
        r0 = self.match(self.t, 'r0-m0')
        final = self.match(self.t, 'r1-m0')
        self.assertEqual(final.top_entry_id, r0.bottom_entry_id)
        self.assertIsNone(final.bottom_entry_id)

    def test_decided_result_is_locked_but_identical_resend_is_accepted(self):
        self.win(self.t, 'r0-m0')
        m = self.match(self.t, 'r0-m0')
        with self.assertRaises(ConflictError):
            record_result(m, top_score=0, bottom_score=2)
        record_result(m, top_score=2, bottom_score=0, legs=[{'rounds': [], 'winner': 'top'}])
        m.refresh_from_db()
        self.assertEqual(m.legs, [{'rounds': [], 'winner': 'top'}])

    def test_cannot_play_a_match_without_both_players(self):
        with self.assertRaises(ConflictError):
            self.win(self.t, 'r1-m0')

    def test_tournament_ends_when_the_final_is_decided(self):
        self.play_all(self.t)
        self.t.refresh_from_db()
        self.assertFalse(self.t.is_active)


class LiveSimulationLockTests(ServiceTestCase):

    def setUp(self):
        super().setUp()
        self.t = self.confirm(self.create(players=self.players(2, cpu=True)))
        self.m = self.match(self.t, 'r0-m0')
        save_legs(self.m, legs=[], current_leg={'rounds': [], 'activePlayer': 0})

    def test_bot_match_being_simulated_rejects_other_results(self):
        with self.assertRaises(ConflictError):
            record_result(self.m, top_score=2, bottom_score=0)

    def test_live_screen_result_clears_its_own_lock(self):
        record_result(self.m, top_score=2, bottom_score=0, live=True)
        self.m.refresh_from_db()
        self.assertIsNone(self.m.current_leg)
        self.assertEqual(self.m.status, 'finished')

    def test_human_match_is_not_blocked_by_a_stray_current_leg(self):
        t = self.confirm(self.create(2))
        m = self.match(t, 'r0-m0')
        save_legs(m, legs=[], current_leg={'rounds': [], 'activePlayer': 0})
        record_result(m, top_score=2, bottom_score=0)

    def test_late_leg_update_never_relocks_a_finished_match(self):
        record_result(self.m, top_score=2, bottom_score=0, live=True)
        save_legs(self.m, legs=[{'rounds': [], 'winner': 'top'}], current_leg={'rounds': [], 'activePlayer': 1})
        self.m.refresh_from_db()
        self.assertIsNone(self.m.current_leg)
        self.assertEqual(self.m.status, 'finished')

    def test_leg_progress_marks_the_match_live(self):
        self.m.refresh_from_db()
        self.assertEqual(self.m.status, 'live')


# ── Groups → playoff ─────────────────────────────────────────────────────────

class GroupAdvanceTests(ServiceTestCase):

    def test_standings_count_legs_not_sets(self):
        t = self.confirm(self.create(3, format='groups', group_size=3))
        group = Stage.objects.get(tournament=t, kind='groups').groups.get()
        m = group.matches.order_by('order').first()
        record_result(m, top_score=2, bottom_score=1)
        table = group_standings(group.members.all(), group.matches.all())
        leader = table[0]
        self.assertEqual((leader.entry_id, leader.points, leader.legs_for, leader.legs_against), (m.top_entry_id, 2, 2, 1))

    def test_advance_requires_finished_groups_and_happens_once(self):
        t = self.confirm(self.create(8, format='groups', group_size=4))
        stage = Stage.objects.get(tournament=t, kind='groups')
        with self.assertRaises(ConflictError):
            advance_groups(stage)
        self.play_all(t, 'groups')
        advance_groups(stage)
        with self.assertRaises(ConflictError):
            advance_groups(stage)

    def test_advance_fills_the_playoff_from_the_tables(self):
        t = self.confirm(self.create(8, format='groups', group_size=4))
        self.play_all(t, 'groups')
        advance_groups(Stage.objects.get(tournament=t, kind='groups'))

        tables = {}
        for g in Stage.objects.get(tournament=t, kind='groups').groups.all():
            tables[g.label] = [r.entry_id for r in group_standings(g.members.all(), g.matches.all())]
        semi = self.match(t, 'r0-m0')
        self.assertEqual((semi.top_entry_id, semi.bottom_entry_id), (tables['A'][0], tables['B'][1]))

    def test_three_groups_playoff_runs_to_a_winner_through_byes(self):
        t = self.confirm(self.create(12, format='groups', group_size=4))
        self.play_all(t, 'groups')
        advance_groups(Stage.objects.get(tournament=t, kind='groups'))
        self.play_all(t)
        t.refresh_from_db()
        self.assertFalse(t.is_active)
        self.assertIn('winner', placement_tiers(t).values())


# ── Placement ────────────────────────────────────────────────────────────────

class PlacementTests(ServiceTestCase):

    def test_knockout_tiers(self):
        t = self.confirm(self.create(8))
        self.play_all(t)
        tiers = placement_tiers(t)
        counts = {tier: list(tiers.values()).count(tier) for tier in set(tiers.values())}
        self.assertEqual(counts, {'winner': 1, 'final': 1, 'semifinal': 2, 'quarterfinal': 4})

    def test_group_only_players_are_other(self):
        t = self.confirm(self.create(8, format='groups', group_size=4))
        self.play_all(t, 'groups')
        advance_groups(Stage.objects.get(tournament=t, kind='groups'))
        self.play_all(t)
        tiers = placement_tiers(t)
        self.assertEqual(len(tiers), 8)
        self.assertEqual(list(tiers.values()).count('other'), 4)

    def test_win_counts_ignore_byes(self):
        t = self.confirm(self.create(3))
        self.play_all(t)
        self.assertEqual(sum(match_win_counts(t).values()), 2)


# ── Legacy bracket view ──────────────────────────────────────────────────────

class BracketViewTests(ServiceTestCase):

    def test_knockout_shape(self):
        t = self.confirm(self.create(4))
        self.win(t, 'r0-m0')
        data = build_bracket(t)
        self.assertEqual(data['format'], 'knockout')
        self.assertEqual(data['playerCount'], 4)
        self.assertEqual([r['id'] for r in data['rounds']], ['round-0', 'round-1'])
        m = data['rounds'][0]['matches'][0]
        self.assertEqual(m['id'], 'r0-m0')
        # Single-set format: set count 1/0, display score in legs.
        self.assertEqual(m['result'], {'topSetsWon': 1, 'bottomSetsWon': 0, 'displayScore': '2–0', 'winner': 'top'})
        self.assertEqual(m['matchFormat'], BO3_LEGS)
        self.assertEqual(m['top']['entryId'], self.match(t, 'r0-m0').top_entry_id)
        self.assertNotIn('result', data['rounds'][1]['matches'][0])

    def test_groups_hide_playoff_until_advanced_and_pad_slots(self):
        t = self.confirm(self.create(6, format='groups', group_size=4))
        data = build_bracket(t)
        self.assertNotIn('playoff', data)
        self.assertEqual([len(g['slots']) for g in data['groups']], [4, 4])
        self.assertEqual(data['groups'][1]['slots'][3]['playerId'], None)

        self.play_all(t, 'groups')
        advance_groups(Stage.objects.get(tournament=t, kind='groups'))
        data = build_bracket(t)
        self.assertEqual([r['id'] for r in data['playoff']['rounds']], ['r0', 'r1'])

    def test_deleted_player_keeps_an_occupied_slot(self):
        t = self.create(2)
        entry = TournamentEntry.objects.filter(tournament=t).first()
        entry.player.delete()
        data = build_bracket(t)
        slots = [data['rounds'][0]['matches'][0][s] for s in ('top', 'bottom')]
        self.assertIn(-entry.id, [s['playerId'] for s in slots])


# ── Legacy JSON import (migration 0014) ──────────────────────────────────────

class LegacyImportTests(ServiceTestCase):

    def models(self):
        from types import SimpleNamespace
        from . import models as m
        return SimpleNamespace(
            Tournament=m.Tournament, TournamentEntry=m.TournamentEntry, Stage=m.Stage, Group=m.Group,
            GroupMember=m.GroupMember, Round=m.Round, Match=m.Match, MatchLeg=m.MatchLeg,
            MatchStatistic=m.MatchStatistic, Player=Player,
        )

    def slot(self, player=None, name=None, pid=None):
        if player:
            return {'playerId': player.pk, 'playerName': f'{player.first_name} {player.last_name}', 'playerAvg': 50, 'isCpu': False}
        if name:
            return {'playerId': pid, 'playerName': name, 'playerAvg': 0, 'isCpu': False}
        return {'playerId': None, 'playerName': None, 'playerAvg': None, 'isCpu': False}

    def test_knockout_with_placeholder_bye_legs_and_stats(self):
        from .legacy_import import import_tournament
        from .models import MatchLeg, MatchStatistic, Tournament

        a, b = self.players(2)
        guest = self.slot(name='Anna Kowalska', pid=-1)
        bracket = {
            'format': 'knockout', 'name': 'Old', 'playerCount': 3, 'matchFormat': {'sets': 1, 'legs': 3},
            'phaseConfigs': {'round-1': {'date': '2026-01-02T18:00'}},
            'rounds': [
                {'id': 'round-0', 'label': 'Półfinał', 'matches': [
                    {'id': 'r0-m0', 'top': self.slot(a), 'bottom': guest,
                     'result': {'topSetsWon': 1, 'bottomSetsWon': 0, 'displayScore': '2–1', 'winner': 'top'},
                     'legs': [{'rounds': [], 'winner': 'top'}]},
                    {'id': 'r0-m1', 'top': self.slot(b), 'bottom': self.slot()},
                ]},
                {'id': 'round-1', 'label': 'Finał', 'date': '2026-01-02T18:00', 'matches': [
                    {'id': 'r1-m0', 'top': self.slot(a), 'bottom': self.slot()},
                ]},
            ],
        }
        t = Tournament.objects.create(owner=self.owner, name='Old', format='knockout', bracket=bracket)
        MatchLeg.objects.create(tournament=t, match_id='r1-m0', legs=[], current_leg={'rounds': [], 'activePlayer': 0})
        MatchStatistic.objects.create(tournament=t, match_code='r0-m0', player=a, player_name='P0 X', count_180=2)
        MatchStatistic.objects.create(tournament=t, match_code='r0-m0', player=None, player_name='Anna Kowalska')
        MatchStatistic.objects.create(tournament=t, match_code='gone', player=None, player_name='Anna Kowalska')

        report = import_tournament(self.models(), t)

        self.assertEqual((report.entries, report.guest_players, report.stats_linked), (3, 1, 2))
        self.assertEqual([r[1] for r in report.orphan_stats], [MatchStatistic.objects.get(match_code='gone').pk])
        guest_entry = t.entries.get(display_name='Anna Kowalska')
        self.assertIsNone(guest_entry.player.user)

        r00 = self.match(t, 'r0-m0')
        self.assertEqual((r00.status, r00.top_score, r00.bottom_score, r00.winner), ('finished', 2, 1, 'top'))
        self.assertEqual(r00.legs, [{'rounds': [], 'winner': 'top'}])
        # The stuck bye from the old JSON now resolves and its player reaches the final.
        self.assertEqual(self.match(t, 'r0-m1').status, 'bye')
        final = self.match(t, 'r1-m0')
        self.assertEqual(final.bottom_entry.player, b)
        self.assertEqual(final.current_leg, {'rounds': [], 'activePlayer': 0})
        self.assertEqual(phase_configs_of(t), {'round-1': {'date': '2026-01-02T18:00'}})

        # Re-running is a no-op.
        self.assertEqual(import_tournament(self.models(), t).matches, 0)

    def test_groups_without_playoff_get_an_unadvanced_playoff(self):
        from .legacy_import import import_tournament
        from .models import Tournament

        p = self.players(4)
        slots = [self.slot(x) for x in p]
        matches = [
            {'id': f'group-0-m{i}', 'top': slots[x], 'bottom': slots[y]}
            for i, (x, y) in enumerate([(0, 2), (1, 3), (0, 3), (1, 2), (0, 1), (2, 3)])
        ]
        bracket = {
            'format': 'groups', 'name': 'G', 'playerCount': 4, 'matchFormat': {'sets': 1, 'legs': 3},
            'groups': [{'id': 'group-0', 'label': 'A', 'slots': slots, 'matches': matches}],
        }
        t = Tournament.objects.create(owner=self.owner, name='G', format='groups', bracket=bracket, bracket_confirmed=True)
        import_tournament(self.models(), t)

        group_stage, playoff = t.stages.order_by('order')
        self.assertFalse(group_stage.config['advanced'])
        self.assertEqual(list(playoff.rounds.values_list('code', flat=True)), ['r0'])
        self.play_all(t, 'groups')
        advance_groups(group_stage)
        final = self.match(t, 'r0-m0')
        self.assertIsNotNone(final.top_entry_id)
        self.assertIsNotNone(final.bottom_entry_id)
