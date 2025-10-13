import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Transaction, Category } from '@/types';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { AlertCircle } from 'lucide-react';

interface TransactionEditSheetProps {
  transaction: Transaction | null;
  categories: Category[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (sn: string, data: Partial<Transaction>) => void;
  isSaving?: boolean;
}

interface FormErrors {
  date?: string;
  time?: string;
  merchant?: string;
  amount?: string;
  category?: string;
}

export function TransactionEditSheet({
  transaction,
  categories,
  isOpen,
  onClose,
  onSave,
  isSaving = false,
}: TransactionEditSheetProps) {
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    merchant: '',
    amount: '',
    category: '',
    tag: '',
    cardEnding: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Initialize form when transaction changes
  useEffect(() => {
    if (transaction) {
      setFormData({
        date: transaction.date || '',
        time: transaction.time || '',
        merchant: transaction.merchant || '',
        amount: transaction.amount?.toString() || '',
        category: transaction.category || '',
        tag: transaction.tag || '',
        cardEnding: transaction.cardEnding || '',
      });
      setErrors({});
      setTouched({});
    }
  }, [transaction]);

  const validateField = (name: string, value: string): string | undefined => {
    switch (name) {
      case 'date':
        if (!value) return 'Date is required';
        break;
      case 'time':
        if (!value) return 'Time is required';
        if (!/^\d{2}:\d{2}$/.test(value)) return 'Invalid time format (HH:MM)';
        break;
      case 'merchant':
        if (!value.trim()) return 'Merchant is required';
        if (value.trim().length < 2) return 'Merchant name too short';
        break;
      case 'amount':
        if (!value) return 'Amount is required';
        const num = parseFloat(value);
        if (isNaN(num)) return 'Amount must be a number';
        if (num <= 0) return 'Amount must be positive';
        if (num > 999999) return 'Amount too large';
        break;
      case 'category':
        if (!value) return 'Category is required';
        break;
    }
    return undefined;
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    newErrors.date = validateField('date', formData.date);
    newErrors.time = validateField('time', formData.time);
    newErrors.merchant = validateField('merchant', formData.merchant);
    newErrors.amount = validateField('amount', formData.amount);
    newErrors.category = validateField('category', formData.category);

    setErrors(newErrors);
    return !Object.values(newErrors).some(error => error !== undefined);
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Validate on change if field was touched
    if (touched[field]) {
      const error = validateField(field, value);
      setErrors(prev => ({ ...prev, [field]: error }));
    }
  };

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const error = validateField(field, formData[field as keyof typeof formData]);
    setErrors(prev => ({ ...prev, [field]: error }));
  };

  const handleSave = () => {
    // Mark all fields as touched
    setTouched({
      date: true,
      time: true,
      merchant: true,
      amount: true,
      category: true,
    });

    if (!validateForm() || !transaction) return;

    const cleanData: Partial<Transaction> = {
      date: formData.date,
      time: formData.time.slice(0, 5),
      merchant: formData.merchant.trim(),
      amount: parseFloat(formData.amount),
      category: formData.category,
    };

    if (formData.tag) cleanData.tag = formData.tag.trim();
    if (formData.cardEnding) cleanData.cardEnding = formData.cardEnding;

    onSave(transaction.id.toString(), cleanData);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };

  if (!transaction) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Transaction</SheetTitle>
          <SheetDescription>
            Update transaction details. All fields marked with * are required.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4 pb-4">
          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-date" className="text-sm font-medium">
                Date *
              </Label>
              <Input
                id="edit-date"
                type="date"
                value={formData.date}
                onChange={(e) => handleChange('date', e.target.value)}
                onBlur={() => handleBlur('date')}
                onKeyDown={handleKeyDown}
                className={errors.date && touched.date ? 'border-red-500' : ''}
                disabled={isSaving}
              />
              {errors.date && touched.date && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.date}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-time" className="text-sm font-medium">
                Time *
              </Label>
              <Input
                id="edit-time"
                type="time"
                value={formData.time}
                onChange={(e) => handleChange('time', e.target.value)}
                onBlur={() => handleBlur('time')}
                onKeyDown={handleKeyDown}
                className={errors.time && touched.time ? 'border-red-500' : ''}
                disabled={isSaving}
              />
              {errors.time && touched.time && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.time}
                </p>
              )}
            </div>
          </div>

          {/* Merchant */}
          <div className="space-y-2">
            <Label htmlFor="edit-merchant" className="text-sm font-medium">
              Merchant *
            </Label>
            <Input
              id="edit-merchant"
              value={formData.merchant}
              onChange={(e) => handleChange('merchant', e.target.value)}
              onBlur={() => handleBlur('merchant')}
              onKeyDown={handleKeyDown}
              placeholder="Enter merchant name"
              className={errors.merchant && touched.merchant ? 'border-red-500' : ''}
              disabled={isSaving}
            />
            {errors.merchant && touched.merchant && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.merchant}
              </p>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="edit-amount" className="text-sm font-medium">
              Amount (BHD) *
            </Label>
            <Input
              id="edit-amount"
              type="number"
              step="0.001"
              value={formData.amount}
              onChange={(e) => handleChange('amount', e.target.value)}
              onBlur={() => handleBlur('amount')}
              onKeyDown={handleKeyDown}
              placeholder="0.000"
              className={errors.amount && touched.amount ? 'border-red-500' : ''}
              disabled={isSaving}
            />
            {errors.amount && touched.amount && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.amount}
              </p>
            )}
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="edit-category" className="text-sm font-medium">
              Category *
            </Label>
            <div className="relative">
              <select
                id="edit-category"
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value)}
                onBlur={() => handleBlur('category')}
                className={`w-full px-3 py-2 bg-input border rounded-lg text-sm text-foreground appearance-none cursor-pointer pr-8 ${
                  errors.category && touched.category ? 'border-red-500' : 'border-border'
                }`}
                disabled={isSaving}
              >
                <option value="">Select a category</option>
                {categories.map(cat => (
                  <option key={cat.name} value={cat.name}>{cat.name}</option>
                ))}
              </select>
              <svg
                className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {errors.category && touched.category && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.category}
              </p>
            )}
          </div>

          {/* Tag (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="edit-tag" className="text-sm font-medium text-muted-foreground">
              Tag (Optional)
            </Label>
            <Input
              id="edit-tag"
              value={formData.tag}
              onChange={(e) => handleChange('tag', e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a tag"
              disabled={isSaving}
            />
          </div>

          {/* Card Ending (Optional) */}
          {formData.cardEnding && (
            <div className="space-y-2">
              <Label htmlFor="edit-card" className="text-sm font-medium text-muted-foreground">
                Card Ending
              </Label>
              <Input
                id="edit-card"
                value={formData.cardEnding}
                onChange={(e) => handleChange('cardEnding', e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Last 4 digits"
                maxLength={4}
                disabled={isSaving}
              />
            </div>
          )}

          {/* Transaction ID (Read-only) */}
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Transaction ID: <span className="font-mono">{transaction.id}</span>
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 bg-background pt-4 pb-6 border-t border-border flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 touch-target"
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1 touch-target"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
