// Port of symulator/symulator.py — 2D Gaussian dart throw model for 501

const R_BULLSEYE     = 6.35;
const R_BULL         = 15.9;
const R_TRIPLE_INNER = 99;
const R_TRIPLE_OUTER = 107;
const R_DOUBLE_INNER = 162;
const R_DOUBLE_OUTER = 170;

const SECTORS = [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];

const AIM_R = {
  S: (R_TRIPLE_OUTER + R_DOUBLE_INNER) / 2,
  T: (R_TRIPLE_INNER + R_TRIPLE_OUTER) / 2,
  D: (R_DOUBLE_INNER + R_DOUBLE_OUTER) / 2,
};

const CHECKOUTS: Record<number, string[]> = {
  41:['9','D16'],    42:['10','D16'],   43:['3','D20'],    44:['4','D20'],
  45:['13','D16'],   46:['6','D20'],    47:['7','D20'],    48:['16','D16'],
  49:['17','D16'],   50:['18','D16'],   51:['19','D16'],   52:['20','D16'],
  53:['13','D20'],   54:['14','D20'],   55:['15','D20'],   56:['16','D20'],
  57:['17','D20'],   58:['18','D20'],   59:['19','D20'],   60:['20','D20'],
  61:['T15','D8'],   62:['T10','D16'],  63:['T13','D12'],  64:['T16','D8'],
  65:['T19','D4'],   66:['T14','D12'],  67:['T17','D8'],   68:['T20','D4'],
  69:['T19','D6'],   70:['T18','D8'],
  71:['T13','D16'],  72:['T16','D12'],  73:['T19','D8'],   74:['T14','D16'],
  75:['T17','D12'],  76:['T20','D8'],   77:['T19','D10'],  78:['T18','D12'],
  79:['T19','D11'],  80:['T20','D10'],
  81:['T19','D12'],  82:['BULL','D16'], 83:['T17','D16'],  84:['T20','D12'],
  85:['T15','D20'],  86:['T18','D16'],  87:['T17','D18'],  88:['T20','D14'],
  89:['T19','D16'],  90:['T20','D15'],
  91:['T17','D20'],  92:['T20','D16'],  93:['T19','D18'],  94:['T18','D20'],
  95:['T19','D19'],  96:['T20','D18'],  97:['T19','D20'],  98:['T20','D19'],
  100:['T20','D20'],
  101:['T20','9','D16'],   102:['T16','14','D20'],  103:['T19','6','D20'],
  104:['T16','16','D20'],  105:['T20','13','D16'],  106:['T20','6','D20'],
  107:['T19','10','D20'],  108:['T20','16','D16'],  109:['T20','17','D16'],
  110:['T20','10','D20'],
  111:['T19','14','D20'],  112:['T20','20','D16'],  113:['T19','16','D20'],
  114:['T20','14','D20'],  115:['T20','15','D20'],  116:['T20','16','D20'],
  117:['T20','17','D20'],  118:['T20','18','D20'],  119:['T19','12','BULL'],
  120:['T20','20','D20'],
  121:['T20','11','BULL'],  122:['T18','18','BULL'],  123:['T19','16','BULL'],
  124:['T20','14','BULL'],  125:['25','T20','D20'],   126:['T19','19','BULL'],
  127:['T20','17','BULL'],  128:['18','T20','BULL'],   129:['19','T20','BULL'],
  130:['T20','20','BULL'],
  131:['T20','T13','D16'],  132:['25','T19','BULL'],   133:['T20','T19','D8'],
  134:['T20','T14','D16'],  135:['25','T20','BULL'],   136:['T20','T20','D8'],
  137:['T20','T19','D10'],  138:['T20','T18','D12'],   139:['T19','T14','D20'],
  140:['T20','T20','D10'],
  141:['T20','T19','D12'],  142:['T20','T14','D20'],   143:['T20','T17','D16'],
  144:['T20','T20','D12'],  145:['T20','T15','D20'],   146:['T20','T18','D16'],
  147:['T20','T17','D18'],  148:['T20','T20','D14'],   149:['T20','T19','D16'],
  150:['T20','T18','D18'],
  151:['T20','T17','D20'],  152:['T20','T20','D16'],   153:['T20','T19','D18'],
  154:['T20','T18','D20'],  155:['T20','T19','D19'],   156:['T20','T20','D18'],
  157:['T20','T19','D20'],  158:['T20','T20','D19'],   160:['T20','T20','D20'],
  161:['T20','T17','BULL'], 164:['T20','T18','BULL'],  167:['T20','T19','BULL'],
  170:['T20','T20','BULL'],
};

