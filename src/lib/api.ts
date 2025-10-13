/**
 * @fileoverview API Client for n8n Backend Integration
 *
 * This module provides a type-safe API client for communicating with the n8n
 * backend via webhooks. It handles data transformation, error handling, and
 * provides fallback client-side calculations when backend endpoints are unavailable.
 *
 * Key Features:
 * - Transaction CRUD operations with date range filtering
 * - Category and budget management
 * - Transaction statistics with client-side fallback
 * - Smart data normalization for various n8n response formats
 * - Client-side sorting and filtering support
 *
 * @example
 * // Fetch transactions for current fiscal period
 * const period = getCurrentPeriodWindow();
 * const transactions = await apiClient.getTransactions(period.from, period.to);
 *
 * @example
 * // Get statistics with budget tracking
 * const stats = await apiClient.getTransactionStats('2025-09-23', '2025-10-22', 650);
 */

import { Transaction, Category, Summary, Budget, KPIData, TransactionStats } from '@/types';
import { combineDateTime } from '@/utils/period';
import { getCategoryColor } from '@/utils/categoryColors';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5678';
const WEBHOOK_BASE_URL = 'https://n8n.11homelab.cc/webhook';

/**
 * Query parameters for transaction filtering and sorting
 *
 * @interface TransactionQueryParams
 * @property {string} from - Start date (YYYY-MM-DD, inclusive)
 * @property {string} to - End date (YYYY-MM-DD, inclusive)
 * @property {string} [search] - Search query (supports tokens: cat-, mer-)
 * @property {'txnAt'|'amount'|'merchant'} [sort] - Sort field
 * @property {'asc'|'desc'} [order] - Sort order
 * @property {number} [limit] - Maximum number of results
 * @property {number} [offset] - Number of results to skip
 */
export interface TransactionQueryParams {
  from: string;
  to: string;
  search?: string;
  sort?: 'txnAt' | 'amount' | 'merchant';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * API Client for n8n webhook integration
 *
 * Handles all HTTP communication with the n8n backend, including:
 * - Request/response transformation
 * - Error handling with timeouts
 * - Data normalization from various n8n formats
 * - Client-side fallbacks for missing backend features
 *
 * @class ApiClient
 */
class ApiClient {
  // ========================================================================
  // PRIVATE UTILITY METHODS
  // ========================================================================

  /**
   * Convert date from DD/MM/YYYY to YYYY-MM-DD format
   *
   * @private
   * @param {string} dateStr - Date string in DD/MM/YYYY format
   * @returns {string} Date in YYYY-MM-DD format
   */
  private convertDateFormat(dateStr: string): string {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return dateStr;
  }

  /**
   * Core fetch method with authentication, timeout, and error handling
   *
   * Features:
   * - 10-second timeout to prevent hanging requests
   * - Automatic n8n response format normalization
   * - Transaction and category data transformation
   * - Detailed console logging for debugging
   *
   * @private
   * @param {string} endpoint - API endpoint path (e.g., '/api/transactions')
   * @param {RequestInit} [options] - Fetch options (method, headers, body)
   * @returns {Promise<any>} Normalized response data
   * @throws {Error} If request fails or times out
   */
  private async fetchWithAuth(endpoint: string, options?: RequestInit) {
    const url = `${WEBHOOK_BASE_URL}${endpoint}`;
    console.log('API Call:', options?.method || 'GET', url);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log('API Response:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('API Data:', data);

      // n8n returns data in various formats
      // Normalize and transform data format
      if ((options?.method === 'GET' || !options?.method)) {
        let normalizedData: any[] = [];

        // Handle different response formats
        if (Array.isArray(data)) {
          if (data.length === 1 && data[0].$json && Array.isArray(data[0].$json)) {
            // Format: [{"$json": [transactions]}]
            normalizedData = data[0].$json;
          } else {
            // Format: [transactions] or [{"single": "object"}]
            normalizedData = data;
          }
        } else if (data && data.$json && Array.isArray(data.$json)) {
          // Format: {"$json": [transactions]}
          normalizedData = data.$json;
        } else {
          // Single object
          normalizedData = [data];
        }

        if (endpoint.includes('/transactions')) {
          // Transform raw data table format to frontend format
          const transformed = normalizedData.map(item => {
            // Use SN from database as both the display SN and the ID for updates
            const sn = item.SN || item.sn || item.id?.toString() || '';
            return {
              SN: sn,
              id: parseInt(sn) || 0,
              date: item.date || item.Date ? this.convertDateFormat(item.date || item.Date) : '',
              time: item.time || item.Time || '',
              merchant: item.merchant || item.Merchant || '',
              amount: parseFloat(item.amount || item.Amount) || 0,
              currency: item.currency || item.Currency || 'BHD',
              category: item.category || item.Category || '',
              tag: item.tag || item.Tag || '',
              name: item.name || item.Name || '',
              cardEnding: item.card_ending || item.cardEnding || item.Card_ending || ''
            };
          });
          console.log('Transformed transactions:', transformed);
          return transformed;
        } else if (endpoint.includes('/categories')) {
          // Don't transform /categoriesHeads - let getCategories handle it
          if (endpoint.includes('/categoriesHeads')) {
            return data; // Return raw data for categoriesHeads
          }

          // Transform category data with consistent colors
          return normalizedData.map(item => ({
            name: item.name || item.Name,
            color: getCategoryColor(item.name || item.Name)
          }));
        }
      }

      // For POST and other requests, return as-is (usually single object)
      return data;
    } catch (error) {
      console.error('API Fetch Error:', error);
      throw error;
    }
  }

