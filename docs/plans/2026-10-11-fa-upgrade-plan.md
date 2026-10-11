# FA Upgrade Implementation Plan (index)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Run **one phase per session**, in order. Each phase ends live and verified.

**Goal:** Make the FA spending system smarter while keeping its fast iPhone→Telegram flow. That means Fawri merchant suggestions, categories managed from one place, a secured API, and a redesigned self-refreshing PWA with filters, stats and budgets.

**Architecture:** n8n Data Tables stay the database. Pure logic (SMS parsing, merchant suggestion, normalisation) lives in `n8n/code/*.js` in this repo, is unit-tested with vitest, and is inlined into n8n Code nodes by a script. A new "FA - App API" workflow serves the PWA through the app container's nginx, which adds a secret header. The PWA keeps Vite/React/shadcn/TanStack Query and adds framer-motion and vite-plugin-pwa.

**Tech Stack:** n8n 1.x public API (data-tables, workflows, credentials), Node 18+ scripts (`.mjs`, built-in `fetch`), React 18 + TS, TanStack Query 5, Recharts 2, framer-motion 11, vite-plugin-pwa 0.20, Vitest 3.

**Design:** `docs/plans/2026-10-11-fa-upgrade-design.md` · **System map:** `docs/SYSTEM-MAP.md` · **Visual review:** https://claude.ai/artifact/WYCXZujQDdoZvPkg5RDAp6

---

## Phases

| Phase | File | Ends with |
|---|---|---|
| P0 Setup + safety net | this file, below | WIP committed, branch created, **full baseline backup (code, app image, config, all n8n workflows/tables, whole n8n volume)**, restore tool built and **test restore passed**, `docs/ROLLBACK.md` written |
| P1 Foundation | `2026-10-11-fa-upgrade-P1-foundation.md` | Backups, Categories/Settings tables, new columns, data cleaned, Joseph fixed |
| P2 Telegram | `2026-10-11-fa-upgrade-P2-telegram.md` | Fawri suggestions, incoming detection, table-driven picker with ➕ New, bot token out of the workflow |
| P3 API + security | `2026-10-11-fa-upgrade-P3-api.md` | FA - App API live behind `X-FA-Key`, nginx proxy, Shortcut updated |
| P4 App shell | `2026-10-11-fa-upgrade-P4-app.md` | New shell, Overview, Activity + filters, Quick add, auto-refresh, motion; deployed |
| P5 Stats + budgets | `2026-10-11-fa-upgrade-P5-stats.md` | Stats, Budgets, Categories manager; old webhooks locked; deployed and verified |

## Key IDs (verify with a GET before relying on them)

| Thing | ID |
|---|---|
| Table `transactions` | `wWtvo201WLTNBcqr` |
| Table `Cat-list` | `IGDY61HhMcKpjvDT` |
| Table `Categories` | `P1PIMlK712Jbj1Mz` (created P1) |
| Table `Settings` | `Sh3QPvjfSEqmCi9a` (created P1, `total_budget`=600) |
| n8n project | `rb6hVXbCTjBQVHmt` |
| FA - add transaction | `I3EaJw8o1YNfkleN` |
| FA - Get | `aoVZmvgR3GRTC8kR` |
| FA - Update Transaction | `PAVfWilnR0E9msqA` |
| FA - Merchant | `EGiQwEDvAKgHXebK` |
| FA - Delete Duplicate Transactions | `fKkEmIilkrKrAEx4` |
| Joseph – Finance Query | `RIbvggdanZ2tzERx` (source in `C:\data\Joseph\build\finance.code.js`) |
| Telegram owner chat | `1804897276` |
| App URL | https://fa.11homelab.cc (Cloudflare Access), container `financial-app`, host port 3002 |
| n8n API | `https://n8n.11homelab.cc/api/v1`, header `X-N8N-API-KEY`, key file `C:\data\n8n\n8n_Api\n8n_api.env` (single line) |

## Design skills (P4 and P5)

The user asked for these two repos to be used for all UI and motion work. P4 Task 0 installs them into the project.

