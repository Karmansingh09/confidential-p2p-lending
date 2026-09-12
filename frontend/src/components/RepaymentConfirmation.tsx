import React from 'react';
import type { RepaymentResult } from '../types/repayment.js';
import { formatAmount, shortenAddress } from '../lib/formatters.js';

interface RepaymentConfirmationProps {
  result: RepaymentResult;
  onDismiss?: () => void;
}

export const RepaymentConfirmation: React.FC<RepaymentConfirmationProps> = ({
  result,
  onDismiss,
}) => {
  return (
    <div className="repayment-confirmation-card">
      <div className="confirmation-header">
        <div className="confirmation-icon-badge">✓</div>
        <div className="confirmation-header-text">
          <h3>Loan Repayment Confirmed</h3>
          <span className="confirmation-subtitle">
            Agreement <strong>{result.loanId}</strong> transitioned to <strong>REPAID</strong>
          </span>
        </div>
      </div>

      {/* Lifecycle Flow Stepper */}
      <div className="repayment-flow-indicator">
        <span className="flow-step step-complete">REQUESTED</span>
        <span className="flow-arrow">→</span>
        <span className="flow-step step-complete">VERIFIED</span>
        <span className="flow-arrow">→</span>
        <span className="flow-step step-complete">FUNDED</span>
        <span className="flow-arrow">→</span>
        <span className="flow-step step-current">REPAID</span>
        <span className="flow-arrow">→</span>
        <span className="flow-step step-pending">SETTLED</span>
      </div>

      {/* Immutable Terms Banner */}
      <div className="repayment-attestation-banner">
        <span className="attestation-icon">🛡️</span>
        <span className="attestation-text">
          <strong>Immutable Calculation Guarantee:</strong> Your repayment obligation is calculated from the immutable loan terms.
        </span>
      </div>

      {/* Details Grid */}
      <div className="confirmation-grid">
        <div className="confirmation-grid-item">
          <span className="item-label">Principal Repaid</span>
          <strong className="item-val">{formatAmount(result.calculation.principal)}</strong>
        </div>

        <div className="confirmation-grid-item">
          <span className="item-label">Agreed Interest</span>
          <strong className="item-val">{formatAmount(result.calculation.interestAmount)}</strong>
        </div>

        <div className="confirmation-grid-item highlight-total">
          <span className="item-label">Total Obligation Cleared</span>
          <strong className="item-val">{formatAmount(result.repaidAmount)}</strong>
        </div>

        <div className="confirmation-grid-item">
          <span className="item-label">Lender Recipient</span>
          <strong className="item-val">{shortenAddress(result.lender)}</strong>
        </div>

        <div className="confirmation-grid-item full-width">
          <span className="item-label">Asset Transfer Status</span>
          <span className="item-val asset-transfer-badge">
            {result.assetTransferStatus}
          </span>
        </div>
      </div>

      {/* Prototype Disclosure Box */}
      <div className="confirmation-disclaimer-box">
        <span className="disclaimer-icon">ℹ️</span>
        <span>
          <strong>Prototype Disclosure:</strong> {result.disclaimer}
        </span>
      </div>

      {/* Actions */}
      {onDismiss && (
        <div className="confirmation-actions">
          <button
            type="button"
            className="btn btn-primary btn-confirmation-dismiss"
            onClick={onDismiss}
          >
            Return to Dashboard
          </button>
        </div>
      )}
    </div>
  );
};
