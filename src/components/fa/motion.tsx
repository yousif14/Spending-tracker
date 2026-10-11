// Motion primitives — Emil-weighted (fast, restrained), Jakub polish. Only transform/opacity/filter animate.
// MotionConfig reducedMotion="user" (AppShell) turns transforms off for reduced-motion users.
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { bhd } from '@/lib/fa/money';

export const EASE_OUT = [0.2, 0.8, 0.2, 1] as const;
/** No-bounce spring for the segment pill and other state changes */
export const spring = { type: 'spring', bounce: 0, duration: 0.3 } as const;

/** Animates only when the value actually changes (not on every refetch) */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(value);
  const text = useTransform(mv, v => bhd(v));
  useEffect(() => {
    if (reduce) { mv.set(value); return; }
    const c = animate(mv, value, { duration: 0.5, ease: EASE_OUT });
    return c.stop;
  }, [value, reduce, mv]);
  return <motion.span className={className}>{text}</motion.span>;
}

let barsIntroduced = false;   // bars grow from zero on the first load only; later mounts (segment switches) start at their value

/** Progress bar: scaleX from the left instead of animating width */
export function Bar({ pct, color, className = 'h-2' }: { pct: number; color: string; className?: string }) {
  const v = Math.min(100, Math.max(0, pct)) / 100;
  const [intro] = useState(() => !barsIntroduced);
  const settled = useRef(false);   // after the intro, value changes (e.g. typing a budget) move quickly
  useEffect(() => { barsIntroduced = true; }, []);
  return (
    <div className={`w-full overflow-hidden rounded-full bg-muted ${className}`}>
      <motion.div className="h-full w-full origin-left rounded-full" style={{ background: color }}
        initial={intro ? { scaleX: 0 } : false} animate={{ scaleX: v }} onAnimationComplete={() => { settled.current = true; }}
        transition={{ duration: intro && !settled.current ? 0.6 : 0.12, ease: EASE_OUT }} />
    </div>
  );
}

/** List rows: only genuinely new rows fade in; removed rows collapse */
export const listItem = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, height: 'auto', transition: { duration: 0.2, ease: EASE_OUT } },
  exit: { opacity: 0, height: 0, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } },
};
