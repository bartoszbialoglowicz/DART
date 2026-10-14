import { skillTier } from "../../utils/skillTier";
import { cn } from "./cn";

const SIZE = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-24 w-24",
  /** Background artwork (e.g. behind a match header). */
  xl: "h-64 w-64",
} as const;

export interface SkillIconProps {
  /** 3-dart average; nothing renders when there is none (≤ 0 / missing). */
  avg: number | string | null | undefined;
  /**
   * sm (lists) is the smallest readable size — below ~32px the tier ornaments
   * (laurels, star, spikes, glow) blur together and tiers stop being distinct.
   */
  size?: keyof typeof SIZE;
  /** Pure decoration — hidden from assistive tech, no tooltip (the name is shown elsewhere). */
  decorative?: boolean;
  /**
   * Fade out the lower half. The tiers differ mostly in the top ornaments
   * (laurels, star, spikes, crown), so as a backdrop only the top half matters.
   */
  fadeBottom?: boolean;
  className?: string;
}

const FADE_BOTTOM = "linear-gradient(to bottom, black 40%, transparent 60%)";

/** Skill-tier medal (Początkujący → Legenda) for a player's average. */
export function SkillIcon({ avg, size = "sm", decorative, fadeBottom, className }: SkillIconProps) {
  const tier = skillTier(avg);
  if (!tier) return null;
  const label = `${tier.label} (śr. ${Number(avg).toFixed(1)})`;
  return (
    <img
      src={tier.icon}
      alt={decorative ? "" : label}
      title={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      draggable={false}
      style={fadeBottom ? { maskImage: FADE_BOTTOM, WebkitMaskImage: FADE_BOTTOM } : undefined}
      className={cn("shrink-0 select-none", SIZE[size], className)}
    />
  );
}

export default SkillIcon;
