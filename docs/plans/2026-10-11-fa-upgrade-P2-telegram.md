# FA Upgrade P2 — Telegram upgrades

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Read the index first. P1 must be done (the `Categories` table, the `Payee_IBAN`/`Source` columns and the `TABLES.categories` ID exist).

**Goal:** Make "FA - add transaction" (`I3EaJw8o1YNfkleN`) smarter without changing how it looks or how fast it is:
- parse the Fawri+ IBAN and skip incoming money
- suggest the top 3 merchants as buttons under the **existing** "Fawri Payment Detected!" message, plus `✏️ Other…`
- build the category picker from the `Categories` table, with `➕ New category`
- take the bot token out of the workflow JSON

**Phase start:** `node n8n/scripts/backup.mjs` → add a "P2 start" row to `docs/plans/backup-log.md`. Also copy `C:\Data\n8n\docker-compose.yaml` and `.env` into that snapshot folder before Task 4.
**Phase end:** back up again and add a "P2 end, rollback point" row.
**Undo:** `docs/ROLLBACK.md`, row P2. The fastest emergency revert of the Telegram flow is `node n8n/scripts/restore.mjs --dir <P2-start snapshot> --workflow I3EaJw8o1YNfkleN --apply`.

**Message style rule:** keep today's text exactly (emoji, `<b>Label:</b>` lines, `📝 <b>Transaction ID:</b> <code>SN</code>`). Only add the `🏦 <b>IBAN:</b> ••NNNN` line and change the closing prompt.

**Approach:** pure logic in `n8n/code/` (tested), inlined into Code nodes by `n8n/scripts/inline.mjs`. Workflow edits are made by a patch script that **clones existing nodes as templates**, which keeps their `typeVersion` and credentials. It writes a preview to `n8n/.out/` and PUTs only with `--apply`.

---

### Task 1: SMS parser (TDD)

**Files:**
- Create: `n8n/code/sms-parser.js`
- Test: `n8n/code/sms-parser.test.js`

**Step 1: Write the failing test.** The fixtures are real messages with phone numbers removed.
```js
// n8n/code/sms-parser.test.js
import { describe, it, expect } from 'vitest';
import { parseSms } from './sms-parser.js';

const NOW = new Date('2026-10-11T10:00:00+03:00');
const CARD = 'Dear YUSUF, thank you for using your VISA card 4120 for BHD 5.020 at CENTER POINT EAST RIFFA BH-123456 on 10/10 @18:39. Avail Bal BHD 731.176. Tel 17000000';
const CARD_FX = 'Dear YUSUF, thank you for using your VISA card 4120 for AED 313.26 at Mumzworld FZ LLC Dubai AE-047093 on 10/10 @22:23. Avail Bal BHD 697.957. Tel 17000000';
const FAWRI = 'Fawri+ payment BHD6.700, ref: BIB103KA1003TDBR was credited to IBAN ending 6743 on 2026/10/08 21:19. Balance BHD256.292. Tel: 17000000';
const FAWRI_2SP = 'Fawri+ payment BHD161.110, ref: BIB103K9M001G8R1 credited to IBAN ending  5108 on 2026/09/23 14:08. Fee & VAT: BD 0.110. Bal: BHD711.357. Tel: 17000000';
const FAWRI_PHONE = 'Fawri+ payment BHD8.000, ref: BIB103KA3004ZZZD was credited to IBAN ending 0000 on 2026/10/10 19:59. Balance BHD246.342. Tel: 17000000';
const INCOMING = 'Fawri+ payment BHD5.875 received from IBAN 0000 to IBAN 2391 ref. ALS103K9W005O1XF on 2026/10/03 19:41. Balance BHD309.592. Tel 17000000';

describe('parseSms', () => {
  it('parses a card purchase like the current parser', () => {
    expect(parseSms(CARD, NOW)).toMatchObject({
      Date: '2026-10-10', Time: '18:39', Merchant: 'CENTER POINT EAST RIFFA', Amount: 5.02, Currency: 'BHD',
      Name: 'YUSUF', CardEnding: '4120', Source: 'sms', Payee_IBAN: '', _isFawri: false, _isIncoming: false,
    });
  });
  it('keeps the foreign currency for the converter and the merchant suffix', () => {
    expect(parseSms(CARD_FX, NOW)).toMatchObject({ Amount: 313.26, Currency: 'AED', Merchant: 'MUMZWORLD FZ LLC DUBAI AE-047093' });
  });
  it('parses Fawri+ with IBAN', () => {
    expect(parseSms(FAWRI, NOW)).toMatchObject({
      Date: '2026-10-08', Time: '21:19', Merchant: 'FAWRI_PENDING', Amount: 6.7, Currency: 'BHD',
      Name: 'Card', Payee_IBAN: '6743', Source: 'fawri', _isFawri: true, _isIncoming: false,
    });
  });
  it('tolerates the double space and fee text', () => {
    expect(parseSms(FAWRI_2SP, NOW)).toMatchObject({ Payee_IBAN: '5108', Amount: 161.11, Date: '2026-09-23', Time: '14:08' });
  });
  it('keeps 0000 IBAN (phone payment)', () => {
    expect(parseSms(FAWRI_PHONE, NOW).Payee_IBAN).toBe('0000');
  });
  it('flags incoming money', () => {
    expect(parseSms(INCOMING, NOW)).toMatchObject({ _isIncoming: true, Amount: 5.875, Payee_IBAN: '2391' });
  });
  it('handles empty input', () => {
    expect(parseSms('', NOW)).toMatchObject({ Amount: 0, Merchant: ' ', _isFawri: false, _isIncoming: false });
  });
});
```

