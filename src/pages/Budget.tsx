import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DateRangeSelector } from '@/components/DateRangeSelector';
import { SummaryCards } from '@/components/budget/SummaryCards';
import { CategoryBreakdown } from '@/components/budget/CategoryBreakdown';
import { TopMerchantsTable } from '@/components/budget/TopMerchantsTable';
import { RecurringMerchantsTable } from '@/components/budget/RecurringMerchantsTable';
import { apiClient } from '@/lib/api';
import { DateRangeConfig, buildRange, getCurrentPeriodWindow } from '@/utils/period';
import {
  calculateBudgetAnalytics,
  calculateTopMerchants,
  calculateRecurringMerchants,
  calculateCategoryAnalytics,
} from '@/lib/budgetAnalytics';

// Default total budget (can be made configurable later)
const DEFAULT_TOTAL_BUDGET = 600.000;

export default function Budget() {
  // Date range state (persisted in localStorage)
  const [dateRangeConfig, setDateRangeConfig] = useState<DateRangeConfig>(() => {
    const saved = localStorage.getItem('txnRange:v1');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fall through to default
      }
    }
    const current = getCurrentPeriodWindow();
    return {
      mode: 'fiscal',
      month: current.month,
      year: current.year,
    };
  });

  // Resolve date range to from/to dates
  const resolvedRange = useMemo(() => buildRange(dateRangeConfig), [dateRangeConfig]);

  // Fetch all transactions
  const { data: allTransactions = [], isLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => apiClient.getTransactions(),
    staleTime: 30000,
  });

  // Filter transactions by date range
  const filteredTransactions = useMemo(() => {
    if (!resolvedRange.from || !resolvedRange.to) {
      return allTransactions; // All time mode
    }
    return allTransactions.filter(txn =>
      txn.date >= resolvedRange.from! && txn.date <= resolvedRange.to!
    );
  }, [allTransactions, resolvedRange]);

  // Calculate all analytics
  const analytics = useMemo(() => {
    if (filteredTransactions.length === 0) {
      return null; // No transactions to analyze
    }

    let periodStart: Date;
    let periodEnd: Date;

    if (!resolvedRange.from || !resolvedRange.to) {
      // "All Time" mode - use actual transaction date range
      const dates = filteredTransactions.map(t => new Date(t.date).getTime());
      periodStart = new Date(Math.min(...dates));
      periodEnd = new Date(Math.max(...dates));
    } else {
      // Specific date range mode
      periodStart = new Date(resolvedRange.from);
      periodEnd = new Date(resolvedRange.to);
    }

    const budgetAnalytics = calculateBudgetAnalytics(
      filteredTransactions,
      DEFAULT_TOTAL_BUDGET,
      periodStart,
      periodEnd
    );

    const topMerchants = calculateTopMerchants(filteredTransactions);
    const recurringMerchants = calculateRecurringMerchants(filteredTransactions, periodStart);
    const categoryAnalytics = calculateCategoryAnalytics(
      filteredTransactions,
      budgetAnalytics.daysElapsed
    );

    return {
      budget: budgetAnalytics,
      topMerchants,
      recurringMerchants,
      categories: categoryAnalytics,
    };
  }, [filteredTransactions, resolvedRange]);

  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading budget data...</p>
        </div>
      </div>
    );
  }

  // No transactions available
  if (!analytics) {
    return (
      <div className="max-w-7xl mx-auto p-6 space-y-6 animate-fade-up">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Budget Analytics</h1>
            <p className="text-muted-foreground">Comprehensive spending insights for your fiscal period</p>
          </div>
        </div>

        <DateRangeSelector
          value={dateRangeConfig}
          onChange={setDateRangeConfig}
          storageKey="txnRange:v1"
        />

        <div className="kpi-card">
          <p className="text-muted-foreground text-center py-8">
            No transactions found for the selected period.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Budget Analytics</h1>
          <p className="text-muted-foreground">Comprehensive spending insights for your fiscal period</p>
        </div>
      </div>

      {/* Date Range Selector */}
      <DateRangeSelector
        value={dateRangeConfig}
        onChange={setDateRangeConfig}
        storageKey="txnRange:v1"
      />

      {/* Summary Cards (KPIs) */}
      <SummaryCards analytics={analytics.budget} />

      {/* Category Breakdown */}
      <CategoryBreakdown
        categories={analytics.categories}
        budget={DEFAULT_TOTAL_BUDGET}
      />

      {/* Top Merchants by Spending */}
      <TopMerchantsTable merchants={analytics.topMerchants} />

      {/* Recurring Merchants */}
      <RecurringMerchantsTable merchants={analytics.recurringMerchants} />
    </div>
  );
}