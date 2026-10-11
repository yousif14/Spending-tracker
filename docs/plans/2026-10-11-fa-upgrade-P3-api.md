# FA Upgrade P3 — App API and security

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Read the index first. P1 must be done; P2 is recommended but not required.

**Goal:** A new n8n workflow, **"FA - App API"**, serves the PWA. All of its endpoints need an `X-FA-Key` header. The app container's nginx proxies `/api/fa/*` to it and adds the key server-side. The iPhone Shortcut webhook starts requiring the key too.

**Phase start:** `node n8n/scripts/backup.mjs` → add a "P3 start" row to `docs/plans/backup-log.md`.
**Phase end:** back up again and add a "P3 end, rollback point" row.
**Undo:** `docs/ROLLBACK.md`, row P3. Before Task 5, make sure the user has the "FA SMS (original)" Shortcut copy from P0.

**Endpoints** (all `responseMode: responseNode`, JSON `{ success, ... }`). Every write uses POST to keep nginx and n8n routing simple.

| Path (`/webhook/…`) | Method | Body | Returns |
|---|---|---|---|
| `fa/feed` | GET | – | `{ success, transactions[], categories[], merchants[], settings{}, generatedAt }` |
| `fa/tx-add` | POST | `{ date, time, merchant, amount, category, tag? }` | `{ success, SN }` |
| `fa/tx-update` | POST | `{ sn, date?, time?, merchant?, amount?, category?, tag? }` | `{ success }` |
| `fa/tx-delete` | POST | `{ sn }` | `{ success }` |
| `fa/merchant` | POST | `{ from, to?, category? }` | `{ success, updated }` |
| `fa/categories` | POST | `{ items: [{ id?, Name, Color?, Icon?, Budget?, Order?, Active? }], rename?: { from, to } }` | `{ success }` |
| `fa/settings` | POST | `{ key, value }` | `{ success }` |

`feed` transaction shape (camelCase, what the app uses): `{ sn, date, time, merchant, amount, currency, category, tag, name, cardEnding, payeeIban, source }`.

---

### Task 1: Create the header-auth credential and the secret

**Step 1:** Generate a secret and store it **only** in the two env files (both gitignored):
```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```
Append `FA_API_KEY=<value>` to `C:\Data\Finance-app\.env` (Docker) and `C:\Data\Finance-app\.env.local` (Vite dev). Check that `.gitignore` covers `.env.local` and add it if not. Never echo the value.

**Step 2:** Create the credential through the API:
```bash
node -e "
import('./n8n/scripts/n8n-client.mjs').then(async m=>{
 const fs=await import('node:fs');
 const key=fs.readFileSync('.env','utf8').match(/^FA_API_KEY=(.+)$/m)[1].trim();
 const c=await m.api('POST','/credentials',{name:'FA App Key',type:'httpHeaderAuth',data:{name:'X-FA-Key',value:key}});
 console.log('CREDENTIAL_ID='+c.id)})"
```
Record the ID in the index Key IDs table, and add `credFaKey: '<id>'` to an `IDS` export in `n8n-client.mjs`.

**Step 3:** Commit the client change: `git commit -am "chore(n8n): record FA App Key credential id"`

### Task 2: Shared feed mapping (TDD)

**Files:**
- Create: `n8n/code/feed.js`
- Test: `n8n/code/feed.test.js`

