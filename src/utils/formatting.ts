export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}.${m}.${y}`;
}

export function fmtDateShort(iso: string): string {
  const [, m, d] = iso.split('T')[0].split('-');
  return `${d}.${m}`;
}

/** Match format label for headers: "BO5 leg", or "BO3 set · BO5 leg" when played in sets — same wording as the tournament header. */
export function fmtMatchFormat(format: { sets: number; legs: number }): string {
  return format.sets > 1
    ? `BO${format.sets} set · BO${format.legs} leg`
    : `BO${format.legs} leg`;
}
