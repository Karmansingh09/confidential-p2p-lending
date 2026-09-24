import React from 'react';
import type { LoanDetailsModel } from '../types/index.ts';
import type { AccountContext, AccountRole } from '../types/account.ts';
import { LoanStatus } from '../types/index.ts';
import { getLifecycleActionDescriptor } from '../lib/marketplace.ts';
import { getAccountAuthorization } from '../lib/account-authorization.ts';
import type { LifecycleTransactionAction } from '../types/transaction-orchestration.ts';

interface LoanActionPanelProps {
  loan: LoanDetailsModel;
  activeLoanId: string;
  onSelectLoan: (loanId: string) => void;
  loansMap?: Record<string, LoanDetailsModel>;
  onStartVerification?: () => void;
  onStartRepayment?: () => void;
  onStartSettlement?: () => void;
  onStartFunding?: () => void;
  accountContext?: AccountContext;
  onConnectAccount?: (role?: AccountRole) => void;
  onReviewAction?: (action: LifecycleTransactionAction) => void;
}

export const LoanActionPanel: React.FC<LoanActionPanelProps> = ({
  loan,
  activeLoanId,
  onSelectLoan,
  loansMap,
  onStartVerification,
  onStartRepayment,
  onStartSettlement,
  onStartFunding,
  accountContext,
  onConnectAccount,
  onReviewAction,
}) => {
  // If account context is provided, derive account-aware action
  const isConnected =
    accountContext?.connectionStatus === 'CONNECTED' && accountContext.identity !== null;
  const auth = accountContext ? getAccountAuthorization(loan, accountContext) : null;

  let roleBadge = 'Lifecycle Action';
  let actionTitle = '';
  let actionDesc = '';
  let buttonLabel = '';
  let noticeText = '';
  let canExecute = false;
  let actionKind: 'connect' | 'verify' | 'fund' | 'repay' | 'settle' | 'none' = 'none';

  if (!accountContext) {
    const defaultDescriptor = getLifecycleActionDescriptor(loan);
    roleBadge = defaultDescriptor.role;
    actionTitle = defaultDescriptor.title;
    actionDesc = defaultDescriptor.description;
    buttonLabel = defaultDescriptor.buttonText;
    noticeText = defaultDescriptor.notice;
    canExecute = defaultDescriptor.canExecute;
    actionKind = defaultDescriptor.actionType as any;
  } else if (!isConnected) {
    const isProto = accountContext.isPrototype ?? true;
    roleBadge = 'Account Disconnected';
    actionTitle = isProto ? 'Connect Prototype Account' : 'Connect Wallet';
    actionDesc = isProto
      ? 'Connect a local prototype account persona (Borrower, Lender, or Third-Party) to evaluate lifecycle transitions.'
      : 'Connect your Midnight Lace wallet or select an account persona to evaluate lifecycle transitions.';
    buttonLabel = isProto ? 'Connect Prototype Account' : 'Connect Wallet';
    noticeText = isProto
      ? 'Select a prototype account persona to execute contract-guarded actions.'
      : 'Connect your Midnight Lace wallet to execute contract-guarded actions.';
    canExecute = true;
    actionKind = 'connect';
  } else if (loan.status === LoanStatus.settled) {
    roleBadge = 'Protocol Terminal State';
    actionTitle = 'Agreement Concluded';
    actionDesc =
      'This loan has completed its full lifecycle. All obligations were mathematically proven and finalized.';
    buttonLabel = 'Loan Fully Settled';
    noticeText = 'Agreement is concluded in terminal settled state. Terms are immutable.';
    canExecute = false;
    actionKind = 'none';
  } else if (accountContext.selectedRole === 'PARTICIPANT' || (!auth?.isBorrower && !auth?.isLender && accountContext.selectedRole !== 'LENDER')) {
    roleBadge = 'Third-Party Account';
    actionTitle = 'No Participant Action Available';
    actionDesc =
      'Your active account is neither the designated borrower nor the lender for this agreement. Third-party observers cannot execute state transitions.';
    buttonLabel = 'No Participant Action Available';
    noticeText = 'Switch to the Borrower or Lender prototype account to execute lifecycle transitions.';
    canExecute = false;
    actionKind = 'none';
  } else if (loan.status === LoanStatus.requested && !loan.isEligibilityVerified) {
    if (auth?.canVerifyEligibility) {
      roleBadge = 'Borrower Action';
      actionTitle = 'Generate Confidential Eligibility Proof';
      actionDesc =
        'Executes local zero-knowledge prover to disclose that financial witness satisfies threshold without revealing secret values.';
      buttonLabel = 'Execute ZK Proof (Off-Chain Prototype)';
      noticeText = 'Eligibility verification required before funding. Private data remains off-chain.';
      canExecute = true;
      actionKind = 'verify';
    } else {
      roleBadge = 'Borrower Verification Required';
      actionTitle = 'Awaiting Borrower Eligibility Verification';
      actionDesc =
        'This agreement requires borrower zero-knowledge qualification before lenders can evaluate or fund it.';
      buttonLabel = 'Awaiting Borrower Verification';
      noticeText = auth?.reasons.verify || 'Borrower action required before funding.';
      canExecute = false;
      actionKind = 'none';
    }
  } else if (loan.status === LoanStatus.requested && loan.isEligibilityVerified) {
    if (auth?.canFundLoan) {
      roleBadge = 'Lender Action';
      actionTitle = 'Provide Loan Funding';
      actionDesc =
        'Lender commits capital to the verified loan request and transitions agreement status to funded.';
      buttonLabel = 'Provide Loan Funding';
      noticeText = 'Loan is verified in zero-knowledge and ready for lender capital commitment.';
      canExecute = true;
      actionKind = 'fund';
    } else {
      roleBadge = 'Lender Funding Required';
      actionTitle = 'Awaiting Lender Capital Commitment';
      actionDesc =
        'Eligibility is verified in zero-knowledge. This loan is open for lender evaluation and funding.';
      buttonLabel = 'Awaiting Lender Funding';
      noticeText = auth?.reasons.fund || 'Lender capital commitment required.';
      canExecute = false;
      actionKind = 'none';
    }
  } else if (loan.status === LoanStatus.funded) {
    if (auth?.canRepayLoan) {
      roleBadge = 'Borrower Action';
      actionTitle = 'Repay Principal & Interest Obligation';
      actionDesc =
        'Borrower satisfies total debt obligation. Contract validates Euclidean division interest calculation in ZK.';
      buttonLabel = 'Repay Loan (Prototype Action)';
      noticeText = 'Awaiting borrower repayment of principal + simple interest obligation.';
      canExecute = true;
      actionKind = 'repay';
    } else {
      roleBadge = 'Borrower Repayment Awaited';
      actionTitle = 'Awaiting Borrower Repayment';
      actionDesc =
        'This loan has been funded and is awaiting borrower repayment of principal and simple interest.';
      buttonLabel = 'Awaiting Borrower Repayment';
      noticeText = auth?.reasons.repay || 'Only the borrower can repay this loan.';
      canExecute = false;
      actionKind = 'none';
    }
  } else if (loan.status === LoanStatus.repaid) {
    if (auth?.canSettleLoan) {
      roleBadge = 'Borrower or Lender Action';
      actionTitle = 'Settle Loan Agreement';
      actionDesc =
        'Finalizes the loan agreement into terminal closed state. Concludes all participant obligations.';
      buttonLabel = 'Settle Loan (Prototype Action)';
      noticeText = 'Loan has been repaid and is ready for terminal settlement closure.';
      canExecute = true;
      actionKind = 'settle';
    } else {
      roleBadge = 'Participant Settlement Awaited';
      actionTitle = 'Awaiting Participant Settlement';
      actionDesc =
        'Repayment is complete. The borrower or designated lender may settle this agreement.';
      buttonLabel = 'Awaiting Settlement';
      noticeText = auth?.reasons.settle || 'Only authorized participants can settle.';
      canExecute = false;
      actionKind = 'none';
    }
  }

  const handleActionClick = () => {
    if (actionKind === 'connect') {
      if (onConnectAccount) {
        onConnectAccount('BORROWER');
      }
      return;
    }
    if (actionKind === 'verify' && onStartVerification) {
      onStartVerification();
      return;
    }
    if (actionKind === 'fund') {
      if (onStartFunding) {
        onStartFunding();
      } else {
        alert(
          `Provide Loan Funding: Please use the Lender Evaluation Panel in the right column to review and fund agreement #${activeLoanId}.`
        );
      }
      return;
    }
    if (actionKind === 'repay' && onStartRepayment) {
      onStartRepayment();
      return;
    }
    if (actionKind === 'settle' && onStartSettlement) {
      onStartSettlement();
      return;
    }
    alert(
      `Prototype Action: ${buttonLabel}\n\nNotice: Operating in Local Mock Mode (Commit #20). Actions derive from canonical LoanDesk contract guards. No real blockchain transactions or wallet signatures are fabricated.`
    );
  };

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
          <div className="action-role-badge">{roleBadge}</div>
          <h4>{actionTitle}</h4>
          <p>{actionDesc}</p>
          <div className="action-notice-box">
            <span className="notice-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </span>
            <span className="notice-content">{noticeText}</span>
          </div>
        </div>

        <div className="action-button-wrapper" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`action-btn ${canExecute ? 'primary-action' : 'concluded-action'}`}
            disabled={!canExecute}
            onClick={handleActionClick}
          >
            {buttonLabel}
          </button>
          {actionKind !== 'none' && actionKind !== 'connect' && onReviewAction && (
            <button
              type="button"
              className="action-btn"
              style={{ background: '#1e293b', color: '#9FB8D8', border: '1px solid rgba(159, 184, 216, 0.2)' }}
              onClick={() => {
                const actionMap: Record<string, LifecycleTransactionAction> = {
                  verify: 'VERIFY_ELIGIBILITY',
                  fund: 'FUND_LOAN',
                  repay: 'REPAY_LOAN',
                  settle: 'SETTLE_LOAN',
                };
                if (actionMap[actionKind]) {
                  onReviewAction(actionMap[actionKind]);
                }
              }}
              data-testid="review-readiness-btn"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px', verticalAlign: 'middle' }}>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              Review Readiness
            </button>
          )}
        </div>
      </div>

      <div className="action-integration-notice">
        <span className="notice-dot"></span>
        <span className="notice-text">
          <strong>Architecture Bridge:</strong> This action panel derives state directly from{' '}
          <code>LoanDesk.can*</code> guards and the active account abstraction. Live Midnight.js wallet signing will be attached in upcoming milestones.
        </span>
      </div>
    </div>
  );
};
