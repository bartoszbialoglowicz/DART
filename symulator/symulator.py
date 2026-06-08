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
    "pro":          12,
    "45av":         19,
    "strong_am":    25,
    "club":         40,
    "average":      55,
    "beginner":     80,
    "casual":      120,
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
    double_attempts = 0
    double_hits = 0

    while remaining > 0 and total_darts < max_darts:
        visit_num += 1
        if verbose:
            if visit_num > 1:
                print()
            print(f"--- Wizyta {visit_num}  (start: {remaining}) ---")

        visit_start = remaining

        for dart_i in range(3):
            darts_left = 3 - dart_i

            # 1-dart-finish opportunity (must hit a double or BULLSEYE this dart)
            is_double_attempt = (remaining == 50 or
                                 (remaining % 2 == 0 and 2 <= remaining <= 40))
            if is_double_attempt:
                double_attempts += 1

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

            # Successful close on a 1-dart-finish opportunity = double hit
            if remaining == 0 and is_double_attempt:
                double_hits += 1

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
        "double_attempts":  double_attempts,
        "double_hits":      double_hits,
    }


def play_501_2p(sigmas: list, names: tuple = ("Gracz 1", "Gracz 2"),
                first_player: int = 0, rng: random.Random | None = None,
                verbose: bool = True, max_darts_per_player: int = 200) -> list:
    """Simulate one 501 leg between two bots, alternating visits.
    Returns a list of two stats dicts (one per player). Leg ends as soon as
    a player reaches 0 on a double."""
    rng = rng or random.Random()
    remaining       = [501, 501]
    visit_num       = [0, 0]
    darts_count     = [0, 0]
    double_attempts = [0, 0]
    double_hits     = [0, 0]

    current = first_player
    first_print = True

    while remaining[0] > 0 and remaining[1] > 0 \
          and max(darts_count) < max_darts_per_player:

        visit_num[current] += 1
        if verbose:
            if not first_print:
                print()
            first_print = False
            print(f"--- WIZYTA {visit_num[current]}: {names[current]}  "
                  f"(start: {remaining[current]}) ---")

        visit_start = remaining[current]

        for dart_i in range(3):
            darts_left = 3 - dart_i
            rem = remaining[current]

            # 1-dart-finish opportunity (must hit a double or BULLSEYE)
            is_double_attempt = (rem == 50 or
                                 (rem % 2 == 0 and 2 <= rem <= 40))
            if is_double_attempt:
                double_attempts[current] += 1

            target = choose_target(rem, darts_left)
            r = throw(target, sigmas[current], rng)
            darts_count[current] += 1

            new_rem = rem - r.score
            is_double = r.hit.startswith("D") or r.hit == "BULLSEYE"

            busted = new_rem < 0 or new_rem == 1 or \
                     (new_rem == 0 and not is_double)

            if busted:
                if verbose:
                    print(f"CEL: {target:<5} TRAFIENIE: {r.hit + ',':<10}"
                          f"POZOSTAŁO: {visit_start}  [BUST]")
                remaining[current] = visit_start
                break

            remaining[current] = new_rem

            if new_rem == 0 and is_double_attempt:
                double_hits[current] += 1

            tag = "  [KONIEC LEGA]" if new_rem == 0 else ""
            if verbose:
                print(f"CEL: {target:<5} TRAFIENIE: {r.hit + ',':<10}"
                      f"POZOSTAŁO: {new_rem}{tag}")

            if new_rem == 0:
                break

        current = 1 - current   # alternate

    # Determine winner
    if remaining[0] == 0:
        winner = 0
    elif remaining[1] == 0:
        winner = 1
    else:
        winner = -1  # max_darts safety break

    if verbose and winner >= 0:
        print(f"\n>>> Wygrał: {names[winner]} "
              f"({darts_count[winner]} lotek) <<<")

    return [{
        "name":            names[i],
        "won":             i == winner,
        "darts":           darts_count[i],
        "visits":          visit_num[i],
        "avg_per_3_darts": (501 - remaining[i]) / darts_count[i] * 3
                           if darts_count[i] else 0,
        "double_attempts": double_attempts[i],
        "double_hits":     double_hits[i],
    } for i in range(2)]


# === Interactive runner ===

