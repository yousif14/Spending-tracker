import { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DateRangeConfig,
  getCurrentPeriodWindow,
  getPeriodWindow,
  buildRange
} from '@/utils/period';

interface DateRangeSelectorProps {
  value: DateRangeConfig;
  onChange: (config: DateRangeConfig) => void;
  storageKey?: string;
}

type QuickMode = 'current' | 'prev' | 'next';

export function DateRangeSelector({ value, onChange, storageKey = 'txnRange:v1' }: DateRangeSelectorProps) {
  const [showCustom, setShowCustom] = useState(value.mode === 'custom');

  // Persist to localStorage on change
  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(value));
    }
  }, [value, storageKey]);

  // Handle quick fiscal modes (current, prev, next)
  const handleQuickMode = (mode: QuickMode) => {
    const current = getCurrentPeriodWindow();
    let month: number;
    let year: number;

    switch (mode) {
      case 'current':
        month = current.month;
        year = current.year;
        break;
      case 'prev':
        month = current.month === 1 ? 12 : current.month - 1;
        year = current.month === 1 ? current.year - 1 : current.year;
        break;
      case 'next':
        month = current.month === 12 ? 1 : current.month + 1;
        year = current.month === 12 ? current.year + 1 : current.year;
        break;
    }

    onChange({
      mode: 'fiscal',
      month,
      year,
    });
    setShowCustom(false);
  };

  // Handle navigation (Prev/Next)
  const handlePrev = () => {
    if (value.mode === 'fiscal' && value.month && value.year) {
      // Move by 1 month
      const prevMonth = value.month === 1 ? 12 : value.month - 1;
      const prevYear = value.month === 1 ? value.year - 1 : value.year;

      onChange({
        mode: 'fiscal',
        month: prevMonth,
        year: prevYear,
      });
    } else if (value.mode === 'last3months') {
      // Move by 3 months
      const current = getCurrentPeriodWindow();
      let newMonth = current.month - 3;
      let newYear = current.year;

      // Handle year rollover
      while (newMonth <= 0) {
        newMonth += 12;
        newYear -= 1;
      }

      onChange({
        mode: 'fiscal',
        month: newMonth,
        year: newYear,
      });
    }
  };

  const handleNext = () => {
    if (value.mode === 'fiscal' && value.month && value.year) {
      // Move by 1 month
      const nextMonth = value.month === 12 ? 1 : value.month + 1;
      const nextYear = value.month === 12 ? value.year + 1 : value.year;

      onChange({
        mode: 'fiscal',
        month: nextMonth,
        year: nextYear,
      });
    } else if (value.mode === 'last3months') {
      // Move by 3 months
      const current = getCurrentPeriodWindow();
      let newMonth = current.month + 3;
      let newYear = current.year;

      // Handle year rollover
      while (newMonth > 12) {
        newMonth -= 12;
        newYear += 1;
      }

      onChange({
        mode: 'fiscal',
        month: newMonth,
        year: newYear,
      });
    }
  };

  // Handle last 3 months mode
  const handleLast3Months = () => {
    onChange({ mode: 'last3months' });
    setShowCustom(false);
  };

  // Handle all time mode
  const handleAllTime = () => {
    onChange({ mode: 'all' });
    setShowCustom(false);
  };

  // Handle custom range
  const handleCustomRange = () => {
    setShowCustom(true);
    if (value.mode !== 'custom') {
      // Initialize with today's date
      const today = new Date().toISOString().split('T')[0];
      onChange({
        mode: 'custom',
        from: today,
        to: today,
      });
    }
  };

  const handleCustomFromChange = (from: string) => {
    onChange({
      mode: 'custom',
      from,
      to: value.to || '',
    });
  };

  const handleCustomToChange = (to: string) => {
    onChange({
      mode: 'custom',
      from: value.from || '',
      to,
    });
  };

  // Get display label
  const getDisplayLabel = () => {
    if (value.mode === 'all') {
      return 'All Time';
    }
    if (value.mode === 'custom' && value.from && value.to) {
      return `${value.from} → ${value.to}`;
    }
    if (value.mode === 'last3months') {
      const range = buildRange(value);
      return `Last 3 Months (${range.from} → ${range.to})`;
    }
    if (value.mode === 'fiscal' && value.month && value.year) {
      const window = getPeriodWindow(value.year, value.month);
      return `Month ${value.month} (${window.from} → ${window.to})`;
    }
    return 'Select Range';
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Quick Mode Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={value.mode === 'fiscal' && !showCustom ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleQuickMode('current')}
        >
          <Calendar className="w-4 h-4 mr-2" />
          Current
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleQuickMode('prev')}
        >
          Prev
        </Button>
        <Button
          variant={value.mode === 'last3months' ? 'default' : 'outline'}
          size="sm"
          onClick={handleLast3Months}
        >
          Last 3 Months
        </Button>
        <Button
          variant={value.mode === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={handleAllTime}
        >
          All Time
        </Button>
        <Button
          variant={showCustom ? 'default' : 'outline'}
          size="sm"
          onClick={handleCustomRange}
        >
          Custom
        </Button>
      </div>

      {/* Period Navigator (for fiscal and last3months mode) */}
      {(value.mode === 'fiscal' || value.mode === 'last3months') && !showCustom && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrev}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 text-center text-sm font-medium text-foreground">
            {getDisplayLabel()}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Custom Range Inputs */}
      {showCustom && value.mode === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">From</label>
            <Input
              type="date"
              value={value.from || ''}
              onChange={(e) => handleCustomFromChange(e.target.value)}
              className="text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">To</label>
            <Input
              type="date"
              value={value.to || ''}
              onChange={(e) => handleCustomToChange(e.target.value)}
              className="text-sm"
            />
          </div>
        </div>
      )}

      {/* All Time Display */}
      {value.mode === 'all' && (
        <div className="text-center text-sm font-medium text-foreground py-2">
          {getDisplayLabel()}
        </div>
      )}
    </div>
  );
}
