import { useRef } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLeague, useLeagueSchedule, useUpdateLeagueMatchLeg, useUpdateMatch } from '../hooks/useLeagues';
import { usePlayers } from '../hooks/usePlayers';
import { LiveMatchScreen } from '../components/match/LiveMatchScreen';
import { LiveMatchViewer } from '../components/match/LiveMatchViewer';
import { computeMatchStats } from '../utils/statistics';
import { avgToSigma } from '../utils/dart501';
import type { BracketMatch, LegRecord, LegRound } from '../types/bracket';
import type { MatchFormat } from '../types/tournament';

export function LeagueLiveMatchPage() {
  const { id, matchId }        = useParams<{ id: string; matchId: string }>();
  const leagueId                = Number(id);
  const navigate                = useNavigate();
  const { username, playerId }  = useAuth();

  const { data: league,  isLoading: leagueLoading   } = useLeague(leagueId);
  const { data: schedule = [], isLoading: scheduleLoading } = useLeagueSchedule(leagueId);
  const { data: players = [] } = usePlayers();
  const updateMatchLeg = useUpdateLeagueMatchLeg(leagueId);
  const updateMatch    = useUpdateMatch(leagueId);

  // Track completed legs locally so handleScoreEntered can send them alongside currentLeg
  const completedLegsRef = useRef<LegRecord[]>([]);

  // Captures once whether the match already had a result the moment this page
  // instance first saw it — mirrors LiveMatchPage.tsx's guard against landing
  // back on the editable keyboard screen for a match that's already decided
  // (finished or already awaiting the owner's approval).
  const initialResultRef = useRef<'unset' | boolean>('unset');

  if (leagueLoading || scheduleLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-surface-base">
        <span className="text-sm text-content-secondary">Ładowanie...</span>
      </div>
    );
  }

  const match = schedule.find(m => m.id === Number(matchId));

  if (!league || !match) {
    return <Navigate to={`/ligi/${id}`} replace />;
  }

  const isOwner = !!username && username === league.owner_username;
  const currentMemberId = playerId != null
    ? (league.members.find(m => m.player_id === playerId)?.id ?? null)
    : null;
  const isParticipant = currentMemberId === match.home || currentMemberId === match.away;
  // Whoever may actually drive the live scoreboard — in a league, either
  // participant can play the match themselves, not just the league owner.
  const canPlay = isOwner || isParticipant;

  if (initialResultRef.current === 'unset') {
    initialResultRef.current = match.status !== 'pending';
  }
  if (initialResultRef.current) {
    return <Navigate to={`/ligi/${id}`} replace />;
  }

  if (completedLegsRef.current.length === 0 && match.legs.length > 0) {
    completedLegsRef.current = match.legs;
  }

  const homeMember = league.members.find(m => m.id === match.home);
  const awayMember = league.members.find(m => m.id === match.away);
  const homePlayer = homeMember?.player_id != null ? players.find(p => p.id === homeMember.player_id) : undefined;
  const awayPlayer = awayMember?.player_id != null ? players.find(p => p.id === awayMember.player_id) : undefined;

  const bracketMatch: BracketMatch = {
    id:  String(match.id),
    top: {
      playerId:   homeMember?.player_id ?? null,
      playerName: match.home_name,
      playerAvg:  null,
      isCpu:      homeMember?.is_cpu ?? false,
      cpuSigma:   homePlayer ? avgToSigma(Number(homePlayer.average)) : undefined,
    },
    bottom: {
      playerId:   awayMember?.player_id ?? null,
      playerName: match.away_name,
      playerAvg:  null,
      isCpu:      awayMember?.is_cpu ?? false,
      cpuSigma:   awayPlayer ? avgToSigma(Number(awayPlayer.average)) : undefined,
    },
    legs:       match.legs.length > 0 ? match.legs : undefined,
    currentLeg: match.current_leg ?? undefined,
  };

  const matchFormat: MatchFormat = { sets: league.sets, legs: league.legs };

  function handleScoreEntered(rounds: LegRound[], activePlayer: 0 | 1) {
    updateMatchLeg.mutate({
      matchId: match!.id, legs: completedLegsRef.current, currentLeg: { rounds, activePlayer },
    });
  }

  function handleLegComplete(legs: LegRecord[], rounds: LegRound[], activePlayer: 0 | 1) {
    completedLegsRef.current = legs;
    updateMatchLeg.mutate({ matchId: match!.id, legs, currentLeg: { rounds, activePlayer } });
  }

  // Fires automatically the instant the match is won (useMatchEngine's
  // auto-save effect) — submits through the same endpoint manual entry uses,
  // so the owner-vs-participant approval rule applies identically here.
  async function handleResult(topLegs: number, bottomLegs: number) {
    const [homeStats, awayStats] = computeMatchStats(
      String(match!.id),
      completedLegsRef.current,
      [match!.home_name, match!.away_name],
      [homeMember?.player_id ?? null, awayMember?.player_id ?? null],
    );

    await updateMatchLeg.mutateAsync({ matchId: match!.id, legs: completedLegsRef.current, currentLeg: null });

    updateMatch.mutate({
      matchId: match!.id,
      data: {
        home_score:          topLegs,
        away_score:          bottomLegs,
        home_count_180:      homeStats.count_180,
        away_count_180:      awayStats.count_180,
        home_high_checkouts: homeStats.high_checkouts,
        away_high_checkouts: awayStats.high_checkouts,
        home_short_legs:     homeStats.short_legs,
        away_short_legs:     awayStats.short_legs,
      },
    });
  }

  if (!canPlay) {
    return <LiveMatchViewer match={bracketMatch} onClose={() => navigate(`/ligi/${id}`)} />;
  }

  return (
    <LiveMatchScreen
      match={bracketMatch}
      matchFormat={matchFormat}
      isOwner={canPlay}
      onClose={() => navigate(`/ligi/${id}`)}
      onScoreEntered={handleScoreEntered}
      onLegComplete={handleLegComplete}
      onResult={handleResult}
    />
  );
}
