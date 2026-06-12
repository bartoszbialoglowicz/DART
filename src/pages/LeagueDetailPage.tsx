import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  useLeague,
  useLeagueSchedule,
  useLeagueStandings,
  useAddLeagueMember,
  useRemoveLeagueMember,
  useLinkPlayer,
  useGenerateSchedule,
  useClearSchedule,
  useUpdateMatch,
  useSetMatchdayDate,
  useFinalizeLeague,
} from '../hooks/useLeagues';
import { usePlayers } from '../hooks/usePlayers';
import type { LeagueMatch, StandingsRow } from '../types/league';
import type { Player } from '../types/player';

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

  const isDraft      = league.status === 'draft';
  const scoreLabel   = league.match_format === 'sets' ? 'S' : 'L';

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
      {tab === 'terminarz' && <ScheduleTab leagueId={leagueId} matches={schedule} scoreLabel={scoreLabel} isDraft={isDraft} matchCount={league.match_count} memberCount={league.member_count} />}
      {tab === 'skład'     && <RosterTab leagueId={leagueId} isDraft={isDraft} />}
    </div>
  );
}

// ── Wizard helpers ────────────────────────────────────────────────────────────

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

// ── Standings tab ─────────────────────────────────────────────────────────────

function StandingsTab({ rows, scoreLabel }: { rows: StandingsRow[]; scoreLabel: string }) {
  if (rows.length === 0) {
    return <EmptyMsg>Brak danych do tabeli. Wpisz wyniki meczów w zakładce Terminarz.</EmptyMsg>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border-subtle">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-subtle text-[10px] uppercase tracking-widest text-content-secondary">
            <th className="px-4 py-3 text-left w-8">#</th>
            <th className="px-4 py-3 text-left">Gracz</th>
            <th className="px-3 py-3 text-center">M</th>
            <th className="px-3 py-3 text-center">W</th>
            <th className="px-3 py-3 text-center">R</th>
            <th className="px-3 py-3 text-center">P</th>
            <th className="px-3 py-3 text-center">{scoreLabel}</th>
            <th className="px-4 py-3 text-center font-bold">Pkt</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.member_id} className="border-b border-border-subtle/50 last:border-0 hover:bg-white/3 transition-colors">
              <td className="px-4 py-3 tabular-nums text-content-secondary">{row.position}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-brand-white">{row.display_name}</span>
                  {row.status === 'pending' && <PendingBadge />}
                </div>
              </td>
              <td className="px-3 py-3 text-center tabular-nums text-content-secondary">{row.played}</td>
              <td className="px-3 py-3 text-center tabular-nums text-green-400">{row.won}</td>
              <td className="px-3 py-3 text-center tabular-nums text-content-secondary">{row.drawn}</td>
              <td className="px-3 py-3 text-center tabular-nums text-red-400">{row.lost}</td>
              <td className="px-3 py-3 text-center tabular-nums text-content-secondary">
                {row.score_for}-{row.score_against}
              </td>
              <td className="px-4 py-3 text-center font-bold tabular-nums text-brand-white">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Schedule tab ──────────────────────────────────────────────────────────────

function ScheduleTab({ leagueId, matches, scoreLabel, isDraft, matchCount, memberCount }: {
  leagueId:    number;
  matches:     LeagueMatch[];
  scoreLabel:  string;
  isDraft:     boolean;
  matchCount:  number;
  memberCount: number;
}) {
  const generateSchedule  = useGenerateSchedule(leagueId);
  const clearSchedule     = useClearSchedule(leagueId);
  const updateMatch       = useUpdateMatch(leagueId);
  const setMatchdayDate   = useSetMatchdayDate(leagueId);

  const [editing, setEditing]           = useState<number | null>(null);
  const [homeScore, setHomeScore]       = useState('');
  const [awayScore, setAwayScore]       = useState('');
  // which matchday date input is open
  const [editingDay, setEditingDay]     = useState<number | null>(null);
  const [dayDateInput, setDayDateInput] = useState('');

  const hasSchedule = matchCount > 0;

  const byMatchday = matches.reduce<Record<number, LeagueMatch[]>>((acc, m) => {
    acc[m.matchday] ??= [];
    acc[m.matchday].push(m);
    return acc;
  }, {});

  function startEdit(match: LeagueMatch) {
    setEditing(match.id);
    setHomeScore(match.home_score !== null ? String(match.home_score) : '');
    setAwayScore(match.away_score !== null ? String(match.away_score) : '');
  }

  function saveResult(matchId: number) {
    const hs  = parseInt(homeScore, 10);
    const as_ = parseInt(awayScore, 10);
    if (isNaN(hs) || isNaN(as_)) return;
    updateMatch.mutate(
      { matchId, data: { home_score: hs, away_score: as_ } },
      { onSuccess: () => setEditing(null) },
    );
  }

  function openDayEdit(matchday: number, currentDate: string | null) {
    setEditingDay(matchday);
    setDayDateInput(currentDate ? currentDate.slice(0, 10) : '');
  }

  function saveDayDate(matchday: number) {
    setMatchdayDate.mutate(
      { matchday, date: dayDateInput || null },
      { onSuccess: () => setEditingDay(null) },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-content-secondary">
          {hasSchedule
            ? `${matches.length} meczów · ${Object.keys(byMatchday).length} kolejek`
            : 'Terminarz nie został jeszcze wygenerowany.'}
        </p>
        <div className="flex gap-2">
          {!hasSchedule ? (
            <button
              type="button"
              onClick={() => generateSchedule.mutate()}
              disabled={memberCount < 2 || generateSchedule.isPending}
              title={memberCount < 2 ? 'Dodaj co najmniej 2 graczy' : undefined}
              className="rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-brand-white transition-opacity disabled:opacity-40 hover:bg-brand-purple/80"
            >
              {generateSchedule.isPending ? 'Generowanie…' : 'Generuj terminarz'}
            </button>
          ) : isDraft && (
            <button
              type="button"
              onClick={() => { if (confirm('Usunąć cały terminarz?')) clearSchedule.mutate(); }}
              disabled={clearSchedule.isPending}
              className="rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:border-red-500/60"
            >
              Usuń terminarz
            </button>
          )}
        </div>
      </div>

      {/* Matchday sections */}
      {Object.entries(byMatchday).map(([day, dayMatches]) => {
        const matchday = Number(day);
        // All matches in a day share scheduled_at; take from first
        const sharedDate = dayMatches[0]?.scheduled_at ?? null;
        const dateStr    = sharedDate ? sharedDate.slice(0, 10) : null;

        return (
          <div key={day} className="rounded-xl border border-border-subtle overflow-hidden">
            {/* Matchday header */}
            <div className="flex items-center justify-between gap-4 border-b border-border-subtle bg-white/3 px-4 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-widest text-content-secondary">
                Kolejka {day}
              </span>

              {/* Date picker */}
              {editingDay === matchday ? (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={dayDateInput}
                    onChange={e => setDayDateInput(e.target.value)}
                    autoFocus
                    className="rounded border border-border-subtle bg-brand-black px-2 py-1 text-xs text-brand-white focus:border-brand-purple focus:outline-none [color-scheme:dark]"
                  />
                  <button type="button" onClick={() => saveDayDate(matchday)}
                    disabled={setMatchdayDate.isPending}
                    className="text-xs font-bold text-brand-purple hover:text-brand-white transition-colors">
                    ✓
                  </button>
                  <button type="button" onClick={() => setEditingDay(null)}
                    className="text-xs text-content-secondary hover:text-brand-white transition-colors">
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => openDayEdit(matchday, sharedDate)}
                  className="flex items-center gap-1.5 text-xs text-content-secondary hover:text-brand-white transition-colors"
                >
                  {dateStr ? (
                    <span className="font-medium text-brand-white">{fmtDate(dateStr)}</span>
                  ) : (
                    <span className="opacity-50">Ustaw datę</span>
                  )}
                  <span className="opacity-40">✎</span>
                </button>
              )}
            </div>

            {/* Matches */}
            <div className="flex flex-col divide-y divide-border-subtle/50">
              {dayMatches.map(match => (
                <div
                  key={match.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <span className="flex-1 text-right text-sm font-medium text-brand-white">{match.home_name}</span>

                  <div className="w-28 shrink-0 text-center">
                    {editing === match.id ? (
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number" min={0} value={homeScore}
                          onChange={e => setHomeScore(e.target.value)}
                          className="w-10 rounded border border-border-subtle bg-brand-black px-1.5 py-1 text-center text-sm text-brand-white focus:border-brand-purple focus:outline-none"
                        />
                        <span className="text-content-secondary">-</span>
                        <input
                          type="number" min={0} value={awayScore}
                          onChange={e => setAwayScore(e.target.value)}
                          className="w-10 rounded border border-border-subtle bg-brand-black px-1.5 py-1 text-center text-sm text-brand-white focus:border-brand-purple focus:outline-none"
                        />
                        <button type="button" onClick={() => saveResult(match.id)} disabled={updateMatch.isPending}
                          className="ml-1 text-xs font-bold text-brand-purple hover:text-brand-white transition-colors px-1">
                          ✓
                        </button>
                        <button type="button" onClick={() => setEditing(null)}
                          className="text-xs text-content-secondary hover:text-brand-white transition-colors px-1">
                          ✕
                        </button>
                      </div>
                    ) : match.status === 'finished' ? (
                      <button type="button" onClick={() => startEdit(match)}
                        className="group text-sm font-bold tabular-nums text-brand-white hover:text-brand-purple transition-colors"
                        title="Edytuj wynik">
                        {match.home_score}
                        <span className="mx-1 text-content-secondary">-</span>
                        {match.away_score}
                        <span className="ml-1 text-[10px] opacity-0 group-hover:opacity-60 transition-opacity">{scoreLabel}</span>
                      </button>
                    ) : (
                      <button type="button" onClick={() => startEdit(match)}
                        className="rounded-lg border border-dashed border-border-subtle px-3 py-1 text-xs text-content-secondary hover:border-brand-purple/50 hover:text-brand-white transition-colors">
                        Wpisz wynik
                      </button>
                    )}
                  </div>

                  <span className="flex-1 text-sm font-medium text-brand-white">{match.away_name}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Roster tab ────────────────────────────────────────────────────────────────

type PendingLink = { memberId: number; memberName: string; player: Player };

function RosterTab({ leagueId, isDraft }: { leagueId: number; isDraft: boolean }) {
  const { data: league }      = useLeague(leagueId);
  const { data: playersData } = usePlayers();
  const addMember             = useAddLeagueMember(leagueId);
  const removeMember          = useRemoveLeagueMember(leagueId);
  const linkPlayer            = useLinkPlayer(leagueId);

  const [mode, setMode]                         = useState<'player' | 'placeholder'>('player');
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [placeholderName, setPlaceholderName]   = useState('');
  const [search, setSearch]                     = useState('');
  // which pending member has the link panel open
  const [linkingId, setLinkingId]               = useState<number | null>(null);
  const [linkSearch, setLinkSearch]             = useState('');
  // confirmation step before actually linking
  const [pendingLink, setPendingLink]           = useState<PendingLink | null>(null);

  const allPlayers: Player[]  = playersData?.results ?? [];
  const members               = league?.members ?? [];
  const memberPlayerIds       = new Set(members.map(m => m.player_id).filter(Boolean));

  const filtered = allPlayers.filter(p =>
    !memberPlayerIds.has(p.id) &&
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  const linkFiltered = allPlayers.filter(p =>
    !memberPlayerIds.has(p.id) &&
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(linkSearch.toLowerCase())
  );

  function handleAdd() {
    if (mode === 'player' && selectedPlayerId) {
      addMember.mutate({ player_id: selectedPlayerId }, {
        onSuccess: () => { setSelectedPlayerId(null); setSearch(''); },
      });
    } else if (mode === 'placeholder' && placeholderName.trim()) {
      addMember.mutate({ display_name: placeholderName.trim() }, {
        onSuccess: () => setPlaceholderName(''),
      });
    }
  }

  function selectPlayerForLink(memberId: number, memberName: string, player: Player) {
    setPendingLink({ memberId, memberName, player });
    setLinkSearch('');
  }

  function confirmLink() {
    if (!pendingLink) return;
    linkPlayer.mutate(
      { memberId: pendingLink.memberId, playerId: pendingLink.player.id },
      { onSuccess: () => { setPendingLink(null); setLinkingId(null); } },
    );
  }

  function cancelLink() {
    setPendingLink(null);
  }

  function closeLinkPanel(memberId: number) {
    if (linkingId === memberId) { setLinkingId(null); setLinkSearch(''); setPendingLink(null); }
    else { setLinkingId(memberId); setLinkSearch(''); setPendingLink(null); }
  }

  const pendingMembers = members.filter(m => m.status === 'pending');
  const activeMembers  = members.filter(m => m.status === 'active');

  return (
    <div className="flex flex-col gap-5">

      {/* Add form — only when draft */}
      {isDraft && (
        <div className="rounded-xl border border-border-subtle bg-white/3 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-content-secondary">Dodaj gracza</p>

          <div className="mb-3 flex gap-2">
            {(['player', 'placeholder'] as const).map(m => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={[
                  'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                  mode === m
                    ? 'border-brand-purple bg-brand-purple/10 text-brand-white'
                    : 'border-border-subtle text-content-secondary hover:border-brand-purple/50 hover:text-brand-white',
                ].join(' ')}>
                {m === 'player' ? 'Zarejestrowany gracz' : 'Placeholder (niezarejestrowany)'}
              </button>
            ))}
          </div>

          {mode === 'player' ? (
            <div className="flex flex-col gap-2">
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Szukaj gracza…"
                className="rounded-lg border border-border-subtle bg-brand-black px-3 py-2 text-sm text-brand-white placeholder:text-content-secondary focus:border-brand-purple focus:outline-none transition-colors"
              />
              {search && (
                <div className="max-h-44 overflow-y-auto rounded-lg border border-border-subtle bg-brand-black">
                  {filtered.length === 0
                    ? <p className="px-4 py-3 text-sm text-content-secondary">Brak wyników.</p>
                    : filtered.slice(0, 8).map(p => (
                      <button key={p.id} type="button"
                        onClick={() => { setSelectedPlayerId(p.id); setSearch(`${p.first_name} ${p.last_name}`); }}
                        className="w-full px-4 py-2.5 text-left text-sm text-content-secondary hover:bg-white/5 hover:text-brand-white transition-colors">
                        {p.first_name} {p.last_name}
                      </button>
                    ))}
                </div>
              )}
            </div>
          ) : (
            <input
              type="text" value={placeholderName} onChange={e => setPlaceholderName(e.target.value)}
              placeholder="Imię i nazwisko (np. Anna Kowalska)"
              className="w-full rounded-lg border border-border-subtle bg-brand-black px-3 py-2 text-sm text-brand-white placeholder:text-content-secondary focus:border-brand-purple focus:outline-none transition-colors"
            />
          )}

          <button
            type="button" onClick={handleAdd}
            disabled={addMember.isPending || (mode === 'player' ? !selectedPlayerId : !placeholderName.trim())}
            className="mt-3 rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-brand-white transition-opacity disabled:opacity-40 hover:bg-brand-purple/80">
            {addMember.isPending ? 'Dodawanie…' : 'Dodaj'}
          </button>
        </div>
      )}

      {/* Members list */}
      {members.length === 0 ? (
        <EmptyMsg>Brak graczy w lidze.</EmptyMsg>
      ) : (
        <div className="flex flex-col gap-2">

          {activeMembers.map(member => (
            <div key={member.id}
              className="flex items-center justify-between rounded-xl border border-border-subtle bg-white/3 px-4 py-3">
              <span className="text-sm font-medium text-brand-white">{member.display_name}</span>
              {isDraft && (
                <button type="button"
                  onClick={() => { if (confirm(`Usunąć ${member.display_name}?`)) removeMember.mutate(member.id); }}
                  className="rounded p-1 text-content-secondary hover:text-red-400 transition-colors"
                  aria-label="Usuń">
                  ✕
                </button>
              )}
            </div>
          ))}

          {pendingMembers.map(member => (
            <div key={member.id} className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
              {/* Header row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-brand-white">{member.display_name}</span>
                  <PendingBadge />
                </div>
                <div className="flex items-center gap-2">
                  <button type="button"
                    onClick={() => closeLinkPanel(member.id)}
                    className="rounded-lg border border-amber-500/30 px-3 py-1 text-xs font-medium text-amber-400 hover:border-amber-500/60 transition-colors">
                    {linkingId === member.id ? 'Zamknij' : 'Powiąż z kontem'}
                  </button>
                  {isDraft && (
                    <button type="button"
                      onClick={() => { if (confirm(`Usunąć ${member.display_name}?`)) removeMember.mutate(member.id); }}
                      className="rounded p-1 text-content-secondary hover:text-red-400 transition-colors"
                      aria-label="Usuń">
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Link panel */}
              {linkingId === member.id && (
                <div className="mt-3 border-t border-amber-500/15 pt-3">
                  {pendingLink && pendingLink.memberId === member.id ? (
                    /* ── Confirmation step ── */
                    <div className="rounded-lg border border-brand-purple/30 bg-brand-purple/8 px-4 py-3">
                      <p className="mb-0.5 text-xs text-content-secondary">Potwierdzenie powiązania</p>
                      <p className="text-sm text-brand-white">
                        Czy chcesz powiązać{' '}
                        <span className="font-semibold text-amber-300">{pendingLink.memberName}</span>
                        {' '}z kontem{' '}
                        <span className="font-semibold text-brand-purple">
                          {pendingLink.player.first_name} {pendingLink.player.last_name}
                        </span>
                        ?
                      </p>
                      <p className="mt-0.5 text-xs text-content-secondary">
                        Ta operacja jest nieodwracalna — wyniki meczów pozostaną przypisane do tego gracza.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={confirmLink}
                          disabled={linkPlayer.isPending}
                          className="rounded-lg bg-brand-purple px-4 py-1.5 text-sm font-semibold text-brand-white transition-opacity disabled:opacity-40 hover:bg-brand-purple/80">
                          {linkPlayer.isPending ? 'Zapisywanie…' : 'Potwierdź'}
                        </button>
                        <button type="button" onClick={cancelLink}
                          className="rounded-lg border border-border-subtle px-4 py-1.5 text-sm font-medium text-content-secondary hover:text-brand-white transition-colors">
                          Anuluj
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── Search step ── */
                    <div className="flex flex-col gap-2">
                      <input
                        type="text" value={linkSearch} onChange={e => setLinkSearch(e.target.value)}
                        placeholder="Szukaj zarejestrowanego gracza…"
                        autoFocus
                        className="rounded-lg border border-border-subtle bg-brand-black px-3 py-2 text-sm text-brand-white placeholder:text-content-secondary focus:border-brand-purple focus:outline-none transition-colors"
                      />
                      {linkSearch && (
                        <div className="max-h-36 overflow-y-auto rounded-lg border border-border-subtle bg-brand-black">
                          {linkFiltered.length === 0
                            ? <p className="px-4 py-3 text-sm text-content-secondary">Brak wyników.</p>
                            : linkFiltered.slice(0, 6).map(p => (
                              <button key={p.id} type="button"
                                onClick={() => selectPlayerForLink(member.id, member.display_name, p)}
                                className="w-full px-4 py-2.5 text-left text-sm text-content-secondary hover:bg-white/5 hover:text-brand-white transition-colors">
                                {p.first_name} {p.last_name}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shared ────────────────────────────────────────────────────────────────────

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-border-subtle px-2.5 py-0.5">{children}</span>;
}

function StatusChip({ status }: { status: string }) {
  const color =
    status === 'active'   ? 'text-green-400 bg-green-500/10 border-green-500/20' :
    status === 'finished' ? 'text-content-secondary bg-white/5 border-white/10'   :
                            'text-amber-400 bg-amber-500/10 border-amber-500/20';
  const label =
    status === 'active' ? 'Aktywna' : status === 'finished' ? 'Zakończona' : 'Szkic';
  return (
    <span className={`rounded-full border px-2.5 py-0.5 font-bold uppercase tracking-wide ${color}`}>{label}</span>
  );
}

function PendingBadge() {
  return (
    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-400">PENDING</span>
  );
}

function EmptyMsg({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-white/3 px-4 py-10 text-center text-sm text-content-secondary">
      {children}
    </div>
  );
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}
