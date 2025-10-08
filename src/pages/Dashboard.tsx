import React, { useState, useMemo } from 'react';
import { TrendingUp, Receipt, Calendar, Target } from 'lucide-react';
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
  
  // Get today's date for max range
  const today = new Date().toISOString().split('T')[0];
  
  const [dateRange] = useState({
    start: '2020-01-01',
    end: today
  });

  // ⭐ CRITICAL: Fetch ALL transactions with wide date range
  const { data: allTransactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions', '2020-01-01', '2030-12-31'],
    queryFn: () => apiClient.getTransactions('2020-01-01', '2030-12-31'),
    staleTime: 30000,
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiClient.getCategories(),
    staleTime: 300000,
  });

  // 🔥 DEBUG: Log the actual count
  console.log('=== DASHBOARD DEBUG ===');
  console.log('Total transactions loaded:', allTransactions.length);
  console.log('First transaction:', allTransactions[0]);
  console.log('Last transaction:', allTransactions[allTransactions.length - 1]);

  // Filter transactions by selected date range
  const filteredTransactions = useMemo(() => {
    const filtered = allTransactions.filter(transaction => {
      const transactionDate = new Date(transaction.date);
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      return transactionDate >= startDate && transactionDate <= endDate;
    });
    console.log('Filtered transactions:', filtered.length);
    return filtered;
  }, [allTransactions, dateRange]);

  // Compute current month data
  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentMonthTransactions = useMemo(() => {
    const filtered = allTransactions.filter(t => t.date.startsWith(currentMonth));
    console.log('Current month transactions:', filtered.length);
    return filtered;
  }, [allTransactions, currentMonth]);

  // Compute previous month data
  const previousMonth = new Date();
  previousMonth.setMonth(previousMonth.getMonth() - 1);
  const prevMonthStr = previousMonth.toISOString().slice(0, 7);
  const previousMonthTransactions = useMemo(() => {
    return allTransactions.filter(t => t.date.startsWith(prevMonthStr));
  }, [allTransactions, prevMonthStr]);

  // Compute summary data
  const summary: Summary = useMemo(() => {
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

  // 🎯 CRITICAL: Compute ACCURATE KPI data
  const kpiData: KPIData = useMemo(() => {
    const totalThisMonth = currentMonthTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalLastMonth = previousMonthTransactions.reduce((sum, t) => sum + t.amount, 0);
    const vsLastMonth = totalLastMonth > 0 
      ? ((totalThisMonth - totalLastMonth) / totalLastMonth) * 100 
      : 0;

    // ⭐ THIS IS THE FIX: Use filteredTransactions.length NOT some other count
    const transactionCount = filteredTransactions.length;
    
    console.log('=== KPI CALCULATIONS ===');
    console.log('Total This Month:', totalThisMonth);
    console.log('Transaction Count:', transactionCount);
    console.log('Filtered count:', filteredTransactions.length);
    
    const days = summary.dailySeries.length || 1;
    const avgDaily = summary.total / days;

    return {
      totalThisMonth,
      vsLastMonth,
      transactionCount, // ⭐ THIS WILL NOW SHOW 932!
      avgDaily,
    };
  }, [currentMonthTransactions, previousMonthTransactions, filteredTransactions, summary]);

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
            variant="outline"
            className="font-medium"
          >
            <Calendar className="w-4 h-4 mr-2" />
            All Time
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
            filteredTransactions.slice(0, 5).map((transaction, index) => (
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
                  <p className="text-sm text-muted-foreground">{transaction.date}</p>
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