**Step 1: Write the failing test**
```js
// n8n/code/feed.test.js
import { describe, it, expect } from 'vitest';
import { toFeedTx, buildFeed, newManualRow } from './feed.js';

describe('toFeedTx', () => {
  it('maps and normalises a row', () => {
    expect(toFeedTx({ id: 9, SN: 2026101022482000, Date: '10/10/2026', Time: '19:59:00', Merchant: 'Alkawar', Amount: '8',
      Currency: 'BHD', Category: 'Luandry', Tag: null, Name: 'Card', Card_ending: '', Payee_IBAN: '0000', Source: 'fawri' }))
      .toEqual({ sn: '2026101022482000', date: '2026-10-10', time: '19:59', merchant: 'Alkawar', amount: 8, currency: 'BHD',
        category: 'Laundry', tag: '', name: 'Card', cardEnding: '', payeeIban: '0000', source: 'fawri' });
  });
});

describe('buildFeed', () => {
  it('sorts newest first, sorts categories, maps settings', () => {
    const f = buildFeed({
      tx: [{ SN: 1, Date: '2026-01-01', Time: '10:00', Amount: 1 }, { SN: 2, Date: '2026-02-01', Time: '09:00', Amount: 2 }],
      categories: [{ id: 1, Name: 'B', Order: 2, Active: true }, { id: 2, Name: 'A', Order: 1, Active: true }],
      catList: [{ Merchant: 'JASMIS', Category: 'Food' }],
      settings: [{ Key: 'total_budget', Value: '600' }],
    }, new Date('2026-03-01T00:00:00Z'));
    expect(f.transactions.map(t => t.sn)).toEqual(['2', '1']);
    expect(f.categories.map(c => c.name)).toEqual(['A', 'B']);
    expect(f.merchants).toEqual([{ merchant: 'JASMIS', category: 'Food', count: 0 }]);
    expect(f.settings).toEqual({ total_budget: 600 });
  });
});

describe('newManualRow', () => {
  it('builds a data-table row', () => {
    const r = newManualRow({ date: '2026-10-06', time: '18:23', merchant: ' Jasmis ', amount: '1.275', category: 'Food' }, 2026100618230123);
    expect(r).toEqual({ SN: 2026100618230123, Date: '2026-10-06', Time: '18:23', Merchant: 'Jasmis', Amount: 1.275, Currency: 'BHD',
      Category: 'Food', Tag: '', Name: '-', Card_ending: '', Payee_IBAN: '', Source: 'manual' });
  });
  it('rejects bad input', () => {
    expect(() => newManualRow({ date: 'x', time: '', merchant: '', amount: 0, category: '' }, 1)).toThrow();
  });
});
```

**Step 2:** Run `npx vitest run n8n/code/feed.test.js`. Expected: FAIL.

**Step 3: Implement**
```js
// n8n/code/feed.js — row ↔ API mapping for FA - App API
import { toIsoDate, toHHMM, normalizeCategory, inferSource } from './normalize.js';

export function toFeedTx(r) {
  return { sn: String(r.SN), date: toIsoDate(r.Date), time: toHHMM(r.Time), merchant: String(r.Merchant ?? '').trim(),
    amount: Number(r.Amount) || 0, currency: r.Currency || 'BHD', category: normalizeCategory(r.Category), tag: r.Tag ?? '',
    name: r.Name ?? '', cardEnding: r.Card_ending ?? '', payeeIban: r.Payee_IBAN ?? '', source: inferSource(r) };
}

export function buildFeed({ tx, categories, catList, settings }, now = new Date()) {
  const transactions = tx.map(toFeedTx).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const counts = {};
  for (const t of transactions) counts[t.merchant.toUpperCase()] = (counts[t.merchant.toUpperCase()] || 0) + 1;
  return {
    success: true,
    generatedAt: now.toISOString(),
    transactions,
    categories: categories.filter(c => c.Name).map(c => ({ id: c.id, name: c.Name, color: c.Color || '#8A9490', icon: c.Icon || 'Tag',
      budget: Number(c.Budget) || 0, order: Number(c.Order) || 999, active: c.Active !== false })).sort((a, b) => a.order - b.order),
    merchants: catList.filter(m => m.Merchant).map(m => ({ merchant: m.Merchant, category: normalizeCategory(m.Category),
      count: counts[String(m.Merchant).toUpperCase()] || 0 })),
    settings: Object.fromEntries(settings.map(s => [s.Key, isNaN(Number(s.Value)) ? s.Value : Number(s.Value)])),
  };
}

export function newManualRow(b, sn) {
  const Date_ = toIsoDate(b.date), Amount = Number(b.amount), Merchant = String(b.merchant ?? '').trim();
  if (!Date_ || !Merchant || !(Amount > 0) || !String(b.category ?? '').trim()) throw new Error('date, merchant, amount > 0 and category are required');
  return { SN: sn, Date: Date_, Time: toHHMM(b.time), Merchant, Amount, Currency: 'BHD', Category: normalizeCategory(b.category),
    Tag: String(b.tag ?? '').trim(), Name: '-', Card_ending: '', Payee_IBAN: '', Source: 'manual' };
}
```

**Step 4:** Run the test. Expected: PASS.

**Step 5:** Commit: `git add n8n/code/feed.* && git commit -m "feat(n8n): feed mapping for App API"`

