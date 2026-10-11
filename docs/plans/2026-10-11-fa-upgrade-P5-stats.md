# FA Upgrade P5 — Stats, Budgets, Categories, wrap-up

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Read the index first. P4 must be live.
> Load the **dataviz** skill before writing chart code. Keep using the design skills from the index: **redesign-existing-projects** / **minimalist-ui** for layout, and **design-motion-principles** (Create mode) for chart entry, `Reorder` drag and sheet motion.

**Phase start:** `node n8n/scripts/backup.mjs` → add a "P5 start" row to `docs/plans/backup-log.md`. Tag the running image `pre-p5`.
**Phase end:** add a "P5 end, rollback point" row. Then take a **second whole-volume n8n backup**, as in P0 Task 0.4, into `C:\Data\FA-baseline\post-upgrade-<date>\`, so the finished system also has a disaster backup. **Keep the 2026-10-11 baseline.**
**Undo:** `docs/ROLLBACK.md`, rows P4/P5.

**Goal:** Add the Stats screen (period comparison, 6-period trend, top merchants, weekday heatmap, averages), the Budgets editor, the Categories manager and Settings. Then remove the old UI, lock the legacy webhooks, and deploy and verify.

---

### Task 1: Stats library (TDD)

**Files:**
- Create: `src/lib/fa/stats.ts`
- Test: `src/lib/fa/stats.test.ts`

**Step 1: Failing test**
```ts
import { describe, it, expect } from 'vitest';
import { lastPeriods, comparePeriods, trendByCategory, topMerchants, weekdayHeatmap, averages } from './stats';
import type { Tx } from './types';
const tx = (date: string, amount: number, category: string, merchant = 'M'): Tx =>
  ({ sn: date + merchant + amount, date, time: '', merchant, amount, currency: 'BHD', category, tag: '', name: '', cardEnding: '', payeeIban: '', source: 'sms' });
const T = [tx('2026-09-25', 100, 'Food', 'JASMIS'), tx('2026-10-05', 50, 'Food', 'JASMIS'), tx('2026-10-10', 30, 'Baby', 'MUMZ'),
  tx('2026-08-30', 40, 'Food', 'LULU'), tx('2026-09-01', 20, 'Baby', 'MUMZ')];

describe('lastPeriods', () => {
  it('returns N fiscal windows ending with the given one, oldest first', () => {
    const p = lastPeriods(2026, 10, 3);
    expect(p.map(x => x.from)).toEqual(['2026-07-23', '2026-08-23', '2026-09-23']);
    expect(p[2]).toMatchObject({ to: '2026-10-22', label: 'Oct' });
  });
});
describe('comparePeriods', () => {
  it('delta per category vs previous period', () => {
    const r = comparePeriods(T, { from: '2026-09-23', to: '2026-10-22' }, { from: '2026-08-23', to: '2026-09-22' });
    expect(r.total).toEqual({ current: 180, previous: 60, delta: 120 });
    expect(r.categories.find(c => c.name === 'Food')).toMatchObject({ current: 150, previous: 40, delta: 110 });
  });
});
describe('trendByCategory', () => {
  it('one row per period with category keys', () => {
    const rows = trendByCategory(T, lastPeriods(2026, 10, 2));
    expect(rows).toEqual([{ label: 'Sep', total: 60, Food: 40, Baby: 20 }, { label: 'Oct', total: 180, Food: 150, Baby: 30 }]);
  });
});
describe('topMerchants', () => {
  it('by total with count', () => expect(topMerchants(T, { from: '2026-08-01', to: '2026-12-31' }, 2)).toEqual([
    { merchant: 'JASMIS', total: 150, count: 2 }, { merchant: 'MUMZ', total: 50, count: 2 }]));
});
describe('weekdayHeatmap', () => {
  it('sums by weekday (0=Sun)', () => {
    const h = weekdayHeatmap(T, { from: '2026-09-23', to: '2026-10-22' });
    expect(h).toHaveLength(7);
    expect(h[5].total).toBe(100);   // 2026-09-25 is a Friday
  });
});
describe('averages', () => {
  it('per day and per transaction', () => {
    const a = averages(T, { from: '2026-09-23', to: '2026-10-22' }, '2026-10-11');
    expect(a.perTx).toBe(60);
    expect(a.perDay).toBeCloseTo(180 / 19, 3);
  });
});
```
Run `npx vitest run src/lib/fa/stats.test.ts`. Expected: FAIL.

**Step 2: Implement**
```ts
import { getPeriodWindow } from '@/utils/period';
import type { Tx } from './types';
import { inRange, periodSummary } from './summary';
type Range = { from: string; to: string };
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function lastPeriods(year: number, month: number, n: number) {
  const out: Array<Range & { label: string; year: number; month: number }> = [];
  for (let i = n - 1; i >= 0; i--) {
    let m = month - i, y = year; while (m < 1) { m += 12; y--; }
    const w = getPeriodWindow(y, m);
    out.push({ from: w.from, to: w.to, label: MONTHS[m - 1], year: y, month: m });
  }
  return out;
}
const sumBy = (txs: Tx[], r: Range) => { const m = new Map<string, number>(); for (const t of txs) if (inRange(t, r)) m.set(t.category, (m.get(t.category) || 0) + t.amount); return m; };

