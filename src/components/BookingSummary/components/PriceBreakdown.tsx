import React from 'react';
import { Info } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { HoverClickPopover } from '../../HoverClickPopover';
import { formatPriceDisplay, formatNumber, calculateFoodContributionRange } from '../BookingSummary.utils';
import { OptimizedSlider } from '../../shared/OptimizedSlider';
import type { Accommodation } from '../../../types';
import type { PricingDetails } from '../BookingSummary.types';

interface PriceBreakdownProps {
  selectedAccommodation: Accommodation | null;
  pricing: PricingDetails;
  foodContribution: number | null;
  setFoodContribution: (value: number | null) => void;
  isStateOfTheArtist: boolean;
  selectedWeeks: any[]; // Using any to avoid importing Week type
  onShowDiscountModal: () => void;
}

export function PriceBreakdown({
  selectedAccommodation,
  pricing,
  foodContribution,
  setFoodContribution,
  isStateOfTheArtist,
  selectedWeeks,
  onShowDiscountModal
}: PriceBreakdownProps) {
  // Local state for immediate slider feedback
  const [displayFoodContribution, setDisplayFoodContribution] = React.useState<number | null>(null);
  const isDraggingRef = React.useRef(false);
  
  // Calculate food contribution range with duration discount applied
  const foodRange = React.useMemo(() => {
    if (isStateOfTheArtist) {
      // Special case for State of the Artist event
      return { min: 390, max: 3600, defaultValue: 390 };
    }
    return calculateFoodContributionRange(pricing.totalNights, pricing.durationDiscountPercent / 100);
  }, [isStateOfTheArtist, pricing.totalNights, pricing.durationDiscountPercent]);
  
  // Sync display value with actual value only when not dragging
  React.useEffect(() => {
    if (!isDraggingRef.current) {
      setDisplayFoodContribution(foodContribution);
    }
  }, [foodContribution]);
  
  // Handle display value changes during drag
  const handleDisplayValueChange = React.useCallback((value: number) => {
    isDraggingRef.current = true;
    // Ensure value is within bounds
    const clampedValue = Math.max(foodRange.min, Math.min(foodRange.max, value));
    setDisplayFoodContribution(clampedValue);
    
    // Reset dragging flag shortly after (but don't reset display value)
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 200);
  }, [foodRange.min, foodRange.max]);
  
  console.log('[BookingSummary] Slider Range with duration discount:', { 
    foodRange, 
    isStateOfTheArtist, 
    durationDiscountPercent: pricing.durationDiscountPercent + '%'
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        {/* Restyle heading to match accommodation title */}
        <h3 className="text-primary font-display text-2xl block">Price breakdown</h3>
        <Tooltip.Provider>
          <Tooltip.Root delayDuration={50}>
            <Tooltip.Trigger asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation(); // Prevent event bubbling
                  onShowDiscountModal();
                }}
                className="p-1.5 text-[var(--color-accent-primary)] hover:text-[var(--color-accent-secondary)] rounded-md transition-colors cursor-pointer"
              >
                <Info className="w-4 h-4" />
                <span className="sr-only">View Discount Details</span>
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                className="tooltip-content !font-mono z-50"
                sideOffset={5}
              >
                Click for detailed breakdown
                <Tooltip.Arrow className="tooltip-arrow" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      </div>
      
      <div className="bg-surface space-y-4 p-4 rounded-sm"> {/* Increased spacing between items */}
        {selectedAccommodation ? (
          <>
            <div className="flex justify-between items-end"> {/* Outer flex - changed to end */}
              <div className="flex flex-col"> {/* Left block */}
                <span className="text-xs text-shade-2 font-lettra-bold">ACCOMMODATION</span>
                {/* Style duration like main dates, remove uppercase */}
                <span className="text-2xl lg:text-xl xl:text-2xl text-primary font-display">
                  {formatNumber(pricing.weeksStaying)} {pricing.weeksStaying === 1 ? 'week' : 'weeks'}
                </span>
              </div>
              {/* Price: Updated size, font, color */}
              <span className="text-xl lg:text-lg xl:text-xl font-display text-shade-1">{formatPriceDisplay(pricing.totalAccommodationCost)}</span> {/* Right block (price) */}
            </div>
            <hr className="border-t border-border my-2 opacity-30" /> {/* Horizontal line */}
          </>
        ) : (
          <div className="flex items-baseline min-h-[1.25rem]">
            <span className="text-sm text-secondary font-mono italic">No accommodation selected</span>
          </div>
        )}
        
        <>
          {/* --- Wrap the whole row in Popover.Root --- */}
          <div className="flex justify-between items-end"> {/* Align to bottom like Accommodation section */}
            {/* Left block (label and sub-label) */}
            <div className="flex flex-col flex-shrink-0"> {/* ADDED flex-shrink-0 HERE */}
              <span className="text-xs text-shade-2 font-lettra-bold flex items-center">
                FOOD AND FACILITIES
              </span>
              <span className="text-2xl lg:text-xl xl:text-2xl text-primary font-display">
                  {formatNumber(pricing.weeksStaying)} {pricing.weeksStaying === 1 ? 'week' : 'weeks'}
              </span>
            </div>

            {/* Right block (Icon Trigger + Price) */}
            <div className="flex flex-col items-end"> {/* Column layout, align items to the end (right) */}
              {/* Icon Trigger - Now HoverClickPopover */}
              <HoverClickPopover
                triggerContent={<Info className="w-4 h-4" />}
                triggerWrapperClassName="text-accent-primary hover:text-accent-secondary mb-1 cursor-default"
                popoverContentNode={<span className="text-primary">Community meals & operations costs</span>}
                contentClassName="tooltip-content !font-mono text-sm z-50"
                side="top"
                align="end"
                hoverCloseDelayMs={150}
              />
              {/* Price */}
              <span className="text-xl lg:text-lg xl:text-xl font-display text-shade-1">
                {formatPriceDisplay(pricing.totalFoodAndFacilitiesCost)}
              </span>
            </div>
          </div>
          <hr className="border-t border-border my-2 opacity-30" /> {/* Horizontal line */}
        </>

        {/* Optional Contribution Slider */}
        {foodContribution !== null && selectedWeeks.length > 0 && (
          <div className="pt-2"> {/* Reduced top padding */}
             {/* --- Label row with space-between --- */}
             <div className="flex justify-between items-center mb-2">
               <label htmlFor="food-contribution" className="text-xs text-shade-2 font-lettra-bold"> {/* Label */}
                  SLIDING CONTRIBUTION
                </label>
                {/* MODIFIED: Replaced with HoverClickPopover */}
                <HoverClickPopover
                  triggerContent={<Info className="w-4 h-4" />}
                  triggerWrapperClassName="text-accent-primary hover:text-accent-secondary cursor-default"
                  popoverContentNode="Adjust your contribution based on your means. Minimum varies by stay length."
                  contentClassName="tooltip-content !font-mono text-sm z-50"
                  side="top"
                  align="end"
                  hoverCloseDelayMs={150}
                />
              </div>

             {/* --- Optimized Slider for smooth performance --- */}
             <OptimizedSlider
               id="food-contribution"
               min={foodRange.min}
               max={foodRange.max}
               value={foodContribution ?? foodRange.defaultValue}
               onChange={(value) => setFoodContribution(value)}
               onDisplayValueChange={handleDisplayValueChange}
             />
              <div className="flex justify-between text-xs text-secondary mt-1 font-mono">
                 {/* Apply requested styles to Min */}
                 <span className="uppercase text-xs font-lettra-bold text-primary">
                   Min: €{foodRange.min}
                 </span>
                 {/* Apply requested styles to Rate - Shows immediate feedback */}
                 <span className="uppercase text-xs font-lettra-bold text-primary"> {/* Removed font-medium text-sm text-shade-1 font-mono */}
                   {/* Show the display value for immediate feedback, fallback to actual value */}
                   €{displayFoodContribution ?? foodContribution ?? foodRange.defaultValue} / week
                 </span>
                 {/* Apply requested styles to Max */}
                 <span className="uppercase text-xs font-lettra-bold text-primary">
                   Max: €{foodRange.max}
                 </span>
              </div>
           </div>
        )}
      </div>
    </div>
  );
}