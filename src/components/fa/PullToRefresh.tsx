import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { useRef, type ReactNode, type TouchEvent } from 'react';

const TRIGGER = 70;   // visual pull distance that triggers a refresh
const RESIST = 0.5;   // indicator moves at half the finger's speed

/** Touch pull-to-refresh: only engages when the page is scrolled to the top and the finger moves down */
export function PullToRefresh({ children, onRefresh, refreshing }: { children: ReactNode; onRefresh: () => void; refreshing: boolean }) {
  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, TRIGGER], [0, 1]);
  const rotate = useTransform(y, [0, TRIGGER], [0, 180]);
  const start = useRef<number | null>(null);

  const onStart = (e: TouchEvent) => { start.current = window.scrollY <= 0 ? e.touches[0].clientY : null; };
  const onMove = (e: TouchEvent) => {
    if (start.current === null) return;
    const dy = e.touches[0].clientY - start.current;
    if (dy <= 0) { y.set(0); return; }
    y.set(Math.min(TRIGGER * 1.5, dy * RESIST));
  };
  const onEnd = () => {
    if (start.current !== null && y.get() >= TRIGGER) onRefresh();
    start.current = null;
    animate(y, 0, { type: 'spring', bounce: 0, duration: 0.3 });
  };

  return (
    <div className="relative" onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd} onTouchCancel={onEnd}>
      <motion.div style={{ opacity }} className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center" aria-hidden>
        <motion.span style={{ rotate }} className="grid h-8 w-8 place-items-center rounded-full bg-card shadow-sm">
          <RefreshCw className={`h-4 w-4 text-primary ${refreshing ? 'animate-spin' : ''}`} />
        </motion.span>
      </motion.div>
      <motion.div style={{ y }}>{children}</motion.div>
    </div>
  );
}
