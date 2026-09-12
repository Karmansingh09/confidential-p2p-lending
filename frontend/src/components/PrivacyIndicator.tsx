import React from 'react';
import { formatAmount } from '../lib/formatters.js';

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
          <span className="shield-icon">{isEligibilityVerified ? '🛡️' : '⏳'}</span>
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
            <span className="pill-pending">⏳ PROOF PENDING</span>
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
