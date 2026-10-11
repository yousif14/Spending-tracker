# Finance App — System Map

Snapshot taken 2026-10-11 from the live n8n instance and this repo. Workflow and table IDs are stable; re-check row counts and node details before relying on them.

## 1. Big picture

```
Bank SMS (iPhone Shortcut) ──POST /webhook/addNewTransaction──┐
Telegram bot replies (Fawri merchant / category buttons) ─────┤
                                                              ▼
                                   n8n "FA - add transaction"  ──► Data Table: transactions
                                                              └──► Data Table: Cat-list (merchant → category memory)

React PWA (this repo) ──/api/fa/*──► nginx (adds X-FA-Key) ──/webhook/fa/*──► n8n "FA - App API" ──► the same Data Tables
```

- **Frontend:** Vite + React 18 + TS + shadcn/Tailwind + TanStack Query, originally from Lovable. Repo: `github.com/yousif14/Spending-tracker`.
- **Backend:** n8n at `https://n8n.11homelab.cc`. There's no server of its own: every API is an n8n webhook.
- **Database:** two **n8n Data Tables**, not Postgres. `init-scripts/01-init-financial-db.sql` is a leftover from an earlier design and nothing uses it.
- **Hosting:** `financial-composer.yaml` runs the `financial-app` container (nginx, host port 3002) plus `financial-app-tunnel` (Cloudflare tunnel) on the external docker network `n8n-net`. Redeploy with `docker compose -f financial-composer.yaml up -d --build` (`Build-Comand.ps1`).
- **Auth (since P3):** the new App API (`/webhook/fa/*`) and the iPhone webhook `addNewTransaction` require header `X-FA-Key` (n8n credential "FA App Key" `xlromAeekU2zUicJ`; value `FA_API_KEY` in `.env`/`.env.local`, never committed). The app's nginx adds it for `/api/fa/*`. Since P5 the old app webhooks are off and `manualAddTransaction` needs the key too; the only open path is the Telegram callback (Telegram can't send headers).
- **Timezone:** Asia/Bahrain. Currency: BHD (3 decimals).

## 2. Database (n8n Data Tables, project `rb6hVXbCTjBQVHmt`)

### `transactions`: id `wWtvo201WLTNBcqr` (~2,120 rows, 2025-06-14 → today)

| Column | Type | Notes |
|---|---|---|
| `SN` | number | Business key used everywhere. Generated as `YYYYMMDDHHMMSS` + 2–3 random digits (e.g. `2026101022482000`). |
| `Date` | string | `YYYY-MM-DD` for every row since the P1 migration (2026-10-11). The old `DD/MM/YYYY` rows came from the Google Sheets import. |
| `Time` | string | `HH:MM`, or empty (~460 old Fawri rows). |
| `Merchant` | string | Upper-cased by the SMS parser. Manual entries keep the user's casing. |
| `Amount` | number | Always BHD; foreign currency is converted on ingest with static rates. |
| `Currency` | string | Always `BHD` in practice. |
| `Category` | string | Free text, matched to Cat-list; names come from the `Categories` table. Typos (`Luandry`, `Patrol`, `other`, `Fawri+`) were cleaned in P1. |
| `Tag` | string | Mostly null/empty; trip tags such as `Korea`, `Qatar`. |
| `Name` | string | Cardholder from SMS (`YUSUF`, `FATEMA`), `Card`, `Benefit`, or `-` for manual entries. |
| `Card_ending` | string | Last 4 digits. |
| `Payee_IBAN` | string | Fawri+ only: last 4 of the payee IBAN (`0000` = paid by phone number). Drives merchant suggestions. Added P1, filled from P2. |
| `Source` | string | `sms`, `fawri` or `manual`. Backfilled in P1; set on ingest from P2. |
| `id`, `createdAt`, `updatedAt` | system | n8n's internal row id, which the dedupe workflow uses. |

### `Cat-list`: id `IGDY61HhMcKpjvDT` (~960 rows)

`Merchant` (string), `Category` (string), `Color` (string, almost always null). This is the merchant → category memory. The ingest flow uses it to auto-categorise, and a new row is added when the user picks a category for an unknown merchant. The distinct `Category` values here are what the app treats as "the categories" (until P4/P5 move the app to `Categories`).

### `Categories`: id `P1PIMlK712Jbj1Mz` (20 rows, created P1)

`Name`, `Color`, `Icon` (lucide name), `Budget`, `Order`, `Active`. The Telegram category picker is built from the active rows, sorted by `Order`; ➕ New category adds a row (Order 999).

### `Settings`: id `Sh3QPvjfSEqmCi9a` (created P1)

