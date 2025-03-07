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
    switch (week.status) {
      case 'hidden':
        return 'border-yellow-400 bg-yellow-50';
      case 'deleted':
        return isAdmin ? 'border-red-400 bg-red-50 border-dashed' : 'border-stone-200 bg-white';
      case 'visible':
        return week.isCustom ? 'border-blue-400 bg-white' : 'border-stone-200 bg-white';
      default:
        return 'border-stone-200 bg-white';
    }
  };

  const classes = clsx(
    'relative p-4 border-2 transition-all duration-300',
    'aspect-[1.5] shadow-sm hover:shadow-md',
    'pixel-corners',
    getStatusColor(),
    isSelected && 'border-emerald-600 shadow-lg bg-white',
    !isSelected && isConsecutive && 'border-emerald-600/20',
    !isSelectable && !isAdmin && 'opacity-50 cursor-not-allowed',
    isAdmin && 'cursor-pointer hover:border-blue-400',
    className
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
    >
      <div className="text-center flex flex-col justify-center h-full">
        {isSelected ? (
          isEdge ? (
            <>
              <div className="text-2xl font-display mb-1">
                {format(isFirstSelected ? week.startDate : week.endDate, 'MMM d')}
              </div>
              <div className="font-mono text-sm text-emerald-700 font-medium">
                {isFirstSelected ? 
                  (selectedWeeksCount > 1 ? 'Arrival' : `→ ${format(week.endDate, 'MMM d')}`) : 
                  'Departure'}
              </div>
            </>
          ) : null
        ) : (
          <>
            <div className="text-2xl font-display mb-1">
              {week.name || format(week.startDate, 'MMM d')}
            </div>
            {!week.name && (
              <div className="font-mono text-sm text-stone-500 flex items-center justify-center gap-2">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M4 12h16m0 0l-6-6m6 6l-6 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>{format(week.endDate, 'MMM d')}</span>
              </div>
            )}
            {week.name && (
              <div className="font-mono text-xs text-stone-500 flex items-center justify-center gap-1">
                <span>{format(week.startDate, 'MMM d')}</span>
                <svg className="w-2 h-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M4 12h16m0 0l-6-6m6 6l-6 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>{format(week.endDate, 'MMM d')}</span>
              </div>
            )}
            {isAdmin && week?.status !== 'default' && (
              <div className={clsx(
                'text-xs font-medium',
                week.status === 'hidden' && 'text-yellow-600',
                week.status === 'deleted' && 'text-red-600',
                week.status === 'visible' && 'text-blue-600'
              )}>
                {week.status}
              </div>
            )}
            
            {(() => {
              if (!week) return null;
              const diffTime = week.endDate.getTime() - week.startDate.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 because both start and end dates are inclusive
              
              // Only show duration for custom weeks that aren't 7 days long
              // AND are not at the edge of the view range (first or last week)
              if (diffDays !== 7 && week.isCustom && !week.isEdgeWeek) {
                return (
                  <div className="text-xs text-indigo-600 font-medium mt-1">
                    {diffDays} {diffDays === 1 ? 'day' : 'days'}
                  </div>
                );
              }
              return null;
            })()}
          </>
        )}
      </div>

      {isSelected && !isEdge && (
        <>
          <div className="connecting-line left" />
          <div className="connecting-line right" />
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            preserveAspectRatio="none"
            viewBox="0 0 100 30"
          >
            <path
              d="M 0 15 Q 25 5, 50 15 T 100 15"
              className="squiggle-path"
              stroke="rgb(5, 150, 105)"
              strokeWidth="2"
              fill="none"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </>
      )}

      {squigglePath && (
        <svg
          className="absolute bottom-0 left-0 w-full"
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

      <div 
        className={clsx(
          'absolute bottom-0 left-0 right-0 transition-all duration-300',
          isSelected ? 'bg-emerald-600/40 h-1.5' : 'bg-stone-200/40 h-1'
        )}
      />
    </motion.button>
  );
}