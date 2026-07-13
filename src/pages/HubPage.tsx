import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePlayers, useCreatePlayer, useDeletePlayer, useUpdatePlayer } from '../hooks/usePlayers';
import { useVenues, useCreateVenue, useDeleteVenue, useUpdateVenue } from '../hooks/useVenues';
import type { Player } from '../types/player';
import type { Venue, VenuePayload } from '../types/venue';
import { roundToNearestMultipleOf3, SET_MIN, SET_MAX, LEG_MIN, LEG_MAX, roundToNearestOdd } from '../types/tournament';
import { botLevel } from '../utils/dart501';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Field } from '../components/ui/Field';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { BestOfField } from '../components/tournament/BestOfField';

// ── Bot form modal ────────────────────────────────────────────────────────────

type BotFormModalProps = {
  initial?: { firstName: string; lastName: string; avg: number };
  title:    string;
  onClose:  () => void;
  onSubmit: (data: { firstName: string; lastName: string; avg: number }) => void;
  isPending: boolean;
  isError:   boolean;
};

function BotFormModal({ initial, title, onClose, onSubmit, isPending, isError }: BotFormModalProps) {
  const [firstName, setFirstName] = useState(initial?.firstName ?? '');
  const [lastName,  setLastName]  = useState(initial?.lastName  ?? '');
  const [avgStr,    setAvgStr]    = useState(String(initial?.avg ?? 45));
  const avg = Number(avgStr);

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;
    onSubmit({ firstName: firstName.trim(), lastName: lastName.trim(), avg });
  }

  return (
    <Modal title={title} size="sm" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            autoFocus
            type="text"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            placeholder="Imię"
            maxLength={50}
          />
          <Input
            type="text"
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            placeholder="Nazwisko"
            maxLength={50}
          />
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs text-content-secondary">Poziom trudności</span>
            <span className="text-sm font-semibold text-content-primary">
              {botLevel(avg)}
              <span className="ml-1.5 text-xs font-normal text-content-secondary">śr. {avg}</span>
            </span>
          </div>
          <input
            type="range" min="10" max="110" step="1"
            value={avgStr}
            onChange={e => setAvgStr(e.target.value)}
            className="w-full cursor-pointer accent-content-accent"
          />
          <div className="mt-1 flex justify-between text-xs text-content-faint">
            <span>Rekreacyjny</span>
            <span>Średni</span>
            <span>Pro</span>
          </div>
        </div>

        {isError && (
          <p className="text-xs text-score-down-text">Nie udało się zapisać bota.</p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Anuluj</Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={isPending}
            disabled={isPending || !firstName.trim() || !lastName.trim()}
          >
            {isPending ? 'Zapisywanie…' : 'Zapisz'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Venue form modal ──────────────────────────────────────────────────────────

type VenueFormModalProps = {
  initial?: VenuePayload;
  title:    string;
  onClose:  () => void;
  onSubmit: (data: VenuePayload) => void;
  isPending: boolean;
  isError:   boolean;
};

function VenueFormModal({ initial, title, onClose, onSubmit, isPending, isError }: VenueFormModalProps) {
  const [name,            setName]            = useState(initial?.name            ?? '');
  const [address,         setAddress]         = useState(initial?.address         ?? '');
  const [boardCount,      setBoardCount]      = useState(initial?.board_count     ?? 1);
  const [setsInput,       setSetsInput]       = useState(String(initial?.default_sets ?? SET_MIN));
  const [legsInput,       setLegsInput]       = useState(String(initial?.default_legs ?? 5));
  const [maxDartsEnabled, setMaxDartsEnabled] = useState(initial?.max_darts_per_leg != null);
  const [maxDartsInput,   setMaxDartsInput]   = useState(String(initial?.max_darts_per_leg ?? 21));

  const sets = roundToNearestOdd(Number(setsInput), SET_MIN, SET_MAX);
  const legs = roundToNearestOdd(Number(legsInput), LEG_MIN, LEG_MAX);

  function normalizeMaxDarts() {
    setMaxDartsInput(String(roundToNearestMultipleOf3(Number(maxDartsInput))));
  }

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name:              name.trim(),
      address:           address.trim(),
      board_count:       boardCount,
      default_sets:      sets,
      default_legs:      legs,
      // Re-derive from the raw input rather than trusting onBlur to have fired —
      // a value not divisible by 3 must never reach the API.
      max_darts_per_leg: maxDartsEnabled ? roundToNearestMultipleOf3(Number(maxDartsInput)) : null,
    });
  }

  return (
    <Modal title={title} size="md" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        <Field label="Nazwa lokalu">
          <Input
            autoFocus
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="np. Klub Bilardowy Pod Orłem"
            maxLength={200}
          />
        </Field>

        <Field label="Adres">
          <Input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="np. Warszawa, Partyzantów 25"
            maxLength={300}
          />
        </Field>

        <Field label="Liczba tarcz">
          <Input
            type="number"
            min={1}
            max={50}
            value={boardCount}
            onChange={e => setBoardCount(Math.max(1, Number(e.target.value)))}
          />
        </Field>

        <div className="flex flex-col gap-4 rounded-xl border border-border-subtle p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-content-secondary">
            Domyślny format meczu
          </p>

          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-content-secondary">Sety (best of)</p>
            <BestOfField value={setsInput} min={SET_MIN} max={SET_MAX} onChange={setSetsInput} onBlur={() => setSetsInput(String(sets))} />
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-content-secondary">Legi (best of)</p>
            <BestOfField value={legsInput} min={LEG_MIN} max={LEG_MAX} onChange={setLegsInput} onBlur={() => setLegsInput(String(legs))} />
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex cursor-pointer items-center justify-between">
              <div>
                <p className="text-xs text-content-secondary">Limit lotek na leg</p>
                <p className="text-xs text-content-faint">
                  Jeśli nikt nie zamknie lega w tym limicie — decyduje bull.
                </p>
              </div>
              <input
                type="checkbox"
                checked={maxDartsEnabled}
                onChange={e => setMaxDartsEnabled(e.target.checked)}
                className="size-4 cursor-pointer accent-content-accent"
              />
            </label>

            {maxDartsEnabled && (
              <div className="flex flex-col gap-1.5">
                <Input
                  type="number"
                  min={3}
                  step={3}
                  value={maxDartsInput}
                  onChange={e => setMaxDartsInput(e.target.value)}
                  onBlur={normalizeMaxDarts}
                  className="max-w-32"
                />
                <p className="text-xs text-content-faint">
                  Zaokrąglane do najbliższej wielokrotności 3 (jedna kolejka = 3 lotki).
                </p>
              </div>
            )}
          </div>
        </div>

        {isError && (
          <p className="text-xs text-score-down-text">Nie udało się zapisać lokalu.</p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Anuluj</Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={isPending}
            disabled={isPending || !name.trim()}
          >
            {isPending ? 'Zapisywanie…' : 'Zapisz'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Edit/Delete row icons ─────────────────────────────────────────────────────

const EditIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const DeleteIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4h6v2" />
  </svg>
);

// ── Page ──────────────────────────────────────────────────────────────────────

type BotModal =
  | { mode: 'create' }
  | { mode: 'edit'; bot: Player }
  | null;

type VenueModal =
  | { mode: 'create' }
  | { mode: 'edit'; venue: Venue }
  | null;

type Tab = 'boty' | 'lokale';

const TAB_OPTIONS = [
  { value: 'boty'   as Tab, label: 'Moje boty'  },
  { value: 'lokale' as Tab, label: 'Lokale'     },
];

export function HubPage() {
  const { username } = useAuth();
  const [tab, setTab] = useState<Tab>('boty');

  // ── Bots state ──────────────────────────────────────────────────────────────
  const { data, isLoading }  = usePlayers();
  const createBot = useCreatePlayer();
  const deleteBot = useDeletePlayer();
  const [botModal,   setBotModal]   = useState<BotModal>(null);
  const [editingBotId, setEditingBotId] = useState<number | null>(null);
  const updateBot = useUpdatePlayer(editingBotId ?? 0);
  const bots: Player[] = (data ?? []).filter(p => p.cpu);

  // ── Venues state ────────────────────────────────────────────────────────────
  const { data: venues = [], isLoading: venuesLoading } = useVenues();
  const createVenue = useCreateVenue();
  const deleteVenue = useDeleteVenue();
  const [venueModal,    setVenueModal]    = useState<VenueModal>(null);
  const [editingVenueId, setEditingVenueId] = useState<number | null>(null);
  const updateVenue = useUpdateVenue(editingVenueId ?? 0);

  if (!username) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-20 text-center lg:px-8">
        <p className="text-sm text-content-secondary">
          Zaloguj się, aby zarządzać własnymi zawodnikami.
        </p>
      </div>
    );
  }

  // ── Bot handlers ────────────────────────────────────────────────────────────
  function handleDeleteBot(bot: Player) {
    if (!confirm(`Usunąć bota „${bot.first_name} ${bot.last_name}"?`)) return;
    deleteBot.mutate(bot.id);
  }

  function openEditBot(bot: Player) {
    setEditingBotId(bot.id);
    setBotModal({ mode: 'edit', bot });
  }

  function closeBotModal() {
    setBotModal(null);
    createBot.reset();
    updateBot.reset();
  }

  function handleCreateBot(d: { firstName: string; lastName: string; avg: number }) {
    createBot.mutate(
      { first_name: d.firstName, last_name: d.lastName, average: d.avg, cpu: true },
      { onSuccess: closeBotModal },
    );
  }

  function handleUpdateBot(d: { firstName: string; lastName: string; avg: number }) {
    updateBot.mutate(
      { first_name: d.firstName, last_name: d.lastName, average: d.avg },
      { onSuccess: closeBotModal },
    );
  }

  // ── Venue handlers ──────────────────────────────────────────────────────────
  function handleDeleteVenue(venue: Venue) {
    if (!confirm(`Usunąć lokal „${venue.name}"?`)) return;
    deleteVenue.mutate(venue.id);
  }

  function openEditVenue(venue: Venue) {
    setEditingVenueId(venue.id);
    setVenueModal({ mode: 'edit', venue });
  }

  function closeVenueModal() {
    setVenueModal(null);
    createVenue.reset();
    updateVenue.reset();
  }

  function handleCreateVenue(payload: VenuePayload) {
    createVenue.mutate(payload, { onSuccess: closeVenueModal });
  }

  function handleUpdateVenue(payload: VenuePayload) {
    updateVenue.mutate(payload, { onSuccess: closeVenueModal });
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-content-primary">Hub</h1>
        <p className="mt-1 text-sm text-content-secondary">
          Zarządzaj własnymi zawodnikami i lokalami.
        </p>
      </div>

      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={TAB_OPTIONS}
        aria-label="Sekcja Hub"
        className="mb-6"
      />

      {/* ── Boty tab ─────────────────────────────────────────────────────── */}
      {tab === 'boty' && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-content-secondary">
                Moje boty
              </h2>
              {bots.length > 0 && (
                <Badge variant="neutral" mono>{bots.length}</Badge>
              )}
            </div>
            <Button variant="secondary" size="sm" onClick={() => setBotModal({ mode: 'create' })}>
              + Dodaj bota
            </Button>
          </div>

          {isLoading ? (
            <p className="py-10 text-center text-sm text-content-secondary">Ładowanie…</p>
          ) : bots.length === 0 ? (
            <div className="rounded-xl border border-border-subtle py-14 text-center">
              <p className="text-sm text-content-secondary">Nie masz jeszcze żadnych botów.</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setBotModal({ mode: 'create' })}
                className="mt-4"
              >
                Utwórz pierwszego bota
              </Button>
            </div>
          ) : (
            <Card padding="none">
              {bots.map((bot, i) => (
                <div
                  key={bot.id}
                  className={[
                    'flex items-center justify-between px-4 py-3 transition-colors hover:bg-surface-muted',
                    i > 0 ? 'border-t border-border-subtle' : '',
                  ].join(' ')}
                >
                  <div>
                    <p className="text-sm font-medium text-content-primary">
                      {bot.first_name} {bot.last_name}
                    </p>
                    <p className="text-xs text-content-secondary">
                      {botLevel(Number(bot.average))}
                      <span className="ml-2 tabular-nums text-content-faint">śr. {Number(bot.average).toFixed(1)}</span>
                    </p>
                  </div>

                  <div className="ml-4 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditBot(bot)}
                      aria-label="Edytuj bota"
                      className="rounded-lg p-1.5 text-content-secondary transition-colors hover:text-content-primary"
                    >
                      <EditIcon />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBot(bot)}
                      disabled={deleteBot.isPending}
                      aria-label="Usuń bota"
                      className="rounded-lg p-1.5 text-content-secondary transition-colors hover:text-score-down-text disabled:opacity-30"
                    >
                      <DeleteIcon />
                    </button>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </section>
      )}

      {/* ── Lokale tab ───────────────────────────────────────────────────── */}
      {tab === 'lokale' && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-content-secondary">
                Moje lokale
              </h2>
              {venues.length > 0 && (
                <Badge variant="neutral" mono>{venues.length}</Badge>
              )}
            </div>
            <Button variant="secondary" size="sm" onClick={() => setVenueModal({ mode: 'create' })}>
              + Dodaj lokal
            </Button>
          </div>

          {venuesLoading ? (
            <p className="py-10 text-center text-sm text-content-secondary">Ładowanie…</p>
          ) : venues.length === 0 ? (
            <div className="rounded-xl border border-border-subtle py-14 text-center">
              <p className="text-sm text-content-secondary">Nie masz jeszcze żadnych lokali.</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setVenueModal({ mode: 'create' })}
                className="mt-4"
              >
                Dodaj pierwszy lokal
              </Button>
            </div>
          ) : (
            <Card padding="none">
              {venues.map((venue, i) => (
                <div
                  key={venue.id}
                  className={[
                    'flex items-start justify-between px-4 py-3 transition-colors hover:bg-surface-muted',
                    i > 0 ? 'border-t border-border-subtle' : '',
                  ].join(' ')}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-content-primary">{venue.name}</p>
                    {venue.address && (
                      <p className="text-xs text-content-secondary">{venue.address}</p>
                    )}
                    <p className="mt-0.5 text-xs tabular-nums text-content-faint">
                      {venue.board_count} {venue.board_count === 1 ? 'tarcza' : venue.board_count < 5 ? 'tarcze' : 'tarcz'}
                      {' · '}
                      {venue.default_sets > 1
                        ? `${venue.default_sets} sety / ${venue.default_legs} legi`
                        : `${venue.default_legs} legi`}
                      {venue.max_darts_per_leg != null
                        ? ` · max ${venue.max_darts_per_leg} lotek`
                        : ''}
                    </p>
                  </div>

                  <div className="ml-4 flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditVenue(venue)}
                      aria-label="Edytuj lokal"
                      className="rounded-lg p-1.5 text-content-secondary transition-colors hover:text-content-primary"
                    >
                      <EditIcon />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteVenue(venue)}
                      disabled={deleteVenue.isPending}
                      aria-label="Usuń lokal"
                      className="rounded-lg p-1.5 text-content-secondary transition-colors hover:text-score-down-text disabled:opacity-30"
                    >
                      <DeleteIcon />
                    </button>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </section>
      )}

      {/* ── Bot modals ───────────────────────────────────────────────────── */}
      {botModal?.mode === 'create' && (
        <BotFormModal
          title="Nowy bot"
          onClose={closeBotModal}
          onSubmit={handleCreateBot}
          isPending={createBot.isPending}
          isError={createBot.isError}
        />
      )}
      {botModal?.mode === 'edit' && (
        <BotFormModal
          title={`Edytuj: ${botModal.bot.first_name} ${botModal.bot.last_name}`}
          initial={{
            firstName: botModal.bot.first_name,
            lastName:  botModal.bot.last_name,
            avg:       Math.round(Number(botModal.bot.average)),
          }}
          onClose={closeBotModal}
          onSubmit={handleUpdateBot}
          isPending={updateBot.isPending}
          isError={updateBot.isError}
        />
      )}

      {/* ── Venue modals ─────────────────────────────────────────────────── */}
      {venueModal?.mode === 'create' && (
        <VenueFormModal
          title="Nowy lokal"
          onClose={closeVenueModal}
          onSubmit={handleCreateVenue}
          isPending={createVenue.isPending}
          isError={createVenue.isError}
        />
      )}
      {venueModal?.mode === 'edit' && (
        <VenueFormModal
          title={`Edytuj: ${venueModal.venue.name}`}
          initial={{
            name:              venueModal.venue.name,
            address:           venueModal.venue.address,
            board_count:       venueModal.venue.board_count,
            default_sets:      venueModal.venue.default_sets,
            default_legs:      venueModal.venue.default_legs,
            max_darts_per_leg: venueModal.venue.max_darts_per_leg,
          }}
          onClose={closeVenueModal}
          onSubmit={handleUpdateVenue}
          isPending={updateVenue.isPending}
          isError={updateVenue.isError}
        />
      )}
    </div>
  );
}
