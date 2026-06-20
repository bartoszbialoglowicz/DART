import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  useLeague,
  useLeagueSchedule,
  useLeagueStandings,
  useFinalizeLeague,
} from '../hooks/useLeagues';
import { StandingsTab } from '../components/league/StandingsTab';
import { ScheduleTab } from '../components/league/ScheduleTab';
import { RosterTab } from '../components/league/RosterTab';
import { LeagueSetupStepper } from '../components/league/LeagueSetupStepper';
import { LeagueStatusBadge } from '../components/league/LeagueStatusBadge';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Tag } from '../components/ui/Tag';
import { cn } from '../components/ui/cn';

type Tab = 'tabela' | 'terminarz' | 'skład';

const TAB_OPTIONS = [
  { value: 'tabela'    as Tab, label: 'Tabela' },
  { value: 'terminarz' as Tab, label: 'Terminarz' },
  { value: 'skład'     as Tab, label: 'Skład' },
];

export function LeagueDetailPage() {
  const { id }                  = useParams<{ id: string }>();
  const leagueId                = Number(id);
  const [tab, setTab]           = useState<Tab>('tabela');
  const { username, playerId }  = useAuth();

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

  const isDraft         = league.status === 'draft';
  const scoreLabel      = league.match_format === 'sets' ? 'S' : 'L';
  const isOwner         = !!username && username === league.owner_username;
  const currentMemberId = playerId != null
    ? (league.members.find(m => m.player_id === playerId)?.id ?? null)
    : null;

  const formatChip = league.match_format === 'sets'
    ? `Sety best of ${league.sets} · Legi best of ${league.legs}`
    : `Legi best of ${league.legs}`;

  const rosterDone   = league.member_count >= 2;
  const scheduleDone = league.match_count > 0;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 lg:px-8">

      {/* Breadcrumb */}
      <div className="mb-1 text-xs text-content-secondary">
        <Link to="/ligi" className="transition-colors hover:text-content-primary">Ligi</Link>
        <span className="mx-1.5 text-content-faint">/</span>
        <span>{league.name}</span>
      </div>

      {/* Title + meta */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-content-primary">{league.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Tag>{league.member_count} graczy</Tag>
            <Tag>{league.matches_per_pair}× każdy z każdym</Tag>
            <Tag>{formatChip}</Tag>
            <Tag>{league.points_win} pkt wyg. / {league.points_draw} pkt remis</Tag>
            {league.is_private && <Tag>Prywatna</Tag>}
            <LeagueStatusBadge status={league.status} />
          </div>
        </div>
      </div>

      {isDraft ? (
        /* ── Draft: guided setup stepper ─────────────────────── */
        <LeagueSetupStepper
          initialStep={!rosterDone ? 1 : !scheduleDone ? 2 : 3}
          canFinalize={rosterDone && scheduleDone}
          finalizing={finalize.isPending}
          onFinalize={() => finalize.mutate()}
          steps={[
            {
              label: 'Konfiguracja',
              done:  true,
              content: (
                <div className="rounded-xl border border-border-subtle bg-surface-overlay p-5">
                  <p className="text-sm text-content-secondary">
                    Konfiguracja ustalona przy tworzeniu ligi — w szkicu pozostaje stała.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Tag>{formatChip}</Tag>
                    <Tag>{league.matches_per_pair}× każdy z każdym</Tag>
                    <Tag>{league.points_win} pkt wyg. / {league.points_draw} pkt remis</Tag>
                  </div>
                </div>
              ),
            },
            {
              label: 'Gracze',
              done:  rosterDone,
              content: <RosterTab leagueId={leagueId} isDraft isOwner={isOwner} />,
            },
            {
              label: 'Terminarz',
              done:  scheduleDone,
              content: (
                <ScheduleTab
                  leagueId={leagueId}
                  matches={schedule}
                  scoreLabel={scoreLabel}
                  isDraft={isDraft}
                  matchCount={league.match_count}
                  memberCount={league.member_count}
                  isOwner={isOwner}
                  currentMemberId={currentMemberId}
                />
              ),
            },
            {
              label: 'Zatwierdź',
              done:  false,
              content: (
                <div className="flex flex-col gap-4 rounded-xl border border-border-subtle bg-surface-overlay p-5">
                  <ReviewRow ok={rosterDone}   label="Gracze"    detail={`${league.member_count} w składzie`} hint="dodaj min. 2 graczy" />
                  <ReviewRow ok={scheduleDone} label="Terminarz" detail={`${league.match_count} meczów`}      hint="wygeneruj w kroku Terminarz" />
                  <p className="text-xs text-content-faint">
                    Po zatwierdzeniu skład i konfiguracja nie będą mogły zostać zmienione.
                  </p>
                </div>
              ),
            },
          ]}
        />
      ) : (
        /* ── Active / finished: tabs ─────────────────────────── */
        <>
          <SegmentedControl
            className="mb-5"
            fullWidth
            aria-label="Sekcje ligi"
            value={tab}
            onChange={setTab}
            options={TAB_OPTIONS}
          />

          {tab === 'tabela'    && <StandingsTab rows={standings} scoreLabel={scoreLabel} />}
          {tab === 'terminarz' && (
            <ScheduleTab
              leagueId={leagueId}
              matches={schedule}
              scoreLabel={scoreLabel}
              isDraft={isDraft}
              matchCount={league.match_count}
              memberCount={league.member_count}
              isOwner={isOwner}
              currentMemberId={currentMemberId}
            />
          )}
          {tab === 'skład'     && <RosterTab leagueId={leagueId} isDraft={isDraft} isOwner={isOwner} />}
        </>
      )}
    </div>
  );
}

function ReviewRow({ ok, label, detail, hint }: {
  ok: boolean; label: string; detail: string; hint: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold',
          ok ? 'bg-score-up-soft text-score-up-text' : 'border border-border-subtle text-content-faint',
        )}>
          {ok ? '✓' : '!'}
        </span>
        <span className="text-sm font-medium text-content-primary">{label}</span>
      </div>
      <span className="text-xs text-content-secondary">{ok ? detail : hint}</span>
    </div>
  );
}
