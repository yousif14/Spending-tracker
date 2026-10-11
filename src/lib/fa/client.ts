// FA App API client — same-origin /api/fa/* (nginx in prod, Vite proxy in dev add the X-FA-Key header)
import type { Feed, NewTx, Tx } from './types';

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/fa/${path}`, body === undefined ? { cache: 'no-store' } : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export const fa = {
  feed: () => call<Feed>('feed'),
  addTx: (t: NewTx) => call<{ success: true; SN: string }>('tx-add', t),
  updateTx: (sn: string, patch: Partial<Tx>) => call('tx-update', { sn, ...patch }),
  deleteTx: (sn: string) => call('tx-delete', { sn }),
  merchant: (from: string, to?: string, category?: string) => call<{ updated: number }>('merchant', { from, to, category }),
  saveCategories: (items: Array<Record<string, unknown>>, rename?: { from: string; to: string }) => call('categories', { items, rename }),
  deleteCategory: (name: string) => call<{ success: true; moved: number }>('category-delete', { name }),
  setSetting: (key: string, value: string | number) => call('settings', { key, value }),
};
