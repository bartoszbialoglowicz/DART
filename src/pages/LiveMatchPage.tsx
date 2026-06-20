import { useRef } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTournament, useUpdateMatchLeg, useUpdateTournament } from '../hooks/useTournaments';
import { LiveMatchScreen } from '../components/match/LiveMatchScreen';
import { LiveMatchViewer } from '../components/match/LiveMatchViewer';
import { buildManualResult } from '../utils/simulate';
import { applyResult, applyGroupMatchResult, applyPlayoffResult } from '../utils/bracket';
import { computeMatchStats } from '../utils/statistics';
import { statisticsApi } from '../api/statistics';
import type { BracketData, BracketMatch, CurrentLeg, LegRecord, LegRound } from '../types/bracket';

type MatchContext =
  | { kind: 'knockout' }
  | { kind: 'group'; groupId: string };

function findMatch(bracket: BracketData | undefined, matchId: string | undefined): { match: BracketMatch; ctx: MatchContext } | null {
  if (!bracket || !matchId) return null;

  if (bracket.format === 'knockout') {
    for (const round of bracket.rounds) {
      const match = round.matches.find(m => m.id === matchId);
      if (match) return { match, ctx: { kind: 'knockout' } };
    }
  }

  if (bracket.format === 'groups') {
    for (const group of bracket.groups) {
      const match = (group.matches ?? []).find(m => m.id === matchId);
      if (match) return { match, ctx: { kind: 'group', groupId: group.id } };
    }
    for (const round of bracket.playoff?.rounds ?? []) {
      const match = round.matches.find(m => m.id === matchId);
      if (match) return { match, ctx: { kind: 'knockout' } };
    }
  }

  return null;
}

export function LiveMatchPage() {
  const { id, matchId } = useParams<{ id: string; matchId: string }>();
  const navigate         = useNavigate();
  const { data: tournament, isLoading } = useTournament(Number(id), 5000);
  const updateTournament = useUpdateTournament();
  const updateMatchLeg   = useUpdateMatchLeg();
  const { username }     = useAuth();

  // Track completed legs locally so handleScoreEntered can send them alongside currentLeg
  const completedLegsRef = useRef<LegRecord[]>([]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-surface-base">
        <span className="text-sm text-content-secondary">Ładowanie...</span>
      </div>
    );
  }

  const bracket = tournament?.bracket;
  const found   = findMatch(bracket, matchId);
  const isOwner = !!username && username === tournament?.owner_username;

  if (!found || !bracket) {
    return <Navigate to={`/turnieje/${id}`} replace />;
  }

  const { match, ctx } = found;

  // Seed ref with legs already saved (e.g. after a page reload mid-match)
  if (completedLegsRef.current.length === 0 && (match.legs?.length ?? 0) > 0) {
    completedLegsRef.current = match.legs!;
  }

  function handleScoreEntered(rounds: LegRound[], activePlayer: 0 | 1) {
    if (!matchId) return;
    const currentLeg: CurrentLeg = { rounds, activePlayer };
    updateMatchLeg.mutate({ id: Number(id), matchId, legs: completedLegsRef.current, currentLeg });
  }

  function handleLegComplete(legs: LegRecord[], rounds: LegRound[], activePlayer: 0 | 1) {
    if (!matchId) return;
    completedLegsRef.current = legs;

    const stats = computeMatchStats(matchId, legs, [
      match.top.playerName    ?? 'Gracz 1',
      match.bottom.playerName ?? 'Gracz 2',
    ], [match.top.playerId, match.bottom.playerId]);
    statisticsApi.save(Number(id), stats).catch(console.error);

    const currentLeg: CurrentLeg = { rounds, activePlayer };
    updateMatchLeg.mutate({ id: Number(id), matchId, legs, currentLeg });
  }

  function handleResult(topLegs: number, bottomLegs: number) {
    if (!bracket || !matchId) return;
    const result = buildManualResult(topLegs, bottomLegs, bracket.matchFormat);

    // Clear live leg data once match is done
    updateMatchLeg.mutate({ id: Number(id), matchId, legs: completedLegsRef.current, currentLeg: null });

    if (ctx.kind === 'knockout' && bracket.format === 'knockout') {
      updateTournament.mutate({ id: Number(id), bracket: applyResult(bracket, matchId, result) });
    } else if (ctx.kind === 'group' && bracket.format === 'groups') {
      updateTournament.mutate({ id: Number(id), bracket: applyGroupMatchResult(bracket, ctx.groupId, matchId, result) });
    } else if (ctx.kind === 'knockout' && bracket.format === 'groups' && bracket.playoff) {
      updateTournament.mutate({ id: Number(id), bracket: applyPlayoffResult(bracket, matchId, result) });
    }
    navigate(`/turnieje/${id}`);
  }

  if (!isOwner) {
    return <LiveMatchViewer match={match} onClose={() => navigate(`/turnieje/${id}`)} />;
  }

  return (
    <LiveMatchScreen
      match={match}
      matchFormat={bracket.matchFormat}
      isOwner={isOwner}
      onClose={() => navigate(`/turnieje/${id}`)}
      onScoreEntered={handleScoreEntered}
      onLegComplete={handleLegComplete}
      onResult={handleResult}
    />
  );
}
