/**
 * Joins truthy class strings. Keep it dependency-free for now; if class
 * conflicts become a problem later, swap the body for `tailwind-merge`.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
