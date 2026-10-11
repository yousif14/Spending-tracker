import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fa } from '@/lib/fa/client';
import type { Feed, NewTx, Tx } from '@/lib/fa/types';

export const FEED_KEY = ['fa-feed'] as const;

/** The whole app reads this one feed; it refreshes every 30 s while visible and on return to the app */
export function useFeed() {
  return useQuery({
    queryKey: FEED_KEY, queryFn: fa.feed,
    refetchInterval: () => (document.visibilityState === 'visible' ? 30_000 : false),
    refetchOnWindowFocus: true, staleTime: 10_000, placeholderData: prev => prev,
  });
}

function useFeedMutation<V>(fn: (v: V) => Promise<unknown>, apply: (f: Feed, v: V) => Feed) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onMutate: async (v: V) => {
      await qc.cancelQueries({ queryKey: FEED_KEY });
      const prev = qc.getQueryData<Feed>(FEED_KEY);
      if (prev) qc.setQueryData<Feed>(FEED_KEY, apply(prev, v));
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(FEED_KEY, ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: FEED_KEY }),
  });
}

export const useAddTx = () => useFeedMutation((t: NewTx) => fa.addTx(t), (f, t) => ({ ...f, transactions: [{
  sn: 'pending-' + Date.now(), date: t.date, time: t.time, merchant: t.merchant, amount: t.amount, currency: 'BHD',
  category: t.category, tag: t.tag ?? '', name: '-', cardEnding: '', payeeIban: '', source: 'manual' as const }, ...f.transactions] }));

export const useUpdateTx = () => useFeedMutation(({ sn, patch }: { sn: string; patch: Partial<Tx> }) => fa.updateTx(sn, patch),
  (f, { sn, patch }) => ({ ...f, transactions: f.transactions.map(t => (t.sn === sn ? { ...t, ...patch } : t)) }));

export const useDeleteTx = () => useFeedMutation((sn: string) => fa.deleteTx(sn),
  (f, sn) => ({ ...f, transactions: f.transactions.filter(t => t.sn !== sn) }));

export const useMerchantUpdate = () => useFeedMutation(
  ({ from, to, category }: { from: string; to?: string; category?: string }) => fa.merchant(from, to, category),
  (f, { from, to, category }) => ({ ...f, transactions: f.transactions.map(t =>
    t.merchant === from ? { ...t, merchant: to || t.merchant, category: category || t.category } : t) }));