**Step 2:** Run `npx vitest run n8n/code/sms-parser.test.js`. Expected: FAIL (module missing).

**Step 3: Implement.** This is a faithful port of the live "Parse (Code)" node plus the Fawri fields. It takes no SN and no clock, so it's testable.
```js
// n8n/code/sms-parser.js
export function parseSms(raw, now = new Date()) {
  const sms = String(raw || '').replace(/\u00A0/g, ' ').replace(/\s{2,}/g, ' ').trim();
  const base = { Date: now.toISOString().slice(0, 10), Time: '', Merchant: ' ', Amount: 0, Currency: '', Category: '',
    Tag: '', Name: 'Card', CardEnding: '', Payee_IBAN: '', Source: 'sms', _isFawri: false, _isIncoming: false, _originalSMS: sms };
  if (!sms) return base;

  const isFawri = /^Fawri\+?\s/i.test(sms);
  const isIncoming = isFawri && /received from IBAN/i.test(sms);

  let dateStr = base.Date;
  const mYmd = sms.match(/(\d{4})\/(\d{2})\/(\d{2})/);
  const mOnDdMm = sms.match(/on\s+(\d{2})\/(\d{2})/i);
  if (mYmd) dateStr = `${mYmd[1]}-${mYmd[2]}-${mYmd[3]}`;
  else if (mOnDdMm) dateStr = `${now.getFullYear()}-${mOnDdMm[2]}-${mOnDdMm[1]}`;

  let timeStr = '';
  const mAt = sms.match(/@(\d{1,2}:\d{2})/);
  const mYmdTime = sms.match(/(\d{4}\/\d{2}\/\d{2})\s+(\d{1,2}:\d{2})/);
  const mAnyTime = sms.match(/\b(\d{1,2}:\d{2})\b/);
  if (mAt) timeStr = mAt[1]; else if (mYmdTime) timeStr = mYmdTime[2]; else if (mAnyTime) timeStr = mAnyTime[1];
  if (/^\d:/.test(timeStr)) timeStr = '0' + timeStr;

  let amount = 0, currency = '';
  let mAmt = sms.match(/for\s+([A-Z]{3})\s?(\d+(?:\.\d{1,3})?)/i);
  if (!mAmt) mAmt = sms.match(/(?:^|\s)([A-Z]{3})\s?(\d+(?:\.\d{1,3})?)(?!\d)/i);
  if (mAmt) { currency = mAmt[1].toUpperCase(); amount = parseFloat(mAmt[2].replace(/,/g, '')); }

  let name = 'Card';
  const mName = sms.match(/Dear\s+([A-Z]+)/i);
  if (mName) name = mName[1].trim();

  let merchant = ' ';
  if (!isFawri) {
    const mMerch = sms.match(/at\s+(.+?)\s+(?:on\s+\d{1,2}\/\d{2}|@\d{1,2}:\d{2}|\.)/i) || sms.match(/at\s+(.+?)\s+(on|@)/i);
    if (mMerch) merchant = (mMerch[1] || '').trim().replace(/\s+(?:R?BH-\d+)\s*$/i, '').replace(/\s+BAHRAIN\s*$/i, '').replace(/\s{2,}/g, ' ').trim() || ' ';
  } else merchant = 'FAWRI_PENDING';
  merchant = merchant.toUpperCase();

  let card4 = '';
  const mCard = sms.match(/card(?:\s+\w+)?\s+(\d{4})/i);
  if (mCard) card4 = mCard[1];

  let iban = '';
  const mIban = isIncoming ? sms.match(/to IBAN\s+(\d{4})/i) : sms.match(/IBAN ending\s+(\d{4})/i);
  if (mIban) iban = mIban[1];

  return { ...base, Date: dateStr, Time: timeStr, Merchant: merchant, Amount: Number.isFinite(amount) ? amount : 0,
    Currency: currency, Name: name, CardEnding: card4, Payee_IBAN: iban, Source: isFawri ? 'fawri' : 'sms',
    _isFawri: isFawri && !isIncoming, _isIncoming: isIncoming };
}
```
Note: the double space is collapsed by the whitespace normalisation before the IBAN regex runs. That's why `FAWRI_2SP` works.

**Step 4:** Run the test. Expected: PASS. If the card test fails on `Time`, compare with the live node's behaviour. The port must match it for card SMS.

**Step 5:** Commit: `git add n8n/code/sms-parser.* && git commit -m "feat(n8n): sms parser with Fawri IBAN + incoming detection"`

### Task 2: Merchant suggestion scorer (TDD)

