import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMyStats } from '../hooks/usePlayers';
import { useAddTrainingSession, useDeleteTrainingSession, useTrainingSessions } from '../hooks/useTraining';

export function ProfilePage() {
  const { username } = useAuth();
  const { data, isLoading, isError } = useMyStats();

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-sm text-content-secondary">Ładowanie...</span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-sm text-content-secondary">Nie udało się załadować profilu.</span>
      </div>
    );
  }

  const { player, stats } = data;

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8 space-y-10">

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-purple/20 text-2xl font-black text-brand-purple select-none">
          {player.first_name[0]}{player.last_name[0]}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-brand-white">
            {player.first_name} {player.last_name}
          </h1>
          <p className="mt-0.5 text-sm text-content-secondary">@{username}</p>
        </div>
      </div>

      {/* ── Match stats ──────────────────────────────────────── */}
      <section>
        <SectionLabel>Statystyki turniejowe</SectionLabel>
        {stats.matches_played === 0 ? (
          <EmptyNote>Brak rozegranych meczów turniejowych.</EmptyNote>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Mecze"         value={String(stats.matches_played)} />
            <StatCard label="Średnia"        value={stats.match_average > 0 ? stats.match_average.toFixed(2) : '—'} />
            <StatCard label="% na doublach"  value={stats.double_accuracy !== null ? `${stats.double_accuracy}%` : '—'} />
            <StatCard label="Lotki / leg"    value={stats.darts_per_leg > 0 ? stats.darts_per_leg.toFixed(1) : '—'} />
            <StatCard label="180"            value={String(stats.count_180)} />
            <StatCard label="Highfinishe"    value={String(stats.high_checkouts)} />
          </div>
        )}
      </section>

      {/* ── Training ─────────────────────────────────────────── */}
      <TrainingSection />
    </div>
  );
}

// ── Training section ──────────────────────────────────────────────────────────

