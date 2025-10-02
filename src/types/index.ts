// Core types for Spending Tracker
export interface Transaction {
  SN: string;
  date: string;
  time: string;
  merchant: string;
  amount: number;
  currency: string;
  category: string;
  tag?: string;
  name?: string;
  cardEnding?: string;
}

export interface Category {
  name: string;
  color: string;
}

export interface Summary {
  totalsByCategory: Array<{
    category: string;
    amount: number;
    color: string;
  }>;
  total: number;
  topMerchants: Array<{
    merchant: string;
    amount: number;
    transactions: number;
  }>;
  dailySeries: Array<{
    date: string;
    amount: number;
  }>;
}

export interface Budget {
  month: string;
  targets: Array<{
    category: string;
    amount: number;
  }>;
}

export interface KPIData {
  totalThisMonth: number;
  vsLastMonth: number;
  transactionCount: number;
  avgDaily: number;
}