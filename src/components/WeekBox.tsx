import React from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import clsx from 'clsx';
import { Week } from '../types/calendar';

interface Props {
  week: Week;
  isSelected: boolean;
  isConsecutive: boolean;
  isEdge: boolean;
  isFirstSelected?: boolean;
  isLastSelected?: boolean;
  isSelectable: boolean;
  onClick: () => void;
  selectedWeeksCount?: number;
  isAdmin?: boolean;
  className?: string;
  squigglePath?: string;
}

export function WeekBox({
  week,
  isSelected,
  isConsecutive,
  isEdge,
  isFirstSelected,
  isLastSelected,
  isSelectable,
  onClick,
  selectedWeeksCount = 0,
  isAdmin = false,
  className,
  squigglePath
}: Props) {
  console.log('[WeekBox] Rendering:', {
    weekDates: {
      start: week.startDate.toISOString(),
      end: week.endDate.toISOString()
    },
    weekStatus: week.status,
    weekName: week.name,
    weekId: week.id,
    isCustom: week.isCustom,
    isAdmin,
    states: {
      isSelected,
      isFirstSelected,
      isLastSelected,
      isSelectable
    }
  });

  // Get status color based on week status
  const getStatusColor = () => {
    // Default to surface background and standard border
    let bgColor = 'bg-surface';
    let borderColor = 'border-border'; 

    switch (week.status) {
      case 'hidden':
        borderColor = 'border-yellow-400'; // Keep yellow border
        // Use subtle yellow background only in admin?
        if (isAdmin) bgColor = 'bg-yellow-500/10'; 
        break;
      case 'deleted':
        if (isAdmin) {
          borderColor = 'border-red-400 border-dashed'; // Keep red border + dashed
          bgColor = 'bg-red-500/10';
        }
        // Non-admin deleted weeks look like default
        break;
      case 'visible':
        if (week.isCustom) {
          borderColor = 'border-blue-400'; // Keep blue border for custom visible
        }
        // Default visible weeks use standard border/bg
        break;
      default:
        // Standard border/bg
        break;
    }
    return `${bgColor} ${borderColor}`;
  };

  const classes = clsx(
    'relative p-4 border-2 transition-all duration-300',
    'aspect-[1.5] shadow-sm hover:shadow-md',
    'pixel-corners',
    getStatusColor(), // Apply status-based bg/border
    // Override for selected state:
    isSelected && 'border-accent-primary shadow-lg bg-surface', // Ensure bg-surface is explicitly set here too
    // Style for weeks between selection (passed from WeekSelector via className? Check WeekSelector logic)
    // !isSelected && isConsecutive && 'border-accent-primary/20', // This might be handled by className prop now
    !isSelectable && !isAdmin && 'opacity-50 cursor-not-allowed',
    isAdmin && isSelectable && 'cursor-pointer hover:border-blue-400', // Keep admin hover
    className // Allow classes from WeekSelector to override/add
  );

  console.log('[WeekBox] Applied classes:', {
    weekDates: {
      start: week.startDate.toISOString(),
      end: week.endDate.toISOString()
    },
    classes,
    states: {
      isSelected,
      isFirstSelected,
      isLastSelected,
      isSelectable
    }
  });

  console.log('[WeekBox] Rendering with classes:', {
    weekDates: {
      start: week.startDate.toISOString(),
      end: week.endDate.toISOString()
    },
    weekStatus: week.status,
    weekName: week.name,
    isCustom: week.isCustom,
    appliedClasses: classes,
    states: {
      isSelected,
      isFirstSelected,
      isLastSelected,
      isSelectable
    }
  });

  return (
    <motion.button
      onClick={onClick}
      className={classes}
      whileHover={isSelectable || isAdmin ? { scale: 1.02 } : undefined}
      whileTap={isSelectable || isAdmin ? { scale: 0.98 } : undefined}
      disabled={!isSelectable && !isAdmin} // Explicitly disable if not selectable
    >
      <div className="text-center flex flex-col justify-center h-full">
        {isSelected ? (
          isEdge ? (
            <>
              <div className="text-2xl font-display mb-1 text-primary">
                {format(isFirstSelected ? week.startDate : week.endDate, 'MMM d')}
              </div>
              <div className="font-mono text-sm text-accent-secondary font-medium">
                {isFirstSelected ? 
                  (selectedWeeksCount > 1 ? 'Arrival' : `→ ${format(week.endDate, 'MMM d')}`) : 
                  'Departure'}
              </div>
            </>
          ) : null // Don't render content for middle selected weeks in WeekBox itself?
        ) : (
          <>
            <div className="text-2xl font-display mb-1 text-primary">
              {week.name || format(week.startDate, 'MMM d')}
            </div>
            {!week.name && (
              <div className="font-mono text-sm text-secondary flex items-center justify-center gap-2">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M4 12h16m0 0l-6-6m6 6l-6 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>{format(week.endDate, 'MMM d')}</span>
              </div>
            )}
            {week.name && (
              <div className="font-mono text-xs text-secondary flex items-center justify-center gap-1">
                <span>{format(week.startDate, 'MMM d')}</span>
                <svg className="w-2 h-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M4 12h16m0 0l-6-6m6 6l-6 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>{format(week.endDate, 'MMM d')}</span>
              </div>
            )}
            {/* Admin status text - keeping specific colors */}
            {isAdmin && week?.status !== 'default' && (
              <div className={clsx(
                'text-xs font-medium mt-1',
                week.status === 'hidden' && 'text-yellow-500',
                week.status === 'deleted' && 'text-red-500',
                week.status === 'visible' && week.isCustom && 'text-blue-500'
              )}>
                {week.status}
              </div>
            )}
            
            {/* Custom duration text - keeping specific color */}
            {(() => {
              if (!week) return null;
              const diffTime = week.endDate.getTime() - week.startDate.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 because both start and end dates are inclusive
              
              // Only show duration for custom weeks that aren't 7 days long
              // AND are not at the edge of the view range (first or last week)
              if (diffDays !== 7 && week.isCustom && !week.isEdgeWeek) {
                return (
                  <div className="text-xs text-indigo-500 font-medium mt-1">
                    {diffDays} {diffDays === 1 ? 'day' : 'days'}
                  </div>
                );
              }
              return null;
            })()}
          </>
        )}
      </div>

      {/* Connecting lines and squiggle - keeping colors? */}
      {isSelected && !isEdge && (
        <>
          {/* Consider theming connecting-line in index.css if not done already */}
          <div className="connecting-line left" />
          <div className="connecting-line right" />
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            preserveAspectRatio="none"
            viewBox="0 0 100 30"
          >
            {/* Squiggle color needs theme variable */}
            <path
              d="M 0 15 Q 25 5, 50 15 T 100 15"
              className="squiggle-path"
              // stroke="rgb(5, 150, 105)" // old emerald-600
              stroke="var(--color-accent-primary)"
              strokeWidth="2"
              fill="none"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </>
      )}

      {/* Optional squiggle path from props - color should be text-secondary? */}
      {squigglePath && (
        <svg
          className="absolute bottom-0 left-0 w-full text-secondary/50" // Use themed secondary text color with opacity
          viewBox="0 0 100 10"
          preserveAspectRatio="none"
        >
          <path
            d={squigglePath}
            className="stroke-current"
            fill="none"
            strokeWidth="1"
          />
        </svg>
      )}

      {/* Bottom line indicator */}
      <div 
        className={clsx(
          'absolute bottom-0 left-0 right-0 transition-all duration-300',
          // Use theme variables for background
          isSelected ? 'bg-accent-primary/40 h-1.5' : 'bg-border/40 h-1'
        )}
      />
    </motion.button>
  );
}