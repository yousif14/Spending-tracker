// n8n/code/normalize.test.js
import { describe, it, expect } from 'vitest';
import { toIsoDate, toHHMM, normalizeCategory, inferSource } from './normalize.js';

describe('toIsoDate', () => {
  it('keeps ISO', () => expect(toIsoDate('2026-10-10')).toBe('2026-10-10'));
  it('converts DD/MM/YYYY', () => expect(toIsoDate('11/03/2025')).toBe('2025-03-11'));
  it('pads single digits', () => expect(toIsoDate('1/3/2025')).toBe('2025-03-01'));
  it('converts YYYY/MM/DD', () => expect(toIsoDate('2026/10/08')).toBe('2026-10-08'));
  it('returns empty for junk', () => expect(toIsoDate('')).toBe(''));
});

describe('toHHMM', () => {
  it('trims seconds', () => expect(toHHMM('00:39:00')).toBe('00:39'));
  it('pads hour', () => expect(toHHMM('9:05')).toBe('09:05'));
  it('keeps empty', () => expect(toHHMM('')).toBe(''));
  it('handles null', () => expect(toHHMM(null)).toBe(''));
});

describe('normalizeCategory', () => {
  it('fixes typos', () => {
    expect(normalizeCategory('Luandry')).toBe('Laundry');
    expect(normalizeCategory('Patrol')).toBe('Petrol');
    expect(normalizeCategory('other')).toBe('Other');
  });
  it('trims and keeps others', () => expect(normalizeCategory(' Food ')).toBe('Food'));
  it('keeps empty', () => expect(normalizeCategory(null)).toBe(''));
});

describe('inferSource', () => {
  it('manual when Name is -', () => expect(inferSource({ Name: '-', Merchant: 'Jasmis' })).toBe('manual'));
  it('fawri when Benefit', () => expect(inferSource({ Name: 'Benefit' })).toBe('fawri'));
  it('fawri when Card + no card ending', () => expect(inferSource({ Name: 'Card', Card_ending: '' })).toBe('fawri'));
  it('sms otherwise', () => expect(inferSource({ Name: 'YUSUF', Card_ending: '4120' })).toBe('sms'));
});
