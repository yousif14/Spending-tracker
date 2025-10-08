import { useState } from 'react';
import { Calendar, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface DateRangePickerProps {
  isOpen: boolean;
  onClose: () => void;
  dateRange: { start: string; end: string };
  onApply: (range: { start: string; end: string }) => void;
}

export function DateRangePicker({ isOpen, onClose, dateRange, onApply }: DateRangePickerProps) {
  const [localStart, setLocalStart] = useState(dateRange.start);
  const [localEnd, setLocalEnd] = useState(dateRange.end);

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];

  const handleApply = () => {
    onApply({ start: localStart, end: localEnd });
    onClose();
  };

  const handleReset = () => {
    setLocalStart('2020-01-01');
    setLocalEnd(today);
    onApply({ start: '2020-01-01', end: today });
    onClose();
  };

  const handleQuickSelect = (months: number) => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    
    const start = startDate.toISOString().split('T')[0];
    const end = endDate.toISOString().split('T')[0];
    
    setLocalStart(start);
    setLocalEnd(end);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Select Date Range
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Quick Select Buttons */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">Quick Select</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect(1)}
                className="justify-start"
              >
                Last Month
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect(3)}
                className="justify-start"
              >
                Last 3 Months
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect(6)}
                className="justify-start"
              >
                Last 6 Months
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect(12)}
                className="justify-start"
              >
                Last Year
              </Button>
            </div>
          </div>

          {/* Custom Date Selection */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-2">
                Start Date
              </label>
              <Input
                type="date"
                value={localStart}
                max={today}
                onChange={(e) => setLocalStart(e.target.value)}
                className="w-full"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-2">
                End Date
              </label>
              <Input
                type="date"
                value={localEnd}
                max={today}
                min={localStart}
                onChange={(e) => setLocalEnd(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleReset}
              className="flex-1"
            >
              All Time
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApply}
              className="flex-1 gradient-primary text-white"
            >
              Apply
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}