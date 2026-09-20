import React from 'react';

export interface ErrorStateProps {
  title?: string;
  error: string | Error;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Execution Error',
  error,
  onRetry,
  className = '',
}) => {
  const message = error instanceof Error ? error.message : String(error);

  return (
    <div className={`fintech-error-state ${className}`} role="alert">
      <div className="error-state-header">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--status-danger)" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <strong className="error-state-title">{title}</strong>
      </div>
      <p className="error-state-message">{message}</p>
      {onRetry && (
        <button type="button" className="btn btn-secondary btn-sm error-retry-btn" onClick={onRetry}>
          Retry Operation
        </button>
      )}
    </div>
  );
};
