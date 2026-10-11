# Next session — Fc-update

## 1. Goal
Upgrade the FA spending system (n8n + Telegram + the PWA at fa.11homelab.cc) in phases P0–P5. P0 (safety net), **P1 (foundation) and P2 (Telegram) are done**. The next session runs **P3, API + security** (`docs/plans/2026-10-11-fa-upgrade-P3-api.md`).

## 2. Done (P1 data changes and P2 Telegram flow are live in n8n; the PWA is unchanged and not redeployed)
- **Commits on `main`:** `0bdd1dd` WIP (budget analytics, merchants page, period fixes, codegraph config, plan docs).
- **Commits on branch `fa-upgrade`** (checked out, not pushed):
  - `8ec7cab` n8n tooling folder + `.gitignore` `n8n/.out/`
  - `2dd884c` `n8n/scripts/n8n-client.mjs`, `backup.mjs` (ALL workflows + tables, writes `summary.json`), `restore.mjs` (dry run by default, `--apply`, `--into new` drill, verifies count + sum + full row contents)
  - `b0823ee` `docs/ROLLBACK.md` + `docs/plans/backup-log.md`
- **Baseline** `C:\Data\FA-baseline\2026-10-11\`:
  - git bundle and tag `pre-fa-upgrade` (= `0bdd1dd`, **pushed to GitHub**)
  - app image `finance-app-financial-app:pre-fa-upgrade` + its tar
  - config copies
  - n8n logical backup `n8n-logical\2026-10-11T11-35-56` (103 workflows, 9 tables; transactions 2,122 rows, Amount sum 29961.514; Cat-list 961)
  - n8n volume tar (556 MB)
  - `SHA256SUMS.txt` (122 files, all verified)
- **Restore drill passed**, including the delete + re-insert path. The drill table was deleted and live data is untouched.
- The user duplicated the iPhone Shortcut as "FA SMS (original)".

- **P1 (2026-10-11), commits `c8761e9`, `ba9f65d`, `493674b` on `fa-upgrade` (not pushed):**
  - `n8n/code/normalize.js` + 16 tests (suite 95 passing)
  - tables `Categories` `P1PIMlK712Jbj1Mz` (20 seeded) and `Settings` `Sh3QPvjfSEqmCi9a` (`total_budget`=600); columns `Payee_IBAN`, `Source` on transactions
  - migration applied: all 2,122 Dates ISO, Times HH:MM (461 Fawri rows have no time), typos fixed, Source backfilled (sms 1359 / fawri 678 / manual 85), sum unchanged 29961.514
  - Fawri+ fixed per user: Salim → Services, all other payees → Other (also Cat-list STC PAY / IBANENDING → Other)
  - Joseph Finance Query `monthKey` accepts ISO; deployed but **left inactive by user's choice** (inactive since May; its webhook is unauthenticated, activate in P3 with the key)
  - P1 end backup `C:\data\n8n\n8n_Api\backups\2026-10-11T12-42-50`

- **P2 (2026-10-11), commits `2b2f459`, `3497d37` on `fa-upgrade` (not pushed). LIVE in n8n:**
  - `n8n/code/sms-parser.js` + `suggest.js` (tests: suite 107 passing); back-test baseline top-3 hit 30.3% (no IBAN history yet)
  - "FA - add transaction" patched by `n8n/workflows/p2-add-transaction.mjs` (idempotent; re-run with `--apply` after editing `n8n/code/*`): 78 nodes, incoming-money note, Payee_IBAN/Source stored, Fawri suggestion buttons + ✏️ Other…, picker from `Categories` + ➕ New category
  - bot token moved to `C:\Data\n8n\.env` `FA_TG_BOT_TOKEN` + `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` in compose; n8n restarted (~10 s down)
  - live tests (a)–(e) all passed with the user; one bug found and fixed (new-category lookup). Test rows/categories deleted; data back to 2,122 / 29961.514
  - P2 end backup `C:\data\n8n\n8n_Api\backups\2026-10-11T13-02-24`

## 3. Left to do (priority order)
1. **P3 API + security** (`docs/plans/2026-10-11-fa-upgrade-P3-api.md`), after the user's go-ahead.
   - Start with `node n8n/scripts/backup.mjs` and a "P3 start" row in `docs/plans/backup-log.md`.
   - Includes the `X-FA-Key` check (nginx adds the header for the PWA; the iPhone Shortcut needs it too: ask before touching the Shortcut).
   - Once Joseph Finance Query's webhook is protected, ask whether to activate `RIbvggdanZ2tzERx` (Joseph's `Query Spending` tool must then send the key too).
   - End with a backup and a "P3 end, rollback point" row.
2. **Later phases:** P4 app shell, P5 Stats/Budgets/Categories + deploy. One phase per session.
3. **Small follow-ups:**
   - Rotate the FA bot token when the user wants: BotFather `/revoke` → user puts the new token in `C:\Data\n8n\.env` (`FA_TG_BOT_TOKEN`) and the n8n "Spending Tracker" Telegram credential → `docker compose -f C:/Data/n8n/docker-compose.yaml up -d n8n`.
   - Manual PWA adds (`/manualAddTransaction`, "insert Manual Transaction") don't set `Source: manual` yet; add it in P3 or P4.
   - Commit `docs/NEXT-SESSION.md` only if the user asks.

## 4. Decisions and preferences (don't re-ask)
- **Approved during P0:**
  - committing the WIP on main
  - stopping n8n for the volume backup
  - pushing the baseline tag
  - (the user already duplicated the Shortcut)
- **Backend:** keep n8n Data Tables (no Postgres).
- **Style:** Calm Ledger (teal `#0F7B62`, Fraunces + Manrope), light + dark.
- **Navigation:** top segments (Overview · Activity · Stats) + floating +, with a menu for Budgets/Categories/Settings.
- **Telegram:** keep the current message design exactly.
  - Add the top 3 Fawri suggestion buttons + "✏️ Other…".
  - No reason text, no "Not spending" button.
  - Incoming money is auto-detected and not logged.
- **Categories:** managed in the PWA **and** Telegram (➕ New).
- **Partner:** uses PWA quick-add, same budget, no split.
- **Out of scope:** budget alerts in Telegram.
- **Security:** the site sits behind Cloudflare Access. Add the `X-FA-Key` header via nginx. Bot token moved to `$env` in P2 (approved n8n restart); rotation declined "for now".
- **P1/P2 choices:** Fawri+ rows → Salim = Services, others = Other; Joseph Finance Query stays **off** until P3 protects it; new categories added from Telegram get Order 999 and grey colour.
- **UI/motion work must use** kylezantos/design-motion-principles and Leonxlnx/taste-skill. The approved decisions override them.
- **Baseline:** never delete it. Back up before any write. Roll back a phase if a fix isn't obvious within a few minutes.
- **User preferences:**
  - often on a phone; ask with tappable AskUserQuestion options
  - show visual choices as A/B/C in one artifact
  - deploy and verify live after app changes

## 5. Open questions (waiting on the user)
- Go-ahead to start P3.
- P3: activate Joseph Finance Query once the webhook is protected (user chose to keep it off until then).
- P3: adding `X-FA-Key` to the iPhone Shortcut.
- Rotate the FA bot token sometime (user said "not now"); old workflow versions in n8n history still contain it.
- The user should delete the P2 test lines from the Google Sheet "Spending Tracker/Logs" (CENTER POINT 5.02, ALTAWA 6.7 + 2.3, Tea 1.25, Test cat 0.75, all 2026-10-11).

## 6. Gotchas
- **Git:** there's no global identity on this PC. A repo-local `user.name yousif14` / `user.email` is set, so commits work. `.claude/settings.local.json` stays uncommitted.
- **Bash on Windows:**
  - Prefix `docker run -v C:/...` with `MSYS_NO_PATHCONV=1`.
  - `tar` on `C:/...` paths fails ("resolve failed"), so `cd` into the folder first.
- **n8n health:**
  - Public `https://n8n.11homelab.cc/healthz` returns **302** (Cloudflare).
  - Check with `docker exec n8n wget -qO- http://localhost:5678/healthz` or an API call instead.
- **n8n API:**
  - Base `https://n8n.11homelab.cc/api/v1`, header `X-N8N-API-KEY`.
  - Key file `C:\data\n8n\n8n_Api\n8n_api.env` (never print it).
  - The client sends `User-Agent: fa-tools/1.0`. `listAll()` follows `nextCursor`.
- **API key "PA"** now has full scopes (user added them in P1; columns endpoint used to 403).
- **Restore tool:** deleting rows with the filter `id gt 0` works. Restored rows get new `id`s.
- **n8n setup:**
  - n8n 2.29.8, container `n8n`, volume `n8n_n8n_data` (only n8n uses it)
  - compose file `C:\Data\n8n\docker-compose.yaml`
  - `$env` is now allowed in nodes (`N8N_BLOCK_ENV_ACCESS_IN_NODE=false`, P2)
  - Inside n8n **expressions**, `$('Node')` on a node that did not run does NOT throw, so try/catch fallbacks never fire; use `$json.x ?? $('Other').first().json.x`. In Code nodes it does throw.
- **Tables:**
  - `transactions` `wWtvo201WLTNBcqr` (2,122 rows, all ISO dates since P1, SN values like 2026101022482000)
  - `Cat-list` `IGDY61HhMcKpjvDT` (961)
  - project `rb6hVXbCTjBQVHmt`
  - `Categories` `P1PIMlK712Jbj1Mz` (20), `Settings` `Sh3QPvjfSEqmCi9a`
  - Old empty tables left alone: `Budgets` `Oo6RmW6CRfieXmIY`, `Cat` `i35wjrTcSdMTpal7`
- **Workflows:**
  - FA - add transaction `I3EaJw8o1YNfkleN` (78 nodes since P2, active)
  - FA - Get `aoVZmvgR3GRTC8kR`
  - FA - Update `PAVfWilnR0E9msqA`
  - FA - Merchant `EGiQwEDvAKgHXebK`
  - Dedupe `fKkEmIilkrKrAEx4`
  - Joseph Finance Query `RIbvggdanZ2tzERx` (inactive; code fixed for ISO in P1)
- **Workflow edits:** PUT only `{name,nodes,connections,settings}`. In Code nodes, never use `$('Node').item`.
- **App:**
  - container `financial-app` (port 3002), hostname **fa.11homelab.cc**
  - deploy: `docker compose -f financial-composer.yaml up -d --build`
- **Tests:** `npx vitest run` (107 passing).
- **Telegram tests** create real rows and messages, and also append to the Google Sheet log (can't be cleaned by API). Tell the user first, and delete test rows by SN afterwards. Verify what the user actually tapped from the executions list, not just their answer.

## 7. Next-session prompt
```
Fc-update: P0, P1 and P2 are done. Read docs/NEXT-SESSION.md, then docs/plans/2026-10-11-fa-upgrade-plan.md and docs/plans/2026-10-11-fa-upgrade-P3-api.md, and run Phase P3 on branch fa-upgrade using superpowers:executing-plans. Take a fresh backup first, ask me before changing the iPhone Shortcut or activating Joseph Finance Query, and ask before pushing anything.
```
