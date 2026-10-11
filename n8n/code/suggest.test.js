// n8n/code/suggest.test.js
import { describe, it, expect } from 'vitest';
import { suggestMerchants } from './suggest.js';

const NOW = new Date('2026-10-11T12:00:00Z');
const row = (Merchant, Amount, Date, Time, Payee_IBAN = '', Source = 'fawri') => ({ Merchant, Amount, Date, Time, Payee_IBAN, Source });
const history = [
  row('KRK HUT', 6.5, '2026-10-01', '21:00', '6743'),
  row('KRK HUT', 6.9, '2026-09-20', '20:30', '6743'),
  row('CHAI ZALAQ', 6.7, '2026-10-05', '21:10', '0000'),
  row('ORANGE LAUNDRY', 3.0, '2026-10-06', '10:00', '1111'),
  row('ORANGE LAUNDRY', 3.0, '2026-09-29', '10:00', '1111'),
  row('ORANGE LAUNDRY', 3.0, '2026-09-22', '10:00', '1111'),
  row('VEGETABLE', 4.5, '2026-10-10', '20:59', ''),
  row('LULU', 6.7, '2026-10-01', '21:00', '', 'sms'),          // not fawri → ignored
  row('FAWRI_PENDING', 6.7, '2026-10-01', '21:00', '6743'),    // placeholder → ignored
];

describe('suggestMerchants', () => {
  it('ranks the same IBAN first', () => {
    const r = suggestMerchants(history, { iban: '6743', amount: 6.7, time: '21:19' }, NOW);
    expect(r[0]).toBe('KRK HUT');
    expect(r).toHaveLength(3);
  });
  it('ignores IBAN 0000 and uses amount/time', () => {
    const r = suggestMerchants(history, { iban: '0000', amount: 6.7, time: '21:15' }, NOW);
    expect(r.slice(0, 2)).toEqual(expect.arrayContaining(['CHAI ZALAQ', 'KRK HUT']));
  });
  it('never suggests non-fawri or placeholder merchants', () => {
    const r = suggestMerchants(history, { iban: '6743', amount: 6.7, time: '21:00' }, NOW);
    expect(r).not.toContain('LULU');
    expect(r).not.toContain('FAWRI_PENDING');
  });
  it('returns unique names, max limit', () => {
    const r = suggestMerchants(history, { iban: '', amount: 3, time: '10:00' }, NOW, 2);
    expect(new Set(r).size).toBe(r.length);
    expect(r).toHaveLength(2);
    expect(r[0]).toBe('ORANGE LAUNDRY');
  });
  it('handles empty history', () => {
    expect(suggestMerchants([], { iban: '1', amount: 1, time: '' }, NOW)).toEqual([]);
  });
});
