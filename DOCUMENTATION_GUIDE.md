# Finance Tracker - Documentation Guide

## 📖 Overview

This guide helps you navigate and understand the Finance Tracker codebase. All main files now have comprehensive JSDoc comments and section headers for easy reading and searching.

## 🗂️ File Organization

### Core Utilities

#### `src/utils/period.ts`
**Purpose:** Fiscal month window calculations and transaction filtering

**Key Functions:**
```typescript
// Get fiscal period (23rd to 22nd)
getPeriodWindow(year, month1to12, anchorDay=23)
// Returns: { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD', year, month }

// Get current fiscal period
getCurrentPeriodWindow(anchorDay=23)

// Combine date & time for sorting
combineDateTime(date, time?)
// Returns: 'YYYY-MM-DD HH:MM:SS'

// Parse search tokens (cat-, mer-)
parseSearchQuery(search)
// Returns: { category: [], merchant: [], general: [] }

// Filter transactions with AND semantics
filterTransactions(transactions, tokens)
```

**Search Tokens:**
- `cat-food` → Category filter
- `mer-talabat` → Merchant filter
- `vegetable` → General search (all fields)
- `cat-food mer-talabat rice` → All must match (AND)

**Documentation:** Comprehensive JSDoc with @fileoverview, @param, @returns, @example

### API Client

#### `src/lib/api.ts`
**Purpose:** n8n backend integration with client-side fallbacks

**Main Sections:**
1. **Transaction Operations** - CRUD, filtering, sorting
2. **Stats Endpoint** - Budget tracking and averages
3. **Categories** - Category management
4. **Utility Methods** - Data transformation

**Key Methods:**
```typescript
// Fetch transactions for date range
apiClient.getTransactions(from, to)

// Get with advanced filters
apiClient.getTransactionsWithFilters({
  from, to, search, sort, order, limit, offset
})

// Get statistics with budget tracking
apiClient.getTransactionStats(from, to, budget=650)
// Returns: TransactionStats with total, avgDaily, budgetRemaining, etc.
```

**Documentation:** Class-level and method-level JSDoc, inline comments for complex logic

### Type Definitions

#### `src/types/index.ts`
**Purpose:** TypeScript interfaces for type safety

**Main Types:**
- `Transaction` - Single transaction record
- `Category` - Spending category with color
- `Summary` - Period summary with charts data
- `Budget` - Budget configuration
- `KPIData` - Dashboard KPI metrics
- `TransactionStats` - Detailed stats with budget tracking

**Documentation:** Interface-level JSDoc with property descriptions and examples

### Page Components

#### `src/pages/Dashboard.tsx`
**Purpose:** Main dashboard with KPIs, charts, and recent transactions

**Sections (use Ctrl+F to jump):**
```
// STATE MANAGEMENT
// DATA FETCHING
// DATA PROCESSING & CALCULATIONS
// RENDER
```

**Key Features:**
- Period selector (← Month X (YYYY) →)
- Stats from `getTransactionStats()`:
  - Total This Month
  - Avg Daily (to-date & full window)
  - Budget Remaining (red if negative)
- Recent transactions sorted newest-first
- localStorage persistence

**Documentation:** @fileoverview header, section comments, inline explanations

#### `src/pages/Transactions.tsx`
**Purpose:** Transaction list with advanced filtering and sorting

**Sections:**
```
// STATE MANAGEMENT
// DATA FETCHING
// FILTERING & SORTING
// RENDER
```

**Key Features:**
- Token-based search (`cat-`, `mer-`)
- Quick filter chips
- Month navigation
- Default sort: `txnAt DESC` (newest first)
- Edit transactions inline

**Documentation:** Section headers, function-level comments

## 🔍 How to Search the Codebase

### Finding Fiscal Period Logic
```bash
# Search for period window functions
grep -r "getPeriodWindow" src/

# Search for fiscal month comments
grep -r "23rd" src/
```

### Finding Stats/Budget Logic
```bash
# Search for stats endpoint
grep -r "getTransactionStats" src/

# Search for budget calculations
grep -r "budgetRemaining" src/
```

### Finding Sorting Logic
```bash
# Search for datetime sorting
grep -r "combineDateTime" src/

# Search for sort order
grep -r "DESC" src/
```

### Finding Token Search
```bash
# Search for search token parsing
grep -r "parseSearchQuery" src/

# Search for cat- and mer- tokens
grep -r "cat-" src/
grep -r "mer-" src/
```

## 📋 Common Tasks

### 1. Change Fiscal Month Anchor Day

**File:** `src/utils/period.ts`
**Location:** Search for `anchorDay = 23`
**Change:** Update default parameter value

