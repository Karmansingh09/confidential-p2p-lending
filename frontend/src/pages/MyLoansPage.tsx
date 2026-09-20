import React, { useState } from 'react';
import type { LoanDetailsModel } from '../types/index.ts';
import { LoanStatus } from '../types/index.ts';
import type { LoanRegistry } from '../lib/loan-registry.ts';
import type { AccountContext } from '../types/account.ts';
import { LoanStatusBadge } from '../components/LoanStatusBadge.tsx';
import { LifecycleStepper } from '../components/LifecycleStepper.tsx';
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
  const [activeTab, setActiveTab] = useState<'borrowing' | 'lending'>('borrowing');
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

  const currentList = activeTab === 'borrowing' ? borrowingLoans : lendingLoans;

  const currentVolume = currentList.reduce((acc, id) => {
    const l = loansMap[id];
    return l ? acc + l.amount : acc;
  }, 0n);

  const handleOpenDetails = (loanId: string) => {
    onSelectLoan(loanId);
    onNavigate('loan-details');
  };

  return (
    <div className="overview-page my-loans-page">
      {/* 1. Portfolio Header */}
      <section className="overview-intro">
        <div className="overview-intro-left">
          <div className="overview-kicker font-mono">
            <span>CONFIDENTIAL PORTFOLIO</span>
            <span className="kicker-sep">//</span>
            <span>POSITION MANAGEMENT</span>
          </div>
          <h1 className="overview-headline">My Positions</h1>
          <p className="overview-lead">
            Track your borrowing agreements and active capital allocations across zero-knowledge lifecycle states.
          </p>
        </div>

        <div className="overview-intro-right">
          <div className="overview-protocol-meta font-mono">
            <div className="meta-item">
              <span className="meta-label">ACTIVE ROLE</span>
              <span className="meta-val text-accent">{role}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">LIFECYCLE</span>
              <span className="meta-val">DETERMINISTIC</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">RECORD PRIVACY</span>
              <span className="meta-val text-accent">SHIELDED</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">ATTESTATION</span>
              <span className="meta-val">COMPACT ZK</span>
            </div>
          </div>
          <div className="intro-actions-row">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onNavigate('create-loan')}
            >
              + New Request
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => onNavigate('marketplace')}
            >
              Marketplace &rarr;
            </button>
          </div>
        </div>
      </section>

      {/* 2. Position Volume & Lifecycle Strip */}
      <section className="overview-state-section">
        <div className="primary-desk-state">
          <div className="primary-number-wrap">
            <span className="primary-number">
              <AnimatedNumber value={currentVolume} />
            </span>
            <span className="primary-number-label font-mono">
              TOTAL {activeTab === 'borrowing' ? 'BORROWED' : 'COMMITTED'} PRINCIPAL (MICRO-UNITS)
            </span>
          </div>

          <div className="portfolio-breakdown font-mono">
            <span><strong>{currentList.length}</strong> active positions</span>
            <span className="breakdown-sep">/</span>
            <span><strong>{borrowingLoans.length}</strong> borrowing</span>
            <span className="breakdown-sep">/</span>
            <span><strong>{lendingLoans.length}</strong> lending</span>
            <span className="breakdown-sep">/</span>
            <span><strong>100%</strong> privacy-shielded</span>
          </div>
        </div>

        <div className="protocol-state-module font-mono">
          <div className="proto-module-header">
            <span>LIFECYCLE PIPELINE</span>
            <span className="proto-status-indicator">
              <span className="status-dot-sm dot-success" />
              <span>SYNCHRONIZED</span>
            </span>
          </div>
          <div className="proto-module-body">
            <div className="proto-row">
              <span className="proto-label">01 REQUEST</span>
              <span className="proto-val">ZK QUALIFICATION</span>
            </div>
            <div className="proto-row">
              <span className="proto-label">02 FUNDING</span>
              <span className="proto-val">CAPITAL LOCK</span>
            </div>
            <div className="proto-row">
              <span className="proto-label">03 SETTLEMENT</span>
              <span className="proto-val text-accent">ON-CHAIN ATOMIC</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Positions Workspace */}
      <section className="active-lending-workspace">
        <div className="active-lending-header">
          <div className="active-lending-title-group">
            <h2>POSITIONS LEDGER</h2>
            <span className="active-lending-count font-mono">{currentList.length} AGREEMENTS</span>
          </div>

          <div className="editorial-text-tabs" role="tablist">
            <button
              type="button"
              className={`editorial-tab-btn font-mono ${activeTab === 'borrowing' ? 'active' : ''}`}
              onClick={() => setActiveTab('borrowing')}
            >
              BORROWING ({borrowingLoans.length})
            </button>
            <button
              type="button"
              className={`editorial-tab-btn font-mono ${activeTab === 'lending' ? 'active' : ''}`}
              onClick={() => setActiveTab('lending')}
            >
              LENDING ({lendingLoans.length})
            </button>
          </div>
        </div>

        {currentList.length === 0 ? (
          <div className="table-empty" style={{ padding: '60px 20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
              No {activeTab === 'borrowing' ? 'Borrowing' : 'Lending'} Positions
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>
              {activeTab === 'borrowing'
                ? 'You have no active borrowing requests in the registry.'
                : 'You have not committed capital to any lending agreements yet.'}
            </p>
            <div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => (activeTab === 'borrowing' ? onNavigate('create-loan') : onNavigate('marketplace'))}
              >
                {activeTab === 'borrowing' ? '+ Create Request' : 'Browse Marketplace'}
              </button>
            </div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="editorial-agreements-table">
              <thead>
                <tr>
                  <th style={{ width: '13%' }}>Agreement ID</th>
                  <th style={{ width: '12%' }}>Position Role</th>
                  <th style={{ width: '16%' }}>Principal</th>
                  <th style={{ width: '12%' }}>Annual Rate</th>
                  <th style={{ width: '14%' }}>Status</th>
                  <th style={{ width: '18%' }}>Lifecycle Progress</th>
                  <th style={{ width: '15%', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {currentList.map((loanId) => {
                  const loan = loansMap[loanId];
                  if (!loan) return null;
                  const ratePercent = (Number(loan.interestRateBasisPoints) / 100).toFixed(2);
                  const isBorrowerRole = activeTab === 'borrowing';

                  return (
                    <tr
                      key={loanId}
                      className="editorial-agreement-row"
                      onClick={() => handleOpenDetails(loanId)}
                    >
                      <td>
                        <span className="agreement-id">{loanId}</span>
                      </td>
                      <td>
                        <span className="agreement-role">
                          {isBorrowerRole ? 'BORROWER' : 'LENDER'}
                        </span>
                      </td>
                      <td>
                        <span className="agreement-principal">
                          {loan.amount.toLocaleString()}
                        </span>
                        <span className="agreement-unit">UNITS</span>
                      </td>
                      <td>
                        <span className="font-mono text-accent font-semibold">{ratePercent}%</span>
                      </td>
                      <td>
                        <LoanStatusBadge statusText={loan.statusText} />
                      </td>
                      <td>
                        <LifecycleStepper loan={loan} compact={true} />
                      </td>
                      <td className="text-right">
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }} onClick={(e) => e.stopPropagation()}>
                          {loan.status === LoanStatus.requested && !loan.isEligibilityVerified && onStartVerification && (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              style={{ height: '32px', padding: '0 12px', fontSize: '12px' }}
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
                              className="btn btn-primary btn-sm"
                              style={{ height: '32px', padding: '0 12px', fontSize: '12px' }}
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
                              className="btn btn-primary btn-sm"
                              style={{ height: '32px', padding: '0 12px', fontSize: '12px' }}
                              onClick={() => {
                                onSelectLoan(loanId);
                                onStartSettlement(loanId);
                                onNavigate('loan-details');
                              }}
                            >
                              Settle
                            </button>
                          )}
                          <span className="action-link font-mono" style={{ cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleOpenDetails(loanId)}>
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
    </div>
  );
};

export default MyLoansPage;
