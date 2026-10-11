# FA Upgrade — Design

Date: 2026-10-11 · Status: approved (brainstorming session "FC-openV1.1")
Visual review page: https://claude.ai/artifact/WYCXZujQDdoZvPkg5RDAp6
System context: `docs/SYSTEM-MAP.md`

## Goals

What stays the same:
- The iPhone Shortcut flow (`POST /webhook/addNewTransaction`) and the instant Telegram replies.
- Manual add, which the partner uses from an Android phone.

What gets better:
1. New categories are easy to add, and they appear automatically in the Telegram picker.
2. Fawri+ payments get smart merchant suggestions, based on the destination IBAN ending, the amount and the time.
3. The PWA (fa.11homelab.cc) gets a polished UI and refreshes itself, with powerful filters, statistics and per-category budgets.
4. The app gets more motion and simpler navigation.

## Decisions

| Topic | Decision |
|---|---|
| Backend | Keep n8n Data Tables and the existing workflows. Add new tables, columns and endpoints. No Postgres migration. |
| Partner's Android input | PWA quick-add sheet with merchant autocomplete. |
| Partner attribution | Same budget, no split by person, so no "added by" field. |
| Fawri UX | Keep the **current Telegram message design** and add inline buttons: the top 3 suggested merchants plus "✏️ Other…". No "why" text, no "Not spending" button. |
| Incoming money | Detected from the SMS ("received from IBAN…"). Not logged; the bot sends a short note instead. |
| Categories | Managed in the PWA and in Telegram (a "➕ New category" button in the picker). |
| Visual style | A · "Calm Ledger": light neutral base with a deep teal accent, a serif display face for big numbers, light and dark themes. |
| Navigation | C · top segmented tabs (Overview · Activity · Stats), a floating + button, and a menu for Budgets / Categories / Settings. |
| Priority features | Powerful filters, stats and trends, per-category budgets. Telegram budget alerts are out of scope. |
| Data cleanup | Approved, with a full backup first: dates to ISO, category typos fixed. |
| Security | Cloudflare Access already protects fa.11homelab.cc. Add a secret header between the app's nginx and n8n, require it on every FA webhook, and move the hard-coded Telegram bot token into a credential (rotate it). |

## 1. Data model (n8n Data Tables)

### New table `Categories`
| Column | Type | Notes |
|---|---|---|
| `Name` | string | Unique, display name. |
| `Color` | string | Hex. Seeded from `src/utils/categoryColors.ts`. |
| `Icon` | string | lucide icon name. Seeded from `src/utils/categoryIcons.tsx`. |
| `Budget` | number | Monthly limit in BHD; 0 = none. |
| `Order` | number | Order in the Telegram picker and app lists. |
| `Active` | boolean | Hidden from pickers when false. Past data is kept. |

The total monthly budget is stored as a row in a small `Settings` table (`Key`, `Value`), e.g. `total_budget = 600`.

### `transactions`: new columns
- `Payee_IBAN` (string): the IBAN ending from Fawri+ SMS. `0000` means unknown (paid to a phone number).
- `Source` (string): `sms` | `fawri` | `manual`. Backfill: `Name == 'Benefit'` or Fawri merchants → `fawri`; `Name == '-'` → `manual`; otherwise `sms`.

### One-time cleanup (after a backup to JSON in `C:\data\n8n\n8n_Api\backups\`)
- `Date` `DD/MM/YYYY` → `YYYY-MM-DD` (~955 rows). `Time` normalised to `HH:MM`.
- Categories: `Luandry`→`Laundry`, `Patrol`→`Petrol`, `other`→`Other`. The 8 `Fawri+` rows are reviewed manually with the user and re-categorised. The same renames are applied to `Cat-list`.
- Fix **Joseph – Finance Query** (`RIbvggdanZ2tzERx`, "Aggregate Spending" `monthKey`). It only parses `DD/MM/YYYY`, so today it ignores every ISO-dated row. Change it to accept both formats.

## 2. Telegram (FA - add transaction `I3EaJw8o1YNfkleN`)

All changes keep the existing message style (emoji, `<b>Label:</b>` lines, the Transaction ID line) and stay as fast as today.

