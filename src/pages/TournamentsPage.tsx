import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTournaments } from '../hooks/useTournaments';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Tag } from '../components/ui/Tag';
import { SelectableCard } from '../components/ui/SelectableCard';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { AuthModal } from '../components/auth/AuthModal';
import { useMemo, useState } from 'react';

type StatusFilter = 'active' | 'finished';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'active', label: 'W trakcie' },
  { value: 'finished', label: 'Rozegrane' },
];

export function TournamentsPage() {
  const [authOpen, setAuthOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const navigate             = useNavigate();
  const { username }         = useAuth();
  const { data, isLoading }  = useTournaments();

  const allTournaments = data?.results ?? [];
  const tournaments = useMemo(
    () => allTournaments.filter((t) => (statusFilter === 'active' ? t.is_active : !t.is_active)),
    [allTournaments, statusFilter],
  );

  function handleCreateClick() {
    if (username) {
      navigate('/turnieje/nowy');
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

  if (allTournaments.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <p className="text-sm text-content-secondary">Brak turniejów.</p>
        <Button variant="primary" size="lg" onClick={handleCreateClick}>
          Utwórz turniej
        </Button>
        {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-content-primary">Turnieje</h1>
        <Button variant="primary" size="sm" onClick={handleCreateClick}>
          + Utwórz turniej
        </Button>
      </div>

      <SegmentedControl
        value={statusFilter}
        onChange={setStatusFilter}
        options={STATUS_OPTIONS}
        aria-label="Filtr statusu turnieju"
        className="mb-4"
      />

      {tournaments.length === 0 && (
        <p className="py-6 text-center text-sm text-content-secondary">
          {statusFilter === 'active' ? 'Brak turniejów w trakcie.' : 'Brak rozegranych turniejów.'}
        </p>
      )}

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
                  {t.is_private && <> · <Tag>Prywatny</Tag></>}
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

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  );
}
