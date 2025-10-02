import React, { useState } from 'react';
import { Plus, TrendingUp, Receipt, Calendar, Target, Settings } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { KPICard } from '@/components/dashboard/KPICard';
import { SpendingChart } from '@/components/dashboard/SpendingChart';
import { CategoryChart } from '@/components/dashboard/CategoryChart';
import { apiClient } from '@/lib/api';
import { formatBHD } from '@/lib/mockData';
import { Transaction, Category, Summary, KPIData } from '@/types';

export default function Dashboard() {
  const navigate = useNavigate();
  const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false);
  const [isDateRangeOpen, setIsDateRangeOpen] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: '2020-01-01',
    end: '2030-12-31'
  });

  // Use all-time data for dashboard
  const allTimeStart = '2020-01-01';
  const allTimeEnd = '2030-12-31';

  // Fetch all-time data for dashboard
  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions', allTimeStart, allTimeEnd],
    queryFn: () => apiClient.getTransactions(allTimeStart, allTimeEnd),
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiClient.getCategories(),
  });

  // Filter transactions by selected date range
  const filteredTransactions = React.useMemo(() => {
    return transactions.filter(transaction => {
      const transactionDate = new Date(transaction.date);
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      return transactionDate >= startDate && transactionDate <= endDate;
    });
  }, [transactions, dateRange]);

  // Compute summary data from filtered transactions
  const summary: Summary = React.useMemo(() => {
    const totalsByCategory = categories.map(category => ({
      category: category.name,
      amount: filteredTransactions
        .filter(t => t.category === category.name)
        .reduce((sum, t) => sum + t.amount, 0),
      color: category.color,
    })).filter(item => item.amount > 0);

    const total = totalsByCategory.reduce((sum, item) => sum + item.amount, 0);

    const dailySeries = filteredTransactions.reduce((acc, transaction) => {
      const existing = acc.find(d => d.date === transaction.date);
      if (existing) {
        existing.amount += transaction.amount;
      } else {
        acc.push({ date: transaction.date, amount: transaction.amount });
      }
      return acc;
    }, [] as { date: string; amount: number }[]).sort((a, b) => a.date.localeCompare(b.date));

    const topMerchants = filteredTransactions.reduce((acc, transaction) => {
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
  }, [filteredTransactions, categories]);

  // Compute KPI data
  const kpiData: KPIData = React.useMemo(() => {
    return apiClient.generateKPIData(summary);
  }, [summary]);

  const isLoading = transactionsLoading || categoriesLoading;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your spending overview.</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setIsDateRangeOpen(true)}
            variant="outline"
            className="font-medium"
          >
            <Settings className="w-4 h-4 mr-2" />
            {dateRange.start !== '2020-01-01' || dateRange.end !== '2030-12-31'
              ? `${dateRange.start} to ${dateRange.end}`
              : 'All Time'
            }
          </Button>
          <Button
            onClick={() => setIsAddTransactionOpen(true)}
            className="gradient-primary text-white font-medium shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Transaction
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading ? (
          // Loading skeleton
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="kpi-card animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-muted rounded w-1/2"></div>
            </div>
          ))
        ) : (
          <>
            <KPICard
              title="Total This Month"
              value={formatBHD(kpiData.totalThisMonth)}
              change={kpiData.vsLastMonth}
              icon={TrendingUp}
            />
            <KPICard
              title="Transactions"
              value={kpiData.transactionCount.toString()}
              icon={Receipt}
            />
            <KPICard
              title="Average Daily"
              value={formatBHD(kpiData.avgDaily)}
              icon={Calendar}
            />
            <KPICard
              title="Budget Remaining"
              value={formatBHD(500.000 - kpiData.totalThisMonth)}
              change={-15.2}
              icon={Target}
            />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
            // Loading skeleton for merchants
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-muted rounded-lg"></div>
                  <div>
                    <div className="h-4 bg-muted rounded w-24 mb-1"></div>
                    <div className="h-3 bg-muted rounded w-16"></div>
                  </div>
                </div>
                <div className="h-4 bg-muted rounded w-12"></div>
              </div>
            ))
          ) : summary.topMerchants.length > 0 ? (
            summary.topMerchants.slice(0, 3).map((merchant, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{merchant.merchant}</p>
                    <p className="text-sm text-muted-foreground">{merchant.transactions} transaction{merchant.transactions > 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-foreground currency-bhd">
                    {merchant.amount.toFixed(3)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-center py-4">No transactions this month</p>
          )}
        </div>
      </div>

      {/* Date Range Picker Modal */}
      {isDateRangeOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setIsDateRangeOpen(false)}
        >
          <div
            className="kpi-card max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">Select Date Range</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">Start Date</label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">End Date</label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setDateRange({ start: '2020-01-01', end: '2030-12-31' })}
                  variant="outline"
                  className="flex-1"
                >
                  All Time
                </Button>
                <Button
                  onClick={() => {
                    const today = new Date().toISOString().slice(0, 10);
                    const monthAgo = new Date();
                    monthAgo.setMonth(monthAgo.getMonth() - 1);
                    const monthAgoStr = monthAgo.toISOString().slice(0, 10);
                    setDateRange({ start: monthAgoStr, end: today });
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Last Month
                </Button>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button
                onClick={() => setIsDateRangeOpen(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => setIsDateRangeOpen(false)}
                className="flex-1"
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Transaction Modal Placeholder */}
      {isAddTransactionOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setIsAddTransactionOpen(false)}
        >
          <div
            className="kpi-card max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">Add Transaction</h3>
            <p className="text-muted-foreground mb-4">Transaction form will be implemented here.</p>
            <Button
              onClick={() => setIsAddTransactionOpen(false)}
              className="w-full"
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}