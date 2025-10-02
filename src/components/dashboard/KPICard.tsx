import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string;
  change?: number;
  icon: LucideIcon;
  className?: string;
}

export function KPICard({ title, value, change, icon: Icon, className }: KPICardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <div className={cn("kpi-card group cursor-pointer", className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-primary/10 rounded-xl">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        {change !== undefined && (
          <div className={cn(
            "text-sm font-medium px-2 py-1 rounded-lg",
            isPositive && "text-success bg-success/10",
            isNegative && "text-destructive bg-destructive/10",
            change === 0 && "text-muted-foreground bg-muted/50"
          )}>
            {change > 0 && '+'}
            {change.toFixed(1)}%
          </div>
        )}
      </div>
      
      <div className="space-y-1">
        <p className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors">
          {value}
        </p>
        <p className="text-sm text-muted-foreground">{title}</p>
      </div>
    </div>
  );
}