### Task 3: Build the "FA - App API" workflow

**Files:**
- Create: `n8n/workflows/fa-app-api.build.mjs`

**Step 1:** Write the builder. It creates the workflow on the first run and updates it on later runs, matched by name.
```js
// n8n/workflows/fa-app-api.build.mjs — usage: node fa-app-api.build.mjs [--apply]
import { randomUUID } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { api, putWorkflow, TABLES, IDS } from '../scripts/n8n-client.mjs';
import { inline } from '../scripts/inline.mjs';

const nodes = [], connections = {};
let y = 0;
const rl = (id, name) => ({ __rl: true, value: id, mode: 'list', cachedResultName: name });
const add = (n) => { nodes.push({ id: randomUUID(), ...n }); return n.name; };
const link = (a, b, i = 0) => { connections[a] ??= { main: [] }; while (connections[a].main.length <= i) connections[a].main.push([]); connections[a].main[i].push({ node: b, type: 'main', index: 0 }); };
const chain = (...names) => names.slice(1).forEach((n, i) => link(names[i], n));

const webhook = (name, path, method, x) => add({ name, type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [x, y], webhookId: randomUUID(),
  parameters: { httpMethod: method, path, authentication: 'headerAuth', responseMode: 'responseNode', options: {} },
  credentials: { httpHeaderAuth: { id: IDS.credFaKey, name: 'FA App Key' } } });
const code = (name, js, x) => add({ name, type: 'n8n-nodes-base.code', typeVersion: 2, position: [x, y], parameters: { jsCode: js } });
const dt = (name, x, parameters, extra = {}) => add({ name, type: 'n8n-nodes-base.dataTable', typeVersion: 1, position: [x, y], parameters, ...extra });
const respond = (name, body, x, code = 200) => add({ name, type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1, position: [x, y],
  parameters: { respondWith: 'json', responseBody: body, options: { responseCode: code } } });
const getAll = (name, x, table, tname) => dt(name, x, { operation: 'get', dataTableId: rl(table, tname), returnAll: true }, { executeOnce: true, alwaysOutputData: true });
const autoCols = (cols) => ({ mappingMode: 'autoMapInputData', value: {}, matchingColumns: [], attemptToConvertTypes: false, convertFieldsToString: false,
  schema: cols.map(([id, type]) => ({ id, displayName: id, required: false, defaultMatch: false, display: true, type, readOnly: false, removed: false })) });
const TX_COLS = [['SN','number'],['Date','string'],['Time','string'],['Merchant','string'],['Amount','number'],['Currency','string'],['Category','string'],
  ['Tag','string'],['Name','string'],['Card_ending','string'],['Payee_IBAN','string'],['Source','string']];
const bySN = (expr) => ({ conditions: [{ keyName: 'SN', keyValue: expr }] });
const ok = '={{ { success: true } }}';
const fail = "={{ { success: false, error: $json.error || 'Request failed' } }}";

// ---- GET fa/feed
y = 0;
chain(webhook('Feed', 'fa/feed', 'GET', 0),
  getAll('Feed: transactions', 220, TABLES.transactions, 'transactions'),
  getAll('Feed: categories', 440, TABLES.categories, 'Categories'),
  getAll('Feed: cat-list', 660, TABLES.catList, 'Cat-list'),
  getAll('Feed: settings', 880, TABLES.settings, 'Settings'),
  code('Feed: build', inline(['normalize.js', 'feed.js'], `
const rows = n => $(n).all().map(i => i.json).filter(r => r && Object.keys(r).length);
return [{ json: buildFeed({ tx: rows('Feed: transactions'), categories: rows('Feed: categories'), catList: rows('Feed: cat-list'), settings: rows('Feed: settings') }) }];`), 1100),
  respond('Feed: respond', '={{ $json }}', 1320));

// ---- POST fa/tx-add
y = 300;
chain(webhook('Tx add', 'fa/tx-add', 'POST', 0),
  code('Tx add: build row', inline(['normalize.js', 'feed.js'], `
