import { useState, useMemo } from 'react';
import { Store, Search, TrendingDown, Receipt, Edit2, Check, X, ArrowUpDown } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DateRangeSelector } from '@/components/DateRangeSelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { DateRangeConfig, buildRange, getCurrentPeriodWindow } from '@/utils/period';
import { getCategoryColor } from '@/utils/categoryColors';

interface MerchantData {
  merchant: string;
  category: string;
  totalAmount: number;
  transactionCount: number;
}

type SortOption = 'name' | 'amount' | 'transactions' | 'category';
type SortDirection = 'asc' | 'desc';

export default function Merchants() {
  // Date range state (persisted in localStorage)
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

  // Filter and sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('amount');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [editingMerchant, setEditingMerchant] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Resolve date range to from/to dates
  const resolvedRange = useMemo(() => buildRange(dateRangeConfig), [dateRangeConfig]);

  // Fetch all transactions
  const { data: allTransactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => apiClient.getTransactions(),
    staleTime: 30000,
  });

  // Filter transactions by date range
  const filteredTransactions = useMemo(() => {
    if (!resolvedRange.from || !resolvedRange.to) {
      return allTransactions; // All time mode
    }
    return allTransactions.filter(txn =>
      txn.date >= resolvedRange.from! && txn.date <= resolvedRange.to!
    );
  }, [allTransactions, resolvedRange]);

  // Calculate merchant data
  const merchantsData = useMemo(() => {
    const merchantMap: Record<string, MerchantData> = {};

    filteredTransactions.forEach(txn => {
      const merchant = txn.merchant || 'Unknown';
      if (!merchantMap[merchant]) {
        merchantMap[merchant] = {
          merchant,
          category: txn.category || 'Other',
          totalAmount: 0,
          transactionCount: 0,
        };
      }
      merchantMap[merchant].totalAmount += txn.amount;
      merchantMap[merchant].transactionCount += 1;
    });

    return Object.values(merchantMap);
  }, [filteredTransactions]);

  // Mutations
  const updateMerchantMutation = useMutation({
    mutationFn: ({ merchantName, newName, newCategory }: { merchantName: string; newName?: string; newCategory: string }) =>
      apiClient.updateMerchantCategory(merchantName, newCategory, newName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast({
        title: 'Success',
        description: 'Merchant updated successfully',
      });
      setEditingMerchant(null);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update merchant: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Get unique categories
  const categories = useMemo(() => {
    const categorySet = new Set<string>();
    merchantsData.forEach(m => categorySet.add(m.category));
    return Array.from(categorySet).sort();
  }, [merchantsData]);

  // Apply filters and sorting
  const filteredMerchants = useMemo(() => {
    let result = merchantsData;

    // Apply search filter
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(m =>
        m.merchant.toLowerCase().includes(lowerQuery)
      );
    }

    // Apply category filter
    if (categoryFilter !== 'all') {
      result = result.filter(m => m.category === categoryFilter);
    }

    // Apply sorting
    result = [...result].sort((a, b) => {
      let compareValue = 0;
      switch (sortBy) {
        case 'name':
          compareValue = a.merchant.localeCompare(b.merchant);
          break;
        case 'amount':
          compareValue = a.totalAmount - b.totalAmount;
          break;
        case 'transactions':
          compareValue = a.transactionCount - b.transactionCount;
          break;
        case 'category':
          compareValue = a.category.localeCompare(b.category);
          break;
      }
      return sortDirection === 'asc' ? compareValue : -compareValue;
    });

    return result;
  }, [merchantsData, searchQuery, categoryFilter, sortBy, sortDirection]);

  // Calculate summary stats - NOW BASED ON FILTERED MERCHANTS
  const totalSpent = filteredMerchants.reduce((sum, m) => sum + m.totalAmount, 0);
  const totalTransactions = filteredMerchants.reduce((sum, m) => sum + m.transactionCount, 0);

  const handleEditMerchant = (merchant: MerchantData) => {
    setEditingMerchant(merchant.merchant);
    setEditName(merchant.merchant);
    setEditCategory(merchant.category);
  };

  const handleSaveEdit = () => {
    if (!editingMerchant || !editCategory || !editName) return;

    // Update both name and category
    updateMerchantMutation.mutate({
      merchantName: editingMerchant,
      newName: editName !== editingMerchant ? editName : undefined,
      newCategory: editCategory,
    });
  };

  const handleCancelEdit = () => {
    setEditingMerchant(null);
    setEditName('');
    setEditCategory('');
  };


  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Merchants</h1>
          <p className="text-muted-foreground">Manage and analyze spending by merchant</p>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="kpi-card">
        <DateRangeSelector
          value={dateRangeConfig}
          onChange={setDateRangeConfig}
          storageKey="txnRange:v1"
        />
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="kpi-card">
          <div className="flex items-center gap-3 mb-4">
            <Store className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">Total Merchants</h3>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {filteredMerchants.length}
          </p>
        </div>

        <div className="kpi-card">
          <div className="flex items-center gap-3 mb-4">
            <TrendingDown className="w-5 h-5 text-success" />
            <h3 className="font-semibold text-foreground">Total Spent</h3>
          </div>
          <p className="text-2xl font-bold text-foreground currency-bhd">
            {totalSpent.toFixed(3)}
          </p>
        </div>

        <div className="kpi-card">
          <div className="flex items-center gap-3 mb-4">
            <Receipt className="w-5 h-5 text-warning" />
            <h3 className="font-semibold text-foreground">Transactions</h3>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {totalTransactions}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="kpi-card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search merchants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Category Filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort Field */}
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
            <SelectTrigger>
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="amount">Amount</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="category">Category</SelectItem>
              <SelectItem value="transactions">Transactions</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort Direction */}
          <Select value={sortDirection} onValueChange={(value) => setSortDirection(value as SortDirection)}>
            <SelectTrigger>
              <SelectValue placeholder="Direction" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="w-4 h-4" />
                  Descending
                </div>
              </SelectItem>
              <SelectItem value="asc">
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="w-4 h-4" />
                  Ascending
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Merchants List */}
      <div className="kpi-card">
        <h3 className="text-lg font-semibold text-foreground mb-6">Merchant List</h3>
        <div className="space-y-3">
          {filteredMerchants.map((merchant) => (
            <div
              key={merchant.merchant}
              className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              {editingMerchant === merchant.merchant ? (
                // Edit Mode - Edit name and category
                <div className="flex-1 flex items-center gap-4">
                  <div className="flex-1 space-y-3">
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">Merchant Name</label>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Merchant name"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">Category</label>
                      <Select value={editCategory} onValueChange={setEditCategory}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveEdit}
                      disabled={updateMerchantMutation.isPending}
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancelEdit}
                      disabled={updateMerchantMutation.isPending}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                // View Mode
                <>
                  <div className="flex items-center gap-4 flex-1">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getCategoryColor(merchant.category) }}
                    />
                    <div className="min-w-0">
                      <h4 className="font-medium text-foreground truncate">{merchant.merchant}</h4>
                      <p className="text-sm text-muted-foreground">{merchant.category}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm font-medium text-foreground currency-bhd">
                        {merchant.totalAmount.toFixed(3)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {merchant.transactionCount} transaction{merchant.transactionCount !== 1 ? 's' : ''}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEditMerchant(merchant)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}

          {filteredMerchants.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Store className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No merchants found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
