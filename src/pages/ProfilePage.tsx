import { useAuth } from '../context/AuthContext';
import { useMyStats } from '../hooks/usePlayers';

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
    <div className="mx-auto w-full max-w-2xl px-6 py-8">

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-purple/20 text-2xl font-black text-brand-purple">
          {player.first_name[0]}{player.last_name[0]}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-brand-white">
            {player.first_name} {player.last_name}
          </h1>
          <p className="mt-0.5 text-sm text-content-secondary">@{username}</p>
        </div>
      </div>

      {/* ── Stats grid ───────────────────────────────────────── */}
      {stats.matches_played === 0 ? (
        <div className="rounded-xl border border-border-subtle bg-white/3 px-6 py-10 text-center">
          <p className="text-sm text-content-secondary">
            Brak rozegranych meczów. Zagraj w turnieju żeby zobaczyć statystyki.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-xs font-medium uppercase tracking-widest text-content-secondary">
            Statystyki
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Mecze" value={String(stats.matches_played)} />
            <StatCard label="Średnia" value={stats.match_average > 0 ? stats.match_average.toFixed(2) : '—'} />
            <StatCard
              label="% na doublach"
              value={stats.double_accuracy !== null ? `${stats.double_accuracy}%` : '—'}
            />
            <StatCard
              label="Lotki / leg"
              value={stats.darts_per_leg > 0 ? stats.darts_per_leg.toFixed(1) : '—'}
            />
            <StatCard label="180" value={String(stats.count_180)} />
            <StatCard label="Highfinishe" value={String(stats.high_checkouts)} />
          </div>
        </>
      )}
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