const pad = n => String(n).padStart(2, '0'); const d = new Date();
const sn = Number([d.getFullYear(), pad(d.getMonth()+1), pad(d.getDate()), pad(d.getHours()), pad(d.getMinutes()), pad(d.getSeconds()), String(Math.floor(Math.random()*100)).padStart(2,'0')].join(''));
try { return [{ json: newManualRow($input.first().json.body || {}, sn) }]; }
catch (e) { return [{ json: { error: e.message } }]; }`), 220));
add({ name: 'Tx add: valid?', type: 'n8n-nodes-base.if', typeVersion: 2.2, position: [440, y], parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
  conditions: [{ id: 'v', leftValue: '={{ $json.error }}', rightValue: '', operator: { type: 'string', operation: 'notExists', singleValue: true } }], combinator: 'and' }, options: {} } });
link('Tx add: build row', 'Tx add: valid?');
dt('Tx add: insert', 660, { dataTableId: rl(TABLES.transactions, 'transactions'), columns: autoCols(TX_COLS), options: {} });
add({ name: 'Tx add: dedupe', type: 'n8n-nodes-base.executeWorkflow', typeVersion: 1.3, position: [880, y],
  parameters: { workflowId: rl('fKkEmIilkrKrAEx4', 'FA - Delete Duplicate Transactions'), workflowInputs: { mappingMode: 'defineBelow', value: { run: 'true' }, matchingColumns: ['run'],
    schema: [{ id: 'run', displayName: 'run', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string', removed: false }], attemptToConvertTypes: false, convertFieldsToString: true },
    options: { waitForSubWorkflow: false } } });
respond('Tx add: ok', "={{ { success: true, SN: String($('Tx add: build row').first().json.SN) } }}", 1100);
respond('Tx add: bad', fail, 660, 400);
link('Tx add: valid?', 'Tx add: insert', 0); link('Tx add: valid?', 'Tx add: bad', 1);
chain('Tx add: insert', 'Tx add: dedupe', 'Tx add: ok');

// ---- POST fa/tx-update  (merge onto existing row)
y = 600;
chain(webhook('Tx update', 'fa/tx-update', 'POST', 0),
  dt('Tx update: find', 220, { operation: 'get', dataTableId: rl(TABLES.transactions, 'transactions'), filters: bySN("={{ Number($json.body.sn) }}"), returnAll: true }, { alwaysOutputData: true }),
  code('Tx update: merge', inline(['normalize.js'], `
const ex = $input.first().json; const b = $('Tx update').first().json.body || {};
if (!ex || !ex.SN) return [{ json: { error: 'Transaction not found' } }];
const has = k => b[k] !== undefined && b[k] !== null;
return [{ json: { SN: ex.SN,
  Date: has('date') ? toIsoDate(b.date) : ex.Date, Time: has('time') ? toHHMM(b.time) : ex.Time,
  Merchant: has('merchant') ? String(b.merchant).trim() : ex.Merchant, Amount: has('amount') ? Number(b.amount) : ex.Amount,
  Category: has('category') ? normalizeCategory(b.category) : ex.Category, Tag: has('tag') ? String(b.tag) : (ex.Tag ?? '') } }];`), 440));
add({ name: 'Tx update: found?', type: 'n8n-nodes-base.if', typeVersion: 2.2, position: [660, y], parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
  conditions: [{ id: 'f', leftValue: '={{ $json.error }}', rightValue: '', operator: { type: 'string', operation: 'notExists', singleValue: true } }], combinator: 'and' }, options: {} } });
link('Tx update: merge', 'Tx update: found?');
dt('Tx update: write', 880, { operation: 'update', dataTableId: rl(TABLES.transactions, 'transactions'), filters: bySN('={{ $json.SN }}'),
  columns: autoCols(TX_COLS.filter(([c]) => ['Date','Time','Merchant','Amount','Category','Tag'].includes(c))), options: {} });
respond('Tx update: ok', ok, 1100); respond('Tx update: 404', fail, 880, 404);
link('Tx update: found?', 'Tx update: write', 0); link('Tx update: found?', 'Tx update: 404', 1); link('Tx update: write', 'Tx update: ok');

// ---- POST fa/tx-delete
y = 900;
chain(webhook('Tx delete', 'fa/tx-delete', 'POST', 0),
  dt('Tx delete: rows', 220, { operation: 'deleteRows', dataTableId: rl(TABLES.transactions, 'transactions'), matchType: 'allConditions',
    filters: bySN('={{ Number($json.body.sn) }}'), options: {} }, { alwaysOutputData: true }),
  respond('Tx delete: ok', ok, 440));

// ---- POST fa/merchant  { from, to?, category? } — all transactions + Cat-list
y = 1200;
chain(webhook('Merchant', 'fa/merchant', 'POST', 0),
  dt('Merchant: tx', 220, { operation: 'get', dataTableId: rl(TABLES.transactions, 'transactions'),
    filters: { conditions: [{ keyName: 'Merchant', keyValue: '={{ $json.body.from }}' }] }, returnAll: true }, { alwaysOutputData: true }),
  code('Merchant: tx patches', `
