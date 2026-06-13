import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePlayers, useCreatePlayer, useDeletePlayer } from '../hooks/usePlayers';
import type { Player } from '../types/player';

function botLevel(avg: number): string {
  if (avg >= 90) return 'Pro';
  if (avg >= 75) return 'Dobry amator';
  if (avg >= 60) return 'Klub';
  if (avg >= 45) return 'Średni';
  if (avg >= 30) return 'Początkujący';
  return 'Rekreacyjny';
}

export function HubPage() {
  const { username } = useAuth();
  const { data, isLoading } = usePlayers();
  const createBot  = useCreatePlayer();
  const deleteBot  = useDeletePlayer();

  const [showForm,   setShowForm]   = useState(false);
  const [firstName,  setFirstName]  = useState('');
  const [lastName,   setLastName]   = useState('');
  const [avgStr,     setAvgStr]     = useState('45');

  const bots: Player[] = (data ?? []).filter(p => p.cpu);
  const avg = Number(avgStr);

  if (!username) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <p className="text-sm text-content-secondary">
          Zaloguj się, aby zarządzać własnymi zawodnikami.
        </p>
      </div>
    );
  }

  function handleAdd(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;
    createBot.mutate(
      { first_name: firstName.trim(), last_name: lastName.trim(), average: avg, cpu: true },
      {
        onSuccess: () => {
          setFirstName('');
          setLastName('');
          setAvgStr('45');
          setShowForm(false);
        },
      }
    );
  }

  function handleDelete(bot: Player) {
    if (!confirm(`Usunąć bota „${bot.first_name} ${bot.last_name}"?`)) return;
    deleteBot.mutate(bot.id);
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-brand-white">Hub</h1>
        <p className="mt-1 text-sm text-content-secondary">
          Zarządzaj własnymi zawodnikami i ustawieniami aplikacji.
        </p>
      </div>

      {/* ── Boty ─────────────────────────────────────────────────────────── */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-content-secondary">
              Moje boty
            </h2>
            {bots.length > 0 && (
              <span className="rounded-full bg-white/8 px-2 py-0.5 text-xs font-bold tabular-nums text-content-secondary">
                {bots.length}
              </span>
            )}
          </div>
          {!showForm && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="rounded-lg border border-brand-purple/40 px-3 py-1.5 text-xs font-medium text-brand-white transition-colors hover:bg-brand-purple/10"
            >
              + Dodaj bota
            </button>
          )}
        </div>

        {/* Add form */}
        {showForm && (
          <form
            onSubmit={handleAdd}
            className="mb-4 rounded-xl border border-brand-purple/30 bg-brand-purple/5 p-4"
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-content-secondary">
              Nowy bot
            </p>

            <div className="grid grid-cols-2 gap-3">
              <input
                autoFocus
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="Imię"
                maxLength={50}
                className="rounded-lg border border-border-subtle bg-brand-black px-3 py-2 text-sm text-brand-white placeholder:text-content-secondary focus:border-brand-purple focus:outline-none transition-colors"
              />
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Nazwisko"
                maxLength={50}
                className="rounded-lg border border-border-subtle bg-brand-black px-3 py-2 text-sm text-brand-white placeholder:text-content-secondary focus:border-brand-purple focus:outline-none transition-colors"
              />
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-xs text-content-secondary">Poziom trudności</span>
                <span className="text-sm font-semibold text-brand-white">
                  {botLevel(avg)}
                  <span className="ml-1.5 text-xs font-normal text-content-secondary">
                    śr. {avg}
                  </span>
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="110"
                step="1"
                value={avgStr}
                onChange={e => setAvgStr(e.target.value)}
                className="w-full cursor-pointer accent-brand-purple"
              />
              <div className="mt-1 flex justify-between text-[10px] text-content-secondary/60">
                <span>Rekreacyjny</span>
                <span>Początkujący</span>
                <span>Średni</span>
                <span>Klub</span>
                <span>Pro</span>
              </div>
            </div>

            {createBot.isError && (
              <p className="mt-3 text-xs text-red-400">Nie udało się dodać bota.</p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); createBot.reset(); }}
                className="rounded-lg border border-border-subtle px-4 py-2 text-xs font-medium text-content-secondary transition-colors hover:text-brand-white"
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={createBot.isPending || !firstName.trim() || !lastName.trim()}
                className="rounded-lg bg-brand-purple px-4 py-2 text-xs font-semibold text-brand-white transition-opacity disabled:opacity-40 hover:bg-brand-purple/80"
              >
                {createBot.isPending ? 'Zapisywanie…' : 'Dodaj'}
              </button>
            </div>
          </form>
        )}

        {/* Bot list */}
        {isLoading ? (
          <p className="py-10 text-center text-sm text-content-secondary">Ładowanie…</p>
        ) : bots.length === 0 ? (
          <div className="rounded-xl border border-border-subtle/40 py-14 text-center">
            <p className="text-sm text-content-secondary">Nie masz jeszcze żadnych botów.</p>
            {!showForm && (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="mt-4 rounded-lg border border-brand-purple/40 px-4 py-2 text-sm font-medium text-brand-white transition-colors hover:bg-brand-purple/10"
              >
                Utwórz pierwszego bota
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border-subtle">
            {bots.map((bot, i) => (
              <div
                key={bot.id}
                className={[
                  'flex items-center justify-between px-4 py-3 transition-colors hover:bg-white/3',
                  i > 0 ? 'border-t border-border-subtle/30' : '',
                ].join(' ')}
              >
                <div>
                  <p className="text-sm font-medium text-brand-white">
                    {bot.first_name} {bot.last_name}
                  </p>
                  <p className="text-xs text-content-secondary">
                    {botLevel(Number(bot.average))}
                    <span className="ml-2 tabular-nums opacity-60">śr. {Number(bot.average).toFixed(1)}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(bot)}
                  disabled={deleteBot.isPending}
                  aria-label="Usuń bota"
                  className="ml-4 rounded-lg p-1.5 text-content-secondary transition-colors hover:text-red-400 disabled:opacity-30"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4h6v2" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
