import { Transaction } from '../types';

export interface BudgetAnalytics {
  totalSpent: number;
  totalBudget: number;
  budgetRemaining: number;
  percentageUsed: number;
  daysElapsed: number;
  daysRemaining: number;
  daysInPeriod: number;
  dailyBurnRate: number;
  recommendedDailyRate: number;
  projectedTotal: number;
  daysUntilExhausted: number;
  status: 'good' | 'warning' | 'danger';
  onTrack: boolean;
}

export interface MerchantSpending {
  rank: number;
  merchant: string;
  totalAmount: number;
  transactionCount: number;
  categories: string[];
  percentage: number;
  avgTransaction: number;
}

export interface RecurringMerchant {
  rank: number;
  merchant: string;
  visitCount: number;
  totalAmount: number;
  frequency: string;
  avgPerVisit: number;
  category: string;
  daysBetweenVisits: number;
}

export interface CategoryAnalytics {
  category: string;
  totalAmount: number;
  transactionCount: number;
  percentage: number;
  dailyAverage: number;
  topMerchants: Array<{
    merchant: string;
    amount: number;
    count: number;
  }>;
}

/**
 * Calculate comprehensive budget analytics for a given period
 */
export function calculateBudgetAnalytics(
  transactions: Transaction[],
  budget: number,
  periodStart: Date,
  periodEnd: Date
): BudgetAnalytics {
  // Use Asia/Bahrain timezone for current date
  const nowInBahrain = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Bahrain'
  });
  const today = new Date(nowInBahrain);

  // Calculate days
  const daysElapsed = Math.max(1,
    Math.floor((today.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );
  const daysRemaining = Math.max(0,
    Math.floor((periodEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  );
  const daysInPeriod = daysElapsed + daysRemaining;

  // Calculate spending
  const totalSpent = transactions.reduce((sum, txn) => sum + txn.amount, 0);
  const budgetRemaining = budget - totalSpent;
  const percentageUsed = budget > 0 ? (totalSpent / budget) * 100 : 0;

  // Calculate rates
  const dailyBurnRate = totalSpent / daysElapsed;
  const recommendedDailyRate = budget / daysInPeriod;
  const projectedTotal = dailyBurnRate * daysInPeriod;

  // Calculate days until budget exhausted
  const daysUntilExhausted = budgetRemaining > 0 && dailyBurnRate > 0
    ? budgetRemaining / dailyBurnRate
    : daysRemaining;

  // Determine status
  let status: 'good' | 'warning' | 'danger';
  if (percentageUsed < 75) {
    status = 'good';
  } else if (percentageUsed < 90) {
    status = 'warning';
  } else {
    status = 'danger';
  }

  // Check if on track (burn rate vs recommended rate)
  const onTrack = dailyBurnRate <= recommendedDailyRate;

  return {
    totalSpent,
    totalBudget: budget,
    budgetRemaining,
    percentageUsed,
    daysElapsed,
    daysRemaining,
    daysInPeriod,
    dailyBurnRate,
    recommendedDailyRate,
    projectedTotal,
    daysUntilExhausted,
    status,
    onTrack
  };
}

/**
 * Calculate top merchants by total spending
 */
export function calculateTopMerchants(
  transactions: Transaction[],
  limit: number = 10
): MerchantSpending[] {
  const merchantMap = new Map<string, {
    total: number;
    count: number;
    categories: Set<string>;
  }>();

  // Aggregate by merchant
  transactions.forEach(txn => {
    const data = merchantMap.get(txn.merchant) ?? {
      total: 0,
      count: 0,
      categories: new Set()
    };
    data.total += txn.amount;
    data.count += 1;
    data.categories.add(txn.category);
    merchantMap.set(txn.merchant, data);
  });

  // Calculate total spent for percentage
  const totalSpent = transactions.reduce((sum, txn) => sum + txn.amount, 0);

  // Convert to array and rank
  const topMerchants = Array.from(merchantMap.entries())
    .map(([merchant, data]) => ({
      merchant,
      totalAmount: data.total,
      transactionCount: data.count,
      categories: Array.from(data.categories),
      percentage: totalSpent > 0 ? (data.total / totalSpent) * 100 : 0,
      avgTransaction: data.total / data.count
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, limit)
    .map((m, i) => ({ ...m, rank: i + 1 }));

  return topMerchants;
}

/**
 * Calculate recurring merchants by visit frequency
 */
export function calculateRecurringMerchants(
  transactions: Transaction[],
  periodStart: Date,
  limit: number = 10
): RecurringMerchant[] {
  // Use Asia/Bahrain timezone for current date
  const nowInBahrain = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Bahrain'
  });
  const today = new Date(nowInBahrain);

  const daysElapsed = Math.max(1,
    Math.floor((today.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );

  // Group transactions by merchant
  const merchantTransactions = new Map<string, Transaction[]>();
  transactions.forEach(txn => {
    const txns = merchantTransactions.get(txn.merchant) ?? [];
    txns.push(txn);
    merchantTransactions.set(txn.merchant, txns);
  });

  // Calculate frequency for merchants with 2+ visits
  const recurring = Array.from(merchantTransactions.entries())
    .filter(([_, txns]) => txns.length >= 2)
    .map(([merchant, txns]) => {
      const visitCount = txns.length;
      const totalAmount = txns.reduce((sum, t) => sum + t.amount, 0);

      // Calculate average days between visits
      const sortedDates = txns
        .map(t => new Date(t.date).getTime())
        .sort((a, b) => a - b);

      const gaps = sortedDates.slice(1).map((date, i) =>
        (date - sortedDates[i]) / (1000 * 60 * 60 * 24)
      );
      const avgDaysBetween = gaps.length > 0
        ? gaps.reduce((a, b) => a + b, 0) / gaps.length
        : 0;

      // Calculate frequency display string
      const visitsPerWeek = (visitCount / daysElapsed) * 7;
      const frequency = visitsPerWeek >= 1
        ? `~${Math.round(visitsPerWeek)}/wk`
        : `~${Math.round((visitCount / daysElapsed) * 30)}/mo`;

      // Find most common category
      const categoryCounts = new Map<string, number>();
      txns.forEach(t => {
        categoryCounts.set(t.category,
          (categoryCounts.get(t.category) ?? 0) + 1
        );
      });
      const category = Array.from(categoryCounts.entries())
        .sort((a, b) => b[1] - a[1])[0][0];

      return {
        merchant,
        visitCount,
        totalAmount,
        frequency,
        avgPerVisit: totalAmount / visitCount,
        category,
        daysBetweenVisits: avgDaysBetween
      };
    })
    .sort((a, b) => b.visitCount - a.visitCount)
    .slice(0, limit)
    .map((m, i) => ({ ...m, rank: i + 1 }));

  return recurring;
}

/**
 * Calculate category analytics with top merchants
 */
export function calculateCategoryAnalytics(
  transactions: Transaction[],
  daysElapsed: number
): CategoryAnalytics[] {
  const categoryMap = new Map<string, {
    total: number;
    count: number;
    merchants: Map<string, { amount: number; count: number }>;
  }>();

  // Aggregate by category and merchant
  transactions.forEach(txn => {
    const catData = categoryMap.get(txn.category) ?? {
      total: 0,
      count: 0,
      merchants: new Map()
    };

    catData.total += txn.amount;
    catData.count += 1;

    const merchantData = catData.merchants.get(txn.merchant) ?? { amount: 0, count: 0 };
    merchantData.amount += txn.amount;
    merchantData.count += 1;
    catData.merchants.set(txn.merchant, merchantData);

    categoryMap.set(txn.category, catData);
  });

  // Calculate total spent for percentage
  const totalSpent = transactions.reduce((sum, txn) => sum + txn.amount, 0);

  // Convert to array with top merchants
  const categoryAnalytics = Array.from(categoryMap.entries())
    .map(([category, data]) => {
      // Get top 3 merchants for this category
      const topMerchants = Array.from(data.merchants.entries())
        .map(([merchant, mData]) => ({
          merchant,
          amount: mData.amount,
          count: mData.count
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3);

      return {
        category,
        totalAmount: data.total,
        transactionCount: data.count,
        percentage: totalSpent > 0 ? (data.total / totalSpent) * 100 : 0,
        dailyAverage: data.total / daysElapsed,
        topMerchants
      };
    })
    .sort((a, b) => b.totalAmount - a.totalAmount);

  return categoryAnalytics;
}
