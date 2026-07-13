import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTournaments } from '../hooks/useTournaments';
import {
  useTournamentCycle, useCycleStandings, useAddCycleEvent, useUpdateCycleEvent,
} from '../hooks/useTournamentCycles';
import { CycleStatusBadge } from '../components/cycle/CycleStatusBadge';
import { TournamentSearchSelect } from '../components/cycle/TournamentSearchSelect';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Tag } from '../components/ui/Tag';
import { Modal } from '../components/ui/Modal';
import { cn } from '../components/ui/cn';
import { fmtDate } from '../utils/formatting';
import type { CycleEvent } from '../types/tournamentCycle';

export function CycleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const cycleId = Number(id);
  const navigate = useNavigate();
  const { username } = useAuth();

  const { data: cycle, isLoading, isError } = useTournamentCycle(cycleId);
  const { data: standings = [] } = useCycleStandings(cycleId);
  const { data: tournamentsPage } = useTournaments();
  const addEvent    = useAddCycleEvent(cycleId);
  const updateEvent = useUpdateCycleEvent(cycleId);

  const [attachEventId, setAttachEventId] = useState<number | null>(null);
  const [newEventName,  setNewEventName]  = useState('');
  const [newEventDate,  setNewEventDate]  = useState('');

  if (isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <p className="text-sm text-content-secondary">
          Cykl nie istnieje albo jest prywatny i nie masz do niego dostępu.
        </p>
        <Button variant="secondary" size="sm" onClick={() => navigate('/ligi')}>Wróć do listy</Button>
      </div>
    );
  }

  if (isLoading || !cycle) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-sm text-content-secondary">Ładowanie...</span>
      </div>
    );
  }

  const isOwner = !!username && username === cycle.owner_username;
  const allTournaments = tournamentsPage?.results ?? [];
  const usedTournamentIds = new Set(cycle.events.map(e => e.tournament_id).filter((v): v is number => v !== null));
  const myAvailableTournaments = allTournaments.filter(t =>
    t.owner_username === username && !usedTournamentIds.has(t.id)
  );

  function handleAttach(eventId: number, tournamentId: number) {
    updateEvent.mutate({ eventId, data: { tournament_id: tournamentId } });
    setAttachEventId(null);
  }

  function handleAddEvent() {
    if (!newEventName.trim()) return;
    addEvent.mutate(
      { name: newEventName.trim(), planned_date: newEventDate || null },
      { onSuccess: () => { setNewEventName(''); setNewEventDate(''); } },
    );
  }

  const scoringLabel = cycle.scoring_mode === 'placement' ? 'Punkty za miejsce' : 'Suma wygranych meczy';

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">
      <Button variant="ghost" size="md" onClick={() => navigate('/ligi')} className="mb-6">
        ← Wróć do listy
      </Button>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-content-primary">{cycle.name}</h1>
            <CycleStatusBadge status={cycle.status} />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Tag>{scoringLabel}</Tag>
            {cycle.is_private && <Tag>Prywatny</Tag>}
            {cycle.bonus_180_points != null && <Tag>+{cycle.bonus_180_points} pkt / 180</Tag>}
            {cycle.bonus_high_checkout_points != null && <Tag>+{cycle.bonus_high_checkout_points} pkt / checkout 100+</Tag>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Events / calendar */}
        <section className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-widest text-content-secondary">
            Kalendarz turniejów
          </p>

          <div className="flex flex-col gap-2">
            {cycle.events.map(event => (
              <EventRow
                key={event.id}
                event={event}
                isOwner={isOwner}
                onAttachClick={() => setAttachEventId(event.id)}
              />
            ))}
          </div>

          {isOwner && (
            <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-overlay p-3">
              <Input
                type="text"
                value={newEventName}
                onChange={e => setNewEventName(e.target.value)}
                placeholder="Nazwa nowego wydarzenia"
                className="flex-1"
              />
              <Input
                type="date"
                value={newEventDate}
                onChange={e => setNewEventDate(e.target.value)}
                className="max-w-40 shrink-0"
              />
              <Button variant="secondary" size="sm" disabled={!newEventName.trim()} onClick={handleAddEvent}>
                Dodaj
              </Button>
            </div>
          )}
        </section>

        {/* Standings */}
        <section className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-widest text-content-secondary">
            Klasyfikacja
          </p>
          <StandingsTable events={cycle.events} rows={standings} />
        </section>
      </div>

      {attachEventId !== null && (
        <Modal
          title="Podepnij turniej"
          description="Wybierz jeden ze swoich turniejów, żeby powiązać go z tym wydarzeniem."
          onClose={() => setAttachEventId(null)}
          size="sm"
        >
          {myAvailableTournaments.length === 0 ? (
            <p className="text-sm text-content-secondary">
              Brak dostępnych turniejów — utwórz nowy turniej, żeby móc go tu podpiąć.
            </p>
          ) : (
            <TournamentSearchSelect
              tournaments={myAvailableTournaments}
              onSelect={(t) => handleAttach(attachEventId, t.id)}
              placeholder="Szukaj turnieju…"
            />
          )}
        </Modal>
      )}
    </div>
  );
}

function EventRow({ event, isOwner, onAttachClick }: {
  event: CycleEvent; isOwner: boolean; onAttachClick: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-overlay p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-content-primary">{event.name}</p>
        <p className="text-xs text-content-secondary">
          {event.planned_date ? fmtDate(event.planned_date) : 'Brak daty'}
        </p>
      </div>

      {event.tournament_id !== null ? (
        <Link
          to={`/turnieje/${event.tournament_id}`}
          className="shrink-0 text-xs font-medium text-content-accent hover:underline"
        >
          {event.tournament_active ? 'W trakcie' : 'Zakończony'} →
        </Link>
      ) : isOwner ? (
        <Button variant="secondary" size="sm" onClick={onAttachClick} className="shrink-0">
          Podepnij turniej
        </Button>
      ) : (
        <span className="shrink-0 text-xs text-content-faint">Brak turnieju</span>
      )}
    </div>
  );
}

function StandingsTable({ events, rows }: {
  events: CycleEvent[];
  rows: { player_id: number | null; player_name: string; total_points: number; points_by_event: Record<number, number> }[];
}) {
  const decidedEvents = events.filter(e => e.tournament_id !== null);

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-border-subtle bg-surface-overlay p-4 text-sm text-content-secondary">
        Klasyfikacja pojawi się, gdy pierwszy turniej w cyklu zostanie zakończony.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border-subtle bg-surface-overlay">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-subtle text-xs uppercase tracking-wide text-content-secondary">
            <th className="px-3 py-2 text-left">#</th>
            <th className="px-3 py-2 text-left">Gracz</th>
            {decidedEvents.map(e => (
              <th key={e.id} className="px-3 py-2 text-right font-medium">{e.name}</th>
            ))}
            <th className="px-3 py-2 text-right">Suma</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={`${row.player_id}-${row.player_name}`}
              className="border-b border-border-subtle transition-colors last:border-0 hover:bg-surface-muted"
            >
              <td className={cn('px-3 py-2 tabular-nums', i === 0 ? 'font-bold text-rank-text' : 'text-content-faint')}>
                {i + 1}
              </td>
              <td className="px-3 py-2 font-medium text-content-primary">{row.player_name}</td>
              {decidedEvents.map(e => (
                <td key={e.id} className="px-3 py-2 text-right tabular-nums text-content-secondary">
                  {row.points_by_event[e.id] ?? '—'}
                </td>
              ))}
              <td className="px-3 py-2 text-right font-display text-base font-bold tabular-nums text-content-accent">
                {row.total_points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
