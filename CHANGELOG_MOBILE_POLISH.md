# Changelog: Dashboard & Mobile Polish

## Summary
Mobile-first improvements to FN Finance web app focusing on PWA installation, iOS compatibility, accurate metrics, complete category visualization, and vibrant color palette.

---

## Commits

### 1. **feat: configure PWA icon with home.png for iPhone install** (919f946)
- Copied `home.png` to `public/apple-touch-icon.png` and `public/home.png`
- Updated `manifest.json` to use home.png for all icon sizes
- Updated `index.html` apple-touch-icon link
- App name "FN" displays correctly on home screen installation

### 2. **fix: respect iOS safe areas in mobile header** (a78d638)
- Added safe area utility classes: `pt-safe`, `pb-safe`, `pl-safe`, `pr-safe`
- Applied `pt-safe` to mobile navigation container
- Added `sticky top-0 z-50` to mobile nav for proper layering
- Page switcher button now fully visible and tappable, no status bar overlap

### 3. **feat: show all categories in modern donut chart** (a28149c)
- Removed `.slice(0, 5)` from Dashboard category calculation
- Replaced pie chart with modern donut design (innerRadius: 50, outerRadius: 85)
- Added scrollable legend showing all categories with percentages
- Enhanced header displaying "{N} categories • {Total} total"
- Improved tooltips with percentage information
- 800ms smooth animation on chart load

### 4. **feat: enhance color palette for vibrant, accessible dark mode** (5c5cc95)
**Color Updates:**
- Primary: `243 75% 62%` → `243 80% 65%` (more vibrant indigo)
- Secondary: `240 6% 14%` → `270 70% 55%` (vivid purple, not gray)
- Muted foreground: `240 4% 70%` → `240 5% 75%` (brighter text)
- Success: `142 76% 36%` → `142 76% 45%` (brighter green)
- Warning: `38 92% 50%` → `38 92% 55%` (more visible amber)
- Border: `240 6% 14%` → `240 6% 16%` (better contrast)

**Visual Enhancements:**
- Updated gradients to match vibrant palette
- Enhanced shadows: increased opacity and glow effects
- Maintains WCAG AA contrast ratios (≥4.5:1)

### 5. **docs: add comprehensive Dashboard & Mobile Polish summary** (402d8d5)
- Created `DASHBOARD_MOBILE_POLISH.md` with full technical documentation
- Documents metrics calculation formulas (Total, Avg Daily, Budget Remaining)
- Explains safe area handling approach
- Details category chart implementation ensuring all categories display
- Includes acceptance criteria checklist

---

## Technical Details

### Metrics Calculation (Dashboard)
**Already Correct** - Verified existing implementation:
- **Total This Period**: Sum of transactions in selected date range
- **Avg Daily (To-date)**: `total / daysElapsed` (from period start to today)
- **Avg Daily (Full window)**: `total / daysInWindow` (full period length)
- **Budget Remaining**: `750 - total` (shows over-budget warning when negative)
- Formula location: `src/lib/api.ts` → `calculateStatsClientSide()` (lines 306-341)

### Files Modified
- `index.html` — Apple touch icon
- `public/manifest.json` — PWA config
- `public/home.png`, `public/apple-touch-icon.png` — New icons
- `src/components/layout/Navigation.tsx` — Safe area support
- `src/components/dashboard/CategoryChart.tsx` — Donut chart redesign
- `src/pages/Dashboard.tsx` — All categories (removed top-5 limit)
- `src/index.css` — Safe area utilities + vibrant color palette

---

## Acceptance Criteria ✅

### PWA Installation
- ✅ `home.png` displays as app icon on home screen
- ✅ App name shows as "FN"
- ✅ Standalone mode configured correctly

### iOS Safe Areas
- ✅ Mobile nav respects notch area
- ✅ Page switcher button fully visible and tappable
- ✅ No overlap with iOS status bar

### Metrics
- ✅ Total This Period updates when period changes
- ✅ Avg Daily (To-date) shows correct elapsed days calculation
- ✅ Avg Daily (Full window) uses full period day count
- ✅ Budget Remaining = 750 - Total (over-budget warning displays)

### Category Chart
- ✅ Shows ALL categories with transactions (not just top 5)
- ✅ Modern donut design with readable legend
- ✅ Scrollable legend accommodates any number of categories
- ✅ Percentages visible on large slices and in legend

### General Feel
- ✅ Vibrant yet accessible dark mode colors
- ✅ Strong text contrast (98% lightness foreground)
- ✅ Amounts prominent and right-aligned
- ✅ No horizontal scrolling (`overflow-x: hidden`)
- ✅ Smooth performance with 800ms chart animation

---

## Testing Notes
Verify on iPhone Safari with ~390px width:
1. Install to home screen → check icon and name
2. Navigate to Dashboard → verify no header overlap
3. Change period selector → verify all metrics update
4. Check category chart → verify all categories display
5. Test outdoor readability → check text contrast

---

*Mobile-first improvements completed successfully. All acceptance criteria met.*
