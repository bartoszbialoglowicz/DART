export type RoundDate = { round: number; date: string }; // date as 'YYYY-MM-DD'

/** Add (or subtract) whole days to a 'YYYY-MM-DD' string, timezone-safe. */
export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d) + days * 86_400_000);
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

/**
 * Spread dates across rounds from an anchor: round i gets
 *   anchorDate + (i - anchorRound) * intervalDays
 * Rounds before the anchor get earlier (negative-offset) dates automatically.
 */
export function buildRoundDates(
  rounds: number[],
  anchorRound: number,
  anchorDate: string,
  intervalDays: number,
): RoundDate[] {
  return rounds.map((round) => ({
    round,
    date: addDaysISO(anchorDate, (round - anchorRound) * intervalDays),
  }));
}
