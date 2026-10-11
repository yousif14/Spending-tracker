# FA Upgrade P1 — Foundation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Read the index `2026-10-11-fa-upgrade-plan.md` first (Key IDs and rules).

**Goal:** Build safe n8n tooling, back everything up, add the `Categories` and `Settings` tables and the new transaction columns, clean the data (ISO dates, `HH:MM` times, category typos, `Source` backfill), and fix Joseph's date parsing.

**Ends with:** every transaction row has an ISO `Date`; the `Categories` table exists and is seeded; Joseph counts recent months correctly; the app still loads.

**Before starting:** P0 Tasks 0.3–0.6 must be complete (baseline snapshot, test restore passed, `docs/ROLLBACK.md` exists). If they aren't, stop and do P0 first.

**Phase start:** run `node n8n/scripts/backup.mjs` and add a "P1 start" row to `docs/plans/backup-log.md`.
**Phase end:** run the backup again and add a "P1 end, rollback point" row.
**Undo:** `docs/ROLLBACK.md`, row P1.

---

### Task 1: n8n API client (already done in P0 Task 0.4; skip if the file exists)

**Files:**
- Create: `n8n/scripts/n8n-client.mjs`

**Step 1:** Write the client:
```js
// n8n/scripts/n8n-client.mjs — minimal n8n public API client (Node 18+)
import { readFileSync } from 'node:fs';

const BASE = process.env.N8N_BASE_URL || 'https://n8n.11homelab.cc/api/v1';
const KEY_FILE = process.env.N8N_API_KEY_FILE || 'C:/data/n8n/n8n_Api/n8n_api.env';
const KEY = (process.env.N8N_API_KEY || readFileSync(KEY_FILE, 'utf8')).trim();

export async function api(method, path, body, query) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(query || {})) {
    if (v !== undefined) url.searchParams.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  }
  const res = await fetch(url, {
    method,
    headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json', 'User-Agent': 'fa-tools/1.0' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

export async function allRows(tableId) {
  const rows = [];
  let cursor;
  do {
    const page = await api('GET', `/data-tables/${tableId}/rows`, undefined, { limit: '250', cursor });
    rows.push(...page.data);
    cursor = page.nextCursor;
  } while (cursor);
  return rows;
}

export const eq = (columnName, value) => ({ type: 'and', filters: [{ columnName, condition: 'eq', value }] });

export async function updateRows(tableId, filter, data) {
  return api('PATCH', `/data-tables/${tableId}/rows/update`, { filter, data });
}

export async function insertRows(tableId, data) {
  return api('POST', `/data-tables/${tableId}/rows`, { data, returnType: 'id' });
}

const SETTINGS_KEYS = ['saveExecutionProgress', 'saveManualExecutions', 'saveDataErrorExecution',
  'saveDataSuccessExecution', 'executionTimeout', 'errorWorkflow', 'timezone', 'executionOrder'];

export async function getWorkflow(id) { return api('GET', `/workflows/${id}`); }

export async function putWorkflow(wf) {
  const settings = Object.fromEntries(Object.entries(wf.settings || {}).filter(([k]) => SETTINGS_KEYS.includes(k)));
  const body = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings };
  const out = await api('PUT', `/workflows/${wf.id}`, body);
  if (wf.active) await api('POST', `/workflows/${wf.id}/activate`);
  return out;
}

export const TABLES = { transactions: 'wWtvo201WLTNBcqr', catList: 'IGDY61HhMcKpjvDT' };
export const PROJECT_ID = 'rb6hVXbCTjBQVHmt';
```

**Step 2:** Smoke test (read-only):
```bash
node -e "import('./n8n/scripts/n8n-client.mjs').then(async m=>{const r=await m.api('GET','/data-tables',undefined,{limit:'100'});console.log(r.data.map(t=>t.name).join(', '))})"
```
Expected: a list that includes `transactions, Cat-list`.

