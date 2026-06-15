import { useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { LiveMatchScreen } from '../components/bracket/LiveMatchScreen';
import { CheckoutsGame } from '../components/solo/CheckoutsGame';
import { SKILL_LEVELS, type SkillLevel } from '../utils/dart501';
import { SET_OPTIONS, LEG_OPTIONS } from '../types/tournament';
import type { BracketMatch, LegRecord, LegRound } from '../types/bracket';
import type { MatchFormat } from '../types/tournament';
import { useAddTrainingSession } from '../hooks/useTraining';
import { computeMatchStats } from '../utils/statistics';

type ActiveMode    = 'vs-cpu' | 'vs-guest' | 'checkouts' | null;
type CheckoutsMode = 'easy' | 'hard';

interface SoloConfig {
  difficulty?: SkillLevel;
  guestName?:  string;
  matchFormat: MatchFormat;
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
    id: '501-solo',
    title: '501 Solo',
    description: 'Trenuj 501 samodzielnie, bez przeciwnika.',
    available: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: 'highscore',
    title: 'Highscore',
    description: 'Zdobądź jak największy wynik w jednym rzucie.',
    available: false,
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
];

// ── Page ──────────────────────────────────────────────────────────────────────

export function SoloPage() {
  const [activeMode,    setActiveMode]    = useState<ActiveMode>(null);
  const [soloConfig,    setSoloConfig]    = useState<SoloConfig | null>(null);
  const [checkoutsMode, setCheckoutsMode] = useState<CheckoutsMode | null>(null);
  const [savedSession,  setSavedSession]  = useState<SoloSession | null>(() => loadSession());

  const completedLegsRef   = useRef<LegRecord[]>([]);
  const currentLegRef      = useRef<{ rounds: LegRound[]; activePlayer: 0 | 1 } | null>(null);
  const addTrainingSession = useAddTrainingSession();

  // Block router navigation while a 501 game is active in the UI
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      soloConfig !== null && currentLocation.pathname !== nextLocation.pathname
  );

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
    setCheckoutsMode(null);
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

  function handleSoloResult() {
    const legs = completedLegsRef.current;
    if (legs.length > 0) {
      const [playerStats] = computeMatchStats('solo', legs, ['Ty', 'Przeciwnik']);
      if (playerStats.match_average > 0) {
        addTrainingSession.mutate({
          played_at:       new Date().toISOString().slice(0, 10),
          average:         Math.round(playerStats.match_average * 100) / 100,
          legs:            legs.length,
          double_attempts: playerStats.double_attempts,
          double_hits:     playerStats.double_hits,
        });
      }
    }
    clearSession();
    setSavedSession(null);
    handleBack();
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

  if (activeMode === 'checkouts' && checkoutsMode) {
    return <CheckoutsGame mode={checkoutsMode} onBack={handleBack} />;
  }

  if (activeMode === 'checkouts') {
    return <CheckoutsSetup onStart={setCheckoutsMode} onBack={handleBack} />;
  }

  // ── Mode selection ─────────────────────────────────────────────────────────

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8">
      <h1 className="mb-6 text-lg font-semibold text-brand-white">Tryb solo</h1>

      {savedSession && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-brand-purple/30 bg-brand-purple/5 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-brand-white">Wznów poprzednią grę</p>
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
            <button
              type="button"
              onClick={dismissSession}
              className="rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-medium text-content-secondary transition-colors hover:text-brand-white"
            >
              Porzuć
            </button>
            <button
              type="button"
              onClick={resumeSession}
              className="rounded-lg bg-brand-purple px-3 py-1.5 text-xs font-semibold text-brand-white transition-colors hover:bg-brand-purple/80"
            >
              Wznów
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            disabled={!mode.available}
            onClick={mode.available ? () => setActiveMode(mode.id as ActiveMode) : undefined}
            className="flex flex-col gap-4 rounded-xl border border-border-subtle bg-brand-black px-5 py-5 text-left transition-colors hover:border-brand-purple/50 hover:bg-brand-purple/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="text-brand-purple">{mode.icon}</span>
            <div>
              <p className="text-sm font-semibold text-brand-white">{mode.title}</p>
              <p className="mt-1 text-xs text-content-secondary">{mode.description}</p>
            </div>
            {!mode.available && (
              <span className="mt-auto self-start rounded-full border border-border-subtle px-3 py-0.5 text-xs text-content-secondary">
                Wkrótce
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Blocker dialog ────────────────────────────────────────────────────────────

function BlockerDialog({ blocker }: { blocker: ReturnType<typeof useBlocker> }) {
  if (blocker.state !== 'blocked') return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 px-6">
      <div className="w-full max-w-xs rounded-2xl border border-border-subtle bg-brand-black p-6">
        <p className="text-base font-semibold text-brand-white">Opuścić grę?</p>
        <p className="mt-2 text-sm leading-relaxed text-content-secondary">
          Postęp jest zapisany — możesz wrócić do tej gry z menu Solo.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => blocker.reset?.()}
            className="flex-1 rounded-xl border border-border-subtle py-3 text-sm font-medium text-content-secondary transition-colors hover:text-brand-white"
          >
            Zostań
          </button>
          <button
            type="button"
            onClick={() => blocker.proceed?.()}
            className="flex-1 rounded-xl bg-brand-purple py-3 text-sm font-semibold text-brand-white transition-colors hover:bg-brand-purple/80"
          >
            Opuść
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function OptionBtn({
  active, onClick, children,
}: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-lg border px-4 py-2 text-sm font-medium transition-colors duration-150',
        active
          ? 'border-brand-purple bg-brand-purple text-brand-white'
          : 'border-border-subtle bg-brand-black text-content-secondary hover:border-brand-purple/50 hover:text-brand-white',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function FormatSection({
  sets, onSets, legs, onLegs,
}: {
  sets: number; onSets: (n: number) => void;
  legs: number; onLegs: (n: number) => void;
}) {
  return (
    <>
      <section className="mb-6">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-content-secondary">
          Sety (best of)
        </p>
        <div className="flex flex-wrap gap-2">
          {SET_OPTIONS.map((n) => (
            <OptionBtn key={n} active={sets === n} onClick={() => onSets(n)}>{n}</OptionBtn>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-content-secondary">
          Legi (best of)
        </p>
        <div className="flex flex-wrap gap-2">
          {LEG_OPTIONS.map((n) => (
            <OptionBtn key={n} active={legs === n} onClick={() => onLegs(n)}>{n}</OptionBtn>
          ))}
        </div>
      </section>
    </>
  );
}

// ── Setup screens ─────────────────────────────────────────────────────────────

function CheckoutsSetup({
  onStart, onBack,
}: {
  onStart: (mode: CheckoutsMode) => void;
  onBack:  () => void;
}) {
  const [mode, setMode] = useState<CheckoutsMode>('easy');

  return (
    <div className="mx-auto w-full max-w-sm px-6 py-8">
      <button type="button" onClick={onBack} className="mb-6 text-sm text-content-secondary transition-colors hover:text-brand-white">
        ← Wróć
      </button>

      <h2 className="mb-2 text-lg font-semibold text-brand-white">Checkouts</h2>
      <p className="mb-8 text-xs text-content-secondary leading-relaxed">
        Zacznij od D20 (40). Zamknięcie w 3 lotkach → +10 pkt. Brak → −1 pkt (min. 40).
      </p>

      <section className="mb-8">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-content-secondary">
          Tryb
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setMode('easy')}
            className={[
              'flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors duration-150',
              mode === 'easy'
                ? 'border-brand-purple bg-brand-purple/10'
                : 'border-border-subtle bg-brand-black hover:border-brand-purple/50',
            ].join(' ')}
          >
            <span className="text-sm font-semibold text-brand-white">Easy</span>
            <span className="ml-auto text-xs text-content-secondary">Gra trwa bez limitu</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('hard')}
            className={[
              'flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors duration-150',
              mode === 'hard'
                ? 'border-red-500/60 bg-red-950/20'
                : 'border-border-subtle bg-brand-black hover:border-red-500/30',
            ].join(' ')}
          >
            <span className="text-sm font-semibold text-brand-white">Hard</span>
            <span className="ml-auto text-xs text-content-secondary">Koniec przy braku na 40</span>
          </button>
        </div>
      </section>

      <button
        type="button"
        onClick={() => onStart(mode)}
        className="w-full rounded-xl bg-brand-purple px-6 py-4 text-sm font-semibold text-brand-white transition-colors hover:bg-brand-purple-500"
      >
        Zagraj
      </button>
    </div>
  );
}

function VsCpuSetup({
  onStart, onBack,
}: {
  onStart: (cfg: SoloConfig) => void;
  onBack:  () => void;
}) {
  const [difficulty, setDifficulty] = useState<SkillLevel>(SKILL_LEVELS[3]);
  const [sets,       setSets]       = useState<number>(SET_OPTIONS[0]);
  const [legs,       setLegs]       = useState<number>(LEG_OPTIONS[0]);

  return (
    <div className="mx-auto w-full max-w-sm px-6 py-8">
      <button type="button" onClick={onBack} className="mb-6 text-sm text-content-secondary transition-colors hover:text-brand-white">
        ← Wróć
      </button>

      <h2 className="mb-8 text-lg font-semibold text-brand-white">501 vs CPU</h2>

      <section className="mb-6">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-content-secondary">
          Poziom bota
        </p>
        <div className="flex flex-col gap-2">
          {SKILL_LEVELS.map((level) => (
            <button
              key={level.id}
              type="button"
              onClick={() => setDifficulty(level)}
              className={[
                'flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors duration-150',
                difficulty.id === level.id
                  ? 'border-brand-purple bg-brand-purple/10 text-brand-white'
                  : 'border-border-subtle bg-brand-black text-content-secondary hover:border-brand-purple/50 hover:text-brand-white',
              ].join(' ')}
            >
              <span className="text-sm font-semibold">{level.label}</span>
              <span className="text-xs text-content-secondary">σ = {level.sigma} mm</span>
            </button>
          ))}
        </div>
      </section>

      <FormatSection sets={sets} onSets={setSets} legs={legs} onLegs={setLegs} />

      <button
        type="button"
        onClick={() => onStart({ difficulty, matchFormat: { sets, legs } })}
        className="w-full rounded-xl bg-brand-purple px-6 py-4 text-sm font-semibold text-brand-white transition-colors hover:bg-brand-purple-500"
      >
        Zagraj
      </button>
    </div>
  );
}

function VsGuestSetup({
  onStart, onBack,
}: {
  onStart: (cfg: SoloConfig) => void;
  onBack:  () => void;
}) {
  const [guestName, setGuestName] = useState('');
  const [sets,      setSets]      = useState<number>(SET_OPTIONS[0]);
  const [legs,      setLegs]      = useState<number>(LEG_OPTIONS[0]);

  return (
    <div className="mx-auto w-full max-w-sm px-6 py-8">
      <button type="button" onClick={onBack} className="mb-6 text-sm text-content-secondary transition-colors hover:text-brand-white">
        ← Wróć
      </button>

      <h2 className="mb-8 text-lg font-semibold text-brand-white">vs Gość</h2>

      <section className="mb-6">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-content-secondary">
          Imię gościa
        </p>
        <input
          type="text"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          placeholder="Gość"
          maxLength={30}
          className="w-full rounded-lg border border-border-subtle bg-white/5 px-4 py-3 text-sm text-brand-white placeholder:text-content-secondary/50 outline-none focus:border-brand-purple/60 transition-colors"
        />
      </section>

      <FormatSection sets={sets} onSets={setSets} legs={legs} onLegs={setLegs} />

      <button
        type="button"
        onClick={() => onStart({ guestName, matchFormat: { sets, legs } })}
        className="w-full rounded-xl bg-brand-purple px-6 py-4 text-sm font-semibold text-brand-white transition-colors hover:bg-brand-purple-500"
      >
        Zagraj
      </button>
    </div>
  );
}
