import React from 'react';
import type { FundingExecutionResult } from '../types/lender.ts';
import { formatAmount, shortenAddress } from '../lib/formatters.ts';

interface FundingConfirmationProps {
  result: FundingExecutionResult;
  onDismiss: () => void;
}

export const FundingConfirmation: React.FC<FundingConfirmationProps> = ({
  result,
  onDismiss,
}) => {
  return (
    <div className="funding-confirmation-card" aria-label="Funding Confirmation Notice">
      <div className="confirmation-header">
        <div className="confirmation-icon">🎉</div>
        <div>
          <h3>Lender Funding Simulation Confirmed</h3>
          <span className="confirmation-sub">
            Agreement transitioned successfully to active funded status
          </span>
        </div>
      </div>

      <div className="confirmation-details-grid">
        <div className="confirmation-row">
          <span className="confirmation-label">Loan Agreement ID:</span>
          <strong className="confirmation-value-code">{result.loanId}</strong>
        </div>

        <div className="confirmation-row">
          <span className="confirmation-label">Lifecycle Transition:</span>
          <div className="state-transition-badge">
            <span className="state-from">{result.previousStatus}</span>
            <span className="transition-arrow">&rarr;</span>
            <span className="state-to">{result.newStatus}</span>
          </div>
        </div>

        <div className="confirmation-row">
          <span className="confirmation-label">Committed Principal:</span>
          <strong className="confirmation-value">{formatAmount(result.amount)}</strong>
        </div>

        <div className="confirmation-row">
          <span className="confirmation-label">Designated Lender:</span>
          <code className="party-key" title={result.lender}>
            {shortenAddress(result.lender)}
          </code>
        </div>

        <div className="confirmation-row">
          <span className="confirmation-label">Expected Repayment Total:</span>
          <strong className="confirmation-value">{formatAmount(result.expectedRepayment)}</strong>
        </div>

        <div className="confirmation-row">
          <span className="confirmation-label">Projected Interest Return:</span>
          <strong className="confirmation-value green-text">
            +{formatAmount(result.expectedInterest)}
          </strong>
        </div>

        <div className="confirmation-row highlight-row">
          <span className="confirmation-label">Asset Transfer Status:</span>
          <strong className="asset-transfer-badge">
            {result.assetTransferStatus}
          </strong>
        </div>
      </div>

      <div className="confirmation-disclaimer-box">
        <span className="disclaimer-dot"></span>
        <p className="disclaimer-text">
          <strong>Prototype Disclaimer:</strong> {result.disclaimer} Real token transfer mechanisms await future Midnight.js token integration.
        </p>
      </div>

      <div className="confirmation-actions">
        <button
          type="button"
          className="btn-confirmation-dismiss"
          onClick={onDismiss}
        >
          Inspect Funded Agreement in Dashboard
        </button>
      </div>
    </div>
  );
};
