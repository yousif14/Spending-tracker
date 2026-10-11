import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarDays, Check, ChevronDown } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
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
          <div className="overflow-y-auto overflow-x-hidden px-4 pb-[calc(env(safe-area-inset-bottom)+24px)]">
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
            <p className="mb-2 mt-5 text-sm font-bold">Custom range</p>
            <div className="grid grid-cols-2 gap-2">
              <DateBox label="From" value={from} onChange={setFrom} />
              <DateBox label="To" value={to} onChange={setTo} />
            </div>
            {from && to && from > to && <p className="mt-1.5 text-xs font-semibold text-destructive">"From" must be before "To".</p>}
            <Button className="mt-3 w-full font-bold disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100" size="lg"
              disabled={!from || !to || from > to} onClick={() => pick({ mode: 'custom', from, to })}>Show this range</Button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

/** Tappable date box; the transparent native input on top opens the phone's own date picker */
function DateBox({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="relative block min-w-0 rounded-xl border border-input bg-card px-3 py-2 focus-within:border-primary">
      <span className="block text-[11px] font-semibold text-muted-foreground">{label}</span>
      <span className="mt-0.5 flex items-center gap-1.5 text-sm font-bold tnum">
        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{value ? format(new Date(value + 'T00:00:00'), 'd MMM yyyy') : 'Pick a date'}</span>
      </span>
      <input type="date" aria-label={label} value={value} onChange={e => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full min-w-0 cursor-pointer appearance-none opacity-0" />
    </label>
  );
}
