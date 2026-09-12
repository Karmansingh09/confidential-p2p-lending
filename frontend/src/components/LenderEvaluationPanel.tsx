import React, { useState } from 'react';
import type { LoanDetailsModel } from '../types/index.js';
import type { FundingExecutionResult } from '../types/lender.js';
import {
  evaluateLoanForLender,
  executeLocalFunding,
  DEFAULT_LENDER_PK_HEX,
  ALTERNATIVE_LENDER_PK_HEX,
} from '../lib/lender-evaluation.js';
import {
  formatAmount,
  formatBasisPoints,
  formatDuration,
  shortenAddress,
} from '../lib/formatters.js';
import { FundingConfirmation } from './FundingConfirmation.js';

interface LenderEvaluationPanelProps {
  loan: LoanDetailsModel;
  loanId: string;
  onFundLoan: (loanId: string, updatedLoan: LoanDetailsModel) => void;
}

export const LenderEvaluationPanel: React.FC<LenderEvaluationPanelProps> = ({
  loan,
  loanId,
  onFundLoan,
}) => {
  const [selectedLenderHex, setSelectedLenderHex] = useState<string>(DEFAULT_LENDER_PK_HEX);
  const [isReviewing, setIsReviewing] = useState(false);
  const [fundingResult, setFundingResult] = useState<FundingExecutionResult | null>(null);

  const evaluation = evaluateLoanForLender(loanId, loan, selectedLenderHex);
  const { readiness, warnings, privacyAttestation, expectedInterest, expectedTotalReturn } = evaluation;

  const handleConfirmFunding = () => {
    try {
      const { updatedLoan, result } = executeLocalFunding(loanId, loan, selectedLenderHex);
      onFundLoan(loanId, updatedLoan);
      setFundingResult(result);
      setIsReviewing(false);
    } catch (err) {
      alert(`Funding failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  if (fundingResult) {
    return (
      <FundingConfirmation
        result={fundingResult}
        onDismiss={() => setFundingResult(null)}
      />
    );
  }

  return (
    <div className="lender-evaluation-card" aria-label="Lender Evaluation Panel">
      <div className="evaluation-card-header">
        <div>
          <h3>Lender Evaluation & Funding Desk</h3>
          <span className="evaluation-sub">
            Underwrite and assess public agreement terms prior to capital commitment
          </span>
        </div>
        <div className={`readiness-pill readiness-${readiness.badgeType}`}>
          <span className="readiness-dot"></span>
          <span>{readiness.title}</span>
        </div>
      </div>

      {/* Readiness Status Explanation */}
      <div className="readiness-description-box">
        <p>{readiness.description}</p>
      </div>

      {/* Public Loan Terms Grid */}
      <div className="evaluation-metrics-grid">
        <div className="eval-metric-box">
          <span className="eval-metric-label">Principal Required</span>
          <strong className="eval-metric-val">{formatAmount(loan.amount)}</strong>
          <span className="eval-metric-hint">Capital to commit</span>
        </div>

        <div className="eval-metric-box">
          <span className="eval-metric-label">Yield Rate</span>
          <strong className="eval-metric-val">{formatBasisPoints(loan.interestRateBasisPoints)}</strong>
          <span className="eval-metric-hint">{loan.interestRateBasisPoints.toString()} Basis Points</span>
        </div>

        <div className="eval-metric-box">
          <span className="eval-metric-label">Expected Interest</span>
          <strong className="eval-metric-val green-text">+{formatAmount(expectedInterest)}</strong>
          <span className="eval-metric-hint">Projected lender return</span>
        </div>

        <div className="eval-metric-box">
          <span className="eval-metric-label">Total Repayment Due</span>
          <strong className="eval-metric-val">{formatAmount(expectedTotalReturn)}</strong>
          <span className="eval-metric-hint">Principal + simple interest</span>
        </div>

        <div className="eval-metric-box">
          <span className="eval-metric-label">Consensus Duration</span>
          <strong className="eval-metric-val">{formatDuration(loan.durationBlocks)}</strong>
          <span className="eval-metric-hint">Blocks until maturity</span>
        </div>

        <div className="eval-metric-box">
          <span className="eval-metric-label">Public Threshold</span>
          <strong className="eval-metric-val">{formatAmount(loan.eligibilityThreshold)}</strong>
          <span className="eval-metric-hint">Underwriting mark</span>
        </div>
      </div>

      {/* Privacy Attestation Section */}
      <div className="privacy-attestation-panel">
        <div className="attestation-header">
          <span className="attestation-shield">🛡️</span>
          <h4>Zero-Knowledge Underwriting Attestation</h4>
        </div>
        <p className="attestation-statement">
          {privacyAttestation.statement || 'Borrower eligibility has been verified without revealing confidential underwriting data.'}
        </p>
        <p className="attestation-notice">
          {privacyAttestation.notice || 'Private financial information is not exposed to lenders or written to the public ledger.'}
        </p>
      </div>

      {/* Warnings List */}
      {warnings.length > 0 && (
        <div className="evaluation-warnings-list">
          {warnings.map((w) => (
            <div key={w.code} className={`warning-item warning-severity-${w.severity}`}>
              <span className="warning-item-icon">
                {w.severity === 'critical' ? '🚫' : w.severity === 'warning' ? '⚠️' : 'ℹ️'}
              </span>
              <span>{w.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Funding Action Area */}
      {!isReviewing ? (
        <div className="evaluation-action-bar">
          <button
            type="button"
            className={`btn-evaluation-action ${readiness.canFund ? 'btn-fund-ready' : 'btn-fund-disabled'}`}
            disabled={!readiness.canFund}
            onClick={() => setIsReviewing(true)}
          >
            {readiness.canFund ? 'Review & Fund Loan Agreement' : readiness.title}
          </button>
        </div>
      ) : (
        <div className="funding-review-section">
          <div className="review-box-header">
            <h4>Review & Confirm Lender Commitment</h4>
            <span className="review-sub">Verify commitment terms before proceeding</span>
          </div>

          <div className="lender-identity-selector">
            <label htmlFor="lender-key-select">Select Funding Provider Account:</label>
            <select
              id="lender-key-select"
              value={selectedLenderHex}
              onChange={(e) => setSelectedLenderHex(e.target.value)}
            >
              <option value={DEFAULT_LENDER_PK_HEX}>
                Lender Account 1 ({shortenAddress(DEFAULT_LENDER_PK_HEX)})
              </option>
              <option value={ALTERNATIVE_LENDER_PK_HEX}>
                Lender Account 2 ({shortenAddress(ALTERNATIVE_LENDER_PK_HEX)})
              </option>
            </select>
          </div>

          <div className="review-summary-table">
            <div className="review-row">
              <span>Agreement Identifier:</span>
              <strong>{loanId}</strong>
            </div>
            <div className="review-row">
              <span>Capital to Commit:</span>
              <strong>{formatAmount(loan.amount)}</strong>
            </div>
            <div className="review-row">
              <span>Receivable Repayment:</span>
              <strong>{formatAmount(expectedTotalReturn)}</strong>
            </div>
            <div className="review-row">
              <span>Borrower Address:</span>
              <code>{shortenAddress(loan.borrower)}</code>
            </div>
          </div>

          <div className="prototype-mode-callout">
            <span className="callout-icon">ℹ️</span>
            <p>
              <strong>Prototype Mode Disclaimer:</strong> No real funds are transferred. This action simulates the contract state transition from <code>REQUESTED</code> to <code>FUNDED</code> in local memory. Live Midnight Network transaction dispatch and wallet signing (via Midnight.js / Lace Wallet) will be connected in an upcoming milestone.
            </p>
          </div>

          <div className="review-actions-bar">
            <button
              type="button"
              className="btn-cancel-review"
              onClick={() => setIsReviewing(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-confirm-funding"
              onClick={handleConfirmFunding}
            >
              Confirm & Provide Funding (Simulation)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
