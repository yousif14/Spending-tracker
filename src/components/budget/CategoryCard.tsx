import { CategoryAnalytics } from '../../lib/budgetAnalytics';
import { getCategoryIcon } from '../../utils/categoryIcons';
import { getCategoryColor } from '../../utils/categoryColors';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';

interface CategoryCardProps {
  category: CategoryAnalytics;
  budget?: number; // Reserved for future use
}

export function CategoryCard({ category }: CategoryCardProps) {
  const Icon = getCategoryIcon(category.category);
  const categoryColor = getCategoryColor(category.category);

  // Format currency
  const fmt = (amount: number) => `BD ${amount.toFixed(3)}`;

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="pt-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-lg"
              style={{
                backgroundColor: `${categoryColor}15`,
              }}
            >
              <Icon
                className="h-5 w-5"
                style={{ color: categoryColor }}
              />
            </div>
            <div>
              <h3 className="font-semibold text-sm">{category.category}</h3>
              <p className="text-xs text-muted-foreground">
                {category.transactionCount} transaction{category.transactionCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="font-medium">
            {category.percentage.toFixed(1)}%
          </Badge>
        </div>

        {/* Amount */}
        <div className="mb-3">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-2xl font-bold">{fmt(category.totalAmount)}</span>
            <span className="text-xs text-muted-foreground">
              of total spending
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-3 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Daily average:</span>
            <span className="font-medium">{fmt(category.dailyAverage)}</span>
          </div>
        </div>

        {/* Top Merchants */}
        {category.topMerchants.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Top merchants:
            </p>
            <div className="space-y-1.5">
              {category.topMerchants.map((merchant, idx) => (
                <div
                  key={merchant.merchant}
                  className="flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-muted-foreground">
                      {idx + 1}.
                    </span>
                    <span className="truncate font-medium">
                      {merchant.merchant}
                    </span>
                    <span className="text-muted-foreground">
                      ({merchant.count})
                    </span>
                  </div>
                  <span className="font-medium ml-2">
                    {fmt(merchant.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
