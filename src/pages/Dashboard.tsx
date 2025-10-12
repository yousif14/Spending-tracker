/**
 * @fileoverview Dashboard Page Component
 *
 * Main dashboard displaying financial overview with KPIs, charts, and recent transactions.
 * Uses fiscal month windows (23rd to 22nd) for all calculations and displays.
 *
 * Key Features:
 * - Unified date range selector (Current, Prev, Next, Custom, All Time)
 * - Real-time stats: Total, Avg Daily (to-date & full), Budget Remaining
 * - Category and spending trend charts
 * - Recent transactions (newest first)
 * - localStorage persistence for date range and budget
 *
 * @component
 */

import React, { useState, useMemo, useEffect } from 'react';
import { TrendingUp, Receipt, Calendar, Target } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { KPICard } from '@/components/dashboard/KPICard';
import { SpendingChart } from '@/components/dashboard/SpendingChart';
import { CategoryChart } from '@/components/dashboard/CategoryChart';
import { DateRangeSelector } from '@/components/DateRangeSelector';
import { apiClient } from '@/lib/api';
import { formatBHD } from '@/lib/mockData';
import { Transaction, Category, Summary, KPIData } from '@/types';
import { getCurrentPeriodWindow, getPeriodWindow, combineDateTime, DateRangeConfig, buildRange } from '@/utils/period';
import { getCategoryColor } from '@/utils/categoryColors';

