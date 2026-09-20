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

  return (
    <div className="overview-page">
      {/* 1. Desk Introduction (Integrated into page, no card enclosure) */}
      <section className="overview-intro">
        <div className="overview-intro-left">
          <div className="overview-kicker font-mono">
            <span>MIDNIGHT NETWORK</span>
            <span className="kicker-sep">//</span>
            <span>ZERO-KNOWLEDGE UNDERWRITING</span>
          </div>
          <h1 className="overview-headline">Confidential Lending Desk</h1>
          <p className="overview-lead">
            Privacy-preserving P2P lending infrastructure for verified lending outcomes without exposing sensitive financial information.
          </p>
        </div>

        <div className="overview-intro-right">
          <div className="overview-protocol-meta font-mono">
            <div className="meta-item">
              <span className="meta-label">ZK VERIFICATION</span>
              <span className="meta-val text-accent">
                {isContractVerified ? 'VERIFIED' : 'LOCAL PROOF'}
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-label">CIRCUITS</span>
              <span className="meta-val">6 COMPACT</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">ENVIRONMENT</span>
              <span className="meta-val">{netConfig.environment || 'LOCAL'}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">EXECUTION</span>
              <span className="meta-val">{provider.name.toUpperCase()}</span>
            </div>
          </div>
          <div className="intro-actions-row">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onNavigate('create-loan')}
            >
              + Propose Loan
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

      {/* 2. Primary Desk State + Protocol State (Dominant financial visual + technical module) */}
      <section className="overview-state-section">
        {/* Dominant Portfolio / Lending Area */}
        <div className="primary-desk-state">
          <div className="primary-number-wrap">
            <span className="primary-number">
              <AnimatedNumber value={totalPrincipal} />
            </span>
            <span className="primary-number-label font-mono">
              PRINCIPAL IN DESK (MICRO-UNITS)
            </span>
          </div>

          <div className="portfolio-breakdown font-mono">
            <span><strong>{totalLoans}</strong> agreements</span>
            <span className="breakdown-sep">/</span>
            <span><strong>{requestedCount}</strong> queued requests</span>
            <span className="breakdown-sep">/</span>
            <span><strong>{fundedCount}</strong> active funded</span>
            <span className="breakdown-sep">/</span>
            <span><strong>{repaidCount}</strong> repaid</span>
            <span className="breakdown-sep">/</span>
            <span><strong>{settledCount}</strong> settled</span>
          </div>
        </div>

        {/* Restrained Protocol State Module */}
        <div className="protocol-state-module font-mono">
          <div className="proto-module-header">
            <span>PROTOCOL</span>
            <span className="proto-status-indicator">
              <span className={`status-dot-sm ${netConfig.status === 'CONFIGURED' ? 'dot-success' : 'dot-warning'}`} />
              <span>{netConfig.status === 'CONFIGURED' ? 'OPERATIONAL' : 'STANDBY'}</span>
            </span>
          </div>
          <div className="proto-module-body">
            <div className="proto-row">
              <span className="proto-label">NETWORK</span>
              <span className="proto-val">{netConfig.networkName || 'MIDNIGHT PREPROD'}</span>
            </div>
            <div className="proto-row">
              <span className="proto-label">EXECUTION</span>
              <span className="proto-val">{provider.isPrototype ? 'LOCAL PROTOTYPE' : 'ACTIVE NODE'}</span>
            </div>
            <div className="proto-row">
              <span className="proto-label">ZK PROOFS</span>
              <span className="proto-val text-accent">
                {isContractVerified ? 'VERIFIED' : 'LOCAL PROOF'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Active Lending Workspace (Unboxed, sitting directly on the canvas) */}
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
                  <th>Agreement ID</th>
                  <th>Position Role</th>
                  <th>Principal Amount</th>
                  <th>Status</th>
                  <th>Underwriting</th>
                  <th className="text-right">Action</th>
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
                        <span className="agreement-unit">UNITS</span>
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
                          View details &rarr;
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

      {/* 4. Secondary System Information (Subsystem Infrastructure) */}
      <section className="secondary-system-section">
        <div className="secondary-system-header">
          <h3 style={{ fontSize: '12px', letterSpacing: '0.08em', color: 'var(--text-muted)' }} className="font-mono">
            SUBSYSTEM INFRASTRUCTURE
          </h3>
          <button
            type="button"
            className="btn btn-ghost btn-sm font-mono text-xs"
            onClick={() => onNavigate('network')}
          >
            INSPECT ALL SUBSYSTEMS &rarr;
          </button>
        </div>

        <div className="table-responsive">
          <table className="editorial-agreements-table">
            <thead>
              <tr>
                <th>Subsystem Domain</th>
                <th>Provider / Environment</th>
                <th>Classification</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr className="editorial-agreement-row">
                <td><strong className="font-mono text-sm" style={{ color: 'var(--text-primary)' }}>Wallet Provider</strong></td>
                <td className="font-mono text-sm" style={{ color: 'var(--text-secondary)' }}>{provider.name}</td>
                <td><span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>ACCOUNT_IDENTITY</span></td>
                <td>
                  <span className={`font-mono text-xs ${isConnected ? 'text-success' : 'text-warning'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span className={`status-dot-sm ${isConnected ? 'dot-success' : 'dot-warning'}`} />
                    {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
                  </span>
                </td>
              </tr>
              <tr className="editorial-agreement-row">
                <td><strong className="font-mono text-sm" style={{ color: 'var(--text-primary)' }}>Network Protocol</strong></td>
                <td className="font-mono text-sm" style={{ color: 'var(--text-secondary)' }}>{netConfig.networkName} ({netConfig.environment})</td>
                <td><span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>LEDGER_TRANSPORT</span></td>
                <td>
                  <span className={`font-mono text-xs ${netConfig.status === 'CONFIGURED' ? 'text-success' : 'text-warning'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span className={`status-dot-sm ${netConfig.status === 'CONFIGURED' ? 'dot-success' : 'dot-warning'}`} />
                    {netConfig.status}
                  </span>
                </td>
              </tr>
              <tr className="editorial-agreement-row">
                <td><strong className="font-mono text-sm" style={{ color: 'var(--text-primary)' }}>Contract Engine</strong></td>
                <td className="font-mono text-sm" style={{ color: 'var(--text-secondary)' }}>Midnight Compact (6 Circuits)</td>
                <td><span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>ZERO_KNOWLEDGE_PROOF</span></td>
                <td>
                  <span className={`font-mono text-xs ${isContractVerified ? 'text-success' : 'text-warning'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span className={`status-dot-sm ${isContractVerified ? 'dot-success' : 'dot-warning'}`} />
                    {verificationResult.status}
                  </span>
                </td>
              </tr>
              <tr className="editorial-agreement-row">
                <td><strong className="font-mono text-sm" style={{ color: 'var(--text-primary)' }}>Transaction Execution</strong></td>
                <td className="font-mono text-sm" style={{ color: 'var(--text-secondary)' }}>{provider.isPrototype ? 'Local Prototype Mode' : 'Live Midnight Node'}</td>
                <td><span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>RECONCILIATION_SERVICE</span></td>
                <td>
                  <span className="font-mono text-xs text-accent" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span className="status-dot-sm" style={{ backgroundColor: 'var(--accent-primary)' }} />
                    {provider.isPrototype ? 'PROTOTYPE_LOCAL' : 'ACTIVE_NODE'}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default OverviewPage;
