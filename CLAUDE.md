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

## Primitives

Build / use these as the only UI building blocks (status = built vs to build):

`Modal` ✓ · `Card` · `Stat` · `Badge` · `ResultChip` · `Button` · `SegmentedControl` · `Eyebrow` / `SectionHeader` · `Avatar` · `EmptyState` · `Skeleton` · `EventItem` / `DateBox`

Each new primitive: build in isolation, add every variant to `/dev/ui`, then adopt.

## Design intent (so output isn't generic)

This is a darts scoreboard, not a generic dashboard. The **numeral is the hero** — big, condensed, tabular. Green and red mean win/loss because they are the **bull's colours**, not because green=good. **Purple is a rare accent** (focus rings, one highlight), never a fill for everything. Keep colour disciplined: status + accent + neutral, and the warm `rank` tone only for genuinely ranked/important items.

## Per-task checklist

1. Does a primitive already cover this? Use it. If not, propose one — don't inline.
2. Every colour is a semantic token; every size is on the scale.
3. Stat numbers use `font-display tabular-nums`; throw notation uses `font-mono`.
4. Run `npm run lint:ui` and resolve new findings before finishing.
5. Match `ProfilePage.tsx` as the reference style.
