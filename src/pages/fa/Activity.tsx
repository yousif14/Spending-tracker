import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useFeed } from '@/hooks/useFeed';
import { usePeriod } from '@/state/period';
import { applyFilters, EMPTY_FILTER, groupByDay, type TxFilter } from '@/lib/fa/filters';
import { bhd } from '@/lib/fa/money';
import type { Tx } from '@/lib/fa/types';
import { FilterBar } from '@/components/fa/FilterBar';
import { TxRow } from '@/components/fa/TxRow';
import { TxEditSheet } from '@/components/fa/TxEditSheet';
import { listItem } from '@/components/fa/motion';
import { SwipeRow } from '@/components/fa/SwipeRow';
import { useSwipeDelete } from '@/hooks/useSwipeDelete';

const PAGE = 150;   // rows rendered at a time — keeps "All time" (2,000+ rows) light on phones
const dayLabel = (d: string) => format(new Date(d + 'T00:00:00'), 'EEE d MMM');

export default function Activity() {
  const { data, isLoading, isError, refetch } = useFeed();
  const { range } = usePeriod();
  const [params] = useSearchParams();
  const [filter, setFilter] = useState<TxFilter>(() => {
    const cat = params.get('cat'), q = params.get('q');
    return { ...EMPTY_FILTER, categories: cat ? [cat] : [], search: q ?? '' };
  });
  const [editing, setEditing] = useState<Tx | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const { hidden, remove } = useSwipeDelete();
  useEffect(() => setLimit(PAGE), [filter, range]);

  // New-row highlight: SNs not in the previous feed (after the first load) glow for 2 s
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!data) return;
    const sns = new Set(data.transactions.map(t => t.sn));
    if (seen.current) {
      const added = [...sns].filter(sn => !seen.current!.has(sn) && !sn.startsWith('pending-'));
      if (added.length) { setFresh(new Set(added)); const t = setTimeout(() => setFresh(new Set()), 2000); seen.current = sns; return () => clearTimeout(t); }
    }
    seen.current = sns;
  }, [data]);

  const view = useMemo(() => {
    if (!data) return null;
    const list = applyFilters(data.transactions.filter(t => !hidden.has(t.sn)), { ...filter, from: range.from, to: range.to });
    const shown = list.slice(0, limit);
    return { list, shown, groups: filter.sort === 'amount' ? null : groupByDay(shown), total: list.reduce((s, t) => s + t.amount, 0),
      colors: new Map(data.categories.map(c => [c.name, c.color])), cats: data.categories.filter(c => c.active) };
  }, [data, filter, range, limit, hidden]);

  if (isLoading && !data) return <div className="space-y-2">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>;
  if (isError && !data) return (
    <div className="py-16 text-center">
      <p className="text-sm text-muted-foreground">Couldn't load transactions.</p>
      <Button className="mt-4" onClick={() => refetch()}>Try again</Button>
    </div>
  );
  if (!view) return null;

  const row = (t: Tx) => (
    <motion.div key={t.sn} layout="position" {...listItem}>
      <SwipeRow onEdit={() => setEditing(t)} onDelete={() => remove(t)} disabled={t.sn.startsWith('pending-')}>
        <TxRow tx={t} color={view.colors.get(t.category)} highlight={fresh.has(t.sn)} onClick={() => setEditing(t)} />
      </SwipeRow>
    </motion.div>
  );

  return (
    <div>
      <FilterBar filter={filter} onChange={setFilter} cats={view.cats} />
      <p className="mb-2 mt-1 text-xs font-semibold text-muted-foreground tnum">
        {view.list.length} {view.list.length === 1 ? 'transaction' : 'transactions'} · {bhd(view.total)} BHD
      </p>
      {view.list.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground">No transactions match.</p>
          <Button variant="ghost" className="mt-2" onClick={() => setFilter(EMPTY_FILTER)}>Clear filters</Button>
        </div>
      ) : view.groups ? (
        view.groups.map(g => (
          <section key={g.date} className="mb-3">
            <h3 className="sticky top-[calc(var(--fa-header-h,0px)+var(--fa-filter-h,0px))] z-10 flex justify-between bg-background px-2 py-1.5 text-xs font-bold text-muted-foreground backdrop-blur tnum">
              <span>{dayLabel(g.date)}</span><span>{bhd(g.total)}</span>
            </h3>
            <AnimatePresence initial={false}>{g.items.map(row)}</AnimatePresence>
          </section>
        ))
      ) : (
        <AnimatePresence initial={false}>{view.shown.map(row)}</AnimatePresence>
      )}
      {view.shown.length < view.list.length && (
        <Button variant="outline" className="mt-2 w-full" onClick={() => setLimit(l => l + PAGE)}>
          Show more ({view.list.length - view.shown.length} left)
        </Button>
      )}
      <TxEditSheet tx={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
