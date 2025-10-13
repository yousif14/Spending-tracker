import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type SortOption = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'category-asc' | 'category-desc';

interface SortControlProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
  isMobile?: boolean;
}

const sortOptions = [
  { value: 'date-desc' as SortOption, label: 'Newest First', icon: ArrowDown },
  { value: 'date-asc' as SortOption, label: 'Oldest First', icon: ArrowUp },
  { value: 'amount-desc' as SortOption, label: 'Highest Amount', icon: ArrowDown },
  { value: 'amount-asc' as SortOption, label: 'Lowest Amount', icon: ArrowUp },
  { value: 'category-asc' as SortOption, label: 'Category A-Z', icon: ArrowUp },
  { value: 'category-desc' as SortOption, label: 'Category Z-A', icon: ArrowDown },
];

export function SortControl({ value, onChange, isMobile = false }: SortControlProps) {
  const currentSort = sortOptions.find(opt => opt.value === value);

  if (isMobile) {
    // Compact dropdown for mobile
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full md:w-[200px] h-10 touch-target">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
            <SelectValue placeholder="Sort by..." />
          </div>
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map(option => {
            const Icon = option.icon;
            return (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  {option.label}
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    );
  }

  // Segmented control for desktop
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Sort:</span>
      <div className="flex flex-wrap gap-2">
        {sortOptions.map(option => {
          const Icon = option.icon;
          const isActive = option.value === value;
          return (
            <Button
              key={option.value}
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              onClick={() => onChange(option.value)}
              className="flex items-center gap-1.5"
            >
              <Icon className="w-3.5 h-3.5" />
              {option.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
