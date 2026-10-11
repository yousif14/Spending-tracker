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