### Parsing
- Extract the Fawri+ fields: amount, `IBAN ending NNNN` (tolerate the double space seen in some messages), date/time `YYYY/MM/DD HH:MM`, and the ref.
- Detect incoming money: `received from IBAN … to IBAN …` → don't insert. Send "💸 Incoming X BHD, not logged."
- Store `Payee_IBAN` and `Source` on insert.

### Merchant suggestions (pure function, unit-tested in the repo, then pasted into a Code node)
`suggestMerchants(history, { iban, amount, time }) → top 3 merchant names`
- Candidates: past `Source=fawri` transactions (with a fallback of `Name=='Benefit'`) that have a real merchant.
- Score per merchant:
  - same IBAN (if not `0000`): +10 per match
  - amount closeness: up to +3 (e.g. `3 * max(0, 1 - |Δ|/amount)`), using the best match
  - time-of-day closeness: up to +1
  - frequency over the last 90 days: up to +2
  - recency boost
- If fewer than 3 merchants have a score, fill the rest with the most frequent Fawri payees.

### Message and buttons
- The "Fawri Payment Detected!" message keeps its current layout and adds a `🏦 IBAN: ••NNNN` line. Its prompt reads "Pick the merchant, or tap Other to type it."
- The force-reply moves out of this message, because Telegram can't send a force-reply and an inline keyboard in the same message. The message gets an inline keyboard: 3 suggestion rows plus `✏️ Other…`.
  - Suggestion tap → `callback_data = fm|<SN>|<CatListId>` (stays under Telegram's 64-byte limit). The flow writes the merchant to the row and continues into the existing "Search in Cat-list" path, so a known merchant is categorised automatically and an unknown one gets the category picker.
  - `Other…` tap → sends today's force-reply message ("Please reply to this message with the merchant name"), so the existing reply handler keeps working unchanged.
- Router (`right callback OR msg authinticate` + `Switch`) gains the `fm|` and `other|` callback types next to the existing `cat_select|`.

### Category picker
- Built from the `Categories` table (`Active`, sorted by `Order`), keeping today's 2-per-row layout, plus a final row `➕ New category`.
- `➕ New category` → force-reply "Send the new category name". The reply inserts it into `Categories`, applies it to the pending SN, and saves the merchant to Cat-list as usual.

## 3. App API (new workflow "FA - App API")

All endpoints require the `X-FA-Key` header (an n8n Header Auth credential).

| Endpoint | Purpose |
|---|---|
| `GET fa/feed` | `{ transactions[], categories[], settings, merchants[] }`. Transactions are normalised (ISO date, `HH:MM`, number amount). `merchants` = Cat-list merchant → category, used for autocomplete. |
| `POST fa/transactions` | Manual add (replaces direct use of `manualAddTransaction`; reuses the insert, dedupe and Sheets append). `Source=manual`. |
| `PUT fa/transactions/:sn`, `DELETE fa/transactions/:sn` | Edit and delete (same logic as FA - Update Transaction). |
| `PUT fa/merchants` | `{ from, to?, category? }`: rename and/or re-categorise a merchant across **all** its transactions and Cat-list. Fixes the current FA - Merchant bugs. |
| `POST/PUT/DELETE fa/categories` | Create, update (rename cascades to transactions and Cat-list), reorder, deactivate. |
| `PUT fa/settings` | Total budget, etc. |

The existing webhooks stay live until the new app is deployed. They then require the secret too. The iPhone Shortcut is updated to send `X-FA-Key` to `addNewTransaction`.

### Proxy
The app calls the relative path `/api/fa/...`. The nginx in the `financial-app` container rewrites it to `https://n8n.11homelab.cc/webhook/fa/...` and adds `X-FA-Key` from an env var (`envsubst` template), so the secret never ships in the JS bundle and every API call passes through Cloudflare Access.

## 4. PWA

Same stack (Vite, React 18, TS, shadcn/Tailwind, TanStack Query). Additions:
- `framer-motion`, for transitions, sheets, count-up numbers and list animation.
- `vite-plugin-pwa`, so the app is properly installable on Android and Workbox caches the app shell.
- Removed: `Dashboard.tsx`, `mockData.ts`, the unused `useApi` hooks, `ApiDebugHelper`, and dead `api.ts` methods.

### Shell
- A header with the period pill (fiscal month 23rd–22nd, tap to change period) and a menu (Budgets, Categories, Settings, theme).
- Segments: **Overview · Activity · Stats**. Content slides horizontally between them, and you can swipe between segments.
- A floating **+** opens the Quick-add sheet from any screen.

### Overview
- Period card: spent / budget, a progress bar, daily pace, the recommended pace, a month-end forecast, and days left.
- Category budget bars, which turn amber at 75% and red at 90%. Tap a bar to jump to Activity filtered to that category.
- The latest 8 transactions.

### Activity
- A list grouped by day with daily subtotals.
- A sticky filter bar with:
  - search over merchant and tag
  - category chips (multi-select)
  - an amount range (min/max)
  - date presets (this period, last period, last 3 months, custom)
  - sort (newest, amount)
  - source (sms, fawri, manual)
- Saved filters are kept in localStorage.
- Tapping a row opens an edit sheet (all fields, plus delete with an in-sheet confirmation).

### Stats
- This period vs last, with a delta per category.
- 6-period trend: stacked bars or lines per category (Recharts, already a dependency).
- Top merchants by total and by count.
- A spending heatmap by weekday × week, plus averages (per day, per transaction).

### Budgets and Categories (from the menu)
- Budgets: the total plus a per-category monthly limit, edited inline.
- Categories: add, rename, change colour or icon, reorder, deactivate.

### Quick add
- Amount first (big display, numeric keypad, 3 decimals). Then the merchant, with autocomplete from merchants ranked by frequency; picking a known merchant fills its category. Category chips, and date/time defaulting to now.
- On success the sheet closes with a toast and the new row animates into the list.

### Freshness
- TanStack Query: `refetchInterval: 30s` while the page is visible, `refetchOnWindowFocus`, and pull-to-refresh on mobile.
- Rows that are new since the last fetch get a short highlight.
- Mutations update the screen immediately, then refetch.

### Design and motion skills
The user requires these for all UI work:
- **design-motion-principles** (github.com/kylezantos/design-motion-principles): Create mode while building, Audit mode before each deploy. The lens weighting is productivity/dashboard: Emil primary, Jakub secondary.
- **taste-skill** (github.com/Leonxlnx/taste-skill):
  - `redesign-existing-projects`: audit first, upgrade without breaking functionality
  - `minimalist-ui`: flat, typographic, no gradients or heavy shadows
  - `design-taste-frontend`: pre-flight check

The approved decisions take precedence over skill suggestions.

### Motion rules
- Spring physics for sheets. Content slides 200–250 ms between segments. Numbers count up when they change; bars fill on mount.
- Everything is disabled under `prefers-reduced-motion`.

## 5. Error handling
- Network errors: the last cached feed stays visible, with an inline "Offline, showing data from HH:MM" banner. Mutations show a retryable toast.
- In n8n, every webhook responds with JSON `{ success, error? }` and the right HTTP status (401 for a missing secret, 404 when not found).
- Telegram paths keep `alwaysOutputData` and fallbacks so a suggestion failure falls back to today's force-reply message.

## 6. Testing
- Vitest unit tests for:
  - the SMS parser (all observed formats, including the double space and the incoming-money format)
  - `suggestMerchants`
  - date normalisation
  - period, budget and stats maths
  - the filter logic
- n8n: run each modified workflow against recorded SMS samples (from execution history) before activating it, then check `/executions`.
- App: run locally against the live API, then deploy (`docker compose -f financial-composer.yaml up -d --build`) and confirm that fa.11homelab.cc serves the new build.

## 7. Build phases
1. **P1 Foundation:** backups, the `Categories` and `Settings` tables, the new columns, the cleanup migration, the Joseph date fix.
2. **P2 Telegram:** Fawri parsing, suggestions, incoming detection, a category picker driven by the table with ➕ New.
3. **P3 App API and security:** FA - App API, the secret header, the nginx proxy, the Shortcut update, rotating the bot token.
4. **P4 App redesign:** the shell, navigation, Overview, Activity and filters, Quick add, freshness, motion.
5. **P5 Stats and budgets:** the Stats screen, the Budgets and Categories managers, the final deploy and live check.

## Out of scope
Telegram budget alerts and weekly summaries, splitting spending by person, Postgres migration, offline write queue.