**Files:**
- Create: `n8n/code/suggest.js`
- Test: `n8n/code/suggest.test.js`

**Step 1: Write the failing test**
```js
// n8n/code/suggest.test.js
import { describe, it, expect } from 'vitest';
import { suggestMerchants } from './suggest.js';

const NOW = new Date('2026-10-11T12:00:00Z');
const row = (Merchant, Amount, Date, Time, Payee_IBAN = '', Source = 'fawri') => ({ Merchant, Amount, Date, Time, Payee_IBAN, Source });
const history = [
  row('KRK HUT', 6.5, '2026-10-01', '21:00', '6743'),
  row('KRK HUT', 6.9, '2026-09-20', '20:30', '6743'),
  row('CHAI ZALAQ', 6.7, '2026-10-05', '21:10', '0000'),
  row('ORANGE LAUNDRY', 3.0, '2026-10-06', '10:00', '1111'),
  row('ORANGE LAUNDRY', 3.0, '2026-09-29', '10:00', '1111'),
  row('ORANGE LAUNDRY', 3.0, '2026-09-22', '10:00', '1111'),
  row('VEGETABLE', 4.5, '2026-10-10', '20:59', ''),
  row('LULU', 6.7, '2026-10-01', '21:00', '', 'sms'),          // not fawri → ignored
  row('FAWRI_PENDING', 6.7, '2026-10-01', '21:00', '6743'),    // placeholder → ignored
];

describe('suggestMerchants', () => {
  it('ranks the same IBAN first', () => {
    const r = suggestMerchants(history, { iban: '6743', amount: 6.7, time: '21:19' }, NOW);
    expect(r[0]).toBe('KRK HUT');
    expect(r).toHaveLength(3);
  });
  it('ignores IBAN 0000 and uses amount/time', () => {
    const r = suggestMerchants(history, { iban: '0000', amount: 6.7, time: '21:15' }, NOW);
    expect(r.slice(0, 2)).toEqual(expect.arrayContaining(['CHAI ZALAQ', 'KRK HUT']));
  });
  it('never suggests non-fawri or placeholder merchants', () => {
    const r = suggestMerchants(history, { iban: '6743', amount: 6.7, time: '21:00' }, NOW);
    expect(r).not.toContain('LULU');
    expect(r).not.toContain('FAWRI_PENDING');
  });
  it('returns unique names, max limit', () => {
    const r = suggestMerchants(history, { iban: '', amount: 3, time: '10:00' }, NOW, 2);
    expect(new Set(r).size).toBe(r.length);
    expect(r).toHaveLength(2);
    expect(r[0]).toBe('ORANGE LAUNDRY');
  });
  it('handles empty history', () => {
    expect(suggestMerchants([], { iban: '1', amount: 1, time: '' }, NOW)).toEqual([]);
  });
});
```

**Step 2:** Run `npx vitest run n8n/code/suggest.test.js`. Expected: FAIL.

**Step 3: Implement**
```js
// n8n/code/suggest.js — rank past Fawri payees for a new Fawri payment
const SKIP = new Set(['', 'FAWRI_PENDING']);
const mins = t => { const m = String(t || '').match(/^(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : null; };
const isFawriRow = r => r.Source ? r.Source === 'fawri' : (r.Name === 'Benefit' || (r.Name === 'Card' && !r.Card_ending));

export function suggestMerchants(history, { iban, amount, time }, now = new Date(), limit = 3) {
  const realIban = iban && iban !== '0000' ? iban : null;
  const t0 = mins(time);
  const byMerchant = new Map();
  for (const r of history) {
    const name = String(r.Merchant || '').trim().toUpperCase();
    if (SKIP.has(name) || !isFawriRow(r)) continue;
    const ageDays = (now - new Date(r.Date + 'T00:00:00Z')) / 864e5;
    const s = byMerchant.get(name) || { name, iban: 0, amt: 0, tod: 0, recent: 0, count: 0, last: Infinity };
    s.count++;
    if (realIban && r.Payee_IBAN === realIban) s.iban++;
    if (amount > 0) s.amt = Math.max(s.amt, Math.max(0, 1 - Math.abs(Number(r.Amount) - amount) / amount));
    const tr = mins(r.Time);
    if (t0 != null && tr != null) { const d = Math.min(Math.abs(tr - t0), 1440 - Math.abs(tr - t0)); s.tod = Math.max(s.tod, Math.max(0, 1 - d / 180)); }
    if (ageDays <= 90) s.recent++;
    s.last = Math.min(s.last, ageDays);
    byMerchant.set(name, s);
  }
  const score = s => 10 * s.iban + 3 * s.amt + 1 * s.tod + Math.min(2, s.recent / 5) + (s.last <= 30 ? 0.5 : 0);
  return [...byMerchant.values()]
    .sort((a, b) => score(b) - score(a) || b.count - a.count)
    .slice(0, limit)
    .map(s => s.name);
}
```

**Step 4:** Run the test. Expected: PASS. If the `0000` test is flaky because of tie-breaking, adjust the fixture times. Don't add special cases to the scorer.