**Step 3:** Commit: `git add n8n/scripts/n8n-client.mjs && git commit -m "feat(n8n): add API client"`

### Task 2: Backup script (already done in P0 Task 0.4, where it covers **all** workflows and tables; skip if the file exists. The code below is the FA-only original. Keep P0's broader version.)

**Files:**
- Create: `n8n/scripts/backup.mjs`

**Step 1:** Write it:
```js
// n8n/scripts/backup.mjs — snapshot FA workflows + finance tables to C:/data/n8n/n8n_Api/backups/<stamp>/
import { mkdirSync, writeFileSync } from 'node:fs';
import { api, allRows, getWorkflow } from './n8n-client.mjs';

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const dir = `${process.env.FA_BACKUP_DIR || 'C:/data/n8n/n8n_Api/backups'}/${stamp}`;
mkdirSync(dir, { recursive: true });

const list = await api('GET', '/workflows', undefined, { limit: '250' });
const wanted = list.data.filter(w => /^FA - |^Joseph – Finance|^FA - App API/.test(w.name));
for (const w of wanted) writeFileSync(`${dir}/wf-${w.id}.json`, JSON.stringify(await getWorkflow(w.id), null, 1));

const tables = await api('GET', '/data-tables', undefined, { limit: '100' });
for (const t of tables.data.filter(t => ['transactions', 'Cat-list', 'Categories', 'Settings'].includes(t.name))) {
  const rows = await allRows(t.id);
  writeFileSync(`${dir}/table-${t.name}.json`, JSON.stringify({ table: t, rows }, null, 1));
  console.log(`${t.name}: ${rows.length} rows`);
}
console.log(`workflows: ${wanted.length}\nbackup: ${dir}`);
```

**Step 2:** Run: `node n8n/scripts/backup.mjs`
Expected: `transactions: ~2120 rows`, `Cat-list: ~960 rows`, `workflows: 8`, and a backup path. Check the folder exists and the transactions JSON is over 300 KB.

**Step 3:** Commit: `git add n8n/scripts/backup.mjs && git commit -m "feat(n8n): add backup script"`

### Task 3: Normalisation library (TDD)

**Files:**
- Create: `n8n/code/normalize.js`
- Test: `n8n/code/normalize.test.js`

**Step 1: Write the failing test**
```js
// n8n/code/normalize.test.js
import { describe, it, expect } from 'vitest';
import { toIsoDate, toHHMM, normalizeCategory, inferSource } from './normalize.js';

describe('toIsoDate', () => {
  it('keeps ISO', () => expect(toIsoDate('2026-10-10')).toBe('2026-10-10'));
  it('converts DD/MM/YYYY', () => expect(toIsoDate('11/03/2025')).toBe('2025-03-11'));
  it('pads single digits', () => expect(toIsoDate('1/3/2025')).toBe('2025-03-01'));
  it('converts YYYY/MM/DD', () => expect(toIsoDate('2026/10/08')).toBe('2026-10-08'));
  it('returns empty for junk', () => expect(toIsoDate('')).toBe(''));
});

describe('toHHMM', () => {
  it('trims seconds', () => expect(toHHMM('00:39:00')).toBe('00:39'));
  it('pads hour', () => expect(toHHMM('9:05')).toBe('09:05'));
  it('keeps empty', () => expect(toHHMM('')).toBe(''));
  it('handles null', () => expect(toHHMM(null)).toBe(''));
});

describe('normalizeCategory', () => {
  it('fixes typos', () => {
    expect(normalizeCategory('Luandry')).toBe('Laundry');
    expect(normalizeCategory('Patrol')).toBe('Petrol');
    expect(normalizeCategory('other')).toBe('Other');
  });
  it('trims and keeps others', () => expect(normalizeCategory(' Food ')).toBe('Food'));
  it('keeps empty', () => expect(normalizeCategory(null)).toBe(''));
});

describe('inferSource', () => {
  it('manual when Name is -', () => expect(inferSource({ Name: '-', Merchant: 'Jasmis' })).toBe('manual'));
  it('fawri when Benefit', () => expect(inferSource({ Name: 'Benefit' })).toBe('fawri'));
  it('fawri when Card + no card ending', () => expect(inferSource({ Name: 'Card', Card_ending: '' })).toBe('fawri'));
  it('sms otherwise', () => expect(inferSource({ Name: 'YUSUF', Card_ending: '4120' })).toBe('sms'));
});
```

