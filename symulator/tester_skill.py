"""
Dart simulator with 501 leg play.

Throw model: 2D Gaussian around aim point. σ (in mm) is the skill knob.
501 strategy: look up remaining score in CHECKOUTS; fall back to T20 scoring
(with a small "leave 32 for D16" tweak for low odd numbers).
"""

from __future__ import annotations
import math
import random
from dataclasses import dataclass

# === Board geometry (mm, measured from board centre) ===
R_BULLSEYE     = 6.35
R_BULL         = 15.9
R_TRIPLE_INNER = 99
R_TRIPLE_OUTER = 107
R_DOUBLE_INNER = 162
R_DOUBLE_OUTER = 170

# Sectors clockwise from 20 (top)
SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17,
           3, 19, 7, 16, 8, 11, 14, 9, 12, 5]

# === Bot skill presets (σ in mm) ===
SKILL_LEVELS = {
    "102.7av": 6.1,
    "92.7av": 7.4,
    "89.3av": 8,
    "60av": 13.97,
    "55av": 15.3,
    "50av": 17.2,
    "45av": 19.2,
    "42av": 20.85,
    "39av": 23,
    "36av": 24.9,
}

def offset_from_avg(avg: float) -> float:
    return 1036.2 / avg - 3.684

# === Checkout table ===
# Bare numbers = singles; "T<n>" triple, "D<n>" double, "25" outer bull,
# "BULL" bullseye (50). 1-dart doubles (2..40, 50) are derived on the fly.
CHECKOUTS = {
    41: ["9", "D16"],   42: ["10", "D16"],  43: ["3", "D20"],   44: ["4", "D20"],
    45: ["13", "D16"],  46: ["6", "D20"],   47: ["7", "D20"],   48: ["16", "D16"],
    49: ["17", "D16"],  50: ["18", "D16"],  51: ["19", "D16"],  52: ["20", "D16"],
    53: ["13", "D20"],  54: ["14", "D20"],  55: ["15", "D20"],  56: ["16", "D20"],
    57: ["17", "D20"],  58: ["18", "D20"],  59: ["19", "D20"],  60: ["20", "D20"],

    61: ["T15", "D8"],  62: ["T10", "D16"], 63: ["T13", "D12"], 64: ["T16", "D8"],
    65: ["T19", "D4"],  66: ["T14", "D12"], 67: ["T17", "D8"],  68: ["T20", "D4"],
    69: ["T19", "D6"],  70: ["T18", "D8"],

    71: ["T13", "D16"], 72: ["T16", "D12"], 73: ["T19", "D8"],  74: ["T14", "D16"],
    75: ["T17", "D12"], 76: ["T20", "D8"],  77: ["T19", "D10"], 78: ["T18", "D12"],
    79: ["T19", "D11"], 80: ["T20", "D10"],

    81: ["T19", "D12"], 82: ["BULL", "D16"], 83: ["T17", "D16"], 84: ["T20", "D12"],
    85: ["T15", "D20"], 86: ["T18", "D16"],  87: ["T17", "D18"], 88: ["T20", "D14"],
    89: ["T19", "D16"], 90: ["T20", "D15"],

    91: ["T17", "D20"], 92: ["T20", "D16"], 93: ["T19", "D18"], 94: ["T18", "D20"],
    95: ["T19", "D19"], 96: ["T20", "D18"], 97: ["T19", "D20"], 98: ["T20", "D19"],
    100: ["T20", "D20"],

    101: ["T20", "9", "D16"],  102: ["T16", "14", "D20"], 103: ["T19", "6", "D20"],
    104: ["T16", "16", "D20"], 105: ["T20", "13", "D16"], 106: ["T20", "6", "D20"],
    107: ["T19", "10", "D20"], 108: ["T20", "16", "D16"], 109: ["T20", "17", "D16"],
    110: ["T20", "10", "D20"],

    111: ["T19", "14", "D20"], 112: ["T20", "20", "D16"], 113: ["T19", "16", "D20"],
    114: ["T20", "14", "D20"], 115: ["T20", "15", "D20"], 116: ["T20", "16", "D20"],
    117: ["T20", "17", "D20"], 118: ["T20", "18", "D20"], 119: ["T19", "12", "BULL"],
    120: ["T20", "20", "D20"],

    121: ["T20", "11", "BULL"], 122: ["T18", "18", "BULL"], 123: ["T19", "16", "BULL"],
    124: ["T20", "14", "BULL"], 125: ["25",  "T20", "D20"], 126: ["T19", "19", "BULL"],
    127: ["T20", "17", "BULL"], 128: ["18",  "T20", "BULL"], 129: ["19",  "T20", "BULL"],
    130: ["T20", "20", "BULL"],

    131: ["T20", "T13", "D16"], 132: ["25",  "T19", "BULL"], 133: ["T20", "T19", "D8"],
    134: ["T20", "T14", "D16"], 135: ["25",  "T20", "BULL"], 136: ["T20", "T20", "D8"],
    137: ["T20", "T19", "D10"], 138: ["T20", "T18", "D12"], 139: ["T19", "T14", "D20"],
    140: ["T20", "T20", "D10"],

    141: ["T20", "T19", "D12"], 142: ["T20", "T14", "D20"], 143: ["T20", "T17", "D16"],
    144: ["T20", "T20", "D12"], 145: ["T20", "T15", "D20"], 146: ["T20", "T18", "D16"],
    147: ["T20", "T17", "D18"], 148: ["T20", "T20", "D14"], 149: ["T20", "T19", "D16"],
    150: ["T20", "T18", "D18"],

    151: ["T20", "T17", "D20"], 152: ["T20", "T20", "D16"], 153: ["T20", "T19", "D18"],
    154: ["T20", "T18", "D20"], 155: ["T20", "T19", "D19"], 156: ["T20", "T20", "D18"],
    157: ["T20", "T19", "D20"], 158: ["T20", "T20", "D19"], 160: ["T20", "T20", "D20"],

    161: ["T20", "T17", "BULL"], 164: ["T20", "T18", "BULL"], 167: ["T20", "T19", "BULL"],
    170: ["T20", "T20", "BULL"],
}


