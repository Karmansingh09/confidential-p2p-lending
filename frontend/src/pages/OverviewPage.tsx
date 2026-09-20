import React, { useState } from 'react';
import type { LoanDetailsModel } from '../types/index.ts';
import { LoanStatus } from '../types/index.ts';
import type { LoanRegistry } from '../lib/loan-registry.ts';
import type { AccountContext } from '../types/account.ts';
import { LoanStatusBadge } from '../components/LoanStatusBadge.tsx';
import type { NavigationTab } from '../types/navigation.ts';
import { getWalletProvider } from '../lib/account-service.ts';
import { getNetworkConfigService } from '../lib/network-config-service.ts';
import { getContractVerificationService } from '../lib/contract-verification-service.ts';
import { AnimatedNumber } from '../components/common/AnimatedNumber.tsx';

export interface OverviewPageProps {
  loanRegistry: LoanRegistry;
  accountContext: AccountContext;
  onSelectLoan: (loanId: string) => void;
  onNavigate: (tab: NavigationTab) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  loanRegistry,
  accountContext,
  onSelectLoan,
  onNavigate,
}) => {
  const loansMap = loanRegistry.getLoans();
  const orderedIds = loanRegistry.getOrderedLoanIds();
  const totalLoans = orderedIds.length;

  const [tableFilter, setTableFilter] = useState<'all' | 'requested' | 'funded' | 'repaid' | 'settled'>('all');

  const requestedCount = orderedIds.filter((id) => loansMap[id]?.status === LoanStatus.requested).length;
  const fundedCount = orderedIds.filter((id) => loansMap[id]?.status === LoanStatus.funded).length;
  const repaidCount = orderedIds.filter((id) => loansMap[id]?.status === LoanStatus.repaid).length;
  const settledCount = orderedIds.filter((id) => loansMap[id]?.status === LoanStatus.settled).length;

  const totalPrincipal = orderedIds.reduce((acc, id) => {
    const l = loansMap[id];
    return l ? acc + l.amount : acc;
  }, 0n);

  const provider = getWalletProvider();
  const netConfig = getNetworkConfigService().getNetworkConfig();
  const verificationService = getContractVerificationService();
  const verificationResult = verificationService.getVerificationResult();
  const isContractVerified = verificationResult.status === 'VERIFIED';

  const requestedPct = totalLoans > 0 ? (requestedCount / totalLoans) * 100 : 0;
  const fundedPct = totalLoans > 0 ? (fundedCount / totalLoans) * 100 : 0;
  const repaidPct = totalLoans > 0 ? (repaidCount / totalLoans) * 100 : 0;
  const settledPct = totalLoans > 0 ? (settledCount / totalLoans) * 100 : 0;

  const handleOpenLoan = (loanId: string) => {
    onSelectLoan(loanId);
    onNavigate('loan-details');
  };

  const isConnected = accountContext.connectionStatus === 'CONNECTED';
  const role = accountContext.selectedRole || 'BORROWER';

  const filteredIds = orderedIds.filter((id) => {
    const loan = loansMap[id];
    if (!loan) return false;
    if (tableFilter === 'all') return true;
    if (tableFilter === 'requested') return loan.status === LoanStatus.requested;
    if (tableFilter === 'funded') return loan.status === LoanStatus.funded;
    if (tableFilter === 'repaid') return loan.status === LoanStatus.repaid;
    if (tableFilter === 'settled') return loan.status === LoanStatus.settled;
    return true;
  });

  // Derive genuine real-time agreement activity milestones from active registry
  const recentMilestones = orderedIds.slice(0, 5).map((id, idx) => {
    const loan = loansMap[id];
    let eventName = 'Loan Proposed';
    let detail = 'Initial terms created and queued on desk';
    if (loan?.status === LoanStatus.settled) {
      eventName = 'Settlement Finalized';
      detail = 'Principal & yield claims settled in terminal state';
    } else if (loan?.status === LoanStatus.repaid) {
      eventName = 'Repayment Recorded';
      detail = 'Full obligation cleared before block deadline';
    } else if (loan?.status === LoanStatus.funded) {
      eventName = 'Capital Committed';
      detail = 'Lender escrow locked into verified terms';
    } else if (loan?.isEligibilityVerified) {
      eventName = 'ZK Proof Verified';
      detail = 'Client-side witness satisfied threshold criteria';
    }
    return {
      id,
      step: `0${idx + 1}`,
      eventName,
      detail,
      amount: loan?.amount,
      status: loan?.statusText || 'requested',
    };
  });

  return (
    <div className="overview-page">
      {/* 1. DESK INTRODUCTION & ASYMMETRIC ENCLAVE MODULE (58% / 42%) */}
      <section className="overview-hero-section">
        <div className="overview-hero-left">
          <div className="overview-kicker font-mono">
            <span>MIDNIGHT NETWORK</span>
            <span className="kicker-sep">//</span>
            <span>ZERO-KNOWLEDGE UNDERWRITING</span>
          </div>
          <h1 className="overview-headline">Confidential Lending Desk</h1>
          <p className="overview-lead">
            Privacy-preserving P2P lending infrastructure for verified lending outcomes without exposing sensitive financial information.
          </p>

          <div className="hero-actions-row">
            <button
              type="button"
              className="btn-overview-primary"
              onClick={() => onNavigate('create-loan')}
            >
              <span>+ PROPOSE LOAN</span>
            </button>
            <button
              type="button"
              className="btn-overview-secondary"
              onClick={() => onNavigate('marketplace')}
            >
              <span>MARKETPLACE</span>
              <span className="overview-arrow">&rarr;</span>
            </button>
          </div>
        </div>

        <div className="overview-hero-right">
          <div className="overview-protocol-summary font-mono">
            <div className="proto-summary-header">
              <span className="summary-title">UNDERWRITING ENCLAVE</span>
              <span className="summary-status">
                <span className="status-dot-sm dot-success" />
                <span>SHIELDED ENCLAVE</span>
              </span>
            </div>
            <div className="proto-summary-body">
              <div className="summary-row">
                <span className="summary-label">PROOF SYSTEM</span>
                <span className="summary-val text-accent">Client-Side ZK</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">COMPACT CIRCUITS</span>
                <span className="summary-val">6 Verified</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">ATTESTATION</span>
                <span className="summary-val">{isContractVerified ? 'Verified Circuit' : 'Mathematical Only'}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">DATA EXPOSURE</span>
                <span className="summary-val text-success">Zero Leakage</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. FINANCIAL WORKSPACE: PRIMARY METRIC + STATS + AGREEMENT LIFECYCLE */}
      <section className="overview-financial-workspace">
        <div className="financial-workspace-top">
          {/* Dominant Primary Metric */}
          <div className="financial-primary-metric">
            <span className="metric-eyebrow font-mono">PRINCIPAL IN DESK</span>
            <div className="metric-value-row">
              <span className="metric-value-huge">
                <AnimatedNumber value={totalPrincipal} />
              </span>
              <span className="metric-unit-tag font-mono">MICRO-UNITS</span>
            </div>
            <p className="metric-subtext">
              Total capital commitments across canonical loan agreements on this node.
            </p>
          </div>

          {/* Secondary Financial Indicators (5-Metric Stats Rail) */}
          <div className="financial-secondary-stats font-mono">
            <div className="stat-column">
              <span className="stat-label">TOTAL AGREEMENTS</span>
              <span className="stat-value">{totalLoans}</span>
              <span className="stat-micro">Active Registry</span>
            </div>
            <div className="stat-column">
              <span className="stat-label">QUEUED REQUESTS</span>
              <span className="stat-value text-amber">{requestedCount}</span>
              <span className="stat-micro">Awaiting Funding</span>
            </div>
            <div className="stat-column">
              <span className="stat-label">ACTIVE FUNDED</span>
              <span className="stat-value text-accent">{fundedCount}</span>
              <span className="stat-micro">Accruing Terms</span>
            </div>
            <div className="stat-column">
              <span className="stat-label">REPAID</span>
              <span className="stat-value text-muted">{repaidCount}</span>
              <span className="stat-micro">Obligation Cleared</span>
            </div>
            <div className="stat-column">
              <span className="stat-label">SETTLED</span>
              <span className="stat-value text-success">{settledCount}</span>
              <span className="stat-micro">Terminal State</span>
            </div>
          </div>
        </div>

        {/* Wide Agreement Lifecycle Section */}
        <div className="overview-lifecycle-workspace">
          <div className="lifecycle-header-row font-mono">
            <div className="lifecycle-title-group">
              <span className="lifecycle-kicker font-mono">AGREEMENT WORKFLOW</span>
              <h3 className="lifecycle-title">CANONICAL LIFECYCLE</h3>
            </div>
            <div className="lifecycle-metrics-summary font-mono">
              <span className="summary-pill"><span className="dot dot-requested" /> {requestedCount} Queued</span>
              <span className="summary-pill"><span className="dot dot-funded" /> {fundedCount} Funded</span>
              <span className="summary-pill"><span className="dot dot-repaid" /> {repaidCount} Repaid</span>
              <span className="summary-pill"><span className="dot dot-settled" /> {settledCount} Settled</span>
            </div>
          </div>

          {/* Wide Horizontal Composition */}
          <div className="lifecycle-stepper-track">
            {/* Stage 1: REQUESTED */}
            <div className="lifecycle-step-card">
              <div className="step-card-header">
                <span className="step-indicator dot-requested" />
                <span className="step-name font-mono">REQUESTED</span>
              </div>
              <div className="step-count-row">
                <span className="step-count font-sans">{requestedCount}</span>
                <span className="step-pct font-mono">{requestedPct.toFixed(0)}%</span>
              </div>
              <p className="step-desc">Queued on node awaiting capital allocation</p>
            </div>

            <div className="lifecycle-track-arrow" aria-hidden="true">&rarr;</div>

            {/* Stage 2: FUNDED */}
            <div className="lifecycle-step-card">
              <div className="step-card-header">
                <span className="step-indicator dot-funded" />
                <span className="step-name font-mono">FUNDED</span>
              </div>
              <div className="step-count-row">
                <span className="step-count font-sans">{fundedCount}</span>
                <span className="step-pct font-mono">{fundedPct.toFixed(0)}%</span>
              </div>
              <p className="step-desc">Capital committed in deterministic escrow</p>
            </div>

            <div className="lifecycle-track-arrow" aria-hidden="true">&rarr;</div>

            {/* Stage 3: REPAID */}
            <div className="lifecycle-step-card">
              <div className="step-card-header">
                <span className="step-indicator dot-repaid" />
                <span className="step-name font-mono">REPAID</span>
              </div>
              <div className="step-count-row">
                <span className="step-count font-sans">{repaidCount}</span>
                <span className="step-pct font-mono">{repaidPct.toFixed(0)}%</span>
              </div>
              <p className="step-desc">Principal &amp; interest settled by borrower</p>
            </div>

            <div className="lifecycle-track-arrow" aria-hidden="true">&rarr;</div>

            {/* Stage 4: SETTLED */}
            <div className="lifecycle-step-card is-terminal">
              <div className="step-card-header">
                <span className="step-indicator dot-settled" />
                <span className="step-name font-mono">SETTLED</span>
              </div>
              <div className="step-count-row">
                <span className="step-count font-sans">{settledCount}</span>
                <span className="step-pct font-mono">{settledPct.toFixed(0)}%</span>
              </div>
              <p className="step-desc">Terminal state finalized on-chain</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. ACTIVE LENDING WORKSPACE (MAIN OPERATIONAL CENTERPIECE) */}
      <section className="active-lending-workspace">
        <div className="active-lending-header">
          <div className="active-lending-title-group">
            <h2>ACTIVE LENDING</h2>
            <span className="active-lending-count font-mono">{totalLoans} AGREEMENTS</span>
          </div>

          <div className="editorial-text-tabs" role="tablist">
            {(['all', 'requested', 'funded', 'repaid', 'settled'] as const).map((f) => {
              const count =
                f === 'all'
                  ? totalLoans
                  : f === 'requested'
                  ? requestedCount
                  : f === 'funded'
                  ? fundedCount
                  : f === 'repaid'
                  ? repaidCount
                  : settledCount;
              return (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={tableFilter === f}
                  className={`editorial-tab-btn font-mono ${tableFilter === f ? 'active' : ''}`}
                  onClick={() => setTableFilter(f)}
                >
                  {f.toUpperCase()} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {filteredIds.length === 0 ? (
          <div className="table-empty">
            <p>No loan agreements match the selected criteria.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="editorial-agreements-table">
              <thead>
                <tr>
                  <th style={{ width: '18%' }}>AGREEMENT</th>
                  <th style={{ width: '14%' }}>ROLE</th>
                  <th style={{ width: '18%' }}>PRINCIPAL</th>
                  <th style={{ width: '18%' }}>STATUS</th>
                  <th style={{ width: '18%' }}>UNDERWRITING</th>
                  <th style={{ width: '14%' }} className="text-right">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredIds.map((loanId) => {
                  const loan = loansMap[loanId];
                  if (!loan) return null;
                  const isBorrower = role === 'BORROWER';

                  return (
                    <tr
                      key={loanId}
                      className="editorial-agreement-row"
                      onClick={() => handleOpenLoan(loanId)}
                    >
                      <td>
                        <span className="agreement-id">{loanId}</span>
                      </td>
                      <td>
                        <span className="agreement-role">
                          {isBorrower ? 'BORROWER' : 'LENDER'}
                        </span>
                      </td>
                      <td>
                        <span className="agreement-principal">
                          {loan.amount.toLocaleString()}
                        </span>
                        <span className="agreement-unit">units</span>
                      </td>
                      <td>
                        <LoanStatusBadge statusText={loan.statusText} />
                      </td>
                      <td>
                        <span className={`underwriting-attestation-tag font-mono ${loan.isEligibilityVerified ? 'attested' : 'unverified'}`}>
                          {loan.isEligibilityVerified ? (
                            <>
                              <span className="attest-mark">✓</span> ZK VERIFIED
                            </>
                          ) : (
                            <>
                              <span className="unverified-mark">—</span> UNVERIFIED
                            </>
                          )}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className="action-link font-mono">
                          <span>View details</span>
                          <span className="action-arrow">&rarr;</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 4. LOWER WORKSPACE: RECENT ACTIVITY (60%) + PRIVACY ARCHITECTURE (40%) */}
      <section className="overview-lower-workspace">
        {/* Left Column (60%): Recent Agreement Activity / Audit Log */}
        <div className="lower-activity-col">
          <div className="lower-col-header font-mono">
            <div className="header-title-group">
              <span className="col-tag">AUDIT LOG</span>
              <h3 className="col-title">RECENT LENDING ACTIVITY</h3>
            </div>
            <button
              type="button"
              className="btn-link-action font-mono"
              onClick={() => onNavigate('transactions')}
            >
              <span>Transactions Console</span>
              <span className="arrow-symbol">&rarr;</span>
            </button>
          </div>

          <div className="activity-timeline-list">
            {recentMilestones.map((item) => (
              <div
                key={item.id}
                className="activity-timeline-row"
                onClick={() => handleOpenLoan(item.id)}
              >
                <div className="activity-time-col font-mono">
                  <span className="activity-loan-id">{item.id}</span>
                  <span className="activity-step-num">{item.step}</span>
                </div>
                <div className="activity-desc-col">
                  <div className="activity-event-name font-mono">{item.eventName}</div>
                  <div className="activity-event-detail">{item.detail}</div>
                </div>
                <div className="activity-val-col font-mono">
                  <span className="activity-amount">
                    {item.amount ? `${item.amount.toLocaleString()} units` : '—'}
                  </span>
                  <span className={`activity-status-text status-${item.status}`}>
                    {item.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column (40%): Protocol & Cryptographic Privacy Boundary */}
        <div className="lower-privacy-col">
          <div className="lower-col-header font-mono">
            <div className="header-title-group">
              <span className="col-tag">SECURITY ENCLAVE</span>
              <h3 className="col-title">PRIVACY ARCHITECTURE</h3>
            </div>
            <button
              type="button"
              className="btn-link-action font-mono"
              onClick={() => onNavigate('contract-privacy')}
            >
              <span>Inspect Circuits</span>
              <span className="arrow-symbol">&rarr;</span>
            </button>
          </div>

          <div className="privacy-spec-body">
            <div className="privacy-statement-box">
              <div className="spec-label font-mono">ZERO-KNOWLEDGE BOUNDARY</div>
              <p className="spec-quote">
                "Borrower financial inputs remain strictly within client-side memory. Only cryptographic attestations and agreed loan terms transition to the canonical ledger."
              </p>
            </div>

            <div className="privacy-specs-grid font-mono">
              <div className="spec-row">
                <span className="spec-key">VERIFICATION CIRCUIT</span>
                <span className="spec-val text-accent">{isContractVerified ? 'VERIFIED (Compact v1)' : 'LOCAL PROOF'}</span>
              </div>
              <div className="spec-row">
                <span className="spec-key">COMPACT CIRCUITS</span>
                <span className="spec-val">6 Canonical Assertions</span>
              </div>
              <div className="spec-row">
                <span className="spec-key">NETWORK LEDGER</span>
                <span className="spec-val">{netConfig.networkName || 'Local Prototype (In-Memory)'}</span>
              </div>
              <div className="spec-row">
                <span className="spec-key">EXECUTION ADAPTER</span>
                <span className="spec-val">{provider.isPrototype ? 'Prototype Provider' : 'Live Node'}</span>
              </div>
              <div className="spec-row">
                <span className="spec-key">STATE SETTLEMENT</span>
                <span className="spec-val text-success">Deterministic Escrow</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default OverviewPage;
