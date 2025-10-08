/**
 * @fileoverview Core TypeScript Interfaces for Finance Tracker
 *
 * Defines all data structures used throughout the application including:
 * - Transactions and categories
 * - Financial summaries and statistics
 * - Budget tracking
 * - KPI (Key Performance Indicator) data
 */

// ============================================================================
// TRANSACTION TYPES
// ============================================================================

/**
 * Represents a single financial transaction
 *
 * @interface Transaction
 * @property {string} SN - Serial number (unique identifier for display)
 * @property {number} id - Database primary key (used for updates)
 * @property {string} date - Transaction date in YYYY-MM-DD format
 * @property {string} time - Transaction time in HH:MM:SS format (can be empty)
 * @property {string} merchant - Merchant or vendor name
 * @property {number} amount - Transaction amount in BHD
 * @property {string} currency - Currency code (typically 'BHD')
 * @property {string} category - Category name (e.g., 'Food', 'Transport')
 * @property {string} [tag] - Optional custom tag
 * @property {string} [name] - Optional transaction name
 * @property {string} [cardEnding] - Last 4 digits of card used
 */
export interface Transaction {
  SN: string;
  id: number;
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

/**
 * Represents a spending category with display color
 *
 * @interface Category
 * @property {string} name - Category name
 * @property {string} color - Hex color code for UI display
 */
export interface Category {
  name: string;
  color: string;
}

// ============================================================================
// SUMMARY AND ANALYTICS TYPES
// ============================================================================

/**
 * Summary data for a given period (month/custom range)
 *
 * @interface Summary
 * @property {Array} totalsByCategory - Spending totals grouped by category
 * @property {number} total - Grand total of all spending
 * @property {Array} topMerchants - Top merchants by spending amount
 * @property {Array} dailySeries - Daily spending data for charts
 */
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

/**
 * Budget configuration for a month
 *
 * @interface Budget
 * @property {string} month - Month identifier (YYYY-MM)
 * @property {Array} targets - Budget targets by category
 */
export interface Budget {
  month: string;
  targets: Array<{
    category: string;
    amount: number;
  }>;
}

/**
 * Key Performance Indicators for dashboard display
 *
 * @interface KPIData
 * @property {number} totalThisMonth - Total spending this period
 * @property {number} vsLastMonth - Percentage change vs previous period
 * @property {number} transactionCount - Number of transactions
 * @property {number} avgDaily - Average daily spending (to-date)
 */
export interface KPIData {
  totalThisMonth: number;
  vsLastMonth: number;
  transactionCount: number;
  avgDaily: number;
}

/**
 * Detailed transaction statistics for a period
 *
 * Includes both actual spending and budget tracking metrics.
 * Used by the stats endpoint and dashboard KPI cards.
 *
 * @interface TransactionStats
 * @property {number} total - Total spending in the period
 * @property {number} daysElapsed - Days from period start to today (or end)
 * @property {number} daysInWindow - Total days in the period
 * @property {number} avgDailyToDate - Average daily spending so far (total / daysElapsed)
 * @property {number} avgDailyFull - Projected average over full period (total / daysInWindow)
 * @property {number} budget - Budget amount for the period
 * @property {number} budgetRemaining - Remaining budget (budget - total, can be negative)
 *
 * @example
 * {
 *   total: 542.850,
 *   daysElapsed: 13,
 *   daysInWindow: 30,
 *   avgDailyToDate: 41.76,
 *   avgDailyFull: 18.09,
 *   budget: 650.000,
 *   budgetRemaining: 107.15
 * }
 */
export interface TransactionStats {
  total: number;
  daysElapsed: number;
  daysInWindow: number;
  avgDailyToDate: number;
  avgDailyFull: number;
  budget: number;
  budgetRemaining: number;
}