import { useState } from 'react';
import { Edit2, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Transaction } from '@/types';
import { getCategoryColor } from '@/utils/categoryColors';
import { getCategoryIcon } from '@/utils/categoryIcons';

interface TransactionCardProps {
  transaction: Transaction;
  onEdit: (transaction: Transaction) => void;
  onDelete: (sn: string) => void;
}

export function TransactionCard({ transaction, onEdit, onDelete }: TransactionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const Icon = getCategoryIcon(transaction.category);
  const categoryColor = getCategoryColor(transaction.category);

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
      {/* Main Content - Always Visible */}
      <div
        className="p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start gap-3">
          {/* Category Icon */}
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: `${categoryColor}20`,
            }}
          >
            <Icon className="w-5 h-5" style={{ color: categoryColor }} />
          </div>

          {/* Transaction Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground truncate">
                  {transaction.merchant}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {new Date(transaction.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                  })} • {transaction.time}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-semibold text-foreground currency-bhd">
                  {transaction.amount.toFixed(3)}
                </p>
                <div className="flex items-center gap-1 justify-end mt-1">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: categoryColor }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {transaction.category}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Expand Icon */}
          <div className="flex-shrink-0 ml-2">
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-border">
          <div className="p-4 space-y-3 bg-muted/20">
            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs mb-1">ID</p>
                <p className="font-mono text-foreground">{transaction.id}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Tag</p>
                <p className="text-foreground">{transaction.tag || '—'}</p>
              </div>
              {transaction.cardEnding && (
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs mb-1">Card</p>
                  <p className="text-foreground">**** {transaction.cardEnding}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 touch-target"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(transaction);
                }}
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 touch-target text-red-600 hover:text-red-600"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(transaction.id.toString());
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
