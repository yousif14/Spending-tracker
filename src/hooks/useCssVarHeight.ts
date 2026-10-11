import { useEffect, useRef } from 'react';

/** Publishes an element's live height as a CSS variable on <html>, so sticky offsets below it stay exact */
export function useCssVarHeight<T extends HTMLElement>(name: string) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const set = () => document.documentElement.style.setProperty(name, `${el.getBoundingClientRect().height}px`);
    set();
    const ro = new ResizeObserver(set); ro.observe(el);
    return () => { ro.disconnect(); document.documentElement.style.removeProperty(name); };
  }, [name]);
  return ref;
}
