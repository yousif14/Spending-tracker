import { useState } from 'react';
import { format } from 'date-fns';
import { Check, ChevronDown } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getCurrentPeriodWindow, getPeriodWindow, type DateRangeConfig } from '@/utils/period';
import { usePeriod } from '@/state/period';

const fmt = (s: string) => format(new Date(s + 'T00:00:00'), 'd MMM');

function lastFiscalMonths(n: number) {
  const c = getCurrentPeriodWindow();
  const out = [];
  let { month, year } = c;
  for (let i = 0; i < n; i++) {
    out.push(getPeriodWindow(year, month));
    month -= 1; if (month === 0) { month = 12; year -= 1; }
  }
  return out;
}

export function label(config: DateRangeConfig, range: { from: string; to: string }) {
  if (config.mode === 'all') return 'All time';
  if (config.mode === 'last3months') return 'Last 3 months';
  return `${fmt(range.from)} – ${fmt(range.to)}`;
}

export function PeriodPill() {
  const { config, setConfig, range } = usePeriod();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(range.from.startsWith('0000') ? '' : range.from);
  const [to, setTo] = useState(range.to.startsWith('9999') ? '' : range.to);
  const pick = (c: DateRangeConfig) => { setConfig(c); setOpen(false); };
  const isSel = (c: DateRangeConfig) => c.mode === config.mode && (c.mode !== 'fiscal' || (c.month === config.month && c.year === config.year));

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold tnum transition-colors hover:bg-muted active:scale-[0.97]">
        {label(config, range)} <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[85dvh]">
          <DrawerHeader><DrawerTitle>Period</DrawerTitle></DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6">
            <ul className="divide-y divide-border rounded-xl border border-border">
              {lastFiscalMonths(12).map((w, i) => {
                const c: DateRangeConfig = { mode: 'fiscal', month: w.month, year: w.year };
                return (
                  <li key={w.from}>
                    <button onClick={() => pick(c)} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-muted">
                      <span className="tnum">{fmt(w.from)} – {fmt(w.to)}{i === 0 && <span className="ml-2 text-muted-foreground">current</span>}</span>
                      {isSel(c) && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant={config.mode === 'last3months' ? 'default' : 'outline'} onClick={() => pick({ mode: 'last3months' })}>Last 3 months</Button>
              <Button variant={config.mode === 'all' ? 'default' : 'outline'} onClick={() => pick({ mode: 'all' })}>All time</Button>
            </div>
            <p className="mt-5 mb-2 text-sm font-semibold">Custom</p>
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" aria-label="From" value={from} onChange={e => setFrom(e.target.value)} />
              <Input type="date" aria-label="To" value={to} onChange={e => setTo(e.target.value)} />
            </div>
            <Button className="mt-2 w-full" variant="secondary" disabled={!from || !to || from > to}
              onClick={() => pick({ mode: 'custom', from, to })}>Apply custom range</Button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
