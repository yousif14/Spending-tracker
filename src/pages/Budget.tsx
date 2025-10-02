import { useState } from 'react';
import { Target, TrendingUp, TrendingDown, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { mockCategories, mockSummary } from '@/lib/mockData';

// Mock budget data
const mockBudgetTargets = [
  { category: 'Groceries', target: 100.000, spent: 25.500 },
  { category: 'Restaurants', target: 80.000, spent: 4.200 },
  { category: 'Transportation', target: 50.000, spent: 18.750 },
  { category: 'Shopping', target: 150.000, spent: 89.900 },
  { category: 'Entertainment', target: 40.000, spent: 12.000 },
  { category: 'Health', target: 60.000, spent: 35.000 },
];

export default function Budget() {
  const [isEditing, setIsEditing] = useState(false);

  const getBudgetStatus = (spent: number, target: number) => {
    const percentage = (spent / target) * 100;
    if (percentage >= 90) return { status: 'danger', color: 'text-destructive bg-destructive/10' };
    if (percentage >= 75) return { status: 'warning', color: 'text-warning bg-warning/10' };
    return { status: 'good', color: 'text-success bg-success/10' };
  };

  const totalBudget = mockBudgetTargets.reduce((sum, item) => sum + item.target, 0);
  const totalSpent = mockBudgetTargets.reduce((sum, item) => sum + item.spent, 0);
  const budgetProgress = (totalSpent / totalBudget) * 100;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Budget</h1>
          <p className="text-muted-foreground">Track your spending against your targets</p>
        </div>
        <Button 
          onClick={() => setIsEditing(!isEditing)}
          variant="outline"
        >
          <Edit className="w-4 h-4 mr-2" />
          {isEditing ? 'Save Changes' : 'Edit Budget'}
        </Button>
      </div>

      {/* Overall Budget Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="kpi-card">
          <div className="flex items-center gap-3 mb-4">
            <Target className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">Total Budget</h3>
          </div>
          <p className="text-2xl font-bold text-foreground currency-bhd">
            {totalBudget.toFixed(3)}
          </p>
        </div>

        <div className="kpi-card">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-5 h-5 text-success" />
            <h3 className="font-semibold text-foreground">Total Spent</h3>
          </div>
          <p className="text-2xl font-bold text-foreground currency-bhd">
            {totalSpent.toFixed(3)}
          </p>
        </div>

        <div className="kpi-card">
          <div className="flex items-center gap-3 mb-4">
            <TrendingDown className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">Remaining</h3>
          </div>
          <p className="text-2xl font-bold text-foreground currency-bhd">
            {(totalBudget - totalSpent).toFixed(3)}
          </p>
        </div>
      </div>

      {/* Budget Progress */}
      <div className="kpi-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Overall Progress</h3>
          <span className="text-sm font-medium text-muted-foreground">
            {budgetProgress.toFixed(1)}% used
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-3">
          <div 
            className="h-3 rounded-full transition-all duration-500 gradient-primary"
            style={{ width: `${Math.min(budgetProgress, 100)}%` }}
          />
        </div>
      </div>

      {/* Category Budgets */}
      <div className="kpi-card">
        <h3 className="text-lg font-semibold text-foreground mb-6">Budget by Category</h3>
        <div className="space-y-6">
          {mockBudgetTargets.map((item) => {
            const categoryColor = mockCategories.find(c => c.name === item.category)?.color;
            const percentage = (item.spent / item.target) * 100;
            const { color } = getBudgetStatus(item.spent, item.target);
            
            return (
              <div key={item.category} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: categoryColor }}
                    />
                    <span className="font-medium text-foreground">{item.category}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-xs px-2 py-1 rounded-lg ${color}`}>
                      {percentage.toFixed(1)}%
                    </span>
                    <div className="text-right">
                      <p className="text-sm font-medium text-foreground currency-bhd">
                        {item.spent.toFixed(3)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        of BD {item.target.toFixed(3)}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="h-2 rounded-full transition-all duration-500"
                    style={{ 
                      width: `${Math.min(percentage, 100)}%`,
                      backgroundColor: categoryColor 
                    }}
                  />
                </div>
                
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>BD 0</span>
                  <span>BD {item.target.toFixed(3)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Editing Mode Placeholder */}
      {isEditing && (
        <div className="kpi-card">
          <h3 className="text-lg font-semibold text-foreground mb-4">Edit Budget Targets</h3>
          <p className="text-muted-foreground">Budget editing functionality will be implemented here.</p>
        </div>
      )}
    </div>
  );
}