@dataclass
class ThrowResult:
    target: str
    hit: str
    score: int
    landing: tuple

    def __repr__(self) -> str:
        return f"<aim={self.target} hit={self.hit} score={self.score}>"


# === Scoring: (x, y) -> (points, label) ===

def score_at(x: float, y: float) -> tuple[int, str]:
    r = math.hypot(x, y)
    if r > R_DOUBLE_OUTER:
        return 0, "MISS"
    if r <= R_BULLSEYE:
        return 50, "BULLSEYE"
    if r <= R_BULL:
        return 25, "BULL"
    angle = math.degrees(math.atan2(x, y)) % 360
    sector_idx = int((angle + 9) % 360 // 18)
    n = SECTORS[sector_idx]
    if R_DOUBLE_INNER < r <= R_DOUBLE_OUTER:
        return 2 * n, f"D{n}"
    if R_TRIPLE_INNER < r <= R_TRIPLE_OUTER:
        return 3 * n, f"T{n}"
    return n, f"S{n}"


# === Aim points ===

_AIM_R = {
    "S": (R_TRIPLE_OUTER + R_DOUBLE_INNER) / 2,
    "T": (R_TRIPLE_INNER + R_TRIPLE_OUTER) / 2,
    "D": (R_DOUBLE_INNER + R_DOUBLE_OUTER) / 2,
}


def aim_point(target: str) -> tuple[float, float]:
    """Targets: 'BULL', 'BULLSEYE', '25', 'S<n>', 'D<n>', 'T<n>',
    or a bare number (interpreted as outer single)."""
    t = target.upper().strip()
    if t in ("BULL", "BULLSEYE", "25", "50"):
        return (0.0, 0.0)

    if t.isdigit():
        kind, num = "S", int(t)
    else:
        kind, num_str = t[0], t[1:]
        if kind not in _AIM_R:
            raise ValueError(f"Unknown target: {target!r}")
        num = int(num_str)

    if num not in SECTORS:
        raise ValueError(f"Unknown sector: {num}")

    sector_idx = SECTORS.index(num)
    angle = math.radians(sector_idx * 18)
    r = _AIM_R[kind]
    return (r * math.sin(angle), r * math.cos(angle))


def throw(target: str, sigma: float,
          rng: random.Random | None = None) -> ThrowResult:
    rng = rng or random
    ax, ay = aim_point(target)
    lx = ax + rng.gauss(0.0, sigma)
    ly = ay + rng.gauss(0.0, sigma)
    score, label = score_at(lx, ly)
    return ThrowResult(target=target, hit=label, score=score, landing=(lx, ly))


# === 501 strategy ===

def choose_target(remaining: int, darts_left: int) -> str:
    """Decide what to aim at, given the score remaining and how many darts
    are left in the current visit (1, 2, or 3)."""

    # 1-dart finish: a double (or bullseye for 50)
    if remaining == 50:
        return "BULL"
    if remaining % 2 == 0 and 2 <= remaining <= 40:
        return f"D{remaining // 2}"

    # Multi-dart checkout from the table (only if the sequence fits)
    if remaining in CHECKOUTS:
        seq = CHECKOUTS[remaining]
        if len(seq) <= darts_left:
            return seq[0]

    # Can't checkout this visit — score and try to leave a doubleable number
    if remaining > 60:
        return "T20"

    # Low odd remainder: try to leave 32 (D16)
    if remaining % 2 == 1:
        leave = remaining - 32
        if 1 <= leave <= 20:
            return str(leave)
        return "1"  # punt to make it even

    return "T20"


# === 501 leg ===

def play_501(sigma: float, rng: random.Random | None = None,
             verbose: bool = True, max_darts: int = 150) -> dict:
    """Simulate one 501 leg from 501 → 0. Returns a stats dict."""
    rng = rng or random.Random()
    remaining = 501
    total_darts = 0
    visit_num = 0

    while remaining > 0 and total_darts < max_darts:
        visit_num += 1
        if verbose:
            if visit_num > 1:
                print()
            print(f"--- Wizyta {visit_num}  (start: {remaining}) ---")

        visit_start = remaining

        for dart_i in range(3):
            darts_left = 3 - dart_i
            target = choose_target(remaining, darts_left)
            r = throw(target, sigma, rng)
            total_darts += 1

            new_rem = remaining - r.score
            is_double = r.hit.startswith("D") or r.hit == "BULLSEYE"

            # Bust: below 0, lands on 1, or zeroes without a double
            busted = new_rem < 0 or new_rem == 1 or \
                     (new_rem == 0 and not is_double)

            if busted:
                if verbose:
                    print(f"CEL: {target:<5} TRAFIENIE: {r.hit + ',':<10}"
                          f"POZOSTAŁO: {visit_start}  [BUST]")
                remaining = visit_start
                break

            remaining = new_rem
            tag = "  [KONIEC LEGA]" if remaining == 0 else ""
            if verbose:
                print(f"CEL: {target:<5} TRAFIENIE: {r.hit + ',':<10}"
                      f"POZOSTAŁO: {remaining}{tag}")

            if remaining == 0:
                break

    return {
        "finished":         remaining == 0,
        "darts":            total_darts,
        "visits":           visit_num,
        "avg_per_3_darts":  (501 - remaining) / total_darts * 3 if total_darts else 0,
    }


# === Demo ===

import statistics

if __name__ == "__main__":

    BIN_STEP = 2

    # Single simulation pass — reuse results for all output sections
    all_legs: dict[str, list[dict]] = {}
    for name, s in SKILL_LEVELS.items():
        all_legs[name] = [
            play_501(s, rng=random.Random(i), verbose=False, max_darts=300)
            for i in range(1000)
        ]

    # ── Summary table ────────────────────────────────────────────────────────
    print("\n=== 1000 legów na poziom ===")
    print(f"{'skill':<12} {'σ':>4} {'med. lotek':>10} {'med. 3-lotki':>13}")
    for name, s in SKILL_LEVELS.items():
        legs = all_legs[name]
        med_darts = statistics.median(l["darts"]            for l in legs)
        med_3     = statistics.median(l["avg_per_3_darts"]  for l in legs)
        print(f"{name:<12} {s:>4} {med_darts:>10.1f} {med_3:>13.1f}")

    # ── Rozkład średniej na leg (pułapy co 2 pkt) ────────────────────────────
    print("\n=== Rozkład średniej na leg (pułapy co 2 pkt) ===")
    for name, s in SKILL_LEVELS.items():
        legs = all_legs[name]
        n    = len(legs)

        counts: dict[float, int] = {}
        for leg in legs:
            lo = (leg["avg_per_3_darts"] // BIN_STEP) * BIN_STEP
            counts[lo] = counts.get(lo, 0) + 1

        print(f"\n{name} (σ={s})")
        for lo in sorted(counts):
            pct = counts[lo] / n * 100
            bar = "▓" * round(pct / 2)   # 1 char ≈ 2 %
            print(f"  [{lo:>4.0f}, {lo + BIN_STEP:<4.0f})  {pct:5.1f}%  {bar}")