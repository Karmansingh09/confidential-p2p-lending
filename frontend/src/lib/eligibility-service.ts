import {
  canVerifyEligibility,
  verifyLoanEligibilityWithWitness,
  LoanStatus,
  type LoanDetailsModel,
} from 'contracts';
import type {
  EligibilityVerificationState,
  EligibilityFailureReason,
  EligibilityVerificationRequest,
  EligibilityVerificationResult,
  EligibilityPrivacyAttestation,
  ProofGenerationStep,
} from '../types/eligibility.js';

export const PROOF_GENERATION_STEPS: ProofGenerationStep[] = [
  { id: 1, label: 'Preparing private witness', description: 'Binding confidential input to local prover' },
  { id: 2, label: 'Generating zero-knowledge proof', description: 'Constructing arithmetic constraint system' },
  { id: 3, label: 'Executing eligibility circuit', description: 'Evaluating threshold satisfaction in ZK' },
  { id: 4, label: 'Verifying result', description: 'Confirming proof validity locally' },
  { id: 5, label: 'Eligibility attested', description: 'Public attestation updated to verified' },
];

/**
 * Evaluates the current eligibility verification state for a given loan.
 */
export function getEligibilityVerificationState(
  loan?: LoanDetailsModel | null,
  callerPk?: Uint8Array
): EligibilityVerificationState {
  if (!loan) {
    return 'NOT_REQUIRED';
  }

  // Only requested loans are in the eligibility verification lifecycle stage
  if (loan.status !== LoanStatus.requested) {
    return 'NOT_REQUIRED';
  }

  // If requested and already verified
  if (loan.isEligibilityVerified) {
    return 'VERIFIED';
  }

  // Check canonical lifecycle guard
  const guard = canVerifyEligibility(loan, callerPk);
  if (!guard.canExecute) {
    return 'NOT_REQUIRED';
  }

  return 'READY';
}

/**
 * Creates a zero-knowledge attestation disclosure affirming privacy preservation.
 */
export function createEligibilityAttestation(
  loanId: string,
  isVerified: boolean
): EligibilityPrivacyAttestation {
  if (isVerified) {
    return {
      title: 'Zero-Knowledge Eligibility Attestation',
      statement: `Agreement ${loanId} meets the required eligibility threshold verified via off-chain Zero-Knowledge proof.`,
      notice: 'Borrower qualification was proven cryptographically. Confidential underwriting metrics remain exclusively on the borrower device.',
    };
  }

  return {
    title: 'Eligibility Verification Attestation Pending',
    statement: `Agreement ${loanId} requires zero-knowledge eligibility verification before capital commitment.`,
    notice: 'Underlying assets remain private and will not be disclosed to prospective lenders or the public ledger.',
  };
}

/**
 * Maps raw contract/prover errors into sanitized user-safe failure reasons and messages.
 * NEVER leaks confidential values, internal traces, or stack dumps.
 */
export function sanitizeEligibilityError(err: unknown): {
  reason: EligibilityFailureReason;
  message: string;
} {
  const rawMessage = err instanceof Error ? err.message : String(err);

  if (rawMessage.includes('Borrower does not meet the required eligibility threshold')) {
    return {
      reason: 'UNDER_THRESHOLD',
      message: 'Eligibility requirement not satisfied.',
    };
  }

  if (rawMessage.includes('Eligibility is already verified')) {
    return {
      reason: 'ALREADY_VERIFIED',
      message: 'Eligibility has already been verified for this agreement.',
    };
  }

  if (rawMessage.includes('Loan is not in requested state')) {
    return {
      reason: 'INVALID_STATE',
      message: 'Eligibility verification is unavailable in the current loan state.',
    };
  }

  if (rawMessage.includes('Caller is not the borrower')) {
    return {
      reason: 'UNAUTHORIZED_BORROWER',
      message: 'Caller is not authorized to verify this loan request.',
    };
  }

  return {
    reason: 'EXECUTION_ERROR',
    message: 'Proof generation encountered an error. Please check your inputs and try again.',
  };
}

/**
 * Executes borrower eligibility verification using the Compact ZK circuit.
 *
 * STRICT PRIVACY CONTROLS:
 * 1. The confidential witness amount is used strictly within the prover function.
 * 2. It is NEVER logged to console or remote monitoring.
 * 3. It is NEVER returned in the execution result.
 * 4. It is NEVER written to browser storage or persistent caches.
 */
export async function verifyBorrowerEligibility(
  request: EligibilityVerificationRequest
): Promise<EligibilityVerificationResult> {
  const { loanId, loan, witnessAmount, callerPk } = request;

  // 1. Guard check via canonical lifecycle helper
  const guard = canVerifyEligibility(loan, callerPk);
  if (!guard.canExecute) {
    const sanitized = sanitizeEligibilityError(new Error(guard.reason ?? 'Cannot verify eligibility'));
    return {
      loanId,
      status: sanitized.reason === 'ALREADY_VERIFIED' ? 'VERIFIED' : 'FAILED',
      isVerified: loan.isEligibilityVerified,
      updatedStatus: loan.status,
      updatedStatusText: loan.statusText,
      timestamp: Date.now(),
      errorMessage: sanitized.message,
      failureReason: sanitized.reason,
      privacyAttestation: createEligibilityAttestation(loanId, loan.isEligibilityVerified),
      isPrototypeExecution: true,
    };
  }

  try {
    // 2. Execute the zero-knowledge circuit locally using existing client prover
    const proofResult = verifyLoanEligibilityWithWitness({
      loan,
      witnessAmount,
      callerPk,
    });

    const isVerified = proofResult.isVerified;

    return {
      loanId,
      status: isVerified ? 'VERIFIED' : 'REJECTED',
      isVerified,
      updatedStatus: LoanStatus.requested,
      updatedStatusText: 'requested',
      timestamp: Date.now(),
      privacyAttestation: createEligibilityAttestation(loanId, isVerified),
      isPrototypeExecution: true,
    };
  } catch (error) {
    const sanitized = sanitizeEligibilityError(error);

    return {
      loanId,
      status: sanitized.reason === 'UNDER_THRESHOLD' ? 'REJECTED' : 'FAILED',
      isVerified: false,
      updatedStatus: loan.status,
      updatedStatusText: loan.statusText,
      timestamp: Date.now(),
      errorMessage: sanitized.message,
      failureReason: sanitized.reason,
      privacyAttestation: createEligibilityAttestation(loanId, false),
      isPrototypeExecution: true,
    };
  }
}
