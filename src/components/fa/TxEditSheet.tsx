import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useDeleteTx, useFeed, useMerchantUpdate, useUpdateTx } from '@/hooks/useFeed';
import { searchMerchants } from '@/lib/fa/merchantSearch';
import { parseAmount } from '@/lib/fa/money';
import type { Tx } from '@/lib/fa/types';
import { CategoryChips } from './CategoryChips';
import { DateField } from './DateField';

export function TxEditSheet({ tx: txProp, onClose }: { tx: Tx | null; onClose: () => void }) {
  // keep rendering the last row while the drawer animates closed
  const last = useRef(txProp);
  if (txProp) last.current = txProp;
  const tx = txProp ?? last.current;
  const { data } = useFeed();
  const update = useUpdateTx();
  const merchantUpdate = useMerchantUpdate();
  const del = useDeleteTx();
  const [f, setF] = useState({ date: '', time: '', merchant: '', amount: '', category: '', tag: '' });
  const [applyAll, setApplyAll] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!txProp) return;
    setF({ date: txProp.date, time: txProp.time, merchant: txProp.merchant, amount: String(txProp.amount), category: txProp.category, tag: txProp.tag });
    setApplyAll(false); setConfirmDelete(false);
  }, [txProp]);

  const cats = useMemo(() => (data?.categories ?? []).filter(c => c.active), [data?.categories]);
  const sameMerchant = useMemo(() => (tx ? (data?.transactions ?? []).filter(t => t.merchant === tx.merchant).length : 0), [data?.transactions, tx]);
  const suggestions = useMemo(() => (tx && f.merchant !== tx.merchant ? searchMerchants(data?.merchants ?? [], f.merchant, 5) : []), [data?.merchants, f.merchant, tx]);
  if (!tx) return null;

  const merchantOrCatChanged = f.merchant.trim() !== tx.merchant || f.category !== tx.category;
  const pending = tx.sn.startsWith('pending-');
  const fail = () => toast.error("Couldn't save. Check your connection and try again.");

  const save = () => {
    if (applyAll && merchantOrCatChanged) {
      merchantUpdate.mutate({ from: tx.merchant, to: f.merchant.trim() !== tx.merchant ? f.merchant.trim() : undefined, category: f.category !== tx.category ? f.category : undefined },
        { onSuccess: r => toast.success(`Updated ${(r as { updated?: number })?.updated ?? sameMerchant} transactions`), onError: fail });
      const rest = { date: f.date, time: f.time, amount: parseAmount(f.amount), tag: f.tag };
      if (rest.date !== tx.date || rest.time !== tx.time || rest.amount !== tx.amount || rest.tag !== tx.tag) update.mutate({ sn: tx.sn, patch: rest }, { onError: fail });
    } else {
      update.mutate({ sn: tx.sn, patch: { date: f.date, time: f.time, merchant: f.merchant.trim(), amount: parseAmount(f.amount), category: f.category, tag: f.tag } },
        { onSuccess: () => toast.success('Saved'), onError: fail });
    }
    onClose();
  };

  const remove = () => {
    del.mutate(tx.sn, { onSuccess: () => toast.success('Deleted'), onError: () => toast.error("Couldn't delete. Try again.") });
    onClose();
  };

  return (
    <Drawer open={!!txProp} onOpenChange={o => { if (!o) onClose(); }}>
      <DrawerContent className="max-h-[92dvh]">
        <DrawerHeader className="pb-1 text-left"><DrawerTitle>Edit payment</DrawerTitle></DrawerHeader>
        <form className="space-y-4 overflow-y-auto px-4 pb-6" onSubmit={e => { e.preventDefault(); save(); }}>
          <label className="flex items-baseline gap-2 border-b border-border pb-2">
            <input inputMode="decimal" value={f.amount} aria-label="Amount" onChange={e => setF({ ...f, amount: e.target.value.replace(/[^\d.,]/g, '') })}
              className="w-full bg-transparent text-3xl font-extrabold tracking-tight tnum outline-none" />
            <span className="text-sm font-semibold text-muted-foreground">BHD</span>
          </label>
          <div>
            <Input value={f.merchant} onChange={e => setF({ ...f, merchant: e.target.value })} aria-label="Merchant" autoComplete="off" />
            {suggestions.length > 0 && (
              <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
                {suggestions.map(m => (
                  <button type="button" key={m.merchant} onClick={() => setF({ ...f, merchant: m.merchant, category: m.category || f.category })}
                    className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted">{m.merchant}</button>
                ))}
              </div>
            )}
          </div>
          <CategoryChips cats={cats} value={f.category} onChange={c => setF({ ...f, category: c })} />
          <DateField date={f.date} onDate={d => setF({ ...f, date: d })} time={f.time} onTime={t => setF({ ...f, time: t })} />
          <Input placeholder="Tag (optional)" value={f.tag} onChange={e => setF({ ...f, tag: e.target.value })} aria-label="Tag" />

          {merchantOrCatChanged && sameMerchant > 1 && (
            <label className="flex items-center gap-3 rounded-xl bg-muted px-3 py-2.5 text-sm">
              <Checkbox checked={applyAll} onCheckedChange={v => setApplyAll(v === true)} />
              Apply to all {sameMerchant} transactions from {tx.merchant}
            </label>
          )}

          <Button type="submit" size="lg" className="w-full text-base font-bold disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100" disabled={pending || !(parseAmount(f.amount) > 0) || !f.merchant.trim() || !f.category}>Save</Button>

          {!confirmDelete ? (
            <Button type="button" variant="ghost" className="w-full text-destructive hover:text-destructive" disabled={pending} onClick={() => setConfirmDelete(true)}>Delete</Button>
          ) : (
            <div className="rounded-xl border border-destructive/40 p-3">
              <p className="text-sm">Delete this transaction? This can't be undone.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                <Button type="button" variant="destructive" onClick={remove}>Delete</Button>
              </div>
            </div>
          )}
        </form>
      </DrawerContent>
    </Drawer>
  );
}
