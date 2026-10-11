import type { Source, Tx } from './types';

export interface TxFilter {
  from?: string; to?: string; search: string; categories: string[]; min?: number; max?: number;
  sources: Source[]; sort: 'newest' | 'amount';
}

export const EMPTY_FILTER: TxFilter = { search: '', categories: [], sources: [], sort: 'newest' };

export function applyFilters(txs: Tx[], f: TxFilter): Tx[] {
  const q = f.search.trim().toLowerCase();
  const out = txs.filter(t =>
    (!f.from || t.date >= f.from) && (!f.to || t.date <= f.to) &&
    (!q || t.merchant.toLowerCase().includes(q) || t.tag.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)) &&
    (!f.categories.length || f.categories.includes(t.category)) &&
    (f.min === undefined || t.amount >= f.min) && (f.max === undefined || t.amount <= f.max) &&
    (!f.sources.length || f.sources.includes(t.source)));
  return out.sort(f.sort === 'amount' ? (a, b) => b.amount - a.amount
    : (a, b) => (b.date + b.time).localeCompare(a.date + a.time) || Number(b.sn) - Number(a.sn));
}

export interface DayGroup { date: string; total: number; items: Tx[]; }

export function groupByDay(txs: Tx[]): DayGroup[] {
  const m = new Map<string, DayGroup>();
  for (const t of txs) {
    const g = m.get(t.date) ?? { date: t.date, total: 0, items: [] };
    g.total = Math.round((g.total + t.amount) * 1000) / 1000;
    g.items.push(t);
    m.set(t.date, g);
  }
  return [...m.values()].sort((a, b) => b.date.localeCompare(a.date));
}
