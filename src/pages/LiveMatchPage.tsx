import { useRef } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRecordMatchResult, useTournament, useUpdateMatchLeg } from '../hooks/useTournaments';
import { LiveMatchScreen } from '../components/match/LiveMatchScreen';
import { LiveMatchViewer } from '../components/match/LiveMatchViewer';
import { findMatch, matchFormatOf } from '../utils/bracket';
import { computeMatchStats } from '../utils/statistics';
import { statisticsApi } from '../api/statistics';
import type { CurrentLeg, LegRecord, LegRound } from '../types/bracket';

export function LiveMatchPage() {
  const { id, matchId } = useParams<{ id: string; matchId: string }>();
  const navigate         = useNavigate();
  const { data: tournament, isLoading } = useTournament(Number(id), 5000);
  const recordResult     = useRecordMatchResult();
  const updateMatchLeg   = useUpdateMatchLeg();
  const { username }     = useAuth();

  // Track completed legs locally so handleScoreEntered can send them alongside currentLeg
  const completedLegsRef = useRef<LegRecord[]>([]);

  // Captures once whether the match already had a result the moment this page
  // instance first saw it — set below, after `match` is known. Deliberately
  // *not* re-derived from the live polled/query-cache value on every render:
  // this session's own auto-save also makes `match.result` become truthy, and
  // if the "already decided" check re-read that live value it would redirect
  // away from the summary screen the instant the match it just finished saves.
  const initialResultRef = useRef<'unset' | boolean>('unset');

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

  const match = found;

  // Resolved by the server — a round (or playoff round) can override the
  // tournament default via the Fazy step.
  const matchFormat = matchFormatOf(match, bracket);

  if (initialResultRef.current === 'unset') {
    initialResultRef.current = !!match.result;
  }

  // Match already had a recorded result when this page was first opened — most
  // commonly reached via the browser's back button (or a swipe-back gesture)
  // after leaving a finished match's summary screen. There must be no way back
  // into the live/editable keyboard screen for a match that's already decided.
  if (initialResultRef.current) {
    return <Navigate to={`/turnieje/${id}`} replace />;
  }

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

  // Fires automatically the instant the match is won (see useMatchEngine's
  // auto-save effect) — must not navigate away, since the summary screen is
  // still showing; leaving the page is the "Zamknij" button's job (onClose).
  //
  // `live: true` lets the server release this screen's own live-leg lock in
  // the same transaction that saves the result, so a bot-vs-bot "Symuluj na
  // żywo" can't be raced by a second device's "Symuluj" / "Wpisz wynik".
  function handleResult(topLegs: number, bottomLegs: number) {
    if (!matchId) return;
    recordResult.mutate({
      id: Number(id), matchId,
      top_score: topLegs, bottom_score: bottomLegs,
      legs: completedLegsRef.current, live: true,
    });
  }

  if (!isOwner) {
    return <LiveMatchViewer match={match} onClose={() => navigate(`/turnieje/${id}`)} />;
  }

  return (
    <LiveMatchScreen
      match={match}
      matchFormat={matchFormat}
      isOwner={isOwner}
      onClose={() => navigate(`/turnieje/${id}`)}
      onScoreEntered={handleScoreEntered}
      onLegComplete={handleLegComplete}
      onResult={handleResult}
    />
  );
}
