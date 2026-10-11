import type { Cat } from '@/lib/fa/types';

/** Single-select category chips in the user's order; the selected chip is filled with the category colour */
export function CategoryChips({ cats, value, onChange }: { cats: Cat[]; value: string; onChange: (name: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Category">
      {cats.map(c => {
        const on = c.name === value;
        return (
          <button type="button" key={c.name} role="radio" aria-checked={on} onClick={() => onChange(c.name)}
            style={on ? { background: c.color, borderColor: c.color } : undefined}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors active:scale-[0.97] ${
              on ? 'text-white' : 'border-border bg-card text-foreground hover:bg-muted'}`}>
            {c.name}
          </button>
        );
      })}
    </div>
  );
}
