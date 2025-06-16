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
    // Create container element outside React
    this.container = document.createElement('div');
    this.container.style.position = 'fixed';
    this.container.style.top = '0';
    this.container.style.left = '0';
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.pointerEvents = 'none';
    this.container.style.zIndex = '9999';
    document.body.appendChild(this.container);
  }

  trigger(x: number, y: number) {
    const id = this.nextId++;
    this.triggers.set(id, { x, y, timestamp: Date.now() });
    
    // Notify all listeners
    this.updateCallbacks.forEach(cb => cb());
    
    // Auto-cleanup after animation
    setTimeout(() => {
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
    return this.container;
  }
}

// Create singleton instance
const fireflyManager = new FireflyManager();

// Export the trigger function for use in other components
export const triggerFireflies = (x: number, y: number) => {
  fireflyManager.trigger(x, y);
};

// Portal component that renders fireflies
export function FireflyPortal() {
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);
  
  useEffect(() => {
    // Subscribe to updates
    const unsubscribe = fireflyManager.subscribe(() => {
      forceUpdate();
    });
    
    return unsubscribe;
  }, []);

  const container = fireflyManager.getContainer();
  if (!container) return null;

  const triggers = fireflyManager.getTriggers();

  return ReactDOM.createPortal(
    <>
      {triggers.map(({ id, x, y }) => (
        <div
          key={id}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none'
          }}
        >
          <Fireflies
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
        </div>
      ))}
    </>,
    container
  );
} 