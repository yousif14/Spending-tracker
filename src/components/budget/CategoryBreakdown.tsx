import { useState } from 'react';
import { ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react';
import { CategoryAnalytics } from '../../lib/budgetAnalytics';
import { CategoryCard } from './CategoryCard';
import { Button } from '../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

interface CategoryBreakdownProps {
  categories: CategoryAnalytics[];
  budget?: number;
}

type SortOption = 'amount' | 'percentage' | 'name' | 'count';

export function CategoryBreakdown({ categories, budget }: CategoryBreakdownProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('amount');

  // Sort categories
  const sortedCategories = [...categories].sort((a, b) => {
    switch (sortBy) {
      case 'amount':
        return b.totalAmount - a.totalAmount;
      case 'percentage':
        return b.percentage - a.percentage;
      case 'name':
        return a.category.localeCompare(b.category);
      case 'count':
        return b.transactionCount - a.transactionCount;
      default:
        return 0;
    }
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Category Breakdown</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-8 w-8 p-0"
          >
            {isCollapsed ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>
        </div>

        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
              <SelectTrigger className="w-[150px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="amount">By Amount</SelectItem>
                <SelectItem value="percentage">By Percentage</SelectItem>
                <SelectItem value="name">By Name</SelectItem>
                <SelectItem value="count">By Count</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Categories Grid */}
      {!isCollapsed && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedCategories.map((category) => (
            <CategoryCard
              key={category.category}
              category={category}
              budget={budget}
            />
          ))}
        </div>
      )}

      {isCollapsed && (
        <p className="text-sm text-muted-foreground">
          {categories.length} categories • Click to expand
        </p>
      )}
    </div>
  );
}
