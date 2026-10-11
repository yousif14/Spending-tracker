import { useMemo, useState } from 'react';
import { LoadError } from '@/components/fa/LoadError';
import { useNavigate } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Bar as RBar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { useFeed } from '@/hooks/useFeed';
import { usePeriod } from '@/state/period';
import { getCurrentPeriodWindow, getPeriodWindow } from '@/utils/period';
import { averages, comparePeriods, lastPeriods, topMerchants, trendByCategory, weekdayHeatmap } from '@/lib/fa/stats';
import { bhd } from '@/lib/fa/money';
import { todayBahrain } from '@/lib/fa/time';
import { Bar } from '@/components/fa/motion';
import { TxRow } from '@/components/fa/TxRow';
import { TxEditSheet } from '@/components/fa/TxEditSheet';
import { CategoryIcon } from '@/utils/categoryIcons';
import type { Tx } from '@/lib/fa/types';

const DAY = 864e5;
const REST = 'Everything else';
const REST_COLOR = 'hsl(var(--muted-foreground) / 0.45)';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const ms = (d: string) => new Date(d + 'T00:00:00Z').getTime();

export default function Stats() {
  const { data, isLoading, isError, refetch } = useFeed();
  const { range, config } = usePeriod();
  const nav = useNavigate();
  const reduce = useReducedMotion();
  const [by, setBy] = useState<'total' | 'count'>('total');
  const [allCats, setAllCats] = useState(false);
  const [editing, setEditing] = useState<Tx | null>(null);

  const view = useMemo(() => {
    if (!data) return null;
    const txs = data.transactions;
    const colors = new Map(data.categories.map(c => [c.name, c.color]));
    // "Last" = the fiscal period before the selected one; for a custom range, the same number of days just before it
    const fiscal = config.mode === 'fiscal' && config.year && config.month;
    const cur = fiscal ? { year: config.year!, month: config.month! } : (() => { const w = getCurrentPeriodWindow(); return { year: w.year, month: w.month }; })();
    let prev: { from: string; to: string };
    if (fiscal) { const p = lastPeriods(cur.year, cur.month, 2)[0]; prev = { from: p.from, to: p.to }; }
    else { const len = ms(range.to) - ms(range.from) + DAY; prev = { from: iso(ms(range.from) - len), to: iso(ms(range.from) - DAY) }; }
    const prevLabel = fiscal ? `${lastPeriods(cur.year, cur.month, 2)[0].label} period` : 'the days before';
    if (!fiscal && config.mode === 'all') prev = { from: '0000-01-01', to: '0000-01-01' };

    const cmp = comparePeriods(txs, range, prev);
    const periods = lastPeriods(cur.year, cur.month, 6);
    const rows = trendByCategory(txs, periods);
    const sixFrom = getPeriodWindow(periods[0].year, periods[0].month).from;
    const top = comparePeriods(txs, { from: sixFrom, to: periods[5].to }, { from: '0', to: '0' }).categories.slice(0, 6).map(c => c.name);
    const trend = rows.map(r => {
      const out: Record<string, number | string> = { label: r.label, total: r.total };
      let rest = 0;
      for (const [k, v] of Object.entries(r)) {
        if (k === 'label' || k === 'total') continue;
        if (top.includes(k)) out[k] = v; else rest += v as number;
      }
      out[REST] = Math.round(rest * 1000) / 1000;
      return out;
    });
    const keys = [...top, REST];
    const heat = weekdayHeatmap(txs, range);
    return {
      cmp, prevLabel, colors, trend, keys, heat, heatMax: Math.max(1, ...heat.map(h => h.total)),
      avg: averages(txs, range, todayBahrain()),
    };
  }, [data, range, config]);
  const merchants = useMemo(() => (data ? topMerchants(data.transactions, range, 10, by) : []), [data, range, by]);

  if (isLoading && !data) return <div className="space-y-4">{[48, 56, 72, 40].map((h, i) => <Skeleton key={i} className="rounded-2xl" style={{ height: h * 4 }} />)}</div>;
  if (isError && !data) return <LoadError what="your stats" onRetry={() => refetch()} />;
  if (!view) return null;
  const { cmp, prevLabel, colors, trend, keys, heat, heatMax, avg } = view;
  const color = (k: string) => k === REST ? REST_COLOR : colors.get(k) ?? '#8A9490';
  const maxMerchant = Math.max(1, ...merchants.map(m => by === 'total' ? m.total : m.count));
  const compareRows = cmp.categories.filter(c => c.current > 0 || c.previous > 0);

  return (
    <div className="space-y-6">
      {/* 1. This period vs last */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-semibold text-muted-foreground">This period vs {prevLabel}</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-[34px] font-extrabold leading-none tracking-tight tnum">{bhd(cmp.total.current)}</span>
          <Delta value={cmp.total.delta} base={cmp.total.previous} />
        </div>
        <p className="mt-1 text-xs font-semibold text-muted-foreground tnum">was {bhd(cmp.total.previous)}</p>
        {compareRows.length > 0 && (
          <ul className="mt-4 space-y-2.5 border-t border-border pt-3">
            {(allCats ? compareRows : compareRows.slice(0, 6)).map(c => (
              <li key={c.name}>
                <button onClick={() => nav(`/activity?cat=${encodeURIComponent(c.name)}`)} className="flex w-full items-center gap-3 text-left">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color(c.name) }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{c.name}</span>
                  <span className="shrink-0 text-right text-sm font-bold tnum">{bhd(c.current)}
                    <span className="block text-[11px] font-semibold text-muted-foreground">was {bhd(c.previous)}</span>
                  </span>
                  <span className="w-[76px] shrink-0 text-right"><Delta value={c.delta} base={c.previous} small /></span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {compareRows.length > 6 && (
          <button onClick={() => setAllCats(v => !v)} className="mt-3 w-full rounded-xl py-2 text-sm font-bold text-primary hover:bg-muted/50">
            {allCats ? 'Show less' : `Show all ${compareRows.length}`}
          </button>
        )}
      </section>

      {/* 2. Six-period trend */}
      <section>
        <h2 className="mb-2 text-sm font-bold">Last 6 periods</h2>
        <div className="rounded-2xl border border-border bg-card p-4 pb-2">
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 4, right: 0, bottom: 0, left: -12 }} barCategoryGap="22%">
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 600 }} />
                <YAxis tickLine={false} axisLine={false} width={44} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={v => `${Math.round(v)}`} />
                <Tooltip isAnimationActive={false} cursor={{ fill: 'hsl(var(--muted) / 0.6)' }} content={<TrendTip color={color} />} />
                {keys.map((k, i) => (
                  <RBar key={k} dataKey={k} stackId="s" fill={color(k)} isAnimationActive={!reduce} animationDuration={250}
                    radius={i === keys.length - 1 ? [5, 5, 0, 0] : 0} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 pb-2">
            {keys.map(k => <span key={k} className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ background: color(k) }} />{k}</span>)}
          </div>
        </div>
      </section>

      {/* 3. Top merchants */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold">Top merchants</h2>
          <div className="flex rounded-full bg-muted p-0.5 text-xs font-bold" role="radiogroup" aria-label="Sort merchants">
            {(['total', 'count'] as const).map(k => (
              <button key={k} role="radio" aria-checked={by === k} onClick={() => setBy(k)}
                className={`rounded-full px-3 py-1 transition-colors ${by === k ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                {k === 'total' ? 'By total' : 'By visits'}
              </button>
            ))}
          </div>
        </div>
        {merchants.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No spending in this period yet.</p> : (
          <ol className="space-y-3 rounded-2xl border border-border bg-card p-4">
            {merchants.map((m, i) => (
              <li key={m.merchant}>
                <button className="w-full text-left" onClick={() => nav(`/activity?q=${encodeURIComponent(m.merchant)}`)}>
                  <span className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-semibold"><span className="mr-2 text-muted-foreground tnum">{i + 1}</span>{m.merchant}</span>
                    <span className="shrink-0 font-bold tnum">{by === 'total' ? bhd(m.total) : `${m.count}×`}
                      <span className="ml-1.5 text-xs font-semibold text-muted-foreground">{by === 'total' ? `${m.count}×` : bhd(m.total)}</span></span>
                  </span>
                  <Bar pct={((by === 'total' ? m.total : m.count) / maxMerchant) * 100} color="hsl(var(--primary))" className="mt-1.5 h-1" />
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* 4. When you spend */}
      <section>
        <h2 className="mb-2 text-sm font-bold">When you spend</h2>
        <div className="grid grid-cols-7 gap-1.5 rounded-2xl border border-border bg-card p-3">
          {heat.map(h => {
            const pct = h.total / heatMax;
            return (
              <div key={h.day} className="min-w-0 text-center">
                <div className="grid aspect-square place-items-center rounded-lg text-[11px] font-bold"
                  style={{ background: `color-mix(in srgb, hsl(var(--primary)) ${Math.round(8 + pct * 82)}%, transparent)`, color: pct > 0.55 ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))' }}
                  title={`${WEEKDAYS[h.day]}: ${bhd(h.total)} BHD, ${h.count} payments`}>
                  {WEEKDAYS[h.day].slice(0, 2)}
                </div>
                <p className="mt-1 truncate text-[10px] font-semibold text-muted-foreground tnum">{h.total ? Math.round(h.total) : '–'}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. Averages */}
      <section>
        <h2 className="mb-2 text-sm font-bold">Averages</h2>
        <div className="grid grid-cols-3 gap-2">
          <Tile label="Per day" value={bhd(avg.perDay)} />
          <Tile label="Per payment" value={bhd(avg.perTx)} />
          <Tile label="Payments" value={String(avg.count)} />
        </div>
        {avg.biggest && (
          <div className="mt-2 rounded-2xl border border-border bg-card p-1">
            <p className="px-3 pt-2 text-xs font-semibold text-muted-foreground">Biggest payment</p>
            <TxRow tx={avg.biggest} color={colors.get(avg.biggest.category)} onClick={() => setEditing(avg.biggest)} />
          </div>
        )}
      </section>
      <TxEditSheet tx={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

/** More spending = up arrow in the danger colour; less = down arrow in the accent */
function Delta({ value, base, small }: { value: number; base: number; small?: boolean }) {
  if (Math.abs(value) < 0.0005) return <span className={`font-semibold text-muted-foreground ${small ? 'text-xs' : 'text-sm'}`}>same</span>;
  const up = value > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  const pct = base > 0 ? `${Math.round(Math.abs(value) / base * 100)}%` : 'new';
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full font-bold tnum ${small ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-sm'}`}
      style={{ color: up ? 'hsl(var(--destructive))' : 'hsl(var(--primary))', background: up ? 'hsl(var(--destructive) / 0.12)' : 'hsl(var(--primary) / 0.12)' }}>
      <Icon className={small ? 'h-3 w-3' : 'h-4 w-4'} />{pct}
    </span>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-3 py-3">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-base font-extrabold tnum">{value}</p>
    </div>
  );
}

function TrendTip({ active, payload, label, color }: TooltipProps<number, string> & { color: (k: string) => string }) {
  if (!active || !payload?.length) return null;
  const items = payload.filter(p => (p.value ?? 0) > 0).reverse();
  const total = items.reduce((s, p) => s + (p.value ?? 0), 0);
  return (
    <div className="min-w-[170px] rounded-xl border border-border bg-popover p-3 text-xs shadow-lg">
      <p className="mb-1.5 flex justify-between font-bold"><span>{label}</span><span className="tnum">{bhd(total)}</span></p>
      {items.map(p => (
        <p key={String(p.dataKey)} className="flex items-center justify-between gap-3 py-0.5">
          <span className="flex min-w-0 items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color(String(p.dataKey)) }} />
            <span className="truncate">{p.dataKey === REST ? REST : <><CategoryIcon categoryName={String(p.dataKey)} className="mr-1 inline h-3 w-3" />{p.dataKey}</>}</span></span>
          <span className="font-semibold tnum">{bhd(p.value ?? 0)}</span>
        </p>
      ))}
    </div>
  );
}
