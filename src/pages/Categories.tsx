import { useState } from 'react';
import { FolderOpen, TrendingUp, Receipt } from 'lucide-react';
import { mockCategories, mockSummary } from '@/lib/mockData';

export default function Categories() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const getCategoryStats = (categoryName: string) => {
    const categoryData = mockSummary.totalsByCategory.find(c => c.category === categoryName);
    return {
      amount: categoryData?.amount || 0,
      transactions: 1, // Mock data - would come from actual transaction count
      percentage: categoryData ? (categoryData.amount / mockSummary.total) * 100 : 0
    };
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Categories</h1>
          <p className="text-muted-foreground">Analyze your spending by category</p>
        </div>
      </div>

      {/* Categories Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {mockCategories.map((category) => {
          const stats = getCategoryStats(category.name);
          
          return (
            <div
              key={category.name}
              className="kpi-card cursor-pointer hover:scale-105 transition-all duration-200"
              onClick={() => setSelectedCategory(selectedCategory === category.name ? null : category.name)}
            >
              <div className="flex items-center justify-between mb-4">
                <div 
                  className="p-3 rounded-xl"
                  style={{ backgroundColor: `${category.color}20` }}
                >
                  <FolderOpen 
                    className="w-6 h-6" 
                    style={{ color: category.color }}
                  />
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    {stats.percentage.toFixed(1)}%
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">{category.name}</h3>
                <p className="text-xl font-bold text-foreground currency-bhd">
                  {stats.amount.toFixed(3)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {stats.transactions} transaction{stats.transactions !== 1 ? 's' : ''}
                </p>
              </div>
              
              {/* Progress bar */}
              <div className="mt-4">
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div 
                    className="h-1.5 rounded-full transition-all duration-500"
                    style={{ 
                      width: `${Math.min(stats.percentage, 100)}%`,
                      backgroundColor: category.color 
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Category Detail Panel */}
      {selectedCategory && (
        <div className="kpi-card animate-fade-up">
          <div className="flex items-center gap-3 mb-6">
            <div 
              className="p-3 rounded-xl"
              style={{ backgroundColor: `${mockCategories.find(c => c.name === selectedCategory)?.color}20` }}
            >
              <FolderOpen 
                className="w-6 h-6" 
                style={{ color: mockCategories.find(c => c.name === selectedCategory)?.color }}
              />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-foreground">{selectedCategory}</h3>
              <p className="text-muted-foreground">Detailed breakdown</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <TrendingUp className="w-5 h-5 text-success mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground currency-bhd">
                {getCategoryStats(selectedCategory).amount.toFixed(3)}
              </p>
              <p className="text-sm text-muted-foreground">Total Spent</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <Receipt className="w-5 h-5 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">
                {getCategoryStats(selectedCategory).transactions}
              </p>
              <p className="text-sm text-muted-foreground">Transactions</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <FolderOpen className="w-5 h-5 text-warning mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">
                {getCategoryStats(selectedCategory).percentage.toFixed(1)}%
              </p>
              <p className="text-sm text-muted-foreground">of Total</p>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4">Recent Transactions</h4>
            <p className="text-muted-foreground">Transaction history for this category would be shown here.</p>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="kpi-card">
        <h3 className="text-lg font-semibold text-foreground mb-4">Category Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-foreground mb-3">Top Spending Categories</h4>
            <div className="space-y-2">
              {mockSummary.totalsByCategory.slice(0, 3).map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-foreground">{item.category}</span>
                  </div>
                  <span className="text-sm font-medium text-foreground currency-bhd">
                    {item.amount.toFixed(3)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-foreground mb-3">Category Count</h4>
            <p className="text-3xl font-bold text-foreground">{mockCategories.length}</p>
            <p className="text-sm text-muted-foreground">Active categories</p>
          </div>
        </div>
      </div>
    </div>
  );
}