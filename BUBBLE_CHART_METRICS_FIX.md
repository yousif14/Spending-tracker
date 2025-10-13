# Bubble Chart & Metrics Fix

## Summary
Implemented a deterministic circle-packing algorithm to replace the problematic spiral approach, and added Asia/Bahrain timezone support for accurate metrics calculations.

## Circle-Packing Algorithm

### Approach
The new implementation uses a **greedy circle-packing algorithm** that places bubbles from largest to smallest:

1. **Sort by size**: Bubbles are sorted in descending order by radius (largest first)
2. **Place first bubble**: The largest bubble is placed at the center (width/2, height/2)
3. **Place remaining bubbles**: Each subsequent bubble is placed as close as possible to the center of mass of already-placed bubbles
4. **Collision detection**: For each bubble, we search in expanding circles (16 points per radius increment) to find the closest valid position
5. **Center the layout**: After all bubbles are placed, the entire layout is centered within the viewBox by calculating bounds and applying a shift

### Sizing Formula
Bubble radius is calculated using square root scaling for better visual proportion:

```typescript
radius = minRadius + (maxRadius - minRadius) * √(amount / maxAmount)
```

Where:
- `minRadius = 25px` - ensures small categories remain visible
- `maxRadius = 80px` - prevents bubbles from dominating the view
- Square root scaling prevents the largest category from overwhelming others

### Key Features
- **No overlaps**: Guaranteed 5px padding between all bubbles
- **Deterministic**: Same data produces same layout (stable order)
- **Centered**: Layout is automatically centered within the SVG viewBox
- **Efficient**: Searches for valid positions systematically using radial expansion

## Label Placement Rules

### Text Fitting Logic
Labels are only shown inside bubbles when they fit comfortably:

```typescript
// Estimate text width (rough approximation: 6px per character for 10px font)
const fontSize = bubble.radius > 50 ? 12 : 10;
const estimatedTextWidth = Math.max(
  categoryText.length * (fontSize * 0.6),
  percentText.length * (fontSize * 0.6)
);
const textFitsInCircle = estimatedTextWidth < bubble.radius * 1.6; // Diameter with padding
```

### Fallback Rules
- **Large bubbles (radius > 50px)**: Show full label with 12px font
- **Medium bubbles (radius 35-50px)**: Show label with 10px font if text fits
- **Small bubbles (radius < 35px)**: No inline label, show tooltip on hover/tap
- **All bubbles**: Interactive hover tooltip with full category name and amount

### Label Content
When shown, labels display:
- **Line 1**: Category name (truncated to 12 chars if needed)
- **Line 2**: Percentage of total (e.g., "23.5%")

## Dashboard Metrics Formulas

All metrics now respect the selected date window and use **Asia/Bahrain timezone** for "today" calculations.

### Total This Period
```typescript
total = sum(transactions where date >= from AND date <= to)
```

### Average Daily (To-date)
```typescript
// Get current date in Bahrain timezone
const nowInBahrain = new Date().toLocaleString('en-US', { timeZone: 'Asia/Bahrain' });
const today = new Date(nowInBahrain);
const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

// Calculate elapsed days
const effectiveEndDate = min(todayDateOnly, periodEnd);
const daysElapsed = 1 + floor((effectiveEndDate - periodStart) / 86400000);

// Calculate average
avgDailyToDate = total / max(1, daysElapsed);
```

**Note**: If the period is entirely in the past, uses the full period end date.

### Average Daily (Full window)
```typescript
const daysInWindow = 1 + floor((periodEnd - periodStart) / 86400000);
avgDailyFull = total / daysInWindow;
```

### Budget Remaining
```typescript
budgetRemaining = 750 - total;
// Displays in red with warning when negative
```

### Formatting
All amounts are formatted with **3 decimal places** using the `formatBHD()` utility:
```typescript
formatBHD(amount) => `BD ${amount.toFixed(3)}`
```

## Legend & Validation

### Legend Display
- Shows total amount for the period: `{count} categories • BD {total}`
- Each category shows: color dot, name, and percentage
- Percentages use `.toFixed(1)` which may cause minor rounding (sum ≈ 100%)

### Percentage Calculation
```typescript
percentage = (categoryAmount / total * 100).toFixed(1);
```

The sum of percentages may be 99.9% or 100.1% due to rounding, which is acceptable.

## Performance & Accessibility

### Performance
- **Smooth animations**: CSS transitions for hover effects
- **No jank**: Circle-packing algorithm runs in useMemo, only recalculates when data changes
- **Efficient collision detection**: Uses distance formula (no complex geometry)

### Accessibility
- **Touch-friendly**: All bubbles respond to both mouse and touch events
- **Hover tooltips**: Show full information for small bubbles
- **Interactive legend**: Hovering legend items highlights corresponding bubbles
- **Color contrast**: White text with shadow on colored bubbles for readability

## PWA Icon Configuration

The PWA is already configured with proper icons from Session 1:
- `home.png` - Used for manifest icons (192x192 and 512x512)
- `apple-touch-icon.png` - Used for iOS home screen
- App name: **FN** (configured in manifest.json and index.html)

## Testing Recommendations

### Visual Testing
1. **Mobile (~390px)**: Verify bubbles don't overlap, layout is centered, labels are readable
2. **Desktop**: Verify smooth hover effects, tooltips work correctly
3. **Dark/Light mode**: Verify color contrast and readability

### Metrics Testing
1. **Current period**: Verify "To-date" average uses today's date in Bahrain time
2. **Past period**: Verify metrics use full window when period is entirely past
3. **Date change**: Verify all metrics update when changing date range
4. **Budget**: Verify over-budget state shows red warning

### Data Validation
1. **Legend totals**: Verify percentages sum to ~100% (allow ±0.2% rounding)
2. **Tile vs chart**: Verify "Total This Period" matches chart legend total
3. **Categories**: Verify all categories appear in both chart and legend
4. **Colors**: Verify colors match across chart bubbles, legend, and transaction chips

## Files Modified

### [src/components/dashboard/CategoryChart.tsx](src/components/dashboard/CategoryChart.tsx)
- Lines 38-130: Replaced spiral packing with deterministic circle-packing algorithm
- Lines 154-219: Improved label fitting logic with text bounds checking
- Added helper functions: `isValidPosition()`, `findClosestPosition()`
- Added layout centering logic after packing

### [src/lib/api.ts](src/lib/api.ts#L306-L347)
- Lines 318-323: Added Asia/Bahrain timezone support for "today" calculation
- Ensures metrics respect Bahrain business day when calculating elapsed time
