import { Transaction, Category, Summary, KPIData } from '@/types';

// Mock categories with Bahrain-relevant spending
export const mockCategories: Category[] = [
  { name: 'Groceries', color: '#10B981' },
  { name: 'Restaurants', color: '#F59E0B' },
  { name: 'Transportation', color: '#3B82F6' },
  { name: 'Shopping', color: '#8B5CF6' },
  { name: 'Entertainment', color: '#EF4444' },
  { name: 'Health', color: '#06B6D4' },
  { name: 'Education', color: '#84CC16' },
  { name: 'Utilities', color: '#F97316' },
];

// Mock transactions with Bahrain merchants and BHD currency
export const mockTransactions: Transaction[] = [
  {
    SN: '1001',
    date: '2024-01-20',
    time: '14:30:00',
    merchant: 'Lulu Hypermarket',
    amount: 25.500,
    currency: 'BHD',
    category: 'Groceries',
    cardEnding: '1234'
  },
  {
    SN: '1002', 
    date: '2024-01-20',
    time: '19:45:00',
    merchant: 'Shawarma Palace',
    amount: 4.200,
    currency: 'BHD',
    category: 'Restaurants',
    cardEnding: '1234'
  },
  {
    SN: '1003',
    date: '2024-01-19',
    time: '08:15:00',
    merchant: 'Bahrain Petroleum',
    amount: 18.750,
    currency: 'BHD',
    category: 'Transportation',
    cardEnding: '5678'
  },
  {
    SN: '1004',
    date: '2024-01-19',
    time: '16:20:00',
    merchant: 'City Centre Bahrain',
    amount: 89.900,
    currency: 'BHD',
    category: 'Shopping',
    cardEnding: '1234'
  },
  {
    SN: '1005',
    date: '2024-01-18',
    time: '20:30:00',
    merchant: 'VOX Cinemas',
    amount: 12.000,
    currency: 'BHD',
    category: 'Entertainment',
    cardEnding: '5678'
  },
  {
    SN: '1006',
    date: '2024-01-18',
    time: '11:00:00',
    merchant: 'American Mission Hospital',
    amount: 35.000,
    currency: 'BHD',
    category: 'Health',
    cardEnding: '1234'
  },
];

// Mock KPI data
export const mockKPIData: KPIData = {
  totalThisMonth: 185.350,
  vsLastMonth: 12.5,
  transactionCount: 6,
  avgDaily: 9.268
};

// Mock summary data
export const mockSummary: Summary = {
  totalsByCategory: [
    { category: 'Shopping', amount: 89.900, color: '#8B5CF6' },
    { category: 'Health', amount: 35.000, color: '#06B6D4' },
    { category: 'Groceries', amount: 25.500, color: '#10B981' },
    { category: 'Transportation', amount: 18.750, color: '#3B82F6' },
    { category: 'Entertainment', amount: 12.000, color: '#EF4444' },
    { category: 'Restaurants', amount: 4.200, color: '#F59E0B' },
  ],
  total: 185.350,
  topMerchants: [
    { merchant: 'City Centre Bahrain', amount: 89.900, transactions: 1 },
    { merchant: 'American Mission Hospital', amount: 35.000, transactions: 1 },
    { merchant: 'Lulu Hypermarket', amount: 25.500, transactions: 1 },
  ],
  dailySeries: [
    { date: '2024-01-15', amount: 0 },
    { date: '2024-01-16', amount: 0 },
    { date: '2024-01-17', amount: 0 },
    { date: '2024-01-18', amount: 47.000 },
    { date: '2024-01-19', amount: 108.650 },
    { date: '2024-01-20', amount: 29.700 },
  ]  
};

// Utility function to format BHD currency
export const formatBHD = (amount: number): string => {
  return `BD ${amount.toFixed(3)}`;
};