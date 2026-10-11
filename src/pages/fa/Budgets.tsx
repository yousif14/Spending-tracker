import { useEffect, useMemo, useState } from 'react';
import { LoadError } from '@/components/fa/LoadError';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useFeed, useSaveBudgets, useSetSetting } from '@/hooks/useFeed';
import { usePeriod } from '@/state/period';
import { categoryTotals } from '@/lib/fa/summary';
import { bhd, parseAmount } from '@/lib/fa/money';
import { CategoryIcon } from '@/utils/categoryIcons';
import { Bar, EASE_OUT } from '@/components/fa/motion';
import { STATUS_COLOR } from '@/pages/fa/Overview';
import { statusOf } from '@/lib/fa/summary';

const show = (n: number) => (n > 0 ? String(n) : '');

export default function Budgets() {
  const { data, isLoading, isError, refetch } = useFeed();
  const { range } = usePeriod();
  const saveBudgets = useSaveBudgets();
  const setSetting = useSetSetting();
  const [total, setTotal] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const serverTotal = Number(data?.settings.total_budget ?? 600);
  useEffect(() => { setTotal(show(serverTotal)); }, [serverTotal]);

  const rows = useMemo(() => {
    if (!data) return [];
    const spent = new Map(categoryTotals(data.transactions, range, data.categories).map(c => [c.name, c.spent]));
    return [...data.categories].filter(c => c.active).sort((a, b) => a.name.localeCompare(b.name))
      .map(c => ({ cat: c, spent: spent.get(c.name) ?? 0 }));
  }, [data, range]);

  if (isLoading && !data) return <div className="space-y-2"><Skeleton className="h-32 rounded-2xl" />{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>;

  if (isError && !data) return <LoadError what="your budgets" onRetry={() => refetch()} />;
  const valueOf = (name: string, server: number) => (name in drafts ? parseAmount(drafts[name]) : server);
  const changed = rows.filter(r => r.cat.name in drafts && parseAmount(drafts[r.cat.name]) !== r.cat.budget);
  const sumCats = rows.reduce((s, r) => s + valueOf(r.cat.name, r.cat.budget), 0);
  const totalNum = parseAmount(total);

  const saveTotal = () => {
    if (totalNum === serverTotal) return;
    if (totalNum <= 0) { setTotal(show(serverTotal)); return; }
    setSetting.mutate({ key: 'total_budget', value: totalNum }, {
      onSuccess: () => toast.success(`Monthly budget is ${bhd(totalNum)} BHD`),
      onError: () => { toast.error("Couldn't save the budget. Try again."); setTotal(show(serverTotal)); },
    });
  };
  const saveAll = () => {
    const cats = changed.map(r => ({ ...r.cat, budget: parseAmount(drafts[r.cat.name]) }));
    saveBudgets.mutate(cats, {
      onSuccess: () => toast.success(cats.length === 1 ? 'Budget saved' : `${cats.length} budgets saved`),
      onError: () => toast.error("Couldn't save the budgets. Try again."),
    });
    setDrafts({});
  };

  return (
    <div className="space-y-6 pb-20">
      <section className="rounded-2xl border border-border bg-card p-5">
        <label htmlFor="total-budget" className="text-sm font-semibold text-muted-foreground">Monthly budget</label>
        <div className="mt-1 flex items-baseline gap-2 border-b-2 border-border focus-within:border-primary">
          <input id="total-budget" inputMode="decimal" value={total} onChange={e => setTotal(e.target.value.replace(/[^\d.,]/g, ''))}
            onBlur={saveTotal} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className="w-full min-w-0 bg-transparent py-1 text-[34px] font-extrabold leading-none tracking-tight tnum outline-none" />
          <span className="text-sm font-semibold text-muted-foreground">BHD</span>
        </div>
        <p className="mt-3 text-sm text-muted-foreground tnum">
          Category budgets add up to <b className="text-foreground">{bhd(sumCats)}</b> of your <b className="text-foreground">{bhd(totalNum)}</b> total
          {sumCats > totalNum && totalNum > 0 && <span className="font-semibold text-destructive">, {bhd(sumCats - totalNum)} over</span>}.
        </p>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-bold">Per category</h2>
        <p className="mb-2 text-xs text-muted-foreground">Leave empty for no budget. Spent is for the selected period.</p>
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {rows.map(({ cat, spent }) => {
            const budget = valueOf(cat.name, cat.budget);
            const pct = budget > 0 ? (spent / budget) * 100 : 0;
            return (
              <li key={cat.name} className="flex items-center gap-3 px-4 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border-[1.5px]" style={{ borderColor: cat.color, color: cat.color }}>
                  <CategoryIcon categoryName={cat.name} className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-bold">{cat.name}</span>
                    <span className="shrink-0 text-xs font-semibold text-muted-foreground tnum">{bhd(spent)}{budget > 0 && ` · ${Math.round(pct)}%`}</span>
                  </span>
                  <Bar pct={budget > 0 ? pct : 0} color={STATUS_COLOR[statusOf(pct, budget > 0)]} className="mt-1.5 h-1.5" />
                </span>
                <input inputMode="decimal" aria-label={`${cat.name} budget`} placeholder="–"
                  value={cat.name in drafts ? drafts[cat.name] : show(cat.budget)}
                  onChange={e => setDrafts(d => ({ ...d, [cat.name]: e.target.value.replace(/[^\d.,]/g, '') }))}
                  className="h-10 w-[84px] shrink-0 rounded-lg border border-input bg-background px-2 text-right text-base font-bold tnum outline-none focus:border-primary" />
              </li>
            );
          })}
        </ul>
      </section>

      <AnimatePresence>
        {changed.length > 0 && (
          <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }} transition={{ duration: 0.2, ease: EASE_OUT }}
            className="fixed left-4 right-[92px] z-30" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
            <div className="flex gap-2 rounded-2xl border border-border bg-card p-2 shadow-lg">
              <Button variant="ghost" className="font-bold" onClick={() => setDrafts({})}>Discard</Button>
              <Button className="flex-1 font-bold" onClick={saveAll}>Save {changed.length === 1 ? '1 budget' : `${changed.length} budgets`}</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
