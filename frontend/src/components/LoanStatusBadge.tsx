import React from 'react';
import type { LoanStatusText } from '../types/index.ts';

interface LoanStatusBadgeProps {
  statusText: LoanStatusText;
}

export const LoanStatusBadge: React.FC<LoanStatusBadgeProps> = ({ statusText }) => {
  const getBadgeClass = (status: LoanStatusText) => {
    switch (status) {
      case 'requested':
        return 'badge-requested';
      case 'funded':
        return 'badge-funded';
      case 'repaid':
        return 'badge-repaid';
      case 'settled':
        return 'badge-settled';
      default:
        return 'badge-default';
    }
  };

  const getLabel = (status: LoanStatusText) => {
    switch (status) {
      case 'requested':
        return 'REQUESTED';
      case 'funded':
        return 'FUNDED';
      case 'repaid':
        return 'REPAID';
      case 'settled':
        return 'SETTLED (TERMINAL)';
      default:
        return String(status).toUpperCase();
    }
  };

  return (
    <span className={`loan-status-badge ${getBadgeClass(statusText)}`}>
      <span className="badge-dot" />
      {getLabel(statusText)}
    </span>
  );
};