**Step 5:** Back-test against real data, which shows how good the guesses are without any IBAN history:
```bash
node -e "
import('./n8n/scripts/n8n-client.mjs').then(async m=>{
 const {suggestMerchants}=await import('./n8n/code/suggest.js');
 const rows=(await m.allRows(m.TABLES.transactions)).filter(r=>r.Source==='fawri'&&r.Merchant&&r.Merchant!=='FAWRI_PENDING').sort((a,b)=>a.Date<b.Date?-1:1);
 let hit=0,n=0; for(let i=50;i<rows.length;i++){const past=rows.slice(0,i);const r=rows[i];const s=suggestMerchants(past,{iban:r.Payee_IBAN,amount:r.Amount,time:r.Time},new Date(r.Date));n++;if(s.includes(String(r.Merchant).toUpperCase()))hit++}
 console.log('top-3 hit rate',(100*hit/n).toFixed(1)+'%',n)})"
```
Record the number in the commit message. It's the baseline before any IBAN data has built up.

**Step 6:** Commit: `git add n8n/code/suggest.* && git commit -m "feat(n8n): Fawri merchant suggestion scorer (baseline top-3 hit X%)"`

### Task 3: Inline builder and workflow patch helpers

**Files:**
- Create: `n8n/scripts/inline.mjs`
- Create: `n8n/scripts/wf-edit.mjs`

**Step 1:** `inline.mjs` turns lib files into Code-node source:
```js
// n8n/scripts/inline.mjs — inline(['sms-parser.js'], footerSource) → Code node JS (no imports/exports)
import { readFileSync } from 'node:fs';
const CODE_DIR = new URL('../code/', import.meta.url);
export function inline(libs, footer) {
  const body = libs.map(f => readFileSync(new URL(f, CODE_DIR), 'utf8')
    .replace(/^import .*$/gm, '')
    .replace(/^export (function|const|let|class) /gm, '$1 ')).join('\n');
  return `// ---- generated from n8n/code: ${libs.join(', ')} — edit there, not here ----\n${body}\n// ---- node logic ----\n${footer.trim()}\n`;
}
```

**Step 2:** `wf-edit.mjs` holds the graph helpers:
```js
// n8n/scripts/wf-edit.mjs — small helpers to edit workflow JSON safely
import { randomUUID } from 'node:crypto';
export const node = (wf, name) => { const n = wf.nodes.find(n => n.name === name); if (!n) throw new Error('no node ' + name); return n; };
export function clone(wf, templateName, newName, patch = {}, dx = 0, dy = 220) {
  if (wf.nodes.some(n => n.name === newName)) return node(wf, newName);          // idempotent
  const t = structuredClone(node(wf, templateName));
  const n = { ...t, ...patch, id: randomUUID(), name: newName, position: [t.position[0] + dx, t.position[1] + dy] };
  if (patch.parameters) n.parameters = patch.parameters;
  delete n.webhookId;
  wf.nodes.push(n); return n;
}
export function connect(wf, from, to, fromIndex = 0) {
  wf.connections[from] ??= { main: [] };
  const outs = wf.connections[from].main;
  while (outs.length <= fromIndex) outs.push([]);
  if (!outs[fromIndex].some(c => c.node === to)) outs[fromIndex].push({ node: to, type: 'main', index: 0 });
}
export function disconnect(wf, from, to) {
  for (const outs of wf.connections[from]?.main || []) {
    const i = (outs || []).findIndex(c => c.node === to); if (i >= 0) outs.splice(i, 1);
  }
}
export function setCode(wf, name, js) { node(wf, name).parameters.jsCode = js; }
```

**Step 3:** Commit: `git add n8n/scripts/inline.mjs n8n/scripts/wf-edit.mjs && git commit -m "feat(n8n): inline + workflow edit helpers"`

### Task 4: Move the bot token out of the workflow (needs user approval)

The "Ask for Category" HTTP node has the bot token typed into its URL. n8n **2.29.8** blocks `$env` in nodes by default.

**Step 1:** Ask the user: "To remove the bot token from the workflow I'll add `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` and `FA_TG_BOT_TOKEN=<token>` to `C:\Data\n8n\docker-compose.yaml` (via its `.env`) and restart n8n. That takes about 30 seconds of downtime. OK?" Also ask whether they want to rotate the token now with BotFather `/revoke`. If yes, they paste the new token **into the `.env` file themselves**, so it never goes into chat. They also update the n8n Telegram credential used by this workflow.

**Step 2 (after yes):** Back up `C:\Data\n8n\docker-compose.yaml` and its `.env`. Add the two variables to the n8n service's `environment:` (value via `${FA_TG_BOT_TOKEN}` from `.env`). Then:
```bash
docker compose -f C:/Data/n8n/docker-compose.yaml up -d n8n
```
Verify: `docker exec n8n printenv FA_TG_BOT_TOKEN | wc -c` prints a number greater than 40. Don't print the value.

**Step 3:** All HTTP Telegram calls in this phase use the URL `=https://api.telegram.org/bot{{ $env.FA_TG_BOT_TOKEN }}/<method>`. Task 5 changes "Ask for Category" to use it.

