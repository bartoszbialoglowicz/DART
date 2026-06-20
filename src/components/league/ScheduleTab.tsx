import { useState } from 'react';
import {
  useGenerateSchedule,
  useClearSchedule,
  useUpdateMatch,
  useSetMatchdayDate,
} from '../../hooks/useLeagues';
import type { LeagueMatch } from '../../types/league';
import { fmtDate } from '../../utils/formatting';
import { ScheduleAutofillModal, type RoundInfo } from './ScheduleAutofillModal';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

type Props = {
  leagueId:        number;
  matches:         LeagueMatch[];
  scoreLabel:      string;
  isDraft:         boolean;
  matchCount:      number;
  memberCount:     number;
  isOwner:         boolean;
  currentMemberId: number | null;
};

export function ScheduleTab({ leagueId, matches, scoreLabel, isDraft, matchCount, memberCount, isOwner, currentMemberId }: Props) {
  const generateSchedule  = useGenerateSchedule(leagueId);
  const clearSchedule     = useClearSchedule(leagueId);
  const updateMatch       = useUpdateMatch(leagueId);
  const setMatchdayDate   = useSetMatchdayDate(leagueId);

  const [editing, setEditing]           = useState<number | null>(null);
  const [homeScore, setHomeScore]       = useState('');
  const [awayScore, setAwayScore]       = useState('');
  const [editingDay, setEditingDay]     = useState<number | null>(null);
  const [dayDateInput, setDayDateInput] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [autofill, setAutofill]         = useState<{ round: number; date: string } | null>(null);

  const hasSchedule = matchCount > 0;

  const byMatchday = matches.reduce<Record<number, LeagueMatch[]>>((acc, m) => {
    acc[m.matchday] ??= [];
    acc[m.matchday].push(m);
    return acc;
  }, {});

  const matchdays = Object.keys(byMatchday).map(Number).sort((a, b) => a - b);
  const rounds: RoundInfo[] = matchdays.map(md => ({ round: md, label: `Kolejka ${md}` }));
  const canSpread = rounds.length > 1;

  const firstDatedDay = matchdays.find(md => byMatchday[md][0]?.scheduled_at);
  const manualAnchor  = firstDatedDay != null
    ? { round: firstDatedDay, date: byMatchday[firstDatedDay][0].scheduled_at!.slice(0, 10) }
    : null;

  function startEdit(match: LeagueMatch) {
    setEditing(match.id);
    setHomeScore(match.home_score !== null ? String(match.home_score) : '');
    setAwayScore(match.away_score !== null ? String(match.away_score) : '');
  }

  function saveResult(matchId: number) {
    const hs  = parseInt(homeScore, 10);
    const as_ = parseInt(awayScore, 10);
    if (isNaN(hs) || isNaN(as_)) return;
    updateMatch.mutate(
      { matchId, data: { home_score: hs, away_score: as_ } },
      { onSuccess: () => setEditing(null) },
    );
  }

  function openDayEdit(matchday: number, currentDate: string | null) {
    setEditingDay(matchday);
    setDayDateInput(currentDate ? currentDate.slice(0, 10) : '');
  }

  function saveDayDate(matchday: number) {
    const date = dayDateInput || null;
    // Was the whole schedule still dateless before this edit? (decides the auto-offer)
    const wasEmpty = !matches.some(m => m.scheduled_at);
    setMatchdayDate.mutate(
      { matchday, date },
      { onSuccess: () => {
        setEditingDay(null);
        if (date && wasEmpty && canSpread) setAutofill({ round: matchday, date });
      } },
    );
  }

  function applyAutofill(dates: { round: number; date: string }[]) {
    dates.forEach(({ round, date }) => setMatchdayDate.mutate({ matchday: round, date }));
    setAutofill(null);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-content-secondary">
          {hasSchedule
            ? `${matches.length} meczów · ${matchdays.length} kolejek`
            : 'Terminarz nie został jeszcze wygenerowany.'}
        </p>
        <div className="flex gap-2">
          {!hasSchedule ? (
            <Button
              variant="primary"
              loading={generateSchedule.isPending}
              disabled={memberCount < 2 || generateSchedule.isPending}
              title={memberCount < 2 ? 'Dodaj co najmniej 2 graczy' : undefined}
              onClick={() => generateSchedule.mutate()}
            >
              Generuj terminarz
            </Button>
          ) : (
            <>
              {isOwner && canSpread && manualAnchor && (
                <Button variant="secondary" onClick={() => setAutofill(manualAnchor)}>
                  Rozstaw daty
                </Button>
              )}
              {isDraft && (
                <Button variant="danger" onClick={() => setConfirmClear(true)}>
                  Usuń terminarz
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Matchday sections */}
      {matchdays.map(matchday => {
        const dayMatches = byMatchday[matchday];
        const sharedDate = dayMatches[0]?.scheduled_at ?? null;
        const dateStr    = sharedDate ? sharedDate.slice(0, 10) : null;

        return (
          <div key={matchday} className="overflow-hidden rounded-xl border border-border-subtle">
            {/* Matchday header */}
            <div className="flex items-center justify-between gap-4 border-b border-border-subtle bg-surface-overlay px-4 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-widest text-content-secondary">
                Kolejka {matchday}
              </span>

              {/* Date picker */}
              {editingDay === matchday ? (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={dayDateInput}
                    onChange={e => setDayDateInput(e.target.value)}
                    autoFocus
                    className="scheme-dark rounded-lg border border-border-subtle bg-surface-muted px-2 py-1 text-xs text-content-primary outline-none focus:border-border-accent"
                  />
                  <button type="button" onClick={() => saveDayDate(matchday)}
                    disabled={setMatchdayDate.isPending}
                    className="text-xs font-bold text-content-accent transition-colors hover:text-content-primary">
                    ✓
                  </button>
                  <button type="button" onClick={() => setEditingDay(null)}
                    className="text-xs text-content-secondary transition-colors hover:text-content-primary">
                    ✕
                  </button>
                </div>
              ) : isOwner ? (
                <button
                  type="button"
                  onClick={() => openDayEdit(matchday, sharedDate)}
                  className="flex items-center gap-1.5 text-xs text-content-secondary transition-colors hover:text-content-primary"
                >
                  {dateStr ? (
                    <span className="font-medium text-content-primary">{fmtDate(dateStr)}</span>
                  ) : (
                    <span className="text-content-faint">Ustaw datę</span>
                  )}
                  <span className="text-content-faint">✎</span>
                </button>
              ) : (
                dateStr ? <span className="text-xs font-medium text-content-primary">{fmtDate(dateStr)}</span> : null
              )}
            </div>

            {/* Matches */}
            <div className="flex flex-col divide-y divide-border-subtle">
              {dayMatches.map(match => (
                <div key={match.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex-1 text-right text-sm font-medium text-content-primary">{match.home_name}</span>

                  <div className="w-28 shrink-0 text-center">
                    {isDraft ? (
                      <span className="text-xs text-content-faint">vs</span>
                    ) : editing === match.id ? (
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number" min={0} value={homeScore}
                          onChange={e => setHomeScore(e.target.value)}
                          className="w-10 rounded-lg border border-border-subtle bg-surface-muted px-1.5 py-1 text-center text-sm text-content-primary outline-none focus:border-border-accent"
                        />
                        <span className="text-content-secondary">-</span>
                        <input
                          type="number" min={0} value={awayScore}
                          onChange={e => setAwayScore(e.target.value)}
                          className="w-10 rounded-lg border border-border-subtle bg-surface-muted px-1.5 py-1 text-center text-sm text-content-primary outline-none focus:border-border-accent"
                        />
                        <button type="button" onClick={() => saveResult(match.id)} disabled={updateMatch.isPending}
                          className="ml-1 px-1 text-xs font-bold text-content-accent transition-colors hover:text-content-primary">
                          ✓
                        </button>
                        <button type="button" onClick={() => setEditing(null)}
                          className="px-1 text-xs text-content-secondary transition-colors hover:text-content-primary">
                          ✕
                        </button>
                      </div>
                    ) : match.status === 'finished' ? (
                      isOwner || match.home === currentMemberId || match.away === currentMemberId ? (
                        <button type="button" onClick={() => startEdit(match)}
                          className="group font-display text-sm font-bold tabular-nums text-content-primary transition-colors hover:text-content-accent"
                          title="Edytuj wynik">
                          {match.home_score}
                          <span className="mx-1 text-content-secondary">-</span>
                          {match.away_score}
                          <span className="ml-1 text-xs opacity-0 transition-opacity group-hover:opacity-60">{scoreLabel}</span>
                        </button>
                      ) : (
                        <span className="font-display text-sm font-bold tabular-nums text-content-primary">
                          {match.home_score}<span className="mx-1 text-content-secondary">-</span>{match.away_score}
                        </span>
                      )
                    ) : (
                      isOwner || match.home === currentMemberId || match.away === currentMemberId ? (
                        <button type="button" onClick={() => startEdit(match)}
                          className="rounded-lg border border-dashed border-border-subtle px-3 py-1 text-xs text-content-secondary transition-colors hover:bg-surface-muted hover:text-content-primary">
                          Wpisz wynik
                        </button>
                      ) : (
                        <span className="text-xs text-content-faint">vs</span>
                      )
                    )}
                  </div>

                  <span className="flex-1 text-sm font-medium text-content-primary">{match.away_name}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Autofill modal */}
      {autofill && (
        <ScheduleAutofillModal
          anchorRound={autofill.round}
          anchorDate={autofill.date}
          rounds={rounds}
          onConfirm={applyAutofill}
          onClose={() => setAutofill(null)}
        />
      )}

      {/* Clear-schedule confirmation */}
      {confirmClear && (
        <Modal title="Usunąć terminarz?" size="xs" onClose={() => setConfirmClear(false)}>
          <p className="text-sm text-content-secondary">
            Cały terminarz zostanie usunięty wraz z datami kolejek. Tej operacji nie można cofnąć.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>Anuluj</Button>
            <Button
              variant="danger"
              loading={clearSchedule.isPending}
              onClick={() => clearSchedule.mutate(undefined, { onSuccess: () => setConfirmClear(false) })}
            >
              Usuń terminarz
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
