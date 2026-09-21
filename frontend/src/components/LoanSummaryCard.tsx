import React from 'react';
import type { LoanDetailsModel } from '../types/index.ts';
import {
  formatAmount,
  formatBasisPoints,
  formatDuration,
  shortenAddress,
} from '../lib/formatters.ts';
import { calculateRepaymentObligation } from 'contracts';
import { LoanStatusBadge } from './LoanStatusBadge.tsx';

import { isVerifiedLoan } from '../lib/marketplace.ts';

interface LoanSummaryCardProps {
  loan: LoanDetailsModel;
  loanId?: string;
}

export const LoanSummaryCard: React.FC<LoanSummaryCardProps> = ({ loan, loanId }) => {
  // Use canonical calculateRepaymentObligation from protocol contract client
  const totalRepaymentObligation = calculateRepaymentObligation(
    loan.amount,
    loan.interestRateBasisPoints
  );
  const interestAmount = totalRepaymentObligation - loan.amount;
  const isVerified = isVerifiedLoan(loan);

  return (
    <div className="loan-summary-card" aria-label="Loan Details Panel">
      <div className="card-header">
        <div>
          <div className="card-title-row">
            <h2>Loan Agreement Details</h2>
            {loanId && <span className="card-loan-id-badge">{loanId}</span>}
          </div>
          <span className="card-subtitle">
            {loan.isConfirmedOnChain
              ? 'Public Agreement Terms Recorded on Midnight Ledger'
              : 'Local Prototype Preview • Not Confirmed on Midnight Ledger'}
          </span>
        </div>
        <div className="card-header-badges">
          <LoanStatusBadge statusText={loan.statusText} />
          {isVerified && (
            <span className="badge-verified-attestation">ZK Verified</span>
          )}
        </div>
      </div>

      <div className="summary-metrics-grid">
        <div className="summary-metric-card primary">
          <span className="metric-label">Principal Amount</span>
          <span className="metric-value-lg">{formatAmount(loan.amount)}</span>
          <span className="metric-subtext">Requested borrowing capital</span>
        </div>

        <div className="summary-metric-card">
          <span className="metric-label">Interest Rate</span>
          <span className="metric-value-lg">
            {formatBasisPoints(loan.interestRateBasisPoints)}
          </span>
          <span className="metric-subtext">
            {loan.interestRateBasisPoints.toString()} Basis Points (Simple Interest)
          </span>
        </div>

        <div className="summary-metric-card">
          <span className="metric-label">Total Repayment Due</span>
          <span className="metric-value-lg">
            {formatAmount(totalRepaymentObligation)}
          </span>
          <span className="metric-subtext">
            Principal + {formatAmount(interestAmount)} interest
          </span>
        </div>

        <div className="summary-metric-card">
          <span className="metric-label">Loan Duration</span>
          <span className="metric-value-lg">{formatDuration(loan.durationBlocks)}</span>
          <span className="metric-subtext">Consensus blocks to maturity</span>
        </div>

        <div className="summary-metric-card">
          <span className="metric-label">Eligibility Threshold</span>
          <span className="metric-value-lg">{formatAmount(loan.eligibilityThreshold)}</span>
          <span className="metric-subtext">Required public qualification mark</span>
        </div>

        <div className="summary-metric-card">
          <span className="metric-label">Eligibility Status</span>
          <span className={`metric-value-lg ${loan.isEligibilityVerified ? 'verified-text' : 'pending-text'}`}>
            {loan.isEligibilityVerified ? 'Verified in ZK' : 'Not Verified'}
          </span>
          <span className="metric-subtext">
            {loan.isEligibilityVerified
              ? (loan.isConfirmedOnChain ? 'Off-chain proof accepted by contract' : 'Local prototype ZK proof simulated (Off-Chain)')
              : 'Borrower proof submission pending'}
          </span>
        </div>
      </div>

      <div className="parties-container">
        <div className="party-row">
          <div className="party-role">
            <span className="role-tag borrower-tag">BORROWER</span>
            <span className="party-name">Borrower Public Key</span>
          </div>
          <code className="party-key" title={loan.borrower}>
            {shortenAddress(loan.borrower)}
          </code>
        </div>

        <div className="party-row">
          <div className="party-role">
            <span className="role-tag lender-tag">LENDER</span>
            <span className="party-name">Designated Lender</span>
          </div>
          <code className="party-key" title={loan.lender ?? undefined}>
            {shortenAddress(loan.lender)}
          </code>
        </div>
      </div>

      {/* Information Boundary Panels: Public vs Private separation */}
      <div className="data-boundary-container">
        <div className="boundary-panel public-panel">
          <div className="boundary-panel-header">
            <span className="boundary-indicator public-dot"></span>
            <h4>PUBLIC AGREEMENT INFORMATION</h4>
          </div>
          <p className="boundary-description">
            Transparent on-chain parameters published to the Midnight ledger. Accessible to prospective lenders to evaluate terms, interest yield, consensus duration, and cryptographic verification status.
          </p>
        </div>

        <div className="boundary-panel private-panel">
          <div className="boundary-panel-header">
            <span className="boundary-indicator private-dot"></span>
            <h4>PRIVATE BORROWER INFORMATION</h4>
          </div>
          <p className="boundary-description">
            <strong>Intentionally Unavailable & Excluded.</strong> Sensitive borrower credentials and confidential off-chain documentation are never collected, stored, or revealed to the frontend or ledger. The borrower proves qualification off-chain via Zero-Knowledge proofs.
          </p>
        </div>
      </div>
    </div>
  );
};

