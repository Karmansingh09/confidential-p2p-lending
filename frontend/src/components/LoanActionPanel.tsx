import React from 'react';
import type { LoanDetailsModel } from '../types/index.js';
import { getLifecycleActionDescriptor } from '../lib/marketplace.js';

interface LoanActionPanelProps {
  loan: LoanDetailsModel;
  activeLoanId: string;
  onSelectLoan: (loanId: string) => void;
  loansMap?: Record<string, LoanDetailsModel>;
  onStartVerification?: () => void;
}

export const LoanActionPanel: React.FC<LoanActionPanelProps> = ({
  loan,
  activeLoanId,
  onSelectLoan,
  loansMap,
  onStartVerification,
}) => {
  const action = getLifecycleActionDescriptor(loan);

  return (
    <div className="action-panel-card" aria-label="Lifecycle Actions Panel">
      <div className="panel-header">
        <div>
          <h3>Protocol Action Dispatcher</h3>
          <span className="panel-subtitle">Lifecycle Transition Controls (Derived via Contract Guards)</span>
        </div>
        <div className="scenario-selector">
          <label htmlFor="scenario-select">Selected Agreement:</label>
          <select
            id="scenario-select"
            value={activeLoanId}
            onChange={(e) => onSelectLoan(e.target.value)}
          >
            {loansMap ? (
              Object.entries(loansMap).map(([id, l]) => (
                <option key={id} value={id}>
                  {id} &bull; {l.statusText.toUpperCase()}{l.isEligibilityVerified && l.statusText === 'requested' ? ' (VERIFIED)' : ''} &bull; {Number(l.amount).toLocaleString()} units
                </option>
              ))
            ) : (
              <>
                <option value="loan-001">loan-001: Stage 1 (Unverified)</option>
                <option value="loan-002">loan-002: Stage 2 (ZK Verified)</option>
                <option value="loan-003">loan-003: Stage 3 (Funded)</option>
                <option value="loan-004">loan-004: Stage 4 (Repaid)</option>
                <option value="loan-005">loan-005: Stage 5 (Settled)</option>
              </>
            )}
          </select>
        </div>
      </div>

      <div className="action-body">
        <div className="action-info">
          <div className="action-role-badge">{action.role}</div>
          <h4>{action.title}</h4>
          <p>{action.description}</p>
          <div className="action-notice-box">
            <span className="notice-icon">ℹ️</span>
            <span className="notice-content">{action.notice}</span>
          </div>
        </div>

        <div className="action-button-wrapper">
          <button
            type="button"
            className={`action-btn ${action.canExecute ? 'primary-action' : 'concluded-action'}`}
            disabled={!action.canExecute}
            onClick={() => {
              if (loan.status === 0 && !loan.isEligibilityVerified && onStartVerification) {
                onStartVerification();
                return;
              }
              alert(
                `Prototype Action: ${action.buttonText}\n\nNotice: The frontend is currently operating in Local Mock Mode (Commit #16). This action is derived from canonical LoanDesk contract guards (canVerifyEligibility, canFundLoan, canRepayLoan, canSettleLoan). No fake blockchain transactions or wallet signatures are fabricated.`
              );
            }}
          >
            {action.buttonText}
          </button>
        </div>
      </div>

      <div className="action-integration-notice">
        <span className="notice-dot"></span>
        <span className="notice-text">
          <strong>Architecture Bridge:</strong> This action panel derives state directly from{' '}
          <code>LoanDesk.can*</code> guards (Commit #12). Live Midnight.js wallet signing and proof sidecars will be attached in upcoming milestones.
        </span>
      </div>
    </div>
  );
};

