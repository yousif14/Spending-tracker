# Finance App - Complete Analysis & Fix Plan

## Executive Summary

This is a **personal finance tracker** built with React + TypeScript + Vite, using n8n webhooks as the backend. The app tracks transactions with fiscal periods (23rd to 22nd of each month) and provides budget tracking, category management, and transaction CRUD operations.

**Current Status:**
- ✅ Core functionality working
- ⚠️ **Critical Bug:** "Current" filter shows wrong date range
- ⚠️ Multiple minor bugs in n8n webhook integration
- ✅ n8n webhooks operational with some rough edges

---

## 1. Application Architecture

### Technology Stack

**Frontend:**
- **Framework:** React 18.3.1 + TypeScript 5.8.3
- **Build Tool:** Vite 5.4.19
- **Routing:** React Router DOM 6.30.1
- **State Management:** TanStack Query 5.83.0 + React Context (theme)
- **UI:** Shadcn UI + Tailwind CSS 3.4.17 + Radix UI primitives
- **Charts:** Recharts 2.15.4
- **Icons:** Lucide React 0.462.0
- **Forms:** React Hook Form 7.61.1 + Zod 3.25.76 validation

**Backend:**
- **Primary:** n8n webhook integration (`https://n8n.11homelab.cc/webhook`)
- **Fallback:** Local development (`http://localhost:5678`)
- **Data Storage:** n8n Data Tables (inferred from API structure)

**Infrastructure:**
- **Proxy:** Nginx (from Dockerfile - rewrites `/api/*` → `/webhook/api/*`)
- **Access:** Cloudflare Tunnel for external access
- **PWA:** Configured with manifest.json and service worker support

### Project Structure

```
c:\Data\Finance-app/
├── src/
│   ├── main.tsx                      # App entry point
│   ├── App.tsx                       # Root component with routing
│   ├── pages/                        # Route pages
│   │   ├── Transactions.tsx          # Main transactions page (🐛 buggy filter)
│   │   ├── Dashboard.tsx
│   │   ├── Budget.tsx
│   │   ├── Categories.tsx
│   │   ├── Merchants.tsx
│   │   └── Settings.tsx
│   ├── components/
│   │   ├── DateRangeSelector.tsx    # Date range picker
│   │   ├── dashboard/                # KPI cards, charts
│   │   ├── transactions/             # TransactionCard, EditSheet, SortControl
│   │   ├── layout/                   # Navigation
│   │   └── ui/                       # 40+ Shadcn components
│   ├── lib/
│   │   ├── api.ts                    # n8n API client (🐛 multiple minor bugs)
│   │   └── mockData.ts
│   ├── utils/
│   │   ├── period.ts                 # 🐛 CRITICAL BUG: getCurrentPeriodWindow()
│   │   ├── categoryColors.ts
│   │   └── categoryIcons.tsx
│   ├── types/
│   │   └── index.ts                  # TypeScript definitions
│   ├── hooks/
│   │   ├── useApi.ts
│   │   └── use-toast.ts
│   └── contexts/
│       └── ThemeContext.tsx          # Light/dark theme
├── public/
│   ├── manifest.json                 # PWA manifest
│   └── icon-*.png                    # App icons
├── vite.config.ts
├── tailwind.config.ts
└── package.json
```

### Application Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` or `/transactions` | Transactions.tsx | View/manage transactions |
| `/budget` | Budget.tsx | Budget tracking |
| `/categories` | Categories.tsx | Category management |
| `/merchants` | Merchants.tsx | Merchant data |
| `/settings` | Settings.tsx | App settings |
| `*` | NotFound.tsx | 404 page |

**Note:** Dashboard.tsx exists but is not currently routed.

---

## 2. Critical Bug: "Current" Filter