**If the user declines:** keep the literal-token pattern for the new HTTP nodes (clone "Ask for Category" unchanged) and record "token still inline" as an open item.

### Task 5: Patch "FA - add transaction"

**Files:**
- Create: `n8n/workflows/p2-add-transaction.mjs`

Run `node n8n/scripts/backup.mjs` first.

**Step 1:** Write the patch script. Read it top to bottom against the live workflow before running it.
```js
// n8n/workflows/p2-add-transaction.mjs — usage: node p2-add-transaction.mjs [--apply]
import { writeFileSync, mkdirSync } from 'node:fs';
import { getWorkflow, putWorkflow, TABLES } from '../scripts/n8n-client.mjs';
import { inline } from '../scripts/inline.mjs';
import { node, clone, connect, disconnect, setCode } from '../scripts/wf-edit.mjs';

const ID = 'I3EaJw8o1YNfkleN';
const TG = '=https://api.telegram.org/bot{{ $env.FA_TG_BOT_TOKEN }}';
const wf = await getWorkflow(ID);

// 1) Parser: shared lib + node footer (SN generation stays in n8n)
setCode(wf, 'Parse (Code)', inline(['sms-parser.js'], `
function pad(n){ return n.toString().padStart(2,'0'); }
function genSN(){ const d=new Date(); return Number([d.getFullYear(),pad(d.getMonth()+1),pad(d.getDate()),pad(d.getHours()),pad(d.getMinutes()),pad(d.getSeconds()),Math.floor(Math.random()*100).toString().padStart(2,'0')].join('')); }
const out = parseSms($('set Msg').first().json.msg, new Date());
return [{ json: { SN: genSN(), ...out } }];`));

// 2) Incoming money: Parse → IF incoming → note ; else → Currency Convert
clone(wf, 'Is Fawri Payment?', 'Is Incoming?', { parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
  conditions: [{ id: 'incoming', leftValue: "={{ $json._isIncoming }}", rightValue: true, operator: { type: 'boolean', operation: 'true' } }], combinator: 'and' }, options: {} } }, 0, -260);
clone(wf, 'Send not Registered', 'Send Incoming Note', { parameters: { chatId: '=1804897276',
  text: "=💸 <b>Incoming payment</b>\n\n💰 <b>Amount:</b> {{ $json.Amount }} {{ $json.Currency }}\n📅 <b>Date:</b> {{ $json.Date }} {{ $json.Time }}\n\n<i>Not logged as spending.</i>",
  additionalFields: { appendAttribution: false, parse_mode: 'HTML' } } }, 0, -260);
disconnect(wf, 'Parse (Code)', 'Currency Convert to BHD');
connect(wf, 'Parse (Code)', 'Is Incoming?');
connect(wf, 'Is Incoming?', 'Send Incoming Note', 0);
connect(wf, 'Is Incoming?', 'Currency Convert to BHD', 1);

// 3) Store Payee_IBAN + Source on insert
const store = node(wf, 'intial Store transaction').parameters.columns;
store.value.Payee_IBAN = '={{ $json.Payee_IBAN }}';
store.value.Source = '={{ $json.Source }}';
for (const id of ['Payee_IBAN', 'Source']) if (!store.schema.some(s => s.id === id))
  store.schema.push({ id, displayName: id, required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false });

// 4) Fawri: suggestions instead of force-reply. Is Fawri?[true] → Load history → Load Cat-list → Suggest → Ask (buttons)
disconnect(wf, 'Is Fawri Payment?', 'Ask for Merchant Name');
clone(wf, 'Lookup for SN', 'Load Fawri History', { parameters: { operation: 'get', dataTableId: node(wf, 'Lookup for SN').parameters.dataTableId,
  filters: { conditions: [{ keyName: 'Source', keyValue: 'fawri' }] }, returnAll: true }, executeOnce: true, alwaysOutputData: true }, 0, 300);
clone(wf, 'Get Cat-list', 'Load Cat-list for Suggest', { executeOnce: true, alwaysOutputData: true }, 0, 300);
clone(wf, 'Search in Cat-list', 'Suggest Merchants', { parameters: { jsCode: inline(['suggest.js'], `
function norm(s=''){return String(s).toUpperCase().replace(/\\s+/g,' ').trim();}
const tx = $('Currency Convert to BHD').first().json;
const history = $('Load Fawri History').all().map(i => i.json).filter(r => r.SN !== tx.SN);
const cat = $('Load Cat-list for Suggest').all().map(i => i.json);
const idOf = new Map(cat.map(r => [norm(r.Merchant), r.id]));
const names = suggestMerchants(history, { iban: tx.Payee_IBAN, amount: tx.Amount, time: tx.Time }, new Date(), 6)
  .filter(n => idOf.has(norm(n))).slice(0, 3);
