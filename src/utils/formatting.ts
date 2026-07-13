export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}.${m}.${y}`;
}

export function fmtDateShort(iso: string): string {
  const [, m, d] = iso.split('T')[0].split('-');
  return `${d}.${m}`;
}
