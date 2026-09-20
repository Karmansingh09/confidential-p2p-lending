import React, { useEffect, useState, useRef } from 'react';

export interface AnimatedNumberProps {
  value: number | bigint;
  duration?: number;
  formatter?: (val: number) => string;
  className?: string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  duration = 350,
  formatter = (v) => Math.round(v).toLocaleString(),
  className = '',
}) => {
  const numericValue = typeof value === 'bigint' ? Number(value) : value;
  const [displayValue, setDisplayValue] = useState<number>(numericValue);
  const prevValueRef = useRef<number>(numericValue);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    // Check prefers-reduced-motion
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayValue(numericValue);
      prevValueRef.current = numericValue;
      return;
    }

    const startValue = prevValueRef.current;
    const endValue = numericValue;

    if (startValue === endValue) return;

    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentVal = startValue + (endValue - startValue) * easeProgress;

      setDisplayValue(currentVal);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
        prevValueRef.current = endValue;
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [numericValue, duration]);

  return <span className={`animated-number ${className}`}>{formatter(displayValue)}</span>;
};
