import React, { useState } from 'react';
import type { LoanDetailsModel } from 'contracts';
import {
  getSettlementReadiness,
  executeSettlementPrototype,
  evaluateLoanForSettlement,
} from '../lib/settlement-service.js';
import type { SettlementResult } from '../types/settlement.js';
import { formatAmount, formatBasisPoints, shortenAddress } from '../lib/formatters.js';
import { SettlementConfirmation } from './SettlementConfirmation.js';

interface SettlementPanelProps {
  loan: LoanDetailsModel;
  loanId: string;
  callerPk?: Uint8Array;
  onLoanSettled?: (loanId: string, updatedLoan: LoanDetailsModel) => void;
  onClose?: () => void;
}

export const SettlementPanel: React.FC<SettlementPanelProps> = ({
  loan,
  loanId,
  callerPk,
  onLoanSettled,
  onClose,
}) => {
  const [selectedRole, setSelectedRole] = useState<'BORROWER' | 'LENDER'>('BORROWER');
  const [isReviewing, setIsReviewing] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<SettlementResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const effectiveCallerPk =
    callerPk ??
    (selectedRole === 'BORROWER'
      ? loan.borrowerBytes
      : (loan.lenderBytes ?? loan.borrowerBytes));

  const readiness = getSettlementReadiness(loan, effectiveCallerPk);
  const evaluation = evaluateLoanForSettlement(loan, effectiveCallerPk);

  const handleConfirmSettlement = async () => {
    setIsExecuting(true);
    setErrorMessage(null);

    try {
      // Simulate asynchronous state transition
      await new Promise((resolve) => setTimeout(resolve, 350));

      const { updatedLoan, result } = await executeSettlementPrototype({
        loanId,
        loan,
        callerPk: effectiveCallerPk,
        callerRole: selectedRole,
      });

      setExecutionResult(result);
      if (onLoanSettled) {
        onLoanSettled(loanId, updatedLoan);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExecuting(false);
    }
  };

  if (executionResult) {
    return (
      <SettlementConfirmation
        result={executionResult}
        onDismiss={onClose}
      />
    );
  }

  return (
    <div className="settlement-panel-card" aria-label="Loan Terminal Settlement Panel">
      {/* Panel Header */}
      <div className="panel-header">
        <div className="panel-title-wrapper">
          <span className="panel-icon">🏁</span>
          <div>
            <h3>Terminal Loan Settlement</h3>
            <span className="panel-subtitle">Agreement ID: <strong>{loanId}</strong></span>
          </div>
        </div>
        {onClose && (
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close panel">
            ✕
          </button>
        )}
      </div>

      {/* Repayment Complete Confirmation Banner */}
      <div className="repayment-complete-banner">
        <span className="badge-icon">✓</span>
        <div className="badge-content">
          <strong>Repayment Complete</strong>
          <p>
            Principal plus simple interest has been cleared for this agreement. The agreement is now eligible for terminal settlement.
          </p>
        </div>
      </div>

      {/* Settlement Readiness Status Pill */}
      <div className="settlement-readiness-banner">
        <span
          className={`readiness-pill pill-${
            readiness.canSettle ? 'ready' : 'disabled'
          }`}
        >
          {readiness.status === 'READY_TO_SETTLE'
            ? 'Ready for Settlement'
            : readiness.status.replace(/_/g, ' ')}
        </span>
        {readiness.reason && (
          <span className="readiness-reason">{readiness.reason}</span>
        )}
      </div>

      {/* Authorization & Role Explanation */}
      <div className="settlement-auth-card">
        <div className="auth-header">
          <span className="auth-icon">🛡️</span>
          <div>
            <h4>Authorized Participants</h4>
            <p>
              Only the borrower or designated lender can settle this agreement. Settlement permanently concludes the contract lifecycle.
            </p>
          </div>
        </div>

        {/* Prototype Participant Switcher */}
        <div className="role-switcher-box">
          <span className="switcher-label">Settlement Signer (Prototype Mode):</span>
          <div className="switcher-buttons">
            <button
              type="button"
              className={`btn-role ${selectedRole === 'BORROWER' ? 'active' : ''}`}
              onClick={() => setSelectedRole('BORROWER')}
            >
              Borrower
            </button>
            <button
              type="button"
              className={`btn-role ${selectedRole === 'LENDER' ? 'active' : ''}`}
              onClick={() => setSelectedRole('LENDER')}
              disabled={!loan.lenderBytes}
            >
              Designated Lender
            </button>
          </div>
        </div>
      </div>

      {/* Public Agreement Terms Grid */}
      <div className="settlement-grid">
        <div className="settlement-grid-item">
          <span className="grid-label">Principal Amount</span>
          <strong className="grid-val">{formatAmount(evaluation.principal)}</strong>
        </div>

        <div className="settlement-grid-item">
          <span className="grid-label">Interest Rate</span>
          <strong className="grid-val">{formatBasisPoints(evaluation.interestRateBasisPoints)}</strong>
        </div>

        <div className="settlement-grid-item highlight-cleared">
          <span className="grid-label">Repayment Obligation Cleared</span>
          <strong className="grid-val">{formatAmount(evaluation.repaymentObligation)}</strong>
        </div>

        <div className="settlement-grid-item">
          <span className="grid-label">Current Agreement Status</span>
          <span className="grid-val-badge status-repaid">REPAID</span>
        </div>

        <div className="settlement-grid-item">
          <span className="grid-label">Borrower Identity</span>
          <span className="grid-val-code">{shortenAddress(evaluation.borrower)}</span>
        </div>

        <div className="settlement-grid-item">
          <span className="grid-label">Designated Lender Identity</span>
          <span className="grid-val-code">{shortenAddress(evaluation.lender)}</span>
        </div>
      </div>

      {/* Review & Finalize Drawer */}
      {isReviewing && (
        <div className="settlement-review-drawer">
          <h4>Review Settlement Conditions</h4>
          <p className="review-lead">
            Settlement permanently closes this micro-loan agreement. Once settled, the contract enters its terminal state and cannot be reopened.
          </p>

          <div className="settlement-summary-box">
            <div className="summary-row">
              <span>Settlement Signer:</span>
              <strong>{selectedRole}</strong>
            </div>
            <div className="summary-row">
              <span>Transition Target:</span>
              <strong className="target-settled">REPAID → SETTLED</strong>
            </div>
            <div className="summary-row">
              <span>Obligation Cleared:</span>
              <strong>{formatAmount(evaluation.repaymentObligation)}</strong>
            </div>
          </div>

          <div className="review-warning-box">
            <span className="warning-icon">ℹ️</span>
            <span>
              <strong>Prototype Mode Notice:</strong> This action executes the local protocol state machine transition. Native asset escrow transfers await Midnight.js token integration.
            </span>
          </div>

          {errorMessage && (
            <div className="settlement-error-alert" role="alert">
              <span>✕</span> {errorMessage}
            </div>
          )}

          <div className="review-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsReviewing(false)}
              disabled={isExecuting}
            >
              Back
            </button>
            <button
              type="button"
              className="btn btn-primary btn-confirm-settlement"
              onClick={handleConfirmSettlement}
              disabled={isExecuting || !readiness.canSettle}
            >
              {isExecuting ? 'Settling Agreement...' : 'Confirm & Finalize Settlement'}
            </button>
          </div>
        </div>
      )}

      {/* Initial Action Button */}
      {!isReviewing && (
        <div className="settlement-action-footer">
          <button
            type="button"
            className="btn btn-primary btn-review-settlement"
            disabled={!readiness.canSettle}
            onClick={() => setIsReviewing(true)}
          >
            Review &amp; Settle Agreement
          </button>
        </div>
      )}
    </div>
  );
};
