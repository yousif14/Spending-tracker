import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
/** 'system' follows the phone's day/night setting; 'light'/'dark' are explicit choices */
export type ThemeMode = Theme | 'system';

interface ThemeContextType {
  theme: Theme;              // what is showing now
  mode: ThemeMode;           // what the user chose
  setMode: (mode: ThemeMode) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const KEY = 'fa:theme-mode';
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

function readMode(): ThemeMode {
  try { const m = localStorage.getItem(KEY); if (m === 'light' || m === 'dark' || m === 'system') return m; } catch { /* storage unavailable */ }
  return 'system';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readMode);
  const [systemDark, setSystemDark] = useState(() => media().matches);

  useEffect(() => {
    const mq = media();
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const theme: Theme = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    root.style.colorScheme = theme;
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', theme === 'dark' ? '#101513' : '#F6F7F4'));
  }, [theme]);

  const setMode = (m: ThemeMode) => { setModeState(m); try { localStorage.setItem(KEY, m); } catch { /* storage unavailable */ } };

  return (
    <ThemeContext.Provider value={{ theme, mode, setMode, setTheme: setMode, toggleTheme: () => setMode(theme === 'dark' ? 'light' : 'dark') }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
