import React, { useState, useRef } from 'react';
import * as Popover from '@radix-ui/react-popover';
import type { PopoverContentProps } from '@radix-ui/react-popover';
import clsx from 'clsx';

interface HoverClickPopoverProps {
  triggerContent: React.ReactNode;
  popoverContentNode: React.ReactNode; // Changed from popoverContentText to popoverContentNode for flexibility
  triggerWrapperClassName?: string; // ClassName for the button wrapper of the trigger
  contentClassName?: string;
  sideOffset?: number;
  arrowClassName?: string;
  arrowWidth?: number;
  arrowHeight?: number;
  side?: PopoverContentProps['side'];
  align?: PopoverContentProps['align'];
  hoverCloseDelayMs?: number; // Add new prop for hover close delay
}

export const HoverClickPopover: React.FC<HoverClickPopoverProps> = ({
  triggerContent,
  popoverContentNode,
  triggerWrapperClassName = "flex items-center gap-1 bg-transparent border-none p-0.5 cursor-default",
  contentClassName = "tooltip-content !font-mono z-50",
  sideOffset = 5,
  arrowClassName = "tooltip-arrow",
  arrowWidth = 11,
  arrowHeight = 5,
  side,
  align,
  hoverCloseDelayMs = 10, // Default to 10ms
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const isClickOpenedRef = useRef(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearHoverTimeout = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  // This function is called by Radix when it wants to change the open state (e.g. Escape, click outside)
  // or when we programmatically change it.
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // If the popover is closing for any reason, reset the click-opened state and any pending hover close.
      isClickOpenedRef.current = false;
      clearHoverTimeout();
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent interference with other click handlers
    clearHoverTimeout(); // Cancel any pending hover actions

    if (isOpen) {
      // If it's currently open, a click should close it.
      setIsOpen(false);
      isClickOpenedRef.current = false; // Reset click-opened state
    } else {
      // If it's currently closed, a click should open it.
      setIsOpen(true);
      isClickOpenedRef.current = true; // Mark as click-opened
    }
  };

  const handleMouseEnterTrigger = () => {
    clearHoverTimeout();
    // Open on hover only if it's not already open (especially if not click-opened).
    // If it is already open (e.g. by click), hovering trigger shouldn't change its state.
    if (!isOpen) {
        setIsOpen(true);
        // isClickOpenedRef remains false, indicating this was likely hover-initiated
    }
  };
  
  const startHoverCloseTimer = () => {
    // Only start the close timer if the popover was NOT opened by a click.
    if (!isClickOpenedRef.current) {
      clearHoverTimeout(); // Clear any existing timer first
      hoverTimeoutRef.current = setTimeout(() => {
        setIsOpen(false);
      }, hoverCloseDelayMs); // Use the prop for the delay
    }
  };

  const handleMouseEnterContent = () => {
    // If the mouse enters the content, we should cancel any pending hover-close timer.
    // This allows the user to move their mouse from the trigger to the content.
    if (!isClickOpenedRef.current) { // Only manage hover if not click-opened
        clearHoverTimeout();
        // Ensure it's open if mouse enters content, in case it was a hover-initiated action.
        // This is mostly a safeguard or if the trigger itself didn't set it open yet.
        if(!isOpen) {
            setIsOpen(true);
        }
    }
  };

  return (
    <Popover.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button" // Explicitly type as button
          onClick={handleClick}
          onMouseEnter={handleMouseEnterTrigger}
          onMouseLeave={startHoverCloseTimer} // Start timer when mouse leaves trigger
          className={triggerWrapperClassName}
          aria-expanded={isOpen}
        >
          {triggerContent}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={sideOffset}
          className={contentClassName}
          onOpenAutoFocus={(e) => e.preventDefault()} // Preserve original focus behavior
          onMouseEnter={handleMouseEnterContent}     // Cancel close timer when mouse enters content
          onMouseLeave={startHoverCloseTimer}       // Start close timer when mouse leaves content
          side={side}
          align={align}
          // Radix handles pointer events for closing on click outside etc. via onOpenChange
        >
          <Popover.Arrow className={arrowClassName} width={arrowWidth} height={arrowHeight} />
          {popoverContentNode}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}; 