  // ========================================================================
  // TRANSACTION OPERATIONS
  // ========================================================================

  /**
   * Get transactions within a date range
   *
   * @param {string} [from] - Start date (YYYY-MM-DD, inclusive). If undefined, fetches all
   * @param {string} [to] - End date (YYYY-MM-DD, inclusive). If undefined, fetches all
   * @returns {Promise<Transaction[]>} Array of transactions
   *
   * @example
   * const transactions = await apiClient.getTransactions('2025-09-23', '2025-10-22');
   *
   * @example
   * // Fetch all transactions
   * const allTransactions = await apiClient.getTransactions();
   */
  async getTransactions(from?: string, to?: string): Promise<Transaction[]> {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);

    const queryString = params.toString();
    const url = queryString ? `/api/transactions?${queryString}` : '/api/transactions';
    return this.fetchWithAuth(url);
  }

  /**
   * Get transactions with advanced filtering and sorting
   *
   * Supports search tokens (cat-, mer-), sorting, and pagination.
   * Falls back to client-side sorting for txnAt field.
   *
   * @param {TransactionQueryParams} params - Query parameters
   * @returns {Promise<Transaction[]>} Filtered and sorted transactions
   *
   * @example
   * const params = {
   *   from: '2025-09-23',
   *   to: '2025-10-22',
   *   search: 'cat-food mer-talabat',
   *   sort: 'txnAt',
   *   order: 'desc'
   * };
   * const transactions = await apiClient.getTransactionsWithFilters(params);
   */
  async getTransactionsWithFilters(params: TransactionQueryParams): Promise<Transaction[]> {
    const queryParams = new URLSearchParams({
      from: params.from,
      to: params.to,
    });

    if (params.search) queryParams.append('search', params.search);
    if (params.sort) queryParams.append('sort', params.sort);
    if (params.order) queryParams.append('order', params.order);
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.offset) queryParams.append('offset', params.offset.toString());

    const transactions = await this.fetchWithAuth(`/api/transactions?${queryParams.toString()}`);

    // Client-side sorting by txnAt (date + time) if not handled by backend
    if (params.sort === 'txnAt') {
      return this.sortTransactionsByDateTime(transactions, params.order || 'desc');
    }

