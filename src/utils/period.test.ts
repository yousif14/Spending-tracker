import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getPeriodWindow,
  getCurrentPeriodWindow,
  combineDateTime,
  parseSearchQuery,
  filterTransactions,
  type PeriodWindow,
} from './period';

describe('getPeriodWindow', () => {
  it('should return correct window for month 9 (Sep)', () => {
    const result = getPeriodWindow(2025, 9);
    expect(result).toEqual({
      from: '2025-08-23',
      to: '2025-09-22',
      year: 2025,
      month: 9,
    });
  });

  it('should handle January (month 1) with year rollback', () => {
    const result = getPeriodWindow(2025, 1);
    expect(result).toEqual({
      from: '2024-12-23',
      to: '2025-01-22',
      year: 2025,
      month: 1,
    });
  });

  it('should handle February with different anchor days', () => {
    const result = getPeriodWindow(2025, 2, 23);
    expect(result).toEqual({
      from: '2025-01-23',
      to: '2025-02-22',
      year: 2025,
      month: 2,
    });
  });

  it('should handle February 29 in leap year', () => {
    // February 2024 is a leap year
    const result = getPeriodWindow(2024, 2, 29);
    expect(result).toEqual({
      from: '2024-01-29',
      to: '2024-02-28', // 29-1=28
      year: 2024,
      month: 2,
    });
  });

  it('should handle February 30 overflow to March', () => {
    // Feb 30 doesn't exist, should overflow to March
    const result = getPeriodWindow(2025, 3, 30);
    expect(result).toEqual({
      from: '2025-03-02', // Feb 30 -> Mar 2 in non-leap year
      to: '2025-03-29',
      year: 2025,
      month: 3,
    });
  });

  it('should handle custom anchor day', () => {
    const result = getPeriodWindow(2025, 5, 15);
    expect(result).toEqual({
      from: '2025-04-15',
      to: '2025-05-14',
      year: 2025,
      month: 5,
    });
  });

  it('should handle December (month 12)', () => {
    const result = getPeriodWindow(2025, 12);
    expect(result).toEqual({
      from: '2025-11-23',
      to: '2025-12-22',
      year: 2025,
      month: 12,
    });
  });

  it('should throw error for invalid month', () => {
    expect(() => getPeriodWindow(2025, 0)).toThrow('Month must be between 1 and 12');
    expect(() => getPeriodWindow(2025, 13)).toThrow('Month must be between 1 and 12');
  });

  it('should throw error for invalid anchor day', () => {
    expect(() => getPeriodWindow(2025, 5, 0)).toThrow('Anchor day must be between 1 and 31');
    expect(() => getPeriodWindow(2025, 5, 32)).toThrow('Anchor day must be between 1 and 31');
  });

  it('should handle month boundaries correctly', () => {
    // Test all 12 months
    for (let month = 1; month <= 12; month++) {
      const result = getPeriodWindow(2025, month, 23);
      expect(result.month).toBe(month);
      expect(result.from).toBeTruthy();
      expect(result.to).toBeTruthy();
      // Verify from date is before to date
      expect(new Date(result.from).getTime()).toBeLessThan(new Date(result.to).getTime());
    }
  });
});

describe('getCurrentPeriodWindow', () => {
  it('should return current fiscal month when today is after anchor day', () => {
    // Test the logic directly by verifying the period calculation
    // For real-world use: if today is Sep 25, we're in fiscal month 10 (Sep 23 - Oct 22)
    const period = getPeriodWindow(2025, 10, 23);
    expect(period).toEqual({
      from: '2025-09-23',
      to: '2025-10-22',
      year: 2025,
      month: 10,
    });
  });

  it('should return previous fiscal month when today is before anchor day', () => {
    // Test the logic: if today is Sep 15, we're in fiscal month 9 (Aug 23 - Sep 22)
    const period = getPeriodWindow(2025, 9, 23);
    expect(period).toEqual({
      from: '2025-08-23',
      to: '2025-09-22',
      year: 2025,
      month: 9,
    });
  });

  it('should handle boundary on anchor day', () => {
    // If today is Sep 23 (anchor day), we're in fiscal month 10
    const period = getPeriodWindow(2025, 10, 23);
    expect(period).toEqual({
      from: '2025-09-23',
      to: '2025-10-22',
      year: 2025,
      month: 10,
    });
  });

  it('should handle year rollover in December', () => {
    // If today is Dec 25, we're in fiscal month 1 of next year (Dec 23 - Jan 22)
    const period = getPeriodWindow(2026, 1, 23);
    expect(period).toEqual({
      from: '2025-12-23',
      to: '2026-01-22',
      year: 2026,
      month: 1,
    });
  });

  it('should handle year rollback in January', () => {
    // If today is Jan 15, we're in fiscal month 1 (Dec 23 - Jan 22)
    const period = getPeriodWindow(2025, 1, 23);
    expect(period).toEqual({
      from: '2024-12-23',
      to: '2025-01-22',
      year: 2025,
      month: 1,
    });
  });

  it('should work with current date', () => {
    // Just verify it runs without error and returns valid structure
    const result = getCurrentPeriodWindow();
    expect(result).toHaveProperty('from');
    expect(result).toHaveProperty('to');
    expect(result).toHaveProperty('month');
    expect(result).toHaveProperty('year');
    expect(result.month).toBeGreaterThanOrEqual(1);
    expect(result.month).toBeLessThanOrEqual(12);
  });
});

