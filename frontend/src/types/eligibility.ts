import type { LoanDetailsModel, LoanStatus, LoanStatusText } from './index.ts';

/**
 * State machine phases for the client-side eligibility verification workflow.
 */
export type EligibilityVerificationState =
  | 'NOT_REQUIRED'
  | 'READY'
  | 'GENERATING_PROOF'
  | 'VERIFIED'
  | 'REJECTED'
  | 'FAILED';

/**
 * Categorized error reasons for eligibility verification failures.
 */
export type EligibilityFailureReason =
  | 'UNDER_THRESHOLD'
  | 'ALREADY_VERIFIED'
  | 'INVALID_STATE'
  | 'UNAUTHORIZED_BORROWER'
  | 'EXECUTION_ERROR';

/**
 * Ephemeral request payload supplied when initiating verification.
 * Note: `witnessAmount` is transient and MUST NOT be retained or returned in the result.
 */
export interface EligibilityVerificationRequest {
  loanId: string;
  loan: LoanDetailsModel;
  witnessAmount: bigint;
  callerPk?: Uint8Array;
}

/**
 * Privacy assurance disclosure affirming Zero-Knowledge boundary protections.
 */
export interface EligibilityPrivacyAttestation {
  title: string;
  statement: string;
  notice: string;
}

/**
 * Public execution result of the eligibility verification.
 * STRICT SECURITY GUARANTEE: Contains ZERO witness amounts or confidential inputs.
 */
export interface EligibilityVerificationResult {
  loanId: string;
  status: EligibilityVerificationState;
  isVerified: boolean;
  updatedStatus: LoanStatus;
  updatedStatusText: LoanStatusText;
  timestamp: number;
  errorMessage?: string;
  failureReason?: EligibilityFailureReason;
  privacyAttestation: EligibilityPrivacyAttestation;
  isPrototypeExecution: boolean;
}

/**
 * Stage indicator during local ZK proof generation.
 */
export interface ProofGenerationStep {
  id: number;
  label: string;
  description: string;
}