const b = $('Merchant').first().json.body || {};
return $input.all().map(i => i.json).filter(r => r.SN).map(r => ({ json: { SN: r.SN, Merchant: b.to || r.Merchant, Category: b.category || r.Category } }));`, 440),
  dt('Merchant: tx write', 660, { operation: 'update', dataTableId: rl(TABLES.transactions, 'transactions'), filters: bySN('={{ $json.SN }}'),
    columns: autoCols([['Merchant','string'],['Category','string']]), options: {} }, { alwaysOutputData: true }),
  dt('Merchant: cat-list', 880, { operation: 'get', dataTableId: rl(TABLES.catList, 'Cat-list'),
    filters: { conditions: [{ keyName: 'Merchant', keyValue: "={{ $('Merchant').first().json.body.from }}" }] }, returnAll: true }, { executeOnce: true, alwaysOutputData: true }),
  code('Merchant: cat-list upsert', `
const b = $('Merchant').first().json.body || {};
const rows = $input.all().map(i => i.json).filter(r => r.id);
if (!rows.length) return [{ json: { Merchant: b.to || b.from, Category: b.category || '' } }];
return rows.map(r => ({ json: { id: r.id, Merchant: b.to || r.Merchant, Category: b.category || r.Category } }));`, 1100),
  dt('Merchant: cat-list write', 1320, { operation: 'upsert', dataTableId: rl(TABLES.catList, 'Cat-list'),
    filters: { conditions: [{ keyName: 'Merchant', keyValue: "={{ $('Merchant').first().json.body.from }}" }] },
    columns: autoCols([['Merchant','string'],['Category','string']]), options: {} }, { executeOnce: true }),
  respond('Merchant: ok', "={{ { success: true, updated: $('Merchant: tx patches').all().length } }}", 1540));

// ---- POST fa/categories  { items[], rename? }
y = 1500;
chain(webhook('Categories', 'fa/categories', 'POST', 0),
  code('Categories: items', `
const b = $input.first().json.body || {};
return (b.items || []).map(c => ({ json: { ...(c.id ? { id: c.id } : {}), Name: String(c.Name).trim(), Color: c.Color ?? '#8A9490', Icon: c.Icon ?? 'Tag',
  Budget: Number(c.Budget ?? 0), Order: Number(c.Order ?? 999), Active: c.Active !== false } }));`, 220),
  dt('Categories: upsert', 440, { operation: 'upsert', dataTableId: rl(TABLES.categories, 'Categories'),
    filters: { conditions: [{ keyName: 'Name', keyValue: '={{ $json.Name }}' }] },
    columns: autoCols([['Name','string'],['Color','string'],['Icon','string'],['Budget','number'],['Order','number'],['Active','boolean']]), options: {} }, { alwaysOutputData: true }));
add({ name: 'Categories: rename?', type: 'n8n-nodes-base.if', typeVersion: 2.2, position: [660, y], executeOnce: true, parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
  conditions: [{ id: 'r', leftValue: "={{ $('Categories').first().json.body.rename?.from }}", rightValue: '', operator: { type: 'string', operation: 'notEmpty', singleValue: true } }], combinator: 'and' }, options: {} } });
link('Categories: upsert', 'Categories: rename?');
const ren = (name, x, table, tname) => dt(name, x, { operation: 'update', dataTableId: rl(table, tname),
  filters: { conditions: [{ keyName: 'Category', keyValue: "={{ $('Categories').first().json.body.rename.from }}" }] },
  columns: { mappingMode: 'defineBelow', value: { Category: "={{ $('Categories').first().json.body.rename.to }}" }, matchingColumns: [],
    schema: [{ id: 'Category', displayName: 'Category', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false }],
    attemptToConvertTypes: false, convertFieldsToString: false }, options: {} }, { executeOnce: true, alwaysOutputData: true });
ren('Categories: rename tx', 880, TABLES.transactions, 'transactions');
ren('Categories: rename cat-list', 1100, TABLES.catList, 'Cat-list');
respond('Categories: ok', ok, 1320);
link('Categories: rename?', 'Categories: rename tx', 0); link('Categories: rename?', 'Categories: ok', 1);
chain('Categories: rename tx', 'Categories: rename cat-list', 'Categories: ok');

// ---- POST fa/settings { key, value }
y = 1800;
chain(webhook('Settings', 'fa/settings', 'POST', 0),
  code('Settings: row', `const b = $input.first().json.body || {}; return [{ json: { Key: String(b.key), Value: String(b.value) } }];`, 220),
  dt('Settings: upsert', 440, { operation: 'upsert', dataTableId: rl(TABLES.settings, 'Settings'),
    filters: { conditions: [{ keyName: 'Key', keyValue: '={{ $json.Key }}' }] }, columns: autoCols([['Key','string'],['Value','string']]), options: {} }),
  respond('Settings: ok', ok, 660));

const wf = { name: 'FA - App API', nodes, connections, settings: { executionOrder: 'v1', timezone: 'Asia/Bahrain' } };
mkdirSync('n8n/.out', { recursive: true });
writeFileSync('n8n/.out/fa-app-api.json', JSON.stringify(wf, null, 1));
console.log('nodes', nodes.length);
if (process.argv.includes('--apply')) {
  const list = await api('GET', '/workflows', undefined, { limit: '250' });
  const existing = list.data.find(w => w.name === wf.name);
  if (existing) { await putWorkflow({ ...wf, id: existing.id, active: true }); console.log('updated', existing.id); }
  else { const c = await api('POST', '/workflows', wf); await api('POST', `/workflows/${c.id}/activate`); console.log('created', c.id); }
}
```

