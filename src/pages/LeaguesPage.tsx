import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLeagues, useCreateLeague } from '../hooks/useLeagues';
import { useTournamentCycles } from '../hooks/useTournamentCycles';
import { CreateLeagueModal } from '../components/league/CreateLeagueModal';
import { CycleStatusBadge } from '../components/cycle/CycleStatusBadge';
import type { LeaguePayload, LeagueListItem } from '../types/league';
import type { TournamentCycle } from '../types/tournamentCycle';
import { fmtDate } from '../utils/formatting';
import { Button } from '../components/ui/Button';
import { Tag } from '../components/ui/Tag';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { LeagueStatusBadge } from '../components/league/LeagueStatusBadge';

type Tab = 'ligi' | 'cykle';

const TAB_OPTIONS = [
  { value: 'ligi'  as Tab, label: 'Ligi' },
  { value: 'cykle' as Tab, label: 'Turnieje' },
];

export function LeaguesPage() {
  const { username }    = useAuth();
  const navigate         = useNavigate();
  const [tab, setTab]     = useState<Tab>('ligi');
  const [modal, setModal] = useState<'create' | 'auth' | null>(null);
  const { data: leagues = [], isLoading: leaguesLoading } = useLeagues();
  const { data: cycles  = [], isLoading: cyclesLoading  } = useTournamentCycles();
  const createLeague = useCreateLeague();

  function handleCreateClick() {
    if (tab === 'ligi') {
      setModal('create');
    } else {
      navigate('/ligi/cykle/nowy');
    }
  }

  function handleConfirm(payload: LeaguePayload) {
    createLeague.mutate(payload, {
      onSuccess: (league) => {
        setModal(null);
        navigate(`/ligi/${league.id}`);
      },
    });
  }

  const isLoading = tab === 'ligi' ? leaguesLoading : cyclesLoading;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">

      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-content-primary">Cykle</h1>
        {username && (
          <Button variant="primary" size="sm" onClick={handleCreateClick}>
            {tab === 'ligi' ? '+ Utwórz ligę' : '+ Utwórz cykl turniejowy'}
          </Button>
        )}
      </div>

      <div className="mb-6">
        <SegmentedControl value={tab} onChange={setTab} options={TAB_OPTIONS} aria-label="Rodzaj cyklu" />
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center py-20">
          <span className="text-sm text-content-secondary">Ładowanie...</span>
        </div>
      ) : tab === 'ligi' ? (
        leagues.length === 0 ? (
          <EmptyState onCreateClick={handleCreateClick} isLoggedIn={!!username} label="ligi" />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {leagues.map(league => (
              <LeagueCard key={league.id} league={league} />
            ))}
          </div>
        )
      ) : (
        cycles.length === 0 ? (
          <EmptyState onCreateClick={handleCreateClick} isLoggedIn={!!username} label="cyklu" />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {cycles.map(cycle => (
              <CycleCard key={cycle.id} cycle={cycle} />
            ))}
          </div>
        )
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

function CycleCard({ cycle }: { cycle: TournamentCycle }) {
  const scoringLabel = cycle.scoring_mode === 'placement' ? 'Punkty za miejsce' : 'Suma wygranych meczy';
  const attachedCount = cycle.events.filter(e => e.tournament_id !== null).length;

  return (
    <Link
      to={`/ligi/cykle/${cycle.id}`}
      className="group flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface-overlay p-5 transition-colors hover:bg-surface-muted"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-bold leading-snug text-content-primary transition-colors group-hover:text-content-accent">
          {cycle.name}
        </h2>
        <CycleStatusBadge status={cycle.status} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Tag>{attachedCount}/{cycle.events.length} turniejów</Tag>
        <Tag>{scoringLabel}</Tag>
        {cycle.is_private && <Tag>Prywatny</Tag>}
      </div>

      <div className="flex items-center justify-between text-xs text-content-secondary">
        <span>{cycle.owner_username}</span>
        <span>{fmtDate(cycle.created_at)}</span>
      </div>
    </Link>
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

function EmptyState({ onCreateClick, isLoggedIn, label }: { onCreateClick: () => void; isLoggedIn: boolean; label: 'ligi' | 'cyklu' }) {
  const copy = label === 'ligi'
    ? { none: 'Nie masz jeszcze żadnej ligi.', loggedOut: 'Zaloguj się, żeby tworzyć i przeglądać ligi.', cta: 'Utwórz pierwszą ligę' }
    : { none: 'Nie masz jeszcze żadnego cyklu turniejowego.', loggedOut: 'Zaloguj się, żeby tworzyć i przeglądać cykle turniejowe.', cta: 'Utwórz pierwszy cykl' };

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="select-none text-4xl opacity-20">🏆</div>
      <p className="text-sm text-content-secondary">
        {isLoggedIn ? copy.none : copy.loggedOut}
      </p>
      {isLoggedIn && (
        <Button variant="primary" size="lg" onClick={onCreateClick}>{copy.cta}</Button>
      )}
    </div>
  );
}
