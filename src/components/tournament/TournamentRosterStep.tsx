import { useState } from 'react';
import type { Player } from '../../types/player';
import type { TournamentPlayer, TournamentFormat } from '../../types/tournament';
import { GROUP_SIZE_OPTIONS } from '../../types/tournament';
import { usePlayers } from '../../hooks/usePlayers';
import { SKILL_TIERS, skillTier } from '../../utils/skillTier';
import { useMediaQuery, LG_UP } from '../../hooks/useMediaQuery';
import { Input } from '../ui/Input';
import { Field } from '../ui/Field';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { OptionButton } from '../ui/OptionButton';
import { SegmentedControl } from '../ui/SegmentedControl';
import { SkillIcon } from '../ui/SkillIcon';
import { DualListPicker } from '../ui/DualListPicker';
import { Card } from '../ui/Card';
import { plural } from '../../utils/plural';

type Mode = 'all' | 'player' | 'cpu';

const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: 'all',    label: 'Wszyscy' },
  { value: 'player', label: 'Gracze'  },
  { value: 'cpu',    label: 'Boty'    },
];

function toTournamentPlayer(p: Player): TournamentPlayer {
  return { id: p.id, first_name: p.first_name, last_name: p.last_name, average: p.average, cpu: p.cpu };
}