**Step 2:** Dry run: `node n8n/workflows/fa-app-api.build.mjs`. Expected: about 40 nodes. Import `n8n/.out/fa-app-api.json` mentally against the n8n Data Table node, or apply it and open it in the UI. **Open every Data Table node in the n8n UI once after applying.** If a node shows a parameter warning (most likely on `upsert` or `deleteRows` naming in this n8n version), fix it in the builder (not by hand in the UI) and re-apply.

**Step 3:** Apply: `node n8n/workflows/fa-app-api.build.mjs --apply`. Record the workflow ID in the index.

**Step 4:** Test each endpoint (bash; the key is read from `.env`, never printed):
```bash
K=$(grep -m1 '^FA_API_KEY=' .env | cut -d= -f2-); B=https://n8n.11homelab.cc/webhook
curl -s -o /dev/null -w "no key: %{http_code}\n" $B/fa/feed                       # expect 401/403
curl -s -H "X-FA-Key: $K" $B/fa/feed | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const f=JSON.parse(s);console.log(f.success,f.transactions.length,f.categories.length,f.merchants.length,f.settings)})"
SN=$(curl -s -H "X-FA-Key: $K" -H 'Content-Type: application/json' -d '{"date":"2026-10-11","time":"12:00","merchant":"ZZ TEST","amount":0.1,"category":"Other"}' $B/fa/tx-add | node -pe "JSON.parse(require('fs').readFileSync(0)).SN")
echo "created $SN"
curl -s -H "X-FA-Key: $K" -H 'Content-Type: application/json' -d "{\"sn\":\"$SN\",\"amount\":0.2}" $B/fa/tx-update
curl -s -H "X-FA-Key: $K" -H 'Content-Type: application/json' -d '{"from":"ZZ TEST","to":"ZZ TEST2","category":"Food"}' $B/fa/merchant
curl -s -H "X-FA-Key: $K" -H 'Content-Type: application/json' -d "{\"sn\":\"$SN\"}" $B/fa/tx-delete
curl -s -H "X-FA-Key: $K" -H 'Content-Type: application/json' -d '{"items":[{"Name":"ZZ Cat","Order":999}]}' $B/fa/categories
```
Expected: no key → 401 or 403. The feed prints `true ~2120 ~19 ~960 { total_budget: 600 }`. Add, update, merchant and delete each return `success: true`. Afterwards, remove the `ZZ TEST2` Cat-list row and the `ZZ Cat` category with `DELETE /data-tables/{id}/rows/delete?filter=...` through the client.

**Step 5:** Commit: `git add n8n/workflows/fa-app-api.build.mjs && git commit -m "feat(n8n): FA - App API workflow"`

