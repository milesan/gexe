import React from 'react';
import { Info } from 'lucide-react';
import { HoverClickPopover } from '../../HoverClickPopover';
import { formatPriceDisplay } from '../BookingSummary.utils';
import type { PricingDetails } from '../BookingSummary.types';

interface CreditsSectionProps {
  availableCredits: number;
  creditsLoading: boolean;
  creditsEnabled: boolean;
  setCreditsEnabled: (value: boolean) => void;
  creditsToUse: number;
  setCreditsToUse: (value: number) => void;
  pricing: PricingDetails;
  finalAmountAfterCredits: number;
}

export function CreditsSection({
  availableCredits,
  creditsLoading,
  creditsEnabled,
  setCreditsEnabled,
  creditsToUse,
  setCreditsToUse,
  pricing,
  finalAmountAfterCredits
}: CreditsSectionProps) {
  if (creditsLoading || availableCredits === 0) {
    return null;
  }

  // Calculate the maximum credits that can be used
  const maxCredits = Math.min(availableCredits, pricing.totalAmount);
  
  // Smart stepping: use integer steps but allow exact max
  const sliderMax = Math.floor(maxCredits);
  
  // Handler that snaps to exact max when at the end
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    
    // If slider is at max position, use the exact decimal amount
    if (value === sliderMax && maxCredits > sliderMax) {
      setCreditsToUse(maxCredits);
    } else {
      setCreditsToUse(value);
    }
  };

  return (
    <div className="mt-6 p-4 bg-accent-primary/5 border border-accent-primary/20 rounded-md">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-accent-primary rounded-full"></div>
          <h3 className="uppercase text-primary font-display text-lg">Use Credits</h3>
          <HoverClickPopover
            triggerContent={<Info className="w-4 h-4" />}
            triggerWrapperClassName="text-accent-primary hover:text-accent-secondary cursor-default"
            popoverContentNode="Use instead of money, or save for later ✨"
            contentClassName="tooltip-content !font-mono text-sm z-[120]"
            side="top"
            align="start"
            hoverCloseDelayMs={150}
          />
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            checked={creditsEnabled}
            onChange={(e) => setCreditsEnabled(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-border rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-primary"></div>
        </label>
      </div>
      
      <div className="text-xs text-shade-2 font-lettra mb-4">
        Available: <span className="font-display text-accent-primary">{availableCredits.toFixed(2)} credits</span>
      </div>
      
      {creditsEnabled && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-shade-2 font-lettra">Credits to use</span>
              <span className="text-lg font-display text-accent-primary">{creditsToUse.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={sliderMax}
              step={1}
              value={Math.min(creditsToUse, sliderMax)}
              onChange={handleSliderChange}
              className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-accent-primary slider-thumb-accent"
            />
            <div className="flex justify-between text-xs text-shade-3 font-lettra">
              <span>0</span>
              <span>{maxCredits.toFixed(2)}</span>
            </div>
          </div>
          
          <div className="pt-3 border-t border-accent-primary/20">
            {creditsToUse > 0 && (
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-sm text-shade-2 font-lettra">Credit savings</span>
                <span className="text-lg font-display text-success">-€{creditsToUse.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-lettra-bold text-primary">TOTAL TO PAY</span>
              <span className="text-xl font-display text-primary">
                {formatPriceDisplay(finalAmountAfterCredits)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}