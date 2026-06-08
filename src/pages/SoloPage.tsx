import { useState } from 'react';
import { LiveMatchScreen } from '../components/bracket/LiveMatchScreen';
import { SKILL_LEVELS, type SkillLevel } from '../utils/dart501';
import { SET_OPTIONS, LEG_OPTIONS } from '../types/tournament';
import type { BracketMatch } from '../types/bracket';
import type { MatchFormat } from '../types/tournament';

type ActiveMode = 'vs-cpu' | 'vs-guest' | null;

interface SoloConfig {
  difficulty?: SkillLevel;
  guestName?:  string;
  matchFormat: MatchFormat;
}

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
    id: 'checkouts',
    title: 'Checkouts',
    description: 'Ćwicz zamknięcia — losowe wyjścia na czas.',
    available: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
];

export function SoloPage() {
  const [activeMode, setActiveMode] = useState<ActiveMode>(null);
  const [soloConfig, setSoloConfig] = useState<SoloConfig | null>(null);

  function handleBack() {
    setSoloConfig(null);
    setActiveMode(null);
  }

  // ── Active game ──────────────────────────────────────────────────
  if (activeMode === 'vs-cpu' && soloConfig?.difficulty) {
    const match: BracketMatch = {
      id: 'solo-cpu',
      top:    { playerId: null, playerName: 'Ty',                          playerAvg: null, isCpu: false },
      bottom: { playerId: null, playerName: soloConfig.difficulty.label,   playerAvg: null, isCpu: true, cpuSigma: soloConfig.difficulty.sigma },
    };
    return (
      <LiveMatchScreen
        match={match}
        matchFormat={soloConfig.matchFormat}
        isOwner={true}
        onClose={handleBack}
        onResult={handleBack}
      />
    );
  }

  if (activeMode === 'vs-guest' && soloConfig) {
    const guestName = soloConfig.guestName?.trim() || 'Gość';
    const match: BracketMatch = {
      id: 'solo-guest',
      top:    { playerId: null, playerName: 'Ty',       playerAvg: null, isCpu: false },
      bottom: { playerId: null, playerName: guestName,  playerAvg: null, isCpu: false },
    };
    return (
      <LiveMatchScreen
        match={match}
        matchFormat={soloConfig.matchFormat}
        isOwner={true}
        onClose={handleBack}
        onResult={handleBack}
      />
    );
  }

  // ── Game setup ───────────────────────────────────────────────────
  if (activeMode === 'vs-cpu') {
    return <VsCpuSetup onStart={setSoloConfig} onBack={handleBack} />;
  }

  if (activeMode === 'vs-guest') {
    return <VsGuestSetup onStart={setSoloConfig} onBack={handleBack} />;
  }

  // ── Mode selection ───────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8">
      <h1 className="mb-6 text-lg font-semibold text-brand-white">Tryb solo</h1>
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
