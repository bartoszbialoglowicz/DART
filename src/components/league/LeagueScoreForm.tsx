import { useState } from 'react';
import { Field } from '../ui/Field';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

export type LeagueScorePayload = {
  home_score:          number;
  away_score:          number;
  home_count_180:      number;
  away_count_180:      number;
  home_high_checkouts: number;
  away_high_checkouts: number;
  home_short_legs:     number;
  away_short_legs:     number;
};

type Props = {
  homeName:       string;
  awayName:       string;
  // home_score/away_score come from LeagueMatch, which allows null (no result yet).
  initial?:       Partial<Omit<LeagueScorePayload, 'home_score' | 'away_score'>>
                  & { home_score?: number | null; away_score?: number | null };
  onConfirm:      (payload: LeagueScorePayload) => void;
  onCancel:       () => void;
  confirmLabel?:  string;
  confirmLoading?: boolean;
};

export function LeagueScoreForm({
  homeName, awayName, initial, onConfirm, onCancel, confirmLabel = 'Potwierdź', confirmLoading,
}: Props) {
  const [homeScore, setHomeScore] = useState(initial?.home_score != null ? String(initial.home_score) : '');
  const [awayScore, setAwayScore] = useState(initial?.away_score != null ? String(initial.away_score) : '');
  const [home180,   setHome180]   = useState(String(initial?.home_count_180      ?? 0));
  const [away180,   setAway180]   = useState(String(initial?.away_count_180      ?? 0));
  const [homeHC,    setHomeHC]    = useState(String(initial?.home_high_checkouts ?? 0));
  const [awayHC,    setAwayHC]    = useState(String(initial?.away_high_checkouts ?? 0));
  const [homeSL,    setHomeSL]    = useState(String(initial?.home_short_legs     ?? 0));
  const [awaySL,    setAwaySL]    = useState(String(initial?.away_short_legs     ?? 0));

  const canConfirm = homeScore !== '' && awayScore !== ''
    && Number.isFinite(Number(homeScore)) && Number.isFinite(Number(awayScore));

  function handleConfirm() {
    if (!canConfirm) return;
    onConfirm({
      home_score:          Number(homeScore),
      away_score:          Number(awayScore),
      home_count_180:      Number(home180) || 0,
      away_count_180:      Number(away180) || 0,
      home_high_checkouts: Number(homeHC)  || 0,
      away_high_checkouts: Number(awayHC)  || 0,
      home_short_legs:     Number(homeSL)  || 0,
      away_short_legs:     Number(awaySL)  || 0,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <SideColumn
          name={homeName}
          score={homeScore} onScore={setHomeScore}
          count180={home180} onCount180={setHome180}
          highCheckouts={homeHC} onHighCheckouts={setHomeHC}
          shortLegs={homeSL} onShortLegs={setHomeSL}
        />
        <SideColumn
          name={awayName}
          score={awayScore} onScore={setAwayScore}
          count180={away180} onCount180={setAway180}
          highCheckouts={awayHC} onHighCheckouts={setAwayHC}
          shortLegs={awaySL} onShortLegs={setAwaySL}
        />
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" fullWidth onClick={onCancel}>Wróć</Button>
        <Button variant="primary" fullWidth disabled={!canConfirm} loading={confirmLoading} onClick={handleConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}

function SideColumn({
  name, score, onScore, count180, onCount180, highCheckouts, onHighCheckouts, shortLegs, onShortLegs,
}: {
  name: string;
  score: string; onScore: (v: string) => void;
  count180: string; onCount180: (v: string) => void;
  highCheckouts: string; onHighCheckouts: (v: string) => void;
  shortLegs: string; onShortLegs: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="truncate text-sm font-semibold text-content-primary">{name}</p>
      <Field label="Wynik">
        <Input type="number" min={0} value={score} onChange={e => onScore(e.target.value)} />
      </Field>
      <Field label="180">
        <Input type="number" min={0} value={count180} onChange={e => onCount180(e.target.value)} />
      </Field>
      <Field label="High checkout">
        <Input type="number" min={0} value={highCheckouts} onChange={e => onHighCheckouts(e.target.value)} />
      </Field>
      <Field label="Legi ≤15 lotek">
        <Input type="number" min={0} value={shortLegs} onChange={e => onShortLegs(e.target.value)} />
      </Field>
    </div>
  );
}
