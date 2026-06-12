import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreateTournamentModal } from '../components/tournament/CreateTournamentModal';
import { AuthModal } from '../components/auth/AuthModal';
import { generateBracket } from '../utils/bracket';
import { useTournaments, useCreateTournament } from '../hooks/useTournaments';
import { useAuth } from '../context/AuthContext';
import type { TournamentConfig } from '../types/tournament';

export function TurniejePage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [authOpen,  setAuthOpen]  = useState(false);
  const navigate         = useNavigate();
  const { username }     = useAuth();
  const createTournament = useCreateTournament();
  const { data, isLoading } = useTournaments();

  const tournaments = data?.results ?? [];

  function handleCreate(config: TournamentConfig) {
    const bracket = generateBracket(config);
    setModalOpen(false);
    createTournament.mutate(
      { bracket, is_private: config.is_private, start_date: config.start_date },
      { onSuccess: (saved) => navigate(`/turnieje/${saved.id}`) },
    );
  }

  function handleCreateClick() {
    if (username) {
      setModalOpen(true);
    } else {
      setAuthOpen(true);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-sm text-content-secondary">Ładowanie...</span>
      </div>
    );
  }

  if (tournaments.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <p className="text-sm text-content-secondary">Brak turniejów.</p>
        {username ? (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            disabled={createTournament.isPending}
            className="rounded-xl border border-brand-purple bg-brand-purple/10 px-8 py-4 text-sm font-semibold tracking-wide text-brand-white transition-colors hover:bg-brand-purple/20 disabled:opacity-50"
          >
            {createTournament.isPending ? 'Tworzenie...' : 'Utwórz turniej'}
          </button>
        ) : (
          <>
            <p className="text-sm text-content-secondary">
              Musisz być zalogowany, aby utworzyć turniej.
            </p>
            <button
              type="button"
              onClick={() => setAuthOpen(true)}
              className="rounded-xl border border-brand-purple bg-brand-purple/10 px-8 py-4 text-sm font-semibold tracking-wide text-brand-white transition-colors hover:bg-brand-purple/20"
            >
              Zaloguj się
            </button>
          </>
        )}

        {modalOpen && (
          <CreateTournamentModal
            onConfirm={handleCreate}
            onClose={() => setModalOpen(false)}
          />
        )}
        {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-brand-white">Turnieje</h1>
        <button
          type="button"
          onClick={handleCreateClick}
          disabled={createTournament.isPending}
          className="rounded-xl border border-brand-purple bg-brand-purple/10 px-5 py-2 text-sm font-semibold tracking-wide text-brand-white transition-colors hover:bg-brand-purple/20 disabled:opacity-50"
        >
          {createTournament.isPending ? 'Tworzenie...' : 'Utwórz turniej'}
        </button>
      </div>

      <ul className="flex flex-col gap-2">
        {tournaments.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => navigate(`/turnieje/${t.id}`)}
              className="flex w-full items-center justify-between rounded-xl border border-border-subtle bg-brand-black px-5 py-4 text-left transition-colors hover:border-brand-purple/50 hover:bg-brand-purple/5"
            >
              <div>
                <p className="text-sm font-medium text-brand-white">{t.name}</p>
                <p className="mt-0.5 text-xs text-content-secondary">
                  {t.format === 'knockout' ? 'SKO' : 'Grupy'} · {t.bracket.playerCount} graczy · {new Date(t.created_at).toLocaleDateString('pl-PL')}
                  {t.owner_username && <> · <span className="text-brand-white/60">{t.owner_username}</span></>}
                </p>
              </div>

              <span
                className={[
                  'rounded-full px-3 py-0.5 text-xs font-medium',
                  t.is_active
                    ? 'bg-brand-purple/20 text-brand-purple'
                    : 'bg-white/5 text-content-secondary',
                ].join(' ')}
              >
                {t.is_active ? 'Aktywny' : 'Zakończony'}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {modalOpen && (
        <CreateTournamentModal
          onConfirm={handleCreate}
          onClose={() => setModalOpen(false)}
        />
      )}
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  );
}
