// Stats for the Stats screen: period comparison, trend, merchants, weekdays, averages (pure, tested)
import { getPeriodWindow } from '@/utils/period';
import type { Tx } from './types';
import { inRange, periodSummary } from './summary';

type Range = { from: string; to: string };
export type PeriodRef = Range & { label: string; year: number; month: number };
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** N fiscal periods ending with (year, month), oldest first; a period is labelled by the month it ends in */
export function lastPeriods(year: number, month: number, n: number): PeriodRef[] {
  const out: PeriodRef[] = [];
  for (let i = n - 1; i >= 0; i--) {
    let m = month - i, y = year; while (m < 1) { m += 12; y--; }
    const w = getPeriodWindow(y, m);
    out.push({ from: w.from, to: w.to, label: MONTHS[m - 1], year: y, month: m });
  }
  return out;
}

const sumBy = (txs: Tx[], r: Range) => {
  const m = new Map<string, number>();
  for (const t of txs) if (inRange(t, r)) m.set(t.category || 'Other', (m.get(t.category || 'Other') || 0) + t.amount);
  return m;
};
const total = (m: Map<string, number>) => r3([...m.values()].reduce((s, v) => s + v, 0));

export function comparePeriods(txs: Tx[], cur: Range, prev: Range) {
  const a = sumBy(txs, cur), b = sumBy(txs, prev);
  const categories = [...new Set([...a.keys(), ...b.keys()])]
    .map(name => ({ name, current: r3(a.get(name) || 0), previous: r3(b.get(name) || 0), delta: r3((a.get(name) || 0) - (b.get(name) || 0)) }))
    .sort((x, y) => y.current - x.current || y.previous - x.previous);
  const c = total(a), p = total(b);
  return { total: { current: c, previous: p, delta: r3(c - p) }, categories };
}

export function trendByCategory(txs: Tx[], periods: Array<Range & { label: string }>) {
  return periods.map(p => {
    const row: Record<string, number | string> = { label: p.label, total: 0 };
    for (const [k, v] of sumBy(txs, p)) { row[k] = r3(v); row.total = r3((row.total as number) + v); }
    return row;
  });
}

export function topMerchants(txs: Tx[], r: Range, n = 10, by: 'total' | 'count' = 'total') {
  const m = new Map<string, { merchant: string; total: number; count: number }>();
  for (const t of txs) if (inRange(t, r)) {
    const k = t.merchant.trim().toUpperCase() || 'UNKNOWN';
    const e = m.get(k) ?? { merchant: k, total: 0, count: 0 };
    e.total = r3(e.total + t.amount); e.count++; m.set(k, e);
  }
  return [...m.values()].sort((a, b) => by === 'count' ? b.count - a.count || b.total - a.total : b.total - a.total).slice(0, n);
}

export function weekdayHeatmap(txs: Tx[], r: Range) {
  const out = Array.from({ length: 7 }, (_, day) => ({ day, total: 0, count: 0 }));
  for (const t of txs) if (inRange(t, r)) {
    const d = new Date(t.date + 'T12:00:00Z').getUTCDay();
    out[d].total = r3(out[d].total + t.amount); out[d].count++;
  }
  return out;
}

export function averages(txs: Tx[], r: Range, today: string) {
  const inR = txs.filter(t => inRange(t, r));
  const s = periodSummary(txs, r, 0, today);
  return {
    perDay: s.pace, perTx: inR.length ? r3(s.spent / inR.length) : 0, count: inR.length,
    biggest: inR.reduce<Tx | null>((b, t) => (!b || t.amount > b.amount ? t : b), null),
  };
}
