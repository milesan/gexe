import { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Fireflies } from './Fireflies';
import React from 'react';

// Singleton instance to manage firefly triggers
class FireflyManager {
  private container: HTMLDivElement | null = null;
  private triggers: Map<number, { x: number; y: number; timestamp: number }> = new Map();
  private nextId = 0;
  private updateCallbacks: Set<() => void> = new Set();

  constructor() {
    // Ensure DOM is ready before creating container
    if (typeof document !== 'undefined') {
      this.createContainer();
    } else {
      // If document is not ready, wait for it
      if (typeof window !== 'undefined') {
        window.addEventListener('DOMContentLoaded', () => this.createContainer());
      }
    }
  }

  private createContainer() {
    if (this.container) return; // Already created
    
    // Create container element outside React
    this.container = document.createElement('div');
    this.container.id = 'firefly-portal-container'; // Add ID for debugging
    this.container.style.position = 'fixed'; // Back to fixed
    this.container.style.top = '0';
    this.container.style.left = '0';
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.pointerEvents = 'none';
    this.container.style.zIndex = '99999'; // Increased z-index
    document.body.appendChild(this.container);
    console.log('[FireflyManager] Container created and appended to body', this.container);
    
    // Update container height when window resizes or content changes
    const updateContainerHeight = () => {
      if (this.container) {
        const newHeight = Math.max(
          document.body.scrollHeight,
          document.body.offsetHeight,
          document.documentElement.clientHeight,
          document.documentElement.scrollHeight,
          document.documentElement.offsetHeight
        );
        this.container.style.height = `${newHeight}px`;
      }
    };
    
    window.addEventListener('resize', updateContainerHeight);
    // Also update on DOM changes (in case content height changes)
    const observer = new MutationObserver(updateContainerHeight);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  trigger(x: number, y: number) {
    console.log('[FireflyManager] Trigger called with position:', { x, y });
    const id = this.nextId++;
    // Store the page coordinates (x, y are already page coordinates from the click event)
    this.triggers.set(id, { x, y, timestamp: Date.now() });
    console.log('[FireflyManager] Current triggers:', this.triggers.size);
    
    // Notify all listeners
    this.updateCallbacks.forEach(cb => cb());
    
    // Auto-cleanup after animation
    setTimeout(() => {
      console.log('[FireflyManager] Cleaning up trigger:', id);
      this.triggers.delete(id);
      this.updateCallbacks.forEach(cb => cb());
    }, 1600);
  }

  subscribe(callback: () => void) {
    this.updateCallbacks.add(callback);
    return () => {
      this.updateCallbacks.delete(callback);
    };
  }

  getTriggers() {
    return Array.from(this.triggers.entries()).map(([id, data]) => ({
      id,
      ...data
    }));
  }

  getContainer() {
    if (!this.container && typeof document !== 'undefined') {
      this.createContainer();
    }
    return this.container;
  }
}

// Remove top-level instantiation
// const fireflyManager = new FireflyManager();

let fireflyManager: FireflyManager | null = null;

export function getFireflyManager() {
  if (!fireflyManager) {
    fireflyManager = new FireflyManager();
  }
  return fireflyManager;
}

// Export the trigger function for use in other components
export const triggerFireflies = (x: number, y: number) => {
  console.log('[triggerFireflies] Function called with:', { x, y });
  getFireflyManager().trigger(x, y);
};

// Memoized Firefly component to prevent re-renders
const MemoizedFirefly = React.memo(({ id, x, y }: { id: number; x: number; y: number }) => {
  console.log('[FireflyPortal] Rendering MemoizedFirefly:', { id, x, y });
  return (
    <Fireflies
      key={`firefly-${id}`}
      count={12}
      color="#ffd700"
      minSize={0.5}
      maxSize={1.5}
      fadeIn={true}
      fadeOut={true}
      duration={1500}
      clickTrigger={false}
      ambient={false}
      visible={true}
      position={{ x, y }}
      localized={true}
      localizedRadius={80}
      className="pointer-events-none"
    />
  );
}, (prevProps, nextProps) => {
  // Only re-render if props actually change
  return prevProps.id === nextProps.id && 
         prevProps.x === nextProps.x && 
         prevProps.y === nextProps.y;
});

// Portal component that renders fireflies
export function FireflyPortal() {
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);
  
  useEffect(() => {
    console.log('[FireflyPortal] Component mounted');
    // Subscribe to updates
    const unsubscribe = getFireflyManager().subscribe(() => {
      console.log('[FireflyPortal] Update callback triggered');
      forceUpdate();
    });
    
    return unsubscribe;
  }, []);

  const container = getFireflyManager().getContainer();
  if (!container) {
    console.log('[FireflyPortal] No container found');
    return null;
  }

  const triggers = getFireflyManager().getTriggers();
  console.log('[FireflyPortal] Rendering with triggers:', triggers.length);

  return ReactDOM.createPortal(
    <>
      {triggers.map(({ id, x, y }) => (
        <MemoizedFirefly key={`trigger-${id}`} id={id} x={x} y={y} />
      ))}
    </>,
    container
  );
} 