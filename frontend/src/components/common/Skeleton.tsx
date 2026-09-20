import React from 'react';

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  variant?: 'text' | 'rectangular' | 'circular';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1rem',
  borderRadius = '4px',
  className = '',
  variant = 'rectangular',
}) => {
  const getRadius = () => {
    if (variant === 'circular') return '50%';
    if (variant === 'text') return '3px';
    return borderRadius;
  };

  return (
    <div
      className={`skeleton-shimmer ${className}`}
      style={{
        width,
        height,
        borderRadius: getRadius(),
      }}
      aria-hidden="true"
    />
  );
};
