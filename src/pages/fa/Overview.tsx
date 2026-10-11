import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useFeed } from '@/hooks/useFeed';
import { usePeriod } from '@/state/period';
import { applyFilters, EMPTY_FILTER } from '@/lib/fa/filters';
import { categoryTotals, periodSummary, type Status } from '@/lib/fa/summary';
import { bhd } from '@/lib/fa/money';
import { todayBahrain } from '@/lib/fa/time';
import { CategoryIcon } from '@/utils/categoryIcons';
import { Bar, CountUp } from '@/components/fa/motion';
import { TxRow } from '@/components/fa/TxRow';
import { TxEditSheet } from '@/components/fa/TxEditSheet';
import { SwipeRow } from '@/components/fa/SwipeRow';
import { useSwipeDelete } from '@/hooks/useSwipeDelete';
import type { Tx } from '@/lib/fa/types';

export const STATUS_COLOR: Record<Status, string> = {
  good: 'hsl(var(--primary))', warning: 'hsl(var(--warning))', danger: 'hsl(var(--destructive))', none: 'hsl(var(--muted-foreground))',
};

export default function Overview() {
  const { data, isLoading, isError, refetch } = useFeed();
  const { range, config } = usePeriod();
  const nav = useNavigate();
  const [editing, setEditing] = useState<Tx | null>(null);
  const { hidden, remove } = useSwipeDelete();

  const view = useMemo(() => {
    if (!data) return null;
    const budget = Number(data.settings.total_budget ?? 600);
    const s = periodSummary(data.transactions, range, budget, todayBahrain());
    const cats = categoryTotals(data.transactions, range, data.categories);
    const recent = applyFilters(data.transactions.filter(t => !hidden.has(t.sn)), { ...EMPTY_FILTER, from: range.from, to: range.to }).slice(0, 8);
    const colors = new Map(data.categories.map(c => [c.name, c.color]));
    return { s, cats, recent, colors, maxCat: Math.max(1, ...cats.map(c => c.spent)) };
  }, [data, range, hidden]);

  if (isLoading && !data) return <OverviewSkeleton />;
  if (isError && !data) return (
    <div className="py-16 text-center">
      <p className="text-sm text-muted-foreground">Couldn't load your spending.</p>
      <Button className="mt-4" onClick={() => refetch()}>Try again</Button>
    </div>
  );
  if (!view) return null;

  const { s, cats, recent, colors, maxCat } = view;
  const fiscal = config.mode === 'fiscal';
  const forecastStatus: Status = s.forecast > s.budget ? (s.forecast > s.budget * 1.1 ? 'danger' : 'warning') : 'good';

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-semibold text-muted-foreground">Spent this period</p>
        <p className="mt-1 flex items-baseline gap-2">
          <CountUp value={s.spent} className="text-[40px] font-extrabold leading-none tracking-tight tnum" />
          <span className="text-sm font-semibold text-muted-foreground">BHD</span>
        </p>
        {fiscal && (<>
          <Bar pct={s.pctUsed} color={STATUS_COLOR[s.status]} className="mt-4 h-2" />
          <div className="mt-2 flex justify-between text-xs font-semibold text-muted-foreground tnum">
            <span>{Math.round(s.pctUsed)}% of {s.budget}</span>
            <span>{s.daysLeft} {s.daysLeft === 1 ? 'day' : 'days'} left</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3 text-xs">
            <Stat label="Pace" value={`${s.pace.toFixed(1)}/day`} />
            <Stat label="Safe" value={`${s.safeDaily.toFixed(1)}/day`} />
            <Stat label="Forecast" value={bhd(s.forecast)} color={STATUS_COLOR[forecastStatus]} />
          </div>
        </>)}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold">Categories</h2>
        {cats.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No spending in this period yet.</p> : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {cats.map(c => (
              <li key={c.name}>
                <button onClick={() => nav(`/activity?cat=${encodeURIComponent(c.name)}`)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: `${c.color}1f`, color: c.color }}>
                    <CategoryIcon categoryName={c.name} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{c.name}</span>
                      <span className="shrink-0 text-sm font-bold tnum">{bhd(c.spent)}{c.budget > 0 && <span className="font-semibold text-muted-foreground"> / {c.budget}</span>}</span>
                    </span>
                    <Bar pct={c.budget > 0 ? c.pct : (c.spent / maxCat) * 100} color={c.budget > 0 ? STATUS_COLOR[c.status] : c.color} className="mt-1.5 h-1.5" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-bold">Recent</h2>
          <Link to="/activity" className="text-sm font-semibold text-primary">See all</Link>
        </div>
        {recent.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Nothing yet. Tap + to add a payment.</p> : (
          <div className="rounded-2xl border border-border bg-card p-1">
            {recent.map(t => (
              <SwipeRow key={t.sn} surface="bg-card" onEdit={() => setEditing(t)} onDelete={() => remove(t)} disabled={t.sn.startsWith('pending-')}>
                <TxRow tx={t} color={colors.get(t.category)} onClick={() => setEditing(t)} />
              </SwipeRow>
            ))}
          </div>
        )}
      </section>
      <TxEditSheet tx={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-bold tnum" style={color ? { color } : undefined}>{value}</p>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-48 rounded-2xl" />
      <div className="space-y-2">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
    </div>
  );
}
