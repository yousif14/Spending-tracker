import { useState, useMemo, useEffect } from 'react';
import { Search, Filter, Eye, ArrowUpDown, ArrowUp, ArrowDown, X, Edit2, Save, XCircle, Trash2, AlertTriangle, Plus, ChevronDown } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DateRangeSelector } from '@/components/DateRangeSelector';
import { TransactionCard } from '@/components/transactions/TransactionCard';
import { TransactionEditSheet } from '@/components/transactions/TransactionEditSheet';
import { SortControl, SortOption } from '@/components/transactions/SortControl';
import { apiClient } from '@/lib/api';
import { Transaction } from '@/types';
import { getCurrentPeriodWindow, combineDateTime, DateRangeConfig, buildRange } from '@/utils/period';
import { useToast } from "@/components/ui/use-toast";
import { getCategoryColor } from '@/utils/categoryColors';
import { getCategoryIcon } from '@/utils/categoryIcons';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";


type SortField = 'txnAt' | 'merchant' | 'category' | 'amount' | 'tag';
type SortDirection = 'asc' | 'desc';

export default function Transactions() {
  const queryClient = useQueryClient();

  // Date range configuration (shared with Dashboard via localStorage)
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

  // Resolve date range
  const resolvedRange = useMemo(() => {
    const range = buildRange(dateRangeConfig);
    console.log('=== TRANSACTIONS DATE RANGE ===');
    console.log('Config:', dateRangeConfig);
    console.log('Resolved:', range);
    return range;
  }, [dateRangeConfig]);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedMerchants, setSelectedMerchants] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>('txnAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [sortOption, setSortOption] = useState<SortOption>(() => {
    // Try to get from URL first, then localStorage, then default
    const urlParams = new URLSearchParams(window.location.search);
    const urlSort = urlParams.get('sort') as SortOption;
    if (urlSort) return urlSort;

    const savedSort = localStorage.getItem('txn-sort');
    return (savedSort as SortOption) || 'date-desc';
  });
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Transaction>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newTransactionForm, setNewTransactionForm] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    merchant: '',
    amount: '',
    category: '',
    tag: '',
  });
  const [isMobile, setIsMobile] = useState(false);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
  const [categoryBreakdownCollapsed, setCategoryBreakdownCollapsed] = useState(() => {
    const saved = localStorage.getItem('category-breakdown-collapsed');
    return saved === 'true';
  });

  // Detect mobile view
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Sync sortOption with URL and localStorage
  useEffect(() => {
    // Update URL
    const url = new URL(window.location.href);
    url.searchParams.set('sort', sortOption);
    window.history.replaceState({}, '', url.toString());

    // Update localStorage
    localStorage.setItem('txn-sort', sortOption);

    // Update old sortField/sortDirection for compatibility
    switch (sortOption) {
      case 'date-desc':
        setSortField('txnAt');
        setSortDirection('desc');
        break;
      case 'date-asc':
        setSortField('txnAt');
        setSortDirection('asc');
        break;
      case 'amount-desc':
        setSortField('amount');
        setSortDirection('desc');
        break;
      case 'amount-asc':
        setSortField('amount');
        setSortDirection('asc');
        break;
      case 'category-asc':
        setSortField('category');
        setSortDirection('asc');
        break;
      case 'category-desc':
        setSortField('category');
        setSortDirection('desc');
        break;
    }
  }, [sortOption]);

  // Persist category breakdown collapsed state
  useEffect(() => {
    localStorage.setItem('category-breakdown-collapsed', String(categoryBreakdownCollapsed));
  }, [categoryBreakdownCollapsed]);

  // Advanced search fields
  const [searchFilters, setSearchFilters] = useState({
    minAmount: '',
    maxAmount: '',
    tag: '',
  });

  // Fetch all transactions (database has string dates, can't filter efficiently)
  const { data: allTransactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => apiClient.getTransactions(),
  });

  // Client-side date filtering (since DB stores dates as strings)
  const transactions = useMemo(() => {
    console.log('=== TRANSACTIONS DATE FILTERING ===');
    console.log('Total transactions:', allTransactions.length);
    console.log('Date range:', resolvedRange);

    // If mode is 'all', return everything
    if (dateRangeConfig.mode === 'all') {
      console.log('Mode is "all", returning all transactions');
      return allTransactions;
    }

    // If no date range, return everything
    if (!resolvedRange.from || !resolvedRange.to) {
      console.log('No date range specified, returning all transactions');
      return allTransactions;
    }

    // Filter by date range (string comparison works for YYYY-MM-DD format)
    const filtered = allTransactions.filter(t => {
      const txnDate = t.date; // Already in YYYY-MM-DD format
      const inRange = txnDate >= resolvedRange.from! && txnDate <= resolvedRange.to!;
      return inRange;
    });

    console.log('Filtered transactions:', filtered.length);
    console.log('Sample filtered dates:', filtered.slice(0, 5).map(t => t.date));

    return filtered;
  }, [allTransactions, resolvedRange, dateRangeConfig.mode]);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiClient.getCategories(),
  });

  // Derive frequent categories and merchants from actual data (top 10 each by count)
  const frequentFilters = useMemo(() => {
    const categoryCount = new Map<string, number>();
    const merchantCount = new Map<string, number>();

    transactions.forEach(t => {
      if (t.category) {
        categoryCount.set(t.category, (categoryCount.get(t.category) || 0) + 1);
      }
      if (t.merchant) {
        merchantCount.set(t.merchant, (merchantCount.get(t.merchant) || 0) + 1);
      }
    });

    const topCategories = Array.from(categoryCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name]) => name);

    const topMerchants = Array.from(merchantCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name]) => name);

    return { topCategories, topMerchants };
  }, [transactions]);

  // Update mutation
  /*const updateMutation = useMutation({
    mutationFn: ({ sn, data }: { sn: string; data: Partial<Transaction> }) =>
      apiClient.updateTransaction(sn, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setEditingId(null);
      setEditForm({});
    },
  });*/

  // Handle edit start
  const handleEdit = (transaction: Transaction) => {
    if (isMobile) {
      // Open edit sheet on mobile
      setTransactionToEdit(transaction);
      setEditSheetOpen(true);
    } else {
      // Inline editing on desktop
      setEditingId(transaction.id.toString());
      setEditForm({
        date: transaction.date,
        time: transaction.time,
        merchant: transaction.merchant,
        amount: transaction.amount,
        category: transaction.category,
        tag: transaction.tag,
        cardEnding: transaction.cardEnding,
      });
    }
  };

  // Handle edit sheet save
  const handleEditSheetSave = (sn: string, data: Partial<Transaction>) => {
    updateMutation.mutate({ sn, data });
  };

  // Handle edit sheet close
  const handleEditSheetClose = () => {
    setEditSheetOpen(false);
    setTransactionToEdit(null);
  };

  // Handle save
  /*const handleSave = (sn: string) => {
    if (Object.keys(editForm).length > 0) {
      updateMutation.mutate({ sn, data: editForm });
    }
  };*/

  // ------------------------------------------------------
