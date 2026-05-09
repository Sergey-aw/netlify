import { useEffect, useRef } from 'react';

interface SwipeGestureOptions {
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  minSwipeDistance?: number;
  maxVerticalDistance?: number;
  ignoreSelectors?: string[]; // CSS selectors for elements to ignore swipe on
}

export function useSwipeGesture({
  onSwipeRight,
  onSwipeLeft,
  minSwipeDistance = 50,
  maxVerticalDistance = 100,
  ignoreSelectors = [],
}: SwipeGestureOptions) {
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const touchEndY = useRef<number>(0);
  const touchStartElement = useRef<EventTarget | null>(null);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      touchStartElement.current = e.target;
    };

    const handleTouchMove = (e: TouchEvent) => {
      touchEndX.current = e.touches[0].clientX;
      touchEndY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = () => {
      // Check if touch started on an ignored element
      if (touchStartElement.current && ignoreSelectors.length > 0) {
        const element = touchStartElement.current as HTMLElement;
        for (const selector of ignoreSelectors) {
          if (element.closest(selector)) {
            // Reset and ignore this gesture
            touchStartX.current = 0;
            touchStartY.current = 0;
            touchEndX.current = 0;
            touchEndY.current = 0;
            touchStartElement.current = null;
            return;
          }
        }
      }

      const deltaX = touchEndX.current - touchStartX.current;
      const deltaY = Math.abs(touchEndY.current - touchStartY.current);

      // Check if it's a horizontal swipe (more horizontal than vertical)
      if (deltaY < maxVerticalDistance) {
        // Swipe right
        if (deltaX > minSwipeDistance && onSwipeRight) {
          onSwipeRight();
        }
        // Swipe left
        else if (deltaX < -minSwipeDistance && onSwipeLeft) {
          onSwipeLeft();
        }
      }

      // Reset values
      touchStartX.current = 0;
      touchStartY.current = 0;
      touchEndX.current = 0;
      touchEndY.current = 0;
      touchStartElement.current = null;
    };

    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onSwipeRight, onSwipeLeft, minSwipeDistance, maxVerticalDistance, ignoreSelectors]);
}