/** Returns the standard checkout route for a given value, e.g. 170 → "T20 · T20 · Bull". */
export function getCheckoutHint(value: number): string | null {
  if (value === 50) return 'Bull';
  if (value % 2 === 0 && value >= 2 && value <= 40) return `D${value / 2}`;
  const co = CHECKOUTS[value];
  return co ? co.join(' ') : null;
}

/** Converts a player's 3-dart visit average to the Gaussian throw sigma (mm). */
export function avgToSigma(average: number): number {
  if (average <= 0 || !isFinite(average)) return 55;
  return (1036.2 / average) - 3.684;
}

export const SKILL_LEVELS = [
  { id: 'pro',      label: 'Pro',           sigma: 12  },
  { id: 'top_am',   label: 'Dobry amator',  sigma: 25  },
  { id: 'club',     label: 'Klub',          sigma: 40  },
  { id: 'average',  label: 'Średni',        sigma: 55  },
  { id: 'beginner', label: 'Początkujący',  sigma: 80  },
  { id: 'casual',   label: 'Rekreacyjny',   sigma: 120 },
] as const;

export type SkillLevel = typeof SKILL_LEVELS[number];

export interface ThrowResult {
  target: string;
  hit:    string;
  score:  number;
}

export interface CpuVisit {
  darts:      ThrowResult[];
  totalScored: number;
  busted:     boolean;
}

function gauss(sigma: number): number {
  const u = 1 - Math.random();
  const v = Math.random();
  return sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function scoreAt(x: number, y: number): [number, string] {
  const r = Math.hypot(x, y);
  if (r > R_DOUBLE_OUTER) return [0, 'MISS'];
  if (r <= R_BULLSEYE)    return [50, 'BULLSEYE'];
  if (r <= R_BULL)        return [25, 'BULL'];
  const angle = ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
  const idx = Math.floor(((angle + 9) % 360) / 18);
  const n = SECTORS[idx];
  if (r > R_DOUBLE_INNER)                            return [2 * n, `D${n}`];
  if (r > R_TRIPLE_INNER && r <= R_TRIPLE_OUTER)     return [3 * n, `T${n}`];
  return [n, `S${n}`];
}

function aimPoint(target: string): [number, number] {
  const t = target.toUpperCase().trim();
  if (['BULL', 'BULLSEYE', '25', '50'].includes(t)) return [0, 0];
  const kind = /^\d+$/.test(t) ? 'S' : t[0];
  const num  = parseInt(/^\d+$/.test(t) ? t : t.slice(1));
  const r    = AIM_R[kind as keyof typeof AIM_R] ?? AIM_R.S;
  const idx  = SECTORS.indexOf(num);
  const angle = (idx * 18 * Math.PI) / 180;
  return [r * Math.sin(angle), r * Math.cos(angle)];
}

export function throwDart(target: string, sigma: number): ThrowResult {
  const [ax, ay] = aimPoint(target);
  const [score, hit] = scoreAt(ax + gauss(sigma), ay + gauss(sigma));
  return { target, hit, score };
}

export function chooseTarget(remaining: number, dartsLeft: number): string {
  if (remaining === 50) return 'BULL';
  if (remaining % 2 === 0 && remaining >= 2 && remaining <= 40) return `D${remaining / 2}`;
  const checkout = CHECKOUTS[remaining];
  if (checkout && checkout.length <= dartsLeft) return checkout[0];
  if (remaining > 60) return 'T20';
  if (remaining % 2 === 1) {
    const leave = remaining - 32;
    return leave >= 1 && leave <= 20 ? String(leave) : '1';
  }
  return 'T20';
}

export function cpuVisitDoubleAttempt(
  visit: CpuVisit,
  remainingBefore: number,
): import('../types/bracket').DoubleAttempt {
  const dartsAtDouble = visit.darts.filter(d =>
    d.target.startsWith('D') || d.target === 'BULL' || d.target === 'BULLSEYE' || d.target === '25'
  ).length;
  const isClosing = remainingBefore - visit.totalScored === 0;
  return {
    dartsAtDouble,
    ...(isClosing ? { dartsToClose: visit.darts.length } : {}),
  };
}

export function simulateCpuVisit(remaining: number, sigma: number): CpuVisit {
  const visitStart = remaining;
  const darts: ThrowResult[] = [];

  for (let i = 0; i < 3; i++) {
    const target  = chooseTarget(remaining, 3 - i);
    const result  = throwDart(target, sigma);
    const newRem  = remaining - result.score;
    const isDouble = result.hit.startsWith('D') || result.hit === 'BULLSEYE';
    const busted   = newRem < 0 || newRem === 1 || (newRem === 0 && !isDouble);

    darts.push(result);
    if (busted) return { darts, totalScored: 0, busted: true };
    remaining = newRem;
    if (remaining === 0) break;
  }

  return { darts, totalScored: visitStart - remaining, busted: false };
}