// Handle save
const handleSave = (sn: string) => {
  const clean: Partial<Transaction> = {};

  if (editForm.date) clean.date = editForm.date;             // "YYYY-MM-DD"
  if (editForm.time) clean.time = String(editForm.time).slice(0, 5); // "HH:MM"
  if (editForm.merchant) clean.merchant = editForm.merchant;
  if (editForm.category) clean.category = editForm.category;
  if (editForm.tag !== undefined) clean.tag = editForm.tag;
  if (editForm.amount !== undefined && editForm.amount !== null) {
    const num = typeof editForm.amount === 'string' ? Number(editForm.amount) : editForm.amount;
    if (Number.isFinite(num)) clean.amount = num;
  }
  if (editForm.cardEnding) clean.cardEnding = editForm.cardEnding;

  if (Object.keys(clean).length === 0) {
    setEditingId(null);
    setEditForm({});
    return; // nothing to update
  }

  updateMutation.mutate({ sn, data: clean });
};

  

const { toast } = useToast();

const updateMutation = useMutation({
  mutationFn: ({ sn, data }: { sn: string; data: Partial<Transaction> }) =>
    apiClient.updateTransaction(sn, data),

  // optional optimistic UI
  onMutate: async ({ sn, data }) => {
    await queryClient.cancelQueries({ queryKey: ['transactions'] });
    const prev = queryClient.getQueryData<Transaction[]>(['transactions']);
    queryClient.setQueryData<Transaction[]>(['transactions'], (old) =>
      (old ?? []).map(t => t.id.toString() === sn ? { ...t, ...data } as Transaction : t)
    );
    return { prev };
  },

  onError: (err, _vars, ctx) => {
    if (ctx?.prev) queryClient.setQueryData(['transactions'], ctx.prev);
    toast({
      variant: "destructive",
      title: "Update failed",
      description: (err as Error)?.message ?? "Please try again.",
    });
  },

  onSuccess: (result: any) => {
    // n8n returns { success, message, transaction }
    const sn = result?.transaction?.id ?? result?.transaction?.SN ?? result?.id ?? "—";
    toast({
      title: "Saved",
      description: `Transaction ${sn} updated successfully.`,
    });
  },

  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    setEditingId(null);
    setEditForm({});
    // Close edit sheet if open
    if (editSheetOpen) {
      setEditSheetOpen(false);
      setTransactionToEdit(null);
    }
  },
});

