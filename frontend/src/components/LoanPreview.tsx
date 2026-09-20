import React from 'react';
import { formatAmount, formatDuration } from '../lib/formatters.ts';
import { basisPointsToPercentage } from '../lib/validation.ts';

interface LoanPreviewProps {
  principalAmount: bigint | null;
  interestRateBasisPoints: bigint | null;
  durationBlocks: bigint | null;
  eligibilityThreshold: bigint | null;
}

export const LoanPreview: React.FC<LoanPreviewProps> = ({
  principalAmount,
  interestRateBasisPoints,
  durationBlocks,
  eligibilityThreshold,
}) => {
  const hasValidTerms =
    principalAmount !== null &&
    principalAmount > 0n &&
    interestRateBasisPoints !== null &&
    interestRateBasisPoints > 0n &&
    durationBlocks !== null &&
    durationBlocks > 0n &&
    eligibilityThreshold !== null &&
    eligibilityThreshold > 0n;

  // Simple interest calculation: Principal + floor(Principal * Bps / 10000)
  const interestDue = hasValidTerms
    ? (principalAmount * interestRateBasisPoints) / 10000n
    : 0n;
  const totalRepaymentDue = hasValidTerms ? principalAmount + interestDue : 0n;

  return (
    <div className="loan-preview-card">
      <div className="preview-header">
        <div>
          <h3>Public Loan Request Preview</h3>
          <span className="preview-subtitle">
            Public ledger representation visible to prospective lenders
          </span>
        </div>
        <div className="preview-status-pill">
          <span className="pill-badge status-requested">REQUESTED</span>
          <span className="pill-badge eligibility-unverified">NOT VERIFIED</span>
        </div>
      </div>

      <div className="preview-terms-grid">
        <div className="preview-term-item">
          <span className="term-label">Requested Principal</span>
          <span className="term-value">
            {principalAmount !== null && principalAmount > 0n
              ? formatAmount(principalAmount)
              : '—'}
          </span>
        </div>

        <div className="preview-term-item">
          <span className="term-label">Agreed Interest Rate</span>
          <span className="term-value">
            {interestRateBasisPoints !== null && interestRateBasisPoints > 0n
              ? `${basisPointsToPercentage(interestRateBasisPoints)} (${interestRateBasisPoints.toString()} bps)`
              : '—'}
          </span>
        </div>

        <div className="preview-term-item">
          <span className="term-label">Estimated Total Due</span>
          <span className="term-value highlight-cyan">
            {hasValidTerms ? formatAmount(totalRepaymentDue) : '—'}
          </span>
          {hasValidTerms && (
            <span className="term-subtext">
              Includes {formatAmount(interestDue)} simple interest
            </span>
          )}
        </div>

        <div className="preview-term-item">
          <span className="term-label">Loan Duration</span>
          <span className="term-value">
            {durationBlocks !== null && durationBlocks > 0n
              ? formatDuration(durationBlocks)
              : '—'}
          </span>
        </div>

        <div className="preview-term-item full-width">
          <span className="term-label">Public Underwriting Threshold</span>
          <span className="term-value">
            {eligibilityThreshold !== null && eligibilityThreshold > 0n
              ? formatAmount(eligibilityThreshold)
              : '—'}
          </span>
          <span className="term-subtext">
            Required financial threshold to be proven in ZK before funding
          </span>
        </div>
      </div>

      <div className="preview-privacy-callout">
        <span className="privacy-shield-icon">🛡️</span>
        <div className="privacy-callout-text">
          <strong>Confidentiality Assurance:</strong> The financial information used to
          prove eligibility is <em>never</em> entered into this form or stored in the public
          loan request. Eligibility will be proven separately using zero-knowledge verification
          directly from your private wallet witness.
        </div>
      </div>
    </div>
  );
};
