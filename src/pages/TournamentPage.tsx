import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Bracket } from '../components/bracket/Bracket';
import { TournamentStats } from '../components/bracket/TournamentStats';
import { simulateMatch } from '../utils/simulate';
import { findMatch, headlineScore, matchFormatOf } from '../utils/bracket';
import { aggregatePlayerStats, computeMatchStats } from '../utils/statistics';
import { statisticsApi } from '../api/statistics';
import { ApiError } from '../api/client';
import {
  useAdvanceGroups, useConfirmTournamentDraft, useRecordMatchResult, useRedrawTournament,
  useTournament, useTournamentStatistics,
} from '../hooks/useTournaments';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { cn } from '../components/ui/cn';
import type { BracketMatch, LegRecord } from '../types/bracket';

type Tab = 'bracket' | 'stats';

function errorText(err: unknown): string {
  return err instanceof ApiError ? err.detail : err instanceof Error ? err.message : String(err);
}

export function TournamentPage() {
  const { id }        = useParams<{ id: string }>();
  const tournamentId  = Number(id);
  const navigate      = useNavigate();

  const { data: tournament, isLoading, isError } = useTournament(tournamentId, 5000);
  const recordResult  = useRecordMatchResult();
  const confirmDraft  = useConfirmTournamentDraft();
  const redraw        = useRedrawTournament();
  const advanceGroups = useAdvanceGroups();
  const { username }  = useAuth();
  const isOwner       = !!username && username === tournament?.owner_username;

  // Tournament-scoped average per player — same figure as the "Statystyki" tab,
  // shown on bracket cards only for players who have actually played here (a
  // player's static profile average must never be shown as if it were this
  // tournament's).
  const { data: statRecords } = useTournamentStatistics(tournamentId, tournament?.is_active ? 5000 : undefined);
  const avgByName = new Map(aggregatePlayerStats(statRecords ?? []).map(r => [r.player_name, r.match_average]));

  const [tab,         setTab]         = useState<Tab>('bracket');
  const [actionError, setActionError] = useState<string | null>(null);

  const bracket = tournament?.bracket ?? null;

  // Every bracket change is a server command that returns the updated
  // tournament; failures (e.g. a result already saved from another device)
  // surface in the banner below the header.
  const onCommandError = { onError: (err: unknown) => setActionError(errorText(err)) };

  function saveStats(matchId: string, match: BracketMatch, legs: LegRecord[]) {
    const stats = computeMatchStats(
      matchId, legs,
      [match.top.playerName ?? 'Gracz 1', match.bottom.playerName ?? 'Gracz 2'],
      [match.top.playerId ?? null,         match.bottom.playerId ?? null],
    );
    statisticsApi.save(tournamentId, stats).catch((err) => {
      console.error('Błąd zapisu statystyk:', err);
      setActionError('Nie udało się zapisać statystyk dla jednego z meczy. Sprawdź konsolę po szczegóły.');
    });
  }

  function handleSimulate(matchId: string) {
    const match = findMatch(bracket ?? undefined, matchId);
    if (!bracket || !match) return;
    const matchFormat = matchFormatOf(match, bracket);
    const { result, legs } = simulateMatch(match.top, match.bottom, matchFormat);
    const score = headlineScore(result, legs, matchFormat);
    recordResult.mutate(
      { id: tournamentId, matchId, top_score: score.top, bottom_score: score.bottom, legs },
      { ...onCommandError, onSuccess: () => saveStats(matchId, match, legs) },
    );
  }

  function handleEnterResult(matchId: string, topScore: number, bottomScore: number) {
    recordResult.mutate({ id: tournamentId, matchId, top_score: topScore, bottom_score: bottomScore }, onCommandError);
  }

  function handleGeneratePlayoff() {
    advanceGroups.mutate(tournamentId, onCommandError);
  }

  function handleRedraw() {
    redraw.mutate(tournamentId, onCommandError);
  }

  function handleConfirm() {
    if (!confirm('Zatwierdzić drabinkę? Nie będzie można jej ponownie wylosować.')) return;
    confirmDraft.mutate(tournamentId, onCommandError);
  }

  if (isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <p className="text-sm text-content-secondary">
          Turniej nie istnieje albo jest prywatny i nie masz do niego dostępu.
        </p>
        <Button variant="secondary" size="sm" onClick={() => navigate('/turnieje')}>
          Wróć do listy
        </Button>
      </div>
    );
  }

  if (isLoading || !bracket) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-sm text-content-secondary">Ładowanie...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-border-subtle px-8 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-content-primary">{bracket.name}</h2>
            {!tournament?.bracket_confirmed && <Badge variant="neutral">Szkic</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-content-secondary">
            {bracket.format === 'knockout' ? 'SKO' : 'Grupy'} · {bracket.playerCount} graczy · BO{bracket.matchFormat.sets} set · BO{bracket.matchFormat.legs} leg
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && !tournament?.bracket_confirmed && (
            <>
              <Button variant="secondary" size="sm" onClick={handleRedraw}>
                Losuj ponownie
              </Button>
              <Button variant="primary" size="sm" onClick={handleConfirm}>
                Zatwierdź
              </Button>
            </>
          )}
          <Button variant="secondary" size="sm" onClick={() => navigate('/turnieje')}>
            Wróć do listy
          </Button>
        </div>
      </div>

      {actionError && (
        <div className="flex items-center justify-between gap-4 border-b border-border-subtle bg-score-down-soft px-8 py-2">
          <p className="text-xs text-score-down-text">{actionError}</p>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="shrink-0 text-xs text-score-down-text opacity-70 transition-opacity hover:opacity-100"
            aria-label="Zamknij"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex shrink-0 gap-6 border-b border-border-subtle px-8">
        {(['bracket', 'stats'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'border-b-2 py-3 text-xs font-medium transition-colors',
              tab === t
                ? 'border-content-accent text-content-primary'
                : 'border-transparent text-content-secondary hover:text-content-primary',
            )}
          >
            {t === 'bracket' ? 'Mecze' : 'Statystyki'}
          </button>
        ))}
      </div>

      {tab === 'bracket' ? (
        <Bracket
          data={bracket}
          isOwner={isOwner}
          confirmed={tournament?.bracket_confirmed ?? false}
          avgByName={avgByName}
          onSimulate={handleSimulate}
          onEnterResult={handleEnterResult}
          onSimulateGroup={(_, matchId) => handleSimulate(matchId)}
          onEnterGroupResult={(_, matchId, top, bottom) => handleEnterResult(matchId, top, bottom)}
          onGeneratePlayoff={handleGeneratePlayoff}
        />
      ) : (
        <TournamentStats tournamentId={tournamentId} bracket={bracket} isActive={tournament?.is_active ?? true} />
      )}
    </div>
  );
}
