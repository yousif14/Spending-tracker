// n8n/scripts/p1-migrate.mjs  — usage: node p1-migrate.mjs [--apply]
import { allRows, updateRows, eq, TABLES } from './n8n-client.mjs';
import { toIsoDate, toHHMM, normalizeCategory, inferSource } from '../code/normalize.js';

// Category for each payee filed as "Fawri+" (chosen by the user 2026-10-11); applied to transactions and Cat-list
const FAWRI_FIX = { 'GAMEIL AHMED': 'Other', AHMED: 'Other', 'MOAZZEM ABULBASAR': 'Other', SALIM: 'Services',
  '6152': 'Other', 'BELAL ODAT AUB': 'Other', 'STC PAY': 'Other', IBANENDING: 'Other' };
const fawriFix = r => (r.Category === 'Fawri+' ? FAWRI_FIX[String(r.Merchant).trim()] : undefined);

const APPLY = process.argv.includes('--apply');
const tx = await allRows(TABLES.transactions);
const patches = [];
const fawriCat = [];
for (const r of tx) {
  const p = {};
  const d = toIsoDate(r.Date); if (d && d !== r.Date) p.Date = d;
  const t = toHHMM(r.Time); if ((r.Time || '') !== t) p.Time = t;
  const c = normalizeCategory(r.Category); if ((r.Category || '') !== c) p.Category = c;
  if (fawriFix(r)) p.Category = fawriFix(r);
  if (!r.Source) p.Source = inferSource(r);
  if (r.Category === 'Fawri+' && !fawriFix(r)) fawriCat.push(r);
  if (Object.keys(p).length) patches.push({ id: r.id, SN: r.SN, p });
}
const bad = tx.filter(r => !toIsoDate(r.Date));
console.log(`rows ${tx.length}, to patch ${patches.length}, unparseable dates ${bad.length}`);
console.log('sample', JSON.stringify(patches.slice(0, 5)));
console.log('Fawri+ rows with no fix yet:');
for (const r of fawriCat) console.log(`  SN ${r.SN} ${r.Date} ${r.Merchant} ${r.Amount} (Name ${r.Name}, Tag ${r.Tag || '-'})`);

if (APPLY) {
  let n = 0;
  for (const { id, p } of patches) { await updateRows(TABLES.transactions, eq('id', id), p); if (++n % 100 === 0) console.log(n); }
  const cl = await allRows(TABLES.catList);
  for (const r of cl) {
    const c = fawriFix(r) || normalizeCategory(r.Category);
    if ((r.Category || '') !== c) await updateRows(TABLES.catList, eq('id', r.id), { Category: c });
  }
  console.log('applied', n);
}
