import type { LoanDetailsModel, LoanStatus, LoanStatusText } from './index.js';

/**
 * UI interaction states during borrower repayment.
 */
export type RepaymentState =
  | 'READY'
  | 'REVIEWING'
  | 'EXECUTING'
  | 'REPAID'
  | 'FAILED';

/**
 * Deterministic repayment readiness states derived via canonical contract guards.
 */
export type RepaymentReadinessStatus =
  | 'READY_TO_REPAY'
  | 'LOAN_NOT_FUNDED'
  | 'ALREADY_REPAID'
  | 'AGREEMENT_CONCLUDED'
  | 'UNAUTHORIZED_BORROWER'
  | 'LOAN_NOT_AVAILABLE';

/**
 * Structured readiness evaluation result.
 */
export interface RepaymentReadiness {
  status: RepaymentReadinessStatus;
  canRepay: boolean;
  reason?: string;
}

/**
 * Exact BigInt calculation of repayment obligation.
 * Zero IEEE-754 floating-point numbers are used.
 */
export interface RepaymentCalculation {
  principal: bigint;
  interestRateBasisPoints: bigint;
  interestAmount: bigint;
  totalObligation: bigint;
}

/**
 * Request payload to initiate borrower repayment.
 */
export interface RepaymentRequest {
  loanId: string;
  loan: LoanDetailsModel;
  callerPk?: Uint8Array;
  repaymentAmount?: bigint;
}

/**
 * Privacy attestation reaffirming that repayment relies strictly on public terms.
 */
export interface RepaymentPrivacyAttestation {
  title: string;
  statement: string;
  notice: string;
}

/**
 * Structured execution result of the repayment transition.
 */
export interface RepaymentResult {
  success: boolean;
  loanId: string;
  previousStatus: 'FUNDED';
  updatedStatus: LoanStatus;
  updatedStatusText: LoanStatusText;
  calculation: RepaymentCalculation;
  repaidAmount: bigint;
  borrower: string;
  lender: string | null;
  assetTransferStatus: string;
  disclaimer: string;
  timestamp: number;
  privacyAttestation: RepaymentPrivacyAttestation;
  isPrototypeExecution: boolean;
}

/**
 * Categorized error reasons for repayment failures.
 */
export type RepaymentFailureReason =
  | 'NOT_FUNDED'
  | 'ALREADY_REPAID'
  | 'CONCLUDED'
  | 'UNAUTHORIZED'
  | 'EXECUTION_ERROR';
