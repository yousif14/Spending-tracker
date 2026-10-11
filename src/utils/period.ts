/**
 * @fileoverview Period utilities for fiscal month windows (23rd to 22nd)
 *
 * This module provides utilities for working with fiscal periods that run from
 * the 23rd of one month to the 22nd of the next month, rather than standard
 * calendar months. It also includes transaction filtering and search utilities.
 *
 * @example
 * // Get October fiscal period (Sep 23 - Oct 22)
 * const period = getPeriodWindow(2025, 10);
 * // Returns: { from: '2025-09-23', to: '2025-10-22', year: 2025, month: 10 }
 *
 * // Get current fiscal period
 * const current = getCurrentPeriodWindow();
 *
 * // Search transactions with tokens
 * const tokens = parseSearchQuery('cat-food mer-talabat');
 * const filtered = filterTransactions(transactions, tokens);
 */

/**
 * Represents a fiscal period window with start/end dates
 *
 * @interface PeriodWindow
 * @property {string} from - Start date in YYYY-MM-DD format (inclusive)
 * @property {string} to - End date in YYYY-MM-DD format (inclusive)
 * @property {number} year - Fiscal year
 * @property {number} month - Fiscal month (1-12)
 */
export interface PeriodWindow {
  from: string;
  to: string;
  year: number;
  month: number;
}

/**
 * Represents a date range configuration
 *
 * @interface DateRangeConfig
 * @property {'fiscal' | 'custom' | 'all' | 'last3months'} mode - Range selection mode
 * @property {number} [month] - Fiscal month (1-12) for fiscal mode
 * @property {number} [year] - Fiscal year for fiscal mode
 * @property {string} [from] - Custom start date (YYYY-MM-DD) for custom mode
 * @property {string} [to] - Custom end date (YYYY-MM-DD) for custom mode
 */
export interface DateRangeConfig {
  mode: 'fiscal' | 'custom' | 'all' | 'last3months';
  month?: number;
  year?: number;
  from?: string;
  to?: string;
}

/**
 * Represents a resolved date range
 *
 * @interface DateRange
 * @property {string} [from] - Start date (YYYY-MM-DD), undefined for 'all' mode
 * @property {string} [to] - End date (YYYY-MM-DD), undefined for 'all' mode
 */
export interface DateRange {
  from?: string;
  to?: string;
}

/**
 * Get the fiscal period window for a given year and month
 *
 * Fiscal months run from the anchor day (default: 23rd) of the previous calendar
 * month to the day before the anchor day of the current calendar month.
 *
 * @param {number} year - The fiscal year
 * @param {number} month1to12 - Month number (1-12). For example, month 9 returns Aug 23 - Sep 22
 * @param {number} [anchorDay=23] - The day that starts each fiscal month
 * @returns {PeriodWindow} Period window with from/to dates
 * @throws {Error} If month is not between 1-12 or anchorDay is not between 1-31
 *
 * @example
 * // Get September fiscal period (Aug 23 - Sep 22)
 * getPeriodWindow(2025, 9);
 * // Returns: { from: '2025-08-23', to: '2025-09-22', year: 2025, month: 9 }
 *
 * @example
 * // Get January fiscal period (Dec 23 - Jan 22) - handles year rollover
 * getPeriodWindow(2025, 1);
 * // Returns: { from: '2024-12-23', to: '2025-01-22', year: 2025, month: 1 }
 */
export function getPeriodWindow(
  year: number,
  month1to12: number,
  anchorDay: number = 23
): PeriodWindow {
  if (month1to12 < 1 || month1to12 > 12) {
    throw new Error('Month must be between 1 and 12');
  }
  if (anchorDay < 1 || anchorDay > 31) {
    throw new Error('Anchor day must be between 1 and 31');
  }

  // Fiscal month runs from anchorDay of previous calendar month
  // to (anchorDay - 1) of the current calendar month
  // e.g., month 9 = Aug 23 to Sep 22

  const startMonth = month1to12 - 1; // Previous calendar month
  const endMonth = month1to12;

  // Handle year rollover for January
  const startYear = startMonth === 0 ? year - 1 : year;
  const adjustedStartMonth = startMonth === 0 ? 12 : startMonth;

  // Format: YYYY-MM-DD
  const from = formatDate(startYear, adjustedStartMonth, anchorDay);
  const to = formatDate(year, endMonth, anchorDay - 1);

  return {
    from,
    to,
    year,
    month: month1to12,
  };
}