| Skill (install name) | Source | Use it for |
|---|---|---|
| `design-motion-principles` | https://github.com/kylezantos/design-motion-principles | **Create mode** when building any animation (segments, sheets, CountUp, bars, list enter/exit, pull-to-refresh, charts). **Audit mode** at the end of P4 and P5, which produces an HTML report. Context: productivity/dashboard app, so **Emil Kowalski is primary** (restraint, speed; frequent actions such as tab switches and quick add get little or no motion), Jakub Krehel is secondary (production polish), and Jhey Tompkins is used only for empty states. |
| `redesign-existing-projects` | https://github.com/Leonxlnx/taste-skill (`skills/redesign-skill`) | The main taste skill. This is a redesign of a working app: audit first, upgrade without breaking functionality. |
| `minimalist-ui` | same repo (`skills/minimalist-skill`) | Supporting rules for the Calm Ledger look: flat surfaces, typographic contrast, no gradients, no heavy shadows. |
| `design-taste-frontend` | same repo (`skills/taste-skill`) | Run its pre-flight check before calling a screen done. |

**Precedence:** the user's approved decisions (Calm Ledger tokens, top segments + floating add, Fraunces/Manrope, the current Telegram message design) **override** anything these skills suggest. Use the skills to execute that direction well, not to change it. For example, ignore `minimalist-ui`'s "warm monochrome" palette in favour of the approved tokens.

## Safety net: we can always go back

**Requirement from the user:** back up all data, and at any point be able to revert to the system as it was on 2026-10-11.

- **Baseline:** P0 Tasks 0.3–0.6 take a complete snapshot of the current system **before anything changes**. This "pre-fa-upgrade" baseline is never deleted.
- **Restore tested:** P0 also builds the restore tools and **tests one restore** before P1 starts.
- **Rollback guide:** `docs/ROLLBACK.md` (written in P0) has a revert recipe for each level (app, one workflow, one table, all of n8n, code) and for each phase.
- **Snapshots:** every phase starts with a fresh snapshot recorded in `docs/plans/backup-log.md`, and ends with a "rollback point" line in the same log.
- If a phase goes wrong and the fix isn't obvious within a few minutes, **stop and roll back that phase**, then tell the user. Don't stack fixes on a broken state.

## Rules for every phase

- **Back up before any write** to a workflow or table: run `node n8n/scripts/backup.mjs` (built in P0 Task 0.4) at the start of each phase, and before any risky step.
- Workflow PUT bodies contain only `{name, nodes, connections, settings}`, and `settings` is filtered to the allowed keys (the client in P1 does this).
- In Code nodes, use `$input.all()`, `$input.first()` or `$('Node').first()`. **Never use `$('Node').item`**, because it hangs the task runner.
- Cloudflare blocks default Python/Node user agents on some paths. The client sends `User-Agent: fa-tools/1.0`.
- Never print the API key or the Telegram token. Never commit `.env`, `.env.local` or key files.
- Telegram tests: send real sample SMS through `POST /webhook/addNewTransaction` **only after telling the user**, because each one creates a real row and a real Telegram message. Delete test rows by SN afterwards.

---

## P0 — Setup

### Task 0.1: Protect current work-in-progress

The working tree has uncommitted changes (Budget/Merchants work, period fixes, CodeGraph config).

**Step 1:** Show the user `git status --short` and ask: "Commit the current work as 'WIP: budget analytics, merchants page, period fixes' before starting?" Don't commit without a yes.

**Step 2 (after yes):**
```bash
git add -A -- . ':!.claude/settings.local.json'
git commit -m "WIP: budget analytics, merchants page, period fixes, codegraph config"
```

**Step 3:** Create the working branch:
```bash
git switch -c fa-upgrade
```

### Task 0.2: Repo folders for n8n tooling

**Files:**
- Create: `n8n/README.md`
- Modify: `.gitignore` (append `n8n/.out/`)

**Step 1:** Create `n8n/README.md`:
```markdown
# n8n tooling for FA

- `code/` — pure JS used inside n8n Code nodes. Unit-tested with vitest (`*.test.js`).
- `scripts/` — Node scripts that talk to the n8n public API (backup, migrate, patch workflows).
- `workflows/` — build scripts that generate or patch workflow JSON.
- `.out/` — generated files (gitignored).

API key is read from `C:\data\n8n\n8n_Api\n8n_api.env` (override with env `N8N_API_KEY_FILE`).
```

**Step 2:** Append `n8n/.out/` to `.gitignore`.

**Step 3:** Commit: `git add n8n/README.md .gitignore && git commit -m "chore: add n8n tooling folder"`

