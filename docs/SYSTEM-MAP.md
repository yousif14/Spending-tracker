# Finance App — System Map

Snapshot taken 2026-10-11 from the live n8n instance and this repo. Workflow and table IDs are stable; re-check row counts and node details before relying on them.

## 1. Big picture

```
Bank SMS (iPhone Shortcut) ──POST /webhook/addNewTransaction──┐
Telegram bot replies (Fawri merchant / category buttons) ─────┤
                                                              ▼
                                   n8n "FA - add transaction"  ──► Data Table: transactions
                                                              └──► Data Table: Cat-list (merchant → category memory)

React PWA (this repo)  ──fetch https://n8n.11homelab.cc/webhook/...──►  n8n "FA - Get" / "FA - Update Transaction" / "FA - Merchant" / "FA - add transaction"
```

- **Frontend:** Vite + React 18 + TS + shadcn/Tailwind + TanStack Query, originally from Lovable. Repo: `github.com/yousif14/Spending-tracker`.
- **Backend:** n8n at `https://n8n.11homelab.cc`. There's no server of its own: every API is an n8n webhook.
- **Database:** two **n8n Data Tables**, not Postgres. `init-scripts/01-init-financial-db.sql` is a leftover from an earlier design and nothing uses it.
- **Hosting:** `financial-composer.yaml` runs the `financial-app` container (nginx, host port 3002) plus `financial-app-tunnel` (Cloudflare tunnel) on the external docker network `n8n-net`. Redeploy with `docker compose -f financial-composer.yaml up -d --build` (`Build-Comand.ps1`).
- **Auth:** none. All webhooks are public. `VITE_N8N_API_KEY` is declared but never sent.
- **Timezone:** Asia/Bahrain. Currency: BHD (3 decimals).

## 2. Database (n8n Data Tables, project `rb6hVXbCTjBQVHmt`)

### `transactions`: id `wWtvo201WLTNBcqr` (~2,120 rows, 2025-06-14 → today)

| Column | Type | Notes |
|---|---|---|
| `SN` | number | Business key used everywhere. Generated as `YYYYMMDDHHMMSS` + 2–3 random digits (e.g. `2026101022482000`). |
| `Date` | string | **Mixed formats.** About 1,170 rows are `YYYY-MM-DD` (new); about 955 rows are `DD/MM/YYYY` (old Google Sheets import). The frontend's `convertDateFormat` normalises them. |
| `Time` | string | `HH:MM`, `HH:MM:SS`, or empty (~460 rows). |
| `Merchant` | string | Upper-cased by the SMS parser. Manual entries keep the user's casing. |
| `Amount` | number | Always BHD; foreign currency is converted on ingest with static rates. |
| `Currency` | string | Always `BHD` in practice. |
| `Category` | string | Free text, matched to Cat-list. Inconsistent case/spelling: `other`/`Other`, `Luandry`, `Patrol` (= petrol), `Fawri+`. |
| `Tag` | string | Mostly null/empty; trip tags such as `Korea`, `Qatar`. |
| `Name` | string | Cardholder from SMS (`YUSUF`, `FATEMA`), `Card`, `Benefit`, or `-` for manual entries. |
| `Card_ending` | string | Last 4 digits. |
| `id`, `createdAt`, `updatedAt` | system | n8n's internal row id, which the dedupe workflow uses. |

### `Cat-list`: id `IGDY61HhMcKpjvDT` (~960 rows)

`Merchant` (string), `Category` (string), `Color` (string, almost always null). This is the merchant → category memory. The ingest flow uses it to auto-categorise, and a new row is added when the user picks a category for an unknown merchant. The distinct `Category` values here are what the app treats as "the categories".

## 3. Webhook API (what the app calls)

All calls go to `https://n8n.11homelab.cc/webhook` plus the path below (`src/lib/api.ts`, `WEBHOOK_BASE_URL` is hardcoded). Webhooks with `:params` are addressed as `/<webhookId>/<path>`.

