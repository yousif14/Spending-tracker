import { motion } from 'framer-motion';
import { CategoryIcon } from '@/utils/categoryIcons';
import { bhd } from '@/lib/fa/money';
import type { Tx } from '@/lib/fa/types';

const SOURCE_LABEL: Record<Tx['source'], string> = { sms: '', fawri: 'Fawri', manual: 'Manual' };

export function TxRow({ tx, color = '#8A9490', highlight = false, onClick }: { tx: Tx; color?: string; highlight?: boolean; onClick?: () => void }) {
  const meta = [tx.category, tx.time, tx.source === 'sms' && tx.cardEnding ? `••${tx.cardEnding}` : SOURCE_LABEL[tx.source]].filter(Boolean).join(' · ');
  return (
    <motion.button type="button" onClick={onClick}
      initial={false} animate={{ backgroundColor: highlight ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--primary) / 0)' }}
      transition={{ duration: highlight ? 0.2 : 2 }}
      className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-transform active:scale-[0.99]">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${color}1f`, color }}>
        <CategoryIcon categoryName={tx.category} className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{tx.merchant || 'Unknown'}</span>
        <span className="block truncate text-xs text-muted-foreground">{meta}</span>
      </span>
      <span className="shrink-0 text-sm font-bold tnum">{bhd(tx.amount)}</span>
    </motion.button>
  );
}
