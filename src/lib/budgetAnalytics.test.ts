import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateBudgetAnalytics,
  calculateTopMerchants,
  calculateRecurringMerchants,
  calculateCategoryAnalytics,
} from './budgetAnalytics';
import { Transaction } from '../types';

describe('budgetAnalytics', () => {
  // Mock Date for consistent timezone handling
  beforeEach(() => {
    // Mock current date to Jan 10, 2026 in Bahrain timezone
    const mockDate = new Date('2026-01-10T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createMockTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
    SN: '1',
    id: 1,
    date: '2026-01-05',
    time: '12:00',
    merchant: 'Test Merchant',
    amount: 10.000,
    currency: 'BHD',
    category: 'Groceries',
    ...overrides,
  });

  describe('calculateBudgetAnalytics', () => {
    it('should calculate basic budget analytics correctly', () => {
      const transactions: Transaction[] = [
        createMockTransaction({ amount: 50.000, date: '2026-01-01' }),
        createMockTransaction({ amount: 30.000, date: '2026-01-05' }),
        createMockTransaction({ amount: 20.000, date: '2026-01-08' }),
      ];

      const periodStart = new Date('2026-01-01');
      const periodEnd = new Date('2026-01-31');
      const budget = 300.000;

      const result = calculateBudgetAnalytics(transactions, budget, periodStart, periodEnd);

      expect(result.totalSpent).toBe(100.000);
      expect(result.totalBudget).toBe(300.000);
      expect(result.budgetRemaining).toBe(200.000);
      expect(result.percentageUsed).toBeCloseTo(33.33, 1);
      // Days in period = daysElapsed (10) + daysRemaining (21) = 30
      expect(result.daysInPeriod).toBe(30);
    });

    it('should calculate daily burn rate correctly', () => {
      const transactions: Transaction[] = [
        createMockTransaction({ amount: 10.000, date: '2026-01-01' }),
        createMockTransaction({ amount: 20.000, date: '2026-01-05' }),
      ];

      const periodStart = new Date('2026-01-01');
      const periodEnd = new Date('2026-01-31');
      const budget = 300.000;

      const result = calculateBudgetAnalytics(transactions, budget, periodStart, periodEnd);

      // Total spent: 30, days elapsed: 10 (Jan 1 - Jan 10)
      expect(result.totalSpent).toBe(30.000);
      expect(result.daysElapsed).toBe(10);
      expect(result.dailyBurnRate).toBeCloseTo(3.000, 3);
    });

    it('should calculate recommended daily rate correctly', () => {
      const transactions: Transaction[] = [];
      const periodStart = new Date('2026-01-01');
      const periodEnd = new Date('2026-01-31');
      const budget = 310.000;

      const result = calculateBudgetAnalytics(transactions, budget, periodStart, periodEnd);

      // Days in period = 30 (not 31), so 310/30 = 10.333...
      expect(result.recommendedDailyRate).toBeCloseTo(10.333, 3);
    });

    it('should calculate projected total correctly', () => {
      const transactions: Transaction[] = [
        createMockTransaction({ amount: 50.000, date: '2026-01-01' }),
      ];

      const periodStart = new Date('2026-01-01');
      const periodEnd = new Date('2026-01-31');
      const budget = 300.000;

      const result = calculateBudgetAnalytics(transactions, budget, periodStart, periodEnd);

      // Spent: 50, days elapsed: 10, daily burn: 5
      // Projected: 5 * 30 = 150 (days in period is 30, not 31)
      expect(result.dailyBurnRate).toBeCloseTo(5.000, 3);
      expect(result.projectedTotal).toBeCloseTo(150.000, 3);
    });

    it('should determine status as good when under 75%', () => {
      const transactions: Transaction[] = [
        createMockTransaction({ amount: 70.000 }),
      ];

      const periodStart = new Date('2026-01-01');
      const periodEnd = new Date('2026-01-31');
      const budget = 100.000;

      const result = calculateBudgetAnalytics(transactions, budget, periodStart, periodEnd);

      expect(result.percentageUsed).toBe(70);
      expect(result.status).toBe('good');
    });

    it('should determine status as warning when 75-89%', () => {
      const transactions: Transaction[] = [
        createMockTransaction({ amount: 80.000 }),
      ];

      const periodStart = new Date('2026-01-01');
      const periodEnd = new Date('2026-01-31');
      const budget = 100.000;

      const result = calculateBudgetAnalytics(transactions, budget, periodStart, periodEnd);

      expect(result.percentageUsed).toBe(80);
      expect(result.status).toBe('warning');
    });

    it('should determine status as danger when >= 90%', () => {
      const transactions: Transaction[] = [
        createMockTransaction({ amount: 95.000 }),
      ];

      const periodStart = new Date('2026-01-01');
      const periodEnd = new Date('2026-01-31');
      const budget = 100.000;

      const result = calculateBudgetAnalytics(transactions, budget, periodStart, periodEnd);

      expect(result.percentageUsed).toBe(95);
      expect(result.status).toBe('danger');
    });

    it('should track on-track status correctly', () => {
      const transactions: Transaction[] = [
        createMockTransaction({ amount: 30.000 }),
      ];

      const periodStart = new Date('2026-01-01');
      const periodEnd = new Date('2026-01-31');
      const budget = 310.000; // 10 per day recommended

      const result = calculateBudgetAnalytics(transactions, budget, periodStart, periodEnd);

      // Daily burn: 30/10 = 3, recommended: 310/30 = 10.333
      expect(result.dailyBurnRate).toBeCloseTo(3.000, 3);
      expect(result.recommendedDailyRate).toBeCloseTo(10.333, 3);
      expect(result.onTrack).toBe(true);
    });

    it('should handle zero budget edge case', () => {
      const transactions: Transaction[] = [
        createMockTransaction({ amount: 50.000 }),
      ];

      const periodStart = new Date('2026-01-01');
      const periodEnd = new Date('2026-01-31');
      const budget = 0;

      const result = calculateBudgetAnalytics(transactions, budget, periodStart, periodEnd);

      expect(result.percentageUsed).toBe(0);
      expect(result.recommendedDailyRate).toBe(0);
    });
  });

  describe('calculateTopMerchants', () => {
    it('should rank merchants by total spending', () => {
      const transactions: Transaction[] = [
        createMockTransaction({ merchant: 'Talabat', amount: 50.000 }),
        createMockTransaction({ merchant: 'Talabat', amount: 30.000 }),
        createMockTransaction({ merchant: 'Careem', amount: 40.000 }),
        createMockTransaction({ merchant: 'Lulu', amount: 20.000 }),
      ];

      const result = calculateTopMerchants(transactions, 10);

      expect(result).toHaveLength(3);
      expect(result[0].merchant).toBe('Talabat');
      expect(result[0].totalAmount).toBe(80.000);
      expect(result[0].rank).toBe(1);
      expect(result[1].merchant).toBe('Careem');
      expect(result[1].rank).toBe(2);
    });

    it('should calculate transaction count correctly', () => {
      const transactions: Transaction[] = [
        createMockTransaction({ merchant: 'Talabat', amount: 10.000 }),
        createMockTransaction({ merchant: 'Talabat', amount: 20.000 }),
        createMockTransaction({ merchant: 'Talabat', amount: 30.000 }),
      ];

      const result = calculateTopMerchants(transactions);

      expect(result[0].transactionCount).toBe(3);
    });

    it('should collect all categories for a merchant', () => {
      const transactions: Transaction[] = [
        createMockTransaction({ merchant: 'Talabat', category: 'Restaurants' }),
        createMockTransaction({ merchant: 'Talabat', category: 'Groceries' }),
        createMockTransaction({ merchant: 'Talabat', category: 'Restaurants' }),
      ];

      const result = calculateTopMerchants(transactions);

      expect(result[0].categories).toHaveLength(2);
      expect(result[0].categories).toContain('Restaurants');
      expect(result[0].categories).toContain('Groceries');
    });

    it('should calculate percentage of total spending', () => {
      const transactions: Transaction[] = [
        createMockTransaction({ merchant: 'Talabat', amount: 50.000 }),
        createMockTransaction({ merchant: 'Careem', amount: 50.000 }),
      ];

      const result = calculateTopMerchants(transactions);

      expect(result[0].percentage).toBe(50);
      expect(result[1].percentage).toBe(50);
    });

    it('should calculate average transaction amount', () => {
      const transactions: Transaction[] = [
        createMockTransaction({ merchant: 'Talabat', amount: 10.000 }),
        createMockTransaction({ merchant: 'Talabat', amount: 20.000 }),
        createMockTransaction({ merchant: 'Talabat', amount: 30.000 }),
      ];

      const result = calculateTopMerchants(transactions);

      expect(result[0].avgTransaction).toBe(20.000);
    });

    it('should limit results to specified number', () => {
      const transactions: Transaction[] = Array.from({ length: 15 }, (_, i) =>
        createMockTransaction({ merchant: `Merchant ${i}`, amount: 10.000 })
      );

      const result = calculateTopMerchants(transactions, 5);

      expect(result).toHaveLength(5);
    });
  });

  describe('calculateRecurringMerchants', () => {
    it('should identify recurring merchants (2+ visits)', () => {
      const transactions: Transaction[] = [
        createMockTransaction({ merchant: 'Talabat', date: '2026-01-01' }),
        createMockTransaction({ merchant: 'Talabat', date: '2026-01-05' }),
        createMockTransaction({ merchant: 'Careem', date: '2026-01-02' }),
      ];

      const periodStart = new Date('2026-01-01');
      const result = calculateRecurringMerchants(transactions, periodStart);

      expect(result).toHaveLength(1);
      expect(result[0].merchant).toBe('Talabat');
    });

    it('should rank by visit count', () => {
      const transactions: Transaction[] = [
        createMockTransaction({ merchant: 'Talabat', date: '2026-01-01' }),
        createMockTransaction({ merchant: 'Talabat', date: '2026-01-05' }),
        createMockTransaction({ merchant: 'Talabat', date: '2026-01-08' }),
        createMockTransaction({ merchant: 'Careem', date: '2026-01-02' }),
        createMockTransaction({ merchant: 'Careem', date: '2026-01-07' }),
      ];

      const periodStart = new Date('2026-01-01');
      const result = calculateRecurringMerchants(transactions, periodStart);

      expect(result[0].merchant).toBe('Talabat');
      expect(result[0].visitCount).toBe(3);
      expect(result[0].rank).toBe(1);
      expect(result[1].merchant).toBe('Careem');
      expect(result[1].visitCount).toBe(2);
      expect(result[1].rank).toBe(2);
    });

    it('should calculate frequency in visits per week format', () => {
      // 10 visits in 10 days = 1 visit/day = 7 visits/week
      const transactions: Transaction[] = Array.from({ length: 10 }, (_, i) =>
        createMockTransaction({
          merchant: 'DailyMerchant',
          date: `2026-01-${String(i + 1).padStart(2, '0')}`,
        })
      );

      const periodStart = new Date('2026-01-01');
      const result = calculateRecurringMerchants(transactions, periodStart);

      expect(result[0].frequency).toBe('~7/wk');
    });

    it('should calculate frequency in visits per month format for infrequent visits', () => {
      // 2 visits in 10 days = 0.2 visit/day = 1.4 visits/week -> rounds to ~1/wk
      const transactions: Transaction[] = [
        createMockTransaction({ merchant: 'Rare', date: '2026-01-01' }),
        createMockTransaction({ merchant: 'Rare', date: '2026-01-10' }),
      ];

      const periodStart = new Date('2026-01-01');
      const result = calculateRecurringMerchants(transactions, periodStart);

      // 2 visits / 10 days * 7 = 1.4/wk -> rounds to ~1/wk
      expect(result[0].frequency).toBe('~1/wk');
    });

    it('should calculate average days between visits', () => {
      const transactions: Transaction[] = [
        createMockTransaction({ merchant: 'Talabat', date: '2026-01-01' }),
        createMockTransaction({ merchant: 'Talabat', date: '2026-01-05' }), // 4 days
        createMockTransaction({ merchant: 'Talabat', date: '2026-01-11' }), // 6 days
      ];

      const periodStart = new Date('2026-01-01');
      const result = calculateRecurringMerchants(transactions, periodStart);

      expect(result[0].daysBetweenVisits).toBe(5); // Average of 4 and 6
    });

    it('should find most common category', () => {
      const transactions: Transaction[] = [
        createMockTransaction({ merchant: 'Talabat', category: 'Restaurants', date: '2026-01-01' }),
        createMockTransaction({ merchant: 'Talabat', category: 'Restaurants', date: '2026-01-05' }),
        createMockTransaction({ merchant: 'Talabat', category: 'Groceries', date: '2026-01-08' }),
      ];

      const periodStart = new Date('2026-01-01');
      const result = calculateRecurringMerchants(transactions, periodStart);

      expect(result[0].category).toBe('Restaurants');
    });

    it('should calculate average per visit', () => {
      const transactions: Transaction[] = [
        createMockTransaction({ merchant: 'Talabat', amount: 10.000, date: '2026-01-01' }),
        createMockTransaction({ merchant: 'Talabat', amount: 20.000, date: '2026-01-05' }),
        createMockTransaction({ merchant: 'Talabat', amount: 30.000, date: '2026-01-08' }),
      ];

      const periodStart = new Date('2026-01-01');
      const result = calculateRecurringMerchants(transactions, periodStart);

      expect(result[0].avgPerVisit).toBe(20.000);
    });
  });

  describe('calculateCategoryAnalytics', () => {
    it('should aggregate transactions by category', () => {
      const transactions: Transaction[] = [
        createMockTransaction({ category: 'Groceries', amount: 50.000 }),
        createMockTransaction({ category: 'Groceries', amount: 30.000 }),
        createMockTransaction({ category: 'Restaurants', amount: 40.000 }),
      ];

      const result = calculateCategoryAnalytics(transactions, 10);

      expect(result).toHaveLength(2);
      const groceries = result.find(c => c.category === 'Groceries');
      expect(groceries?.totalAmount).toBe(80.000);
      expect(groceries?.transactionCount).toBe(2);
    });

    it('should calculate percentage of total spending', () => {
      const transactions: Transaction[] = [
        createMockTransaction({ category: 'Groceries', amount: 50.000 }),
        createMockTransaction({ category: 'Restaurants', amount: 50.000 }),
      ];

      const result = calculateCategoryAnalytics(transactions, 10);

      expect(result[0].percentage).toBe(50);
      expect(result[1].percentage).toBe(50);
    });

    it('should calculate daily average', () => {
      const transactions: Transaction[] = [
        createMockTransaction({ category: 'Groceries', amount: 100.000 }),
      ];

      const result = calculateCategoryAnalytics(transactions, 10);

      expect(result[0].dailyAverage).toBe(10.000);
    });

    it('should include top 3 merchants per category', () => {
      const transactions: Transaction[] = [
        createMockTransaction({ category: 'Groceries', merchant: 'Lulu', amount: 50.000 }),
        createMockTransaction({ category: 'Groceries', merchant: 'Lulu', amount: 30.000 }),
        createMockTransaction({ category: 'Groceries', merchant: 'Carrefour', amount: 40.000 }),
        createMockTransaction({ category: 'Groceries', merchant: 'Nesto', amount: 20.000 }),
        createMockTransaction({ category: 'Groceries', merchant: 'AlJazira', amount: 10.000 }),
      ];

      const result = calculateCategoryAnalytics(transactions, 10);

      expect(result[0].topMerchants).toHaveLength(3);
      expect(result[0].topMerchants[0].merchant).toBe('Lulu');
      expect(result[0].topMerchants[0].amount).toBe(80.000);
      expect(result[0].topMerchants[1].merchant).toBe('Carrefour');
      expect(result[0].topMerchants[2].merchant).toBe('Nesto');
    });

    it('should sort categories by total amount descending', () => {
      const transactions: Transaction[] = [
        createMockTransaction({ category: 'Restaurants', amount: 100.000 }),
        createMockTransaction({ category: 'Groceries', amount: 200.000 }),
        createMockTransaction({ category: 'Shopping', amount: 50.000 }),
      ];

      const result = calculateCategoryAnalytics(transactions, 10);

      expect(result[0].category).toBe('Groceries');
      expect(result[1].category).toBe('Restaurants');
      expect(result[2].category).toBe('Shopping');
    });
  });
});