/**
 * Get the current fiscal period window based on today's date
 *
 * Determines which fiscal period today falls into based on the anchor day.
 * - If today is before the anchor day, we're in the previous fiscal month
 * - If today is on or after the anchor day, we're in the current fiscal month
 *
 * @param {number} [anchorDay=23] - The day that starts the fiscal month
 * @returns {PeriodWindow} Current period window
 *
 * @example
 * // If today is October 5, 2025
 * getCurrentPeriodWindow();
 * // Returns: { from: '2025-09-23', to: '2025-10-22', year: 2025, month: 10 }
 *
 * @example
 * // If today is October 25, 2025 (after anchor day)
 * getCurrentPeriodWindow();
 * // Returns: { from: '2025-10-23', to: '2025-11-22', year: 2025, month: 11 }
 */
export function getCurrentPeriodWindow(anchorDay: number = 23): PeriodWindow {
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentYear = now.getFullYear();

  // If current day is before anchor day, we're still in the previous fiscal month
  // Example: Oct 5 (day < 23) means we're in September fiscal period (Sep 23 - Oct 22)
  if (currentDay < anchorDay) {
    // Use current calendar month as fiscal month (the period that ENDS in this month)
    const fiscalMonth = currentMonth;
    const fiscalYear = currentYear;
    return getPeriodWindow(fiscalYear, fiscalMonth, anchorDay);
  } else {
    // Current day >= anchor day, we're in the next fiscal month
    // Example: Oct 25 (day >= 23) means we're in October fiscal period (Oct 23 - Nov 22)
    const fiscalMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const fiscalYear = currentMonth === 12 ? currentYear + 1 : currentYear;
    return getPeriodWindow(fiscalYear, fiscalMonth, anchorDay);
  }
}

/**
 * Combine a date string with optional time string into sortable datetime
 *
 * Creates a standardized datetime string that can be used for sorting.
 * Missing or empty times default to '00:00:00' to ensure consistent ordering.
 *
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} [time] - Optional time in HH:MM or HH:MM:SS format
 * @returns {string} Combined datetime string in 'YYYY-MM-DD HH:MM:SS' format
 *
 * @example
 * combineDateTime('2025-10-05', '14:30');
 * // Returns: '2025-10-05 14:30:00'
 *
 * @example
 * combineDateTime('2025-10-05', '14:30:45');
 * // Returns: '2025-10-05 14:30:45'
 *
 * @example
 * // Missing time defaults to midnight
 * combineDateTime('2025-10-05');
 * // Returns: '2025-10-05 00:00:00'
 */
export function combineDateTime(date: string, time?: string): string {
  if (!time || time.trim() === '') {
    return `${date} 00:00:00`;
  }

  // Ensure time has seconds
  const timeParts = time.split(':');
  if (timeParts.length === 2) {
    return `${date} ${time}:00`;
  }

  return `${date} ${time}`;
}

/**
 * Get fiscal window dates for current period
 *
 * Returns the from/to dates for the current fiscal period based on the anchor day.
 * This is a convenience wrapper around getCurrentPeriodWindow.
 *
 * @param {number} [anchorDay=23] - The day that starts the fiscal month (default: 23 for Asia/Bahrain)
 * @returns {{ from: string; to: string }} Object with from and to dates
 *
 * @example
 * // Get current fiscal window (23rd to 22nd)
 * const { from, to } = getFiscalWindow(23);
 * // Returns: { from: '2025-09-23', to: '2025-10-22' } (if today is Oct 5, 2025)
 */
