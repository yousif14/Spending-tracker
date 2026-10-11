# P4 design audit (redesign-existing-projects, audit-first)

Scope: `src/pages/*`, `src/index.css`, `index.html`, `src/App.tsx` as of 2026-10-11 (Lovable UI). Skills used as guidance only; the approved direction (Calm Ledger, top segments + floating add, Lucide kept, Fraunces + Manrope) wins where they disagree.

| # | Finding | Skill rule | Action in P4 |
|---|---|---|---|
| 1 | Default system/Inter-style font, no display face; amounts in proportional figures | Typography: font swap, tabular figures | Task 1–2: Fraunces 600 (numbers, headings) + Manrope; `tabular-nums` on every amount, always 3 decimals |
| 2 | Indigo `#6366f1` theme colour, 18 gradient/glow variables, 6 component usages | Color: one accent, no "AI gradient" | Task 2: Calm Ledger tokens (single teal accent), delete gradient/glow vars + classes |
| 3 | Navigation is a page list (Transactions/Budget/Categories/Merchants/Settings) | Layout: top nav over sidebar; current page indicated | Task 9: three segments with sliding active pill + menu for the rest |
| 4 | Two `QueryClientProvider`s (main.tsx and App.tsx) | Code quality | Task 9: App.tsx drops its own client, keeps the one in `main.tsx` |
| 5 | Loading = spinners/blank; few empty or error states | States: skeletons, empty, error | Task 11–12: shape-matched skeletons, "Try again" error, empty-filter message |
| 6 | Lovable OG/Twitter tags, generic description, house-icon favicon | Missing/incorrect meta | Task 1: title `FA`, theme-color per scheme, Lovable tags removed |
| 7 | Hard `min-h-screen` | Layout: `min-h-dvh` | Task 9: `min-h-dvh` + safe-area padding |
| 8 | Instant state changes; no press feedback on primary actions | States: press feedback (scale 0.97) | Task 8–9: FAB `whileTap` 0.97, buttons keep shadcn hover |
| 9 | Heavy card shadows in places | Minimalist: near-zero shadows | Cards: surface + 1px line, no heavy shadow |
| 10 | Title-case headings ("Add Transaction") | Content: sentence case | New UI uses sentence case |

Not adopted (conflicts with the approved direction or adds dependencies without value here): swapping Lucide for Phosphor, grain/noise overlays, background imagery, bento grids, scroll-driven reveals.

Motion (design-motion-principles, Create mode): weighting **Emil primary, Jakub secondary** — a daily-use finance tool. Frequent actions (segment switch, opening quick add) under ~250 ms, exits quicker than entries, springs with no bounce, only `transform`/`opacity` animated (progress bars use `scaleX`, not `width`), nothing animates on the 30 s auto-refresh except genuinely new rows, `MotionConfig reducedMotion="user"` app-wide.
