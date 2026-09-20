import React, { useState } from 'react';
import type { LoanDetailsModel } from '../types/index.ts';
import { LoanStatus } from '../types/index.ts';
import type { AccountContext, AccountRole } from '../types/account.ts';
import type { LoanRegistry } from '../lib/loan-registry.ts';
import { LoanStatusBadge } from '../components/LoanStatusBadge.tsx';
import { LifecycleStepper } from '../components/LifecycleStepper.tsx';
import { LoanSummaryCard } from '../components/LoanSummaryCard.tsx';
import { AccountStatusPanel } from '../components/AccountStatusPanel.tsx';
import { LenderEvaluationPanel } from '../components/LenderEvaluationPanel.tsx';
import { EligibilityVerificationPanel } from '../components/EligibilityVerificationPanel.tsx';
import { RepaymentPanel } from '../components/RepaymentPanel.tsx';
import { SettlementPanel } from '../components/SettlementPanel.tsx';
import { TransactionReviewPanel } from '../components/TransactionReviewPanel.tsx';
import { LoanActionPanel } from '../components/LoanActionPanel.tsx';
import type {
  LifecycleTransactionAction,
  TransactionOrchestrationResult,
} from '../types/transaction-orchestration.ts';
import type { TransactionExecutionResult } from '../types/index.ts';
import { getTransactionExecutionService } from '../lib/transaction-execution-service.ts';
import type { NavigationTab } from '../types/navigation.ts';
import { calculateRepaymentObligation } from 'contracts';
import {
  formatAmount,
  formatBasisPoints,
  formatDuration,
} from '../lib/formatters.ts';

export interface LoanDetailsPageProps {
  loanRegistry: LoanRegistry;
  selectedLoanId: string;
  accountContext: AccountContext;
  onSelectLoan: (loanId: string) => void;
  onLoanFunded?: (loanId: string, updatedLoan: LoanDetailsModel) => void;
  onLoanVerified?: (loanId: string, updatedLoan: LoanDetailsModel) => void;
  onLoanRepaid?: (loanId: string, updatedLoan: LoanDetailsModel) => void;
  onLoanSettled?: (loanId: string, updatedLoan: LoanDetailsModel) => void;
  onSwitchRole?: (role: AccountRole) => void;
  onConnectAccount?: (role?: AccountRole) => void;
  onNavigate: (tab: NavigationTab) => void;
}

