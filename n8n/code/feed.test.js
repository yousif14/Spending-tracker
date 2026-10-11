import { describe, it, expect } from 'vitest';
import { toFeedTx, buildFeed, newManualRow } from './feed.js';

describe('toFeedTx', () => {
  it('maps and normalises a row', () => {
    expect(toFeedTx({ id: 9, SN: 2026101022482000, Date: '10/10/2026', Time: '19:59:00', Merchant: 'Alkawar', Amount: '8',
      Currency: 'BHD', Category: 'Luandry', Tag: null, Name: 'Card', Card_ending: '', Payee_IBAN: '0000', Source: 'fawri' }))
      .toEqual({ sn: '2026101022482000', date: '2026-10-10', time: '19:59', merchant: 'Alkawar', amount: 8, currency: 'BHD',
        category: 'Laundry', tag: '', name: 'Card', cardEnding: '', payeeIban: '0000', source: 'fawri' });
  });
});

describe('buildFeed', () => {
  it('sorts newest first, categories A–Z, maps settings', () => {
    const f = buildFeed({
      tx: [{ SN: 1, Date: '2026-01-01', Time: '10:00', Amount: 1 }, { SN: 2, Date: '2026-02-01', Time: '09:00', Amount: 2 }],
      categories: [{ id: 1, Name: 'B', Order: 1, Active: true }, { id: 2, Name: 'A', Order: 2, Active: true }],
      catList: [{ Merchant: 'JASMIS', Category: 'Food' }],
      settings: [{ Key: 'total_budget', Value: '600' }],
    }, new Date('2026-03-01T00:00:00Z'));
    expect(f.transactions.map(t => t.sn)).toEqual(['2', '1']);
    expect(f.categories.map(c => c.name)).toEqual(['A', 'B']);
    expect(f.merchants).toEqual([{ merchant: 'JASMIS', category: 'Food', count: 0 }]);
    expect(f.settings).toEqual({ total_budget: 600 });
  });
});

describe('newManualRow', () => {
  it('builds a data-table row', () => {
    const r = newManualRow({ date: '2026-10-06', time: '18:23', merchant: ' Jasmis ', amount: '1.275', category: 'Food' }, 2026100618230123);
    expect(r).toEqual({ SN: 2026100618230123, Date: '2026-10-06', Time: '18:23', Merchant: 'Jasmis', Amount: 1.275, Currency: 'BHD',
      Category: 'Food', Tag: '', Name: '-', Card_ending: '', Payee_IBAN: '', Source: 'manual' });
  });
  it('rejects bad input', () => {
    expect(() => newManualRow({ date: 'x', time: '', merchant: '', amount: 0, category: '' }, 1)).toThrow();
  });
});
