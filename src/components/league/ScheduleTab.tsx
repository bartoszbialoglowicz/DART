import { useState } from 'react';
import {
  useGenerateSchedule,
  useClearSchedule,
  useUpdateMatch,
  useSetMatchdayDate,
} from '../../hooks/useLeagues';
import type { LeagueMatch } from '../../types/league';
import { fmtDate } from '../../utils/formatting';

type Props = {
  leagueId:    number;
  matches:     LeagueMatch[];
  scoreLabel:  string;
  isDraft:     boolean;
  matchCount:  number;
  memberCount: number;
};

export function ScheduleTab({ leagueId, matches, scoreLabel, isDraft, matchCount, memberCount }: Props) {
  const generateSchedule  = useGenerateSchedule(leagueId);
  const clearSchedule     = useClearSchedule(leagueId);
  const updateMatch       = useUpdateMatch(leagueId);
  const setMatchdayDate   = useSetMatchdayDate(leagueId);

  const [editing, setEditing]           = useState<number | null>(null);
  const [homeScore, setHomeScore]       = useState('');
  const [awayScore, setAwayScore]       = useState('');
  const [editingDay, setEditingDay]     = useState<number | null>(null);
  const [dayDateInput, setDayDateInput] = useState('');

  const hasSchedule = matchCount > 0;

  const byMatchday = matches.reduce<Record<number, LeagueMatch[]>>((acc, m) => {
    acc[m.matchday] ??= [];
    acc[m.matchday].push(m);
    return acc;
  }, {});

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
    setMatchdayDate.mutate(
      { matchday, date: dayDateInput || null },
      { onSuccess: () => setEditingDay(null) },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-content-secondary">
          {hasSchedule
            ? `${matches.length} meczów · ${Object.keys(byMatchday).length} kolejek`
            : 'Terminarz nie został jeszcze wygenerowany.'}
        </p>
        <div className="flex gap-2">
          {!hasSchedule ? (
            <button
              type="button"
              onClick={() => generateSchedule.mutate()}
              disabled={memberCount < 2 || generateSchedule.isPending}
              title={memberCount < 2 ? 'Dodaj co najmniej 2 graczy' : undefined}
              className="rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-brand-white transition-opacity disabled:opacity-40 hover:bg-brand-purple/80"
            >
              {generateSchedule.isPending ? 'Generowanie…' : 'Generuj terminarz'}
            </button>
          ) : isDraft && (
            <button
              type="button"
              onClick={() => { if (confirm('Usunąć cały terminarz?')) clearSchedule.mutate(); }}
              disabled={clearSchedule.isPending}
              className="rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:border-red-500/60"
            >
              Usuń terminarz
            </button>
          )}
        </div>
      </div>

      {/* Matchday sections */}
      {Object.entries(byMatchday).map(([day, dayMatches]) => {
        const matchday   = Number(day);
        const sharedDate = dayMatches[0]?.scheduled_at ?? null;
        const dateStr    = sharedDate ? sharedDate.slice(0, 10) : null;

        return (
          <div key={day} className="rounded-xl border border-border-subtle overflow-hidden">
            {/* Matchday header */}
            <div className="flex items-center justify-between gap-4 border-b border-border-subtle bg-white/3 px-4 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-widest text-content-secondary">
                Kolejka {day}
              </span>

              {/* Date picker */}
              {editingDay === matchday ? (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={dayDateInput}
                    onChange={e => setDayDateInput(e.target.value)}
                    autoFocus
                    className="rounded border border-border-subtle bg-brand-black px-2 py-1 text-xs text-brand-white focus:border-brand-purple focus:outline-none [color-scheme:dark]"
                  />
                  <button type="button" onClick={() => saveDayDate(matchday)}
                    disabled={setMatchdayDate.isPending}
                    className="text-xs font-bold text-brand-purple hover:text-brand-white transition-colors">
                    ✓
                  </button>
                  <button type="button" onClick={() => setEditingDay(null)}
                    className="text-xs text-content-secondary hover:text-brand-white transition-colors">
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => openDayEdit(matchday, sharedDate)}
                  className="flex items-center gap-1.5 text-xs text-content-secondary hover:text-brand-white transition-colors"
                >
                  {dateStr ? (
                    <span className="font-medium text-brand-white">{fmtDate(dateStr)}</span>
                  ) : (
                    <span className="opacity-50">Ustaw datę</span>
                  )}
                  <span className="opacity-40">✎</span>
                </button>
              )}
            </div>

            {/* Matches */}
            <div className="flex flex-col divide-y divide-border-subtle/50">
              {dayMatches.map(match => (
                <div key={match.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex-1 text-right text-sm font-medium text-brand-white">{match.home_name}</span>

                  <div className="w-28 shrink-0 text-center">
                    {editing === match.id ? (
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number" min={0} value={homeScore}
                          onChange={e => setHomeScore(e.target.value)}
                          className="w-10 rounded border border-border-subtle bg-brand-black px-1.5 py-1 text-center text-sm text-brand-white focus:border-brand-purple focus:outline-none"
                        />
                        <span className="text-content-secondary">-</span>
                        <input
                          type="number" min={0} value={awayScore}
                          onChange={e => setAwayScore(e.target.value)}
                          className="w-10 rounded border border-border-subtle bg-brand-black px-1.5 py-1 text-center text-sm text-brand-white focus:border-brand-purple focus:outline-none"
                        />
                        <button type="button" onClick={() => saveResult(match.id)} disabled={updateMatch.isPending}
                          className="ml-1 text-xs font-bold text-brand-purple hover:text-brand-white transition-colors px-1">
                          ✓
                        </button>
                        <button type="button" onClick={() => setEditing(null)}
                          className="text-xs text-content-secondary hover:text-brand-white transition-colors px-1">
                          ✕
                        </button>
                      </div>
                    ) : match.status === 'finished' ? (
                      <button type="button" onClick={() => startEdit(match)}
                        className="group text-sm font-bold tabular-nums text-brand-white hover:text-brand-purple transition-colors"
                        title="Edytuj wynik">
                        {match.home_score}
                        <span className="mx-1 text-content-secondary">-</span>
                        {match.away_score}
                        <span className="ml-1 text-[10px] opacity-0 group-hover:opacity-60 transition-opacity">{scoreLabel}</span>
                      </button>
                    ) : (
                      <button type="button" onClick={() => startEdit(match)}
                        className="rounded-lg border border-dashed border-border-subtle px-3 py-1 text-xs text-content-secondary hover:border-brand-purple/50 hover:text-brand-white transition-colors">
                        Wpisz wynik
                      </button>
                    )}
                  </div>

                  <span className="flex-1 text-sm font-medium text-brand-white">{match.away_name}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
