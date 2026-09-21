import React from 'react';
import { formatAmount } from '../lib/formatters.ts';

interface PrivacyIndicatorProps {
  eligibilityThreshold: bigint;
  isEligibilityVerified: boolean;
}

export const PrivacyIndicator: React.FC<PrivacyIndicatorProps> = ({
  eligibilityThreshold,
  isEligibilityVerified,
}) => {
  return (
    <div className={`privacy-indicator-card ${isEligibilityVerified ? 'verified' : 'unverified'}`}>
      <div className="privacy-header">
        <div className="privacy-title-group">
          <span className="shield-icon" aria-hidden="true">
            {isEligibilityVerified ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            )}
          </span>
          <div>
            <h3>Zero-Knowledge Financial Privacy Boundary</h3>
            <p className="privacy-subtitle">
              Midnight Compact ZK Circuit Verification Model
            </p>
          </div>
        </div>
        <div className="verification-pill">
          {isEligibilityVerified ? (
            <span className="pill-verified">✓ ELIGIBILITY PROVEN</span>
          ) : (
            <span className="pill-pending">PROOF PENDING</span>
          )}
        </div>
      </div>

      <div className="privacy-details-grid">
        <div className="privacy-metric">
          <span className="metric-label">Public Underwriting Threshold</span>
          <span className="metric-value">{formatAmount(eligibilityThreshold)}</span>
          <span className="metric-hint">Disclosed on-chain for lender evaluation</span>
        </div>

        <div className="privacy-metric">
          <span className="metric-label">Borrower Financial Value</span>
          <span className="metric-value confidential">
            {isEligibilityVerified ? '≥ Required Threshold' : 'Undisclosed'}
          </span>
          <span className="metric-hint">
            Proven in Zero-Knowledge &bull; Exact figure strictly hidden
          </span>
        </div>
      </div>

      <div className="privacy-guarantee-box">
        <div className="guarantee-icon">ℹ</div>
        <div className="guarantee-text">
          <strong>Cryptographic Privacy Boundary:</strong> Borrower proves{' '}
          <code>privateValue ≥ {eligibilityThreshold.toLocaleString()}</code> off-chain.
          Actual income, banking credentials, and wallet balances are <em>never</em> published to the ledger, stored in React state, or transmitted to lenders.
        </div>
      </div>
    </div>
  );
};
