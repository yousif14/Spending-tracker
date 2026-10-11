import { useState } from 'react';
import { Store, ChevronDown, ChevronUp } from 'lucide-react';
import { MerchantSpending } from '../../lib/budgetAnalytics';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface TopMerchantsTableProps {
  merchants: MerchantSpending[];
}

export function TopMerchantsTable({ merchants }: TopMerchantsTableProps) {
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
            <Store className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Top 10 Merchants by Spending</CardTitle>
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
                    <th className="text-left py-3 px-2 font-medium">Categories</th>
                    <th className="text-right py-3 px-2 font-medium">Transactions</th>
                    <th className="text-right py-3 px-2 font-medium">Total</th>
                    <th className="text-right py-3 px-2 font-medium">Avg</th>
                    <th className="text-right py-3 px-2 font-medium">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {merchants.map((merchant) => (
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
                        <div className="flex flex-wrap gap-1">
                          {merchant.categories.map((cat) => (
                            <Badge
                              key={cat}
                              variant="outline"
                              className="text-xs"
                            >
                              {cat}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right text-muted-foreground">
                        {merchant.transactionCount}
                      </td>
                      <td className="py-3 px-2 text-right font-semibold">
                        {fmt(merchant.totalAmount)}
                      </td>
                      <td className="py-3 px-2 text-right text-muted-foreground">
                        {fmt(merchant.avgTransaction)}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <Badge variant="secondary">
                          {merchant.percentage.toFixed(1)}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {merchants.map((merchant) => (
              <div
                key={merchant.merchant}
                className="p-4 border rounded-lg space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-muted-foreground">
                        #{merchant.rank}
                      </span>
                      <span className="font-semibold">
                        {merchant.merchant}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {merchant.categories.map((cat) => (
                        <Badge
                          key={cat}
                          variant="outline"
                          className="text-xs"
                        >
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {merchant.percentage.toFixed(1)}%
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm pt-2 border-t">
                  <div>
                    <p className="text-muted-foreground text-xs">Total</p>
                    <p className="font-semibold">{fmt(merchant.totalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Avg</p>
                    <p className="font-medium">{fmt(merchant.avgTransaction)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Count</p>
                    <p className="font-medium">{merchant.transactionCount}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}

      {isCollapsed && (
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {merchants.length} merchants • Click to expand
          </p>
        </CardContent>
      )}
    </Card>
  );
}
