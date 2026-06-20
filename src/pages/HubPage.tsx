import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePlayers, useCreatePlayer, useDeletePlayer } from '../hooks/usePlayers';
import type { Player } from '../types/player';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';

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
        <h1 className="text-2xl font-bold tracking-tight text-content-primary">Hub</h1>
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
              <Badge variant="neutral" mono>{bots.length}</Badge>
            )}
          </div>
          {!showForm && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowForm(true)}
            >
              + Dodaj bota
            </Button>
          )}
        </div>

        {/* Add form */}
        {showForm && (
          <form
            onSubmit={handleAdd}
            className="mb-4 rounded-xl border border-border-accent bg-surface-overlay p-4"
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-content-secondary">
              Nowy bot
            </p>

            <div className="grid grid-cols-2 gap-3">
              <Input
                autoFocus
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="Imię"
                maxLength={50}
              />
              <Input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Nazwisko"
                maxLength={50}
              />
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-xs text-content-secondary">Poziom trudności</span>
                <span className="text-sm font-semibold text-content-primary">
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
                className="w-full cursor-pointer accent-content-accent"
              />
              <div className="mt-1 flex justify-between text-xs text-content-faint">
                <span>Rekreacyjny</span>
                <span>Początkujący</span>
                <span>Średni</span>
                <span>Klub</span>
                <span>Pro</span>
              </div>
            </div>

            {createBot.isError && (
              <p className="mt-3 text-xs text-score-down-text">Nie udało się dodać bota.</p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowForm(false); createBot.reset(); }}
              >
                Anuluj
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={createBot.isPending}
                disabled={createBot.isPending || !firstName.trim() || !lastName.trim()}
              >
                {createBot.isPending ? 'Zapisywanie…' : 'Dodaj'}
              </Button>
            </div>
          </form>
        )}

        {/* Bot list */}
        {isLoading ? (
          <p className="py-10 text-center text-sm text-content-secondary">Ładowanie…</p>
        ) : bots.length === 0 ? (
          <div className="rounded-xl border border-border-subtle py-14 text-center">
            <p className="text-sm text-content-secondary">Nie masz jeszcze żadnych botów.</p>
            {!showForm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowForm(true)}
                className="mt-4"
              >
                Utwórz pierwszego bota
              </Button>
            )}
          </div>
        ) : (
          <Card padding="none">
            {bots.map((bot, i) => (
              <div
                key={bot.id}
                className={[
                  'flex items-center justify-between px-4 py-3 transition-colors hover:bg-surface-muted',
                  i > 0 ? 'border-t border-border-subtle' : '',
                ].join(' ')}
              >
                <div>
                  <p className="text-sm font-medium text-content-primary">
                    {bot.first_name} {bot.last_name}
                  </p>
                  <p className="text-xs text-content-secondary">
                    {botLevel(Number(bot.average))}
                    <span className="ml-2 tabular-nums text-content-faint">śr. {Number(bot.average).toFixed(1)}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(bot)}
                  disabled={deleteBot.isPending}
                  aria-label="Usuń bota"
                  className="ml-4 rounded-lg p-1.5 text-content-secondary transition-colors hover:text-score-down-text disabled:opacity-30"
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
          </Card>
        )}
      </section>
    </div>
  );
}
