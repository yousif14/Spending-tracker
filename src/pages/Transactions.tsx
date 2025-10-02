import { useState } from 'react';
import { Search, Filter, Calendar, Eye } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api';
import { formatBHD } from '@/lib/mockData';
import { Transaction } from '@/types';

export default function Transactions() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  // Fetch all transactions in the database (wide date range)
  const allTransactionsStart = '2020-01-01';
  const allTransactionsEnd = '2030-12-31';

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions', allTransactionsStart, allTransactionsEnd],
    queryFn: () => apiClient.getTransactions(allTransactionsStart, allTransactionsEnd),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiClient.getCategories(),
  });

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = transaction.merchant.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          transaction.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || transaction.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Transactions</h1>
          <p className="text-muted-foreground">View and manage your spending history</p>
        </div>
      </div>

      {/* Filters */}
      <div className="kpi-card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category.name} value={category.name}>{category.name}</option>
              ))}
            </select>
            
            <Button variant="outline" size="sm">
              <Calendar className="w-4 h-4 mr-2" />
              Date Range  
            </Button>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="kpi-card overflow-hidden">
        <div className="overflow-x-auto">
          {transactionsLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground mt-4">Loading transactions...</p>
            </div>
          ) : (
            <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Merchant</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Category</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Amount</th>
                <th className="text-center py-3 px-4 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((transaction) => (
                <tr 
                  key={transaction.SN} 
                  className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                >
                  <td className="py-4 px-4">
                    <div>
                      <div className="font-medium text-foreground">
                        {new Date(transaction.date).toLocaleDateString()}
                      </div>
                      <div className="text-sm text-muted-foreground">{transaction.time}</div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="font-medium text-foreground">{transaction.merchant}</div>
                    {transaction.cardEnding && (
                      <div className="text-sm text-muted-foreground">**** {transaction.cardEnding}</div>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: categories.find(c => c.name === transaction.category)?.color }}
                      />
                      <span className="text-foreground">{transaction.category}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="font-semibold text-foreground currency-bhd">
                      {transaction.amount.toFixed(3)}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedTransaction(transaction)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>

        {filteredTransactions.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No transactions found matching your criteria.</p>
          </div>
        )}
      </div>

      {/* Transaction Detail Panel */}
      {selectedTransaction && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedTransaction(null)}
        >
          <div 
            className="kpi-card max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">Transaction Details</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Merchant</p>
                <p className="font-medium">{selectedTransaction.merchant}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Amount</p>
                <p className="text-xl font-bold currency-bhd">{selectedTransaction.amount.toFixed(3)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Date & Time</p>
                <p className="font-medium">{new Date(selectedTransaction.date).toLocaleDateString()} at {selectedTransaction.time}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Category</p>
                <p className="font-medium">{selectedTransaction.category}</p>
              </div>
            </div>
            <Button 
              onClick={() => setSelectedTransaction(null)}
              className="w-full mt-6"
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}