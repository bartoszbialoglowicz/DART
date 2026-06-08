import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTournament, useUpdateTournament } from '../hooks/useTournaments';
import { LiveMatchScreen } from '../components/bracket/LiveMatchScreen';
import { LiveMatchViewer } from '../components/bracket/LiveMatchViewer';
import { buildManualResult } from '../utils/simulate';
import {
  applyResult, setMatchCurrentLeg, setMatchLegs,
  applyGroupMatchResult, setGroupMatchLegs, setGroupMatchCurrentLeg,
} from '../utils/bracket';
import { computeMatchStats } from '../utils/statistics';
import { statisticsApi } from '../api/statistics';
import type { BracketData, BracketMatch, LegRecord, LegRound } from '../types/bracket';

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
  }

  return null;
}

export function LiveMatchPage() {
  const { id, matchId } = useParams<{ id: string; matchId: string }>();
  const navigate         = useNavigate();
  const { data: tournament, isLoading } = useTournament(Number(id), 5000);
  const updateTournament = useUpdateTournament();
  const { username }     = useAuth();

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-brand-black">
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

  function handleScoreEntered(rounds: LegRound[], activePlayer: 0 | 1) {
    if (!bracket || !matchId) return;
    if (ctx.kind === 'knockout' && bracket.format === 'knockout') {
      updateTournament.mutate({ id: Number(id), bracket: setMatchCurrentLeg(bracket, matchId, { rounds, activePlayer }) });
    } else if (ctx.kind === 'group' && bracket.format === 'groups') {
      updateTournament.mutate({ id: Number(id), bracket: setGroupMatchCurrentLeg(bracket, ctx.groupId, matchId, { rounds, activePlayer }) });
    }
  }

  function handleLegComplete(legs: LegRecord[], rounds: LegRound[], activePlayer: 0 | 1) {
    if (!bracket || !matchId) return;

    const stats = computeMatchStats(matchId, legs, [
      match.top.playerName    ?? 'Gracz 1',
      match.bottom.playerName ?? 'Gracz 2',
    ]);
    statisticsApi.save(Number(id), stats).catch(console.error);

    if (ctx.kind === 'knockout' && bracket.format === 'knockout') {
      let updated = setMatchLegs(bracket, matchId, legs);
      updated     = setMatchCurrentLeg(updated, matchId, { rounds, activePlayer });
      updateTournament.mutate({ id: Number(id), bracket: updated });
    } else if (ctx.kind === 'group' && bracket.format === 'groups') {
      let updated = setGroupMatchLegs(bracket, ctx.groupId, matchId, legs);
      updated     = setGroupMatchCurrentLeg(updated, ctx.groupId, matchId, { rounds, activePlayer });
      updateTournament.mutate({ id: Number(id), bracket: updated });
    }
  }

  function handleResult(topLegs: number, bottomLegs: number) {
    if (!bracket || !matchId) return;
    const result = buildManualResult(topLegs, bottomLegs, bracket.matchFormat);

    if (ctx.kind === 'knockout' && bracket.format === 'knockout') {
      updateTournament.mutate({ id: Number(id), bracket: applyResult(bracket, matchId, result) });
    } else if (ctx.kind === 'group' && bracket.format === 'groups') {
      updateTournament.mutate({ id: Number(id), bracket: applyGroupMatchResult(bracket, ctx.groupId, matchId, result) });
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