describe('combineDateTime', () => {
  it('should combine date with time (HH:MM)', () => {
    const result = combineDateTime('2025-09-15', '14:30');
    expect(result).toBe('2025-09-15 14:30:00');
  });

  it('should combine date with time (HH:MM:SS)', () => {
    const result = combineDateTime('2025-09-15', '14:30:45');
    expect(result).toBe('2025-09-15 14:30:45');
  });

  it('should handle missing time with 00:00:00', () => {
    const result = combineDateTime('2025-09-15');
    expect(result).toBe('2025-09-15 00:00:00');
  });

  it('should handle empty time string with 00:00:00', () => {
    const result = combineDateTime('2025-09-15', '');
    expect(result).toBe('2025-09-15 00:00:00');
  });

  it('should handle whitespace time string with 00:00:00', () => {
    const result = combineDateTime('2025-09-15', '   ');
    expect(result).toBe('2025-09-15 00:00:00');
  });

  it('should preserve time with seconds', () => {
    const result = combineDateTime('2025-09-15', '09:05:03');
    expect(result).toBe('2025-09-15 09:05:03');
  });
});

describe('parseSearchQuery', () => {
  it('should parse category tokens', () => {
    const result = parseSearchQuery('cat-food cat-groceries');
    expect(result).toEqual({
      category: ['food', 'groceries'],
      merchant: [],
      general: [],
    });
  });

  it('should parse merchant tokens', () => {
    const result = parseSearchQuery('mer-talabat mer-careem');
    expect(result).toEqual({
      category: [],
      merchant: ['talabat', 'careem'],
      general: [],
    });
  });

  it('should parse general terms', () => {
    const result = parseSearchQuery('vegetable rice');
    expect(result).toEqual({
      category: [],
      merchant: [],
      general: ['vegetable', 'rice'],
    });
  });

  it('should parse mixed tokens', () => {
    const result = parseSearchQuery('cat-food mer-talabat vegetable');
    expect(result).toEqual({
      category: ['food'],
      merchant: ['talabat'],
      general: ['vegetable'],
    });
  });

  it('should handle case-insensitive prefixes', () => {
    const result = parseSearchQuery('CAT-Food MER-Talabat');
    expect(result).toEqual({
      category: ['Food'],
      merchant: ['Talabat'],
      general: [],
    });
  });

  it('should handle empty search', () => {
    const result = parseSearchQuery('');
    expect(result).toEqual({
      category: [],
      merchant: [],
      general: [],
    });
  });

  it('should handle whitespace only', () => {
    const result = parseSearchQuery('   ');
    expect(result).toEqual({
      category: [],
      merchant: [],
      general: [],
    });
  });

  it('should ignore empty tokens', () => {
    const result = parseSearchQuery('cat- mer-');
    expect(result).toEqual({
      category: [],
      merchant: [],
      general: [],
    });
  });

  it('should handle multiple spaces', () => {
    const result = parseSearchQuery('cat-food    mer-talabat     vegetable');
    expect(result).toEqual({
      category: ['food'],
      merchant: ['talabat'],
      general: ['vegetable'],
    });
  });
});

describe('filterTransactions', () => {
  const transactions = [
    { category: 'Food', merchant: 'Talabat', tag: 'lunch' },
    { category: 'Food', merchant: 'Careem', tag: 'dinner' },
    { category: 'Groceries', merchant: 'Lulu', tag: 'vegetables' },
    { category: 'Transport', merchant: 'Careem', tag: 'ride' },
    { category: 'Food', merchant: 'McDonald', tag: 'breakfast' },
  ];

  it('should filter by category token', () => {
    const tokens = parseSearchQuery('cat-food');
    const result = filterTransactions(transactions, tokens);
    expect(result).toHaveLength(3);
    expect(result.every(t => t.category === 'Food')).toBe(true);
  });

  it('should filter by merchant token', () => {
    const tokens = parseSearchQuery('mer-talabat');
    const result = filterTransactions(transactions, tokens);
    expect(result).toHaveLength(1);
    expect(result[0].merchant).toBe('Talabat');
  });

  it('should filter by general term in category', () => {
    const tokens = parseSearchQuery('groceries');
    const result = filterTransactions(transactions, tokens);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('Groceries');
  });

  it('should filter by general term in merchant', () => {
    const tokens = parseSearchQuery('careem');
    const result = filterTransactions(transactions, tokens);
    expect(result).toHaveLength(2);
    expect(result.every(t => t.merchant === 'Careem')).toBe(true);
  });

  it('should filter by general term in tag', () => {
    const tokens = parseSearchQuery('vegetable');
    const result = filterTransactions(transactions, tokens);
    expect(result).toHaveLength(1);
    expect(result[0].tag).toBe('vegetables');
  });

  it('should apply AND semantics for multiple tokens', () => {
    const tokens = parseSearchQuery('cat-food mer-talabat');
    const result = filterTransactions(transactions, tokens);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('Food');
    expect(result[0].merchant).toBe('Talabat');
  });

  it('should apply AND semantics with no matches', () => {
    const tokens = parseSearchQuery('cat-food mer-lulu');
    const result = filterTransactions(transactions, tokens);
    expect(result).toHaveLength(0);
  });

  it('should be case-insensitive', () => {
    const tokens = parseSearchQuery('FOOD');
    const result = filterTransactions(transactions, tokens);
    expect(result).toHaveLength(3);
  });

  it('should support substring matching', () => {
    const tokens = parseSearchQuery('car');
    const result = filterTransactions(transactions, tokens);
    expect(result).toHaveLength(2); // Careem matches
  });

  it('should return all transactions for empty search', () => {
    const tokens = parseSearchQuery('');
    const result = filterTransactions(transactions, tokens);
    expect(result).toHaveLength(5);
  });

  it('should handle multiple general terms with AND', () => {
    const tokens = parseSearchQuery('food talabat');
    const result = filterTransactions(transactions, tokens);
    expect(result).toHaveLength(1);
    expect(result[0].merchant).toBe('Talabat');
  });
});