`Key`, `Value`. Holds `total_budget` = 600.

## 3. Webhook API (what the app calls)

The app (v2.0.0, `src/pages/fa/*`) uses only the App API below. The pre-upgrade webhooks were retired in P5 (`n8n/workflows/p5-lock-legacy.mjs`; `--undo` brings them back):

| Old path | Workflow | Now |
|---|---|---|
| `GET /api/transactions`, `/api/categoriesHeads`, `/api/categories` | FA - Get `aoVZmvgR3GRTC8kR` | deactivated (404) |
| `PUT/DELETE /update-transaction/…`, `/delete-transaction/…` | FA - Update Transaction `PAVfWilnR0E9msqA` | deactivated |
| `PUT /update-merchant/…` | FA - Merchant `EGiQwEDvAKgHXebK` | deactivated |
| `POST /manualAddTransaction` | FA - add transaction `I3EaJw8o1YNfkleN` | needs `X-FA-Key` (403 without) |

### App API (P3) — workflow "FA - App API" `IEW0HesCX5GkbAFt`, built by `n8n/workflows/fa-app-api.build.mjs`

The app calls these as `/api/fa/<path>`; nginx (`nginx/default.conf.template`, or the Vite dev proxy) rewrites to `/webhook/fa/<path>` and adds `X-FA-Key`. Without the key n8n returns 403.

| Path | Method | Body | Returns |
|---|---|---|---|
| `fa/feed` | GET | – | `{ success, generatedAt, transactions[], categories[], merchants[], settings{} }` (mapping in `n8n/code/feed.js`) |
| `fa/tx-add` | POST | `{ date, time, merchant, amount, category, tag? }` | `{ success, SN }`; 400 on bad input; stores `Source: manual`, runs dedupe, **no** Google Sheet log |
| `fa/tx-update` | POST | `{ sn, date?, time?, merchant?, amount?, category?, tag? }` | `{ success }`; 404 if SN unknown |
| `fa/tx-delete` | POST | `{ sn }` | `{ success }` |
| `fa/merchant` | POST | `{ from, to?, category? }` | `{ success, updated }` (all transactions + Cat-list upsert) |
| `fa/categories` | POST | `{ items: [{ id?, Name, Color?, Icon?, Budget?, Order?, Active? }], rename?: { from, to } }` | `{ success }`. Upsert by `Name` writes **every** column, so send the full row (the app does). `rename` updates transactions, Cat-list and the Categories row. |
| `fa/category-delete` | POST | `{ name }` | `{ success, moved }`: its transactions and Cat-list rows move to `Other`, the row is deleted, and Joseph sends the moved list on Telegram. `Other` itself is refused (400). |
| `fa/settings` | POST | `{ key, value }` | `{ success }` (e.g. `total_budget`) |



## 4. n8n workflows in the finance system

| Workflow | ID | Active | Role |
|---|---|---|---|
| **FA - add transaction** | `I3EaJw8o1YNfkleN` | ✅ | Main ingest. See flow below. |
| **FA - App API** | `IEW0HesCX5GkbAFt` | ✅ | Everything the app calls (`fa/*`, key required). |
| FA - Get | `aoVZmvgR3GRTC8kR` | off (P5) | Old read APIs. |
| FA - Update Transaction | `PAVfWilnR0E9msqA` | off (P5) | Old edit/delete by SN. |
| FA - Merchant | `EGiQwEDvAKgHXebK` | off (P5) | Old merchant re-categorise. |
| **FA - Delete Duplicate Transactions** | `fKkEmIilkrKrAEx4` | ✅ | Sub-workflow called after every insert. Key = `MERCHANT\|Date\|HH:MM\|Amount(3dp)`; keeps the lowest `id`. |
| FA - Smart Search | `3g0xij49PpHLU31l` | ✅ | Telegram NL query → LLM intent (OpenRouter grok-4-fast) → filters/sums → reply. |
| FA - UpperCase | `KHftM2dLmhu5rq1j` | off | One-off maintenance: upper-case merchants in both tables. |
| API - Transactions (Array) | `Fpsq3CK9cFfaVBQc` | off | Legacy API (summary, POST transactions, sheets import). |
| Spending Tracker - Logs (Telegram → Google Sheets) | `FfjFWLUe74aVJSii` | off | Legacy, pre-Data-Table. |
| import data from google sheets | `6Z8ckXB0hzTel4Ii` | off | Source of the `DD/MM/YYYY` rows. |
| Joseph – Finance Query | `RIbvggdanZ2tzERx` | ✅ | Joseph's spending tool (key required), reads `transactions`. Joseph runs on Claude Haiku 5.5. |
| Daily Backup / Daily n8n Backup to Google Drive | `IpQHCRNWXAbmmNVc` / `0JuiRnK7yuEZYyvj` | off / ✅ | Back up data tables. |

