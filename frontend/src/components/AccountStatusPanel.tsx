import React from 'react';
import type { LoanDetailsModel } from '../types/index.ts';
import type { AccountContext, AccountRole } from '../types/account.ts';
import { getAccountAuthorization } from '../lib/account-authorization.ts';

interface AccountStatusPanelProps {
  loan?: LoanDetailsModel | null;
  loanId?: string;
  accountContext: AccountContext;
  onSwitchRole?: (role: AccountRole) => void;
}

export const AccountStatusPanel: React.FC<AccountStatusPanelProps> = ({
  loan,
  loanId,
  accountContext,
}) => {
  const { identity, selectedRole, connectionStatus, networkName } = accountContext;
  const isConnected = connectionStatus === 'CONNECTED' && identity !== null;
  const auth = getAccountAuthorization(loan, accountContext);

  const formatPk = (hex?: string) => {
    if (!hex) return '0x0000... (Disconnected)';
    return `${hex.slice(0, 10)}...${hex.slice(-8)}`;
  };

  return (
    <div className="account-status-panel-card" aria-label="Active Account & Authorization Status">
      <div className="status-panel-top">
        <div className="panel-title-area">
          <span className="panel-badge-icon">🪪</span>
          <div>
            <h4 className="panel-main-title">Active Account &amp; Permissions</h4>
            <span className="panel-subtitle-text">
              Local Prototype Account &bull; {networkName}
            </span>
          </div>
        </div>
        <div className={`connection-pill ${isConnected ? 'pill-connected' : 'pill-disconnected'}`}>
          <span className="pill-dot" />
          <span>{connectionStatus}</span>
        </div>
      </div>

      <div className="account-summary-row">
        <div className="summary-col">
          <span className="col-label">Current Account</span>
          <strong className="col-value role-highlight">
            {selectedRole === 'BORROWER' && 'Borrower'}
            {selectedRole === 'LENDER' && 'Lender'}
            {selectedRole === 'PARTICIPANT' && 'Third-Party'}
            {selectedRole === 'NONE' && 'Disconnected'}
          </strong>
        </div>

        <div className="summary-col">
          <span className="col-label">Public Identity</span>
          <span className="col-value pk-mono" title={identity?.publicKeyHex ?? 'No account'}>
            {formatPk(identity?.publicKeyHex)}
          </span>
        </div>

        <div className="summary-col">
          <span className="col-label">This Agreement</span>
          <strong className="col-value">
            {loanId ? `Loan #${loanId}` : 'None Selected'}
            {loan && <span className="agreement-status-tag">({loan.statusText})</span>}
          </strong>
        </div>
      </div>

      <div className="permissions-container">
        <div className="permissions-header">
          <span className="permissions-title">Agreement Permissions</span>
          <span className="permissions-subtitle">Derived from Compact Contract Guards</span>
        </div>

        <div className="permissions-grid">
          {/* Verify Permission */}
          <div className={`permission-item ${auth.canVerifyEligibility ? 'perm-allowed' : 'perm-denied'}`}>
            <span className="perm-symbol">{auth.canVerifyEligibility ? '✓' : '✕'}</span>
            <div className="perm-details">
              <span className="perm-name">Verify Eligibility</span>
              <span className="perm-desc">
                {auth.canVerifyEligibility ? 'Authorized (Borrower)' : auth.reasons.verify}
              </span>
            </div>
          </div>

          {/* Fund Permission */}
          <div className={`permission-item ${auth.canFundLoan ? 'perm-allowed' : 'perm-denied'}`}>
            <span className="perm-symbol">{auth.canFundLoan ? '✓' : '✕'}</span>
            <div className="perm-details">
              <span className="perm-name">Fund Loan</span>
              <span className="perm-desc">
                {auth.canFundLoan ? 'Authorized (Lender)' : auth.reasons.fund}
              </span>
            </div>
          </div>

          {/* Repay Permission */}
          <div className={`permission-item ${auth.canRepayLoan ? 'perm-allowed' : 'perm-denied'}`}>
            <span className="perm-symbol">{auth.canRepayLoan ? '✓' : '✕'}</span>
            <div className="perm-details">
              <span className="perm-name">Repay Loan</span>
              <span className="perm-desc">
                {auth.canRepayLoan ? 'Authorized (Borrower)' : auth.reasons.repay}
              </span>
            </div>
          </div>

          {/* Settle Permission */}
          <div className={`permission-item ${auth.canSettleLoan ? 'perm-allowed' : 'perm-denied'}`}>
            <span className="perm-symbol">{auth.canSettleLoan ? '✓' : '✕'}</span>
            <div className="perm-details">
              <span className="perm-name">Settle Loan</span>
              <span className="perm-desc">
                {auth.canSettleLoan ? 'Authorized (Participant)' : auth.reasons.settle}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="status-panel-footer">
        <span className="warning-symbol">⚠️</span>
        <span className="footer-text">
          <strong>Local Simulation:</strong> Actions are contract-guarded off-chain. Live Midnight.js
          and Lace Wallet integration will be bound to this account abstraction in future milestones.
        </span>
      </div>
    </div>
  );
};
