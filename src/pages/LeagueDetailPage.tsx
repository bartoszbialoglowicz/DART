import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  useLeague,
  useLeagueSchedule,
  useLeagueStandings,
  useFinalizeLeague,
} from '../hooks/useLeagues';
import { StandingsTab } from '../components/league/StandingsTab';
import { ScheduleTab } from '../components/league/ScheduleTab';
import { RosterTab } from '../components/league/RosterTab';
import { LEAGUE_STATUS_COLOR, LEAGUE_STATUS_LABEL } from '../utils/colors';

type Tab = 'tabela' | 'terminarz' | 'skład';

export function LeagueDetailPage() {
  const { id }        = useParams<{ id: string }>();
  const leagueId      = Number(id);
  const [tab, setTab] = useState<Tab>('tabela');

  const { data: league,    isLoading } = useLeague(leagueId);
  const { data: schedule = []        } = useLeagueSchedule(leagueId);
  const { data: standings = []       } = useLeagueStandings(leagueId);
  const finalize = useFinalizeLeague(leagueId);

  if (isLoading || !league) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-sm text-content-secondary">Ładowanie...</span>
      </div>
    );
  }

  const isDraft    = league.status === 'draft';
  const scoreLabel = league.match_format === 'sets' ? 'S' : 'L';

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 lg:px-8">

      {/* Breadcrumb */}
      <div className="mb-1 text-xs text-content-secondary">
        <Link to="/ligi" className="hover:text-brand-white transition-colors">Ligi</Link>
        <span className="mx-1.5 opacity-40">/</span>
        <span>{league.name}</span>
      </div>

      {/* Title + meta */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-white">{league.name}</h1>
          <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] text-content-secondary">
            <Chip>{league.member_count} graczy</Chip>
            <Chip>{league.matches_per_pair}× każdy z każdym</Chip>
            <Chip>
              {league.match_format === 'sets'
                ? `Sety best of ${league.sets} · Legi best of ${league.legs}`
                : `Legi best of ${league.legs}`}
            </Chip>
            <Chip>{league.points_win} pkt wyg. / {league.points_draw} pkt remis</Chip>
            {league.is_private && <Chip>Prywatna</Chip>}
            <StatusChip status={league.status} />
          </div>
        </div>
      </div>

      {/* Wizard banner — only when draft */}
      {isDraft && (
        <div className="mb-5 rounded-xl border border-amber-500/25 bg-amber-500/8 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-300">Kreator ligi</p>
              <p className="mt-0.5 text-xs text-amber-300/70">
                Dodaj graczy w zakładce <strong>Skład</strong>, następnie wygeneruj terminarz
                i kliknij <strong>Zakończ kreator</strong>.
                Po zatwierdzeniu skład i konfiguracja nie będą mogły być zmienione.
              </p>
            </div>
            <button
              type="button"
              onClick={() => finalize.mutate()}
              disabled={finalize.isPending || league.member_count < 2}
              title={league.member_count < 2 ? 'Dodaj co najmniej 2 graczy' : undefined}
              className="shrink-0 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition-opacity disabled:opacity-40 hover:bg-amber-400"
            >
              {finalize.isPending ? 'Zatwierdzanie…' : 'Zakończ kreator'}
            </button>
          </div>

          {/* Wizard steps */}
          <div className="mt-3 flex items-center gap-2 text-xs">
            <WizardStep done label="Konfiguracja" />
            <StepDivider />
            <WizardStep done={league.member_count >= 2} label={`Gracze (${league.member_count})`} />
            <StepDivider />
            <WizardStep done={league.match_count > 0} label="Terminarz" />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-xl border border-border-subtle bg-white/3 p-1">
        {(['tabela', 'terminarz', 'skład'] as Tab[]).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={[
              'flex-1 rounded-lg py-2 text-sm font-medium capitalize transition-colors',
              tab === t
                ? 'bg-brand-purple/20 text-brand-white'
                : 'text-content-secondary hover:text-brand-white',
            ].join(' ')}
          >
            {t === 'tabela' ? 'Tabela' : t === 'terminarz' ? 'Terminarz' : 'Skład'}
          </button>
        ))}
      </div>

      {tab === 'tabela'    && <StandingsTab rows={standings} scoreLabel={scoreLabel} />}
      {tab === 'terminarz' && (
        <ScheduleTab
          leagueId={leagueId}
          matches={schedule}
          scoreLabel={scoreLabel}
          isDraft={isDraft}
          matchCount={league.match_count}
          memberCount={league.member_count}
        />
      )}
      {tab === 'skład'     && <RosterTab leagueId={leagueId} isDraft={isDraft} />}
    </div>
  );
}

// ── Local helpers (used only in this page's header) ───────────────────────────

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-border-subtle px-2.5 py-0.5">{children}</span>;
}

function StatusChip({ status }: { status: string }) {
  return (
    <span className={`rounded-full border px-2.5 py-0.5 font-bold uppercase tracking-wide ${LEAGUE_STATUS_COLOR[status] ?? ''}`}>
      {LEAGUE_STATUS_LABEL[status] ?? status}
    </span>
  );
}

function WizardStep({ done, label }: { done: boolean; label: string }) {
  return (
    <span className={[
      'flex items-center gap-1.5 font-medium',
      done ? 'text-amber-300' : 'text-amber-300/40',
    ].join(' ')}>
      <span className={[
        'flex h-4 w-4 items-center justify-center rounded-full text-[10px]',
        done ? 'bg-amber-400 text-black' : 'border border-amber-500/30 text-amber-500/40',
      ].join(' ')}>
        {done ? '✓' : '·'}
      </span>
      {label}
    </span>
  );
}

function StepDivider() {
  return <span className="text-amber-500/30 select-none">—</span>;
}