### Task 4: nginx proxy with server-side key

**Files:**
- Create: `nginx/default.conf.template`
- Modify: `Dockerfile` (replace the heredoc config)
- Modify: `financial-composer.yaml` (add `FA_API_KEY`)

**Step 1:** `nginx/default.conf.template`. The official nginx image runs `envsubst` on `/etc/nginx/templates/*.template` and substitutes only defined env vars, so nginx's own `$uri` etc. are left alone.
```nginx
server {
    listen 80;
    server_name localhost;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    location /api/fa/ {
        rewrite ^/api/fa/(.*)$ /webhook/fa/$1 break;
        proxy_pass https://n8n.11homelab.cc;
        proxy_set_header Host n8n.11homelab.cc;
        proxy_set_header X-FA-Key "${FA_API_KEY}";
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_ssl_server_name on;
        proxy_read_timeout 30s;
        add_header Cache-Control "no-store";
    }

    location = /sw.js { root /usr/share/nginx/html; add_header Cache-Control "no-cache"; }
    location = /index.html { root /usr/share/nginx/html; add_header Cache-Control "no-cache"; }

    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2)$ { expires 1y; add_header Cache-Control "public, immutable"; }
    }

    location /health { access_log off; return 200 "healthy\n"; add_header Content-Type text/plain; }

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```
Note: the old `/api/` → `/webhook/api/` block is dropped. The current app doesn't use it, because it calls n8n directly.

**Step 2:** In `Dockerfile`, delete the whole `COPY <<EOF … EOF` block and add:
```dockerfile
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
```
Also bump the builder to `node:20-alpine` (vite-plugin-pwa in P4 needs Node 18.17+, and 20 is safer).

**Step 3:** In `financial-composer.yaml`, under `financial-app.environment`, add `- FA_API_KEY=${FA_API_KEY}`.

**Step 4:** Vite dev proxy, so `npm run dev` works the same way. In `vite.config.ts`:
```ts
import { defineConfig, loadEnv } from "vite";
// ...
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');   // FA_API_KEY from .env.local (not VITE_-prefixed → never bundled)
  return {
    server: {
      host: "::", port: 8080,
      proxy: { '/api/fa': { target: 'https://n8n.11homelab.cc', changeOrigin: true,
        rewrite: p => p.replace(/^\/api\/fa/, '/webhook/fa'), headers: { 'X-FA-Key': env.FA_API_KEY || '' } } },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  };
});
```

**Step 5:** Build and run locally against the template, without deploying yet:
```bash
docker compose -f financial-composer.yaml build financial-app
docker compose -f financial-composer.yaml up -d financial-app
curl -s http://localhost:3002/api/fa/feed | head -c 200
```
Expected: JSON starting `{"success":true,"generatedAt":…`. This also redeploys the *current* UI, which is unchanged apart from nginx. Check that https://fa.11homelab.cc still works.

**Step 6:** Check that the key isn't in the bundle: `docker exec financial-app sh -c "grep -rl X-FA-Key /usr/share/nginx/html || echo clean"`. Expected: `clean`.

**Step 7:** Commit: `git add nginx Dockerfile financial-composer.yaml vite.config.ts && git commit -m "feat: nginx proxy for App API with server-side key"`

### Task 5: Secure the iPhone Shortcut webhook (needs the user's phone)

**Step 1:** Tell the user what will happen. Once `addNewTransaction` requires the key, the Shortcut fails until they add a header. Give them the exact steps: in the Shortcut, open "Get contents of URL" → Headers → add `X-FA-Key` = (the value from `.env`). Show the value **only if they ask**, and suggest they copy it from the file on the PC instead.

**Step 2 (after they confirm the header is added):** Patch `From iPhone (Webhook)` in `I3EaJw8o1YNfkleN`: set `parameters.authentication = 'headerAuth'` and `credentials = { httpHeaderAuth: { id: IDS.credFaKey, name: 'FA App Key' } }`. Use a small script modelled on `p2-add-transaction.mjs`, then apply.

**Step 3:** Ask the user to run the Shortcut with a real SMS. Expected: the normal Telegram reply. Check that a POST without the header now returns 401/403.

**Step 4:** Commit the script. Update `docs/SYSTEM-MAP.md` §3 and §5 (no auth → key required). P3 is done; tell the user.
