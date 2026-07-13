import { useRef, useState } from 'react';
import { useBlocker, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LiveMatchScreen } from '../components/match/LiveMatchScreen';
import { avgToSigma, botLevel } from '../utils/dart501';
import { SET_MIN, SET_MAX, LEG_MIN, LEG_MAX, roundToNearestOdd, roundToNearestMultipleOf3 } from '../types/tournament';
import type { BracketMatch, LegRecord, LegRound } from '../types/bracket';
import type { MatchFormat } from '../types/tournament';
import { useAddTrainingSession } from '../hooks/useTraining';
import { useCreatePendingResult } from '../hooks/usePendingResults';
import { computeMatchStats } from '../utils/statistics';
import { usePlayers } from '../hooks/usePlayers';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Tag } from '../components/ui/Tag';
import Modal from '../components/ui/Modal';
import { Toggle } from '../components/ui/Toggle';
import { SelectableCard } from '../components/ui/SelectableCard';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { BestOfField } from '../components/tournament/BestOfField';
import { PlayerSearchSelect } from '../components/league/PlayerSearchSelect';
import type { Player } from '../types/player';

type ActiveMode = 'vs-cpu' | 'vs-guest' | null;

// 'checkouts' and 'bob27' are routed to their own pages (/solo/checkouts, /solo/bob27)
// instead of being handled as in-page modes, so a browser refresh mid-game keeps
// the player on the game screen instead of bouncing back to mode selection.
const ROUTED_MODES = new Set(['checkouts', 'bob27', '501-solo', 'highscore', 'sector']);

interface SoloConfig {
  difficulty?:     { label: string; sigma: number };
  guestName?:      string;
  guestPlayerId?:  number;
  matchFormat:     MatchFormat;
}

// ── Session persistence ───────────────────────────────────────────────────────

const SOLO_SESSION_KEY = 'dart:solo-session';

type SoloSession = {
  activeMode:    'vs-cpu' | 'vs-guest';
  soloConfig:    SoloConfig;
  completedLegs: LegRecord[];
  currentLeg:    { rounds: LegRound[]; activePlayer: 0 | 1 } | null;
};

function loadSession(): SoloSession | null {
  try {
    const raw = localStorage.getItem(SOLO_SESSION_KEY);
    return raw ? (JSON.parse(raw) as SoloSession) : null;
  } catch {
    return null;
  }
}

function saveSession(s: SoloSession): void {
  try { localStorage.setItem(SOLO_SESSION_KEY, JSON.stringify(s)); } catch {}
}

function clearSession(): void {
  localStorage.removeItem(SOLO_SESSION_KEY);
}

// ── Mode catalogue ────────────────────────────────────────────────────────────

