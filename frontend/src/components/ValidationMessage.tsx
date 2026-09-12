import React from 'react';

interface ValidationMessageProps {
  error?: string;
  hint?: string;
}

export const ValidationMessage: React.FC<ValidationMessageProps> = ({ error, hint }) => {
  if (error) {
    return (
      <div className="field-error-message" role="alert">
        <span className="error-icon">⚠️</span>
        <span>{error}</span>
      </div>
    );
  }

  if (hint) {
    return <div className="field-hint-message">{hint}</div>;
  }

  return null;
};
