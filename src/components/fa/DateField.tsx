import { format } from 'date-fns';
import { CalendarDays, Clock, X } from 'lucide-react';
import { todayBahrain } from '@/lib/fa/time';

const shift = (iso: string, days: number) => {
  const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
};

/** Today / Yesterday / pick a date, plus an optional time. Native pickers sit under readable labels so iOS's input styling never shows. */
export function DateField({ date, onDate, time, onTime }: { date: string; onDate: (d: string) => void; time: string; onTime: (t: string) => void }) {
  const today = todayBahrain(), yesterday = shift(today, -1);
  const custom = date !== today && date !== yesterday;
  const pill = (on: boolean) => `rounded-full border-[1.5px] px-3 py-2 text-sm font-bold transition-colors ${
    on ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card text-foreground hover:bg-muted'}`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Date">
        <button type="button" role="radio" aria-checked={date === today} className={pill(date === today)} onClick={() => onDate(today)}>Today</button>
        <button type="button" role="radio" aria-checked={date === yesterday} className={pill(date === yesterday)} onClick={() => onDate(yesterday)}>Yesterday</button>
        <label className={`relative inline-flex cursor-pointer items-center gap-1.5 ${pill(custom)}`}>
          <CalendarDays className="h-4 w-4" />
          {custom && date ? format(new Date(date + 'T00:00:00'), 'EEE d MMM') : 'Pick date'}
          <input type="date" aria-label="Pick a date" value={date} max={today} onChange={e => e.target.value && onDate(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <label className={`relative inline-flex cursor-pointer items-center gap-1.5 ${pill(!!time)}`}>
          <Clock className="h-4 w-4" />
          {time || 'Add time (optional)'}
          <input type="time" aria-label="Time (optional)" value={time} onChange={e => onTime(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
        {time && (
          <button type="button" onClick={() => onTime('')} aria-label="Remove time" className="rounded-full p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        )}
      </div>
    </div>
  );
}