const MODES = [
  {
    id: 'vs-cpu' as const,
    title: '501 vs CPU',
    description: 'Zagraj mecz 501 przeciwko botowi.',
    available: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7">
        <rect x="2" y="6" width="20" height="12" rx="3" />
        <circle cx="8"  cy="12" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="16" cy="12" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: 'vs-guest' as const,
    title: 'vs Gość',
    description: 'Zagraj mecz z drugim graczem przy tym samym urządzeniu.',
    available: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7">
        <circle cx="8"  cy="8"  r="3" />
        <circle cx="16" cy="8"  r="3" />
        <path d="M2 20c0-3.314 2.686-6 6-6s6 2.686 6 6" />
        <path d="M12 20c0-3.314 2.686-6 6-6s6 2.686 6 6" />
      </svg>
    ),
  },
  {
    id: '501-solo' as const,
    title: '501 Solo',
    description: 'Trenuj 501 samodzielnie, bez przeciwnika.',
    available: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: 'highscore' as const,
    title: 'Highscore',
    description: 'Zdobądź jak największy wynik z wybranej liczby lotek.',
    available: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7">
        <polyline points="3 17 9 11 13 15 21 7" />
        <polyline points="17 7 21 7 21 11" />
      </svg>
    ),
  },
  {
    id: 'checkouts' as const,
    title: 'Checkouts',
    description: 'Ćwicz zamknięcia — wspinaj się po wartościach od D20 wzwyż.',
    available: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  {
    id: 'bob27' as const,
    title: "Bob's 27",
    description: 'Rzucaj zegar pól podwójnych od D1 do D20 i Bulla, zaczynając od 27 punktów.',
    available: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </svg>
    ),
  },
  {
    id: 'sector' as const,
    title: 'Jeden sektor',
    description: 'Celuj cały czas w ten sam sektor — śledź % trafień i score.',
    available: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      </svg>
    ),
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export function SoloPage() {
  const [activeMode,    setActiveMode]    = useState<ActiveMode>(null);
  const [soloConfig,    setSoloConfig]    = useState<SoloConfig | null>(null);
  const [savedSession,  setSavedSession]  = useState<SoloSession | null>(() => loadSession());

  const navigate             = useNavigate();
  const { username }        = useAuth();
  const completedLegsRef    = useRef<LegRecord[]>([]);
  const currentLegRef       = useRef<{ rounds: LegRound[]; activePlayer: 0 | 1 } | null>(null);
  const addTrainingSession  = useAddTrainingSession();
  const createPendingResult = useCreatePendingResult();

  // Block router navigation while a 501 game is active in the UI
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      soloConfig !== null && currentLocation.pathname !== nextLocation.pathname
  );

  // Mode card click: routed games get their own URL (so a refresh mid-game stays
  // put), in-page modes just switch local state as before.
  function openMode(id: string) {
    if (ROUTED_MODES.has(id)) {
      navigate(`/solo/${id}`);
    } else {
      setActiveMode(id as ActiveMode);
    }
  }

  // Called when the user confirms game setup and the match begins
  function startSession(config: SoloConfig) {
    completedLegsRef.current = [];
    currentLegRef.current    = null;
    const mode = activeMode as 'vs-cpu' | 'vs-guest';
    saveSession({ activeMode: mode, soloConfig: config, completedLegs: [], currentLeg: null });
    setSoloConfig(config);
  }

  // Resume a previously saved session
  function resumeSession() {
    if (!savedSession) return;
    completedLegsRef.current = savedSession.completedLegs;
    currentLegRef.current    = savedSession.currentLeg;
    setSavedSession(null);
    setSoloConfig(savedSession.soloConfig);
    setActiveMode(savedSession.activeMode);
  }

  // Discard saved session (user explicitly chooses not to resume)
  function dismissSession() {
    clearSession();
    setSavedSession(null);
  }

  // Exit game without clearing localStorage so the session survives for resume
  function handleBack() {
    setSoloConfig(null);
    setActiveMode(null);
    completedLegsRef.current = [];
    currentLegRef.current    = null;
    setSavedSession(loadSession()); // refresh banner
  }

  function handleLegComplete(legs: LegRecord[], _rounds: LegRound[], _active: 0 | 1) {
    completedLegsRef.current = legs;
    currentLegRef.current    = null;
    if (soloConfig && (activeMode === 'vs-cpu' || activeMode === 'vs-guest')) {
      saveSession({ activeMode, soloConfig, completedLegs: legs, currentLeg: null });
    }
  }

  function handleScoreEntered(rounds: LegRound[], activePlayer: 0 | 1) {
    currentLegRef.current = { rounds, activePlayer };
    if (soloConfig && (activeMode === 'vs-cpu' || activeMode === 'vs-guest')) {
      saveSession({ activeMode, soloConfig, completedLegs: completedLegsRef.current, currentLeg: { rounds, activePlayer } });
    }
  }

  // Fires automatically the instant the match is won (see useMatchEngine's
  // auto-save effect) — must not exit, since the summary screen is still
  // showing; leaving is the "Zamknij" button's job (onClose → handleBack).
  function handleSoloResult() {
    const legs    = completedLegsRef.current;
    const today   = new Date().toISOString().slice(0, 10);
    if (legs.length > 0) {
      const guestName = soloConfig?.guestName?.trim() || 'Gość';
      const [playerStats, guestStats] = computeMatchStats('solo', legs, ['Ty', guestName]);

      if (playerStats.match_average > 0) {
        addTrainingSession.mutate({
          played_at:       today,
          average:         Math.round(playerStats.match_average * 100) / 100,
          legs:            legs.length,
          double_attempts: playerStats.double_attempts,
          double_hits:     playerStats.double_hits,
        });
      }

      if (soloConfig?.guestPlayerId && guestStats.match_average > 0) {
        const guestLegsWon  = legs.filter(l => l.winner === 'bottom').length;
        const guestLegsLost = legs.filter(l => l.winner === 'top').length;
        createPendingResult.mutate({
          for_player_id:   soloConfig.guestPlayerId,
          opponent_name:   username ?? 'Nieznany',
          played_at:       today,
          average:         Math.round(guestStats.match_average * 100) / 100,
          legs_won:        guestLegsWon,
          legs_lost:       guestLegsLost,
          double_attempts: guestStats.double_attempts,
          double_hits:     guestStats.double_hits,
        });
      }
    }
    clearSession();
    setSavedSession(null);
  }

  // ── Active 501 games ───────────────────────────────────────────────────────

  if (activeMode === 'vs-cpu' && soloConfig?.difficulty) {
    const match: BracketMatch = {
      id:         'solo-cpu',
      top:        { playerId: null, playerName: 'Ty',                        playerAvg: null, isCpu: false },
      bottom:     { playerId: null, playerName: soloConfig.difficulty.label, playerAvg: null, isCpu: true, cpuSigma: soloConfig.difficulty.sigma },
      legs:       completedLegsRef.current.length > 0 ? completedLegsRef.current : undefined,
      currentLeg: currentLegRef.current ?? undefined,
    };
    return (
      <>
        <LiveMatchScreen
          match={match}
          matchFormat={soloConfig.matchFormat}
          isOwner={true}
          onClose={handleBack}
          onLegComplete={handleLegComplete}
          onScoreEntered={handleScoreEntered}
          onResult={handleSoloResult}
        />
        <BlockerDialog blocker={blocker} />
      </>
    );
  }

  if (activeMode === 'vs-guest' && soloConfig) {
    const guestName = soloConfig.guestName?.trim() || 'Gość';
    const match: BracketMatch = {
      id:         'solo-guest',
      top:        { playerId: null, playerName: 'Ty',      playerAvg: null, isCpu: false },
      bottom:     { playerId: null, playerName: guestName, playerAvg: null, isCpu: false },
      legs:       completedLegsRef.current.length > 0 ? completedLegsRef.current : undefined,
      currentLeg: currentLegRef.current ?? undefined,
    };
    return (
      <>
        <LiveMatchScreen
          match={match}
          matchFormat={soloConfig.matchFormat}
          isOwner={true}
          onClose={handleBack}
          onLegComplete={handleLegComplete}
          onScoreEntered={handleScoreEntered}
          onResult={handleSoloResult}
        />
        <BlockerDialog blocker={blocker} />
      </>
    );
  }

  // ── Setup screens ──────────────────────────────────────────────────────────

  if (activeMode === 'vs-cpu') {
    return <VsCpuSetup onStart={startSession} onBack={handleBack} />;
  }

  if (activeMode === 'vs-guest') {
    return <VsGuestSetup onStart={startSession} onBack={handleBack} />;
  }

  // ── Mode selection ─────────────────────────────────────────────────────────

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">
      <h1 className="mb-6 text-lg font-semibold text-content-primary">Tryb solo</h1>

      {savedSession && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-border-subtle border-l-4 border-l-border-accent bg-surface-overlay px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-content-primary">Wznów poprzednią grę</p>
            <p className="mt-0.5 truncate text-xs text-content-secondary">
              {savedSession.activeMode === 'vs-cpu' ? '501 vs CPU' : 'vs Gość'}
              {savedSession.completedLegs.length > 0 && (
                <> · {savedSession.completedLegs.length} {savedSession.completedLegs.length === 1 ? 'leg' : 'legi'} ukończone</>
              )}
              {savedSession.currentLeg && savedSession.currentLeg.rounds.length > 0 && (
                <> · leg w toku</>
              )}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="ghost" size="sm" onClick={dismissSession}>Porzuć</Button>
            <Button variant="primary" size="sm" onClick={resumeSession}>Wznów</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {MODES.map((mode) => (
          <SelectableCard
            key={mode.id}
            layout="stack"
            disabled={!mode.available}
            onClick={mode.available ? () => openMode(mode.id) : undefined}
            icon={mode.icon}
            title={mode.title}
            description={mode.description}
            footer={!mode.available ? <Badge variant="neutral">Wkrótce</Badge> : undefined}
          />
        ))}
      </div>
    </div>
  );
}

