import { useEffect, useRef, useState } from 'react';
import { useIsMutating } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Bracket } from '../components/bracket/Bracket';
import { TournamentStats } from '../components/bracket/TournamentStats';
import { buildManualResult, simulateMatch } from '../utils/simulate';
import { applyResult, applyGroupMatchResult, applyPlayoffResult, generatePlayoffFromGroups } from '../utils/bracket';
import { computeMatchStats } from '../utils/statistics';
import { statisticsApi } from '../api/statistics';
import { useTournament, useUpdateTournament } from '../hooks/useTournaments';
import { Button } from '../components/ui/Button';
import { cn } from '../components/ui/cn';
import type { BracketData } from '../types/bracket';

type Tab = 'bracket' | 'stats';

export function TournamentPage() {
  const { id }        = useParams<{ id: string }>();
  const tournamentId  = Number(id);
  const navigate      = useNavigate();

  const { data: tournament, isLoading } = useTournament(tournamentId, 5000);
  const updateTournament = useUpdateTournament();
  const { username }     = useAuth();
  const isOwner          = !!username && username === tournament?.owner_username;
  const isMutating       = useIsMutating();

  const [bracket,   setBracket]   = useState<BracketData | null>(null);
  const [tab,       setTab]       = useState<Tab>('bracket');
  const [statsError, setStatsError] = useState<string | null>(null);
  const initialized                 = useRef(false);

  useEffect(() => {
    if (!tournament) return;
    if (!initialized.current) {
      setBracket(tournament.bracket);
      initialized.current = true;
      return;
    }
    if (isMutating === 0) {
      setBracket(tournament.bracket);
    }
  }, [tournament, isMutating]);

  function saveBracket(updated: BracketData) {
    setBracket(updated);
    updateTournament.mutate({ id: tournamentId, bracket: updated });
  }

  function saveStats(
    matchId: string,
    top:     { playerName: string | null; playerId?: number | null },
    bottom:  { playerName: string | null; playerId?: number | null },
    legs:    ReturnType<typeof simulateMatch>['legs'],
  ) {
    const stats = computeMatchStats(
      matchId, legs,
      [top.playerName ?? 'Gracz 1', bottom.playerName ?? 'Gracz 2'],
      [top.playerId ?? null,         bottom.playerId ?? null],
    );
    statisticsApi.save(tournamentId, stats).catch((err) => {
      console.error('Błąd zapisu statystyk:', err);
      setStatsError('Nie udało się zapisać statystyk dla jednego z meczy. Sprawdź konsolę po szczegóły.');
    });
  }

  // ── Knockout ────────────────────────────────────────────────

  function handleSimulate(matchId: string) {
    if (!bracket) return;

    if (bracket.format === 'knockout') {
      const [rPart, mPart] = matchId.split('-');
      const match = bracket.rounds[parseInt(rPart.slice(1))]?.matches[parseInt(mPart.slice(1))];
      if (!match) return;
      const { result, legs } = simulateMatch(match.top, match.bottom, bracket.matchFormat);
      saveBracket(applyResult(bracket, matchId, result));
      saveStats(matchId, match.top, match.bottom, legs);
      return;
    }

    if (bracket.format === 'groups' && bracket.playoff) {
      const [rPart, mPart] = matchId.split('-');
      const match = bracket.playoff.rounds[parseInt(rPart.slice(1))]?.matches[parseInt(mPart.slice(1))];
      if (!match) return;
      const { result, legs } = simulateMatch(match.top, match.bottom, bracket.matchFormat);
      saveBracket(applyPlayoffResult(bracket, matchId, result));
      saveStats(matchId, match.top, match.bottom, legs);
    }
  }

  function handleEnterResult(matchId: string, topScore: number, bottomScore: number) {
    if (!bracket) return;
    const result = buildManualResult(topScore, bottomScore, bracket.matchFormat);
    if (bracket.format === 'knockout') {
      saveBracket(applyResult(bracket, matchId, result));
    } else if (bracket.format === 'groups' && bracket.playoff) {
      saveBracket(applyPlayoffResult(bracket, matchId, result));
    }
  }

  // ── Groups ──────────────────────────────────────────────────

  function handleSimulateGroupMatch(groupId: string, matchId: string) {
    if (!bracket || bracket.format !== 'groups') return;
    const group = bracket.groups.find(g => g.id === groupId);
    const match = group?.matches?.find(m => m.id === matchId);
    if (!group || !match) return;
    const { result, legs } = simulateMatch(match.top, match.bottom, bracket.matchFormat);
    saveBracket(applyGroupMatchResult(bracket, groupId, matchId, result));
    saveStats(matchId, match.top, match.bottom, legs);
  }

  function handleEnterGroupResult(groupId: string, matchId: string, topScore: number, bottomScore: number) {
    if (!bracket || bracket.format !== 'groups') return;
    const result = buildManualResult(topScore, bottomScore, bracket.matchFormat);
    saveBracket(applyGroupMatchResult(bracket, groupId, matchId, result));
  }

  function handleGeneratePlayoff() {
    if (!bracket || bracket.format !== 'groups') return;
    saveBracket({ ...bracket, playoff: { rounds: generatePlayoffFromGroups(bracket.groups) } });
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
          <h2 className="text-base font-semibold text-content-primary">{bracket.name}</h2>
          <p className="mt-0.5 text-xs text-content-secondary">
            {bracket.format === 'knockout' ? 'SKO' : 'Grupy'} · {bracket.playerCount} graczy · BO{bracket.matchFormat.sets} set · BO{bracket.matchFormat.legs} leg
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => navigate('/turnieje')}>
          Wróć do listy
        </Button>
      </div>

      {statsError && (
        <div className="flex items-center justify-between gap-4 border-b border-border-subtle bg-score-down-soft px-8 py-2">
          <p className="text-xs text-score-down-text">{statsError}</p>
          <button
            type="button"
            onClick={() => setStatsError(null)}
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
          onSimulate={handleSimulate}
          onEnterResult={handleEnterResult}
          onSimulateGroup={handleSimulateGroupMatch}
          onEnterGroupResult={handleEnterGroupResult}
          onGeneratePlayoff={handleGeneratePlayoff}
        />
      ) : (
        <TournamentStats tournamentId={tournamentId} bracket={bracket} isActive={tournament?.is_active ?? true} />
      )}
    </div>
  );
}