### 2. Change Default Budget

**File:** `src/pages/Dashboard.tsx`
**Location:** Search for `budget: 650`
**Change:** Update default value in useState

### 3. Add New Search Token Prefix

**File:** `src/utils/period.ts`
**Function:** `parseSearchQuery()`
**Location:** Search for `if (lower.startsWith('cat-'))`
**Add:** New prefix handling block

### 4. Modify Stats Calculation

**File:** `src/lib/api.ts`
**Function:** `calculateStatsClientSide()`
**Location:** Search for `avgDailyToDate =`
**Modify:** Calculation logic

### 5. Change Transaction Sort Order

**File:** `src/pages/Dashboard.tsx`
**Location:** Search for `bDateTime.localeCompare(aDateTime)`
**Change:** Swap `a` and `b` for ASC order

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────┐
│           User Interface (Pages)            │
│  ┌────────────┐         ┌──────────────┐   │
│  │ Dashboard  │         │ Transactions │   │
│  └─────┬──────┘         └──────┬───────┘   │
│        │                       │            │
└────────┼───────────────────────┼────────────┘
         │                       │
         v                       v
┌─────────────────────────────────────────────┐
│              API Client Layer               │
│  ┌──────────────────────────────────────┐  │
│  │  apiClient (src/lib/api.ts)          │  │
│  │  - getTransactions()                 │  │
│  │  - getTransactionStats()             │  │
│  │  - Client-side fallbacks             │  │
│  └──────────────────────────────────────┘  │
└────────────────────┬────────────────────────┘
                     │
                     v
┌─────────────────────────────────────────────┐
│         Utility Layer (Pure Logic)          │
│  ┌──────────────────────────────────────┐  │
│  │  period.ts                           │  │
│  │  - getPeriodWindow()                 │  │
│  │  - parseSearchQuery()                │  │
│  │  - filterTransactions()              │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
         │                       │
         v                       v
┌─────────────────┐     ┌────────────────────┐
│  n8n Backend    │     │  localStorage      │
│  (Webhooks)     │     │  (Period, Budget)  │
└─────────────────┘     └────────────────────┘
```

## 📚 JSDoc Conventions

All code follows these JSDoc patterns:

### File Headers
```typescript
/**
 * @fileoverview Brief description
 *
 * Longer description with features and usage
 *
 * @example
 * // Usage example
 */
```

### Functions
```typescript
/**
 * Brief description
 *
 * Detailed explanation
 *
 * @param {type} name - Description
 * @returns {type} Description
 * @throws {Error} When this happens
 *
 * @example
 * // Usage example
 * functionName(args);
 */
```

### Interfaces
```typescript
/**
 * Description
 *
 * @interface InterfaceName
 * @property {type} name - Description
 *
 * @example
 * // Example object
 */
```

## 🎯 Quick Reference

### Fiscal Period Formula
```
Month N period = (Previous calendar month day 23) to (Current calendar month day 22)
Example: Month 10 = Sep 23 to Oct 22
```

### Search Token Syntax
```
cat-value     → Category contains 'value'
mer-value     → Merchant contains 'value'
value         → Any field contains 'value'
Multiple      → All must match (AND semantics)
```

### Sort Order
```
Default: txnAt DESC (newest first)
DateTime = Date + (Time || '00:00:00')
Missing times sort to midnight
```

### Stats Calculation
```
daysInWindow = 1 + (toDate - fromDate)
daysElapsed = 1 + min((today - fromDate), daysInWindow - 1)
avgDailyToDate = total / daysElapsed
avgDailyFull = total / daysInWindow
budgetRemaining = budget - total
```

## 🔗 Related Documentation

- [ACCEPTANCE_TESTS.md](ACCEPTANCE_TESTS.md) - Test results and examples
- [FISCAL_WINDOW_IMPLEMENTATION.md](FISCAL_WINDOW_IMPLEMENTATION.md) - Implementation details
- Test files (`*.test.ts`) - Unit test examples
- Component files - Inline comments and section headers

## 💡 Tips for Developers

1. **Use VS Code's "Go to Definition" (F12)** on any function to see its JSDoc
2. **Use "Find All References" (Shift+F12)** to see where something is used
3. **Search for section headers** with `//========` to jump between sections
4. **Look for @example tags** in JSDoc for usage patterns
5. **Check test files** for additional usage examples
6. **Console logs** are strategic - search for `console.log` for debug points

## 📞 Need Help?

1. Check JSDoc comments in the file
2. Look at @example sections
3. Review test files for usage patterns
4. Check this guide's Quick Reference section
5. Search for relevant comments using section headers

---

Last Updated: 2025-10-05
Version: 1.0.0