const rows = names.map(n => [{ text: n, callback_data: 'fm|' + tx.SN + '|' + idOf.get(norm(n)) }]);
rows.push([{ text: '✏️ Other…', callback_data: 'fo|' + tx.SN }]);
return [{ json: { ...tx, inlineKeyboard: rows } }];`) } }, 0, 300);
clone(wf, 'Ask for Category', 'Ask for Merchant (buttons)', { parameters: { ...structuredClone(node(wf, 'Ask for Category').parameters),
  url: TG + '/sendMessage',
  jsonBody: `={{ {
  "chat_id": 1804897276,
  "parse_mode": "HTML",
  "text": "💳 <b>Fawri Payment Detected!</b>\\n\\n💰 <b>Amount:</b> " + $json.Amount + " " + $json.Currency + "\\n📅 <b>Date:</b> " + $json.Date + " " + $json.Time + "\\n🏦 <b>IBAN:</b> ••" + ($json.Payee_IBAN || '----') + "\\n\\n📝 <b>Transaction ID:</b> <code>" + $json.SN + "</code>\\n\\n👉 <b>Pick the merchant, or tap Other to type it.</b>",
  "reply_markup": { "inline_keyboard": $json.inlineKeyboard }
} }}` } }, 0, 300);
connect(wf, 'Is Fawri Payment?', 'Load Fawri History', 0);
connect(wf, 'Load Fawri History', 'Load Cat-list for Suggest');
connect(wf, 'Load Cat-list for Suggest', 'Suggest Merchants');
connect(wf, 'Suggest Merchants', 'Ask for Merchant (buttons)');

// 5) Router: new callback/reply types
setCode(wf, 'right callback OR msg authinticate', `
const item = $input.first().json;
const cb = item.callback_query;
if (cb && cb.data) {
  const d = cb.data;
  const kind = d.startsWith('fm|') ? 'fawriPick' : d.startsWith('fo|') ? 'fawriOther' : d.startsWith('cat_new|') ? 'catNew' : 'categoryInput';
  return [{ json: { ...item, msg: kind } }];
}
if (item.message && item.message.text) {
  const text = item.message.text;
  if (text.startsWith('/')) return [];
  const replied = item.message.reply_to_message?.text || '';
  const sn = (replied.match(/Transaction ID:\\s*(\\d+)/) || [])[1] || null;
  if (replied.includes('Send the new category name')) {
    return [{ json: { ...item, msg: 'newCategoryName', transactionId: sn, categoryName: text.trim() } }];
  }
  return [{ json: { ...item, msg: 'MerchantInput', transactionId: sn, merchantName: text.trim(), requiresManualLink: !sn } }];
}
return [];`);
// Remove the "If" gate; Switch does the routing
disconnect(wf, 'right callback OR msg authinticate', 'If');
disconnect(wf, 'If', 'Switch');
connect(wf, 'right callback OR msg authinticate', 'Switch');
const sw = node(wf, 'Switch').parameters.rules.values;
const rule = (key) => ({ conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
  conditions: [{ id: 'r-' + key, leftValue: '={{ $json.msg }}', rightValue: key, operator: { type: 'string', operation: 'equals' } }], combinator: 'and' },
  renameOutput: true, outputKey: key });
for (const k of ['fawriPick', 'fawriOther', 'catNew', 'newCategoryName']) if (!sw.some(r => r.outputKey === k)) sw.push(rule(k));
const out = k => sw.findIndex(r => r.outputKey === k);

// 6) fawriPick: delete suggestion msg → parse → get Cat-list row → resolve
clone(wf, 'Acknowledge Selection', 'Delete Suggestions', {}, 0, 400);
clone(wf, 'Process Category Selection', 'Parse Fawri Pick', { parameters: { jsCode: `
const cb = $('Switch').first().json.callback_query;
const [, sn, catId] = cb.data.split('|');
return [{ json: { SN: Number(sn), catListId: Number(catId), _chatId: cb.message.chat.id } }];` } }, 0, 400);
clone(wf, 'Get Cat-list', 'Get Picked Merchant', { parameters: { operation: 'get', dataTableId: node(wf, 'Get Cat-list').parameters.dataTableId,
  filters: { conditions: [{ keyName: 'id', keyValue: '={{ $json.catListId }}' }] }, returnAll: true } }, 0, 400);
clone(wf, 'Process Category Selection', 'Resolve Fawri Merchant', { parameters: { jsCode: `
let r;
try { const p = $('Parse Fawri Pick').first().json; r = { SN: p.SN, merchantName: $input.first().json.Merchant, _chatId: p._chatId }; }
catch { const e = $('Extract Merchant Name').first().json; r = { SN: e.transactionSN, merchantName: e.merchantName, _chatId: e._chatId, _messageId: e._messageId }; }
return [{ json: r }];` } }, 0, 400);
clone(wf, 'Update Merchant', 'Write Fawri Merchant', { parameters: { ...structuredClone(node(wf, 'Update Merchant').parameters),
  filters: { conditions: [{ keyName: 'SN', keyValue: '={{ $json.SN }}' }] } } }, 0, 400);
node(wf, 'Write Fawri Merchant').parameters.columns.value = { Merchant: "={{ $('Resolve Fawri Merchant').first().json.merchantName }}" };
clone(wf, 'Lookup for SN', 'Get Fawri Tx', { parameters: { ...structuredClone(node(wf, 'Lookup for SN').parameters),
  filters: { conditions: [{ keyName: 'SN', keyValue: "={{ $('Resolve Fawri Merchant').first().json.SN }}" }] } } }, 0, 400);
setCode(wf, 'Update Merchant Name', `
const tx = $input.first().json;
const r = $('Resolve Fawri Merchant').first().json;
return [{ json: { ...tx, Merchant: r.merchantName, _isFawri: false, _chatId: r._chatId, _merchantMessageId: r._messageId, FawriMerchant: true } }];`);
connect(wf, 'Switch', 'Delete Suggestions', out('fawriPick'));
connect(wf, 'Delete Suggestions', 'Parse Fawri Pick');
connect(wf, 'Parse Fawri Pick', 'Get Picked Merchant');
connect(wf, 'Get Picked Merchant', 'Resolve Fawri Merchant');
// reply path: Extract Merchant Name → Resolve (replaces the FAWRI_PENDING lookup by SN-less guess)
disconnect(wf, 'Extract Merchant Name', 'Lookup Pending Transaction');
connect(wf, 'Extract Merchant Name', 'Resolve Fawri Merchant');
connect(wf, 'Resolve Fawri Merchant', 'Write Fawri Merchant');
connect(wf, 'Write Fawri Merchant', 'Get Fawri Tx');
connect(wf, 'Get Fawri Tx', 'Update Merchant Name');
disconnect(wf, 'Update Merchant', 'Update Merchant Name');
// reply_to only exists for typed replies
node(wf, 'Confirm Merchant Received').parameters.additionalFields.reply_to_message_id =
  "={{ $('combined-telegram-trigger').first().json.message?.message_id ?? '' }}";

// 7) fawriOther: delete suggestions → load tx → existing force-reply message
clone(wf, 'Acknowledge Selection', 'Delete Suggestions (other)', {}, 0, 600);
clone(wf, 'Lookup for SN', 'Get Tx for Other', { parameters: { ...structuredClone(node(wf, 'Lookup for SN').parameters),
  filters: { conditions: [{ keyName: 'SN', keyValue: "={{ Number($('Switch').first().json.callback_query.data.split('|')[1]) }}" }] } } }, 0, 600);
connect(wf, 'Switch', 'Delete Suggestions (other)', out('fawriOther'));
connect(wf, 'Delete Suggestions (other)', 'Get Tx for Other');
connect(wf, 'Get Tx for Other', 'Ask for Merchant Name');

// 8) Category picker from Categories table + ➕ New
const getCats = node(wf, 'Get Categories List').parameters;
getCats.dataTableId = { __rl: true, value: TABLES.categories, mode: 'list', cachedResultName: 'Categories' };
getCats.filters = { conditions: [{ keyName: 'Active', keyValue: true }] };
setCode(wf, 'Create Category Buttons', `
const cats = $input.all().map(i => i.json).filter(c => c.Name).sort((a, b) => (a.Order ?? 999) - (b.Order ?? 999));
const tx = $('Search in Cat-list').first().json;
const buttons = [];
for (let i = 0; i < cats.length; i += 2) {
  const row = [{ text: cats[i].Name, callback_data: 'cat_select|' + cats[i].Name + '|' + tx.SN }];
  if (cats[i + 1]) row.push({ text: cats[i + 1].Name, callback_data: 'cat_select|' + cats[i + 1].Name + '|' + tx.SN });
  buttons.push(row);
}
buttons.push([{ text: '➕ New category', callback_data: 'cat_new|' + tx.SN }]);
return [{ json: { ...tx, inlineKeyboard: buttons, categoryCount: cats.length } }];`);
if (process.env.FA_TOKEN_IN_ENV !== '0') node(wf, 'Ask for Category').parameters.url = TG + '/sendMessage';

// 9) catNew: delete picker → force-reply asking for the name (keeps SN in the text)
clone(wf, 'Acknowledge Selection', 'Delete Picker (new cat)', {}, 0, 800);
clone(wf, 'Ask for Merchant Name', 'Ask New Category Name', { parameters: { ...structuredClone(node(wf, 'Ask for Merchant Name').parameters),
  text: "=🆕 <b>New category</b>\n\nSend the new category name.\n\n📝 <b>Transaction ID:</b> <code>{{ $('Switch').first().json.callback_query.data.split('|')[1] }}</code>" } }, 0, 800);
connect(wf, 'Switch', 'Delete Picker (new cat)', out('catNew'));
connect(wf, 'Delete Picker (new cat)', 'Ask New Category Name');

// 10) newCategoryName: insert into Categories → reuse the category-selected path
clone(wf, 'Process Category Selection', 'Prepare New Category', { parameters: { jsCode: `
const m = $('Switch').first().json;
const name = m.categoryName.replace(/\\s+/g, ' ').trim().replace(/^./, c => c.toUpperCase());
return [{ json: { Name: name, selectedCategory: name, transactionSN: Number(m.transactionId), _chatId: m.message.chat.id, _messageId: m.message.message_id } }];` } }, 0, 1000);
clone(wf, 'Save to Cat-list', 'Upsert Category', { parameters: { operation: 'upsert',
  dataTableId: { __rl: true, value: TABLES.categories, mode: 'list', cachedResultName: 'Categories' },
  filters: { conditions: [{ keyName: 'Name', keyValue: '={{ $json.Name }}' }] },
  columns: { mappingMode: 'defineBelow', value: { Name: '={{ $json.Name }}', Color: '#8A9490', Icon: 'Tag', Budget: 0, Order: 999, Active: true },
    matchingColumns: [], schema: ['Name','Color','Icon','Budget','Order','Active'].map(id => ({ id, displayName: id, required: false, defaultMatch: false, display: true,
      type: id === 'Budget' || id === 'Order' ? 'number' : id === 'Active' ? 'boolean' : 'string', readOnly: false, removed: false })),
    attemptToConvertTypes: false, convertFieldsToString: false }, options: {} } }, 0, 1000);
connect(wf, 'Switch', 'Prepare New Category', out('newCategoryName'));
connect(wf, 'Prepare New Category', 'Upsert Category');
connect(wf, 'Upsert Category', 'Lookup Pending Category');
node(wf, 'Lookup Pending Category').parameters.filters.conditions[0].keyValue =
  "={{ (() => { try { return $('Process Category Selection').first().json.transactionSN } catch { return $('Prepare New Category').first().json.transactionSN } })() }}";
setCode(wf, 'Merge Category with Transaction', `
const tx = $input.first().json;
let sel; try { sel = $('Process Category Selection').first().json; } catch { sel = $('Prepare New Category').first().json; }
return [{ json: { ...tx, Category: sel.selectedCategory, _needsInsert: true, _newMerchant: tx._newMerchant || tx.Merchant,
  _callbackQueryId: sel._callbackQueryId, _messageId: sel._messageId, _chatId: sel._chatId } }];`);

mkdirSync('n8n/.out', { recursive: true });
writeFileSync('n8n/.out/fa-add-transaction.patched.json', JSON.stringify(wf, null, 1));
console.log('nodes', wf.nodes.length, '→ preview n8n/.out/fa-add-transaction.patched.json');
if (process.argv.includes('--apply')) { await putWorkflow(wf); console.log('applied'); }
```
Notes for the executor:
- `Upsert Category`: the n8n Data Table node's upsert parameter names may differ by version. Open the preview, compare with a node made in the UI, and adjust. If upsert isn't supported, use `get` with a filter, an `IF` that checks emptiness, and an `insert`.
- The Data Table filter keyName `'id'` for `Get Picked Merchant`: if the node rejects `id`, filter on `Merchant` with the value from the callback instead. That requires changing the callback to `fm|SN|<index>` and storing the three names in the message, so try `id` first.
- If the user declined Task 4, run with `FA_TOKEN_IN_ENV=0` and change the `TG` constant to the literal URL prefix copied from "Ask for Category". **Don't commit that value.**

