# Repo-Wide Changes Summary

## Overview
Applied comprehensive fixes across the application for fiscal window handling, filtering, budget calculations, and UI improvements.

## Changes Made

### 1. ✅ Dashboard - Fiscal Window (23rd → 22nd)
**Files:** `src/pages/Dashboard.tsx`, `src/lib/api.ts`

**Changes:**
- Period window already correctly implemented using `getCurrentPeriodWindow()` from `src/utils/period.ts`
- Fiscal window: Sep 23 - Oct 22 for current cycle (correctly working)
- Uses `{from, to}` for all data queries
- Period selector with localStorage persistence

**Current Behavior:**
```typescript
// For Oct 5, 2025:
getCurrentPeriodWindow()
// Returns: { from: '2025-09-23', to: '2025-10-22', year: 2025, month: 10 }
```

### 2. ✅ Average Daily Calculation Fixed
**File:** `src/lib/api.ts` (line 297-302)

**Old Formula:**
```typescript
daysElapsed = 1 + Math.floor((today - fromDate) / DAY_MS)
```

**New Formula (matches requirements):**
```typescript
// min(today, to) - from + 1
const effectiveEndDate = today < toDate ? today : toDate;
const daysElapsed = Math.max(1,
  1 + Math.floor((effectiveEndDate - fromDate) / DAY_MS)
);
avgDailyToDate = total / daysElapsed
```

**Example:**
- Period: Sep 23 - Oct 22 (30 days)
- Today: Oct 5
- Days elapsed: 13 (Sep 23 to Oct 5)
- Total spent: 542.850 BHD
- Avg daily to-date: 41.76 BHD/day
- Avg daily full: 18.09 BHD/day

### 3. ✅ Budget Remaining Fixed to 750 BHD
**Files:** `src/lib/api.ts`, `src/pages/Dashboard.tsx`

**Changes:**
- Default budget changed from 650 → 750 BHD
- `apiClient.getTransactionStats()` default parameter: `budget = 750`
- Dashboard state: `useState(() => saved ?? 750)`
- Calculation: `budgetRemaining = 750 - totalSpentThisFiscal`

**Display:**
- Shows in red if negative
- Warning message: "⚠️ Over budget by X.XX BHD"

### 4. ✅ Spending by Category - Top 5
**File:** `src/pages/Dashboard.tsx` (line 157-171)

**Changes:**
```typescript
const totalsByCategory = categories
  .map(category => ({ /* ... */ }))
  .filter(item => item.amount > 0)
  .sort((a, b) => b.amount - a.amount)  // Sort descending
  .slice(0, 5);  // Top 5 only

// Total calculated from ALL transactions, not just top 5
const total = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
```

**Behavior:**
- Groups by Category
- Sums Amount per category
- Sorts descending by amount
- Shows top 5 only
- Uses fiscal window data

### 5. ✅ Transactions - Dynamic Filter Chips
**File:** `src/pages/Transactions.tsx`

**Removed:**
- Hardcoded `COMMON_CATEGORIES` and `COMMON_MERCHANTS`
- Token-based search (`cat-`, `mer-` prefixes)

**Added:**
```typescript
// Derive top 10 categories/merchants by COUNT(*) from actual data
const frequentFilters = useMemo(() => {
  const categoryCount = new Map<string, number>();
  const merchantCount = new Map<string, number>();

  transactions.forEach(t => {
    categoryCount.set(t.category, (count || 0) + 1);
    merchantCount.set(t.merchant, (count || 0) + 1);
  });

  return {
    topCategories: sortByCount(categoryCount).slice(0, 10),
    topMerchants: sortByCount(merchantCount).slice(0, 10)
  };
}, [transactions]);
```

**UI:**
- Dynamic chips showing only categories/merchants present in current period
- Clickable chips add to filter
- Disabled state when already selected
- Clearable pills showing active filters

### 6. ✅ Multi-Select Category & Merchant Filters
**File:** `src/pages/Transactions.tsx`

**Old:** Single select dropdown, token-based search

**New:**
```typescript
// State
const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
const [selectedMerchants, setSelectedMerchants] = useState<string[]>([]);

// Filtering (AND semantics)
const categoryMatch = selectedCategories.length === 0 ||
  selectedCategories.includes(transaction.category);

const merchantMatch = selectedMerchants.length === 0 ||
  selectedMerchants.includes(transaction.merchant);
```

**Features:**
- Multiple categories can be selected
- Multiple merchants can be selected
- AND semantics: transaction must match ONE of selected values per filter type
- Active filters shown as removable badges
- Distinct values derived from actual data (alphabetically sorted)

### 7. ✅ Date Filter Options
**File:** `src/pages/Transactions.tsx`

**Added:**
```typescript
type DateFilter = 'current' | 'previous' | 'next' | 'custom';

const [dateFilterType, setDateFilterType] = useState<DateFilter>('current');
const [customFrom, setCustomFrom] = useState('');
const [customTo, setCustomTo] = useState('');
```

