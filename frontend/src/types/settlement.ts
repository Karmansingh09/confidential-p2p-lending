import type { LoanStatus, LoanDetailsModel } from 'contracts';

/**
 * Lifecycle readiness statuses for loan settlement.
 */
export type SettlementReadinessStatus =
  | 'READY_TO_SETTLE'
  | 'LOAN_NOT_REPAID'
  | 'ALREADY_SETTLED'
  | 'UNAUTHORIZED_PARTICIPANT'
  | 'LOAN_NOT_AVAILABLE';

/**
 * Result of contract-guarded settlement readiness evaluation.
 */
export interface SettlementReadiness {
  canSettle: boolean;
  status: SettlementReadinessStatus;
  reason?: string;
  callerRole?: 'BORROWER' | 'LENDER' | 'UNAUTHORIZED';
}

/**
 * Public evaluation model summarizing settlement conditions for an agreement.
 * STRICT PRIVACY INVARIANT: Exposes ONLY public ledger properties.
 */
export interface SettlementEvaluation {
  loanId: string;
  principal: bigint;
  interestRateBasisPoints: bigint;
  durationBlocks: bigint;
  repaymentObligation: bigint;
  borrower: string;
  borrowerBytes: Uint8Array;
  lender: string | null;
  lenderBytes: Uint8Array | null;
  currentStatus: LoanStatus;
  currentStatusText: string;
  repaymentStatus: 'COMPLETE' | 'PENDING';
  settlementReadiness: SettlementReadiness;
}

/**
 * Settlement request parameters submitted to the settlement service.
 */
export interface SettlementRequest {
  loanId: string;
  loan: LoanDetailsModel;
  callerPk?: Uint8Array;
  callerRole?: 'BORROWER' | 'LENDER';
}

/**
 * Privacy attestation confirming settlement occurred without exposing confidential data.
 */
export interface SettlementPrivacyAttestation {
  title: string;
  statement: string;
  notice: string;
}

/**
 * Outcome result of a successful prototype settlement transition.
 */
export interface SettlementResult {
  success: boolean;
  loanId: string;
  previousStatus: 'REPAID';
  updatedStatus: LoanStatus;
  updatedStatusText: 'settled';
  settledBy: 'BORROWER' | 'LENDER';
  callerAddress: string;
  borrower: string;
  lender: string;
  totalObligationCleared: bigint;
  assetTransferStatus: string;
  networkStatus: string;
  disclaimer: string;
  timestamp: number;
  privacyAttestation: SettlementPrivacyAttestation;
  isPrototypeExecution: boolean;
}
