import React from 'react';
import type { EligibilityVerificationResult as ResultModel } from '../types/eligibility.ts';

interface EligibilityVerificationResultProps {
  result: ResultModel;
  onContinue?: () => void;
  onRetry?: () => void;
}

export const EligibilityVerificationResult: React.FC<EligibilityVerificationResultProps> = ({
  result,
  onContinue,
  onRetry,
}) => {
  const isSuccess = result.status === 'VERIFIED' && result.isVerified;

  if (isSuccess) {
    return (
      <div className="eligibility-result-card result-success">
        <div className="result-header">
          <div className="result-icon-badge badge-success">✓</div>
          <div className="result-header-text">
            <h3>Zero-Knowledge Proof Verified</h3>
            <span className="result-subtitle">
              Agreement <strong>{result.loanId}</strong> is verified on the local Compact runtime
            </span>
          </div>
        </div>

        <div className="result-privacy-banner">
          <span className="privacy-badge">🔒 STRICT PRIVACY PRESERVED</span>
          <span className="privacy-callout">
            <strong>PRIVATE VALUE ≠ PUBLIC DATA</strong> — The underlying qualification value was proven inside a zero-knowledge circuit and was never disclosed.
          </span>
        </div>

        <div className="result-grid">
          <div className="result-item">
            <span className="result-item-label">Verification Status</span>
            <span className="result-item-value status-verified">VERIFIED</span>
          </div>
          <div className="result-item">
            <span className="result-item-label">Eligibility Attestation</span>
            <span className="result-item-value">Confirmed</span>
          </div>
          <div className="result-item">
            <span className="result-item-label">Private Metric</span>
            <span className="result-item-value text-muted">Hidden (Zero-Knowledge Protected)</span>
          </div>
          <div className="result-item">
            <span className="result-item-label">Ledger Disclosure</span>
            <span className="result-item-value">Boolean flag only (<code>isEligibilityVerified: true</code>)</span>
          </div>
          <div className="result-item full-width">
            <span className="result-item-label">Next Action</span>
            <span className="result-item-value highlight">Available for lender evaluation &amp; funding</span>
          </div>
        </div>

        <div className="result-disclaimer">
          <span className="disclaimer-icon">ℹ️</span>
          <span>
            {result.isPrototypeExecution
              ? 'Local prototype proof execution — state updated locally, no live network transaction.'
              : 'Zero-knowledge proof registered to Midnight ledger consensus.'}
          </span>
        </div>

        <div className="result-actions">
          {onContinue && (
            <button type="button" className="btn btn-primary" onClick={onContinue}>
              View in Marketplace &amp; Lender Desk
            </button>
          )}
        </div>
      </div>
    );
  }

  // Failure / Rejected display
  const isUnderThreshold = result.failureReason === 'UNDER_THRESHOLD';

  return (
    <div className="eligibility-result-card result-failure">
      <div className="result-header">
        <div className="result-icon-badge badge-danger">✕</div>
        <div className="result-header-text">
          <h3>Eligibility Verification Failed</h3>
          <span className="result-subtitle">Agreement {result.loanId}</span>
        </div>
      </div>

      <div className="result-error-box">
        <div className="error-title">
          {isUnderThreshold ? 'Threshold Not Met' : 'Verification Rejected'}
        </div>
        <p className="error-message">
          {result.errorMessage || 'Eligibility requirement not satisfied.'}
        </p>
      </div>

      <div className="result-privacy-banner">
        <span className="privacy-badge">🛡️ PRIVACY GUARANTEE</span>
        <span className="privacy-callout">
          Your input was evaluated entirely within the local zero-knowledge circuit prover and was not exposed to lenders or the ledger.
        </span>
      </div>

      <div className="result-actions">
        {onRetry && (
          <button type="button" className="btn btn-primary" onClick={onRetry}>
            Try Again With Qualifying Input
          </button>
        )}
        {onContinue && (
          <button type="button" className="btn btn-secondary" onClick={onContinue}>
            Return to Loan Summary
          </button>
        )}
      </div>
    </div>
  );
};