**Step 2:** Run: `npx vitest run n8n/code/normalize.test.js`
Expected: FAIL, because `normalize.js` doesn't exist.

**Step 3: Implement**
```js
// n8n/code/normalize.js — shared by migration script, n8n Code nodes and the app
export const CATEGORY_RENAMES = { Luandry: 'Laundry', Patrol: 'Petrol', other: 'Other' };

export function toIsoDate(v) {
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return s;
  m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}

export function toHHMM(v) {
  const m = String(v ?? '').trim().match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
}

export function normalizeCategory(v) {
  const s = String(v ?? '').trim();
  return CATEGORY_RENAMES[s] ?? s;
}

// "Card" with no card ending = rows created by the SMS parser from Fawri+ messages (no "Dear NAME")
export function inferSource(row) {
  if (row.Source) return row.Source;
  if (row.Name === '-') return 'manual';
  if (row.Name === 'Benefit') return 'fawri';
  if (row.Name === 'Card' && !row.Card_ending) return 'fawri';
  return 'sms';
}
```

**Step 4:** Run: `npx vitest run n8n/code/normalize.test.js`. Expected: all pass.

**Step 5:** Commit: `git add n8n/code/normalize.* && git commit -m "feat(n8n): add normalisation helpers"`

### Task 4: Create the `Categories` and `Settings` tables and the new columns

**Files:**
- Create: `n8n/scripts/p1-schema.mjs`

**Step 1:** Write it. It's idempotent: it skips anything that already exists.
```js
// n8n/scripts/p1-schema.mjs
import { api, allRows, insertRows, TABLES, PROJECT_ID } from './n8n-client.mjs';
import { normalizeCategory } from '../code/normalize.js';

const COLORS = { Food:'#E07A5F', Groceries:'#3D8B6E', Drink:'#C08552', Travel:'#4A7FB5', Shopping:'#B5568A',
  Subscription:'#6C63B5', 'Health Care':'#D1495B', Petrol:'#8C6D46', Sport:'#2A9D8F', Gifts:'#E9A23B',
  Car:'#5A6B7B', Baby:'#8A6FD1', Laundry:'#4BA3C3', Grooming:'#C77DFF', Services:'#6B8F71', Clothing:'#D4706B',
  Investment:'#2F7D4F', Furniture:'#9C7A54', Other:'#8A9490' };
const ICONS = { Food:'UtensilsCrossed', Groceries:'ShoppingCart', Drink:'Coffee', Travel:'Plane', Shopping:'ShoppingBag',
  Subscription:'Tv', 'Health Care':'Heart', Petrol:'Fuel', Sport:'Dumbbell', Gifts:'Gift', Car:'Car', Baby:'Baby',
  Laundry:'Wind', Grooming:'Scissors', Services:'Wrench', Clothing:'Shirt', Investment:'TrendingUp', Furniture:'Sofa', Other:'Package' };

const tables = (await api('GET', '/data-tables', undefined, { limit: '100' })).data;
const byName = n => tables.find(t => t.name === n);

let cat = byName('Categories');
if (!cat) {
  cat = await api('POST', '/data-tables', { name: 'Categories', projectId: PROJECT_ID, columns: [
    { name: 'Name', type: 'string' }, { name: 'Color', type: 'string' }, { name: 'Icon', type: 'string' },
    { name: 'Budget', type: 'number' }, { name: 'Order', type: 'number' }, { name: 'Active', type: 'boolean' } ] });
  // Seed from distinct categories used in transactions, most used first; skip "Fawri+" (not a real category)
  const tx = await allRows(TABLES.transactions);
  const counts = {};
  for (const r of tx) { const c = normalizeCategory(r.Category); if (c && c !== 'Fawri+') counts[c] = (counts[c] || 0) + 1; }
  const names = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  await insertRows(cat.id, names.map((n, i) => ({ Name: n, Color: COLORS[n] || '#8A9490', Icon: ICONS[n] || 'Tag', Budget: 0, Order: i + 1, Active: true })));
  console.log('Categories created + seeded:', names.join(', '));
} else console.log('Categories exists', cat.id);

let settings = byName('Settings');
if (!settings) {
  settings = await api('POST', '/data-tables', { name: 'Settings', projectId: PROJECT_ID, columns: [
    { name: 'Key', type: 'string' }, { name: 'Value', type: 'string' } ] });
  await insertRows(settings.id, [{ Key: 'total_budget', Value: '600' }]);
  console.log('Settings created', settings.id);
} else console.log('Settings exists', settings.id);

const cols = (await api('GET', `/data-tables/${TABLES.transactions}/columns`)).map(c => c.name ?? c);
for (const name of ['Payee_IBAN', 'Source']) {
  if (!cols.includes(name)) { await api('POST', `/data-tables/${TABLES.transactions}/columns`, { name, type: 'string' }); console.log('added column', name); }
}
console.log(`CATEGORIES_TABLE=${cat.id}\nSETTINGS_TABLE=${settings.id}`);
```
Note: if `GET /columns` returns `{data:[...]}` rather than an array, adapt the `cols` line. Check the shape once with a GET.

