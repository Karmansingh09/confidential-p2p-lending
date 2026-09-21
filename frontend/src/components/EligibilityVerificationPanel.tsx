import React, { useState } from 'react';
import type { LoanDetailsModel } from 'contracts';
import {
  getEligibilityVerificationState,
  verifyBorrowerEligibility,
  PROOF_GENERATION_STEPS,
} from '../lib/eligibility-service.ts';
import type {
  EligibilityVerificationState,
  EligibilityVerificationResult as ResultModel,
} from '../types/eligibility.ts';
import { PrivateEligibilityInput } from './PrivateEligibilityInput.tsx';
import { EligibilityVerificationResult } from './EligibilityVerificationResult.tsx';
import { formatAmount, formatBasisPoints, formatDuration } from '../lib/formatters.ts';

interface EligibilityVerificationPanelProps {
  loan: LoanDetailsModel;
  loanId: string;
  onLoanVerified?: (loanId: string, updatedLoan: LoanDetailsModel) => void;
  onClose?: () => void;
}

export const EligibilityVerificationPanel: React.FC<EligibilityVerificationPanelProps> = ({
  loan,
  loanId,
  onLoanVerified,
  onClose,
}) => {
  const [workflowState, setWorkflowState] = useState<EligibilityVerificationState>(() =>
    getEligibilityVerificationState(loan)
  );
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [executionResult, setExecutionResult] = useState<ResultModel | null>(null);

  const handleStartProof = async (witnessAmount: bigint) => {
    setWorkflowState('GENERATING_PROOF');
    setActiveStepIndex(0);

    // Realistic visual progression for the 5-phase prover pipeline
    try {
      // Step 1: Preparing private witness
      setActiveStepIndex(0);
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Step 2: Generating zero-knowledge proof
      setActiveStepIndex(1);
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Step 3: Executing eligibility circuit (calls Compact ZK runtime)
      setActiveStepIndex(2);
      const result = await verifyBorrowerEligibility({
        loanId,
        loan,
        witnessAmount,
      });

      // Step 4: Verifying result
      setActiveStepIndex(3);
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Step 5: Eligibility attested or rejected
      setActiveStepIndex(4);
      setExecutionResult(result);
      setWorkflowState(result.status);

      if (result.status === 'VERIFIED' && result.isVerified) {
        const updatedLoan: LoanDetailsModel = {
          ...loan,
          isEligibilityVerified: true,
        };
        if (onLoanVerified) {
          onLoanVerified(loanId, updatedLoan);
        }
      }
    } catch {
      setWorkflowState('FAILED');
      setExecutionResult({
        loanId,
        status: 'FAILED',
        isVerified: false,
        updatedStatus: loan.status,
        updatedStatusText: loan.statusText,
        timestamp: Date.now(),
        errorMessage: 'Proof generation encountered an error. Please check your inputs and try again.',
        privacyAttestation: {
          title: 'Verification Failed',
          statement: 'Local circuit execution failed.',
          notice: 'No private data was disclosed.',
        },
        isPrototypeExecution: true,
      });
    }
  };

  const handleRetry = () => {
    setExecutionResult(null);
    setWorkflowState('READY');
    setActiveStepIndex(0);
  };

  return (
    <div className="eligibility-verification-panel">
      {/* Panel Header */}
      <div className="panel-header">
        <div className="panel-title-wrapper">
          <span className="panel-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </span>
          <div>
            <h3>Confidential Eligibility Verification</h3>
            <span className="panel-subtitle">Agreement ID: <strong>{loanId}</strong></span>
          </div>
        </div>
        {onClose && (
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close panel">
            ✕
          </button>
        )}
      </div>

      {/* Privacy Model Notice */}
      <div className="eligibility-privacy-explanation">
        <p>
          The lender will receive proof that you meet the eligibility requirement,
          but your underlying financial value remains private.
        </p>
      </div>

      {/* Public Agreement Terms Summary */}
      <div className="agreement-summary-grid">
        <div className="summary-item">
          <span className="item-label">Principal Amount</span>
          <span className="item-value">{formatAmount(loan.amount)}</span>
        </div>
        <div className="summary-item">
          <span className="item-label">Agreed Interest</span>
          <span className="item-value">{formatBasisPoints(loan.interestRateBasisPoints)}</span>
        </div>
        <div className="summary-item">
          <span className="item-label">Maturity Term</span>
          <span className="item-value">{formatDuration(loan.durationBlocks)}</span>
        </div>
        <div className="summary-item highlight-threshold">
          <span className="item-label">Public Threshold Required</span>
          <span className="item-value">{formatAmount(loan.eligibilityThreshold)}</span>
        </div>
        <div className="summary-item">
          <span className="item-label">Current Status</span>
          <span className="item-value">
            {loan.isEligibilityVerified ? (
              <span className="badge badge-success">Verified</span>
            ) : (
              <span className="badge badge-warning">Awaiting Verification</span>
            )}
          </span>
        </div>
      </div>

      {/* Workflow Phase Views */}
      {workflowState === 'GENERATING_PROOF' && (
        <div className="proof-progress-container">
          <div className="progress-header">
            <h4>Generating Zero-Knowledge Proof</h4>
            <span className="prototype-badge">Local prototype proof execution — no live network transaction.</span>
          </div>

          <div className="progress-stepper">
            {PROOF_GENERATION_STEPS.map((step, idx) => {
              const isDone = idx < activeStepIndex;
              const isCurrent = idx === activeStepIndex;

              return (
                <div
                  key={step.id}
                  className={`stepper-step ${isDone ? 'step-done' : ''} ${isCurrent ? 'step-active' : ''}`}
                >
                  <div className="step-indicator">
                    {isDone ? '✓' : step.id}
                  </div>
                  <div className="step-details">
                    <span className="step-name">{step.label}</span>
                    <span className="step-desc">{step.description}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {workflowState === 'READY' && (
        <div className="input-section">
          <PrivateEligibilityInput
            threshold={loan.eligibilityThreshold}
            onSubmit={handleStartProof}
            onCancel={onClose}
          />
        </div>
      )}

      {(workflowState === 'VERIFIED' || workflowState === 'REJECTED' || workflowState === 'FAILED') && executionResult && (
        <EligibilityVerificationResult
          result={executionResult}
          onContinue={onClose}
          onRetry={handleRetry}
        />
      )}

      {workflowState === 'VERIFIED' && !executionResult && (
        <div className="already-verified-state">
          <div className="verified-icon">✓</div>
          <h4>Eligibility Already Verified</h4>
          <p>This agreement has already satisfied off-chain zero-knowledge verification.</p>
          <div className="state-actions">
            {onClose && (
              <button type="button" className="btn btn-primary" onClick={onClose}>
                Return to Dashboard
              </button>
            )}
          </div>
        </div>
      )}

      {workflowState === 'NOT_REQUIRED' && (
        <div className="not-required-state">
          <p>Eligibility verification is unavailable in the current loan state.</p>
          {onClose && (
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          )}
        </div>
      )}
    </div>
  );
};
