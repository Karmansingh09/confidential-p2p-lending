import React, { useState } from 'react';
import type { LoanDetailsModel } from '../types/index.ts';
import { LoanStatus } from '../types/index.ts';
import type { LoanRegistry } from '../lib/loan-registry.ts';
import type { AccountContext } from '../types/account.ts';
import type { NavigationTab } from '../types/navigation.ts';
import { AnimatedNumber } from '../components/common/AnimatedNumber.tsx';

export interface MyLoansPageProps {
  loanRegistry: LoanRegistry;
  accountContext: AccountContext;
  onSelectLoan: (loanId: string) => void;
  onNavigate: (tab: NavigationTab) => void;
  onStartVerification?: (loanId: string) => void;
  onStartRepayment?: (loanId: string) => void;
  onStartSettlement?: (loanId: string) => void;
}

export const MyLoansPage: React.FC<MyLoansPageProps> = ({
  loanRegistry,
  accountContext,
  onSelectLoan,
  onNavigate,
  onStartVerification,
  onStartRepayment,
  onStartSettlement,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'borrowing' | 'lending'>('all');
  const loansMap = loanRegistry.getLoans();
  const orderedIds = loanRegistry.getOrderedLoanIds();
  const role = accountContext.selectedRole || 'BORROWER';

  const borrowingLoans = orderedIds.filter((id) => {
    const loan = loansMap[id];
    if (!loan) return false;
    return role === 'BORROWER' || loan.status === LoanStatus.requested || loan.status === LoanStatus.funded;
  });

  const lendingLoans = orderedIds.filter((id) => {
    const loan = loansMap[id];
    if (!loan) return false;
    return role === 'LENDER' || (loan.isEligibilityVerified && loan.status !== LoanStatus.requested) || loan.status === LoanStatus.funded;
  });

  const currentList = activeTab === 'all'
    ? orderedIds
    : activeTab === 'borrowing'
    ? borrowingLoans
    : lendingLoans;

  const currentVolume = currentList.reduce((acc, id) => {
    const l = loansMap[id];
    return l ? acc + l.amount : acc;
  }, 0n);

  const totalPositionsCount = orderedIds.length;
  const borrowingCount = borrowingLoans.length;
  const lendingCount = lendingLoans.length;

  const totalMix = borrowingCount + lendingCount;
  const borrowingPct = totalMix > 0 ? Math.round((borrowingCount / totalMix) * 100) : 50;
  const lendingPct = 100 - borrowingPct;

  const handleOpenDetails = (loanId: string) => {
    onSelectLoan(loanId);
    onNavigate('loan-details');
  };

  return (
    <div className="positions-workspace">
      {/* 1. PORTFOLIO HEADER & TELEMETRY ENCLAVE (60% / 40%) */}
      <section className="positions-hero-section">
        <div className="positions-hero-left">
          <div className="positions-kicker font-mono">
            <span>CONFIDENTIAL PORTFOLIO</span>
            <span className="kicker-sep">//</span>
            <span>POSITION MANAGEMENT</span>
          </div>
          <h1 className="positions-headline">My Positions</h1>
          <p className="positions-lead">
            Track your borrowing agreements and active capital allocations across zero-knowledge lifecycle states.
          </p>

          <div className="positions-actions-row">
            <button
              type="button"
              className="btn-positions-primary"
              onClick={() => onNavigate('create-loan')}
            >
              + NEW REQUEST
            </button>
            <button
              type="button"
              className="btn-positions-outline"
              onClick={() => onNavigate('marketplace')}
            >
              MARKETPLACE &rarr;
            </button>
          </div>
        </div>

        <div className="positions-hero-right">
          <div className="positions-telemetry-enclave font-mono">
            <div className="telemetry-enclave-header">
              <span className="telemetry-enclave-title">PORTFOLIO TELEMETRY</span>
              <span className="telemetry-enclave-indicator">
                <span className="status-dot-sm dot-success" />
                <span className="status-text-live">SYNCHRONIZED</span>
              </span>
            </div>

            <div className="telemetry-enclave-body">
              <div className="telemetry-enclave-row">
                <span className="telemetry-enclave-key">ACTIVE ROLE</span>
                <span className="telemetry-enclave-val text-accent">{role}</span>
              </div>
              <div className="telemetry-enclave-row">
                <span className="telemetry-enclave-key">LIFECYCLE</span>
                <span className="telemetry-enclave-val">Deterministic Escrow</span>
              </div>
              <div className="telemetry-enclave-row">
                <span className="telemetry-enclave-key">RECORD PRIVACY</span>
                <span className="telemetry-enclave-val text-accent">100% Shielded</span>
              </div>
              <div className="telemetry-enclave-row">
                <span className="telemetry-enclave-key">ATTESTATION</span>
                <span className="telemetry-enclave-val">Client ZK Witnesses</span>
              </div>
            </div>

            <div className="telemetry-enclave-footer">
              <span className="telemetry-enclave-badge">ZERO DATA LEAKAGE</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. PORTFOLIO STATUS PANEL & POSITION MIX */}
      <section className="portfolio-status-panel">
        <div className="portfolio-status-top">
          {/* Primary Metric: Total Principal */}
          <div className="status-primary-col">
            <span className="status-primary-label font-mono">
              TOTAL {activeTab === 'borrowing' ? 'BORROWED' : activeTab === 'lending' ? 'COMMITTED' : 'POSITION'} PRINCIPAL
            </span>
            <div className="status-primary-val-wrap">
              <span className="status-primary-number font-mono">
                <AnimatedNumber value={currentVolume} />
              </span>
              <span className="status-primary-unit font-mono">MICRO-UNITS</span>
            </div>
            <span className="status-primary-sub">
              Total commitments across {currentList.length} active position{currentList.length === 1 ? '' : 's'}
            </span>
          </div>

          {/* Supporting Metrics Rail */}
          <div className="status-metrics-rail font-mono">
            <div className="status-metric-col">
              <span className="status-metric-label">ACTIVE POSITIONS</span>
              <span className="status-metric-val">{totalPositionsCount}</span>
              <span className="status-metric-sub">Total Registry</span>
            </div>
            <div className="status-metric-col">
              <span className="status-metric-label">BORROWING</span>
              <span className="status-metric-val text-amber">{borrowingCount}</span>
              <span className="status-metric-sub">Debt Obligations</span>
            </div>
            <div className="status-metric-col">
              <span className="status-metric-label">LENDING</span>
              <span className="status-metric-val text-blue">{lendingCount}</span>
              <span className="status-metric-sub">Capital Deployed</span>
            </div>
            <div className="status-metric-col">
              <span className="status-metric-label">PRIVACY-SHIELDED</span>
              <span className="status-metric-val text-success">100%</span>
              <span className="status-metric-sub">Client ZK Enclave</span>
            </div>
          </div>
        </div>

        {/* Proportional Position Mix Bar */}
        <div className="position-mix-container">
          <div className="position-mix-header font-mono">
            <span className="mix-title">POSITION MIX RATIO</span>
            <div className="mix-legend">
              <span className="legend-item">
                <span className="legend-dot dot-borrowing" />
                <span>BORROWING: {borrowingCount} ({borrowingPct}%)</span>
              </span>
              <span className="legend-item">
                <span className="legend-dot dot-lending" />
                <span>LENDING: {lendingCount} ({lendingPct}%)</span>
              </span>
            </div>
          </div>
          <div className="position-mix-bar" role="progressbar" aria-label="Position Mix Ratio" aria-valuenow={borrowingPct} aria-valuemin={0} aria-valuemax={100}>
            <div
              className="mix-segment segment-borrowing"
              style={{ width: `${borrowingPct}%` }}
              title={`Borrowing: ${borrowingCount} positions (${borrowingPct}%)`}
            />
            <div
              className="mix-segment segment-lending"
              style={{ width: `${lendingPct}%` }}
              title={`Lending: ${lendingCount} positions (${lendingPct}%)`}
            />
          </div>
        </div>
      </section>

      {/* 3. POSITION LIFECYCLE OVERVIEW */}
      <section className="position-lifecycle-section">
        <div className="lifecycle-section-header">
          <h2 className="lifecycle-section-title">POSITION LIFECYCLE</h2>
          <span className="lifecycle-section-sub font-mono">
            Current agreement progression &amp; zero-knowledge verification pipeline
          </span>
        </div>

        <div className="lifecycle-stages-grid font-mono">
          <div className="lifecycle-stage-card">
            <div className="stage-card-top">
              <span className="stage-card-num">01</span>
              <span className="stage-status-dot dot-amber" />
            </div>
            <h3 className="stage-card-title">REQUEST</h3>
            <span className="stage-card-subtitle">ZK QUALIFICATION</span>
            <p className="stage-card-desc font-sans">
              Initial loan terms registered. Borrower eligibility proven via client-side zero-knowledge witness.
            </p>
          </div>

          <div className="lifecycle-stage-arrow" aria-hidden="true">&rarr;</div>

          <div className="lifecycle-stage-card">
            <div className="stage-card-top">
              <span className="stage-card-num">02</span>
              <span className="stage-status-dot dot-blue" />
            </div>
            <h3 className="stage-card-title">FUNDING</h3>
            <span className="stage-card-subtitle">CAPITAL LOCK</span>
            <p className="stage-card-desc font-sans">
              Lender commits principal to deterministic escrow on the Compact ledger. Interest begins accruing.
            </p>
          </div>

          <div className="lifecycle-stage-arrow" aria-hidden="true">&rarr;</div>

          <div className="lifecycle-stage-card">
            <div className="stage-card-top">
              <span className="stage-card-num">03</span>
              <span className="stage-status-dot dot-muted" />
            </div>
            <h3 className="stage-card-title">REPAYMENT</h3>
            <span className="stage-card-subtitle">OBLIGATION SETTLEMENT</span>
            <p className="stage-card-desc font-sans">
              Borrower transfers principal plus accrued simple interest into contract before block deadline.
            </p>
          </div>

          <div className="lifecycle-stage-arrow" aria-hidden="true">&rarr;</div>

          <div className="lifecycle-stage-card">
            <div className="stage-card-top">
              <span className="stage-card-num">04</span>
              <span className="stage-status-dot dot-green" />
            </div>
            <h3 className="stage-card-title">SETTLEMENT</h3>
            <span className="stage-card-subtitle">ON-CHAIN ATOMIC</span>
            <p className="stage-card-desc font-sans">
              Terminal state finalized. Escrow funds disbursed to lender, collateral freed, position closed.
            </p>
          </div>
        </div>
      </section>

      {/* 4. POSITIONS LEDGER (THE CENTERPIECE) */}
      <section className="positions-ledger-section">
        <div className="ledger-header">
          <div className="ledger-title-group">
            <h2 className="ledger-title">POSITIONS LEDGER</h2>
            <span className="ledger-count-badge font-mono">{currentList.length} AGREEMENTS</span>
          </div>

          <div className="ledger-filter-tabs font-mono" role="tablist" aria-label="Positions Filter">
            <button
              type="button"
              className={`ledger-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
              role="tab"
              aria-selected={activeTab === 'all'}
            >
              ALL ({totalPositionsCount})
            </button>
            <button
              type="button"
              className={`ledger-tab-btn ${activeTab === 'borrowing' ? 'active' : ''}`}
              onClick={() => setActiveTab('borrowing')}
              role="tab"
              aria-selected={activeTab === 'borrowing'}
            >
              BORROWING ({borrowingCount})
            </button>
            <button
              type="button"
              className={`ledger-tab-btn ${activeTab === 'lending' ? 'active' : ''}`}
              onClick={() => setActiveTab('lending')}
              role="tab"
              aria-selected={activeTab === 'lending'}
            >
              LENDING ({lendingCount})
            </button>
          </div>
        </div>

        {currentList.length === 0 ? (
          <div className="ledger-empty-state">
            <div className="empty-icon-wrap">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
            </div>
            <h3 className="empty-title">
              NO {activeTab === 'borrowing' ? 'BORROWING' : activeTab === 'lending' ? 'LENDING' : ''} POSITIONS FOUND
            </h3>
            <p className="empty-desc">
              {activeTab === 'borrowing'
                ? 'You have no active borrowing requests queued or open on this node.'
                : activeTab === 'lending'
                ? 'You have not committed capital to any lending agreements yet.'
                : 'No active positions exist in the canonical registry.'}
            </p>
            <button
              type="button"
              className="btn-empty-action font-mono"
              onClick={() => (activeTab === 'lending' ? onNavigate('marketplace') : onNavigate('create-loan'))}
            >
              {activeTab === 'lending' ? 'Browse Marketplace' : '+ Create Loan Request'}
            </button>
          </div>
        ) : (
          <div className="ledger-table-container">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th style={{ width: '16%' }}>AGREEMENT ID</th>
                  <th style={{ width: '14%' }}>POSITION ROLE</th>
                  <th style={{ width: '16%' }}>PRINCIPAL</th>
                  <th style={{ width: '14%' }}>ANNUAL RATE</th>
                  <th style={{ width: '14%' }}>STATUS</th>
                  <th style={{ width: '16%' }}>LIFECYCLE PROGRESS</th>
                  <th style={{ width: '10%', textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {currentList.map((loanId) => {
                  const loan = loansMap[loanId];
                  if (!loan) return null;
                  const ratePercent = (Number(loan.interestRateBasisPoints) / 100).toFixed(2);
                  const isBorrower = borrowingLoans.includes(loanId);

                  // Derive lifecycle progress steps
                  const isReq = true;
                  const isFund = loan.status === LoanStatus.funded || loan.status === LoanStatus.repaid || loan.status === LoanStatus.settled;
                  const isRepay = loan.status === LoanStatus.repaid || loan.status === LoanStatus.settled;
                  const isSettle = loan.status === LoanStatus.settled;

                  return (
                    <tr
                      key={loanId}
                      className="ledger-row"
                      onClick={() => handleOpenDetails(loanId)}
                    >
                      <td>
                        <span className="ledger-loan-id font-mono">{loanId}</span>
                      </td>
                      <td>
                        <span className={`ledger-role-tag font-mono ${isBorrower ? 'role-borrower' : 'role-lender'}`}>
                          {isBorrower ? 'BORROWER' : 'LENDER'}
                        </span>
                      </td>
                      <td>
                        <span className="ledger-principal-val font-mono">{loan.amount.toLocaleString()}</span>
                        <span className="ledger-unit-tag font-mono">UNITS</span>
                      </td>
                      <td>
                        <span className="ledger-rate-val font-mono">{ratePercent}%</span>{' '}
                        <span className="ledger-bps-sub font-mono">({loan.interestRateBasisPoints.toString()} bps)</span>
                      </td>
                      <td>
                        <span className={`ledger-status-pill status-${loan.statusText.toLowerCase()} font-mono`}>
                          <span className={`ledger-status-dot dot-${loan.statusText.toLowerCase()}`} />
                          <span>{loan.statusText}</span>
                        </span>
                      </td>
                      <td>
                        <div className="ledger-lifecycle-track font-mono" title={`State: ${loan.statusText}`}>
                          <span className={`track-node ${isReq ? 'active' : ''}`} title="Requested">REQ</span>
                          <span className={`track-line ${isFund ? 'active' : ''}`} />
                          <span className={`track-node ${isFund ? 'active' : ''}`} title="Funded">FUND</span>
                          <span className={`track-line ${isRepay ? 'active' : ''}`} />
                          <span className={`track-node ${isRepay ? 'active' : ''}`} title="Repaid">REPAY</span>
                          <span className={`track-line ${isSettle ? 'active' : ''}`} />
                          <span className={`track-node ${isSettle ? 'active' : ''}`} title="Settled">SETTLE</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div
                          className="ledger-actions-cell"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {loan.status === LoanStatus.requested && !loan.isEligibilityVerified && onStartVerification && (
                            <button
                              type="button"
                              className="btn-action-primary font-mono"
                              onClick={() => {
                                onSelectLoan(loanId);
                                onStartVerification(loanId);
                                onNavigate('loan-details');
                              }}
                            >
                              Verify
                            </button>
                          )}
                          {loan.status === LoanStatus.funded && onStartRepayment && (
                            <button
                              type="button"
                              className="btn-action-primary font-mono"
                              onClick={() => {
                                onSelectLoan(loanId);
                                onStartRepayment(loanId);
                                onNavigate('loan-details');
                              }}
                            >
                              Repay
                            </button>
                          )}
                          {loan.status === LoanStatus.repaid && onStartSettlement && (
                            <button
                              type="button"
                              className="btn-action-primary font-mono"
                              onClick={() => {
                                onSelectLoan(loanId);
                                onStartSettlement(loanId);
                                onNavigate('loan-details');
                              }}
                            >
                              Settle
                            </button>
                          )}
                          <span
                            className="ledger-action-details font-mono"
                            onClick={() => handleOpenDetails(loanId)}
                          >
                            Details &rarr;
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 5. CONFIDENTIAL POSITION INTEGRITY & ENCLAVE ASSURANCE (58% / 42%) */}
      <section className="positions-assurance-section">
        <div className="assurance-card-left">
          <div className="assurance-kicker font-mono">CRYPTOGRAPHIC BOUNDARY</div>
          <h3 className="assurance-heading">Confidential Position Integrity</h3>
          <p className="assurance-lead">
            Your private financial information remains strictly outside public state. Client-side zero-knowledge proofs attest to regulatory eligibility and collateral sufficiency, while on-chain smart contracts only record verified state transitions without exposing borrower identity, lender balances, or private credit history.
          </p>
          <div className="assurance-features font-mono">
            <div className="assurance-feature-item">
              <span className="feature-check">✓</span>
              <span>Private Financial Records Kept in Client Enclave</span>
            </div>
            <div className="assurance-feature-item">
              <span className="feature-check">✓</span>
              <span>Only Cryptographic Verification Outcomes Exposed</span>
            </div>
            <div className="assurance-feature-item">
              <span className="feature-check">✓</span>
              <span>Deterministic Compact Ledger Escrow Execution</span>
            </div>
          </div>
        </div>

        <div className="assurance-card-right font-mono">
          <div className="privacy-assurance-header">
            <span className="privacy-assurance-title">SHIELDED POSITION ENCLAVE</span>
            <span className="telemetry-enclave-indicator">
              <span className="status-dot-sm dot-success" />
              <span>ACTIVE</span>
            </span>
          </div>

          <div className="privacy-assurance-body">
            <div className="privacy-assurance-row">
              <span className="privacy-key">CIRCUITS</span>
              <span className="privacy-val">6 Compact Verifiers</span>
            </div>
            <div className="privacy-assurance-row">
              <span className="privacy-key">PROOFS</span>
              <span className="privacy-val text-accent">Client-Side ZK</span>
            </div>
            <div className="privacy-assurance-row">
              <span className="privacy-key">ESCROW</span>
              <span className="privacy-val">Deterministic State</span>
            </div>
            <div className="privacy-assurance-row">
              <span className="privacy-key">DATA EXPOSURE</span>
              <span className="privacy-val text-success">Zero Leakage</span>
            </div>
          </div>

          <div className="privacy-assurance-footer">
            <span className="privacy-badge">100% PRIVATE CREDIT INFRASTRUCTURE</span>
          </div>
        </div>
      </section>
    </div>
  );
};

export default MyLoansPage;