**Step 2:** Run `node n8n/scripts/backup.mjs`, then `node n8n/scripts/p1-schema.mjs`.
Expected: Categories seeded (about 19 names), Settings created, 2 columns added. **Record the two printed table IDs in the index's Key IDs table.**

**Step 3:** Add the two IDs to `TABLES` in `n8n-client.mjs` (`categories: '<id>', settings: '<id>'`).

**Step 4:** Commit: `git add n8n/scripts && git commit -m "feat(n8n): add Categories/Settings tables and new columns"`

### Task 5: Data cleanup migration (dry run first)

**Files:**
- Create: `n8n/scripts/p1-migrate.mjs`

**Step 1:** Write it:
```js
// n8n/scripts/p1-migrate.mjs  — usage: node p1-migrate.mjs [--apply]
import { allRows, updateRows, eq, TABLES } from './n8n-client.mjs';
import { toIsoDate, toHHMM, normalizeCategory, inferSource } from '../code/normalize.js';

const APPLY = process.argv.includes('--apply');
const tx = await allRows(TABLES.transactions);
const patches = [];
const fawriCat = [];
for (const r of tx) {
  const p = {};
  const d = toIsoDate(r.Date); if (d && d !== r.Date) p.Date = d;
  const t = toHHMM(r.Time); if ((r.Time || '') !== t) p.Time = t;
  const c = normalizeCategory(r.Category); if ((r.Category || '') !== c) p.Category = c;
  if (!r.Source) p.Source = inferSource(r);
  if (r.Category === 'Fawri+') fawriCat.push(r);
  if (Object.keys(p).length) patches.push({ id: r.id, SN: r.SN, p });
}
const bad = tx.filter(r => !toIsoDate(r.Date));
console.log(`rows ${tx.length}, to patch ${patches.length}, unparseable dates ${bad.length}`);
console.log('sample', JSON.stringify(patches.slice(0, 5)));
console.log('Fawri+ category rows (review with user):');
for (const r of fawriCat) console.log(`  SN ${r.SN} ${r.Date} ${r.Merchant} ${r.Amount}`);

if (APPLY) {
  let n = 0;
  for (const { id, p } of patches) { await updateRows(TABLES.transactions, eq('id', id), p); if (++n % 100 === 0) console.log(n); }
  const cl = await allRows(TABLES.catList);
  for (const r of cl) {
    const c = normalizeCategory(r.Category);
    if ((r.Category || '') !== c) await updateRows(TABLES.catList, eq('id', r.id), { Category: c });
  }
  console.log('applied', n);
}
```