// ── Blocker dialog ────────────────────────────────────────────────────────────

function BlockerDialog({ blocker }: { blocker: ReturnType<typeof useBlocker> }) {
  return (
    <Modal
      open={blocker.state === 'blocked'}
      onClose={() => blocker.reset?.()}
      size="sm"
      title="Opuścić grę?"
      description="Postęp jest zapisany — możesz wrócić do tej gry z menu Solo."
      footer={
        <>
          <Button variant="secondary" onClick={() => blocker.reset?.()}>Zostań</Button>
          <Button variant="primary" onClick={() => blocker.proceed?.()}>Opuść</Button>
        </>
      }
    />
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function FormatSection({
  setsInput, onSetsChange, onSetsBlur, legsInput, onLegsChange, onLegsBlur,
}: {
  setsInput: string; onSetsChange: (v: string) => void; onSetsBlur: () => void;
  legsInput: string; onLegsChange: (v: string) => void; onLegsBlur: () => void;
}) {
  return (
    <>
      <section className="mb-6">
        <BestOfField label="Sety (best of)" value={setsInput} min={SET_MIN} max={SET_MAX} onChange={onSetsChange} onBlur={onSetsBlur} />
      </section>

      <section className="mb-8">
        <BestOfField label="Legi (best of)" value={legsInput} min={LEG_MIN} max={LEG_MAX} onChange={onLegsChange} onBlur={onLegsBlur} />
      </section>
    </>
  );
}

function MaxDartsPerLegField({
  enabled, onEnabledChange, input, onInputChange, onBlur,
}: {
  enabled: boolean; onEnabledChange: (v: boolean) => void;
  input: string; onInputChange: (v: string) => void; onBlur: () => void;
}) {
  return (
    <section className="mb-8 flex flex-col gap-2 rounded-lg border border-border-subtle bg-surface-muted px-4 py-3">
      <label className="flex cursor-pointer items-center justify-between">
        <div>
          <p className="text-sm font-medium text-content-primary">Limit lotek na leg</p>
          <p className="text-xs text-content-secondary">
            Jeśli nikt nie zamknie lega w tym limicie — decyduje bull.
          </p>
        </div>
        <Toggle checked={enabled} onChange={onEnabledChange} />
      </label>

      {enabled && (
        <div className="flex flex-col gap-1.5">
          <Input
            type="number"
            min={3}
            step={3}
            value={input}
            onChange={e => onInputChange(e.target.value)}
            onBlur={onBlur}
            className="max-w-32"
          />
          <p className="text-xs text-content-faint">
            Zaokrąglane do najbliższej wielokrotności 3 (jedna kolejka = 3 lotki).
          </p>
        </div>
      )}
    </section>
  );
}

// ── Setup screens ─────────────────────────────────────────────────────────────

function VsCpuSetup({
  onStart, onBack,
}: {
  onStart: (cfg: SoloConfig) => void;
  onBack:  () => void;
}) {
  const [avgStr,   setAvgStr]   = useState('45');
  const [setsInput, setSetsInput] = useState(String(SET_MIN));
  const [legsInput, setLegsInput] = useState('3');
  const [maxDartsEnabled, setMaxDartsEnabled] = useState(false);
  const [maxDartsInput,   setMaxDartsInput]   = useState('21');
  const avg  = Number(avgStr);
  const sets = roundToNearestOdd(Number(setsInput), SET_MIN, SET_MAX);
  const legs = roundToNearestOdd(Number(legsInput), LEG_MIN, LEG_MAX);
  const resolvedMaxDartsPerLeg = maxDartsEnabled ? roundToNearestMultipleOf3(Number(maxDartsInput)) : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">
      <Button variant="ghost" size="md" onClick={onBack} className="mb-6">
        ← Wróć
      </Button>

      <h2 className="mb-8 text-lg font-semibold text-content-primary">501 vs CPU</h2>

      <section className="mb-6">
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-xs font-medium uppercase tracking-widest text-content-secondary">Poziom bota</p>
          <span className="text-sm font-semibold text-content-primary">
            {botLevel(avg)}
            <span className="ml-1.5 text-xs font-normal text-content-secondary">śr. {avg}</span>
          </span>
        </div>
        <input
          type="range"
          min="10"
          max="110"
          step="1"
          value={avgStr}
          onChange={e => setAvgStr(e.target.value)}
          className="w-full cursor-pointer accent-content-accent"
        />
        <div className="mt-1 flex justify-between text-xs text-content-faint">
          <span>Rekreacyjny</span>
          <span>Średni</span>
          <span>Pro</span>
        </div>
      </section>

      <FormatSection
        setsInput={setsInput} onSetsChange={setSetsInput} onSetsBlur={() => setSetsInput(String(sets))}
        legsInput={legsInput} onLegsChange={setLegsInput} onLegsBlur={() => setLegsInput(String(legs))}
      />

      <MaxDartsPerLegField
        enabled={maxDartsEnabled} onEnabledChange={setMaxDartsEnabled}
        input={maxDartsInput} onInputChange={setMaxDartsInput}
        onBlur={() => setMaxDartsInput(String(roundToNearestMultipleOf3(Number(maxDartsInput))))}
      />

      <Button
        variant="primary"
        size="lg"
        fullWidth
        onClick={() => onStart({
          difficulty:  { label: botLevel(avg), sigma: avgToSigma(avg) },
          matchFormat: { sets, legs, ...(resolvedMaxDartsPerLeg != null ? { max_darts_per_leg: resolvedMaxDartsPerLeg } : {}) },
        })}
      >
        Zagraj
      </Button>
    </div>
  );
}

type GuestMode = 'anonymous' | 'registered';

const GUEST_MODE_OPTIONS = [
  { value: 'anonymous'  as GuestMode, label: 'Gość' },
  { value: 'registered' as GuestMode, label: 'Zarejestrowany' },
];

function VsGuestSetup({
  onStart, onBack,
}: {
  onStart: (cfg: SoloConfig) => void;
  onBack:  () => void;
}) {
  const [guestMode,       setGuestMode]       = useState<GuestMode>('anonymous');
  const [guestName,       setGuestName]       = useState('');
  const [selectedPlayer,  setSelectedPlayer]  = useState<Player | null>(null);
  const [setsInput, setSetsInput] = useState(String(SET_MIN));
  const [legsInput, setLegsInput] = useState('3');
  const [maxDartsEnabled, setMaxDartsEnabled] = useState(false);
  const [maxDartsInput,   setMaxDartsInput]   = useState('21');

  const { data: playersData } = usePlayers();
  const allPlayers = playersData ?? [];

  const sets = roundToNearestOdd(Number(setsInput), SET_MIN, SET_MAX);
  const legs = roundToNearestOdd(Number(legsInput), LEG_MIN, LEG_MAX);
  const resolvedMaxDartsPerLeg = maxDartsEnabled ? roundToNearestMultipleOf3(Number(maxDartsInput)) : null;
  const matchFormat: MatchFormat = { sets, legs, ...(resolvedMaxDartsPerLeg != null ? { max_darts_per_leg: resolvedMaxDartsPerLeg } : {}) };

  function handleStart() {
    if (guestMode === 'registered' && selectedPlayer) {
      onStart({
        guestName:     `${selectedPlayer.first_name} ${selectedPlayer.last_name}`,
        guestPlayerId: selectedPlayer.id,
        matchFormat,
      });
    } else {
      onStart({ guestName, matchFormat });
    }
  }

  const canStart = guestMode === 'registered' ? !!selectedPlayer : true;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">
      <Button variant="ghost" size="md" onClick={onBack} className="mb-6">
        ← Wróć
      </Button>

      <h2 className="mb-8 text-lg font-semibold text-content-primary">vs Gość</h2>

      <section className="mb-6">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-content-secondary">
          Typ gościa
        </p>
        <SegmentedControl
          fullWidth
          aria-label="Typ gościa"
          value={guestMode}
          onChange={(m) => { setGuestMode(m); setSelectedPlayer(null); setGuestName(''); }}
          options={GUEST_MODE_OPTIONS}
        />
      </section>

      {guestMode === 'anonymous' ? (
        <section className="mb-6">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-content-secondary">
            Imię gościa
          </p>
          <Input
            type="text"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="Gość"
            maxLength={30}
          />
        </section>
      ) : (
        <section className="mb-6">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-content-secondary">
            Wybierz gracza
          </p>
          {selectedPlayer ? (
            <div className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface-overlay px-4 py-3">
              <div className="flex items-center gap-2">
                <Tag>{selectedPlayer.first_name} {selectedPlayer.last_name}</Tag>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPlayer(null)}
                className="text-content-faint transition-colors hover:text-content-primary"
                aria-label="Zmień gracza"
              >
                ✕
              </button>
            </div>
          ) : (
            <PlayerSearchSelect
              players={allPlayers.filter(p => !p.cpu)}
              excludeIds={new Set()}
              placeholder="Szukaj gracza…"
              onSelect={setSelectedPlayer}
            />
          )}
        </section>
      )}

      <FormatSection
        setsInput={setsInput} onSetsChange={setSetsInput} onSetsBlur={() => setSetsInput(String(sets))}
        legsInput={legsInput} onLegsChange={setLegsInput} onLegsBlur={() => setLegsInput(String(legs))}
      />

      <MaxDartsPerLegField
        enabled={maxDartsEnabled} onEnabledChange={setMaxDartsEnabled}
        input={maxDartsInput} onInputChange={setMaxDartsInput}
        onBlur={() => setMaxDartsInput(String(roundToNearestMultipleOf3(Number(maxDartsInput))))}
      />

      <Button
        variant="primary"
        size="lg"
        fullWidth
        disabled={!canStart}
        onClick={handleStart}
      >
        Zagraj
      </Button>
    </div>
  );
}
