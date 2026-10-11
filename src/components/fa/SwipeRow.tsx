import { animate, motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { Pencil, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';

const EDIT_AT = 70, DELETE_AT = 110;

/** Swipe left → delete, swipe right → edit. Action colours fade in under the row as it moves. */
export function SwipeRow({ children, onEdit, onDelete, disabled, surface = 'bg-background' }: { children: ReactNode; onEdit: () => void; onDelete: () => void; disabled?: boolean; surface?: string }) {
  const x = useMotionValue(0);
  const editOpacity = useTransform(x, [0, EDIT_AT], [0, 1]);
  const deleteOpacity = useTransform(x, [-DELETE_AT, 0], [1, 0]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const dx = info.offset.x, vx = info.velocity.x;
    if (dx < -DELETE_AT || (vx < -700 && dx < -40)) {
      animate(x, -window.innerWidth, { duration: 0.18, ease: [0.4, 0, 1, 1] }).then(onDelete);
      return;
    }
    if (dx > EDIT_AT || (vx > 700 && dx > 40)) onEdit();
    animate(x, 0, { type: 'spring', bounce: 0, duration: 0.3 });
  };

  if (disabled) return <>{children}</>;
  return (
    <div className="relative overflow-hidden rounded-xl">
      <motion.div style={{ opacity: editOpacity }} className="absolute inset-0 flex items-center gap-2 rounded-xl bg-primary pl-4 text-sm font-bold text-primary-foreground" aria-hidden>
        <Pencil className="h-4 w-4" /> Edit
      </motion.div>
      <motion.div style={{ opacity: deleteOpacity }} className="absolute inset-0 flex items-center justify-end gap-2 rounded-xl bg-destructive pr-4 text-sm font-bold text-destructive-foreground" aria-hidden>
        Delete <Trash2 className="h-4 w-4" />
      </motion.div>
      <motion.div style={{ x }} drag="x" dragDirectionLock dragConstraints={{ left: 0, right: 0 }} dragElastic={{ left: 0.9, right: 0.5 }}
        onDragEnd={onDragEnd} className={`relative ${surface}`}>
        {children}
      </motion.div>
    </div>
  );
}
