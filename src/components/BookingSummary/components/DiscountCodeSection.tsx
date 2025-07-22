import React from 'react';
import { X, Tag, AlertTriangle } from 'lucide-react';
import type { AppliedDiscount } from '../BookingSummary.types';
import { getAppliesToText } from '../BookingSummary.utils';

interface DiscountCodeSectionProps {
  appliedDiscount: AppliedDiscount | null;
  discountCodeInput: string;
  setDiscountCodeInput: (value: string) => void;
  discountError: string | null;
  isApplyingDiscount: boolean;
  onApplyDiscount: () => void;
  onRemoveDiscount: () => void;
}

export function DiscountCodeSection({
  appliedDiscount,
  discountCodeInput,
  setDiscountCodeInput,
  discountError,
  isApplyingDiscount,
  onApplyDiscount,
  onRemoveDiscount
}: DiscountCodeSectionProps) {
  return (
    <div className="pt-4 mt-4 font-mono">
      {!appliedDiscount ? (
        <div>
           <label htmlFor="discount-code" className="uppercase text-primary font-display text-2xl">Code</label>
           <div className="flex flex-col xxs:flex-row gap-2 mt-2 w-full"> {/* Stack vertically only on very small screens, horizontal on xxs+ */}
              <input 
                type="text"
                id="discount-code"
                value={discountCodeInput}
                onChange={(e) => setDiscountCodeInput(e.target.value.toUpperCase())}
                className="w-full xxs:flex-1 px-3 py-2 bg-[var(--color-input-bg)] border border-border rounded-sm focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent text-primary placeholder:text-shade-1 placeholder:font-display text-sm disabled:bg-transparent disabled:text-shade-3"
                placeholder="ENTER CODE"
                disabled={isApplyingDiscount}
              />
              <button
                onClick={onApplyDiscount}
                disabled={isApplyingDiscount || !discountCodeInput.trim()}
                className="w-full xxs:w-auto xxs:flex-shrink-0 px-3 py-2 bg-[var(--color-input-bg)] border border-border rounded-sm focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent text-primary text-sm font-display whitespace-nowrap disabled:bg-transparent disabled:text-shade-3 disabled:border-transparent"
              >
                {isApplyingDiscount ? 'APPLYING...' : 'APPLY'}
              </button>
           </div>
           {discountError && (
              <div className="mt-2 text-xs text-error flex items-center gap-1">
                 <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                 <span>{discountError}</span>
              </div>
           )}
        </div>
      ) : (
        <div className="p-3 bg-success-muted rounded-md border border-success">
            <div className="flex justify-between items-start"> {/* Changed items-center to items-start */}
                <div> {/* Wrapper for discount text lines */}
                    <div className="flex items-center gap-2 text-sm text-success">
                        <Tag className="w-4 h-4 flex-shrink-0" />
                        <span>Applied: <strong>{appliedDiscount.code}</strong> (-{appliedDiscount.percentage_discount}%)</span>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 ml-[calc(1rem+0.5rem)]"> {/* Indented, smaller, muted text. Adjust ml if icon/gap changes. 1rem for w-4 icon, 0.5rem for gap-2 */}
                        Applies to: <span className="font-medium">{getAppliesToText(appliedDiscount.applies_to)}</span>
                    </div>
                </div>
                <button 
                    onClick={onRemoveDiscount}
                    className="p-1 text-success hover:text-error hover:bg-error-muted rounded-full text-xs flex-shrink-0" // Added flex-shrink-0
                    title="Remove code"
                >
                    <X className="w-3 h-3" />
                </button>
            </div>
        </div>
      )}
    </div>
  );
}