export function comparePeriods(txs: Tx[], cur: Range, prev: Range) {
  const a = sumBy(txs, cur), b = sumBy(txs, prev);
  const names = [...new Set([...a.keys(), ...b.keys()])];
  const categories = names.map(name => ({ name, current: r3(a.get(name) || 0), previous: r3(b.get(name) || 0), delta: r3((a.get(name) || 0) - (b.get(name) || 0)) }))
    .sort((x, y) => y.current - x.current);
  const c = r3([...a.values()].reduce((s, v) => s + v, 0)), p = r3([...b.values()].reduce((s, v) => s + v, 0));
  return { total: { current: c, previous: p, delta: r3(c - p) }, categories };
}

export function trendByCategory(txs: Tx[], periods: Array<Range & { label: string }>) {
  return periods.map(p => { const m = sumBy(txs, p); const row: Record<string, number | string> = { label: p.label, total: 0 };
    for (const [k, v] of m) { row[k] = r3(v); row.total = r3((row.total as number) + v); } return row; });
}

export function topMerchants(txs: Tx[], r: Range, n = 10) {
  const m = new Map<string, { merchant: string; total: number; count: number }>();
  for (const t of txs) if (inRange(t, r)) { const k = t.merchant.toUpperCase(); const e = m.get(k) ?? { merchant: k, total: 0, count: 0 }; e.total = r3(e.total + t.amount); e.count++; m.set(k, e); }
  return [...m.values()].sort((a, b) => b.total - a.total).slice(0, n);
}

export function weekdayHeatmap(txs: Tx[], r: Range) {
  const out = Array.from({ length: 7 }, (_, d) => ({ day: d, total: 0, count: 0 }));
  for (const t of txs) if (inRange(t, r)) { const d = new Date(t.date + 'T12:00:00Z').getUTCDay(); out[d].total = r3(out[d].total + t.amount); out[d].count++; }
  return out;
}

