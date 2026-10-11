import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Download, RefreshCw } from 'lucide-react';
import { useTheme, type ThemeMode } from '@/contexts/ThemeContext';
import { useFeed } from '@/hooks/useFeed';
import { Button } from '@/components/ui/button';

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const MODES: Array<{ value: ThemeMode; label: string }> = [{ value: 'system', label: 'Follow phone' }, { value: 'light', label: 'Day' }, { value: 'dark', label: 'Night' }];
const hhmm = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export default function Settings() {
  const { mode, setMode } = useTheme();
  const { dataUpdatedAt, refetch } = useFeed();
  const [spin, setSpin] = useState(false);   // only for taps, not the 30 s auto-refresh
  const nav = useNavigate();
  const [install, setInstall] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    const on = (e: Event) => { e.preventDefault(); setInstall(e as InstallPrompt); };
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold tracking-tight">Settings</h1>

      <Group title="View">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1" role="radiogroup" aria-label="View">
          {MODES.map(m => (
            <button key={m.value} role="radio" aria-checked={mode === m.value} onClick={() => setMode(m.value)}
              className={`rounded-lg py-2 text-sm font-bold transition-colors ${mode === m.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
              {m.label}
            </button>
          ))}
        </div>
      </Group>

      <Group title="Money">
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          <LinkRow label="Budgets" hint="Monthly total and per category" onClick={() => nav('/budgets')} />
          <LinkRow label="Categories" hint="Add, rename, colour, icon" onClick={() => nav('/categories')} />
          <Row label="Period starts on" value="the 23rd" />
          <Row label="Currency" value="BHD" />
        </ul>
      </Group>

      <Group title="Data">
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          <li className="flex items-center justify-between gap-3 px-4 py-3">
            <span>
              <span className="block text-sm font-semibold">Last synced</span>
              <span className="block text-xs text-muted-foreground tnum">{dataUpdatedAt ? hhmm(dataUpdatedAt) : '—'} · refreshes every 30 s</span>
            </span>
            <Button variant="outline" size="sm" className="gap-1.5 font-bold" onClick={() => { setSpin(true); refetch().finally(() => setSpin(false)); }} disabled={spin}>
              <RefreshCw className={`h-4 w-4 ${spin ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </li>
        </ul>
      </Group>

      <Group title="App">
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {install && (
            <li className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm font-semibold">Install on this device</span>
              <Button size="sm" className="gap-1.5 font-bold" onClick={async () => { await install.prompt(); setInstall(null); }}>
                <Download className="h-4 w-4" /> Install
              </Button>
            </li>
          )}
          <Row label="Version" value={import.meta.env.VITE_APP_VERSION} />
        </ul>
      </Group>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return <section><h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h2>{children}</section>;
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
      <span className="font-semibold">{label}</span><span className="text-right text-muted-foreground tnum">{value}</span>
    </li>
  );
}
function LinkRow({ label, hint, onClick }: { label: string; hint: string; onClick: () => void }) {
  return (
    <li>
      <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-muted/60 [@media(hover:hover)]:hover:bg-muted/50">
        <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-muted-foreground">{hint}</span></span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
    </li>
  );
}
