import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LeagueSetupStepper } from '../components/league/LeagueSetupStepper';
import { TournamentRosterStep } from '../components/tournament/TournamentRosterStep';
import { TournamentPhasesStep } from '../components/tournament/TournamentPhasesStep';
import { VenuePicker } from '../components/venue/VenuePicker';
import { generateBracket } from '../utils/bracket';
import { useCreateTournament } from '../hooks/useTournaments';
import type { TournamentFormat, TournamentPlayer } from '../types/tournament';
import type { PhaseConfig } from '../types/tournament';
import type { Venue } from '../types/venue';
import { roundToNearestMultipleOf3 } from '../types/tournament';
import { Field } from '../components/ui/Field';
import { Input } from '../components/ui/Input';
import { SelectableCard } from '../components/ui/SelectableCard';
import { Toggle } from '../components/ui/Toggle';

type FormatOption = { value: TournamentFormat; label: string; description: string };

const FORMAT_OPTIONS: FormatOption[] = [
  { value: 'knockout', label: 'SKO',   description: 'Single Knock-Out — przegrany odpada' },
  { value: 'groups',   label: 'Grupy', description: 'Faza grupowa, potem playoff'          },
];

export function TournamentSetupPage() {
  const navigate         = useNavigate();
  const createTournament = useCreateTournament();

  // Step 1 — config
  const [name,      setName]      = useState('');
  const [format,    setFormat]    = useState<TournamentFormat>('knockout');
  const [sets,      setSets]      = useState(1);
  const [legs,      setLegs]      = useState(5);
  const [isPrivate, setIsPrivate] = useState(false);
  const [venue,     setVenue]     = useState<Venue | null>(null);
  const [maxDartsEnabled, setMaxDartsEnabled] = useState(false);
  const [maxDartsInput,   setMaxDartsInput]   = useState('21');

  // Step 2 — roster
  const [groupSize, setGroupSize] = useState(4);
  const [entries,   setEntries]   = useState<TournamentPlayer[]>([]);
  const placeholderCounter        = useRef(0);

  // Step 3 — phases
  const [phaseConfigs, setPhaseConfigs] = useState<Record<string, PhaseConfig>>({});

  function handleVenueChange(next: Venue | null) {
    setVenue(next);
    if (next) {
      setSets(next.default_sets);
      setLegs(next.default_legs);
      setMaxDartsEnabled(next.max_darts_per_leg != null);
      setMaxDartsInput(String(next.max_darts_per_leg ?? 21));
    }
  }

  function normalizeMaxDarts() {
    setMaxDartsInput(String(roundToNearestMultipleOf3(Number(maxDartsInput))));
  }

  // Re-derive from the raw input rather than trusting onBlur to have fired —
  // a value not divisible by 3 must never reach the created tournament.
  const resolvedMaxDartsPerLeg = maxDartsEnabled ? roundToNearestMultipleOf3(Number(maxDartsInput)) : null;

  function handleFormatChange(next: TournamentFormat) {
    setFormat(next);
    setGroupSize(4);
    setPhaseConfigs({});
  }

  function handleGroupSizeChange(size: number) {
    setGroupSize(size);
    setPhaseConfigs({});
  }

  function addEntry(player: TournamentPlayer) {
    setEntries(prev => {
      if (prev.some(e => e.id === player.id)) return prev;
      return [...prev, player];
    });
  }

  function handleBulkSet(players: TournamentPlayer[]) {
    const placeholders = entries.filter(e => e.id < 0);
    setEntries([...players, ...placeholders]);
  }

  function handleAddPlaceholder(name: string) {
    placeholderCounter.current -= 1;
    addEntry({
      id:         placeholderCounter.current,
      first_name: name,
      last_name:  '',
      average:    '0',
      cpu:        false,
    });
  }

  function removeEntry(id: number) {
    setEntries(prev => prev.filter(e => e.id !== id));
  }

  function handleCreate() {
    const matchFormat = {
      sets,
      legs,
      ...(resolvedMaxDartsPerLeg != null ? { max_darts_per_leg: resolvedMaxDartsPerLeg } : {}),
    };
    const config = {
      name:               name.trim(),
      format,
      matchFormat,
      groupSize,
      phaseConfigs,
      players:            entries,
      is_private:         isPrivate,
      start_date:         phaseConfigs['round-0']?.date ?? phaseConfigs['groups']?.date ?? null,
      venue_board_count:  venue?.board_count ?? null,
    };
    const bracket = generateBracket(config);
    createTournament.mutate(
      { bracket, is_private: config.is_private, start_date: config.start_date ?? null },
      { onSuccess: (saved) => navigate(`/turnieje/${saved.id}`) },
    );
  }

  const configContent = (
    <div className="flex flex-col gap-5">
      <Field label="Nazwa turnieju">
        <Input
          autoFocus
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="np. Ligowe Starcie"
          maxLength={60}
        />
      </Field>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-widest text-content-secondary">Format</p>
        <div className="grid grid-cols-2 gap-3">
          {FORMAT_OPTIONS.map(({ value, label, description }) => (
            <SelectableCard
              key={value}
              layout="row"
              title={label}
              description={description}
              selected={format === value}
              onClick={() => handleFormatChange(value)}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-widest text-content-secondary">Lokal</p>
        <VenuePicker selectedId={venue?.id ?? null} onChange={handleVenueChange} />
        {venue && (
          <p className="text-xs text-content-faint">
            Domyślny format lokalu zastosowany — możesz go zmienić poniżej.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-surface-muted px-4 py-3">
        <label className="flex cursor-pointer items-center justify-between">
          <div>
            <p className="text-sm font-medium text-content-primary">Limit lotek na leg</p>
            <p className="text-xs text-content-secondary">
              Jeśli nikt nie zamknie lega w tym limicie — decyduje bull.
            </p>
          </div>
          <Toggle checked={maxDartsEnabled} onChange={setMaxDartsEnabled} />
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

      <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border-subtle bg-surface-muted px-4 py-3">
        <div>
          <p className="text-sm font-medium text-content-primary">Turniej prywatny</p>
          <p className="text-xs text-content-secondary">Widoczny tylko dla zaproszonych graczy</p>
        </div>
        <Toggle checked={isPrivate} onChange={setIsPrivate} />
      </label>
    </div>
  );

  const rosterContent = (
    <TournamentRosterStep
      format={format}
      groupSize={groupSize}
      onGroupSizeChange={handleGroupSizeChange}
      entries={entries}
      onBulkSet={handleBulkSet}
      onAddPlaceholder={handleAddPlaceholder}
      onRemove={removeEntry}
    />
  );

  const phasesContent = (
    <TournamentPhasesStep
      format={format}
      playerCount={entries.length}
      groupSize={groupSize}
      defaultFormat={{ sets, legs, max_darts_per_leg: resolvedMaxDartsPerLeg }}
      phaseConfigs={phaseConfigs}
      onChange={setPhaseConfigs}
    />
  );

  const steps = [
    { label: 'Konfiguracja', done: name.trim() !== '', content: configContent },
    { label: 'Gracze',       done: entries.length >= 2, content: rosterContent },
    { label: 'Fazy',         done: true, content: phasesContent },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">
      <h1 className="mb-6 text-xl font-semibold text-content-primary">Nowy turniej</h1>
      <LeagueSetupStepper
        steps={steps}
        canFinalize={name.trim() !== '' && entries.length >= 2}
        finalizing={createTournament.isPending}
        onFinalize={handleCreate}
        finalizeLabel="Utwórz turniej"
      />
    </div>
  );
}