def select_skill(label: str = "bota") -> tuple[str, int] | None:
    """Show the skill menu and return (name, sigma), or None to quit."""
    print(f"\nWybierz poziom {label}:")
    options = list(SKILL_LEVELS.items())
    for i, (name, sigma) in enumerate(options, 1):
        print(f"  {i}) {name:<10} (σ = {sigma} mm)")
    print("  q) wyjdź")

    while True:
        try:
            choice = input("> ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            return None
        if choice in ("q", "quit", "exit", ""):
            return None
        if choice.isdigit():
            idx = int(choice)
            if 1 <= idx <= len(options):
                return options[idx - 1]
        print("  Nieprawidłowy wybór — wpisz numer z listy albo 'q'.")
    """ off = offset_from_avg(float(input()))
    return [str(off), off] """


def post_leg_menu() -> str:
    """Show post-leg menu. Returns '1' (next leg), '2' (change level), or 'q' (exit)."""
    print("\nCo dalej?")
    print("  1) następny leg")
    print("  2) zmiana poziomu")
    print("  q) wyjdź")
    while True:
        try:
            choice = input("> ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            return "q"
        if choice in ("1", "2"):
            return choice
        if choice in ("q", "quit", "exit", ""):
            return "q"
        print("  Nieprawidłowy wybór — wpisz 1, 2 lub q.")


def print_session_summary(legs: list, name: str, sigma: int) -> None:
    n = len(legs)
    avg_of_avgs = sum(l["avg_per_3_darts"] for l in legs) / n
    da = sum(l["double_attempts"] for l in legs)
    dh = sum(l["double_hits"] for l in legs)
    pct = dh / da * 100 if da else 0.0

    print(f"\n--- Statystyki sesji  ({name}, σ={sigma} mm) ---")
    print(f"Rozegrane legi:           {n}")
    print(f"Średnia legów (3-lotki):  {avg_of_avgs:.2f}")
    print(f"Procent na doublach:      {pct:.1f}%   ({dh}/{da})")


def print_session_summary_2p(legs_p1: list, legs_p2: list,
                              name1: str, sigma1: int,
                              name2: str, sigma2: int) -> None:
    """Print session stats separately for both players."""
    n = len(legs_p1)
    wins1 = sum(1 for l in legs_p1 if l["won"])
    wins2 = sum(1 for l in legs_p2 if l["won"])

    print(f"\n=== Statystyki sesji  (legi: {n},  {wins1}-{wins2}) ===")
    for label, legs, skill, sigma in [
        ("Gracz 1", legs_p1, name1, sigma1),
        ("Gracz 2", legs_p2, name2, sigma2),
    ]:
        avg_of_avgs = sum(l["avg_per_3_darts"] for l in legs) / n
        da = sum(l["double_attempts"] for l in legs)
        dh = sum(l["double_hits"] for l in legs)
        pct = dh / da * 100 if da else 0.0
        wins = sum(1 for l in legs if l["won"])

        print(f"\n  {label}  ({skill}, σ={sigma} mm)")
        print(f"    Wygrane legi:             {wins}/{n}")
        print(f"    Średnia legów (3-lotki):  {avg_of_avgs:.2f}")
        print(f"    Procent na doublach:      {pct:.1f}%   ({dh}/{da})")


if __name__ == "__main__":
    # Setup: pick a skill for each player
    p1 = select_skill("gracza 1")
    if p1 is None:
        print("\nDo zobaczenia.")
    else:
        name1, sigma1 = p1
        p2 = select_skill("gracza 2")
        if p2 is None:
            print("\nDo zobaczenia.")
        else:
            name2, sigma2 = p2
            legs_p1: list = []
            legs_p2: list = []
            first_player = 0   # gracz 1 zaczyna; alternuje co leg
            while True:
                leg_num = len(legs_p1) + 1
                starter = "Gracz 1" if first_player == 0 else "Gracz 2"
                print(f"\n=== 501  |  Leg {leg_num}  |  "
                      f"Gracz 1: {name1} (σ={sigma1})  vs  "
                      f"Gracz 2: {name2} (σ={sigma2})  |  "
                      f"zaczyna: {starter} ===\n")

                results = play_501_2p(
                    sigmas=[sigma1, sigma2],
                    names=("Gracz 1", "Gracz 2"),
                    first_player=first_player,
                )
                legs_p1.append(results[0])
                legs_p2.append(results[1])

                print_session_summary_2p(legs_p1, legs_p2,
                                          name1, sigma1, name2, sigma2)

                action = post_leg_menu()
                if action == "1":
                    first_player = 1 - first_player   # alternuj kto zaczyna
                    continue
                if action == "2":
                    new1 = select_skill("gracza 1")
                    if new1 is None:
                        print("\nDo zobaczenia.")
                        break
                    new2 = select_skill("gracza 2")
                    if new2 is None:
                        print("\nDo zobaczenia.")
                        break
                    name1, sigma1 = new1
                    name2, sigma2 = new2
                    legs_p1, legs_p2 = [], []   # reset statystyk
                    first_player = 0
                    continue
                # 'q'
                print("\nDo zobaczenia.")
                break