| App method | HTTP + URL | n8n workflow | Status |
|---|---|---|---|
| `getTransactions` | `GET /api/transactions` | FA - Get `aoVZmvgR3GRTC8kR` | ✅ Returns **all** rows as `{ $json: [...] }`. `from`/`to` are ignored, so the app filters client-side. |
| `getCategories` | `GET /api/categoriesHeads` | FA - Get | ✅ `{ categories: [...distinct Cat-list Category], count }` |
| (unused) | `GET /api/categories` | FA - Get | ✅ Returns all Cat-list rows. |
| `updateTransaction` | `PUT /update-transaction/api/update-transactions/:sn` | FA - Update Transaction `PAVfWilnR0E9msqA` | ✅ Body: lowercase keys `date,time,merchant,amount,currency,category,tag,name,cardEnding`. Merges onto the existing row. |
| `deleteTransaction` | `DELETE /delete-transaction/api/delete-transactions/:sn` | FA - Update Transaction | ✅ |
| `createManualTransaction` | `POST /manualAddTransaction` | FA - add transaction `I3EaJw8o1YNfkleN` | ✅ Requires `date,time,merchant,amount,category`. Also appends to Google Sheet "Spending Tracker/Logs" and runs dedupe. |
| `updateMerchantCategory` | `PUT /update-merchant/api/update-Merchant/:merchantName` | FA - Merchant `EGiQwEDvAKgHXebK` | ⚠️ Partial, see §5. |
| `deleteMerchant` | `DELETE /delete-transaction/api/delete-Merchant/:name` | — | ❌ No such webhook (404). Currently not called by any page. |
| `getTransactionStats` | `GET /api/transactions/stats` | — | ❌ Missing. The app falls back to client-side calculation. Only Dashboard uses it, and Dashboard isn't routed. |
| `getTransactionsByMonth`, `getSummary`, `createBudget`, `ingestSms`, `createTransaction` | `/api/transactions/month/*`, `/api/summary`, `/api/budget`, `/api/ingest-sms`, `POST /api/transactions` | — (some exist only in the **inactive** "API - Transactions (Array)" `Fpsq3CK9cFfaVBQc`) | ❌ Dead code paths (`useApi.ts` hooks). |

Note that the Docker nginx config proxies `/api/* → n8n /webhook/api/*`, but the app never uses it because it calls n8n directly.

## 4. n8n workflows in the finance system

| Workflow | ID | Active | Role |
|---|---|---|---|
| **FA - add transaction** | `I3EaJw8o1YNfkleN` | ✅ | Main ingest. See flow below. |
| **FA - Get** | `aoVZmvgR3GRTC8kR` | ✅ | Read APIs (transactions, categories). |
| **FA - Update Transaction** | `PAVfWilnR0E9msqA` | ✅ | Edit and delete by SN. |
| **FA - Merchant** | `EGiQwEDvAKgHXebK` | ✅ | Re-categorise a merchant. |
| **FA - Delete Duplicate Transactions** | `fKkEmIilkrKrAEx4` | ✅ | Sub-workflow called after every insert. Key = `MERCHANT\|Date\|HH:MM\|Amount(3dp)`; keeps the lowest `id`. |
| FA - Smart Search | `3g0xij49PpHLU31l` | ✅ | Telegram NL query → LLM intent (OpenRouter grok-4-fast) → filters/sums → reply. |
| FA - UpperCase | `KHftM2dLmhu5rq1j` | off | One-off maintenance: upper-case merchants in both tables. |
| API - Transactions (Array) | `Fpsq3CK9cFfaVBQc` | off | Legacy API (summary, POST transactions, sheets import). |
| Spending Tracker - Logs (Telegram → Google Sheets) | `FfjFWLUe74aVJSii` | off | Legacy, pre-Data-Table. |
| import data from google sheets | `6Z8ckXB0hzTel4Ii` | off | Source of the `DD/MM/YYYY` rows. |
| Joseph – Finance Query | `RIbvggdanZ2tzERx` | off | Joseph assistant's spending tool, which reads `transactions`. |
| Daily Backup / Daily n8n Backup to Google Drive | `IpQHCRNWXAbmmNVc` / `0JuiRnK7yuEZYyvj` | off / ✅ | Back up data tables. |