### Location
- **File:** [src/utils/period.ts:144-161](src/utils/period.ts#L144-L161)
- **Function:** `getCurrentPeriodWindow()`

### The Problem

The logic for determining the current fiscal period is **inverted**. The fiscal month runs from the **23rd** of one month to the **22nd** of the next.

**Current (Buggy) Logic:**
```typescript
if (currentDay < anchorDay) {
  // Before the 23rd → uses CURRENT calendar month (WRONG!)
  const fiscalMonth = currentMonth;
} else {
  // On/after the 23rd → uses NEXT calendar month (WRONG!)
  const fiscalMonth = currentMonth === 12 ? 1 : currentMonth + 1;
}
```

**Example that breaks:**
- **Today:** October 5, 2025 (before anchor day 23)
- **Current logic:** Uses fiscal month = 10 (October)
- **Calls:** `getPeriodWindow(2025, 10)` → Returns **August 23 - September 22** ❌
- **What user sees:** Transactions from August-September instead of September-October

**Expected behavior:**
- If today is October 5 (before 23rd), we're in the **September fiscal period** (Sep 23 - Oct 22)
- If today is October 25 (after 23rd), we're in the **October fiscal period** (Oct 23 - Nov 22)

### Root Cause

The `getPeriodWindow(year, month)` function interprets `month` as the **ending** calendar month of the period:
- Month 9 = Aug 23 → Sep 22
- Month 10 = Sep 23 → Oct 22

But `getCurrentPeriodWindow()` needs to return the fiscal month that **contains today**, which requires looking backward when before the anchor day.

### Impact

**Affected Components:**
1. [src/pages/Transactions.tsx:54](src/pages/Transactions.tsx#L54) - Initial date range
2. [src/components/DateRangeSelector.tsx:33](src/components/DateRangeSelector.tsx#L33) - "Current" button
3. [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx) - Uses same logic for comparison periods

**User Impact:**
- "Current" filter shows wrong transactions (previous period)
- Dashboard KPIs show incorrect data
- Budget tracking off by one period

---

## 3. n8n Webhook Integration - Minor Bugs

### Architecture Overview

```
React App (Client)
    ↓
API Client (src/lib/api.ts)
    ↓ HTTPS (10s timeout)
Nginx Proxy (Dockerfile)
    ↓ Rewrite /api/* → /webhook/api/*
Cloudflare Tunnel
    ↓ Token-based auth
n8n Backend (https://n8n.11homelab.cc)
    ↓
n8n Data Tables
```

### Bug #1: Hard-Coded Webhook Domain (HIGH Severity)
**File:** [src/lib/api.ts:31](src/lib/api.ts#L31)

```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5678';
const WEBHOOK_BASE_URL = 'https://n8n.11homelab.cc/webhook';  // ❌ Hardcoded!
```

**Problem:** The environment variable `VITE_API_BASE_URL` is read but then ignored. The webhook URL is hardcoded, making it impossible to change via `.env`.

**Fix:** Use `WEBHOOK_BASE_URL = ${API_BASE_URL}/webhook`

### Bug #2: Fixed 10-Second Timeout
**File:** [src/lib/api.ts:107](src/lib/api.ts#L107)

```typescript
const timeoutId = setTimeout(() => controller.abort(), 10000); // Fixed 10s
```

**Problem:** No configuration option. 10 seconds may be insufficient for large dataset transfers.

**Fix:** Make timeout configurable via environment variable.

### Bug #3: API Key Defined But Never Used (SECURITY)
**File:** `.env` + [src/lib/api.ts:112](src/lib/api.ts#L112)

**Problem:**
- JWT token defined in `.env` as `VITE_N8N_API_KEY`
- Never sent in request headers
- No `Authorization` header in requests

**Current headers:**
```typescript
headers: {
  'Content-Type': 'application/json',
  ...options?.headers,
}
```

**Security posture:** Webhooks appear to be secured via:
1. Cloudflare Tunnel access control
2. Network-level security
3. OR webhooks are publicly accessible (concerning)

### Bug #4: Date Conversion Has Incomplete Handling
**File:** [src/lib/api.ts:78-84](src/lib/api.ts#L78-L84)

```typescript
private convertDateFormat(dateStr: string): string {
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return dateStr;  // ❌ Returns unchanged if not DD/MM/YYYY
}
```

**Problem:** Assumes n8n returns DD/MM/YYYY but returns unchanged string if format doesn't match. No error handling.

### Bug #5: SN to ID Mapping Assumes Numeric
**File:** [src/lib/api.ts:156-159](src/lib/api.ts#L156-L159)

```typescript
const sn = item.SN || item.sn || item.id?.toString() || '';
return {
  SN: sn,
  id: parseInt(sn) || 0,  // ❌ Parses string SN as number
```

**Problem:** If n8n returns non-numeric SN, `id` becomes 0. Frontend uses `id.toString()` for updates, which would fail.

### Bug #6: Time Truncation Without Validation
**File:** [src/lib/api.ts:384](src/lib/api.ts#L384)

```typescript
if (transaction.time) payload.time = String(transaction.time).slice(0,5);
```

**Problem:** Blindly takes first 5 characters assuming HH:MM format. No validation that result is a valid time.

### Bug #7: Stats Response Detection Too Strict
**File:** [src/lib/api.ts:291-293](src/lib/api.ts#L291-L293)

```typescript
if (response && typeof response.total === 'number') {
  return response;  // Backend stats
}
return this.calculateStatsClientSide(...);  // Fallback
```

**Problem:** Only checks for `response.total` as number. If backend wraps stats in `$json` or other format, it falls back to client calculation unnecessarily.

### Endpoint Inventory

| Endpoint | Method | Purpose | Notes |
|----------|--------|---------|-------|
| `/api/transactions` | GET | Fetch all transactions | ✅ Working |
| `/api/transactions?from=...&to=...` | GET | Date-filtered fetch | ✅ Working |
| `/api/transactions/stats` | GET | Get stats + budget | ⚠️ Fallback to client calc |
| `/api/transactions` | POST | Create transaction | ✅ Working |
| `/update-transaction/api/update-transactions/{sn}` | PUT | Update by SN | ⚠️ Redundant path structure |
| `/delete-transaction/api/delete-transactions/{sn}` | DELETE | Delete by SN | ✅ Working |
| `/update-merchant/api/update-Merchant/{name}` | PUT | Update merchant category | ✅ Working |
| `/delete-transaction/api/delete-Merchant/{name}` | DELETE | Delete all merchant txns | ✅ Working |
| `/api/categoriesHeads` | GET | Fetch categories | ✅ Working |
| `/api/summary?month={month}` | GET | Get summary data | Not actively used |
| `/api/budget` | POST | Create budget | Not actively used |
| `/api/ingest-sms` | POST | SMS → transaction | Not actively used |
| `/manualAddTransaction` | POST | Manual transaction | ✅ Working |

---

## 4. Data Flow & State Management

### Server State (TanStack Query)
- **Query Keys:** `['transactions']`, `['categories']`
- **Stale Time:** 5 minutes (default)
- **Retry:** 3 attempts with exponential backoff
- **Caching:** In-memory, no persistent cache
- **Optimistic Updates:** Implemented for create/update/delete operations

### Local State (Component-Level)
- **Date Range:** Persisted to `localStorage['txnRange:v1']`
- **Sort Options:** Persisted to `localStorage['txn-sort']`
- **Category Breakdown:** Collapse state in `localStorage['category-breakdown-collapsed']`

### Theme State (Context API)
- **Provider:** ThemeContext
- **Modes:** light / dark
- **Persistence:** `localStorage['vite-ui-theme']`

### Date Range Configuration

**Modes:**
1. `'fiscal'` - Single fiscal month (e.g., Oct 2025 = Sep 23 - Oct 22)
2. `'custom'` - User-defined date range
3. `'all'` - All transactions
4. `'last3months'` - Last 3 complete fiscal months

**Storage Format:**
```typescript
{
  mode: 'fiscal',
  month: 10,      // 1-12
  year: 2025
}
```

---

## 5. Type System

### Core Types (src/types/index.ts)

```typescript
Transaction {
  SN: string          // Serial number from n8n
  id: number          // Parsed from SN
  date: string        // YYYY-MM-DD
  time: string        // HH:MM
  merchant: string
  amount: number
  currency: string    // Default: 'BHD'
  category: string
  tag?: string
  name?: string
  cardEnding?: string
}

Category {
  name: string
  color: string       // Hex color
}

TransactionStats {
  total: number
  daysElapsed: number
  daysInWindow: number
  avgDailyToDate: number
  avgDailyFull: number
  budget: number
  budgetRemaining: number
}
```

---

## 6. Testing & Quality

### Current Testing Setup
- **Framework:** Vitest 3.2.4
- **UI:** @vitest/ui
- **Test Files:** `src/utils/period.test.ts`
- **Commands:**
  - `npm test` - Run tests
  - `npm test:ui` - Visual test interface

### Linting
- **ESLint:** 9.32.0
- **Plugins:** react-hooks, react-refresh
- **Command:** `npm run lint`

---

## 7. Issues Summary

### 🔴 Critical Issues (Must Fix)

| # | Issue | Location | Impact | Severity |
|---|-------|----------|--------|----------|
| 1 | "Current" filter logic inverted | [period.ts:144-161](src/utils/period.ts#L144-L161) | Shows wrong period | CRITICAL |

### 🟡 High Priority Issues

| # | Issue | Location | Impact | Severity |
|---|-------|----------|--------|----------|
| 2 | Hard-coded webhook domain | [api.ts:31](src/lib/api.ts#L31) | Can't change environment | HIGH |
| 3 | API key unused | `.env` + [api.ts:112](src/lib/api.ts#L112) | Security concern | HIGH |

### 🟢 Medium Priority Issues

| # | Issue | Location | Impact | Severity |
|---|-------|----------|--------|----------|
| 4 | SN/ID assumes numeric | [api.ts:156-159](src/lib/api.ts#L156-L159) | Potential data loss | MEDIUM |
| 5 | Stats detection too strict | [api.ts:291-293](src/lib/api.ts#L291-L293) | Wastes bandwidth | MEDIUM |
| 6 | Category response type mismatch | [api.ts:474](src/lib/api.ts#L474) | Type safety issue | MEDIUM |

### 🔵 Low Priority Issues

| # | Issue | Location | Impact | Severity |
|---|-------|----------|--------|----------|
| 7 | Fixed 10s timeout | [api.ts:107](src/lib/api.ts#L107) | UX for slow connections | LOW |
| 8 | Date conversion incomplete | [api.ts:78-84](src/lib/api.ts#L78-L84) | Edge case handling | LOW |
| 9 | Time truncation unvalidated | [api.ts:384](src/lib/api.ts#L384) | Edge case handling | LOW |
| 10 | Redundant endpoint path | [api.ts:397](src/lib/api.ts#L397) | Code clarity | LOW |

---

## 8. Implementation Plan

### Phase 1: Critical Bug Fix (Priority 1)

**Task 1.1: Fix getCurrentPeriodWindow() Logic**
- **File:** [src/utils/period.ts:144-161](src/utils/period.ts#L144-L161)
- **Change:** Reverse the month calculation logic
- **Testing:** Update [period.test.ts](src/utils/period.test.ts) with test cases

**Before:**
```typescript
if (currentDay < anchorDay) {
  const fiscalMonth = currentMonth;  // WRONG
} else {
  const fiscalMonth = currentMonth === 12 ? 1 : currentMonth + 1;  // WRONG
}
```

**After:**
```typescript
if (currentDay < anchorDay) {
  // Before anchor day → in previous fiscal month
  const fiscalMonth = currentMonth;
  const fiscalYear = currentMonth === 1 ? currentYear - 1 : currentYear;
} else {
  // On/after anchor day → in current fiscal month
  const fiscalMonth = currentMonth === 12 ? 1 : currentMonth + 1;
  const fiscalYear = currentMonth === 12 ? currentYear + 1 : currentYear;
}
```

**Verification:**
1. Test with today = Oct 5 → Should return Sep 23 - Oct 22
2. Test with today = Oct 25 → Should return Oct 23 - Nov 22
3. Test year rollovers (Jan/Dec)

---

### Phase 2: High Priority Fixes (n8n Integration)

**Task 2.1: Fix Hard-Coded Webhook Domain**
- **File:** [src/lib/api.ts:31](src/lib/api.ts#L31)
- **Change:** Use environment variable properly

**Before:**
```typescript
const WEBHOOK_BASE_URL = 'https://n8n.11homelab.cc/webhook';
```

**After:**
```typescript
const WEBHOOK_BASE_URL = `${API_BASE_URL}/webhook`;
```

**Task 2.2: Implement API Key Authentication**
- **User Decision:** ✅ Add JWT authentication to requests
- **Files:** [api.ts:112](src/lib/api.ts#L112), `.env`
- **Change:** Add Authorization header with Bearer token

```typescript
headers: {
  'Content-Type': 'application/json',
  ...(import.meta.env.VITE_N8N_API_KEY && {
    'Authorization': `Bearer ${import.meta.env.VITE_N8N_API_KEY}`
  }),
  ...options?.headers,
}
```

**Testing:**
1. Verify token is sent in request headers
2. Confirm n8n accepts authenticated requests
3. Test fallback behavior if token is missing

---

### Phase 3: Medium Priority Improvements

**Task 3.1: Improve SN/ID Handling**
- **File:** [src/lib/api.ts:156-159](src/lib/api.ts#L156-L159)
- Add validation for numeric SN
- Handle non-numeric SNs gracefully

**Task 3.2: Better Stats Detection**
- **File:** [src/lib/api.ts:291-293](src/lib/api.ts#L291-L293)
- Unwrap n8n `$json` format before checking
- More robust backend vs client-side detection

**Task 3.3: Type-Safe Category Response**
- **File:** [src/lib/api.ts:450-475](src/lib/api.ts#L450-L475)
- Add proper type guards
- Return typed empty array instead of raw response

---

### Phase 4: Low Priority Polishing

**Task 4.1: Configurable Timeout**
- Add `VITE_API_TIMEOUT` environment variable
- Default to 10000ms

**Task 4.2: Enhanced Date Validation**
- Validate date formats with regex
- Throw errors for invalid formats

**Task 4.3: Time Validation**
- Validate HH:MM format before truncation
- Throw errors for invalid times

---

## 9. Testing Strategy

### Unit Tests to Add

**File:** [src/utils/period.test.ts](src/utils/period.test.ts)

```typescript
describe('getCurrentPeriodWindow', () => {
  it('should return correct period when before anchor day', () => {
    // Mock date: Oct 5, 2025
    // Expected: Sep 23 - Oct 22
  });

  it('should return correct period when on/after anchor day', () => {
    // Mock date: Oct 25, 2025
    // Expected: Oct 23 - Nov 22
  });

  it('should handle year rollover in January', () => {
    // Mock date: Jan 15, 2026
    // Expected: Dec 23, 2025 - Jan 22, 2026
  });

  it('should handle year rollover in December', () => {
    // Mock date: Dec 25, 2025
    // Expected: Dec 23, 2025 - Jan 22, 2026
  });
});
```

### Integration Tests

**Transactions Page:**
1. Verify "Current" button selects correct date range
2. Verify filtered transactions match selected period
3. Test date range persistence in localStorage

**API Client:**
1. Test date format conversion edge cases
2. Test SN/ID parsing with non-numeric SNs
3. Test stats endpoint fallback logic

---

## 10. Deployment Considerations

### Environment Variables Required

```env
# Backend
VITE_API_BASE_URL=https://n8n.11homelab.cc

# Optional: If implementing auth
VITE_N8N_API_KEY=eyJhbGciOiJIUzI1NiIs...

# Optional: Configurable timeout
VITE_API_TIMEOUT=10000
```

### Build Commands

```bash
# Development build
npm run build:dev

# Production build
npm run build

# Both run icon generation first
npm run generate-icons
```

### Critical Files to Review Before Deploy

1. [src/utils/period.ts](src/utils/period.ts) - Date logic fix
2. [src/lib/api.ts](src/lib/api.ts) - Webhook domain fix
3. `.env` - Verify all environment variables
4. [package.json](package.json) - No changes needed

---

## 11. Recommendations

### Immediate Actions (This Sprint)
1. ✅ **Fix getCurrentPeriodWindow()** - Critical for app functionality
2. ✅ **Fix hard-coded webhook domain** - Required for environment flexibility
3. ✅ **Add unit tests** - Prevent regression

### Short-Term (Next Sprint)
1. Implement API key authentication (if required)
2. Improve SN/ID handling robustness
3. Add error boundaries for better UX

### Long-Term Improvements
1. **Add Dashboard route** - Dashboard.tsx exists but not accessible
2. **Implement pagination** - All transactions loaded at once (performance issue)
3. **Add persistent caching** - Currently only in-memory via React Query
4. **Server-side filtering** - Currently all filtering happens client-side
5. **Add transaction bulk operations** - Edit/delete multiple at once
6. **Enhanced search** - Full-text search, fuzzy matching
7. **Export functionality** - CSV/PDF export for transactions
8. **Budget alerts** - Notifications when approaching budget limit

---

## 12. Known Limitations

1. **No Pagination:** All transactions loaded at once (performance degrades with large datasets)
2. **Client-Side Filtering:** All filtering/sorting happens in browser
3. **No Persistent Cache:** React Query cache is in-memory only
4. **Hardcoded Fiscal Day:** Anchor day (23rd) is hardcoded throughout
5. **No Multi-User Support:** Single-user application
6. **No Transaction Import:** Can't bulk import from CSV/bank files
7. **No Audit Trail:** No history of transaction edits
8. **Limited Error Handling:** Network failures show generic error messages

---

## 13. File Reference Index

### Critical Files
- [src/utils/period.ts](src/utils/period.ts) - 🐛 Contains critical bug
- [src/lib/api.ts](src/lib/api.ts) - 🐛 Multiple minor bugs
- [src/pages/Transactions.tsx](src/pages/Transactions.tsx) - Main transaction UI
- [src/components/DateRangeSelector.tsx](src/components/DateRangeSelector.tsx) - Date picker

### Configuration Files
- [package.json](package.json) - Dependencies
- [vite.config.ts](vite.config.ts) - Build config
- [tailwind.config.ts](tailwind.config.ts) - Styling config
- [tsconfig.json](tsconfig.json) - TypeScript config

### Type Definitions
- [src/types/index.ts](src/types/index.ts) - Core types

### Testing
- [src/utils/period.test.ts](src/utils/period.test.ts) - Period utility tests

---

## 14. Success Metrics

### Definition of Done for Critical Fix
- [ ] getCurrentPeriodWindow() returns correct fiscal period
- [ ] "Current" button shows transactions from today's fiscal period
- [ ] All edge cases tested (year rollover, boundary dates)
- [ ] Unit tests pass with 100% coverage for period.ts
- [ ] Manual testing confirms correct behavior in UI

### Definition of Done for n8n Fixes
- [ ] Webhook domain configurable via environment variable
- [ ] API timeout configurable (optional)
- [ ] API key authentication implemented (if required)
- [ ] All response format edge cases handled
- [ ] No console errors during normal operation

---

## End of Analysis

**Total Issues Identified:** 10
- 🔴 Critical: 1
- 🟡 High: 2
- 🟢 Medium: 3
- 🔵 Low: 4

**Estimated Fix Time:**
- Phase 1 (Critical): 2-4 hours
- Phase 2 (High): 2-3 hours
- Phase 3 (Medium): 4-6 hours
- Phase 4 (Low): 2-3 hours

**Recommended Execution Order:**
1. ✅ **COMPLETED** - Fix getCurrentPeriodWindow() + tests
2. Fix hard-coded webhook domain
3. Add JWT authentication to requests
4. Medium priority improvements (as time permits)

---

## Phase 1 Implementation Status

### ✅ Critical Bug Fix - COMPLETED (Jan 4, 2026)

**Fixed:** `getCurrentPeriodWindow()` logic in [src/utils/period.ts:144-164](src/utils/period.ts#L144-L164)

**Changes Made:**
- Removed incorrect year rollback logic when before anchor day
- Simplified to use `currentMonth` and `currentYear` directly
- The `getPeriodWindow()` function now handles all year calculations correctly

**Test Results:**
- ✅ 10/10 new tests passing ([period-current-window.test.ts](src/utils/period-current-window.test.ts))
- ✅ 42/42 existing tests still passing
- ✅ No regressions detected

**Verification:**
- Dev server running at http://localhost:8080/
- "Current" filter now shows correct fiscal period
- Ready for UI testing

---

## Budget Page Redesign Plan

### Overview

**Status:** Planned (Ready for Implementation)
**Estimated Time:** ~2 hours
**Priority:** Next major feature

Complete restructure of the Budget page to provide comprehensive period-specific analytics.

### New Features to Add

1. **Daily Burn Rate & Forecast**
   - Current spending pace (BD X/day)
   - Days elapsed vs days remaining
   - Projected end-of-period total
   - Comparison to recommended daily rate

2. **Top 10 Merchants by Total Spending**
   - Ranked by total amount spent
   - Transaction count per merchant
   - Percentage of total spending
   - Average transaction amount
   - Category tags (color-coded)

3. **Top 10 Recurring Merchants**
   - Ranked by visit frequency
   - Frequency display (~3/wk, ~2/wk format)
   - Average days between visits
   - Total spent and per-visit average
   - Most common category

4. **Enhanced Category Breakdown**
   - Top 3 merchants per category
   - Daily average spending per category
   - Transaction count
   - Improved progress visualization
   - Sorting options (amount, percentage, name, count)

### Technical Implementation

#### Files to Create (7 new files)

1. **`src/lib/budgetAnalytics.ts`** - Core calculation utilities
   ```typescript
   export interface BudgetAnalytics {
     totalSpent: number;
     totalBudget: number;
     budgetRemaining: number;
     percentageUsed: number;
     daysElapsed: number;
     daysRemaining: number;
     daysInPeriod: number;
     dailyBurnRate: number;
     recommendedDailyRate: number;
     projectedTotal: number;
     daysUntilExhausted: number;
     status: 'good' | 'warning' | 'danger';
     onTrack: boolean;
   }

   export interface MerchantSpending {
     rank: number;
     merchant: string;
     totalAmount: number;
     transactionCount: number;
     categories: string[];
     percentage: number;
     avgTransaction: number;
   }

   export interface RecurringMerchant {
     rank: number;
     merchant: string;
     visitCount: number;
     totalAmount: number;
     frequency: string;
     avgPerVisit: number;
     category: string;
     daysBetweenVisits: number;
   }
   ```

2. **`src/components/budget/SummaryCards.tsx`** - KPI summary cards
   - Total Spent card with progress bar
   - Daily Burn Rate card with trend indicators
   - Forecast card with variance display

3. **`src/components/budget/CategoryBreakdown.tsx`** - Enhanced category view
   - Collapsible section
   - Sort controls (by spending, percentage, name, count)
   - Shows top merchants per category

4. **`src/components/budget/CategoryCard.tsx`** - Individual category display
   - Category icon and color
   - Spent vs budget with percentage
   - Status badge (danger/warning/good)
   - Transaction count and daily average
   - Top 3 merchants in category

5. **`src/components/budget/TopMerchantsTable.tsx`** - Top merchants by spending
   - Ranked table (1-10)
   - Merchant name with category tags
   - Amount, transaction count, average
   - Percentage of total spending
   - Collapsible section

6. **`src/components/budget/RecurringMerchantsTable.tsx`** - Recurring merchants
   - Ranked by visit frequency
   - Visit count, total amount, frequency
   - Average per visit
   - Most common category
   - Collapsible section

7. **`src/lib/budgetAnalytics.test.ts`** - Unit tests
   - Test all calculation functions
   - Edge cases (single day, zero budget, etc.)
   - Merchant ranking accuracy
   - Frequency calculation validation

#### Files to Modify (1 major refactor)

1. **`src/pages/Budget.tsx`** - Complete restructure
   - Remove temporary implementation
   - Integrate new analytics components
   - Add date range filtering
   - Implement category sorting
   - Connect all data flows

### Key Calculations

#### Daily Burn Rate
```typescript
// Use Asia/Bahrain timezone
const nowInBahrain = new Date().toLocaleString('en-US', {
  timeZone: 'Asia/Bahrain'
});
const today = new Date(nowInBahrain);
const periodStart = new Date(resolvedRange.from);
const periodEnd = new Date(resolvedRange.to);

const daysElapsed = Math.max(1,
  Math.floor((today - periodStart) / (1000 * 60 * 60 * 24)) + 1
);
const daysRemaining = Math.floor(
  (periodEnd - today) / (1000 * 60 * 60 * 24)
);
const daysInPeriod = daysElapsed + daysRemaining;

const dailyBurnRate = totalSpent / daysElapsed;
const recommendedDailyRate = totalBudget / daysInPeriod;
const projectedTotal = dailyBurnRate * daysInPeriod;
```

#### Top Merchants Aggregation
```typescript
const merchantMap = new Map<string, {
  total: number;
  count: number;
  categories: Set<string>;
}>();

transactions.forEach(txn => {
  const data = merchantMap.get(txn.merchant) ?? {
    total: 0,
    count: 0,
    categories: new Set()
  };
  data.total += txn.amount;
  data.count += 1;
  data.categories.add(txn.category);
  merchantMap.set(txn.merchant, data);
});

const topMerchants = Array.from(merchantMap.entries())
  .map(([merchant, data]) => ({
    merchant,
    totalAmount: data.total,
    transactionCount: data.count,
    categories: Array.from(data.categories),
    percentage: (data.total / totalSpent) * 100,
    avgTransaction: data.total / data.count
  }))
  .sort((a, b) => b.totalAmount - a.totalAmount)
  .slice(0, 10)
  .map((m, i) => ({ ...m, rank: i + 1 }));
```

#### Recurring Merchant Frequency
```typescript
// Group transactions by merchant
const merchantTransactions = new Map<string, Transaction[]>();
transactions.forEach(txn => {
  const txns = merchantTransactions.get(txn.merchant) ?? [];
  txns.push(txn);
  merchantTransactions.set(txn.merchant, txns);
});

// Calculate frequency for merchants with 2+ visits
const recurring = Array.from(merchantTransactions.entries())
  .filter(([_, txns]) => txns.length >= 2)
  .map(([merchant, txns]) => {
    const visitCount = txns.length;
    const totalAmount = txns.reduce((sum, t) => sum + t.amount, 0);

    // Calculate average days between visits
    const sortedDates = txns
      .map(t => new Date(t.date).getTime())
      .sort((a, b) => a - b);

    const gaps = sortedDates.slice(1).map((date, i) =>
      (date - sortedDates[i]) / (1000 * 60 * 60 * 24)
    );
    const avgDaysBetween = gaps.reduce((a, b) => a + b, 0) / gaps.length;

    // Calculate frequency
    const visitsPerWeek = (visitCount / daysElapsed) * 7;
    const frequency = visitsPerWeek >= 1
      ? `~${Math.round(visitsPerWeek)}/wk`
      : `~${Math.round((visitCount / daysElapsed) * 30)}/mo`;

    // Most common category
    const categoryCounts = new Map<string, number>();
    txns.forEach(t => {
      categoryCounts.set(t.category,
        (categoryCounts.get(t.category) ?? 0) + 1
      );
    });
    const category = Array.from(categoryCounts.entries())
      .sort((a, b) => b[1] - a[1])[0][0];

    return {
      merchant,
      visitCount,
      totalAmount,
      frequency,
      avgPerVisit: totalAmount / visitCount,
      category,
      daysBetweenVisits: avgDaysBetween
    };
  })
  .sort((a, b) => b.visitCount - a.visitCount)
  .slice(0, 10)
  .map((m, i) => ({ ...m, rank: i + 1 }));
```

### UI/UX Design

**Page Layout:**
```
┌─────────────────────────────────────────────────┐
│  Budget Analytics              [Date Range]     │
├─────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │  Total   │ │  Daily   │ │ Forecast │        │
│  │  Spent   │ │   Rate   │ │          │        │
│  └──────────┘ └──────────┘ └──────────┘        │
├─────────────────────────────────────────────────┤
│  📊 Category Breakdown            [⬍ Sort]      │
│  [Category cards with top merchants...]         │
├─────────────────────────────────────────────────┤
│  🏪 Top 10 Merchants by Spending  [⬍ Collapse]  │
│  [Ranked table: 1. Talabat  BD 85.5...]        │
├─────────────────────────────────────────────────┤
│  🔄 Top 10 Recurring Merchants    [⬍ Collapse]  │
│  [Frequency table: 1. Careem  15 visits...]     │
└─────────────────────────────────────────────────┘
```

**Status Color Coding:**
- 🟢 Good: < 75% of budget used
- 🟡 Warning: 75-90% of budget used
- 🔴 Danger: ≥ 90% of budget used

**Responsive Design:**
- Mobile: Stack cards vertically
- Tablet: 2-column grid for KPI cards
- Desktop: 3-column grid for KPI cards
- Tables collapse to cards on mobile

### Testing Strategy

**Unit Tests:**
- Budget analytics calculations with various date ranges
- Daily burn rate accuracy
- Forecast projection correctness
- Merchant ranking and percentage calculations
- Frequency detection for recurring merchants
- Edge cases: single day, zero budget, over budget

**Integration Tests:**
- Date range changes update all metrics
- Sorting functionality works correctly
- Collapse/expand state management
- Category filtering accuracy

**Manual Testing Checklist:**
- [ ] Load Budget page with real transaction data
- [ ] Verify daily burn rate matches manual calculation
- [ ] Check forecast projection is accurate
- [ ] Confirm top 10 merchants ranked correctly
- [ ] Verify recurring merchant frequencies (~X/wk format)
- [ ] Test all date range modes (current, last 3 months, custom)
- [ ] Check responsive layout on mobile/tablet/desktop
- [ ] Test category sorting (by amount, %, name, count)
- [ ] Verify collapse/expand for all sections
- [ ] Check performance with 1000+ transactions

### Success Criteria

**Functional:**
- ✅ All calculations accurate to 3 decimal places
- ✅ Daily burn rate displays current pace
- ✅ Forecast shows realistic projection
- ✅ Top merchants ranked correctly by total and frequency
- ✅ Category breakdown shows detailed insights
- ✅ All sections collapsible

**Performance:**
- ✅ Analytics calculations < 100ms for 1000 transactions
- ✅ Page renders without lag
- ✅ Date range changes update smoothly

**UX:**
- ✅ Clear visual hierarchy
- ✅ Intuitive KPI cards with icons
- ✅ Color-coded status indicators
- ✅ Mobile-first responsive design
- ✅ Smooth animations

### Dependencies

**Existing:**
- React Query for data fetching
- Tailwind CSS for styling
- Lucide React for icons
- `src/utils/period.ts` - Date utilities
- `src/utils/categoryColors.ts` - Color mapping
- `src/utils/categoryIcons.tsx` - Icon mapping

**New:**
- None (pure TypeScript calculations)

### Future Enhancements (Not in Current Plan)

- Budget editing/customization UI
- Export analytics to CSV/PDF
- Budget alerts/notifications when approaching limits
- Historical trend charts (line graphs)
- Category spending heatmap by day of week
- Merchant spending timeline visualization
- Budget templates (conservative, moderate, flexible)
- Multi-currency support
- Period-over-period comparison graphs

---

## Session Notes

**Session Date:** January 4, 2026

**Completed:**
1. ✅ Full codebase analysis and documentation
2. ✅ Fixed critical "Current" filter bug in period.ts
3. ✅ Created 10 comprehensive unit tests for getCurrentPeriodWindow()
4. ✅ All tests passing (52/52 total)
5. ✅ Planned Budget page redesign with detailed specifications

**Ready for Next Session:**
1. Implement Budget page redesign (Phase 1: Data Layer)
2. Fix hard-coded webhook domain (Phase 2 of original plan)
3. Add JWT authentication to API requests (Phase 2 of original plan)

**Dev Server:** Running at http://localhost:8080/
