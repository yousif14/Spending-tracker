import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Transaction, Category, Summary, Budget } from '@/types';
import { format, subMonths } from 'date-fns';

// Query keys
export const queryKeys = {
  transactions: (from: string, to: string) => ['transactions', from, to],
  categories: () => ['categories'],
  summary: (month: string) => ['summary', month],
  budget: (month: string) => ['budget', month],
};

// Transactions
export function useTransactions(from: string, to: string) {
  return useQuery({
    queryKey: queryKeys.transactions(from, to),
    queryFn: () => apiClient.getTransactions(from, to),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (transaction: Omit<Transaction, 'SN'>) => 
      apiClient.createTransaction(transaction),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ sn, transaction }: { sn: string; transaction: Partial<Transaction> }) => 
      apiClient.updateTransaction(sn, transaction),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
    },
  });
}

// Categories
export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories(),
    queryFn: () => apiClient.getCategories(),
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}

// Summary
export function useSummary(month: string) {
  return useQuery({
    queryKey: queryKeys.summary(month),
    queryFn: () => apiClient.getSummary(month),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// KPI Data Hook
export function useKPIData(month: string) {
  const currentMonth = format(new Date(month), 'yyyy-MM');
  const previousMonth = format(subMonths(new Date(month), 1), 'yyyy-MM');
  
  const { data: currentSummary, ...currentQuery } = useSummary(currentMonth);
  const { data: previousSummary } = useSummary(previousMonth);
  
  const kpiData = currentSummary ? 
    apiClient.generateKPIData(currentSummary, previousSummary) : 
    undefined;
    
  return {
    data: kpiData,
    ...currentQuery,
  };
}

// Budget
export function useCreateBudget() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (budget: Budget) => apiClient.createBudget(budget),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budget(variables.month) });
    },
  });
}

// SMS Ingestion
export function useIngestSms() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (text: string) => apiClient.ingestSms(text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
    },
  });
}