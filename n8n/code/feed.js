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
      budget: Number(c.Budget) || 0, order: Number(c.Order) || 999, active: c.Active !== false })).sort((a, b) => a.name.localeCompare(b.name)),   // always A–Z
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
