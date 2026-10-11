import { describe, it, expect } from 'vitest';
import { applyFilters, groupByDay, EMPTY_FILTER } from './filters';
import type { Tx } from './types';

const tx = (sn: string, date: string, merchant: string, amount: number, category: string, source: Tx['source'] = 'sms', tag = ''): Tx =>
  ({ sn, date, time: '10:00', merchant, amount, currency: 'BHD', category, tag, name: '', cardEnding: '', payeeIban: '', source });
const T = [tx('1', '2026-10-01', 'JASMIS', 1.275, 'Food'), tx('2', '2026-10-02', 'LULU', 25, 'Groceries', 'manual'),
  tx('3', '2026-10-02', 'KRK HUT', 6.5, 'Food', 'fawri', 'Korea'), tx('4', '2026-09-10', 'ENOC', 15, 'Petrol')];

describe('applyFilters', () => {
  it('date range inclusive', () => expect(applyFilters(T, { ...EMPTY_FILTER, from: '2026-10-01', to: '2026-10-02' }).map(t => t.sn)).toEqual(['3', '2', '1']));
  it('search merchant and tag, case-insensitive', () => {
    expect(applyFilters(T, { ...EMPTY_FILTER, search: 'jas' }).map(t => t.sn)).toEqual(['1']);
    expect(applyFilters(T, { ...EMPTY_FILTER, search: 'korea' }).map(t => t.sn)).toEqual(['3']);
  });
  it('categories multi', () => expect(applyFilters(T, { ...EMPTY_FILTER, categories: ['Food', 'Petrol'] }).length).toBe(3));
  it('amount range', () => expect(applyFilters(T, { ...EMPTY_FILTER, min: 5, max: 20 }).map(t => t.sn).sort()).toEqual(['3', '4']));
  it('source', () => expect(applyFilters(T, { ...EMPTY_FILTER, sources: ['manual'] }).map(t => t.sn)).toEqual(['2']));
  it('sort by amount desc', () => expect(applyFilters(T, { ...EMPTY_FILTER, sort: 'amount' })[0].sn).toBe('2'));
});

describe('groupByDay', () => {
  it('groups with subtotal, newest first', () => {
    const g = groupByDay(applyFilters(T, EMPTY_FILTER));
    expect(g[0]).toMatchObject({ date: '2026-10-02', total: 31.5 });
    expect(g[0].items).toHaveLength(2);
  });
});
