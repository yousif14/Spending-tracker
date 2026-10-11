import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { buildRange, getCurrentPeriodWindow, type DateRangeConfig } from '@/utils/period';

const KEY = 'fa:period:v2';

interface PeriodCtx { config: DateRangeConfig; setConfig: (c: DateRangeConfig) => void; range: { from: string; to: string } }
const Ctx = createContext<PeriodCtx | null>(null);

const current = (): DateRangeConfig => { const c = getCurrentPeriodWindow(); return { mode: 'fiscal', month: c.month, year: c.year }; };

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [config, set] = useState<DateRangeConfig>(() => {
    try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch { /* storage unavailable */ }
    return current();
  });
  const setConfig = (c: DateRangeConfig) => { set(c); try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* storage unavailable */ } };
  const range = useMemo(() => {
    try { const r = buildRange(config); return { from: r.from ?? '0000-01-01', to: r.to ?? '9999-12-31' }; }
    catch { const r = buildRange(current()); return { from: r.from!, to: r.to! }; }   // stale/invalid saved config
  }, [config]);
  return <Ctx.Provider value={{ config, setConfig, range }}>{children}</Ctx.Provider>;
}

export const usePeriod = () => { const c = useContext(Ctx); if (!c) throw new Error('PeriodProvider missing'); return c; };