export const LoanDetailsPage: React.FC<LoanDetailsPageProps> = ({
  loanRegistry,
  selectedLoanId,
  accountContext,
  onSelectLoan,
  onLoanFunded,
  onLoanVerified,
  onLoanRepaid,
  onLoanSettled,
  onSwitchRole,
  onConnectAccount,
  onNavigate,
}) => {
  const loansMap = loanRegistry.getLoans();
  const orderedIds = loanRegistry.getOrderedLoanIds();
  const currentLoan = loansMap[selectedLoanId] ?? loansMap[orderedIds[0] ?? 'loan-001'];
  const effectiveLoanId = loansMap[selectedLoanId] ? selectedLoanId : orderedIds[0] ?? 'loan-001';

  const [isVerifyingEligibility, setIsVerifyingEligibility] = useState(false);
  const [isRepayingLoan, setIsRepayingLoan] = useState(false);
  const [isSettlingLoan, setIsSettlingLoan] = useState(false);
  const [reviewAction, setReviewAction] = useState<LifecycleTransactionAction | null>(null);
  const [reviewResult, setReviewResult] = useState<TransactionOrchestrationResult | TransactionExecutionResult | null>(null);
  const [isExecutingReview, setIsExecutingReview] = useState(false);

  if (!currentLoan) {
    return (
      <div className="overview-page loan-details-page">
        <div style={{ padding: '60px 0', textAlign: 'center' }}>
          <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', marginBottom: '8px' }}>Agreement Not Located</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px' }}>The requested loan agreement could not be located in the active registry.</p>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => onNavigate('marketplace')}>
            &larr; Back to Marketplace
          </button>
        </div>
      </div>
    );
  }

  const totalRepaymentObligation = calculateRepaymentObligation(
    currentLoan.amount,
    currentLoan.interestRateBasisPoints
  );
  const interestAmount = totalRepaymentObligation - currentLoan.amount;

  const handleFundingSuccess = (fundedLoanId: string, updatedLoan: LoanDetailsModel) => {
    if (onLoanFunded) onLoanFunded(fundedLoanId, updatedLoan);
  };

  const handleVerificationSuccess = (verifiedLoanId: string, updatedLoan: LoanDetailsModel) => {
    setIsVerifyingEligibility(false);
    if (onLoanVerified) onLoanVerified(verifiedLoanId, updatedLoan);
  };

  const handleRepaymentSuccess = (repaidLoanId: string, updatedLoan: LoanDetailsModel) => {
    setIsRepayingLoan(false);
    if (onLoanRepaid) onLoanRepaid(repaidLoanId, updatedLoan);
  };

  const handleSettlementSuccess = (settledLoanId: string, updatedLoan: LoanDetailsModel) => {
    setIsSettlingLoan(false);
    if (onLoanSettled) onLoanSettled(settledLoanId, updatedLoan);
  };

  const handleExecuteReviewedAction = async () => {
    if (!reviewAction || !currentLoan) return;
    if (reviewAction === 'VERIFY_ELIGIBILITY') {
      setIsVerifyingEligibility(true);
      setReviewAction(null);
      setReviewResult(null);
      return;
    }

    setIsExecutingReview(true);
    setReviewResult(null);
    try {
      const execService = getTransactionExecutionService();
      const { result } = await execService.executeTransaction({
        loanId: effectiveLoanId,
        action: reviewAction,
        loan: currentLoan,
        account: accountContext,
      });
      setReviewResult(result);
    } catch (err: unknown) {
      setReviewResult({
        success: false,
        status: 'FAILED',
        action: reviewAction,
        circuitName: 'unknown',
        loanId: effectiveLoanId,
        message: err instanceof Error ? err.message : 'Transaction execution failed.',
        registryUpdated: false,
        confirmationState: 'NOT_CONFIRMED',
      });
    } finally {
      setIsExecutingReview(false);
    }
  };

  return (
    <div className="overview-page loan-details-page">
      {/* 1. Header & Navigation */}
      <section className="overview-intro">
        <div className="overview-intro-left">
          <div className="overview-kicker font-mono">
            <span>AGREEMENT AUDIT</span>
            <span className="kicker-sep">//</span>
            <span>{effectiveLoanId}</span>
          </div>
          <h1 className="overview-headline">Agreement {effectiveLoanId}</h1>
          <p className="overview-lead">
            Cryptographic audit, public ledger parameters, and contract-guarded lifecycle controls.
          </p>
        </div>

        <div className="overview-intro-right">
          <div className="overview-protocol-meta font-mono">
            <div className="meta-item">
              <span className="meta-label">STATUS</span>
              <div className="meta-val"><LoanStatusBadge statusText={currentLoan.statusText} /></div>
            </div>
            <div className="meta-item">
              <span className="meta-label">ATTESTATION</span>
              <span className={`meta-val ${currentLoan.isEligibilityVerified ? 'text-success' : 'text-warning'}`}>
                {currentLoan.isEligibilityVerified ? 'ZK PROVEN' : 'PROOF PENDING'}
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-label">ACTIVE AGREEMENT</span>
              <select
                id="loan-select"
                className="form-select font-mono"
                style={{ padding: '4px 8px', fontSize: '11px', background: 'rgba(159, 184, 216, 0.05)', color: 'var(--text-primary)', border: '1px solid rgba(159, 184, 216, 0.15)' }}
                value={effectiveLoanId}
                onChange={(e) => onSelectLoan(e.target.value)}
              >
                {orderedIds.map((id) => (
                  <option key={id} value={id}>
                    {id} ({loansMap[id]?.amount.toLocaleString()} units)
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="intro-actions-row">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => onNavigate('marketplace')}
            >
              &larr; Marketplace
            </button>
          </div>
        </div>
      </section>

      {/* 2. Dominant Principal & Financial Terms Strip */}
      <div style={{
        padding: '28px 0 24px 0',
        marginBottom: '28px',
        borderTop: '1px solid rgba(159, 184, 216, 0.08)',
        borderBottom: '1px solid rgba(159, 184, 216, 0.08)',
      }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.06em' }} className="font-mono">
          PRINCIPAL BORROWING CAPITAL
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '52px',
            fontWeight: 700,
            lineHeight: 1,
            color: 'var(--text-primary)',
            letterSpacing: '-0.03em',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {formatAmount(currentLoan.amount)}
          </span>
        </div>

        {/* Inline Financial Breakdown */}
        <div style={{
          display: 'flex',
          gap: '32px',
          flexWrap: 'wrap',
          marginTop: '16px',
          fontSize: '12.5px',
        }} className="font-mono">
          <div>
            <span style={{ color: 'var(--text-muted)' }}>YIELD RATE: </span>
            <strong style={{ color: 'var(--accent-primary)' }}>
              {formatBasisPoints(currentLoan.interestRateBasisPoints)}
            </strong>
            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}> ({currentLoan.interestRateBasisPoints.toString()} bps)</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>TOTAL REPAYMENT: </span>
            <strong style={{ color: 'var(--text-primary)' }}>
              {formatAmount(totalRepaymentObligation)}
            </strong>
            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}> (+{formatAmount(interestAmount)} interest)</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>DURATION: </span>
            <strong style={{ color: 'var(--text-primary)' }}>
              {formatDuration(currentLoan.durationBlocks)}
            </strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>THRESHOLD: </span>
            <strong style={{ color: 'var(--text-primary)' }}>
              {formatAmount(currentLoan.eligibilityThreshold)}
            </strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>ZK STATUS: </span>
            <strong className={currentLoan.isEligibilityVerified ? 'text-success' : 'text-warning'}>
              {currentLoan.isEligibilityVerified ? 'VERIFIED' : 'PENDING'}
            </strong>
          </div>
        </div>
      </div>

      {/* 3. Full Lifecycle Stepper */}
      <div style={{ marginBottom: '36px' }}>
        <LifecycleStepper loan={currentLoan} />
      </div>

      {/* 4. Two-Column Operational Layout */}
      <div className="details-grid-layout">
        <div className="details-left-column">
          {/* Section 1: Agreement Terms */}
          <LoanSummaryCard loan={currentLoan} loanId={effectiveLoanId} />

          {/* Section 3: Authorization */}
          <AccountStatusPanel
            loan={currentLoan}
            loanId={effectiveLoanId}
            accountContext={accountContext}
            onSwitchRole={onSwitchRole}
          />

          {/* Section 5: Direct Action Transitions */}
          {currentLoan.status === LoanStatus.requested && !currentLoan.isEligibilityVerified && !isVerifyingEligibility && (
            <div style={{
              padding: '20px',
              background: 'rgba(159, 184, 216, 0.02)',
              border: '1px solid rgba(159, 184, 216, 0.08)',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
            }}>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Generate ZK Eligibility Proof
                </h4>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0 }}>
                  Execute client-side prover circuit to qualify agreement for lender capital commitment.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setIsVerifyingEligibility(true)}
              >
                Generate Proof
              </button>
            </div>
          )}

          {isVerifyingEligibility && currentLoan.status === LoanStatus.requested && (
            <EligibilityVerificationPanel
              loan={currentLoan}
              loanId={effectiveLoanId}
              onLoanVerified={handleVerificationSuccess}
              onClose={() => setIsVerifyingEligibility(false)}
            />
          )}

          {currentLoan.status === LoanStatus.funded && !isRepayingLoan && (
            <div style={{
              padding: '20px',
              background: 'rgba(159, 184, 216, 0.02)',
              border: '1px solid rgba(159, 184, 216, 0.08)',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
            }}>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Repay Loan Obligation
                </h4>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0 }}>
                  Repay principal and calculated simple interest to clear borrowing obligation.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setIsRepayingLoan(true)}
              >
                Repay Loan
              </button>
            </div>
          )}

          {isRepayingLoan && currentLoan.status === LoanStatus.funded && (
            <RepaymentPanel
              loan={currentLoan}
              loanId={effectiveLoanId}
              onLoanRepaid={handleRepaymentSuccess}
              onClose={() => setIsRepayingLoan(false)}
            />
          )}

          {currentLoan.status === LoanStatus.repaid && !isSettlingLoan && (
            <div style={{
              padding: '20px',
              background: 'rgba(159, 184, 216, 0.02)',
              border: '1px solid rgba(159, 184, 216, 0.08)',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
            }}>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Settle Agreement
                </h4>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0 }}>
                  Conclude the agreement lifecycle and close the position on-chain.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setIsSettlingLoan(true)}
              >
                Settle Agreement
              </button>
            </div>
          )}

          {isSettlingLoan && currentLoan.status === LoanStatus.repaid && (
            <SettlementPanel
              loan={currentLoan}
              loanId={effectiveLoanId}
              onLoanSettled={handleSettlementSuccess}
              onClose={() => setIsSettlingLoan(false)}
            />
          )}

          {reviewAction && (
            <TransactionReviewPanel
              loan={currentLoan}
              loanId={effectiveLoanId}
              action={reviewAction}
              accountContext={accountContext}
              onClose={() => {
                setReviewAction(null);
                setReviewResult(null);
              }}
              onExecute={handleExecuteReviewedAction}
              isExecuting={isExecutingReview}
              executionResult={reviewResult}
            />
          )}

          <LoanActionPanel
            loan={currentLoan}
            activeLoanId={effectiveLoanId}
            onSelectLoan={onSelectLoan}
            loansMap={loansMap}
            onStartVerification={() => setIsVerifyingEligibility(true)}
            onStartRepayment={() => setIsRepayingLoan(true)}
            onStartSettlement={() => setIsSettlingLoan(true)}
            accountContext={accountContext}
            onConnectAccount={onConnectAccount}
            onReviewAction={(act) => {
              setReviewResult(null);
              setReviewAction(act);
            }}
          />
        </div>

        <div className="details-right-column">
          <LenderEvaluationPanel
            loan={currentLoan}
            loanId={effectiveLoanId}
            onFundLoan={handleFundingSuccess}
          />
        </div>
      </div>
    </div>
  );
};

