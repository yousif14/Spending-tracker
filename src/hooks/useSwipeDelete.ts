import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useDeleteTx } from '@/hooks/useFeed';
import { bhd } from '@/lib/fa/money';
import type { Tx } from '@/lib/fa/types';

const UNDO_MS = 4500;

/** Hide a swiped row at once, offer Undo, and only delete on the server when the undo window closes */
export function useSwipeDelete() {
  const del = useDeleteTx();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const unhide = (sn: string) => setHidden(h => { const n = new Set(h); n.delete(sn); return n; });

  const remove = useCallback((tx: Tx) => {
    setHidden(h => new Set(h).add(tx.sn));
    let undone = false;
    const timer = setTimeout(() => {
      if (undone) return;
      del.mutate(tx.sn, {
        onError: () => { unhide(tx.sn); toast.error("Couldn't delete. Try again."); },
        onSettled: () => unhide(tx.sn),
      });
    }, UNDO_MS);
    toast(`Deleted ${bhd(tx.amount)} · ${tx.merchant}`, {
      duration: UNDO_MS,
      action: { label: 'Undo', onClick: () => { undone = true; clearTimeout(timer); unhide(tx.sn); } },
    });
  }, [del]);

  return { hidden, remove };
}
