import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLeagues, useCreateLeague } from '../hooks/useLeagues';
import { CreateLeagueModal } from '../components/league/CreateLeagueModal';
import type { LeaguePayload, LeagueListItem } from '../types/league';
import { fmtDate } from '../utils/formatting';
import { Button } from '../components/ui/Button';
import { Tag } from '../components/ui/Tag';
import { LeagueStatusBadge } from '../components/league/LeagueStatusBadge';

export function LeaguesPage() {
  const { username }    = useAuth();
  const navigate        = useNavigate();
  const [modal, setModal] = useState<'create' | 'auth' | null>(null);
  const { data: leagues = [], isLoading } = useLeagues();
  const createLeague = useCreateLeague();

  function handleCreateClick() {
    setModal('create');
  }

  function handleConfirm(payload: LeaguePayload) {
    createLeague.mutate(payload, {
      onSuccess: (league) => {
        setModal(null);
        navigate(`/ligi/${league.id}`);
      },
    });
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-sm text-content-secondary">Ładowanie...</span>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 lg:px-8">

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-content-primary">Ligi</h1>
        {username && <Button variant="primary" onClick={handleCreateClick}>+ Utwórz ligę</Button>}
      </div>

      {leagues.length === 0 ? (
        <EmptyState onCreateClick={handleCreateClick} isLoggedIn={!!username} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {leagues.map(league => (
            <LeagueCard key={league.id} league={league} />
          ))}
        </div>
      )}

      {modal === 'create' && (
        <CreateLeagueModal
          onConfirm={handleConfirm}
          onClose={() => setModal(null)}
          loading={createLeague.isPending}
        />
      )}
    </div>
  );
}

function LeagueCard({ league }: { league: LeagueListItem }) {
  const formatLabel = league.match_format === 'sets'
    ? `Sety · best of ${league.sets} | Legi · best of ${league.legs}`
    : `Legi · best of ${league.legs}`;

  return (
    <Link
      to={`/ligi/${league.id}`}
      className="group flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface-overlay p-5 transition-colors hover:bg-surface-muted"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-bold leading-snug text-content-primary transition-colors group-hover:text-content-accent">
          {league.name}
        </h2>
        <LeagueStatusBadge status={league.status} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Tag>{league.member_count} graczy</Tag>
        <Tag>{league.matches_per_pair}× każdy z każdym</Tag>
        <Tag>{formatLabel}</Tag>
        {league.is_private && <Tag>Prywatna</Tag>}
      </div>

      <div className="flex items-center justify-between text-xs text-content-secondary">
        <span>{league.owner_username}</span>
        <span>{fmtDate(league.created_at)}</span>
      </div>
    </Link>
  );
}

function EmptyState({ onCreateClick, isLoggedIn }: { onCreateClick: () => void; isLoggedIn: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="select-none text-4xl opacity-20">🏆</div>
      <p className="text-sm text-content-secondary">
        {isLoggedIn ? 'Nie masz jeszcze żadnej ligi.' : 'Zaloguj się, żeby tworzyć i przeglądać ligi.'}
      </p>
      {isLoggedIn && (
        <Button variant="primary" size="lg" onClick={onCreateClick}>Utwórz pierwszą ligę</Button>
      )}
    </div>
  );
}
