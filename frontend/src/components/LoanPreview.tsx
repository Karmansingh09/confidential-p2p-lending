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
    <div className="preview-panel-stack">
      {/* 1. Live Agreement Preview Card */}
      <div className="preview-main-card">
        <div className="preview-card-header">
          <div>
            <div className="preview-kicker font-mono">
              <span>AGREEMENT REAL-TIME PREVIEW</span>
            </div>
            <h3 className="preview-card-title">Public Loan Request Preview</h3>
            <p className="preview-card-sub">
              Public ledger representation visible to prospective lenders
            </p>
          </div>
          <div className="preview-status-pill-group font-mono">
            <span className="preview-pill pill-requested">
              <span className="pill-dot dot-requested" />
              <span>REQUESTED</span>
            </span>
            <span className="preview-pill pill-unverified">
              <span className="pill-dot dot-unverified" />
              <span>NOT VERIFIED</span>
            </span>
          </div>
        </div>

        {/* Terms Grid */}
        <div className="preview-terms-grid">
          {/* Principal */}
          <div className="preview-term-item">
            <span className="term-label font-mono">Requested Principal</span>
            <div className="term-value-wrap">
              <span className="term-val-huge font-mono">
                {principalAmount !== null && principalAmount > 0n
                  ? principalAmount.toLocaleString()
                  : '—'}
              </span>
              <span className="term-unit font-mono">MICRO-UNITS</span>
            </div>
            <span className="term-desc">Borrowing capital obligation</span>
          </div>

          {/* Rate */}
          <div className="preview-term-item">
            <span className="term-label font-mono">Agreed Interest Rate</span>
            <div className="term-value-wrap">
              <span className="term-val-large font-mono text-accent">
                {interestRateBasisPoints !== null && interestRateBasisPoints > 0n
                  ? basisPointsToPercentage(interestRateBasisPoints)
                  : '—'}
              </span>
              {interestRateBasisPoints !== null && interestRateBasisPoints > 0n && (
                <span className="term-bps font-mono">({interestRateBasisPoints.toString()} bps)</span>
              )}
            </div>
            <span className="term-desc">Simple interest per term</span>
          </div>

          {/* Estimated Total Due */}
          <div className="preview-term-item">
            <span className="term-label font-mono">Estimated Total Due</span>
            <div className="term-value-wrap">
              <span className="term-val-large font-mono highlight-cyan">
                {hasValidTerms ? totalRepaymentDue.toLocaleString() : '—'}
              </span>
              <span className="term-unit font-mono">MICRO-UNITS</span>
            </div>
            <span className="term-desc">
              {hasValidTerms
                ? `Includes ${interestDue.toLocaleString()} MICRO-UNITS simple interest`
                : 'Calculated upon valid terms'}
            </span>
          </div>

          {/* Duration */}
          <div className="preview-term-item">
            <span className="term-label font-mono">Loan Duration</span>
            <div className="term-value-wrap">
              <span className="term-val-large font-mono">
                {durationBlocks !== null && durationBlocks > 0n
                  ? `${durationBlocks.toLocaleString()} BLOCKS`
                  : '—'}
              </span>
            </div>
            <span className="term-desc">Midnight ledger block deadline</span>
          </div>

          {/* Underwriting Threshold */}
          <div className="preview-term-item full-width">
            <div className="threshold-top-row">
              <span className="term-label font-mono">Public Underwriting Threshold</span>
              <span className="threshold-tag font-mono">ZK BENCHMARK</span>
            </div>
            <div className="term-value-wrap">
              <span className="term-val-large font-mono text-success">
                {eligibilityThreshold !== null && eligibilityThreshold > 0n
                  ? `≥ ${eligibilityThreshold.toLocaleString()}`
                  : '—'}
              </span>
              <span className="term-unit font-mono">MICRO-UNITS</span>
            </div>
            <span className="term-desc">
              Required financial benchmark to be proven in zero-knowledge prior to lender funding
            </span>
          </div>
        </div>
      </div>

      {/* 2. Confidentiality Assurance & Privacy Flow */}
      <div className="privacy-assurance-card">
        <div className="assurance-top">
          <div className="assurance-kicker font-mono">CONFIDENTIALITY ASSURANCE</div>
          <h4 className="assurance-title">Zero-Knowledge Privacy Guarantee</h4>
          <p className="assurance-desc">
            The financial information used to prove eligibility is <strong>never</strong> entered into this form or stored in the public loan request. Eligibility will be proven separately using zero-knowledge verification directly from your private wallet witness.
          </p>
        </div>

        {/* 4-Stage Visual Flow */}
        <div className="privacy-flow-visual font-mono" aria-label="Privacy Preservation Pipeline">
          <div className="flow-step">
            <span className="flow-step-num">01</span>
            <span className="flow-step-label">PRIVATE INPUT</span>
            <span className="flow-step-sub">Wallet Witness</span>
          </div>

          <div className="flow-connector" aria-hidden="true">&rarr;</div>

          <div className="flow-step">
            <span className="flow-step-num">02</span>
            <span className="flow-step-label">ZK PROOF</span>
            <span className="flow-step-sub">Client Enclave</span>
          </div>

          <div className="flow-connector" aria-hidden="true">&rarr;</div>

          <div className="flow-step">
            <span className="flow-step-num">03</span>
            <span className="flow-step-label">ATTESTATION</span>
            <span className="flow-step-sub">Boolean Valid</span>
          </div>

          <div className="flow-connector" aria-hidden="true">&rarr;</div>

          <div className="flow-step">
            <span className="flow-step-num">04</span>
            <span className="flow-step-label">PUBLIC REQUEST</span>
            <span className="flow-step-sub">Zero Leakage</span>
          </div>
        </div>

        <div className="assurance-bullet-list">
          <div className="assurance-bullet-item">
            <span className="assurance-item-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </span>
            <span>Private inputs and credentials stay strictly on client machine</span>
          </div>
          <div className="assurance-bullet-item">
            <span className="assurance-item-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </span>
            <span>Only cryptographic verification outcomes published on-chain</span>
          </div>
          <div className="assurance-bullet-item">
            <span className="assurance-item-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </span>
            <span>Deterministic Compact smart contract escrow settlement</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoanPreview;