### Task 0.3: Baseline snapshot of code, app and config

Everything goes to `C:\Data\FA-baseline\2026-10-11\`. That's outside the repo and outside the Docker volumes, so nothing in the upgrade can touch it.

**Step 1: Code.** Tag the commit made in Task 0.1, which is `main` *before* the branch. Then make an offline bundle:
```bash
git tag -a pre-fa-upgrade main -m "System state before FA upgrade (2026-10-11)"
mkdir -p C:/Data/FA-baseline/2026-10-11
git bundle create C:/Data/FA-baseline/2026-10-11/finance-app.bundle --all
```
Ask the user whether to push the tag to GitHub (`git push origin pre-fa-upgrade`). This is recommended, so a copy exists off this PC.

**Step 2: App image.** Keep the currently running build so the old app can be restarted in seconds:
```bash
docker tag finance-app-financial-app:latest finance-app-financial-app:pre-fa-upgrade
docker save finance-app-financial-app:pre-fa-upgrade -o C:/Data/FA-baseline/2026-10-11/financial-app-image.tar
```

**Step 3: Config files.** Copy them as they are, including secrets. This folder is local only and never committed or uploaded:
```bash
B=C:/Data/FA-baseline/2026-10-11
cp .env financial-composer.yaml Dockerfile vite.config.ts $B/
cp C:/Data/n8n/docker-compose.yaml $B/n8n-docker-compose.yaml
cp C:/Data/n8n/.env $B/n8n.env 2>/dev/null || true
```

**Step 4: Telegram and iPhone.** Ask the user to **duplicate the iPhone Shortcut** now and name the copy "FA SMS (original)", so the original Shortcut can be restored by switching back to it. No other phone-side state needs backing up.

### Task 0.4: Full n8n backup (logical and whole-volume)

**First**, do **P1 Task 1** (the n8n API client) now, because the backup and restore tools need it. Its commands are read-only.

**Logical backup** (granular restore of one workflow or one table). Build the backup script now. It's the same script described in P1 Task 2, moved earlier. Extend it to back up **all** workflows and **all** data tables, not just the FA ones:
- in `backup.mjs`, use `const wanted = list.data;` (every workflow)
- back up every table in `tables.data`

Run it with `FA_BACKUP_DIR=C:/Data/FA-baseline/2026-10-11/n8n-logical node n8n/scripts/backup.mjs`.
Expected: about 103 workflow files and every table, including `transactions` (~2,120 rows) and `Cat-list` (~960 rows).

**Whole-volume backup** (disaster recovery: workflows, credentials, data tables, execution history, settings). n8n uses SQLite inside the Docker volume `n8n_n8n_data`. Copying it while n8n runs can produce a corrupt copy, so n8n is stopped for about a minute. **Ask the user first.** Every n8n automation, including Joseph and the Telegram bots, pauses during that time.
```bash
docker volume ls | grep n8n_data                       # confirm the name: n8n_n8n_data
docker stop n8n
docker run --rm -v n8n_n8n_data:/data -v C:/Data/FA-baseline/2026-10-11:/backup alpine \
  sh -c "cd /data && tar czf /backup/n8n_data-volume.tar.gz ."
docker start n8n
```
Verify: the tar is over 10 MB and `tar tzf` lists `database.sqlite` and `config`. Then confirm n8n is back: `curl -s -o /dev/null -w "%{http_code}" https://n8n.11homelab.cc/healthz` → 200.

**Checksums:**
```bash
cd C:/Data/FA-baseline/2026-10-11 && sha256sum * n8n-logical/*/* > SHA256SUMS.txt
```

### Task 0.5: Restore tools and a test restore

**Files:**
- Create: `n8n/scripts/restore.mjs`

