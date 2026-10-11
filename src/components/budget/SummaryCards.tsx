import { TrendingDown, TrendingUp, DollarSign, Activity, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { BudgetAnalytics } from '../../lib/budgetAnalytics';

interface SummaryCardsProps {
  analytics: BudgetAnalytics;
}

export function SummaryCards({ analytics }: SummaryCardsProps) {
  const {
    totalSpent,
    totalBudget,
    budgetRemaining,
    percentageUsed,
    dailyBurnRate,
    recommendedDailyRate,
    projectedTotal,
    daysRemaining,
    status,
    onTrack
  } = analytics;

  // Format currency
  const fmt = (amount: number) => `BD ${amount.toFixed(3)}`;

  // Status colors
  const statusColors = {
    good: 'text-green-600 dark:text-green-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    danger: 'text-red-600 dark:text-red-400'
  };

  const progressColors = {
    good: 'bg-green-600',
    warning: 'bg-yellow-600',
    danger: 'bg-red-600'
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Total Spent Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${statusColors[status]}`}>
            {fmt(totalSpent)}
          </div>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{percentageUsed.toFixed(1)}% of budget</span>
              <span>{fmt(totalBudget)}</span>
            </div>
            <Progress
              value={Math.min(percentageUsed, 100)}
              className="h-2"
              indicatorClassName={progressColors[status]}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {fmt(budgetRemaining)} remaining ({daysRemaining} days left)
          </p>
        </CardContent>
      </Card>

      {/* Daily Burn Rate Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Daily Burn Rate</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {fmt(dailyBurnRate)}/day
          </div>
          <div className="mt-2 flex items-center gap-2">
            {onTrack ? (
              <>
                <TrendingDown className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-xs text-green-600 dark:text-green-400">
                  On track
                </span>
              </>
            ) : (
              <>
                <TrendingUp className="h-4 w-4 text-red-600 dark:text-red-400" />
                <span className="text-xs text-red-600 dark:text-red-400">
                  Over pace
                </span>
              </>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Recommended: {fmt(recommendedDailyRate)}/day
          </p>
        </CardContent>
      </Card>

      {/* Forecast Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Projected Total</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {fmt(projectedTotal)}
          </div>
          <div className="mt-2">
            {projectedTotal > totalBudget ? (
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-red-600 dark:text-red-400" />
                <span className="text-xs text-red-600 dark:text-red-400">
                  {fmt(projectedTotal - totalBudget)} over budget
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-xs text-green-600 dark:text-green-400">
                  {fmt(totalBudget - projectedTotal)} under budget
                </span>
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Based on current spending pace
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
