import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreateTournamentModal } from '../components/tournament/CreateTournamentModal';
import { AuthModal } from '../components/auth/AuthModal';
import { generateBracket } from '../utils/bracket';
import { useTournaments, useCreateTournament } from '../hooks/useTournaments';
import { useAuth } from '../context/AuthContext';
import type { TournamentConfig } from '../types/tournament';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { SelectableCard } from '../components/ui/SelectableCard';

export function TournamentsPage() {
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
          <Button
            variant="primary"
            size="lg"
            loading={createTournament.isPending}
            disabled={createTournament.isPending}
            onClick={() => setModalOpen(true)}
          >
            {createTournament.isPending ? 'Tworzenie...' : 'Utwórz turniej'}
          </Button>
        ) : (
          <>
            <p className="text-sm text-content-secondary">
              Musisz być zalogowany, aby utworzyć turniej.
            </p>
            <Button variant="primary" size="lg" onClick={() => setAuthOpen(true)}>
              Zaloguj się
            </Button>
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
        <h1 className="text-lg font-semibold text-content-primary">Turnieje</h1>
        <Button
          variant="primary"
          size="sm"
          loading={createTournament.isPending}
          disabled={createTournament.isPending}
          onClick={handleCreateClick}
        >
          {createTournament.isPending ? 'Tworzenie...' : 'Utwórz turniej'}
        </Button>
      </div>

      <ul className="flex flex-col gap-2">
        {tournaments.map((t) => (
          <li key={t.id}>
            <SelectableCard
              layout="row"
              title={t.name}
              description={
                <>
                  {t.format === 'knockout' ? 'SKO' : 'Grupy'} · {t.bracket.playerCount} graczy · {new Date(t.created_at).toLocaleDateString('pl-PL')}
                  {t.owner_username && <> · <span className="text-content-faint">{t.owner_username}</span></>}
                </>
              }
              meta={
                <Badge variant={t.is_active ? 'accent' : 'neutral'}>
                  {t.is_active ? 'Aktywny' : 'Zakończony'}
                </Badge>
              }
              onClick={() => navigate(`/turnieje/${t.id}`)}
              className="w-full"
            />
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
