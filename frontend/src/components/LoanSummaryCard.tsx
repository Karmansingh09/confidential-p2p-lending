import React from 'react';
import type { LoanDetailsModel } from '../types/index.js';
import {
  formatAmount,
  formatBasisPoints,
  formatDuration,
  shortenAddress,
} from '../lib/formatters.js';
import { LoanStatusBadge } from './LoanStatusBadge.js';

interface LoanSummaryCardProps {
  loan: LoanDetailsModel;
}

export const LoanSummaryCard: React.FC<LoanSummaryCardProps> = ({ loan }) => {
  // Simple interest calculation: Principal + floor(Principal * Rate / 10000)
  const interestAmount = (loan.amount * loan.interestRateBasisPoints) / 10000n;
  const totalRepaymentObligation = loan.amount + interestAmount;

  return (
    <div className="loan-summary-card">
      <div className="card-header">
        <div>
          <h2>Active Loan Agreement</h2>
          <span className="card-subtitle">Public Agreement Terms Recorded on Midnight Ledger</span>
        </div>
        <LoanStatusBadge statusText={loan.statusText} />
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
          <span className="metric-subtext">Ledger blocks until maturity</span>
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
    </div>
  );
};
