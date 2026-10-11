import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fa } from '@/lib/fa/client';
import type { Cat, Feed, NewTx, Tx } from '@/lib/fa/types';
import { registerCategoryIcons } from '@/utils/categoryIcons';

export const FEED_KEY = ['fa-feed'] as const;

/** The whole app reads this one feed; it refreshes every 30 s while visible and on return to the app */
export function useFeed() {
  return useQuery({
    queryKey: FEED_KEY, queryFn: fa.feed,
    refetchInterval: () => (document.visibilityState === 'visible' ? 30_000 : false),
    refetchOnWindowFocus: true, staleTime: 10_000, placeholderData: prev => prev,
    select: (f: Feed) => { registerCategoryIcons(f.categories); return f; },
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
  sn: 'pending-' + Date.now(), date: t.date, time: t.time ?? '', merchant: t.merchant, amount: t.amount, currency: 'BHD',
  category: t.category, tag: t.tag ?? '', name: '-', cardEnding: '', payeeIban: '', source: 'manual' as const }, ...f.transactions] }));

export const useUpdateTx = () => useFeedMutation(({ sn, patch }: { sn: string; patch: Partial<Tx> }) => fa.updateTx(sn, patch),
  (f, { sn, patch }) => ({ ...f, transactions: f.transactions.map(t => (t.sn === sn ? { ...t, ...patch } : t)) }));

export const useDeleteTx = () => useFeedMutation((sn: string) => fa.deleteTx(sn),
  (f, sn) => ({ ...f, transactions: f.transactions.filter(t => t.sn !== sn) }));

export const useMerchantUpdate = () => useFeedMutation(
  ({ from, to, category }: { from: string; to?: string; category?: string }) => fa.merchant(from, to, category),
  (f, { from, to, category }) => ({ ...f, transactions: f.transactions.map(t =>
    t.merchant === from ? { ...t, merchant: to || t.merchant, category: category || t.category } : t) }));

export const useSaveCategory = () => useFeedMutation(
  // The upsert writes every column, so carry the existing budget/icon/order/active along with the change
  async ({ name, color, icon, from, base }: { name: string; color: string; icon?: string; from?: string; base?: Cat }) => {
    if (from && from !== name) await fa.saveCategories([], { from, to: name });
    return fa.saveCategories([{ Name: name, Color: color, Icon: icon ?? base?.icon ?? 'Tag', Budget: base?.budget ?? 0, Order: base?.order ?? 999, Active: base?.active ?? true }]);
  },
  (f, { name, color, icon, from }) => {
    const exists = f.categories.some(c => c.name === (from ?? name));
    const categories = exists
      ? f.categories.map(c => (c.name === (from ?? name) ? { ...c, name, color, icon: icon ?? c.icon } : c))
      : [...f.categories, { id: -Date.now(), name, color, icon: icon ?? 'Tag', budget: 0, order: 999, active: true }];
    const transactions = from && from !== name ? f.transactions.map(t => (t.category === from ? { ...t, category: name } : t)) : f.transactions;
    return { ...f, transactions, categories: categories.sort((a, b) => a.name.localeCompare(b.name)) };
  });

export const useDeleteCategory = () => useFeedMutation((name: string) => fa.deleteCategory(name),
  (f, name) => ({ ...f, categories: f.categories.filter(c => c.name !== name),
    transactions: f.transactions.map(t => (t.category === name ? { ...t, category: 'Other' } : t)) }));

/** Saves edited category budgets together (full rows, so nothing else is reset) */
export const useSaveBudgets = () => useFeedMutation(
  (cats: Cat[]) => fa.saveCategories(cats.map(c => ({ Name: c.name, Color: c.color, Icon: c.icon, Budget: c.budget, Order: c.order, Active: c.active }))),
  (f, cats) => { const m = new Map(cats.map(c => [c.name, c.budget])); return { ...f, categories: f.categories.map(c => (m.has(c.name) ? { ...c, budget: m.get(c.name)! } : c)) }; });

export const useSetSetting = () => useFeedMutation(
  ({ key, value }: { key: string; value: string | number }) => fa.setSetting(key, value),
  (f, { key, value }) => ({ ...f, settings: { ...f.settings, [key]: value } }));
