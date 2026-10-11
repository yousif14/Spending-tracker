import { useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EMPTY_FILTER, type TxFilter } from '@/lib/fa/filters';
import { useCssVarHeight } from '@/hooks/useCssVarHeight';
import type { Cat, Source } from '@/lib/fa/types';

const SAVED_KEY = 'fa:savedFilters';
type Saved = { name: string; filter: TxFilter };
const SOURCES: Array<[Source, string]> = [['sms', 'Card SMS'], ['fawri', 'Fawri'], ['manual', 'Manual']];

function loadSaved(): Saved[] { try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); } catch { return []; } }
function storeSaved(s: Saved[]) { try { localStorage.setItem(SAVED_KEY, JSON.stringify(s)); } catch { /* storage unavailable */ } }

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);
const num = (s: string) => (s.trim() === '' || !Number.isFinite(Number(s)) ? undefined : Number(s));

export function FilterBar({ filter, onChange, cats }: { filter: TxFilter; onChange: (f: TxFilter) => void; cats: Cat[] }) {
  const [open, setOpen] = useState(false);
  const barRef = useCssVarHeight<HTMLDivElement>('--fa-filter-h');
  const [saved, setSaved] = useState<Saved[]>(loadSaved);
  const [name, setName] = useState('');
  const extra = (filter.min !== undefined ? 1 : 0) + (filter.max !== undefined ? 1 : 0) + filter.sources.length + (filter.sort !== 'newest' ? 1 : 0);

  const save = () => {
    const n = name.trim(); if (!n) return;
    const next = [...saved.filter(s => s.name !== n), { name: n, filter }];
    setSaved(next); storeSaved(next); setName('');
  };
  const remove = (n: string) => { const next = saved.filter(s => s.name !== n); setSaved(next); storeSaved(next); };

  return (
    <div ref={barRef} className="sticky top-[var(--fa-header-h,0px)] z-20 -mx-4 space-y-2 bg-background/90 px-4 pb-2 pt-1 backdrop-blur">
      <div className="flex gap-2">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={filter.search} onChange={e => onChange({ ...filter, search: e.target.value })} placeholder="Search merchant, tag or category" className="pl-9" aria-label="Search" />
        </label>
        <Button variant="outline" onClick={() => setOpen(true)} aria-label="More filters" className="relative">
          <SlidersHorizontal className="h-4 w-4" />
          {extra > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{extra}</span>}
        </Button>
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        {saved.map(s => (
          <button key={'s-' + s.name} onClick={() => onChange(s.filter)}
            className="shrink-0 rounded-full border border-dashed border-primary/60 px-3 py-1 text-xs font-semibold text-primary">{s.name}</button>
        ))}
        {cats.map(c => {
          const on = filter.categories.includes(c.name);
          return (
            <button key={c.name} onClick={() => onChange({ ...filter, categories: toggle(filter.categories, c.name) })} aria-pressed={on}
              style={on ? { background: c.color, borderColor: c.color } : undefined}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${on ? 'text-white' : 'border-border bg-card hover:bg-muted'}`}>
              {c.name}
            </button>
          );
        })}
      </div>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[88dvh]">
          <DrawerHeader><DrawerTitle>Filters</DrawerTitle></DrawerHeader>
          <div className="space-y-5 overflow-y-auto px-4 pb-6">
            <div>
              <p className="mb-2 text-sm font-semibold">Amount (BHD)</p>
              <div className="grid grid-cols-2 gap-2">
                <Input inputMode="decimal" placeholder="Min" defaultValue={filter.min ?? ''} onChange={e => onChange({ ...filter, min: num(e.target.value) })} aria-label="Minimum amount" />
                <Input inputMode="decimal" placeholder="Max" defaultValue={filter.max ?? ''} onChange={e => onChange({ ...filter, max: num(e.target.value) })} aria-label="Maximum amount" />
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Source</p>
              <div className="flex flex-wrap gap-2">
                {SOURCES.map(([v, l]) => (
                  <Button key={v} size="sm" variant={filter.sources.includes(v) ? 'default' : 'outline'} onClick={() => onChange({ ...filter, sources: toggle(filter.sources, v) })}>{l}</Button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Sort</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant={filter.sort === 'newest' ? 'default' : 'outline'} onClick={() => onChange({ ...filter, sort: 'newest' })}>Newest</Button>
                <Button variant={filter.sort === 'amount' ? 'default' : 'outline'} onClick={() => onChange({ ...filter, sort: 'amount' })}>Amount</Button>
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Save this filter</p>
              <div className="flex gap-2">
                <Input placeholder="Name, e.g. Eating out" value={name} onChange={e => setName(e.target.value)} aria-label="Filter name" />
                <Button variant="secondary" onClick={save} disabled={!name.trim()}>Save</Button>
              </div>
              {saved.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {saved.map(s => (
                    <span key={s.name} className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-semibold">
                      {s.name}<button onClick={() => remove(s.name)} aria-label={`Delete ${s.name}`}><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <Button variant="ghost" className="w-full" onClick={() => { onChange(EMPTY_FILTER); setOpen(false); }}>Reset filters</Button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
