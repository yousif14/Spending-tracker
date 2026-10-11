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
catch {
  const e = $('Extract Merchant Name').first().json;
  // typed without replying: fall back to the pending Fawri row, as before P2
  let sn = e.transactionSN; if (!sn) { try { sn = $('Lookup Pending Transaction').first().json.SN; } catch {} }
  r = { SN: sn, merchantName: e.merchantName, _chatId: e._chatId, _messageId: e._messageId };
}
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
// reply path: Extract Merchant Name → Lookup Pending Transaction (fallback when no SN) → Resolve
node(wf, 'Lookup Pending Transaction').alwaysOutputData = true;
disconnect(wf, 'Lookup Pending Transaction', 'Update Merchant');
connect(wf, 'Lookup Pending Transaction', 'Resolve Fawri Merchant');
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
  // cat_select path: input is Process Category Selection; new-category path: input is the upserted row (no SN).
  // ($('Unexecuted Node') does not throw inside expressions, so a try/catch fallback never fires.)
  "={{ $json.transactionSN ?? $('Prepare New Category').first().json.transactionSN }}";
setCode(wf, 'Merge Category with Transaction', `
const tx = $input.first().json;
let sel = null; try { sel = $('Process Category Selection').first()?.json; } catch {}
if (!sel?.selectedCategory) sel = $('Prepare New Category').first().json;
return [{ json: { ...tx, Category: sel.selectedCategory, _needsInsert: true, _newMerchant: tx._newMerchant || tx.Merchant,
  _callbackQueryId: sel._callbackQueryId, _messageId: sel._messageId, _chatId: sel._chatId } }];`);

mkdirSync('n8n/.out', { recursive: true });
writeFileSync('n8n/.out/fa-add-transaction.patched.json', JSON.stringify(wf, null, 1));
console.log('nodes', wf.nodes.length, '→ preview n8n/.out/fa-add-transaction.patched.json');
if (process.argv.includes('--apply')) { await putWorkflow(wf); console.log('applied'); }