/** `count` distinct random items (partial Fisher–Yates). */
function pickRandom<T>(items: readonly T[], count: number): T[] {
  const pool = [...items];
  const n    = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

function displayName(p: TournamentPlayer): string {
  return [p.first_name, p.last_name].filter(Boolean).join(' ');
}

function PlayerLabel({ player }: { player: TournamentPlayer }) {
  const isPlaceholder = player.id < 0;
  return (
    <>
      <SkillIcon avg={player.average} />
      <span className="truncate text-sm font-medium text-content-primary">{displayName(player)}</span>
      {player.cpu    && <Badge variant="neutral" mono>Bot</Badge>}
      {isPlaceholder && <Badge variant="rank"    mono>TBD</Badge>}
      {!isPlaceholder && Number(player.average) > 0 && (
        <span className="ml-auto shrink-0 text-xs tabular-nums text-content-faint">
          {parseFloat(player.average).toFixed(1)}
        </span>
      )}
    </>
  );
}

type Props = {
  format:            TournamentFormat;
  groupSize:         number;
  onGroupSizeChange: (n: number) => void;
  entries:           TournamentPlayer[];
  onAdd:             (player: TournamentPlayer) => void;
  onAddPlaceholder:  (name: string) => void;
  onRemove:          (id: number) => void;
  /** null = no limit. */
  maxPlayers:              number | null;
  maxPlayersInput:         string;
  onMaxPlayersInputChange: (v: string) => void;
};

export function TournamentRosterStep({
  format, groupSize, onGroupSizeChange, entries, onAdd, onAddPlaceholder, onRemove,
  maxPlayers, maxPlayersInput, onMaxPlayersInputChange,
}: Props) {
  // Laptop: the picker is inline in the step. Phone: it lives in a Modal.
  const isDesktop = useMediaQuery(LG_UP);
  const { data: playersData } = usePlayers();

  const [pickerOpen, setPickerOpen]           = useState(false);
  const [mode, setMode]                       = useState<Mode>('all');
  const [search, setSearch]                   = useState('');
  const [placeholderName, setPlaceholderName] = useState('');
  const [limitHit, setLimitHit]               = useState(false);
  // Bot-only filter by skill tier (medal). Empty = every tier.
  const [tierFilter, setTierFilter]           = useState<Set<number>>(new Set());
  const [randomInput, setRandomInput]         = useState('');
  const [randomInfo, setRandomInfo]           = useState<string | null>(null);

  const atLimit   = maxPlayers != null && entries.length >= maxPlayers;
  const overLimit = maxPlayers != null && entries.length > maxPlayers;
  const notice    = limitHit && atLimit
    ? `Osiągnięto limit ${maxPlayers} graczy — usuń kogoś, aby dodać innego.`
    : null;

  const entryIds  = new Set(entries.map(e => e.id));
  const query     = search.trim().toLowerCase();
  const candidates = (playersData ?? [])
    .filter(p => mode === 'all' || (mode === 'cpu' ? p.cpu : !p.cpu))
    .filter(p => !entryIds.has(p.id))
    .filter(p => query === '' || `${p.first_name} ${p.last_name}`.toLowerCase().includes(query));
  // Per-tier counts are taken before the tier filter so each chip shows what it would add.
  const tierCounts = new Map<number, number>();
  if (mode === 'cpu') {
    for (const p of candidates) {
      const level = skillTier(p.average)?.level;
      if (level) tierCounts.set(level, (tierCounts.get(level) ?? 0) + 1);
    }
  }
  const tierActive = mode === 'cpu' && tierFilter.size > 0;
  const available  = candidates
    .filter(p => !tierActive || tierFilter.has(skillTier(p.average)?.level ?? 0))
    .map(toTournamentPlayer);

  // Random draw from the visible bot list (respects search + tier filter),
  // never past the player limit. Empty input = fill the remaining slots.
  const freeSlots    = maxPlayers != null ? Math.max(0, maxPlayers - entries.length) : null;
  const parsedRandom = parseInt(randomInput, 10);
  const randomCount  = Number.isFinite(parsedRandom) && parsedRandom > 0 ? parsedRandom : freeSlots;
  const canRandom    = randomCount != null && randomCount > 0 && available.length > 0 && freeSlots !== 0;

  function handleRandom() {
    if (!canRandom || randomCount == null) return;
    const wanted = freeSlots != null ? Math.min(randomCount, freeSlots) : randomCount;
    const picked = pickRandom(available, wanted);
    picked.forEach(onAdd);
    setLimitHit(false);
    setRandomInfo(picked.length < randomCount
      ? `Dodano ${picked.length} z ${randomCount} — ${freeSlots != null && freeSlots < randomCount ? 'limit graczy' : 'brak więcej botów na liście'}.`
      : `Wylosowano ${picked.length} ${picked.length === 1 ? 'bota' : 'botów'}.`);
  }

  function toggleTier(level: number) {
    setTierFilter(prev => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  }

  const registeredCount = entries.filter(e => e.id > 0).length;
  const countLabel      = maxPlayers != null ? `${entries.length} / ${maxPlayers}` : String(entries.length);

  function handleAdd(player: TournamentPlayer): boolean {
    if (atLimit) {
      setLimitHit(true);
      return false;
    }
    onAdd(player);
    return true;
  }

  function handleRemove(id: number) {
    setLimitHit(false);
    onRemove(id);
  }

  function handleAddPlaceholder() {
    if (!placeholderName.trim()) return;
    if (atLimit) {
      setLimitHit(true);
      return;
    }
    onAddPlaceholder(placeholderName.trim());
    setPlaceholderName('');
  }

  const placeholderForm = (
    <div className="flex gap-2">
      <div className="flex-1">
        <Input
          type="text"
          value={placeholderName}
          onChange={e => setPlaceholderName(e.target.value)}
          placeholder="Placeholder, np. Anna Kowalska"
          aria-label="Imię i nazwisko placeholdera"
          onKeyDown={e => e.key === 'Enter' && handleAddPlaceholder()}
        />
      </div>
      <Button variant="secondary" disabled={!placeholderName.trim()} onClick={handleAddPlaceholder}>
        Dodaj
      </Button>
    </div>
  );

  function renderPicker(layout: 'inline' | 'compact') {
    return (
      <DualListPicker
        layout={layout}
        fillViewport={layout === 'inline'}
        autoFocus={layout === 'compact'}
        available={available}
        selected={entries}
        getKey={p => p.id}
        getLabel={displayName}
        renderItem={p => <PlayerLabel player={p} />}
        onAdd={handleAdd}
        onRemove={p => handleRemove(p.id)}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Szukaj gracza lub bota…"
        availableTitle="Dostępni"
        selectedTitle={`W turnieju (${countLabel})`}
        toolbar={
          <>
            <SegmentedControl
              fullWidth
              aria-label="Typ gracza"
              value={mode}
              onChange={setMode}
              options={MODE_OPTIONS}
            />
            {mode === 'cpu' && (
              <div className="flex items-center gap-2">
                <div role="group" aria-label="Filtruj boty po klasie" className="flex flex-1 flex-wrap gap-2">
                  {SKILL_TIERS.map(tier => {
                    const count = tierCounts.get(tier.level) ?? 0;
                    return (
                      <OptionButton
                        key={tier.level}
                        selected={tierFilter.has(tier.level)}
                        onClick={() => toggleTier(tier.level)}
                        aria-label={`${tier.label}: ${count}`}
                        title={`${tier.label} (od śr. ${tier.min})`}
                        className="gap-1.5 px-2 py-1"
                      >
                        <img src={tier.icon} alt="" draggable={false} className="h-8 w-8 select-none" />
                        <span className="font-display tabular-nums">{count}</span>
                      </OptionButton>
                    );
                  })}
                </div>
                {tierFilter.size > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setTierFilter(new Set())}>
                    Wszystkie
                  </Button>
                )}
              </div>
            )}
            {mode === 'cpu' && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={randomInput}
                    onChange={e => { setRandomInput(e.target.value); setRandomInfo(null); }}
                    onKeyDown={e => e.key === 'Enter' && handleRandom()}
                    placeholder={freeSlots != null ? String(freeSlots) : 'Ile?'}
                    aria-label="Ile botów wylosować"
                    className="max-w-20"
                  />
                  <Button variant="secondary" disabled={!canRandom} onClick={handleRandom}>
                    Losuj z listy
                  </Button>
                </div>
                <p role="status" className="text-xs text-content-secondary empty:hidden">{randomInfo}</p>
              </div>
            )}
          </>
        }
        notice={notice}
        emptySelected="Brak graczy. Dodaj co najmniej dwóch."
        selectedFooter={layout === 'inline' ? placeholderForm : undefined}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Group size — only for groups format */}
      {format === 'groups' && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-widest text-content-secondary">Rozmiar grupy</p>
          <div className="flex flex-wrap gap-2">
            {GROUP_SIZE_OPTIONS.map(n => (
              <OptionButton key={n} selected={groupSize === n} onClick={() => onGroupSizeChange(n)}>
                {n} graczy
              </OptionButton>
            ))}
          </div>
        </div>
      )}

      <Field
        label="Maksymalna liczba graczy"
        hint={maxPlayers != null ? `${entries.length} / ${maxPlayers} graczy` : 'Bez limitu'}
        error={overLimit ? `Wybrano ${entries.length} graczy — usuń ${entries.length - (maxPlayers ?? 0)}, aby zmieścić się w limicie.` : undefined}
      >
        <Input
          type="number"
          inputMode="numeric"
          min={2}
          value={maxPlayersInput}
          onChange={e => { onMaxPlayersInputChange(e.target.value); setLimitHit(false); }}
          placeholder="Bez limitu"
          invalid={overLimit}
          className="max-w-32"
        />
      </Field>

      {isDesktop ? renderPicker('inline') : (
        <>
          {/* Registered players + bots */}
          <Card padding="sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-content-secondary">
                Zarejestrowani i boty
              </p>
              <Button variant="secondary" size="sm" onClick={() => setPickerOpen(true)}>
                Wybierz graczy
              </Button>
            </div>
            {registeredCount > 0 && (
              <p className="mt-2 text-xs text-content-faint">
                Wybrano: {registeredCount} {plural(registeredCount, 'gracz', 'gracze', 'graczy')}
              </p>
            )}
          </Card>

          {/* Placeholder add */}
          <Card padding="sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-content-secondary">
              Dodaj placeholder
            </p>
            {placeholderForm}
            {notice && !pickerOpen && (
              <p role="status" className="mt-2 text-xs text-score-down-text">{notice}</p>
            )}
          </Card>

          {/* All entries list */}
          {entries.length === 0 ? (
            <p className="py-6 text-center text-sm text-content-secondary">
              Brak graczy. Dodaj co najmniej dwóch.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {entries.map(entry => (
                <Card
                  key={entry.id}
                  padding="none"
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <PlayerLabel player={entry} />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(entry.id)}
                    className="rounded p-1 text-content-secondary transition-colors hover:text-score-down-text"
                    aria-label={`Usuń: ${displayName(entry)}`}
                  >×</button>
                </Card>
              ))}
            </div>
          )}

          {pickerOpen && (
            <Modal
              size="xl"
              title="Wybierz graczy"
              onClose={() => setPickerOpen(false)}
              footer={
                <Button variant="primary" onClick={() => setPickerOpen(false)}>
                  Gotowe
                </Button>
              }
            >
              {renderPicker('compact')}
            </Modal>
          )}
        </>
      )}
    </div>
  );
}