function TrainingSection() {
  const { data: sessions = [], isLoading } = useTrainingSessions();
  const addSession    = useAddTrainingSession();
  const deleteSession = useDeleteTrainingSession();
  const [formOpen, setFormOpen] = useState(false);

  const totalLegs    = sessions.reduce((s, r) => s + r.legs, 0);
  const weightedAvg  = totalLegs > 0
    ? sessions.reduce((s, r) => s + r.average * r.legs, 0) / totalLegs
    : null;
  const bestAvg      = sessions.length > 0 ? Math.max(...sessions.map(r => r.average)) : null;

  function handleAdd(payload: { played_at: string; average: number; legs: number; notes: string }) {
    addSession.mutate(payload, { onSuccess: () => setFormOpen(false) });
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <SectionLabel className="mb-0">Treningi</SectionLabel>
        <button
          type="button"
          onClick={() => setFormOpen(o => !o)}
          className="rounded-lg border border-brand-purple/50 px-3 py-1.5 text-xs font-medium text-brand-white transition-colors hover:bg-brand-purple/10"
        >
          {formOpen ? 'Anuluj' : '+ Dodaj sesję'}
        </button>
      </div>

      {/* Add form */}
      {formOpen && (
        <AddSessionForm
          onSubmit={handleAdd}
          loading={addSession.isPending}
          error={addSession.isError ? 'Wystąpił błąd. Spróbuj ponownie.' : ''}
        />
      )}

      {/* Aggregate stats */}
      {sessions.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatCard label="Sesje"        value={String(sessions.length)} />
          <StatCard label="Śr. ważona"   value={weightedAvg !== null ? weightedAvg.toFixed(2) : '—'} />
          <StatCard label="Najlepsza"    value={bestAvg !== null ? bestAvg.toFixed(2) : '—'} />
        </div>
      )}

      {/* Session list */}
      {isLoading ? (
        <p className="text-sm text-content-secondary">Ładowanie...</p>
      ) : sessions.length === 0 && !formOpen ? (
        <EmptyNote>Brak zapisanych sesji treningowych.</EmptyNote>
      ) : sessions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {sessions.map(s => (
            <div
              key={s.id}
              className="flex items-center gap-3 rounded-xl border border-border-subtle bg-white/3 px-4 py-3"
            >
              <span className="w-24 shrink-0 text-xs text-content-secondary tabular-nums">
                {formatDate(s.played_at)}
              </span>
              <span className="flex-1 text-sm font-bold tabular-nums text-brand-white">
                {s.average.toFixed(2)}
              </span>
              <span className="text-xs text-content-secondary">
                {s.legs} {legsLabel(s.legs)}
              </span>
              {s.notes && (
                <span className="max-w-[120px] truncate text-xs text-content-secondary" title={s.notes}>
                  {s.notes}
                </span>
              )}
              <button
                type="button"
                aria-label="Usuń sesję"
                onClick={() => deleteSession.mutate(s.id)}
                className="ml-auto shrink-0 rounded p-1 text-content-secondary transition-colors hover:text-red-400"
              >
                <IconTrash />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

// ── Add session form ──────────────────────────────────────────────────────────

function AddSessionForm({
  onSubmit, loading, error,
}: {
  onSubmit: (p: { played_at: string; average: number; legs: number; notes: string }) => void;
  loading:  boolean;
  error:    string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [playedAt, setPlayedAt] = useState(today);
  const [average,  setAverage]  = useState('');
  const [legs,     setLegs]     = useState('1');
  const [notes,    setNotes]    = useState('');

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const avg = parseFloat(average);
    if (isNaN(avg) || avg <= 0 || avg > 180) return;
    onSubmit({ played_at: playedAt, average: avg, legs: Math.max(1, parseInt(legs) || 1), notes });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-5 rounded-xl border border-border-subtle bg-white/3 p-4 flex flex-col gap-3"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="text-xs font-medium text-content-secondary">Data</label>
          <input
            type="date"
            value={playedAt}
            max={today}
            onChange={e => setPlayedAt(e.target.value)}
            required
            className="rounded-lg border border-border-subtle bg-white/5 px-3 py-2 text-sm text-brand-white outline-none focus:border-brand-purple/60 [color-scheme:dark]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-content-secondary">Średnia</label>
          <input
            type="number"
            value={average}
            onChange={e => setAverage(e.target.value)}
            placeholder="40.50"
            step="0.01"
            min="1"
            max="180"
            required
            className="rounded-lg border border-border-subtle bg-white/5 px-3 py-2 text-sm text-brand-white outline-none focus:border-brand-purple/60"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-content-secondary">Legi</label>
          <input
            type="number"
            value={legs}
            onChange={e => setLegs(e.target.value)}
            min="1"
            max="999"
            required
            className="rounded-lg border border-border-subtle bg-white/5 px-3 py-2 text-sm text-brand-white outline-none focus:border-brand-purple/60"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-content-secondary">Notatki <span className="text-content-secondary/50">(opcjonalne)</span></label>
        <input
          type="text"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          maxLength={300}
          placeholder="np. trening checkoutów"
          className="rounded-lg border border-border-subtle bg-white/5 px-3 py-2 text-sm text-brand-white outline-none focus:border-brand-purple/60"
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={loading || !average}
        className="self-end rounded-lg bg-brand-purple/80 px-5 py-2 text-sm font-semibold text-brand-white transition-colors hover:bg-brand-purple disabled:opacity-50"
      >
        {loading ? '...' : 'Zapisz'}
      </button>
    </form>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SectionLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`mb-4 text-xs font-medium uppercase tracking-widest text-content-secondary ${className}`}>
      {children}
    </p>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-white/3 px-6 py-8 text-center">
      <p className="text-sm text-content-secondary">{children}</p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-white/3 p-4">
      <p className="text-xs text-content-secondary">{label}</p>
      <p className="mt-1.5 text-3xl font-black tabular-nums text-brand-white">{value}</p>
    </div>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function legsLabel(n: number): string {
  if (n === 1) return 'leg';
  if (n >= 2 && n <= 4) return 'legi';
  return 'legów';
}

function IconTrash() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h11M6 4V2.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5V4M5 4l.5 8.5M10 4l-.5 8.5M1.5 4l1 9a1 1 0 0 0 1 .9h8a1 1 0 0 0 1-.9l1-9" />
    </svg>
  );
}
