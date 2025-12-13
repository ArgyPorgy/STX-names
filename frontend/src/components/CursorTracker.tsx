import React, { useEffect, useRef } from 'react';
import './CursorTracker.css';

export const CursorTracker: React.FC = () => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const cursorDotRef = useRef<HTMLDivElement>(null);
  const trailRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const cursor = cursorRef.current;
    const cursorDot = cursorDotRef.current;
    if (!cursor || !cursorDot) return;

    let mouseX = 0;
    let mouseY = 0;
    let cursorX = 0;
    let cursorY = 0;
    let trailIndex = 0;
    let scale = 1;
    let isHovering = false;

    const updateCursor = () => {
      // Smooth cursor movement
      const dx = mouseX - cursorX;
      const dy = mouseY - cursorY;
      cursorX += dx * 0.15;
      cursorY += dy * 0.15;

      cursor.style.left = `${cursorX}px`;
      cursor.style.top = `${cursorY}px`;
      cursor.style.transform = `translate(-50%, -50%) scale(${scale})`;
      
      // Add/remove hover class
      if (isHovering && !cursor.classList.contains('is-hovering')) {
        cursor.classList.add('is-hovering');
      } else if (!isHovering && cursor.classList.contains('is-hovering')) {
        cursor.classList.remove('is-hovering');
      }
      
      cursorDot.style.left = `${mouseX}px`;
      cursorDot.style.top = `${mouseY}px`;
      cursorDot.style.transform = 'translate(-50%, -50%)';

      // Trail effect (less frequent for performance)
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        const trail = trailRefs.current[trailIndex];
        if (trail) {
          trail.style.left = `${mouseX}px`;
          trail.style.top = `${mouseY}px`;
          trail.style.opacity = '1';
          trail.style.transform = 'translate(-50%, -50%) scale(1)';
          
          setTimeout(() => {
            trail.style.opacity = '0';
            trail.style.transform = 'translate(-50%, -50%) scale(0)';
          }, 400);
        }
        trailIndex = (trailIndex + 1) % trailRefs.current.length;
      }

      requestAnimationFrame(updateCursor);
    };

    const checkIfInteractive = (x: number, y: number): boolean => {
      const element = document.elementFromPoint(x, y);
      if (!element) return false;
      
      const interactiveSelectors = ['a', 'button', 'input', 'textarea', '[role="button"]', '[tabindex]'];
      return interactiveSelectors.some(selector => {
        return element.matches(selector) || element.closest(selector) !== null;
      });
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      isHovering = checkIfInteractive(mouseX, mouseY);
    };

    const handleMouseEnter = () => {
      cursor.style.opacity = '1';
      cursorDot.style.opacity = '1';
    };

    const handleMouseLeave = () => {
      cursor.style.opacity = '0';
      cursorDot.style.opacity = '0';
    };

    const handleMouseDown = () => {
      scale = 0.8;
    };

    const handleMouseUp = () => {
      scale = 1;
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseenter', handleMouseEnter);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);

    updateCursor();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseenter', handleMouseEnter);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <>
      <div ref={cursorRef} className="cursor" />
      <div ref={cursorDotRef} className="cursor-dot" />
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          ref={(el) => (trailRefs.current[i] = el)}
          className="cursor-trail"
          style={{ transitionDelay: `${i * 50}ms` }}
        />
      ))}
    </>
  );
};