### Ingest flow (FA - add transaction)

1. `POST /webhook/addNewTransaction` with `{ msg: "<bank SMS text>" }` (from an iPhone Shortcut).
2. Message check: the text must contain `BHD`, `card`, or `IBAN ending`. Otherwise Telegram replies "🔴 Please check the copied msg".
3. **Parse (Code):** generated from `n8n/code/sms-parser.js` (edit there, then re-run `n8n/workflows/p2-add-transaction.mjs`). Pulls out date, time, amount and currency, `Dear NAME`, the merchant after `at …`, the card's last 4, and for Fawri+ the payee IBAN last 4. It also generates `SN`. `Fawri…` messages get merchant `FAWRI_PENDING`.
   - **Is Incoming?** Fawri+ "received from IBAN" messages only get a "💸 Incoming payment … Not logged" note; no row is stored.
4. **Currency → BHD** using static rates (USD .377, SAR .1005, AED .102, …).
5. **Insert** the row (no category yet), including `Payee_IBAN` and `Source`.
6. If it's Fawri: load Fawri history + Cat-list → **Suggest Merchants** (`n8n/code/suggest.js`: same IBAN first, then amount, time of day, recency) → the "Fawri Payment Detected!" message with an IBAN line and up to 3 merchant buttons (`fm|<SN>|<Cat-list id>`) plus `✏️ Other…` (`fo|<SN>`).
   - A pick writes the merchant by SN and continues at step 7.
   - Other… sends the old force-reply prompt. A reply carrying `Transaction ID:` sets that SN; a plain message with no reply falls back to the first `FAWRI_PENDING` row (pre-P2 behaviour).
7. **Cat-list lookup** with normalised merchant matching (strips `BH-123`, `BAHRAIN`, the `TALABAT*` prefix, and so on).
   - Found: the row's `Category` is set.
   - Not found: Telegram sends an inline keyboard built from `Categories` (`cat_select|<Category>|<SN>`) plus `➕ New category` (`cat_new|<SN>`). A pick sets the category, adds the merchant to Cat-list, and updates the row. New category asks for a name by force-reply, upserts it into `Categories`, then continues like a pick.
   - Router: "right callback OR msg authinticate" sets `msg` to `categoryInput`, `fawriPick`, `fawriOther`, `catNew`, `newCategoryName` or `MerchantInput`; `Switch` has one output per kind (the old `If` gate is disconnected).
8. Telegram sends "🟢 Logged Successfully", then the dedupe sub-workflow runs.

Telegram chat id is `1804897276`. The trigger node `combined-telegram-trigger` handles both `message` and `callback_query`.

## 5. Known issues and gotchas

1. **The whole table goes to the browser** in one `fa/feed` call (~2.1k rows and growing, refreshed every 30 s). All filtering and stats run client-side; fine for years at this rate.
2. **Tokens to rotate:** the FA bot token is in old n8n workflow versions (now read from `FA_TG_BOT_TOKEN` in `C:\Data\n8n\.env`), and `CLOUDFLARE_TUNNEL_TOKEN` is in the public repo's history (`.env` was tracked until P3).
3. The Telegram callback path stays open (Telegram can't send a header); it only acts on SNs and buttons the bot sent.
4. The dedupe key ignores `Card_ending`, so two identical purchases in the same minute collapse into one.
5. Fiscal month runs from the 23rd to the 22nd (`src/utils/period.ts`). The app keeps the chosen period in localStorage `fa:period:v2` and the view in `fa:theme-mode`.
6. Categories are always shown A–Z (app and Telegram); the `Order` column is kept but unused. Category icons come from `Categories.Icon` (lucide name) and fall back to a name map in `src/utils/categoryIcons.tsx`.

## 6. Working with n8n

- API: `https://n8n.11homelab.cc/api/v1`, header `X-N8N-API-KEY`. The key is in `C:\data\n8n\n8n_Api\n8n_api.env` (never commit it). Cloudflare blocks Python's default user agent, so send a `User-Agent` header.
- Read table rows: `GET /data-tables/{id}/rows?limit=250&cursor=…` (URL-encode `sortBy`, e.g. `id%3Adesc`).
- Before editing a workflow, back it up (`GET /workflows/{id}` → `C:\data\n8n\n8n_Api\workflows\`). Then `PUT` only `{name, nodes, connections, settings}` and re-activate if needed.
- In Code nodes, use `$('Node').first()` rather than `.item`, because cross-node `.item` can hang the task runner.
