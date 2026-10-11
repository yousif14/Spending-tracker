import type { Cat } from '@/lib/fa/types';

/** Chip style B (approved): coloured outline + dot; the selected chip fills with its colour */
export function CatChip({ cat, on, onClick, role = 'radio' }: { cat: Pick<Cat, 'name' | 'color'>; on: boolean; onClick: () => void; role?: 'radio' | 'checkbox' }) {
  return (
    <button type="button" role={role} aria-checked={on} onClick={onClick}
      style={{ borderColor: cat.color, ...(on ? { background: `color-mix(in srgb, ${cat.color} 72%, black)`, borderColor: `color-mix(in srgb, ${cat.color} 72%, black)` } : {}) }}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border-[1.5px] px-3 py-2 text-xs font-bold transition-colors active:scale-[0.97] ${
        on ? 'text-white' : 'bg-card text-foreground hover:bg-muted'}`}>
      <span className="h-[7px] w-[7px] rounded-full" style={{ background: on ? '#fff' : cat.color }} aria-hidden />
      {cat.name}
    </button>
  );
}

/** Single-select category chips, always A–Z */
export function CategoryChips({ cats, value, onChange }: { cats: Cat[]; value: string; onChange: (name: string) => void }) {
  const sorted = [...cats].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Category">
      {sorted.map(c => <CatChip key={c.name} cat={c} on={c.name === value} onClick={() => onChange(c.name)} />)}
    </div>
  );
}
