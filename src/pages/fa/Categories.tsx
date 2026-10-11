import { useMemo, useState } from 'react';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDeleteCategory, useFeed, useSaveCategory } from '@/hooks/useFeed';
import { CategoryIcon, getCategoryIcon, PICKABLE_ICONS } from '@/utils/categoryIcons';
import type { Cat } from '@/lib/fa/types';

const PALETTE = ['#D96B4F', '#B5803A', '#8A6A3B', '#2E8B57', '#1F9E89', '#3B8FB0', '#4F6BD9', '#7C5CC4', '#C24A6A', '#E0719E', '#5B6B7A', '#8A9490'];
type Editing = { from?: string; name: string; color: string; icon: string };

/** The picker shows the stored icon, or the built-in one the name maps to */
const iconNameOf = (c: Cat) => {
  if (c.icon && c.icon !== 'Tag' && PICKABLE_ICONS[c.icon]) return c.icon;
  const Builtin = getCategoryIcon(c.name);
  return Object.entries(PICKABLE_ICONS).find(([, I]) => I === Builtin)?.[0] ?? 'Tag';
};

export default function Categories() {
  const { data, isLoading } = useFeed();
  const save = useSaveCategory();
  const del = useDeleteCategory();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of data?.transactions ?? []) m.set(t.category, (m.get(t.category) ?? 0) + 1);
    return m;
  }, [data?.transactions]);
  const cats = useMemo(() => [...(data?.categories ?? [])].sort((a, b) => a.name.localeCompare(b.name)), [data?.categories]);

  if (isLoading && !data) return <div className="space-y-2">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>;

  const open = (c?: Cat) => { setConfirmDelete(false); setEditing(c ? { from: c.name, name: c.name, color: c.color, icon: iconNameOf(c) } : { name: '', color: PALETTE[cats.length % PALETTE.length], icon: 'Tag' }); };
  const name = editing?.name.replace(/\s+/g, ' ').trim() ?? '';
  const clash = !!editing && cats.some(c => c.name.toLowerCase() === name.toLowerCase() && c.name !== editing.from);
  const used = editing?.from ? counts.get(editing.from) ?? 0 : 0;

  const submit = () => {
    if (!editing || !name || clash) return;
    const isNew = !editing.from;
    save.mutate({ name, color: editing.color, icon: editing.icon, from: editing.from, base: cats.find(c => c.name === editing.from) }, {
      onSuccess: () => toast.success(isNew ? `Added ${name}` : 'Saved'),
      onError: () => toast.error("Couldn't save the category. Try again."),
    });
    setEditing(null);
  };
  const remove = () => {
    if (!editing?.from) return;
    const n = editing.from;
    del.mutate(n, {
      onSuccess: r => toast.success(r && (r as { moved?: number }).moved ? `Deleted ${n}. ${(r as { moved: number }).moved} moved to Other; list sent to Joseph.` : `Deleted ${n}`),
      onError: () => toast.error("Couldn't delete the category. Try again."),
    });
    setEditing(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-extrabold tracking-tight">Categories</h1>
        <Button size="sm" onClick={() => open()} className="gap-1 font-bold"><Plus className="h-4 w-4" /> New</Button>
      </div>
      <p className="text-sm text-muted-foreground">Used in Quick add, the edit sheet and the Telegram picker, always A to Z.</p>

      <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
        {cats.map(c => (
          <li key={c.name}>
            <button onClick={() => open(c)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border-[1.5px]" style={{ borderColor: c.color, color: c.color }}>
                <CategoryIcon categoryName={c.name} className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{c.name}</span>
                <span className="block text-xs text-muted-foreground tnum">{counts.get(c.name) ?? 0} transactions</span>
              </span>
              <Pencil className="h-4 w-4 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>

      <Drawer open={!!editing} onOpenChange={o => { if (!o) setEditing(null); }}>
        <DrawerContent className="max-h-[90dvh]">
          <DrawerHeader className="pb-1 text-left"><DrawerTitle>{editing?.from ? 'Edit category' : 'New category'}</DrawerTitle></DrawerHeader>
          {editing && (
            <form className="space-y-4 overflow-y-auto px-4 pb-6" onSubmit={e => { e.preventDefault(); submit(); }}>
              <div>
                <Input autoFocus={!editing.from} placeholder="Name, e.g. Pharmacy" value={editing.name} aria-label="Category name"
                  onChange={e => setEditing({ ...editing, name: e.target.value })} />
                {clash && <p className="mt-1 text-xs font-semibold text-destructive">A category with this name already exists.</p>}
                {editing.from && name && name !== editing.from && used > 0 &&
                  <p className="mt-1 text-xs text-muted-foreground">Renaming also updates its {used} transactions.</p>}
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold">Colour</p>
                <div className="grid grid-cols-6 gap-y-2" role="radiogroup" aria-label="Colour">
                  {PALETTE.map(col => (
                    <button key={col} type="button" role="radio" aria-checked={editing.color === col} aria-label={col}
                      onClick={() => setEditing({ ...editing, color: col })}
                      className="grid h-10 w-10 place-items-center justify-self-center rounded-full transition-transform active:scale-95" style={{ background: col }}>
                      {editing.color === col && <Check className="h-4 w-4 text-white" />}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold">Icon</p>
                <div className="grid grid-cols-6 gap-y-2" role="radiogroup" aria-label="Icon">
                  {Object.entries(PICKABLE_ICONS).map(([key, Icon]) => {
                    const on = editing.icon === key;
                    return (
                      <button key={key} type="button" role="radio" aria-checked={on} aria-label={key}
                        onClick={() => setEditing({ ...editing, icon: key })}
                        className={`grid h-10 w-10 place-items-center justify-self-center rounded-xl border-[1.5px] transition-colors active:scale-95 ${on ? '' : 'border-border text-muted-foreground'}`}
                        style={on ? { borderColor: editing.color, color: editing.color, background: `${editing.color}1f` } : undefined}>
                        <Icon className="h-[18px] w-[18px]" />
                      </button>
                    );
                  })}
                </div>
              </div>
              <Button type="submit" size="lg" disabled={!name || clash}
                className="w-full text-base font-bold disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100">
                {editing.from ? 'Save' : 'Add category'}
              </Button>

              {editing.from && editing.from !== 'Other' && (!confirmDelete ? (
                <Button type="button" variant="ghost" className="w-full gap-1 text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-4 w-4" /> Delete category
                </Button>
              ) : (
                <div className="rounded-xl border border-destructive/40 p-3">
                  <p className="text-sm">
                    Delete <b>{editing.from}</b>?{' '}
                    {used > 0 ? `Its ${used} transactions move to Other, and Joseph sends you the list.` : 'No transactions use it.'}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                    <Button type="button" variant="destructive" onClick={remove}>Delete</Button>
                  </div>
                </div>
              ))}
            </form>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