**Step 1:** Write the restore tool. It defaults to a dry run, and `--apply` is needed to change anything.
```js
// n8n/scripts/restore.mjs
//   node restore.mjs --dir <backup dir> --table transactions [--apply]   restore one table's rows (delete all, re-insert)
//   node restore.mjs --dir <backup dir> --workflow <id> [--apply]         restore one workflow (nodes, connections, settings, active state)
//   node restore.mjs --dir <backup dir> --table transactions --into <tableId> [--apply]   restore into another table (test restore)
import { readFileSync, readdirSync } from 'node:fs';
import { api, allRows, putWorkflow } from './n8n-client.mjs';

const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const APPLY = process.argv.includes('--apply');
const dir = arg('--dir'); if (!dir) throw new Error('--dir required');
const SYSTEM = new Set(['id', 'createdAt', 'updatedAt']);

if (arg('--table')) {
  const file = readdirSync(dir).find(f => f === `table-${arg('--table')}.json`);
  if (!file) throw new Error('no backup for table ' + arg('--table'));
  const { table, rows } = JSON.parse(readFileSync(`${dir}/${file}`, 'utf8'));
  const target = arg('--into') || table.id;
  const live = await allRows(target);
  const clean = rows.map(r => Object.fromEntries(Object.entries(r).filter(([k]) => !SYSTEM.has(k))));
  const sum = a => a.reduce((s, r) => s + (Number(r.Amount) || 0), 0).toFixed(3);
  console.log(`table ${table.name} → ${target}: live ${live.length} rows, backup ${rows.length} rows; Amount sum live ${sum(live)} backup ${sum(rows)}`);
  if (APPLY) {
    // Columns added after the backup (e.g. Payee_IBAN, Source) are simply left empty; drop them separately if needed.
    if (live.length) await api('DELETE', `/data-tables/${target}/rows/delete`, undefined,
      { filter: { type: 'and', filters: [{ columnName: 'id', condition: 'gt', value: 0 }] } });
    for (let i = 0; i < clean.length; i += 200) await api('POST', `/data-tables/${target}/rows`, { data: clean.slice(i, i + 200) });
    const after = await allRows(target);
    console.log(`restored: ${after.length} rows, Amount sum ${sum(after)}`);
    if (after.length !== rows.length) throw new Error('ROW COUNT MISMATCH — stop and investigate');
  }
}

if (arg('--workflow')) {
  const wf = JSON.parse(readFileSync(`${dir}/wf-${arg('--workflow')}.json`, 'utf8'));
  console.log(`workflow ${wf.name} (${wf.id}) nodes ${wf.nodes.length} active ${wf.active}`);
  if (APPLY) {
    await putWorkflow(wf);
    if (!wf.active) await api('POST', `/workflows/${wf.id}/deactivate`).catch(() => {});
    console.log('restored');
  }
}
```
Notes:
- If the API rejects filtering on `id` in the delete, use `SN` (`gt 0`) for `transactions` and `Merchant` (`neq ''`) plus a second pass for empty merchants for `Cat-list`. Find the working filter during the test restore below.
- Restored rows get new internal `id`s. Nothing in the FA system depends on `id` except the duplicate-removal workflow's "keep the lowest id" rule, which still works.

**Step 2: Test restore (required before P1).** Restore the baseline `transactions` backup into a throwaway table and compare:
```bash
node -e "import('./n8n/scripts/n8n-client.mjs').then(async m=>{const t=await m.api('POST','/data-tables',{name:'restore_drill',projectId:m.PROJECT_ID,columns:[
 {name:'SN',type:'number'},{name:'Date',type:'string'},{name:'Time',type:'string'},{name:'Merchant',type:'string'},{name:'Amount',type:'number'},
 {name:'Currency',type:'string'},{name:'Category',type:'string'},{name:'Tag',type:'string'},{name:'Name',type:'string'},{name:'Card_ending',type:'string'}]});console.log('DRILL='+t.id)})"
node n8n/scripts/restore.mjs --dir C:/Data/FA-baseline/2026-10-11/n8n-logical/<stamp> --table transactions --into <DRILL id> --apply
```
Expected: `restored: <same count> rows, Amount sum <same sum as the live table>`. Then delete the drill table: `DELETE /data-tables/<DRILL id>`.

**Step 3:** Test restore for a workflow: run `restore.mjs --workflow I3EaJw8o1YNfkleN` **without** `--apply` and check that it reads and prints correctly. Don't apply; it's unchanged.

**Step 4:** Commit: `git add n8n/scripts/restore.mjs && git commit -m "feat(n8n): restore tool (tested with restore drill)"`

### Task 0.6: Rollback guide and backup log

**Files:**
- Create: `docs/ROLLBACK.md`
- Create: `docs/plans/backup-log.md`

**Step 1:** Write `docs/ROLLBACK.md`:
````markdown
# FA Rollback Guide

