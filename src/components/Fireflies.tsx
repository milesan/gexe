import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FireflyProps {
  count?: number;
  color?: string;
  minSize?: number;
  maxSize?: number;
  fadeIn?: boolean;
  fadeOut?: boolean;
  duration?: number;
  clickTrigger?: boolean;
  ambient?: boolean;
  className?: string;
  visible?: boolean;
  position?: { x: number; y: number };
  localized?: boolean;
  localizedRadius?: number;
  contained?: boolean;
}

interface FireflyParticle {
  x: number;
  y: number;
  size: number;
  angle: number;
  velocity: number;
  opacity: number;
  fadeDirection: number;
  lifespan: number;
  age: number;
}

export function Fireflies({
  count = 50,
  color = '#fddba3',
  minSize = 1,
  maxSize = 3,
  fadeIn = true,
  fadeOut = true,
  duration = 5000,
  clickTrigger = false,
  ambient = true,
  className = '',
  visible,
  position,
  localized = false,
  localizedRadius = 150,
  contained = false
}: FireflyProps) {
  console.log('[Fireflies] Component mounting with props:', {
    count, color, minSize, maxSize, fadeIn, fadeOut, duration, clickTrigger, ambient, visible, position, localized, localizedRadius, contained
  });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const mountedRef = useRef<boolean>(false);
  const [isVisible, setIsVisible] = useState(visible ?? ambient);
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(position ?? null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (visible !== undefined) {
      setIsVisible(visible);
    }
  }, [visible]);

  useEffect(() => {
    if (position) {
      // Position prop contains page coordinates
      setClickPosition(position);
    }
  }, [position]);

  useEffect(() => {
    console.log('[Fireflies] Main effect running, isVisible:', isVisible, 'clickPosition:', clickPosition);
    
    const canvas = canvasRef.current;
    if (!canvas) {
      console.log('[Fireflies] No canvas ref found');
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.log('[Fireflies] No 2D context found');
      return;
    }

    // Set canvas size
    const updateCanvasSize = () => {
      if (localized && clickPosition) {
        // For localized mode, create a smaller canvas around the click point
        canvas.width = localizedRadius * 2;
        canvas.height = localizedRadius * 2;
        canvas.style.position = 'fixed'; // Use fixed positioning
        
        // Convert page coordinates to viewport coordinates
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const viewportX = clickPosition.x - scrollX;
        const viewportY = clickPosition.y - scrollY;
        
        canvas.style.left = `${viewportX - localizedRadius}px`;
        canvas.style.top = `${viewportY - localizedRadius}px`;
        canvas.style.width = `${localizedRadius * 2}px`;
        canvas.style.height = `${localizedRadius * 2}px`;
        console.log('[Fireflies] Canvas positioned at:', {
          pageX: clickPosition.x,
          pageY: clickPosition.y,
          viewportX: viewportX,
          viewportY: viewportY,
          left: viewportX - localizedRadius,
          top: viewportY - localizedRadius,
          scrollX,
          scrollY
        });
        
        // Debug: Check if canvas is visible in viewport
        const rect = canvas.getBoundingClientRect();
        console.log('[Fireflies] Canvas viewport position:', {
          top: rect.top,
          left: rect.left,
          bottom: rect.bottom,
          right: rect.right,
          isVisible: rect.top < window.innerHeight && rect.bottom > 0
        });
      } else if (contained) {
        // For contained mode, size canvas to match its parent container
        const parent = canvas.parentElement;
        if (parent) {
          const rect = parent.getBoundingClientRect();
          canvas.width = rect.width;
          canvas.height = rect.height;
          canvas.style.position = 'absolute';
          canvas.style.left = '0';
          canvas.style.top = '0';
          canvas.style.width = '100%';
          canvas.style.height = '100%';
        }
      } else {
        // Full screen mode
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        canvas.style.position = 'fixed';
        canvas.style.left = '0';
        canvas.style.top = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
      }
    };
    updateCanvasSize();

    const fireflies: FireflyParticle[] = [];

    // Create firefly particles
    const createFirefly = (x?: number, y?: number): FireflyParticle => {
      const size = minSize + Math.random() * (maxSize - minSize);
      
      if (localized && clickPosition) {
        // For localized mode, create fireflies randomly distributed around center
        const angle = Math.random() * 2 * Math.PI;
        const distance = Math.random() * localizedRadius * 0.8; // Random distance up to 80% of radius
        return {
          x: x ?? (localizedRadius + Math.cos(angle) * distance),
          y: y ?? (localizedRadius + Math.sin(angle) * distance),
          size,
          angle: Math.random() * 2 * Math.PI,
          velocity: 0.2 + Math.random() * 0.3, // Gentle movement
          opacity: 0,
          fadeDirection: 1,
          lifespan: duration,
          age: 0
        };
      } else if (contained) {
        // For contained mode, create fireflies within container bounds
        return {
          x: x ?? Math.random() * canvas.width,
          y: y ?? Math.random() * canvas.height,
          size,
          angle: Math.random() * 2 * Math.PI,
          velocity: 0.3 + Math.random() * 0.4, // Gentle movement for containers
          opacity: 0,
          fadeDirection: 1,
          lifespan: duration,
          age: 0
        };
      } else {
        // Original full-screen behavior
        return {
          x: x ?? Math.random() * canvas.width,
          y: y ?? Math.random() * canvas.height,
          size,
          angle: Math.random() * 2 * Math.PI,
          velocity: (size * size) / 4,
          opacity: 0,
          fadeDirection: 1,
          lifespan: duration,
          age: 0
        };
      }
    };

    // Initialize fireflies
    if (isVisible) {
      for (let i = 0; i < count; i++) {
        if ((clickTrigger || localized) && clickPosition) {
          if (localized) {
            // For localized mode, create fireflies randomly around the center
            fireflies.push(createFirefly());
          } else {
            // Original burst pattern for non-localized click trigger
            const angle = (Math.PI * 2 * i) / count;
            const distance = Math.random() * 50;
            fireflies.push(createFirefly(
              clickPosition.x + Math.cos(angle) * distance,
              clickPosition.y + Math.sin(angle) * distance
            ));
          }
        } else {
          fireflies.push(createFirefly());
        }
      }
    }

    // Animation loop
    const animate = () => {
      // Check if component is still mounted
      if (!mountedRef.current) {
        console.log('[Fireflies] Animation cancelled - component unmounted');
        return;
      }
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Add subtle dark gradient backdrop for localized mode
      if (localized && fireflies.length > 0) {
        const gradient = ctx.createRadialGradient(
          localizedRadius, localizedRadius, 0,
          localizedRadius, localizedRadius, localizedRadius
        );
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.3)');
        gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.15)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      for (let i = fireflies.length - 1; i >= 0; i--) {
        const firefly = fireflies[i];
        
        // Update position
        firefly.x += firefly.velocity * Math.cos(firefly.angle);
        firefly.y += firefly.velocity * Math.sin(firefly.angle);
        
        // Different angle changes for localized vs full-screen
        if (localized) {
          // Gentler, more floating movement for localized
          firefly.angle += (Math.random() - 0.5) * 0.1;
        } else {
          // Original chaotic movement for full-screen
          firefly.angle += Math.random() * 0.35 - 0.175;
        }
        
        // Update age
        firefly.age += 16; // Approximate frame time

        // Handle opacity
        if (localized) {
          // For localized mode, quick fade in and slower fade out
          if (firefly.age < 200) {
            firefly.opacity = firefly.age / 200;
          } else if (firefly.age > firefly.lifespan - 800) {
            firefly.opacity = (firefly.lifespan - firefly.age) / 800;
          } else {
            firefly.opacity = 1;
          }
        } else {
          // Original opacity handling
          if (fadeIn && firefly.age < 1000) {
            firefly.opacity = firefly.age / 1000;
          } else if (fadeOut && firefly.age > firefly.lifespan - 1000) {
            firefly.opacity = (firefly.lifespan - firefly.age) / 1000;
          } else {
            firefly.opacity = 1;
          }
        }

        // Remove dead fireflies
        if (firefly.age >= firefly.lifespan || firefly.opacity <= 0) {
          fireflies.splice(i, 1);
          continue;
        }

        // For localized mode, remove fireflies that go too far from center
        if (localized) {
          const distFromCenter = Math.sqrt(
            Math.pow(firefly.x - localizedRadius, 2) + 
            Math.pow(firefly.y - localizedRadius, 2)
          );
          if (distFromCenter > localizedRadius * 0.9) {
            fireflies.splice(i, 1);
            continue;
          }
        }

        // Respawn if out of bounds (only for ambient mode)
        if (ambient && !localized && (
          firefly.x < -10 || firefly.x > canvas.width + 10 ||
          firefly.y < -10 || firefly.y > canvas.height + 10
        )) {
          Object.assign(firefly, createFirefly());
        }

        // Add twinkle effect for localized mode
        let twinkleFactor = 1;
        if (localized) {
          // Create a very subtle twinkle
          twinkleFactor = 0.8 + 0.2 * Math.sin(firefly.age * 0.008);
        }

        // Draw firefly with enhanced visibility for localized mode
        if (localized) {
          // Dark outer ring for contrast
          ctx.save();
          ctx.globalAlpha = firefly.opacity * 0.3 * twinkleFactor;
          ctx.beginPath();
          ctx.arc(firefly.x, firefly.y, firefly.size * 4, 0, 2 * Math.PI);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
          ctx.filter = 'blur(4px)';
          ctx.fill();
          ctx.restore();
        }

        // Draw firefly with glow effect
        ctx.save();
        const glowOpacity = localized ? 0.4 : 0.3; // Brighter glow for localized
        ctx.globalAlpha = firefly.opacity * glowOpacity * twinkleFactor;
        ctx.beginPath();
        ctx.arc(firefly.x, firefly.y, firefly.size * 3, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.filter = 'blur(3px)';
        ctx.fill();
        ctx.restore();

        // Draw core
        ctx.save();
        const coreOpacity = localized ? 0.9 : 1; // Brighter core for localized
        ctx.globalAlpha = firefly.opacity * coreOpacity * twinkleFactor;
        ctx.beginPath();
        ctx.arc(firefly.x, firefly.y, firefly.size, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();
      }

      // Continue animation if there are fireflies or in ambient mode
      if (fireflies.length > 0 || (ambient && isVisible)) {
        if (mountedRef.current) {
          animationRef.current = requestAnimationFrame(animate);
        }
      }
    };

    // Start animation
    if (isVisible) {
      console.log('[Fireflies] Starting animation');
      animate();
    }

    // Handle resize
    window.addEventListener('resize', updateCanvasSize);
    
    // Handle scroll to update position for localized fireflies
    let scrollHandler: (() => void) | null = null;
    if (localized && clickPosition) {
      scrollHandler = () => {
        updateCanvasSize();
      };
      window.addEventListener('scroll', scrollHandler, { passive: true });
    }

    // Handle clicks if in click trigger mode
    const handleClick = (e: MouseEvent) => {
      if (clickTrigger) {
        // Use pageX/pageY for document-relative coordinates
        const x = localized ? e.pageX : e.clientX;
        const y = localized ? e.pageY : e.clientY;
        console.log('[Fireflies] Click detected at:', { x, y });
        setClickPosition({ x, y });
        setIsVisible(true);
        
        // Reset after duration
        setTimeout(() => {
          if (!ambient) {
            setIsVisible(false);
          }
          setClickPosition(null);
        }, duration);
      }
    };

    if (clickTrigger) {
      window.addEventListener('click', handleClick);
    }

    return () => {
      console.log('[Fireflies] Cleaning up effect');
      window.removeEventListener('resize', updateCanvasSize);
      if (scrollHandler) {
        window.removeEventListener('scroll', scrollHandler);
      }
      if (clickTrigger) {
        window.removeEventListener('click', handleClick);
      }
      if (animationRef.current) {
        console.log('[Fireflies] Cancelling animation frame:', animationRef.current);
        cancelAnimationFrame(animationRef.current);
        animationRef.current = undefined;
      }
    };
  }, [isVisible, clickPosition, count, color, minSize, maxSize, fadeIn, fadeOut, duration, clickTrigger, ambient, localized, localizedRadius, contained]);

  return (
    <AnimatePresence>
      {(isVisible || ambient) && (
        <motion.canvas
          ref={canvasRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`pointer-events-none ${localized ? '' : 'fixed inset-0'} z-[9999] ${className}`}
          style={{ 
            mixBlendMode: 'screen'
          }}
          onAnimationComplete={() => console.log('[Fireflies] Canvas animation complete')}
        />
      )}
    </AnimatePresence>
  );
}

// Preset configurations
export const FireflyPresets = {
  subtle: {
    count: 30,
    minSize: 0.5,
    maxSize: 2,
    color: '#fddba3',
    fadeIn: true,
    fadeOut: true
  },
  celebration: {
    count: 100,
    minSize: 1,
    maxSize: 4,
    color: '#ffd700',
    fadeIn: true,
    fadeOut: true,
    duration: 3000
  },
  magical: {
    count: 50,
    minSize: 1,
    maxSize: 3,
    color: '#a8e6cf',
    fadeIn: true,
    fadeOut: true
  }
}; 