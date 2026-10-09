import { skillTier } from "../../utils/skillTier";
import { cn } from "./cn";

const SIZE = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-24 w-24",
} as const;

export interface SkillIconProps {
  /** 3-dart average; nothing renders when there is none (≤ 0 / missing). */
  avg: number | string | null | undefined;
  /**
   * sm (lists) is the smallest readable size — below ~32px the tier ornaments
   * (laurels, star, spikes, glow) blur together and tiers stop being distinct.
   */
  size?: keyof typeof SIZE;
  className?: string;
}

/** Skill-tier medal (Początkujący → Legenda) for a player's average. */
export function SkillIcon({ avg, size = "sm", className }: SkillIconProps) {
  const tier = skillTier(avg);
  if (!tier) return null;
  const label = `${tier.label} (śr. ${Number(avg).toFixed(1)})`;
  return (
    <img
      src={tier.icon}
      alt={label}
      title={label}
      draggable={false}
      className={cn("shrink-0 select-none", SIZE[size], className)}
    />
  );
}

export default SkillIcon;
