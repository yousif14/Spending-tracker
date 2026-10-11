import type { Cat, Tx } from './types';

const DAY = 864e5;
const d = (s: string) => new Date(s + 'T00:00:00Z').getTime();
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export type Status = 'good' | 'warning' | 'danger' | 'none';
export const statusOf = (pct: number, hasBudget = true): Status => !hasBudget ? 'none' : pct >= 90 ? 'danger' : pct >= 75 ? 'warning' : 'good';
export const inRange = (t: Tx, r: { from: string; to: string }) => t.date >= r.from && t.date <= r.to;

export function periodSummary(txs: Tx[], range: { from: string; to: string }, budget: number, today: string) {
  const spent = r3(txs.filter(t => inRange(t, range)).reduce((s, t) => s + t.amount, 0));
  const daysInPeriod = Math.round((d(range.to) - d(range.from)) / DAY) + 1;
  const end = today < range.to ? today : range.to;
  const daysElapsed = Math.min(daysInPeriod, Math.max(1, Math.round((d(end) - d(range.from)) / DAY) + 1));
  const daysLeft = Math.max(0, daysInPeriod - daysElapsed);
  const pace = spent / daysElapsed;
  const pctUsed = budget > 0 ? (spent / budget) * 100 : 0;
  return {
    spent, budget, remaining: r3(budget - spent), daysInPeriod, daysElapsed, daysLeft, pace, forecast: pace * daysInPeriod,
    safeDaily: daysLeft > 0 ? Math.max(0, (budget - spent) / daysLeft) : 0, pctUsed, status: statusOf(pctUsed, budget > 0),
  };
}

export function categoryTotals(txs: Tx[], range: { from: string; to: string }, cats: Cat[]) {
  const sums = new Map<string, number>();
  for (const t of txs) if (inRange(t, range)) sums.set(t.category || 'Other', (sums.get(t.category || 'Other') || 0) + t.amount);
  const byName = new Map(cats.map(c => [c.name, c]));
  return [...sums.entries()].map(([name, spent]) => {
    const c = byName.get(name); const budget = c?.budget ?? 0;
    const pct = budget > 0 ? (spent / budget) * 100 : 0;
    return { name, spent: r3(spent), budget, color: c?.color ?? '#8A9490', icon: c?.icon ?? 'Tag', pct, status: statusOf(pct, budget > 0) };
  }).sort((a, b) => b.spent - a.spent);
}