**Step 2:** Dry run: `node n8n/scripts/p1-migrate.mjs`
Expected: `to patch` around 2,100 (most rows get `Source`), `unparseable dates 0`, and 8 Fawri+ rows listed. **If unparseable dates > 0, stop and show the user.**

**Step 3:** Show the user the 8 Fawri+ rows (merchant, amount, date) and ask which category each should get, using AskUserQuestion. Offer the likely choices per row as options. Store the answers as a `FAWRI_FIX` map `{ SN: 'Category' }` at the top of the script, and apply them in the patch loop (`if (FAWRI_FIX[r.SN]) p.Category = FAWRI_FIX[r.SN]`).

**Step 4:** Back up again (`node n8n/scripts/backup.mjs`), then run `node n8n/scripts/p1-migrate.mjs --apply`. It takes several minutes and prints progress every 100 rows.

**Step 5:** Verify by re-running the dry run. Expected: `to patch 0`. Then check the date formats:
```bash
node -e "import('./n8n/scripts/n8n-client.mjs').then(async m=>{const r=await m.allRows(m.TABLES.transactions);const f={};for(const x of r){const k=String(x.Date).replace(/\d/g,'9');f[k]=(f[k]||0)+1}console.log(f)})"
```
Expected: `{ '9999-99-99': <all rows> }`.

**Step 6:** Commit: `git add n8n/scripts/p1-migrate.mjs && git commit -m "feat(n8n): migrate dates, times, categories, source"`

### Task 6: Fix Joseph's finance date parsing

Follow the **joseph-assistant** skill's edit loop (back up → edit the build source → regenerate → PUT → activate if it was active → verify).

**Files:**
- Modify: `C:\data\Joseph\build\finance.code.js` (the `monthKey` function and the header comment)

**Step 1:** Replace `monthKey` with:
```js
const monthKey = (dstr) => {            // accepts "YYYY-MM-DD" (current) and "DD/MM/YYYY" (legacy)
  const s = String(dstr || '');
  let m = s.match(/^(\d{4})-(\d{2})-\d{2}/);
  if (m) return `${m[1]}-${m[2]}`;
  m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}` : null;
};
```
Update the schema comment to `Date "YYYY-MM-DD"`. Search the file for any other `/(\d{1,2})\/` date parsing and handle ISO the same way.

**Step 2:** Regenerate and deploy per the skill (the script name is in `C:\data\Joseph\build\`, e.g. `node finance.js`). Then `PUT /workflows/RIbvggdanZ2tzERx`.

**Step 3:** Verify by calling the finance webhook for this month:
```bash
curl -s "https://n8n.11homelab.cc/webhook/joseph-finance?month=this" | head -c 600
```
(Use the query parameter names that the workflow's code reads.) Expected: a non-zero total that matches the app's figure for October 2026. Before the fix it would have been 0 or only legacy rows.

**Step 4:** Update the joseph-assistant skill's gotcha line ("real schema: `Date` DD/MM/YYYY") to say ISO.

### Task 7: Confirm nothing broke

**Step 1:** Run `npx vitest run`. Expected: all tests pass (79 existing + new).

**Step 2:** Open https://fa.11homelab.cc (the current app). The Transactions page should show October rows and older 2025 rows with correct dates. `convertDateFormat` passes ISO through unchanged.

**Step 3:** Tell the user that P1 is done, and summarise: backup path, row counts, the Categories list, the Joseph fix.
