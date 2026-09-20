import React from 'react';
import { Skeleton } from './Skeleton.tsx';

export interface LoadingStateProps {
  label?: string;
  rows?: number;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  label = 'Loading canonical state...',
  rows = 3,
  className = '',
}) => {
  return (
    <div className={`fintech-loading-state ${className}`}>
      <div className="loading-state-header">
        <span className="loading-spinner-inline" />
        <span className="loading-label">{label}</span>
      </div>
      <div className="loading-skeleton-rows">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} height="28px" borderRadius="4px" />
        ))}
      </div>
    </div>
  );
};