const deleteMutation = useMutation({
  mutationFn: (sn: string) => apiClient.deleteTransaction(sn),

  onMutate: async (sn) => {
    await queryClient.cancelQueries({ queryKey: ['transactions'] });
    const prev = queryClient.getQueryData<Transaction[]>(['transactions']);
    queryClient.setQueryData<Transaction[]>(['transactions'], (old) =>
      (old ?? []).filter(t => t.id.toString() !== sn)
    );
    return { prev };
  },

  onError: (err, _vars, ctx) => {
    if (ctx?.prev) queryClient.setQueryData(['transactions'], ctx.prev);
    toast({
      variant: "destructive",
      title: "Delete failed",
      description: (err as Error)?.message ?? "Please try again.",
    });
  },

  onSuccess: (_result, sn) => {
    toast({
      title: "Deleted",
      description: `Transaction ${sn} deleted successfully.`,
    });
  },

  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
  },
});

const createMutation = useMutation({
  mutationFn: (data: { date: string; time: string; merchant: string; amount: number; category: string; tag?: string }) =>
    apiClient.createManualTransaction(data),

  onError: (err) => {
    toast({
      variant: "destructive",
      title: "Failed to create transaction",
      description: (err as Error)?.message ?? "Please try again.",
    });
  },

  onSuccess: (result: any) => {
    toast({
      title: "Transaction created",
      description: "Your transaction has been added successfully.",
    });
    setAddDialogOpen(false);
    setNewTransactionForm({
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5),
      merchant: '',
      amount: '',
      category: '',
      tag: '',
    });
  },

  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
  },
});
  
  
  
  // ------------------------------------------------------



  // Handle cancel
  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  // Handle delete
  const handleDelete = (sn: string) => {
    setTransactionToDelete(sn);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (transactionToDelete) {
      deleteMutation.mutate(transactionToDelete);
      setDeleteDialogOpen(false);
      setTransactionToDelete(null);
    }
  };

  // Handle add transaction
  const handleAddTransaction = () => {
    // Validate mandatory fields
    if (!newTransactionForm.date || !newTransactionForm.time || !newTransactionForm.merchant || !newTransactionForm.amount || !newTransactionForm.category) {
      toast({
        variant: "destructive",
        title: "Missing required fields",
        description: "Please fill in all mandatory fields (Date, Time, Merchant, Amount, Category).",
      });
      return;
    }

    const amount = parseFloat(newTransactionForm.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid amount",
        description: "Please enter a valid positive amount.",
      });
      return;
    }

    createMutation.mutate({
      date: newTransactionForm.date,
      time: newTransactionForm.time,
      merchant: newTransactionForm.merchant,
      amount: amount,
      category: newTransactionForm.category,
      tag: newTransactionForm.tag || undefined,
    });
  };

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Get sort icon
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 text-muted-foreground" />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="w-4 h-4 text-primary" />
      : <ArrowDown className="w-4 h-4 text-primary" />;
  };

  // Filter and sort transactions
  const filteredTransactions = useMemo(() => {
    let filtered = transactions.filter(transaction => {
      // Multi-select category filter
      const categoryMatch = selectedCategories.length === 0 ||
        selectedCategories.includes(transaction.category);

      // Multi-select merchant filter
      const merchantMatch = selectedMerchants.length === 0 ||
        selectedMerchants.includes(transaction.merchant);

      // Free-text search
      const searchMatch = !searchQuery ||
        transaction.merchant.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.tag?.toLowerCase().includes(searchQuery.toLowerCase());

      // Amount range filters
      const minAmountMatch = !searchFilters.minAmount ||
        transaction.amount >= parseFloat(searchFilters.minAmount);

      const maxAmountMatch = !searchFilters.maxAmount ||
        transaction.amount <= parseFloat(searchFilters.maxAmount);

      // Tag filter
      const tagMatch = !searchFilters.tag ||
        transaction.tag?.toLowerCase().includes(searchFilters.tag.toLowerCase());

      return categoryMatch && merchantMatch && searchMatch &&
             minAmountMatch && maxAmountMatch && tagMatch;
    });

    // Sort by combined datetime (newest first by default)
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'txnAt':
          const aDateTime = combineDateTime(a.date, a.time);
          const bDateTime = combineDateTime(b.date, b.time);
          comparison = aDateTime.localeCompare(bDateTime);
          break;
        case 'merchant':
          comparison = a.merchant.localeCompare(b.merchant);
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        case 'tag':
          comparison = (a.tag || '').localeCompare(b.tag || '');
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [transactions, selectedCategories, selectedMerchants, searchQuery, sortField, sortDirection, searchFilters]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategories([]);
    setSelectedMerchants([]);
    setSearchFilters({
      minAmount: '',
      maxAmount: '',
      tag: '',
    });
  };

  const hasActiveFilters = searchQuery || selectedCategories.length > 0 ||
    selectedMerchants.length > 0 || Object.values(searchFilters).some(v => v !== '');

  // Calculate totals for filtered transactions
  const filteredTotals = useMemo(() => {
    const total = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);

    const byCategory = filteredTransactions.reduce((acc, t) => {
      if (!acc[t.category]) {
        acc[t.category] = {
          amount: 0,
          count: 0,
          color: getCategoryColor(t.category)
        };
      }
      acc[t.category].amount += t.amount;
      acc[t.category].count += 1;
      return acc;
    }, {} as Record<string, { amount: number; count: number; color: string }>);

    const categoryTotals = Object.entries(byCategory)
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.amount - a.amount);

    return { total, categoryTotals };
  }, [filteredTransactions]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 md:p-6 space-y-4 md:space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col gap-3 md:gap-4">
        <div className="flex items-start justify-between gap-3 md:gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Transactions</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Showing {filteredTransactions.length} of {transactions.length} transactions
            </p>
          </div>
          <Button className="flex items-center gap-2 touch-target" onClick={() => setAddDialogOpen(true)}>
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Transaction</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>

        {/* Date Range Selector */}
        <DateRangeSelector
          value={dateRangeConfig}
          onChange={setDateRangeConfig}
          storageKey="txnRange:v1"
        />
      </div>

      {/* Search and Filters */}
      <div className="kpi-card space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by merchant, category, or tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant={advancedSearchOpen ? "default" : "outline"}
              size="sm"
              onClick={() => setAdvancedSearchOpen(!advancedSearchOpen)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Advanced
            </Button>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
              >
                <X className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            )}
          </div>
        </div>

        {/* Active Filter Pills */}
        {(selectedCategories.length > 0 || selectedMerchants.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {selectedCategories.map(cat => (
              <Badge key={cat} variant="secondary" className="gap-1">
                {cat}
                <X
                  className="w-3 h-3 cursor-pointer"
                  onClick={() => setSelectedCategories(selectedCategories.filter(c => c !== cat))}
                />
              </Badge>
            ))}
            {selectedMerchants.map(mer => (
              <Badge key={mer} variant="outline" className="gap-1">
                {mer}
                <X
                  className="w-3 h-3 cursor-pointer"
                  onClick={() => setSelectedMerchants(selectedMerchants.filter(m => m !== mer))}
                />
              </Badge>
            ))}
          </div>
        )}

        {/* Quick Filter Chips - Dynamic from actual data */}
        <div className="space-y-2">
          {frequentFilters.topCategories.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-muted-foreground">Categories:</span>
              {frequentFilters.topCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => {
                    if (!selectedCategories.includes(cat)) {
                      setSelectedCategories([...selectedCategories, cat]);
                    }
                  }}
                  disabled={selectedCategories.includes(cat)}
                  className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
          {frequentFilters.topMerchants.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-muted-foreground">Merchants:</span>
              {frequentFilters.topMerchants.map(mer => (
                <button
                  key={mer}
                  onClick={() => {
                    if (!selectedMerchants.includes(mer)) {
                      setSelectedMerchants([...selectedMerchants, mer]);
                    }
                  }}
                  disabled={selectedMerchants.includes(mer)}
                  className="px-2 py-1 text-xs bg-secondary/10 text-secondary-foreground rounded-md hover:bg-secondary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {mer}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Advanced Search Panel */}
        {advancedSearchOpen && (
          <div className="pt-4 border-t border-border animate-fade-up">
            <h3 className="font-semibold text-foreground mb-4">Advanced Filters</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-2">
                  Tag
                </label>
                <Input
                  placeholder="Search tag..."
                  value={searchFilters.tag}
                  onChange={(e) => setSearchFilters({...searchFilters, tag: e.target.value})}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-2">
                  Min Amount (BHD)
                </label>
                <Input
                  type="number"
                  step="0.001"
                  placeholder="0.000"
                  value={searchFilters.minAmount}
                  onChange={(e) => setSearchFilters({...searchFilters, minAmount: e.target.value})}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-2">
                  Max Amount (BHD)
                </label>
                <Input
                  type="number"
                  step="0.001"
                  placeholder="999.999"
                  value={searchFilters.maxAmount}
                  onChange={(e) => setSearchFilters({...searchFilters, maxAmount: e.target.value})}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filtered Totals Summary */}
      {filteredTransactions.length > 0 && (
        <div className="kpi-card bg-gradient-to-br from-primary/5 via-background to-secondary/5">
          <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
            {/* Total Amount */}
            <div className="flex-shrink-0 lg:min-w-[240px]">
              <div className="bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl p-4 md:p-6 border border-primary/20">
                <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Filtered Total
                </h3>
                <p className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent currency-bhd mb-2">
                  {filteredTotals.total.toFixed(3)}
                </p>
                <div className="flex items-center gap-2">
                  <div className="bg-primary/20 rounded-full px-3 py-1">
                    <span className="text-xs font-semibold text-primary">
                      {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="flex-1">
              <button
                onClick={() => setCategoryBreakdownCollapsed(!categoryBreakdownCollapsed)}
                className="w-full text-sm font-semibold text-foreground mb-4 flex items-center gap-2 hover:text-primary transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                Category Breakdown
                <ChevronDown
                  className={`w-4 h-4 ml-auto transition-transform ${categoryBreakdownCollapsed ? '' : 'rotate-180'}`}
                />
              </button>
              {!categoryBreakdownCollapsed && (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
                {filteredTotals.categoryTotals.map(({ category, amount, count, color }) => {
                  const Icon = getCategoryIcon(category);
                  return (
                    <div
                      key={category}
                      className="group relative bg-card/50 backdrop-blur-sm rounded-lg p-2 md:p-3 border border-border/50 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200"
                    >
                      <div className="flex items-start gap-2 md:gap-3">
                        <div
                          className="w-8 h-8 md:w-10 md:h-10 rounded-lg flex-shrink-0 flex items-center justify-center shadow-md"
                          style={{
                            backgroundColor: color,
                            boxShadow: `0 4px 14px ${color}40`
                          }}
                        >
                          <Icon className="w-4 h-4 md:w-5 md:h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-1 mb-0.5 md:mb-1">
                            <span className="text-xs md:text-sm font-semibold text-foreground truncate">{category}</span>
                          </div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-base md:text-lg font-bold text-foreground currency-bhd">
                              {amount.toFixed(3)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 md:gap-1.5 mt-0.5 md:mt-1">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                            <span className="text-xs text-muted-foreground">
                              {count} txn{count !== 1 ? 's' : ''}
                            </span>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs font-medium text-muted-foreground">
                              {((amount / filteredTotals.total) * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-border/30 rounded-b-lg overflow-hidden">
                        <div
                          className="h-full transition-all duration-500"
                          style={{
                            backgroundColor: color,
                            width: `${(amount / filteredTotals.total) * 100}%`
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sort Control */}
      {filteredTransactions.length > 0 && (
        <div className="mb-4">
          <SortControl
            value={sortOption}
            onChange={setSortOption}
            isMobile={isMobile}
          />
        </div>
      )}

      {/* Transactions Table/Cards */}
      <div className={isMobile ? "" : "kpi-card overflow-hidden"}>
        {transactionsLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground mt-4">Loading transactions...</p>
          </div>
        ) : isMobile ? (
          /* Mobile Card View */
          <div className="space-y-3">
            {filteredTransactions.map((transaction) => (
              <TransactionCard
                key={transaction.SN}
                transaction={transaction}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          /* Desktop Table View */
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    ID
                  </th>
                  <th
                    className="text-left py-3 px-4 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort('txnAt')}
                  >
                    <div className="flex items-center gap-2">
                      Date & Time
                      {getSortIcon('txnAt')}
                    </div>
                  </th>
                  <th
                    className="text-left py-3 px-4 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort('merchant')}
                  >
                    <div className="flex items-center gap-2">
                      Merchant
                      {getSortIcon('merchant')}
                    </div>
                  </th>
                  <th
                    className="text-right py-3 px-4 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort('amount')}
                  >
                    <div className="flex items-center justify-end gap-2">
                      Amount
                      {getSortIcon('amount')}
                    </div>
                  </th>
                  <th
                    className="text-left py-3 px-4 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort('category')}
                  >
                    <div className="flex items-center gap-2">
                      Category
                      {getSortIcon('category')}
                    </div>
                  </th>
                  <th
                    className="text-left py-3 px-4 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort('tag')}
                  >
                    <div className="flex items-center gap-2">
                      Tag
                      {getSortIcon('tag')}
                    </div>
                  </th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((transaction) => {
                  const isEditing = editingId === transaction.id.toString();

                  return (
                    <tr
                      key={transaction.SN}
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-4 px-4">
                        <span className="text-sm text-muted-foreground font-mono">{transaction.id}</span>
                      </td>
                      <td className="py-4 px-4">
                        {isEditing ? (
                          <div className="space-y-1">
                            <Input
                              type="date"
                              value={editForm.date || transaction.date}
                              onChange={(e) => setEditForm({...editForm, date: e.target.value})}
                              className="w-36"
                            />
                            <Input
                              type="time"
                              value={editForm.time || transaction.time}
                              onChange={(e) => setEditForm({...editForm, time: e.target.value})}
                              className="w-36"
                            />
                          </div>
                        ) : (
                          <div>
                            <div className="font-medium text-foreground">
                              {new Date(transaction.date).toLocaleDateString()}
                            </div>
                            <div className="text-sm text-muted-foreground">{transaction.time}</div>
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        {isEditing ? (
                          <Input
                            value={editForm.merchant || transaction.merchant}
                            onChange={(e) => setEditForm({...editForm, merchant: e.target.value})}
                            className="w-full"
                          />
                        ) : (
                          <div>
                            <div className="font-medium text-foreground">{transaction.merchant}</div>
                            {transaction.cardEnding && (
                              <div className="text-sm text-muted-foreground">**** {transaction.cardEnding}</div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right">
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.001"
                            value={editForm.amount !== undefined ? editForm.amount : transaction.amount}
                            onChange={(e) => setEditForm({...editForm, amount: parseFloat(e.target.value)})}
                            className="w-32 ml-auto"
                          />
                        ) : (
                          <div className="font-semibold text-foreground currency-bhd">
                            {transaction.amount.toFixed(3)}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        {isEditing ? (
                          <div className="relative">
                            <select
                              value={editForm.category !== undefined ? editForm.category : transaction.category}
                              onChange={(e) => setEditForm({...editForm, category: e.target.value})}
                              className="px-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground w-full appearance-none cursor-pointer pr-8"
                            >
                              {categories.length === 0 && <option value="">Loading categories...</option>}
                              {categories.map(cat => (
                                <option key={cat.name} value={cat.name}>{cat.name}</option>
                              ))}
                            </select>
                            <svg
                              className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: getCategoryColor(transaction.category) }}
                            />
                            <span className="text-foreground">{transaction.category}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        {isEditing ? (
                          <Input
                            value={editForm.tag || transaction.tag || ''}
                            onChange={(e) => setEditForm({...editForm, tag: e.target.value})}
                            placeholder="Add tag..."
                            className="w-full"
                          />
                        ) : (
                          <span className="text-foreground text-sm">
                            {transaction.tag || '-'}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {isEditing ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSave(transaction.id.toString())}
                                disabled={updateMutation.isPending}
                              >
                                <Save className="w-4 h-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleCancel}
                              >
                                <XCircle className="w-4 h-4 text-red-600" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(transaction)}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedTransaction(transaction)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(transaction.id.toString())}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {filteredTransactions.length === 0 && !transactionsLoading && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No transactions found matching your criteria.</p>
          </div>
        )}
      </div>

      {/* Transaction Detail Modal */}
      {selectedTransaction && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedTransaction(null)}
        >
          <div
            className="bg-card rounded-xl p-6 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-foreground">Transaction Details</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTransaction(null)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Merchant</p>
                <p className="font-semibold text-foreground">{selectedTransaction.merchant}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium text-foreground">{selectedTransaction.date}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Time</p>
                  <p className="font-medium text-foreground">{selectedTransaction.time}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Amount</p>
                <p className="text-2xl font-bold text-foreground currency-bhd">
                  {selectedTransaction.amount.toFixed(3)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Category</p>
                  <p className="font-medium text-foreground">{selectedTransaction.category}</p>
                </div>
                {selectedTransaction.cardEnding && (
                  <div>
                    <p className="text-sm text-muted-foreground">Card</p>
                    <p className="font-medium text-foreground">**** {selectedTransaction.cardEnding}</p>
                  </div>
                )}
              </div>
              {selectedTransaction.tag && (
                <div>
                  <p className="text-sm text-muted-foreground">Tag</p>
                  <p className="font-medium text-foreground">{selectedTransaction.tag}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              Are you sure you want to delete this transaction? This action cannot be undone and the transaction will be permanently removed from your records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Transaction Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Transaction</DialogTitle>
            <DialogDescription>
              Enter the transaction details below. All fields marked with * are required.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={newTransactionForm.date}
                  onChange={(e) => setNewTransactionForm({ ...newTransactionForm, date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Time *</Label>
                <Input
                  id="time"
                  type="time"
                  value={newTransactionForm.time}
                  onChange={(e) => setNewTransactionForm({ ...newTransactionForm, time: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="merchant">Merchant *</Label>
              <Input
                id="merchant"
                placeholder="Enter merchant name"
                value={newTransactionForm.merchant}
                onChange={(e) => setNewTransactionForm({ ...newTransactionForm, merchant: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (BHD) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.001"
                placeholder="0.000"
                value={newTransactionForm.amount}
                onChange={(e) => setNewTransactionForm({ ...newTransactionForm, amount: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <div className="relative">
                <select
                  id="category"
                  value={newTransactionForm.category}
                  onChange={(e) => setNewTransactionForm({ ...newTransactionForm, category: e.target.value })}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground appearance-none cursor-pointer pr-8"
                  required
                >
                  <option value="">Select a category</option>
                  {categories.map(cat => (
                    <option key={cat.name} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
                <svg
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tag">Tag (Optional)</Label>
              <Input
                id="tag"
                placeholder="Add a tag"
                value={newTransactionForm.tag}
                onChange={(e) => setNewTransactionForm({ ...newTransactionForm, tag: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddTransaction}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Adding...' : 'Add Transaction'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobile Edit Sheet */}
      <TransactionEditSheet
        transaction={transactionToEdit}
        categories={categories}
        isOpen={editSheetOpen}
        onClose={handleEditSheetClose}
        onSave={handleEditSheetSave}
        isSaving={updateMutation.isPending}
      />
    </div>
  );
}
