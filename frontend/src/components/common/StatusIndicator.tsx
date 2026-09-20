import React from 'react';

export interface StatusIndicatorProps {
  status: 'active' | 'warning' | 'error' | 'neutral';
  label?: string;
  className?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  className = '',
}) => {
  return (
    <div className={`status-indicator status-${status} ${className}`}>
      <span className="status-dot" />
      {label && <span className="status-label">{label}</span>}
    </div>
  );
};
