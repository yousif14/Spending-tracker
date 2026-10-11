import { useState } from 'react';
import { Repeat, ChevronDown, ChevronUp } from 'lucide-react';
import { RecurringMerchant } from '../../lib/budgetAnalytics';
import { getCategoryColor } from '../../utils/categoryColors';
import { getCategoryIcon } from '../../utils/categoryIcons';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface RecurringMerchantsTableProps {
  merchants: RecurringMerchant[];
}

export function RecurringMerchantsTable({ merchants }: RecurringMerchantsTableProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Format currency
  const fmt = (amount: number) => `BD ${amount.toFixed(3)}`;

  if (merchants.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Repeat className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Top 10 Recurring Merchants</CardTitle>
          </div>
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
      </CardHeader>

      {!isCollapsed && (
        <CardContent>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-sm text-muted-foreground">
                    <th className="text-left py-3 px-2 font-medium">#</th>
                    <th className="text-left py-3 px-2 font-medium">Merchant</th>
                    <th className="text-left py-3 px-2 font-medium">Category</th>
                    <th className="text-right py-3 px-2 font-medium">Visits</th>
                    <th className="text-right py-3 px-2 font-medium">Frequency</th>
                    <th className="text-right py-3 px-2 font-medium">Total</th>
                    <th className="text-right py-3 px-2 font-medium">Avg/Visit</th>
                    <th className="text-right py-3 px-2 font-medium">Days Between</th>
                  </tr>
                </thead>
                <tbody>
                  {merchants.map((merchant) => {
                    const CategoryIcon = getCategoryIcon(merchant.category);
                    const categoryColor = getCategoryColor(merchant.category);

                    return (
                      <tr
                        key={merchant.merchant}
                        className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                      >
                        <td className="py-3 px-2 font-medium text-muted-foreground">
                          {merchant.rank}
                        </td>
                        <td className="py-3 px-2 font-medium">
                          {merchant.merchant}
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <CategoryIcon
                              className="h-4 w-4"
                              style={{ color: categoryColor }}
                            />
                            <span className="text-sm">{merchant.category}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right font-semibold">
                          {merchant.visitCount}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <Badge variant="secondary" className="font-mono">
                            {merchant.frequency}
                          </Badge>
                        </td>
                        <td className="py-3 px-2 text-right font-semibold">
                          {fmt(merchant.totalAmount)}
                        </td>
                        <td className="py-3 px-2 text-right text-muted-foreground">
                          {fmt(merchant.avgPerVisit)}
                        </td>
                        <td className="py-3 px-2 text-right text-muted-foreground">
                          {merchant.daysBetweenVisits.toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {merchants.map((merchant) => {
              const CategoryIcon = getCategoryIcon(merchant.category);
              const categoryColor = getCategoryColor(merchant.category);

              return (
                <div
                  key={merchant.merchant}
                  className="p-4 border rounded-lg space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-muted-foreground">
                          #{merchant.rank}
                        </span>
                        <span className="font-semibold">
                          {merchant.merchant}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <CategoryIcon
                          className="h-4 w-4"
                          style={{ color: categoryColor }}
                        />
                        <span className="text-sm text-muted-foreground">
                          {merchant.category}
                        </span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="font-mono">
                      {merchant.frequency}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t">
                    <div>
                      <p className="text-muted-foreground text-xs">Visits</p>
                      <p className="font-semibold">{merchant.visitCount}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Days Between</p>
                      <p className="font-medium">{merchant.daysBetweenVisits.toFixed(1)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Total</p>
                      <p className="font-semibold">{fmt(merchant.totalAmount)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Avg/Visit</p>
                      <p className="font-medium">{fmt(merchant.avgPerVisit)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      )}

      {isCollapsed && (
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {merchants.length} recurring merchants • Click to expand
          </p>
        </CardContent>
      )}
    </Card>
  );
}
