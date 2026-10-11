# Next session — Fc-update

## 1. Goal
Upgrade the FA spending system (n8n + Telegram + the PWA at fa.11homelab.cc):
- Fawri merchant suggestions
- categories managed from one place
- a secured API
- a redesigned, self-refreshing PWA with filters, stats and budgets

All of this keeps the fast iPhone Shortcut → Telegram flow, and the whole time we must be able to revert to the 2026-10-11 system. This session was **planning only**; the next sessions build it.

## 2. Done (nothing committed, nothing deployed, no system changes)
- Mapped the live system: `docs/SYSTEM-MAP.md`.
- Approved design: `docs/plans/2026-10-11-fa-upgrade-design.md`.
- Build plan, test-first, one phase per session:
  - `docs/plans/2026-10-11-fa-upgrade-plan.md` (index, key IDs, safety rules, design skills, **P0 tasks inline**)
  - `…-P1-foundation.md`, `…-P2-telegram.md`, `…-P3-api.md`, `…-P4-app.md`, `…-P5-stats.md`
- Visual review page (approved): https://claude.ai/artifact/WYCXZujQDdoZvPkg5RDAp6
- Memory notes: `finance-app-backend.md`, `fa-upgrade-plan.md`.
- All of these files are **uncommitted**, along with the user's earlier WIP (Budget/Merchants pages, period fixes, CodeGraph config).

## 3. Left to do (priority order)
1. **P0, from the plan index:**
   - 0.1 commit the current WIP on `main` after asking the user; 0.2 create branch `fa-upgrade`
   - 0.3 baseline: git tag `pre-fa-upgrade` + bundle, app image tag `finance-app-financial-app:pre-fa-upgrade` + `docker save`, config copies, all into `C:\Data\FA-baseline\2026-10-11\`
   - 0.4 build `n8n/scripts/n8n-client.mjs` (P1 Task 1 code) and `backup.mjs` (all workflows and tables); n8n volume tar (needs about a 1-minute n8n stop, **ask first**); checksums
   - 0.5 `restore.mjs` plus a **test restore** into a throwaway table (row count and Amount sum must match)
   - 0.6 `docs/ROLLBACK.md` + `docs/plans/backup-log.md`
2. **P1** foundation: Categories/Settings tables, `Payee_IBAN`/`Source` columns, migrate the ~955 `DD/MM/YYYY` dates to ISO, fix category typos, review the 8 "Fawri+" rows with the user, fix the Joseph Finance Query date bug.
3. **P2** Telegram, **P3** App API + security, **P4** app shell (installs the design skills first), **P5** Stats/Budgets/Categories + final deploy.

## 4. Decisions and preferences (don't re-ask)
- **Backend:** keep n8n Data Tables (no Postgres/Supabase).
- **Style:** A · **Calm Ledger** (light neutral base + deep teal `#0F7B62`, Fraunces display + Manrope), light and dark.
- **Navigation:** C · **top segments (Overview · Activity · Stats) + floating +**; a menu for Budgets/Categories/Settings.
- **Telegram:** keep the **current message design exactly**; add the top 3 Fawri merchant suggestions as buttons + "✏️ Other…" (which sends today's force-reply).
  - No "why" reasons under the buttons, no "Not spending" button.
  - Incoming money ("received from IBAN") is auto-detected and not logged.
- **Categories:** managed in the PWA **and** Telegram (➕ New category in the picker).
- **Partner (Android):** PWA quick-add. Same budget, no per-person split.
- **Priority features:** powerful filters, stats & trends, per-category budgets. Telegram budget alerts are out of scope.
- **Data cleanup:** approved, with a backup first.
- **Security:** Cloudflare Access already protects fa.11homelab.cc. Add the `X-FA-Key` header via nginx; move the hard-coded Telegram bot token to `$env`.
- **Must use** for all UI/motion work:
  - https://github.com/kylezantos/design-motion-principles (Create mode while building, Audit mode before deploys; Emil primary, Jakub secondary)
  - https://github.com/Leonxlnx/taste-skill (redesign-existing-projects, minimalist-ui, design-taste-frontend)
  - The approved decisions override skill suggestions.
- **Must** keep a full baseline backup and be able to revert at any point. Never delete the baseline. Don't start P1 until the test restore passes.
- **User preferences:** often on a phone; ask with tappable AskUserQuestion options; show visual choices as A/B/C in one artifact; deploy and verify live after app changes.

## 5. Open questions (waiting on the user)
- OK to commit the current WIP + plan docs on `main` before branching (P0 Task 0.1)?
- OK to stop n8n for about 1 minute for the volume backup (P0 Task 0.4)?
- Push the `pre-fa-upgrade` tag to GitHub?
- The user needs to duplicate the iPhone Shortcut as "FA SMS (original)" (P0 Task 0.3).
- Later: the n8n restart for the env token (P2), rotating the bot token, and adding `X-FA-Key` to the Shortcut (P3).

## 6. Gotchas
- **n8n:**
  - API `https://n8n.11homelab.cc/api/v1`, header `X-N8N-API-KEY`, key file `C:\data\n8n\n8n_Api\n8n_api.env` (never print it).
  - Cloudflare 403s Python's default user agent, so send a `User-Agent` header. URL-encode `sortBy` (`id%3Adesc`).
  - n8n **2.29.8**, SQLite in Docker volume `n8n_n8n_data`, compose `C:\Data\n8n\docker-compose.yaml`. `$env` is blocked in nodes by default.
- **Tables:** `transactions` `wWtvo201WLTNBcqr` (~2,120 rows, mixed date formats), `Cat-list` `IGDY61HhMcKpjvDT` (~960), project `rb6hVXbCTjBQVHmt`.
- **Workflows:** FA - add transaction `I3EaJw8o1YNfkleN` (SMS + Telegram + manual add), FA - Get `aoVZmvgR3GRTC8kR`, FA - Update Transaction `PAVfWilnR0E9msqA`, FA - Merchant `EGiQwEDvAKgHXebK`, Dedupe `fKkEmIilkrKrAEx4`, Joseph Finance Query `RIbvggdanZ2tzERx` (source in `C:\data\Joseph\build\finance.code.js`).
- **Workflow edits:** PUT only `{name,nodes,connections,settings}` with whitelisted settings. In Code nodes use `$('Node').first()`, never `.item`.
- **App:** container `financial-app` (port 3002) + `financial-app-tunnel`. The real hostname is **fa.11homelab.cc** (fc.11homelab.cc doesn't exist). Deploy: `docker compose -f financial-composer.yaml up -d --build`.
- **Tests:** `npx vitest run` (79 passing at handoff).
- **Known bug:** Joseph's spending tool ignores every ISO-dated row (fixed in P1 Task 6).
- **Leaked token:** the Telegram bot token is hard-coded in the "Ask for Category" HTTP node URL.
- **Telegram tests** create real rows and messages. Tell the user first, and delete test rows by SN afterwards.

## 7. Next-session prompt
```
Fc-update: start building the FA upgrade. Read docs/NEXT-SESSION.md, then docs/plans/2026-10-11-fa-upgrade-plan.md, and run Phase P0 (setup + full baseline backup + restore tool + test restore + docs/ROLLBACK.md) using superpowers:executing-plans. Ask me before committing, before stopping n8n, and before pushing anything. Don't start P1 until the test restore has passed and I've confirmed.
```
