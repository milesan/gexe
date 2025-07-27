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
  if (availableCredits === 0) {
    return null;
  }

  // Calculate the maximum credits that can be used
  const maxCredits = Math.min(availableCredits, pricing.totalAmount);
  
  // Ensure creditsToUse is 0 when credits are disabled
  React.useEffect(() => {
    console.log('[CreditsSection] === CREDITS TOGGLE EFFECT TRIGGERED ===');
    console.log('[CreditsSection] Current state:', {
      creditsEnabled,
      creditsToUse,
      availableCredits,
      maxCredits
    });
    
    if (!creditsEnabled && creditsToUse > 0) {
      console.log('[CreditsSection] ✅ Credits disabled, setting creditsToUse to 0');
      setCreditsToUse(0);
    } else if (creditsEnabled && creditsToUse === 0) {
      console.log('[CreditsSection] ✅ Credits enabled but creditsToUse is 0, this is expected');
    } else {
      console.log('[CreditsSection] ℹ️ No action needed:', {
        creditsEnabled,
        creditsToUse,
        action: 'none'
      });
    }
  }, [creditsEnabled, setCreditsToUse, availableCredits, maxCredits]); // REMOVED creditsToUse from dependencies
  
  // Smart stepping: use integer steps but allow exact max
  const sliderMax = Math.floor(maxCredits);
  
  // Handler that snaps to exact max when at the end
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    
    console.log('[CreditsSection] === SLIDER CHANGE TRIGGERED ===');
    console.log('[CreditsSection] Slider change details:', {
      newValue: value,
      sliderMax,
      maxCredits,
      currentCreditsToUse: creditsToUse,
      willUseExactMax: value === sliderMax && maxCredits > sliderMax
    });
    
    // If slider is at max position, use the exact decimal amount
    if (value === sliderMax && maxCredits > sliderMax) {
      console.log('[CreditsSection] Using exact max credits:', maxCredits);
      setCreditsToUse(maxCredits);
    } else {
      console.log('[CreditsSection] Using slider value:', value);
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
        <label className={`relative inline-flex items-center ${creditsLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
          <input 
            type="checkbox" 
            checked={creditsEnabled}
            onChange={(e) => {
              if (!creditsLoading) {
                setCreditsEnabled(e.target.checked);
              }
            }}
            disabled={creditsLoading}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-border rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-primary"></div>
        </label>
      </div>
      
      <div className="text-xs text-shade-2 font-lettra mb-4">
        Available: <span className="font-display text-accent-primary">
          {creditsLoading ? (
            <span className="inline-flex items-center gap-1">
              <div className="w-3 h-3 border-2 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin"></div>
              Loading...
            </span>
          ) : (
            `${availableCredits.toFixed(2)} credits`
          )}
        </span>
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
              disabled={creditsLoading}
              className={`w-full h-2 bg-border rounded-sm appearance-none accent-accent-primary slider-thumb-accent ${creditsLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
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