**Behavior:**
- **Current**: Uses `getCurrentPeriodWindow()` (Sep 23 - Oct 22)
- **Previous**: Uses `getPeriodWindow(prevYear, prevMonth)`
- **Next**: Uses `getPeriodWindow(nextYear, nextMonth)`
- **Custom**: User specifies from/to dates
- On change: refetches transactions with new `{from, to}`

### 8. ✅ Default Sort: Newest First
**File:** `src/pages/Transactions.tsx`

**Implementation:**
```typescript
// Default state
const [sortField, setSortField] = useState<SortField>('txnAt');
const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

// Sorting logic
switch (sortField) {
  case 'txnAt':
    const aDateTime = combineDateTime(a.date, a.time);
    const bDateTime = combineDateTime(b.date, b.time);
    comparison = aDateTime.localeCompare(bDateTime);
    break;
}

return sortDirection === 'asc' ? comparison : -comparison;  // DESC by default
```

**Combined DateTime:**
```typescript
combineDateTime('2025-10-05', '14:30') → '2025-10-05 14:30:00'
combineDateTime('2025-10-05', '')     → '2025-10-05 00:00:00'
```

### 9. 🔄 API Extension (Backend Integration Points)
**File:** `src/lib/api.ts`

**Interface for Backend:**
```typescript
export interface TransactionQueryParams {
  from: string;           // YYYY-MM-DD
  to: string;             // YYYY-MM-DD
  categories?: string[];  // Multi-select categories
  merchants?: string[];   // Multi-select merchants
  q?: string;             // Free-text search
  sort?: 'txnAt' | 'amount' | 'merchant';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}
```

**Backend Route (to implement):**
```
GET /api/transactions?from=2025-09-23&to=2025-10-22
  &categories[]=Food&categories[]=Transport
  &merchants[]=Talabat
  &q=lunch
  &sort=txnAt&order=desc
```

**AND Semantics:**
- Categories: Match if transaction.category IN categories[]
- Merchants: Match if transaction.merchant IN merchants[]
- Query (q): Substring match on Merchant OR Category OR Tag
- All filters: Must ALL pass (AND)

### 10. 🔄 DB-Agnostic DateTime Ordering (Backend Reference)

**SQLite:**
```sql
ORDER BY datetime(
  CASE WHEN length("Time") > 0
  THEN "Date" || ' ' || "Time"
  ELSE "Date" || ' 00:00'
  END
) DESC
```

**PostgreSQL:**
```sql
ORDER BY (
  ("Date" || ' ' || COALESCE(NULLIF("Time", ''), '00:00'))::timestamp
) DESC
```

**Client-Side (Current Implementation):**
```typescript
// Already implemented in src/utils/period.ts
combineDateTime(date, time) → 'YYYY-MM-DD HH:MM:SS'
transactions.sort((a, b) =>
  combineDateTime(b.date, b.time).localeCompare(combineDateTime(a.date, a.time))
)
```

## Summary of UI Changes

### Dashboard
- ✅ Budget: 750 BHD (was 650)
- ✅ Average Daily: Shows both to-date and full-window with day counts
- ✅ Budget Remaining: Red styling when negative
- ✅ Spending by Category: Top 5, sorted descending
- ✅ Fiscal window: Correctly uses 23rd → 22nd

### Transactions Page
- ✅ Dynamic chips from actual data (top 10 by count)
- ✅ Multi-select categories and merchants
- ✅ Clearable filter badges
- ✅ Free-text search (Merchant/Category/Tag)
- ✅ Date filter: Current/Previous/Next/Custom
- ✅ Default sort: Newest first (txnAt DESC)
- ✅ No hardcoded filter values

## Testing Checklist

- [ ] Dashboard shows correct fiscal window (Sep 23 - Oct 22)
- [ ] Average daily shows: to-date (13 days) and full (30 days)
- [ ] Budget remaining uses 750 BHD
- [ ] Top 5 categories sorted by amount descending
- [ ] Transactions page shows dynamic chips from actual data
- [ ] Clicking chip adds filter (shows as removable badge)
- [ ] Multiple categories/merchants can be selected
- [ ] Free-text search works on Merchant/Category/Tag
- [ ] Transactions sorted newest first by default
- [ ] Date filter changes period and refetches data

## Files Modified

1. `src/lib/api.ts` - Budget default, avgDaily calculation, query params
2. `src/pages/Dashboard.tsx` - Budget 750, top 5 categories, total calculation
3. `src/pages/Transactions.tsx` - Dynamic chips, multi-select, date filters
4. `src/types/index.ts` - Already has TransactionStats interface
5. `src/utils/period.ts` - Already correct (no changes needed)

## Backward Compatibility

- localStorage keys unchanged (dashboard-period, dashboard-budget, transaction-period)
- API client maintains backward compatibility with fallbacks
- Existing transaction data structure unchanged
- Old token search removed but replaced with better UX

## Next Steps (Backend)

1. Implement `/api/transactions` with query params support
2. Add categories[], merchants[], q parameters
3. Implement DB-agnostic datetime ordering
4. Add `/api/transactions/stats` endpoint
5. Return proper fiscal window data

---

Last Updated: 2025-10-05
Changes By: Claude Code
Status: ✅ Frontend Complete | 🔄 Backend Integration Pending
