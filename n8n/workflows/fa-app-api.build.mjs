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
const ifNode = (name, x, leftValue, operation, extra = {}) => add({ name, type: 'n8n-nodes-base.if', typeVersion: 2.2, position: [x, y], ...extra,
  parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
    conditions: [{ id: randomUUID(), leftValue, rightValue: '', operator: { type: 'string', operation, singleValue: true } }], combinator: 'and' }, options: {} } });
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
catch (e) { return [{ json: { error: e.message } }]; }`), 220),
  ifNode('Tx add: valid?', 440, '={{ $json.error }}', 'notExists'));
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
  dt('Tx update: find', 220, { operation: 'get', dataTableId: rl(TABLES.transactions, 'transactions'), matchType: 'allConditions',
    filters: bySN("={{ Number($json.body.sn) }}"), returnAll: true }, { alwaysOutputData: true }),
  code('Tx update: merge', inline(['normalize.js'], `
const ex = $input.first().json; const b = $('Tx update').first().json.body || {};
if (!ex || !ex.SN) return [{ json: { error: 'Transaction not found' } }];
const has = k => b[k] !== undefined && b[k] !== null;
return [{ json: { SN: ex.SN,
  Date: has('date') ? toIsoDate(b.date) : ex.Date, Time: has('time') ? toHHMM(b.time) : ex.Time,
  Merchant: has('merchant') ? String(b.merchant).trim() : ex.Merchant, Amount: has('amount') ? Number(b.amount) : ex.Amount,
  Category: has('category') ? normalizeCategory(b.category) : ex.Category, Tag: has('tag') ? String(b.tag) : (ex.Tag ?? '') } }];`), 440),
  ifNode('Tx update: found?', 660, '={{ $json.error }}', 'notExists'));
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
  dt('Merchant: tx', 220, { operation: 'get', dataTableId: rl(TABLES.transactions, 'transactions'), matchType: 'allConditions',
    filters: { conditions: [{ keyName: 'Merchant', keyValue: '={{ $json.body.from }}' }] }, returnAll: true }, { alwaysOutputData: true }),
  // no matching transactions → one no-op patch (SN -1) so the chain still reaches the Cat-list step and the response
  code('Merchant: tx patches', `
const b = $('Merchant').first().json.body || {};
const out = $input.all().map(i => i.json).filter(r => r.SN).map(r => ({ json: { SN: r.SN, Merchant: b.to || r.Merchant, Category: b.category || r.Category } }));
return out.length ? out : [{ json: { SN: -1, Merchant: '', Category: '' } }];`, 440),
  dt('Merchant: tx write', 660, { operation: 'update', dataTableId: rl(TABLES.transactions, 'transactions'), filters: bySN('={{ $json.SN }}'),
    columns: autoCols([['Merchant','string'],['Category','string']]), options: {} }, { alwaysOutputData: true }),
  dt('Merchant: cat-list', 880, { operation: 'get', dataTableId: rl(TABLES.catList, 'Cat-list'), matchType: 'allConditions',
    filters: { conditions: [{ keyName: 'Merchant', keyValue: "={{ $('Merchant').first().json.body.from }}" }] }, returnAll: true }, { executeOnce: true, alwaysOutputData: true }),
  code('Merchant: cat-list upsert', `
const b = $('Merchant').first().json.body || {};
const rows = $input.all().map(i => i.json).filter(r => r.id);
if (!rows.length) return [{ json: { Merchant: b.to || b.from, Category: b.category || '' } }];
return rows.map(r => ({ json: { Merchant: b.to || r.Merchant, Category: b.category || r.Category } }));`, 1100),
  dt('Merchant: cat-list write', 1320, { operation: 'upsert', dataTableId: rl(TABLES.catList, 'Cat-list'),
    filters: { conditions: [{ keyName: 'Merchant', keyValue: "={{ $('Merchant').first().json.body.from }}" }] },
    columns: autoCols([['Merchant','string'],['Category','string']]), options: {} }, { executeOnce: true }),
  respond('Merchant: ok', "={{ { success: true, updated: $('Merchant: tx patches').all().filter(i => i.json.SN > 0).length } }}", 1540));

// ---- POST fa/categories  { items[], rename? }
y = 1500;
chain(webhook('Categories', 'fa/categories', 'POST', 0),
  // rename-only requests send no items → a marker item that skips the upsert
  code('Categories: items', `
const b = $input.first().json.body || {};
const items = (b.items || []).filter(c => String(c.Name ?? '').trim()).map(c => ({ json: { ...(c.id ? { id: c.id } : {}), Name: String(c.Name).trim(), Color: c.Color ?? '#8A9490', Icon: c.Icon ?? 'Tag',
  Budget: Number(c.Budget ?? 0), Order: Number(c.Order ?? 999), Active: c.Active !== false } }));
return items.length ? items : [{ json: { none: true } }];`, 220),
  ifNode('Categories: any?', 440, '={{ $json.none }}', 'notExists'));
dt('Categories: upsert', 660, { operation: 'upsert', dataTableId: rl(TABLES.categories, 'Categories'),
  filters: { conditions: [{ keyName: 'Name', keyValue: '={{ $json.Name }}' }] },
  columns: autoCols([['Name','string'],['Color','string'],['Icon','string'],['Budget','number'],['Order','number'],['Active','boolean']]), options: {} }, { alwaysOutputData: true });
ifNode('Categories: rename?', 880, "={{ $('Categories').first().json.body.rename?.from }}", 'notEmpty', { executeOnce: true });
link('Categories: any?', 'Categories: upsert', 0); link('Categories: any?', 'Categories: rename?', 1); link('Categories: upsert', 'Categories: rename?');
const ren = (name, x, table, tname) => dt(name, x, { operation: 'update', dataTableId: rl(table, tname),
  filters: { conditions: [{ keyName: 'Category', keyValue: "={{ $('Categories').first().json.body.rename.from }}" }] },
  columns: { mappingMode: 'defineBelow', value: { Category: "={{ $('Categories').first().json.body.rename.to }}" }, matchingColumns: [],
    schema: [{ id: 'Category', displayName: 'Category', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false }],
    attemptToConvertTypes: false, convertFieldsToString: false }, options: {} }, { executeOnce: true, alwaysOutputData: true });
ren('Categories: rename tx', 1100, TABLES.transactions, 'transactions');
ren('Categories: rename cat-list', 1320, TABLES.catList, 'Cat-list');
respond('Categories: ok', ok, 1540);
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
