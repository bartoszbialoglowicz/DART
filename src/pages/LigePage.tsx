import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLeagues, useCreateLeague } from '../hooks/useLeagues';
import { AuthModal } from '../components/auth/AuthModal';
import { CreateLeagueModal } from '../components/league/CreateLeagueModal';
import type { LeaguePayload, LeagueListItem } from '../types/league';

const STATUS_LABEL: Record<string, string> = {
  draft:    'Szkic',
  active:   'Aktywna',
  finished: 'Zakończona',
};

const STATUS_COLOR: Record<string, string> = {
  draft:    'text-content-secondary bg-white/5 border-white/10',
  active:   'text-green-400 bg-green-500/10 border-green-500/20',
  finished: 'text-content-secondary bg-white/5 border-white/10',
};

export function LigePage() {
  const { username }    = useAuth();
  const navigate        = useNavigate();
  const [modal, setModal] = useState<'create' | 'auth' | null>(null);
  const { data: leagues = [], isLoading } = useLeagues();
  const createLeague = useCreateLeague();

  function handleCreateClick() {
    if (username) setModal('create');
    else          setModal('auth');
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
        <h1 className="text-xl font-bold text-brand-white">Ligi</h1>
        <button
          type="button"
          onClick={handleCreateClick}
          className="rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-brand-white hover:bg-brand-purple/80 transition-colors"
        >
          + Utwórz ligę
        </button>
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
      {modal === 'auth' && (
        <AuthModal onClose={() => setModal(null)} />
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
      className="group flex flex-col gap-3 rounded-xl border border-border-subtle bg-white/3 p-5 transition-colors hover:border-brand-purple/40 hover:bg-white/5"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-bold text-brand-white leading-snug group-hover:text-brand-purple transition-colors">
          {league.name}
        </h2>
        <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_COLOR[league.status]}`}>
          {STATUS_LABEL[league.status]}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 text-[11px] text-content-secondary">
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

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border-subtle px-2.5 py-0.5">{children}</span>
  );
}

function EmptyState({ onCreateClick, isLoggedIn }: { onCreateClick: () => void; isLoggedIn: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="text-4xl opacity-20 select-none">🏆</div>
      <p className="text-sm text-content-secondary">
        {isLoggedIn ? 'Nie masz jeszcze żadnej ligi.' : 'Zaloguj się, żeby tworzyć i przeglądać ligi.'}
      </p>
      <button
        type="button"
        onClick={onCreateClick}
        className="rounded-lg bg-brand-purple px-5 py-2.5 text-sm font-semibold text-brand-white hover:bg-brand-purple/80 transition-colors"
      >
        {isLoggedIn ? 'Utwórz pierwszą ligę' : 'Zaloguj się'}
      </button>
    </div>
  );
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}.${m}.${y}`;
}