### Ingest flow (FA - add transaction)

1. `POST /webhook/addNewTransaction` with `{ msg: "<bank SMS text>" }` (from an iPhone Shortcut).
2. Message check: the text must contain `BHD`, `card`, or `IBAN ending`. Otherwise Telegram replies "🔴 Please check the copied msg".
3. **Parse (Code):** a regex pulls out date (`YYYY/MM/DD` or `on DD/MM`), time, `for XXX 12.345` amount and currency, `Dear NAME`, the merchant after `at …`, and the card's last 4. It also generates `SN`. `Fawri…` messages get merchant `FAWRI_PENDING`.
4. **Currency → BHD** using static rates (USD .377, SAR .1005, AED .102, …).
5. **Insert** the row (no category yet).
6. If it's Fawri, Telegram asks for the merchant name with a force-reply. The user's reply arrives at the Telegram trigger, which updates the `FAWRI_PENDING` row, then the flow continues.
7. **Cat-list lookup** with normalised merchant matching (strips `BH-123`, `BAHRAIN`, the `TALABAT*` prefix, and so on).
   - Found: the row's `Category` is set.
   - Not found: Telegram sends an inline keyboard of categories (`callback_data = cat_select|<Category>|<SN>`). The callback sets the category, adds the merchant to Cat-list, and updates the row.
8. Telegram sends "🟢 Logged Successfully", then the dedupe sub-workflow runs.

Telegram chat id is `1804897276`. The trigger node `combined-telegram-trigger` handles both `message` and `callback_query`.

## 5. Known issues and gotchas

1. **FA - Merchant only partly works.**
   - It ignores `name`, so renaming a merchant from the Merchants page silently does nothing.
   - It only updates transactions whose `Category` equals the merchant's *old* Cat-list category.
   - Cat-list lookup is an exact string match. Merchants missing from Cat-list (e.g. manual entries) return "Merchant not found".
2. **The whole table goes to the browser on every load** (~2.1k rows and growing). All filtering, stats, and budget maths run client-side.
3. **Mixed `Date` formats** in storage. Anything reading the table directly (n8n code, Joseph, SQL-like filters) must handle both `YYYY-MM-DD` and `DD/MM/YYYY`.
4. **Category hygiene:** `other` vs `Other`, the `Luandry` typo, `Patrol`, and `Fawri+` used as a category. Category colours come from `src/utils/categoryColors.ts`, not from Cat-list `Color`.
5. **No auth** on any webhook. Anyone with the URL can read, edit, or delete transactions.
6. **A Telegram bot token is hard-coded** in the URL of FA - add transaction's "Ask for Category" HTTP node. Move it to a credential and rotate it.
7. The Dedupe key ignores `Card_ending`, so two identical purchases in the same minute collapse into one.
8. Budget is hard-coded in the frontend: `DEFAULT_TOTAL_BUDGET = 600` in `Budget.tsx`, and a default of 750 in stats. The `budgets` concept doesn't exist in n8n.
9. Fiscal month runs from the 23rd to the 22nd (`src/utils/period.ts`, `getCurrentPeriodWindow`). The localStorage key is `txnRange:v1`.
10. `Dashboard.tsx` exists but has no route. The routes are `/`, `/transactions`, `/budget`, `/categories`, `/merchants`, and `/settings`.

## 6. Working with n8n

- API: `https://n8n.11homelab.cc/api/v1`, header `X-N8N-API-KEY`. The key is in `C:\data\n8n\n8n_Api\n8n_api.env` (never commit it). Cloudflare blocks Python's default user agent, so send a `User-Agent` header.
- Read table rows: `GET /data-tables/{id}/rows?limit=250&cursor=…` (URL-encode `sortBy`, e.g. `id%3Adesc`).
- Before editing a workflow, back it up (`GET /workflows/{id}` → `C:\data\n8n\n8n_Api\workflows\`). Then `PUT` only `{name, nodes, connections, settings}` and re-activate if needed.
- In Code nodes, use `$('Node').first()` rather than `.item`, because cross-node `.item` can hang the task runner.