export function getFiscalWindow(anchorDay: number = 23): { from: string; to: string } {
  const window = getCurrentPeriodWindow(anchorDay);
  return { from: window.from, to: window.to };
}

/**
 * Build a date range based on mode and configuration
 *
 * This is the main utility for resolving date ranges across different modes:
 * - 'fiscal': Uses fiscal month/year to calculate 23rd→22nd window
 * - 'custom': Uses provided from/to dates directly
 * - 'all': Returns undefined range (fetch all data)
 * - 'last3months': Returns the last 3 complete fiscal months
 *
 * @param {DateRangeConfig} config - Date range configuration
 * @param {number} [anchorDay=23] - The day that starts the fiscal month
 * @returns {DateRange} Resolved date range with from/to or undefined for 'all' mode
 * @throws {Error} If fiscal mode is missing month/year or custom mode is missing from/to
 *
 * @example
 * // Get current fiscal month
 * buildRange({ mode: 'fiscal', month: 10, year: 2025 });
 * // Returns: { from: '2025-09-23', to: '2025-10-22' }
 *
 * @example
 * // Get custom range
 * buildRange({ mode: 'custom', from: '2025-01-01', to: '2025-12-31' });
 * // Returns: { from: '2025-01-01', to: '2025-12-31' }
 *
 * @example
 * // Get all time
 * buildRange({ mode: 'all' });
 * // Returns: { from: undefined, to: undefined }
 *
 * @example
 * // Get last 3 months
 * buildRange({ mode: 'last3months' });
 * // Returns: { from: '2025-07-23', to: '2025-10-22' } (if current is Oct 2025)
 */
export function buildRange(config: DateRangeConfig, anchorDay: number = 23): DateRange {
  switch (config.mode) {
    case 'fiscal':
      if (config.month === undefined || config.year === undefined) {
        throw new Error('Fiscal mode requires month and year');
      }
      const window = getPeriodWindow(config.year, config.month, anchorDay);
      return { from: window.from, to: window.to };

    case 'custom':
      if (!config.from || !config.to) {
        throw new Error('Custom mode requires from and to dates');
      }
      return { from: config.from, to: config.to };

    case 'all':
      return { from: undefined, to: undefined };

    case 'last3months':
      // Get current period and go back 3 months for the start
      const current = getCurrentPeriodWindow(anchorDay);
      let startMonth = current.month - 2; // 3 months including current
      let startYear = current.year;

      // Handle year rollover
      if (startMonth <= 0) {
        startMonth += 12;
        startYear -= 1;
      }

      const startWindow = getPeriodWindow(startYear, startMonth, anchorDay);
      return { from: startWindow.from, to: current.to };

    default:
      throw new Error(`Unknown mode: ${config.mode}`);
  }
}

/**
 * Format date components as YYYY-MM-DD string
 *
 * Handles day overflow automatically (e.g., Feb 30 becomes Mar 2).
 * This is a helper function used internally by getPeriodWindow.
 *
 * @param {number} year - Year component
 * @param {number} month - Month component (1-12)
 * @param {number} day - Day component (1-31)
 * @returns {string} Formatted date string in YYYY-MM-DD format
 * @private
 */
function formatDate(year: number, month: number, day: number): string {
  // Handle day overflow (e.g., Feb 30 -> Mar 2)
  const date = new Date(year, month - 1, day);

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');

  return `${y}-${m}-${d}`;
}

// ============================================================================
// SEARCH AND FILTERING UTILITIES
// ============================================================================

/**
 * Represents parsed search tokens from a search query
 *
 * @interface SearchTokens
 * @property {string[]} category - Category filter tokens (from 'cat-' prefix)
 * @property {string[]} merchant - Merchant filter tokens (from 'mer-' prefix)
 * @property {string[]} general - General search terms (no prefix)
 */
export interface SearchTokens {
  category: string[];
  merchant: string[];
  general: string[];
}

