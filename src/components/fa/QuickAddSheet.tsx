import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAddTx, useFeed } from '@/hooks/useFeed';
import { searchMerchants } from '@/lib/fa/merchantSearch';
import { bhd, parseAmount } from '@/lib/fa/money';
import { nowBahrain } from '@/lib/fa/time';
import { CategoryChips } from './CategoryChips';

export function QuickAddSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data } = useFeed();
  const add = useAddTx();
  const amountRef = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState('');
  const [tag, setTag] = useState('');
  const [when, setWhen] = useState(nowBahrain());

  useEffect(() => {
    if (!open) return;
    setAmount(''); setMerchant(''); setCategory(''); setTag(''); setWhen(nowBahrain());
    const t = setTimeout(() => amountRef.current?.focus(), 250);     // after the sheet settles, so iOS shows the keypad
    return () => clearTimeout(t);
  }, [open]);

  const suggestions = useMemo(() => searchMerchants(data?.merchants ?? [], merchant), [data?.merchants, merchant]);
  const cats = useMemo(() => (data?.categories ?? []).filter(c => c.active), [data?.categories]);
  const value = parseAmount(amount);
  const ready = value > 0 && merchant.trim() !== '' && category !== '';

  const submit = () => {
    if (!ready) return;
    const t = { date: when.date, time: when.time, merchant: merchant.trim(), amount: value, category, tag: tag.trim() || undefined };
    onOpenChange(false);
    add.mutate(t, {
      onSuccess: () => toast.success(`Added ${bhd(value)} BHD · ${t.merchant}`),
      onError: () => toast.error("Couldn't add. Check your connection and try again."),
    });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92dvh]">
        <DrawerHeader className="pb-1"><DrawerTitle>Add a payment</DrawerTitle></DrawerHeader>
        <form className="space-y-4 overflow-y-auto px-4 pb-6" onSubmit={e => { e.preventDefault(); submit(); }}>
          <label className="flex items-baseline gap-2 border-b border-border pb-2">
            <input ref={amountRef} inputMode="decimal" placeholder="0.000" value={amount} aria-label="Amount"
              onChange={e => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
              className="w-full bg-transparent font-display text-4xl tnum outline-none placeholder:text-muted-foreground/50" />
            <span className="text-sm font-semibold text-muted-foreground">BHD</span>
          </label>

          <div>
            <Input placeholder="Merchant" value={merchant} onChange={e => setMerchant(e.target.value)} aria-label="Merchant" autoComplete="off" />
            {suggestions.length > 0 && (
              <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
                {suggestions.map(m => (
                  <button type="button" key={m.merchant} onClick={() => { setMerchant(m.merchant); if (m.category) setCategory(m.category); }}
                    className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted active:scale-[0.97]">
                    {m.merchant}
                  </button>
                ))}
              </div>
            )}
          </div>

          <CategoryChips cats={cats} value={category} onChange={setCategory} />

          <div className="grid grid-cols-2 gap-2">
            <Input type="date" aria-label="Date" value={when.date} onChange={e => setWhen(w => ({ ...w, date: e.target.value }))} />
            <Input type="time" aria-label="Time" value={when.time} onChange={e => setWhen(w => ({ ...w, time: e.target.value }))} />
          </div>
          <Input placeholder="Tag (optional)" value={tag} onChange={e => setTag(e.target.value)} aria-label="Tag" />

          <Button type="submit" size="lg" className="w-full active:scale-[0.98]" disabled={!ready}>
            {value > 0 ? `Add ${bhd(value)} BHD` : 'Add'}
          </Button>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