**Step 2:** Dry run: `node n8n/workflows/p2-add-transaction.mjs`. Open `n8n/.out/fa-add-transaction.patched.json` and check:
- every new node has a valid `typeVersion` and the right credentials (cloned)
- `Switch` has 6 outputs
- there are no orphan connections to deleted nodes

**Step 3:** Apply: `node n8n/workflows/p2-add-transaction.mjs --apply`. Then GET the workflow back and confirm the node count and `active: true`.

**Step 4: Live test.** Tell the user first, because each test creates a real row and a real Telegram message.
- (a) POST the `FAWRI` fixture to `/webhook/addNewTransaction` (`{"msg": "..."}`). Expected: the existing-style message with an IBAN line and 3 suggestion buttons plus Other. Ask the user to tap a suggestion. Expected: the merchant is set, the category is auto-filled or the picker appears (with ➕ New), and "Logged Successfully" arrives.
- (b) The same with a different amount; tap **Other…**. Expected: the old force-reply message; the reply sets the merchant.
- (c) The picker: tap **➕ New category**, reply "Test Cat". Expected: a "Test Cat" row in Categories, the transaction categorised, and the merchant saved to Cat-list.
- (d) POST the `INCOMING` fixture. Expected: "💸 Incoming payment … Not logged" and no new row.
- (e) POST the `CARD` fixture. Expected: exactly today's behaviour.
- Check each execution in `/executions?workflowId=I3EaJw8o1YNfkleN` for errors. Then delete the test rows (by SN), the "Test Cat" category and its Cat-list row with `DELETE /data-tables/{id}/rows/delete?filter=...`.

**Step 5:** Commit: `git add n8n/workflows/p2-add-transaction.mjs && git commit -m "feat(n8n): Fawri suggestions, incoming detection, table-driven category picker"`

### Task 6: Update the docs

**Step 1:** In `docs/SYSTEM-MAP.md`, update the ingest-flow section: the new nodes, the callback prefixes (`fm|`, `fo|`, `cat_new|`, `cat_select|`), the Categories table, `Payee_IBAN`/`Source`, and the token in `$env`. Remove issue #6 if the token was moved.

**Step 2:** Commit: `git commit -am "docs: system map after P2"`. Tell the user P2 is live. They'll see suggestions from the next Fawri payment.