/**
 * Parse search query into structured tokens
 *
 * Supports specialized prefixes and general search terms:
 * - 'cat-value' → category filter
 * - 'mer-value' → merchant filter
 * - 'value' → general search (searches all fields)
 *
 * All filters use AND semantics (all must match).
 *
 * @param {string} search - Search query string
 * @returns {SearchTokens} Parsed search tokens
 *
 * @example
 * parseSearchQuery('cat-food mer-talabat');
 * // Returns: { category: ['food'], merchant: ['talabat'], general: [] }
 *
 * @example
 * parseSearchQuery('cat-groceries vegetable');
 * // Returns: { category: ['groceries'], merchant: [], general: ['vegetable'] }
 *
 * @example
 * parseSearchQuery('cat-food mer-talabat rice');
 * // Matches: category contains 'food' AND merchant contains 'talabat' AND (any field) contains 'rice'
 */

export function parseSearchQuery(search: string): SearchTokens {
  const tokens: SearchTokens = {
    category: [],
    merchant: [],
    general: [],
  };

  if (!search || search.trim() === '') {
    return tokens;
  }

  // Split by whitespace
  const parts = search.trim().split(/\s+/);

  for (const part of parts) {
    const lower = part.toLowerCase();

    if (lower.startsWith('cat-')) {
      // Category token
      const value = part.substring(4); // Remove 'cat-'
      if (value) {
        tokens.category.push(value);
      }
    } else if (lower.startsWith('mer-')) {
      // Merchant token
      const value = part.substring(4); // Remove 'mer-'
      if (value) {
        tokens.merchant.push(value);
      }
    } else {
      // General search term
      tokens.general.push(part);
    }
  }

  return tokens;
}

/**
 * Filter transactions based on search tokens (client-side)
 *
 * Implements AND semantics: all search terms must match for a transaction to pass.
 * - Category tokens must all match the category field (substring, case-insensitive)
 * - Merchant tokens must all match the merchant field (substring, case-insensitive)
 * - General terms can match category OR merchant OR tag (substring, case-insensitive)
 *
 * @template T - Transaction type with category, merchant, and tag fields
 * @param {T[]} transactions - Array of transactions to filter
 * @param {SearchTokens} tokens - Parsed search tokens from parseSearchQuery
 * @returns {T[]} Filtered transactions array
 *
 * @example
 * const tokens = parseSearchQuery('cat-food mer-talabat');
 * const filtered = filterTransactions(transactions, tokens);
 * // Returns only transactions where category contains 'food' AND merchant contains 'talabat'
 *
 * @example
 * const tokens = parseSearchQuery('vegetable');
 * const filtered = filterTransactions(transactions, tokens);
 * // Returns transactions where 'vegetable' appears in category OR merchant OR tag
 */
export function filterTransactions<T extends {
  category?: string;
  merchant?: string;
  tag?: string;
}>(transactions: T[], tokens: SearchTokens): T[] {
  return transactions.filter(txn => {
    // Check category tokens (AND)
    if (tokens.category.length > 0) {
      const categoryMatches = tokens.category.every(cat =>
        txn.category?.toLowerCase().includes(cat.toLowerCase())
      );
      if (!categoryMatches) return false;
    }

    // Check merchant tokens (AND)
    if (tokens.merchant.length > 0) {
      const merchantMatches = tokens.merchant.every(mer =>
        txn.merchant?.toLowerCase().includes(mer.toLowerCase())
      );
      if (!merchantMatches) return false;
    }

    // Check general terms (AND) - search in category, merchant, tag
    if (tokens.general.length > 0) {
      const generalMatches = tokens.general.every(term => {
        const lowerTerm = term.toLowerCase();
        return (
          txn.category?.toLowerCase().includes(lowerTerm) ||
          txn.merchant?.toLowerCase().includes(lowerTerm) ||
          txn.tag?.toLowerCase().includes(lowerTerm)
        );
      });
      if (!generalMatches) return false;
    }

    return true;
  });
}
