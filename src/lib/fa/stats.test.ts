import { describe, it, expect } from 'vitest';
import { lastPeriods, comparePeriods, trendByCategory, topMerchants, weekdayHeatmap, averages } from './stats';
import type { Tx } from './types';
const tx = (date: string, amount: number, category: string, merchant = 'M'): Tx =>
  ({ sn: date + merchant + amount, date, time: '', merchant, amount, currency: 'BHD', category, tag: '', name: '', cardEnding: '', payeeIban: '', source: 'sms' });
const T = [tx('2026-09-25', 100, 'Food', 'JASMIS'), tx('2026-10-05', 50, 'Food', 'JASMIS'), tx('2026-10-10', 30, 'Baby', 'MUMZ'),
  tx('2026-08-30', 40, 'Food', 'LULU'), tx('2026-09-01', 20, 'Baby', 'MUMZ')];

describe('lastPeriods', () => {
  it('returns N fiscal windows ending with the given one, oldest first', () => {
    const p = lastPeriods(2026, 10, 3);
    expect(p.map(x => x.from)).toEqual(['2026-07-23', '2026-08-23', '2026-09-23']);
    expect(p[2]).toMatchObject({ to: '2026-10-22', label: 'Oct' });
  });
  it('rolls back over the year', () => expect(lastPeriods(2026, 2, 3).map(p => p.label)).toEqual(['Dec', 'Jan', 'Feb']));
});
describe('comparePeriods', () => {
  it('delta per category vs previous period', () => {
    const r = comparePeriods(T, { from: '2026-09-23', to: '2026-10-22' }, { from: '2026-08-23', to: '2026-09-22' });
    expect(r.total).toEqual({ current: 180, previous: 60, delta: 120 });
    expect(r.categories.find(c => c.name === 'Food')).toMatchObject({ current: 150, previous: 40, delta: 110 });
  });
});
describe('trendByCategory', () => {
  it('one row per period with category keys', () => {
    const rows = trendByCategory(T, lastPeriods(2026, 10, 2));
    expect(rows).toEqual([{ label: 'Sep', total: 60, Food: 40, Baby: 20 }, { label: 'Oct', total: 180, Food: 150, Baby: 30 }]);
  });
});
describe('topMerchants', () => {
  it('by total with count', () => expect(topMerchants(T, { from: '2026-08-01', to: '2026-12-31' }, 2)).toEqual([
    { merchant: 'JASMIS', total: 150, count: 2 }, { merchant: 'MUMZ', total: 50, count: 2 }]));
  it('by visits', () => expect(topMerchants(T, { from: '2026-08-01', to: '2026-12-31' }, 1, 'count')[0].merchant).toBe('JASMIS'));
});
describe('weekdayHeatmap', () => {
  it('sums by weekday (0=Sun)', () => {
    const h = weekdayHeatmap(T, { from: '2026-09-23', to: '2026-10-22' });
    expect(h).toHaveLength(7);
    expect(h[5].total).toBe(100);   // 2026-09-25 is a Friday
  });
});
describe('averages', () => {
  it('per day and per transaction', () => {
    const a = averages(T, { from: '2026-09-23', to: '2026-10-22' }, '2026-10-11');
    expect(a.perTx).toBe(60);
    expect(a.perDay).toBeCloseTo(180 / 19, 3);
    expect(a.biggest?.amount).toBe(100);
  });
});