export default function Dashboard() {
  const navigate = useNavigate();

  // ========================================================================
  // STATE MANAGEMENT
  // ========================================================================

  /**
   * Date range configuration (persisted in localStorage)
   * Default: current fiscal period
   */
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

  /**
   * Budget amount in BHD (persisted in localStorage)
   * Default: 750
   */
  const [budget, setBudget] = useState(() => {
    const saved = localStorage.getItem('dashboard-budget');
    return saved ? Number(saved) : 750;
  });

  // Resolve date range to from/to dates
  const resolvedRange = useMemo(() => buildRange(dateRangeConfig), [dateRangeConfig]);

  // Calculate previous period for comparison (only for fiscal mode)
  const previousPeriod = useMemo(() => {
    if (dateRangeConfig.mode === 'fiscal' && dateRangeConfig.month && dateRangeConfig.year) {
      const prevMonth = dateRangeConfig.month === 1 ? 12 : dateRangeConfig.month - 1;
      const prevYear = dateRangeConfig.month === 1 ? dateRangeConfig.year - 1 : dateRangeConfig.year;
      return getPeriodWindow(prevYear, prevMonth);
    }
    return null;
  }, [dateRangeConfig]);

  // Persist budget to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('dashboard-budget', budget.toString());
  }, [budget]);

  // ========================================================================
  // DATA FETCHING
  // ========================================================================

  /**
   * Fetch all transactions (database has string dates, filter client-side)
   */
  const { data: allTransactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => apiClient.getTransactions(),
    staleTime: 30000,
  });

  // Client-side date filtering
  const currentPeriodTransactions = useMemo(() => {
    // If mode is 'all', return everything
    if (dateRangeConfig.mode === 'all') {
      return allTransactions;
    }

    // If no date range, return everything
    if (!resolvedRange.from || !resolvedRange.to) {
      return allTransactions;
    }

    // Filter by date range (string comparison works for YYYY-MM-DD format)
    return allTransactions.filter(t => {
      const txnDate = t.date;
      return txnDate >= resolvedRange.from! && txnDate <= resolvedRange.to!;
    });
  }, [allTransactions, resolvedRange, dateRangeConfig.mode]);

  // Fetch current period stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['transaction-stats', resolvedRange.from, resolvedRange.to, budget],
    queryFn: async () => {
      // For "all time" mode, calculate stats client-side
      if (dateRangeConfig.mode === 'all') {
        const total = currentPeriodTransactions.reduce((sum, t) => sum + t.amount, 0);
        return {
          total,
          daysElapsed: 0,
          daysInWindow: 0,
          avgDailyToDate: 0,
          avgDailyFull: 0,
          budget,
          budgetRemaining: budget - total,
        };
      }
      // For fiscal/custom modes with specific dates
      if (resolvedRange.from && resolvedRange.to) {
        return apiClient.getTransactionStats(resolvedRange.from, resolvedRange.to, budget);
      }
      return null;
    },
    enabled: dateRangeConfig.mode === 'all' || (!!resolvedRange.from && !!resolvedRange.to),
    staleTime: 30000,
  });

  // Client-side filtering for previous period (only for fiscal mode)
  const previousPeriodTransactions = useMemo(() => {
    if (!previousPeriod) {
      return [];
    }

    // Filter by previous period date range
    return allTransactions.filter(t => {
      const txnDate = t.date;
      return txnDate >= previousPeriod.from && txnDate <= previousPeriod.to;
    });
  }, [allTransactions, previousPeriod]);

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiClient.getCategories(),
    staleTime: 300000,
  });

  // ========================================================================
  // DATA PROCESSING & CALCULATIONS
  // ========================================================================

  /**
   * Sort transactions by combined datetime (newest first)
   */
  const sortedTransactions = useMemo(() => {
    return [...currentPeriodTransactions].sort((a, b) => {
      const aDateTime = combineDateTime(a.date, a.time);
      const bDateTime = combineDateTime(b.date, b.time);
      return bDateTime.localeCompare(aDateTime); // DESC order (newest first)
    });
  }, [currentPeriodTransactions]);

  /**
   * Compute summary data for charts
   * - Top 5 categories by spending (sorted descending)
   * - Daily spending series
   * - Top 5 merchants by spending
   */
  const summary: Summary = useMemo(() => {
    const total = sortedTransactions.reduce((sum, t) => sum + t.amount, 0);

    // Get top 5 categories by amount
    const totalsByCategory = categories.map(category => ({
      category: category.name,
      amount: sortedTransactions
        .filter(t => t.category === category.name)
        .reduce((sum, t) => sum + t.amount, 0),
      color: getCategoryColor(category.name),
    }))
    .filter(item => item.amount > 0)
    .sort((a, b) => b.amount - a.amount) // Sort descending
    .slice(0, 5); // Top 5 only

    const dailySeries = sortedTransactions.reduce((acc, transaction) => {
      const existing = acc.find(d => d.date === transaction.date);
      if (existing) {
        existing.amount += transaction.amount;
      } else {
        acc.push({ date: transaction.date, amount: transaction.amount });
      }
      return acc;
    }, [] as { date: string; amount: number }[]).sort((a, b) => a.date.localeCompare(b.date));

    const topMerchants = sortedTransactions.reduce((acc, transaction) => {
      const existing = acc.find(m => m.merchant === transaction.merchant);
      if (existing) {
        existing.amount += transaction.amount;
        existing.transactions += 1;
      } else {
        acc.push({
          merchant: transaction.merchant,
          amount: transaction.amount,
          transactions: 1,
        });
      }
      return acc;
    }, [] as { merchant: string; amount: number; transactions: number }[])
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

    return {
      totalsByCategory,
      total,
      topMerchants,
      dailySeries,
    };
  }, [sortedTransactions, categories]);

  // Calculate KPI data
  const kpiData: KPIData = useMemo(() => {
    if (!stats) {
      return {
        totalThisMonth: 0,
        vsLastMonth: 0,
        transactionCount: 0,
        avgDaily: 0,
      };
    }

    const totalThisMonth = stats.total;
    const totalLastMonth = previousPeriodTransactions.reduce((sum, t) => sum + t.amount, 0);
    const vsLastMonth = totalLastMonth > 0
      ? ((totalThisMonth - totalLastMonth) / totalLastMonth) * 100
      : 0;

    const transactionCount = currentPeriodTransactions.length;
    const avgDaily = stats.avgDailyToDate;

    return {
      totalThisMonth,
      vsLastMonth: previousPeriod ? vsLastMonth : 0,
      transactionCount,
      avgDaily,
    };
  }, [stats, currentPeriodTransactions, previousPeriodTransactions, previousPeriod]);

  const isLoading = transactionsLoading || categoriesLoading || statsLoading;

  // Get display label for current range
  const getRangeLabel = () => {
    if (dateRangeConfig.mode === 'all') {
      return 'All Time';
    }
    if (dateRangeConfig.mode === 'custom' && resolvedRange.from && resolvedRange.to) {
      return `${resolvedRange.from} → ${resolvedRange.to}`;
    }
    if (dateRangeConfig.mode === 'fiscal' && dateRangeConfig.month && dateRangeConfig.year) {
      return `Month ${dateRangeConfig.month} (${dateRangeConfig.year})`;
    }
    return 'Select Range';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 md:p-6 space-y-6 md:space-y-8 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col gap-3 md:gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            {getRangeLabel()}
          </p>
        </div>

        {/* Date Range Selector */}
        <DateRangeSelector
          value={dateRangeConfig}
          onChange={setDateRangeConfig}
          storageKey="txnRange:v1"
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="kpi-card animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-muted rounded w-1/2"></div>
            </div>
          ))
        ) : (
          <>
            <KPICard
              title={`Total ${dateRangeConfig.mode === 'all' ? 'All Time' : 'This Period'}`}
              value={formatBHD(stats?.total ?? 0)}
              change={previousPeriod ? kpiData.vsLastMonth : undefined}
              icon={TrendingUp}
            />
            <KPICard
              title="Transactions"
              value={kpiData.transactionCount.toString()}
              icon={Receipt}
            />
            {dateRangeConfig.mode !== 'all' && stats && stats.daysElapsed > 0 ? (
              <div className="kpi-card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    <h3 className="text-sm font-medium text-muted-foreground">Average Daily</h3>
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground">To-date ({stats.daysElapsed} days)</p>
                    <p className="text-2xl font-bold text-foreground">{formatBHD(stats.avgDailyToDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Full window ({stats.daysInWindow} days)</p>
                    <p className="text-xl font-semibold text-muted-foreground">{formatBHD(stats.avgDailyFull)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="kpi-card">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  <h3 className="text-sm font-medium text-muted-foreground">Average Daily</h3>
                </div>
                <p className="text-2xl font-bold text-muted-foreground mt-4">N/A</p>
                <p className="text-xs text-muted-foreground mt-1">Not applicable for All Time view</p>
              </div>
            )}
            <div className="kpi-card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  <h3 className="text-sm font-medium text-muted-foreground">Budget Remaining ({budget} BHD)</h3>
                </div>
              </div>
              <div>
                <p className={`text-2xl font-bold ${(stats?.budgetRemaining ?? 0) < 0 ? 'text-red-600' : 'text-foreground'}`}>
                  {formatBHD(stats?.budgetRemaining ?? 0)}
                </p>
                {stats && stats.budgetRemaining < 0 && (
                  <p className="text-sm text-red-600 mt-2">⚠️ Over budget by {formatBHD(Math.abs(stats.budgetRemaining))}</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {isLoading ? (
          <>
            <div className="kpi-card animate-pulse">
              <div className="h-64 bg-muted rounded"></div>
            </div>
            <div className="kpi-card animate-pulse">
              <div className="h-64 bg-muted rounded"></div>
            </div>
          </>
        ) : (
          <>
            <CategoryChart data={summary.totalsByCategory} />
            <SpendingChart data={summary.dailySeries} />
          </>
        )}
      </div>

      {/* Recent Transactions Preview */}
      <div className="kpi-card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Recent Transactions</h3>
            <p className="text-sm text-muted-foreground">Your latest spending activity</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/transactions')}
          >
            View All
          </Button>
        </div>

        <div className="space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="w-10 h-10 bg-muted rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
                    <div className="h-3 bg-muted rounded w-1/4"></div>
                  </div>
                  <div className="h-4 bg-muted rounded w-20"></div>
                </div>
              ))}
            </div>
          ) : (
            sortedTransactions.slice(0, 5).map((transaction, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: `${categories.find(c => c.name === transaction.category)?.color}20`,
                  }}
                >
                  <Receipt
                    className="w-5 h-5"
                    style={{ color: categories.find(c => c.name === transaction.category)?.color }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{transaction.merchant}</p>
                  <p className="text-sm text-muted-foreground">
                    {transaction.date} {transaction.time && <span className="text-xs">• {transaction.time}</span>}
                  </p>
                </div>
                <p className="font-semibold text-foreground currency-bhd">
                  {transaction.amount.toFixed(3)}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