export function averages(txs: Tx[], r: Range, today: string) {
  const inR = txs.filter(t => inRange(t, r));
  const s = periodSummary(txs, r, 0, today);
  return { perDay: s.pace, perTx: inR.length ? r3(s.spent / inR.length) : 0, count: inR.length, biggest: inR.reduce<Tx | null>((b, t) => (!b || t.amount > b.amount ? t : b), null) };
}
```
Run the test. Expected: PASS. If `lastPeriods` labels don't match the fiscal convention in `getPeriodWindow` (the period that *ends* in month M is labelled M), align the test and label with how `getCurrentPeriodWindow` names periods. Commit.

### Task 2: Stats page

**Files:**
- Create: `src/pages/fa/Stats.tsx`
- Modify: `src/App.tsx` (route `/stats` → `Stats`)

**Sections** (Recharts is already a dependency; colours come from category `color`; axis and label text use `hsl(var(--muted-foreground))`):
1. **This period vs last:** big total with a delta chip (↑ in danger colour, ↓ in good colour), then per-category rows with current, previous and a delta chip.
2. **6-period trend:** a stacked `BarChart` from `trendByCategory(feed.transactions, lastPeriods(y, m, 6))`. It shows the top 5 categories plus "Other" for the rest. The tooltip lists amounts with `bhd()`.
3. **Top merchants:** a toggle between "By total" and "By visits" (sort by count), top 10 with thin bars.
4. **When you spend:** a 7-cell weekday strip (Sun–Sat) whose cell intensity is a mix of the accent colour by total, with the amount label under each cell.
5. **Averages:** per day, per transaction, transaction count and the biggest purchase (tap opens the edit sheet).

Charts animate in on mount (Recharts `isAnimationActive`; off when `useReducedMotion()` is true). The period comes from the global pill, and "last" means the period before it.

**Step 1:** Implement it. **Step 2:** Visual check in both themes at 390px; no chart overflows horizontally. **Step 3:** Commit.

### Task 3: Budgets page

**Files:**
- Create: `src/pages/fa/Budgets.tsx`
- Add a hook: `useSaveCategories` and `useSetSetting` in `src/hooks/useFeed.ts` (optimistic, same pattern as Task 4 in P4)

**Content:**
- **Total monthly budget:** a number input saved on blur through `fa.setSetting('total_budget', value)`.
- One row per active category: icon, name, this period's spent, a `<Bar>`, and a budget input (BHD, 3 decimals; empty = no budget). Changed rows are saved together with a "Save budgets" button through `fa.saveCategories(changed.map(c => ({ id: c.id, Name: c.name, Color: c.color, Icon: c.icon, Budget: c.budget, Order: c.order, Active: c.active })))`.
- A hint line: "Category budgets add up to 520.000 of your 600.000 total."

Commit.

### Task 4: Categories manager

**Files:**
- Create: `src/pages/fa/Categories.tsx`

**Content:**
- The list in `order`, drag to reorder with framer-motion `Reorder.Group`/`Reorder.Item`. Saving sends all items with the new `Order`.
- Tapping a row opens a sheet with: name, a colour swatch picker (12 preset Calm Ledger colours plus hex input), an icon picker (about 30 lucide icons, rendered through `categoryIcons.tsx` extended to look up icons by name), and an Active switch.
- **Renaming** sends `fa.saveCategories([item], { from: oldName, to: newName })`, which also renames past transactions and Cat-list entries. The sheet first says: "Renaming updates 248 past transactions." (count from the feed).
- **Add category** button at the bottom. The new category goes to the end of the list. It also shows up in the Telegram picker straight away, because P2 reads the same table.
- Hide instead of delete: Active off removes the category from pickers and keeps its history.

Update `src/utils/categoryIcons.tsx` so `getCategoryIcon` checks the feed's `icon` name first (a map of lucide names to components) and falls back to the current name-based map.

Commit.

### Task 5: Settings page

**Files:**
- Create: `src/pages/fa/Settings.tsx` (replaces the old route target)

**Content:** theme (System / Light / Dark), the period anchor day (read-only "23rd", for information), "Last synced HH:MM" plus a Refresh button, the app version (`import.meta.env.VITE_APP_VERSION`, set in `vite.config.ts` `define` from `package.json` version, bumped to `2.0.0`), and an "Install app" button when the `beforeinstallprompt` event is available.

Commit.

### Task 6: Remove old UI and dead code

**Step 1:** Run `grep` for imports of each candidate. Delete the files only when nothing imports them:
- `src/pages/Transactions.tsx`, `src/pages/Budget.tsx`, `src/pages/Categories.tsx`, `src/pages/Merchants.tsx`, `src/pages/Settings.tsx` (old)
- `src/components/dashboard/*`, `src/components/transactions/*`, `src/components/budget/*`, `src/components/DateRangeSelector.tsx`
- `src/hooks/useApi.ts`, `src/lib/api.ts`
- keep `src/lib/budgetAnalytics.ts` and its test **only if** something still imports them; otherwise delete both
- `src/types/index.ts` (if unused)

**Step 2:** Run `npx vitest run` and `npm run build`. Both must pass. Commit: `git commit -am "chore: remove legacy UI and API client"`

### Task 7: Lock the legacy webhooks (needs user approval)

The old app was the only caller of FA - Get, FA - Update Transaction, FA - Merchant and `manualAddTransaction`. Joseph and Smart Search read the tables directly.

**Step 1:** Ask the user: "The new app no longer uses the old webhooks. Deactivate *FA - Get*, *FA - Update Transaction* and *FA - Merchant*, and require the key on `manualAddTransaction`?" Default answer: yes.

**Step 2 (after yes):** Back up, then `POST /workflows/{id}/deactivate` for the three workflows. Patch the `Webhook` node (`manualAddTransaction`) in `I3EaJw8o1YNfkleN` to `authentication: headerAuth` with the FA App Key credential.

**Step 3:** Verify: `curl -s -o /dev/null -w "%{http_code}" https://n8n.11homelab.cc/webhook/api/transactions` → 404. The app still works.

### Task 8: Final deploy and live verification

**Step 1:** `npx vitest run` passes. `npm run build` passes. `npm run lint` has no errors in the new code.

**Step 1b:** Run the final **design-motion-principles Audit** across the whole app (save `docs/plans/p5-motion-audit.html`) and the **design-taste-frontend** pre-flight check on Stats, Budgets and Categories. Fix the high-severity items, and share the report artifact with the user.

**Step 2:** `docker compose -f financial-composer.yaml up -d --build financial-app`

**Step 3:** Live checks:
- `curl -s http://localhost:3002/ | grep -o '<title>[^<]*'` → `<title>FA`
- `docker exec financial-app sh -c "grep -rl X-FA-Key /usr/share/nginx/html || echo clean"` → `clean`
- Ask the user to open https://fa.11homelab.cc, pull to refresh and confirm the version `2.0.0` in Settings
- The user confirms: Stats charts render, a budget edit sticks after a reload, a new category appears in the Telegram picker on the next new merchant

**Step 4:** Update `docs/SYSTEM-MAP.md` to the final architecture: App API endpoints, tables, the Telegram callbacks, security. Remove the fixed items from Known issues. Update the memory file `finance-app-backend.md` if anything material changed.

**Step 5:** Commit. Use superpowers:finishing-a-development-branch to decide on merging `fa-upgrade` into `main` and pushing. Ask the user; never push without approval.
