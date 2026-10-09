import beginnerIcon from '../assets/icons/1-poczatkujacy.svg';
import clubIcon from '../assets/icons/2-klubowy.svg';
import goodIcon from '../assets/icons/3-dobry-gracz.svg';
import proIcon from '../assets/icons/4-zawodowiec.svg';
import legendIcon from '../assets/icons/5-legenda.svg';

export type SkillTier = {
  level: 1 | 2 | 3 | 4 | 5;
  label: string;
  /** Inclusive lower bound of the 3-dart average for this tier. */
  min:   number;
  icon:  string;
};

// Thresholds tuned to the local player pool (Puchar Prezesa 2026, n01 data:
// averages ~30–64) so the five tiers actually spread players out — Legenda
// stays reserved for the genuine top of the field.
export const SKILL_TIERS: readonly SkillTier[] = [
  { level: 1, label: 'Początkujący', min: 0,  icon: beginnerIcon },
  { level: 2, label: 'Klubowy',      min: 40, icon: clubIcon     },
  { level: 3, label: 'Dobry gracz',  min: 45, icon: goodIcon     },
  { level: 4, label: 'Zawodowiec',   min: 50, icon: proIcon      },
  { level: 5, label: 'Legenda',      min: 55, icon: legendIcon   },
];

/** Tier for a 3-dart average; null when there is no average yet (≤ 0, e.g. placeholders). */
export function skillTier(avg: number | string | null | undefined): SkillTier | null {
  const n = Number(avg);
  if (!Number.isFinite(n) || n <= 0) return null;
  for (let i = SKILL_TIERS.length - 1; i >= 0; i--) {
    if (n >= SKILL_TIERS[i].min) return SKILL_TIERS[i];
  }
  return SKILL_TIERS[0];
}