Baseline (system as of 2026-10-11): `C:\Data\FA-baseline\2026-10-11\` · git tag `pre-fa-upgrade` · image `finance-app-financial-app:pre-fa-upgrade`.
Later snapshots: see `docs/plans/backup-log.md`. Always take a fresh backup (`node n8n/scripts/backup.mjs`) before rolling back, so the rollback itself can be undone.

## Level 1 — App only (old UI back in ~1 min)
```bash
docker tag finance-app-financial-app:pre-fa-upgrade finance-app-financial-app:latest
docker compose -f financial-composer.yaml up -d --no-build financial-app
```
(If the image is gone: `docker load -i C:/Data/FA-baseline/2026-10-11/financial-app-image.tar` first.)
The old UI calls the old webhooks (FA - Get / Update / Merchant). If P5 deactivated them, re-activate: `POST /workflows/{id}/activate` for aoVZmvgR3GRTC8kR, PAVfWilnR0E9msqA, EGiQwEDvAKgHXebK.

## Level 2 — One workflow
`node n8n/scripts/restore.mjs --dir <snapshot>/<stamp> --workflow <id> --apply`
For FA - add transaction (`I3EaJw8o1YNfkleN`) this brings back the original Telegram flow exactly.

## Level 3 — One table's data
`node n8n/scripts/restore.mjs --dir <snapshot>/<stamp> --table transactions --apply` (or `Cat-list`).
Rows created after that snapshot are lost. Export them first from the fresh backup if they're needed.

## Level 4 — Everything in n8n (disaster)
Restores all workflows, credentials, data tables and history to the baseline. Everything done in n8n since then is lost, including non-FA work.
```bash
docker stop n8n
docker run --rm -v n8n_n8n_data:/data -v C:/Data/FA-baseline/2026-10-11:/backup alpine \
  sh -c "cd /data && rm -rf ./* ./.[!.]* 2>/dev/null; tar xzf /backup/n8n_data-volume.tar.gz"
docker start n8n
```
Also restore `C:/Data/n8n/docker-compose.yaml` (and `.env`) from the baseline if P2 changed them, then `docker compose -f C:/Data/n8n/docker-compose.yaml up -d n8n`.

## Level 5 — Code
`git switch main` (main is untouched while work happens on `fa-upgrade`), or `git checkout pre-fa-upgrade`. The offline copy is in `finance-app.bundle` (`git clone finance-app.bundle`).

## Per-phase undo
| Phase | Undo |
|---|---|
| P1 | Level 3 for `transactions` + `Cat-list` from the P1 start snapshot. Delete the `Categories`/`Settings` tables and the `Payee_IBAN`/`Source` columns (`DELETE /data-tables/{id}`, `DELETE /data-tables/{id}/columns/{colId}`). Level 2 for Joseph Finance Query (`RIbvggdanZ2tzERx`). |
| P2 | Level 2 for `I3EaJw8o1YNfkleN`. Restore the n8n compose/.env from the baseline and restart n8n. If the bot token was rotated, the old token is dead: put the **new** token into the restored workflow's "Ask for Category" URL and the Telegram credential. |
| P3 | Deactivate or delete "FA - App API". Delete the "FA App Key" credential. Level 2 for `I3EaJw8o1YNfkleN` (removes header auth from the Shortcut webhook). Switch the iPhone back to "FA SMS (original)". Level 1 for the app (old nginx config). |
| P4/P5 | Level 1 (old app image) + re-activate the old webhooks if P5 Task 7 ran. Data written by the new app is compatible with the old app (same tables), so nothing else is needed. |
````

**Step 2:** Create `docs/plans/backup-log.md`:
```markdown
# Backup log
| When | Phase | Type | Location | Rows tx / cat-list | Notes |
|---|---|---|---|---|---|
| 2026-10-11 | P0 baseline | code tag+bundle, app image, config, n8n logical (all), n8n volume | C:\Data\FA-baseline\2026-10-11\ | ~2120 / ~960 | restore drill passed |
```
Each phase adds a "start" row (snapshot) and an "end / rollback point" row.

**Step 3:** Commit: `git add docs/ROLLBACK.md docs/plans/backup-log.md && git commit -m "docs: rollback guide and backup log"`

**Step 4:** Tell the user: the baseline is complete, the test restore passed, and these are the folder, the tag and the image name. P1 can start.