    return transactions;
  }

  async getTransactionsByMonth(month: number, year?: number): Promise<Transaction[]> {
    const queryParams = new URLSearchParams({
      month: month.toString(),
    });

    if (year) queryParams.append('year', year.toString());

    return this.fetchWithAuth(`/api/transactions/month/${month}?${queryParams.toString()}`);
  }

  /**
   * Get transaction statistics for a period
   * @param from - Start date (YYYY-MM-DD)
   * @param to - End date (YYYY-MM-DD)
   * @param budget - Optional budget amount (default: 750)
   */
  async getTransactionStats(from: string, to: string, budget: number = 750): Promise<TransactionStats> {
    try {
      const queryParams = new URLSearchParams({
        from,
        to,
        budget: budget.toString(),
      });

      const response = await this.fetchWithAuth(`/api/transactions/stats?${queryParams.toString()}`);

      // If backend returns stats, use them
      if (response && typeof response.total === 'number') {
        return response;
      }

      // Otherwise, calculate client-side as fallback
      return this.calculateStatsClientSide(from, to, budget);
    } catch (error) {
      console.warn('Stats endpoint not available, calculating client-side:', error);
      return this.calculateStatsClientSide(from, to, budget);
    }
  }

  /**
   * Client-side stats calculation (fallback when backend endpoint not available)
   */
  private async calculateStatsClientSide(from: string, to: string, budget: number): Promise<TransactionStats> {
    // Fetch transactions for the period
    const transactions = await this.getTransactions(from, to);

    // Calculate total
    const total = transactions.reduce((sum, t) => sum + t.amount, 0);

    // Calculate days in window (from → to inclusive)
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const daysInWindow = 1 + Math.floor((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));

    // Get current date in Asia/Bahrain timezone
    const nowInBahrain = new Date().toLocaleString('en-US', { timeZone: 'Asia/Bahrain' });
    const today = new Date(nowInBahrain);

    // Normalize today to start of day for comparison
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // Calculate days elapsed: min(today, to) - from + 1
    const effectiveEndDate = todayDateOnly < toDate ? todayDateOnly : toDate;
    const daysElapsed = Math.max(1,
      1 + Math.floor((effectiveEndDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    // Calculate averages
    const avgDailyToDate = total / Math.max(1, daysElapsed);
    const avgDailyFull = total / daysInWindow;

    // Calculate budget remaining
    const budgetRemaining = budget - total;

    return {
      total,
      daysElapsed,
      daysInWindow,
      avgDailyToDate,
      avgDailyFull,
      budget,
      budgetRemaining,
    };
  }

  /**
   * Sort transactions by combined datetime (Date + Time)
   * Uses client-side sorting to ensure newest-first ordering
   */
  private sortTransactionsByDateTime(
    transactions: Transaction[],
    order: 'asc' | 'desc' = 'desc'
  ): Transaction[] {
    return [...transactions].sort((a, b) => {
      const aDateTime = combineDateTime(a.date, a.time);
      const bDateTime = combineDateTime(b.date, b.time);

      const comparison = aDateTime.localeCompare(bDateTime);
      return order === 'desc' ? -comparison : comparison;
    });
  }

  async createTransaction(transaction: Omit<Transaction, 'SN'>): Promise<Transaction> {
    return this.fetchWithAuth('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(transaction),
    });
  }

/*async updateTransaction(sn: string, transaction: Partial<Transaction>): Promise<Transaction> {
  return this.fetchWithAuth(`/update-transaction/api/update-transactions/${sn}`, {
    method: 'PUT',
    body: JSON.stringify(transaction),
  });
}*/

async updateTransaction(sn: string | number, transaction: Partial<Transaction>): Promise<Transaction> {
  // map & sanitize to what n8n expects
  const payload: Record<string, any> = {};
  if (transaction.date) payload.date = transaction.date;            // "YYYY-MM-DD"
  if (transaction.time) payload.time = String(transaction.time).slice(0,5); // "HH:MM"
  if (transaction.merchant) payload.merchant = transaction.merchant;
  if (transaction.amount !== undefined && transaction.amount !== null) {
    payload.amount = typeof transaction.amount === 'string'
      ? Number(transaction.amount)
      : transaction.amount;
  }
  if (transaction.currency) payload.currency = transaction.currency;
  if (transaction.category) payload.category = transaction.category;
  if (transaction.tag !== undefined) payload.tag = transaction.tag;
  if (transaction.name) payload.name = transaction.name;
  if (transaction.cardEnding) payload.cardEnding = transaction.cardEnding;

  return this.fetchWithAuth(`/update-transaction/api/update-transactions/${sn}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

async deleteTransaction(sn: string | number): Promise<{ success: boolean; message: string }> {
  const snNumber = typeof sn === 'string' ? parseInt(sn, 10) : sn;
  return this.fetchWithAuth(`/delete-transaction/api/delete-transactions/${snNumber}`, {
    method: 'DELETE',
    body: JSON.stringify({ sn: snNumber }),
  });
}

async createManualTransaction(transaction: { date: string; time: string; merchant: string; amount: number; category: string; tag?: string }): Promise<Transaction> {
  return this.fetchWithAuth('/manualAddTransaction', {
    method: 'POST',
    body: JSON.stringify(transaction),
  });
}




  // Categories
  async getCategories(): Promise<Category[]> {
    const response = await this.fetchWithAuth('/api/categoriesHeads');

    console.log('Raw categories response:', response);

    // Handle the specific response format: [{ categories: [...], count: ... }]
    if (Array.isArray(response) && response.length > 0 && response[0]?.categories) {
      const categoryNames = response[0].categories;
      return categoryNames.map((name: string) => ({
        name: name || 'Unknown',
        color: getCategoryColor(name || 'Unknown')
      }));
    }

    // Handle if response is directly { categories: [...], count: ... }
    if (response && response.categories && Array.isArray(response.categories)) {
      const categoryNames = response.categories;
      return categoryNames.map((name: string) => ({
        name: name || 'Unknown',
        color: getCategoryColor(name || 'Unknown')
      }));
    }

    // Fallback to original format
    return response;
  }

  // Summary
  async getSummary(month: string): Promise<Summary> {
    return this.fetchWithAuth(`/api/summary?month=${month}`);
  }

  // Budget
  async createBudget(budget: Budget): Promise<Budget> {
    return this.fetchWithAuth('/api/budget', {
      method: 'POST',
      body: JSON.stringify(budget),
    });
  }

  // SMS Ingestion
  async ingestSms(text: string): Promise<{ success: boolean; transaction?: Transaction }> {
    return this.fetchWithAuth('/api/ingest-sms', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  // Generate KPI data from summary
  generateKPIData(summary: Summary, previousSummary?: Summary): KPIData {
    const totalThisMonth = summary.total;
    const totalLastMonth = previousSummary?.total || 0;
    const vsLastMonth = totalLastMonth > 0 ? ((totalThisMonth - totalLastMonth) / totalLastMonth) * 100 : 0;
    
    // Count transactions from daily series
    const transactionCount = summary.dailySeries.reduce((count, day) => {
      return day.amount > 0 ? count + 1 : count;
    }, 0);
    
    // Calculate average daily spend
    const daysWithSpending = summary.dailySeries.filter(day => day.amount > 0).length;
    const avgDaily = daysWithSpending > 0 ? totalThisMonth / daysWithSpending : 0;

    return {
      totalThisMonth,
      vsLastMonth,
      transactionCount,
      avgDaily,
    };
  }
}

export const apiClient = new ApiClient();