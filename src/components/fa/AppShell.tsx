import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Menu, Moon, Plus, RefreshCw, Sun } from 'lucide-react';
import { useState } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { ThemeMode } from '@/contexts/ThemeContext';
import { useFeed } from '@/hooks/useFeed';
import { useCssVarHeight } from '@/hooks/useCssVarHeight';
import { useTheme } from '@/contexts/ThemeContext';
import { PeriodPill } from './PeriodPill';
import { QuickAddSheet } from './QuickAddSheet';
import { PullToRefresh } from './PullToRefresh';
import { EASE_OUT, spring } from './motion';

const SEGMENTS = [{ to: '/', label: 'Overview' }, { to: '/activity', label: 'Activity' }, { to: '/stats', label: 'Stats' }];

export function AppShell() {
  const loc = useLocation();
  const nav = useNavigate();
  const [adding, setAdding] = useState(false);
  const [manual, setManual] = useState(false);   // spin only for refreshes the user asked for, not the 30 s auto-refresh
  const refresh = () => { setManual(true); refetch().finally(() => setManual(false)); };
  const { dataUpdatedAt, refetch, isError, data } = useFeed();
  const { theme, mode, setMode, toggleTheme } = useTheme();
  const onSegment = SEGMENTS.some(s => s.to === loc.pathname);
  const headerRef = useCssVarHeight<HTMLElement>('--fa-header-h');

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-dvh bg-background text-foreground font-sans pb-[calc(env(safe-area-inset-bottom)+96px)]">
        <header ref={headerRef} className="sticky top-0 z-30 border-b border-border bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
            <button onClick={() => nav('/')} className="font-display text-xl tracking-tight">FA</button>
            <PeriodPill />
            <button aria-label={theme === 'dark' ? 'Switch to day view' : 'Switch to night view'} onClick={toggleTheme} className="ml-auto rounded-full p-2 transition-colors hover:bg-muted">
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button aria-label="Refresh" onClick={refresh} className="rounded-full p-2 transition-colors hover:bg-muted">
              <RefreshCw className={`h-4 w-4 ${manual ? 'animate-spin' : ''}`} />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger aria-label="Menu" className="rounded-full p-2 transition-colors hover:bg-muted"><Menu className="h-5 w-5" /></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => nav('/budgets')}>Budgets</DropdownMenuItem>
                <DropdownMenuItem onClick={() => nav('/categories')}>Categories</DropdownMenuItem>
                <DropdownMenuItem onClick={() => nav('/settings')}>Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">View</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={mode} onValueChange={v => setMode(v as ThemeMode)}>
                  <DropdownMenuRadioItem value="light">Day</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark">Night</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="system">Follow phone</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {onSegment && (
            <nav className="mx-auto max-w-3xl px-4 pb-3" aria-label="Sections">
              <div className="relative grid grid-cols-3 rounded-xl bg-muted p-1">
                {SEGMENTS.map(s => (
                  <NavLink key={s.to} to={s.to} end className="relative z-10 py-2 text-center text-sm font-bold">
                    {({ isActive }) => (<>
                      {isActive && <motion.span layoutId="seg" transition={spring} className="absolute inset-0 -z-10 rounded-lg bg-card shadow-sm" />}
                      <span className={`transition-colors ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>{s.label}</span>
                    </>)}
                  </NavLink>
                ))}
              </div>
            </nav>
          )}
        </header>

        {isError && data && (
          <p className="mx-auto max-w-3xl px-4 pt-3 text-sm text-warning">
            Offline. Showing data from {new Date(dataUpdatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.
          </p>
        )}

        <PullToRefresh onRefresh={refresh} refreshing={manual}>
          <main className="mx-auto max-w-3xl px-4 pt-4">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={loc.pathname}
                initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0, transition: { duration: 0.15, ease: EASE_OUT } }}
                exit={{ opacity: 0, transition: { duration: 0.08 } }}>
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </PullToRefresh>

        <motion.button aria-label="Add transaction" onClick={() => setAdding(true)} whileTap={{ scale: 0.95 }}
          className="fixed right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_6px_20px_hsl(var(--primary)/0.3)] bottom-[calc(env(safe-area-inset-bottom)+20px)]">
          <Plus className="h-7 w-7" />
        </motion.button>
        <QuickAddSheet open={adding} onOpenChange={setAdding} />
      </div>
    </MotionConfig>
  );
}
