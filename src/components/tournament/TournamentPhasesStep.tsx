import { useState } from 'react';
import type { PhaseConfig, TournamentFormat, MatchFormat } from '../../types/tournament';
import { SET_MIN, SET_MAX, LEG_MIN, LEG_MAX, roundToNearestOdd } from '../../types/tournament';
import { roundLabel, nextPowerOf2 } from '../../utils/bracket';
import { Input } from '../ui/Input';
import { BestOfField } from './BestOfField';

type Phase = { id: string; label: string };

function computePhases(format: TournamentFormat, playerCount: number, groupSize: number): Phase[] {
  if (playerCount < 2) return [];

  if (format === 'knockout') {
    const bracketSize = nextPowerOf2(playerCount);
    const numRounds   = Math.log2(bracketSize);
    return Array.from({ length: numRounds }, (_, i) => ({
      id:    `round-${i}`,
      label: roundLabel(i, numRounds),
    }));
  }

  // groups
  const groupCount      = Math.max(1, Math.ceil(playerCount / groupSize));
  const advancingTeams  = groupCount * 2;
  const playoffSize     = nextPowerOf2(Math.max(advancingTeams, 2));
  const numPlayoffRounds = Math.log2(playoffSize);
  return [
    { id: 'groups', label: 'Faza grupowa' },
    ...Array.from({ length: numPlayoffRounds }, (_, i) => ({
      id:    `r${i}`,
      label: roundLabel(i, numPlayoffRounds),
    })),
  ];
}

type Props = {
  format:        TournamentFormat;
  playerCount:   number;
  groupSize:     number;
  defaultFormat: MatchFormat;
  phaseConfigs:  Record<string, PhaseConfig>;
  onChange:      (phaseConfigs: Record<string, PhaseConfig>) => void;
};

export function TournamentPhasesStep({
  format, playerCount, groupSize, defaultFormat, phaseConfigs, onChange,
}: Props) {
  const phases = computePhases(format, playerCount, groupSize);

  // Raw text buffers per phase, keyed by phase id — a phase's own committed
  // sets/legs live in phaseConfigs, but typing a multi-digit value needs a
  // draft to survive in between keystrokes without rounding on every one.
  const [drafts, setDrafts] = useState<Record<string, { sets?: string; legs?: string }>>({});

  function updateDraft(id: string, field: 'sets' | 'legs', value: string) {
    setDrafts(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  function commitSets(id: string) {
    const raw = drafts[id]?.sets;
    if (raw === undefined) return;
    update(id, { sets: roundToNearestOdd(Number(raw), SET_MIN, SET_MAX) });
    setDrafts(prev => ({ ...prev, [id]: { ...prev[id], sets: undefined } }));
  }

  function commitLegs(id: string) {
    const raw = drafts[id]?.legs;
    if (raw === undefined) return;
    update(id, { legs: roundToNearestOdd(Number(raw), LEG_MIN, LEG_MAX) });
    setDrafts(prev => ({ ...prev, [id]: { ...prev[id], legs: undefined } }));
  }

  if (phases.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-content-secondary">
        Dodaj co najmniej dwóch graczy, aby skonfigurować fazy.
      </p>
    );
  }

  function getPhase(id: string): { date: string; sets: number; legs: number; maxDartsPerLeg: number | null } {
    const pc = phaseConfigs[id];
    return {
      date:           pc?.date ?? '',
      sets:           pc?.matchFormat?.sets ?? defaultFormat.sets,
      legs:           pc?.matchFormat?.legs ?? defaultFormat.legs,
      maxDartsPerLeg: pc?.matchFormat?.max_darts_per_leg ?? defaultFormat.max_darts_per_leg ?? null,
    };
  }

  function update(id: string, patch: Partial<{ date: string; sets: number; legs: number }>) {
    const current = getPhase(id);
    const next    = { ...current, ...patch };
    const pc: PhaseConfig = {
      ...(next.date ? { date: next.date } : {}),
      matchFormat: {
        sets: next.sets,
        legs: next.legs,
        ...(next.maxDartsPerLeg != null ? { max_darts_per_leg: next.maxDartsPerLeg } : {}),
      },
    };
    onChange({ ...phaseConfigs, [id]: pc });
  }

  return (
    <div className="flex flex-col gap-4">
      {phases.map(phase => {
        const { date, sets, legs } = getPhase(phase.id);
        return (
          <div key={phase.id} className="rounded-xl border border-border-subtle bg-surface-overlay p-4">
            <p className="mb-3 text-sm font-semibold text-content-primary">{phase.label}</p>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-medium uppercase tracking-widest text-content-secondary">Data i godzina</p>
                <Input
                  type="datetime-local"
                  value={date}
                  onChange={e => update(phase.id, { date: e.target.value })}
                />
              </div>

              <BestOfField
                label="Sety (best of)"
                value={drafts[phase.id]?.sets ?? String(sets)}
                min={SET_MIN} max={SET_MAX}
                onChange={v => updateDraft(phase.id, 'sets', v)}
                onBlur={() => commitSets(phase.id)}
              />

              <BestOfField
                label="Legi (best of)"
                value={drafts[phase.id]?.legs ?? String(legs)}
                min={LEG_MIN} max={LEG_MAX}
                onChange={v => updateDraft(phase.id, 'legs', v)}
                onBlur={() => commitLegs(phase.id)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
