// API client for n8n backend integration
import { Transaction, Category, Summary, Budget, KPIData } from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5678';
const WEBHOOK_BASE_URL = 'https://n8n.11homelab.cc/webhook';

class ApiClient {
  private convertDateFormat(dateStr: string): string {
    // Convert DD/MM/YYYY to YYYY-MM-DD
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return dateStr;
  }

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
          const transformed = normalizedData.map(item => ({
            SN: item.id || item.SN,
            date: item.date || item.Date ? this.convertDateFormat(item.date || item.Date) : '',
            time: item.time || item.Time || '',
            merchant: item.merchant || item.Merchant || '',
            amount: parseFloat(item.amount || item.Amount) || 0,
            currency: item.currency || item.Currency || 'BHD',
            category: item.category || item.Category || '',
            tag: item.tag || item.Tag || '',
            name: item.name || item.Name || '',
            cardEnding: item.card_ending || item.cardEnding || item.Card_ending || ''
          }));
          console.log('Transformed transactions:', transformed);
          return transformed;
        } else if (endpoint.includes('/categories')) {
          // Transform category data
          return normalizedData.map(item => ({
            name: item.name || item.Name,
            color: item.color || item.Color
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

  // Transactions
  async getTransactions(from: string, to: string): Promise<Transaction[]> {
    return this.fetchWithAuth(`/api/transactions?from=${from}&to=${to}`);
  }

  async createTransaction(transaction: Omit<Transaction, 'SN'>): Promise<Transaction> {
    return this.fetchWithAuth('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(transaction),
    });
  }

  async updateTransaction(sn: string, transaction: Partial<Transaction>): Promise<Transaction> {
    return this.fetchWithAuth(`/api/transactions/${sn}`, {
      method: 'PUT',
      body: JSON.stringify(transaction),
    });
  }

  // Categories
  async getCategories(): Promise<Category[]> {
    return this.fetchWithAuth('/api/categories');
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