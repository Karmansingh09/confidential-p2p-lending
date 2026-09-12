import React, { useState } from 'react';
import type { LoanDetailsModel } from 'contracts';
import {
  calculateRepaymentPreview,
  getRepaymentReadiness,
  executeRepaymentPrototype,
} from '../lib/repayment-service.js';
import type { RepaymentResult } from '../types/repayment.js';
import { formatAmount, formatBasisPoints, shortenAddress } from '../lib/formatters.js';
import { RepaymentConfirmation } from './RepaymentConfirmation.js';

interface RepaymentPanelProps {
  loan: LoanDetailsModel;
  loanId: string;
  callerPk?: Uint8Array;
  onLoanRepaid?: (loanId: string, updatedLoan: LoanDetailsModel) => void;
  onClose?: () => void;
}

export const RepaymentPanel: React.FC<RepaymentPanelProps> = ({
  loan,
  loanId,
  callerPk,
  onLoanRepaid,
  onClose,
}) => {
  const [isReviewing, setIsReviewing] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<RepaymentResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const effectiveCallerPk = callerPk ?? loan.borrowerBytes;
  const readiness = getRepaymentReadiness(loan, effectiveCallerPk);
  const calculation = calculateRepaymentPreview(loan);

  const handleConfirmRepayment = async () => {
    setIsExecuting(true);
    setErrorMessage(null);

    try {
      // Simulate asynchronous circuit execution
      await new Promise((resolve) => setTimeout(resolve, 350));

      const { updatedLoan, result } = await executeRepaymentPrototype({
        loanId,
        loan,
        callerPk: effectiveCallerPk,
      });

      setExecutionResult(result);
      if (onLoanRepaid) {
        onLoanRepaid(loanId, updatedLoan);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExecuting(false);
    }
  };

  if (executionResult) {
    return (
      <RepaymentConfirmation
        result={executionResult}
        onDismiss={onClose}
      />
    );
  }

  return (
    <div className="repayment-panel-card" aria-label="Borrower Repayment Panel">
      {/* Panel Header */}
      <div className="panel-header">
        <div className="panel-title-wrapper">
          <span className="panel-icon">💳</span>
          <div>
            <h3>Borrower Loan Repayment</h3>
            <span className="panel-subtitle">Agreement ID: <strong>{loanId}</strong></span>
          </div>
        </div>
        {onClose && (
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close panel">
            ✕
          </button>
        )}
      </div>

      {/* Readiness Status Pill */}
      <div className="repayment-readiness-banner">
        <span
          className={`readiness-pill pill-${
            readiness.canRepay ? 'ready' : 'disabled'
          }`}
        >
          {readiness.status === 'READY_TO_REPAY'
            ? 'Ready for Repayment'
            : readiness.status.replace(/_/g, ' ')}
        </span>
        {readiness.reason && (
          <span className="readiness-reason">{readiness.reason}</span>
        )}
      </div>

      {/* Privacy Notice */}
      <div className="repayment-privacy-notice">
        <span className="privacy-shield-icon">🛡️</span>
        <p>
          Repayment obligation is calculated strictly from on-chain agreement terms.
          No confidential borrower credentials or off-chain witness values are involved.
        </p>
      </div>

      {/* Terms & Obligation Grid */}
      <div className="repayment-grid">
        <div className="repayment-grid-item">
          <span className="grid-label">Principal Amount</span>
          <strong className="grid-val">{formatAmount(calculation.principal)}</strong>
        </div>

        <div className="repayment-grid-item">
          <span className="grid-label">Interest Rate</span>
          <strong className="grid-val">{formatBasisPoints(calculation.interestRateBasisPoints)}</strong>
        </div>

        <div className="repayment-grid-item">
          <span className="grid-label">Accrued Simple Interest</span>
          <strong className="grid-val">{formatAmount(calculation.interestAmount)}</strong>
        </div>

        <div className="repayment-grid-item highlight-obligation">
          <span className="grid-label">Total Obligation</span>
          <strong className="grid-val">{formatAmount(calculation.totalObligation)}</strong>
        </div>

        <div className="repayment-grid-item">
          <span className="grid-label">Borrower Identity</span>
          <span className="grid-val-code">{shortenAddress(loan.borrower)}</span>
        </div>

        <div className="repayment-grid-item">
          <span className="grid-label">Designated Lender</span>
          <span className="grid-val-code">{shortenAddress(loan.lender)}</span>
        </div>
      </div>

      {/* Review Drawer */}
      {isReviewing && (
        <div className="repayment-review-drawer">
          <h4>Repayment Obligation Breakdown</h4>
          <div className="calculation-formula-box">
            <div className="formula-row">
              <span>Principal Amount:</span>
              <strong>{formatAmount(calculation.principal)}</strong>
            </div>
            <div className="formula-operator">+</div>
            <div className="formula-row">
              <span>Simple Interest ({formatBasisPoints(calculation.interestRateBasisPoints)}):</span>
              <strong>{formatAmount(calculation.interestAmount)}</strong>
            </div>
            <div className="formula-divider"></div>
            <div className="formula-row formula-total">
              <span>Total Repayment Obligation:</span>
              <strong>{formatAmount(calculation.totalObligation)}</strong>
            </div>
          </div>

          <div className="review-warning-box">
            <span className="warning-icon">ℹ️</span>
            <span>
              Executing repayment will transition the agreement status to <strong>REPAID</strong>.
              In prototype mode, this updates local protocol state without transferring native network tokens.
            </span>
          </div>

          {errorMessage && (
            <div className="repayment-error-alert" role="alert">
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
              className="btn btn-primary btn-confirm-repayment"
              onClick={handleConfirmRepayment}
              disabled={isExecuting}
            >
              {isExecuting ? 'Executing Repayment...' : 'Confirm & Execute Repayment'}
            </button>
          </div>
        </div>
      )}

      {/* Initial Action Area */}
      {!isReviewing && (
        <div className="repayment-action-footer">
          <button
            type="button"
            className="btn btn-primary btn-review-repayment"
            disabled={!readiness.canRepay}
            onClick={() => setIsReviewing(true)}
          >
            Review Repayment
          </button>
        </div>
      )}
    </div>
  );
};
