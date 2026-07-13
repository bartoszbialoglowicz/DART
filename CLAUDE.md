# UI & Design System — rules for agents

This file is binding for any work that touches UI. Read it before editing styles or building components.

## Golden rule

Build UI **only** from semantic design tokens and existing primitives.
If a fitting primitive does not exist, **propose a new primitive** — never inline ad-hoc styles to ship the task. Consistency beats speed; a one-off `div` with bespoke classes is how the UI drifts.

Canonical reference to copy: `src/pages/ProfilePage.tsx` and the component gallery at `/dev/ui`.

## Allowed vocabulary

**Colours — use the semantic tokens only** (defined in `src/styles/tokens.css`):

- Backgrounds: `bg-surface-base` (app bg), `bg-surface-overlay` (cards, modal), `bg-surface-muted` (inputs, hover), `bg-surface-accent`.
- Text / icons: `text-content-primary`, `text-content-secondary`, `text-content-faint`, `text-content-accent`, `text-content-on-accent`.
- Borders: `border-border-subtle`, `border-border-accent`, `border-border-strong`.
- Status (dartboard bull colours): `score-up*` (win / positive), `score-down*` (loss / negative), `rank*` (rare warm highlight). Each has a `-soft` fill and `-text` variant — e.g. a win badge is `bg-score-up-soft text-score-up-text`; an online dot is `bg-score-up`.

**Typography — three roles, nothing else:**

- `font-display` (Saira Condensed) → all stat numerals and headings. Always pair with `tabular-nums`.
- `font-sans` (Inter) → body and UI text. This is the default; you rarely name it.
- `font-mono` (JetBrains Mono) → throw notation only: `T20`, `D16`, `180`, checkout strings.

Use Tailwind's built-in size/spacing/radius scale (`text-sm`, `p-4`, `rounded-xl`, …). Custom numeric sizes live **inside** a primitive, never sprinkled across pages.

## Hard bans (the lint guard flags these)

- ❌ Arbitrary values: `text-[10px]`, `p-[13px]`, `bg-[#1a1a2e]`, `rounded-[7px]`. Use the scale or a token.
- ❌ White-alpha surfaces: `bg-white/3`, `bg-white/5`, `bg-white/10`. Use `surface-overlay` / `surface-muted`.
- ❌ Raw Tailwind palette colours: `text-green-400`, `bg-red-500/15`, `bg-blue-500`, `text-amber-400`, any `*-gray-*`. Use status or `content`/`surface` tokens.
- ❌ Hex / rgb literals in `.tsx` (e.g. `const PURPLE = '#ac58e9'`). Reference a token.
- ⚠ `brand-*` utilities used directly (`text-brand-white`, `bg-brand-purple/25`). Deprecated — migrating away. Do not add new usages.
- ❌ Hand-rolling things a primitive already does. An overlay/dialog/confirm popup is `Modal` — never a bespoke `fixed inset-0 … bg-black/x` with its own `z-[...]`. A pick-one control (modes, levels, sets/legs, toggles) is `OptionButton` / `SelectableCard` / `SegmentedControl`. The lint cannot see these — it is on you to reach for the primitive.

## The lint opt-out is human-only

The guard honours `ui-lint-disable-file` (top of file) and `ui-lint-ignore` (end of line). These exist for a tiny set of **sanctioned expressive/"art" components** — deliberately off-system pieces like the champion `WinnerCard` (poster typography, decorative gradients, trophy gold). They are NOT a way to make a finding go away.

- You may **never** add either marker yourself to silence the lint. A lint finding means *fix the finding* (use the token / scale / primitive).
- A new expressive exception is a human decision. If you think something genuinely needs to break the system, **stop and ask** — don't disable and proceed.
- Treat any file carrying a disable marker as off-limits for "tokenise this" cleanups; it's intentional.

## Lint can't see these — review by hand

The guard catches the bans above. These cause just as much drift but pass lint green, so check them yourself on every diff:

- **Elevation.** Anything sitting on the page background is a card → `bg-surface-overlay` (matches `ProfilePage`), never `bg-surface-base` (it blends and reads "dark/flat"). Hover lifts one step: `hover:bg-surface-muted`. **Never** `bg-surface-accent` / `hover:bg-surface-accent` as a fill — that token is solid purple and reads as a glaring flash.
- **No opacity dilution of tokens.** `border-border-subtle/40`, `text-content-secondary/60` and friends are the new `bg-white/3`. Dim text → `text-content-faint`. Borders → full `border-border-subtle`.
- **Only tokens that exist.** If a colour utility renders as nothing, the token is undefined. Note: `content-danger` does **not** exist — error text is `text-score-down-text`.
- **Arbitrary values the lint misses.** It only flags brackets containing a unit or hex, so `z-[60]`, `scale-[0.98]` and fractional opacities slip through — they are still banned. Need a z-index above the app shell? Ask.
- **Launcher cards don't take `selected`.** A card that navigates or starts an action is not a toggle; omit `selected` so it doesn't announce a phantom `aria-pressed`.

## Primitives

Build / use these as the only UI building blocks (status = built vs to build):

Built (use these): `Modal` · `Card` · `Stat` · `Badge` · `ResultChip` · `Button` · `Input` · `Field` · `Toggle` · `SegmentedControl` · `OptionButton` · `SelectableCard`

Not yet built (propose, don't inline): `Eyebrow` / `SectionHeader` · `Avatar` · `EmptyState` · `Skeleton` · `EventItem` / `DateBox`

Each new primitive: build in isolation, add every variant to `/dev/ui`, then adopt.

## Design intent (so output isn't generic)

This is a darts scoreboard, not a generic dashboard. The **numeral is the hero** — big, condensed, tabular. Green and red mean win/loss because they are the **bull's colours**, not because green=good. **Purple is a rare accent** (focus rings, one highlight), never a fill for everything. Keep colour disciplined: status + accent + neutral, and the warm `rank` tone only for genuinely ranked/important items.

## Per-task checklist

1. **Sweep the whole file** — every hand-rolled button, input, overlay, card, pill or list row becomes a primitive. Leave no bespoke block "because it works".
2. Does a primitive cover this? Use it. If none fits, **STOP and ask** — don't inline or invent.
3. Every colour is an existing semantic token; every size is on the scale.
4. Stat numbers use `font-display tabular-nums`; throw notation uses `font-mono`.
5. Walk the five "lint can't see these" points above against your diff, one by one.
6. Run `npm run lint:ui` (0 new findings) and match `ProfilePage.tsx`.
