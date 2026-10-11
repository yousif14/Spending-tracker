import { describe, it, expect } from 'vitest';
import { periodSummary, categoryTotals } from './summary';
import type { Tx, Cat } from './types';

const tx = (date: string, amount: number, category: string): Tx => ({ sn: date + amount, date, time: '', merchant: 'M', amount, currency: 'BHD', category, tag: '', name: '', cardEnding: '', payeeIban: '', source: 'sms' });
const range = { from: '2026-09-23', to: '2026-10-22' };
const T = [tx('2026-09-25', 100, 'Food'), tx('2026-10-05', 50, 'Food'), tx('2026-10-10', 30, 'Baby'), tx('2026-08-01', 999, 'Food')];

describe('periodSummary', () => {
  it('computes spent, pace and forecast', () => {
    const s = periodSummary(T, range, 600, '2026-10-11');
    expect(s.spent).toBe(180);
    expect(s.daysInPeriod).toBe(30);
    expect(s.daysElapsed).toBe(19);
    expect(s.daysLeft).toBe(11);
    expect(s.pace).toBeCloseTo(180 / 19, 3);
    expect(s.forecast).toBeCloseTo((180 / 19) * 30, 2);
    expect(s.pctUsed).toBeCloseTo(30, 5);
    expect(s.status).toBe('good');
  });
  it('past period: elapsed = full', () => expect(periodSummary(T, range, 600, '2026-12-01').daysLeft).toBe(0));
});

describe('categoryTotals', () => {
  it('totals with budget and status, sorted by spend', () => {
    const cats: Cat[] = [{ id: 1, name: 'Food', color: '#f00', icon: 'Tag', budget: 160, order: 1, active: true },
      { id: 2, name: 'Baby', color: '#0f0', icon: 'Tag', budget: 0, order: 2, active: true }];
    const r = categoryTotals(T, range, cats);
    expect(r[0]).toMatchObject({ name: 'Food', spent: 150, budget: 160, status: 'danger' });
    expect(r[1]).toMatchObject({ name: 'Baby', spent: 30, budget: 0, status: 'none' });
  });
});
