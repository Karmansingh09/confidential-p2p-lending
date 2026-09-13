import type { LifecycleTransactionAction } from './transaction-orchestration.ts';

/**
 * Granular lifecycle stages for a transaction request as it transitions
 * from initialization through preparation, signing, submission, and confirmation.
 */
export type TransactionRequestStatus =
  | 'DRAFT'
  | 'PREPARING'
  | 'PREPARED'
  | 'SIGNATURE_REQUESTED'
  | 'SIGNED'
  | 'READY_TO_SUBMIT'
  | 'SUBMITTING'
  | 'SUBMITTED'
  | 'CONFIRMED'
  | 'BLOCKED'
  | 'UNSUPPORTED'
  | 'REJECTED'
  | 'FAILED';

/**
 * Explicit statuses for the wallet signing phase.
 */
export type TransactionSigningStatus =
  | 'IDLE'
  | 'REQUESTED'
  | 'SIGNED'
  | 'REJECTED'
  | 'FAILED'
  | 'UNSUPPORTED';

/**
 * Explicit statuses for the network submission phase.
 */
export type TransactionSubmissionStatus =
  | 'IDLE'
  | 'SUBMITTING'
  | 'SUBMITTED'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'FAILED'
  | 'UNSUPPORTED';

/**
 * Standardized status for transaction status tracking service.
 * ANTI-FABRICATION GUARANTEE:
 * Status tracking NEVER infers CONFIRMED from SUBMITTED.
 */
export type TrackedTransactionStatus =
  | 'UNKNOWN'
  | 'PENDING'
  | 'SUBMITTED'
  | 'CONFIRMED'
  | 'FAILED'
  | 'REJECTED'
  | 'UNSUPPORTED';

/**
 * Sanitized domain error codes across the request, signing, and submission boundary.
 */
export type TransactionRequestErrorCode =
  | 'NOT_CONNECTED'
  | 'NETWORK_MISMATCH'
  | 'UNKNOWN_NETWORK'
  | 'GUARD_VALIDATION_FAILED'
  | 'MISSING_CAPABILITY'
  | 'USER_REJECTED_SIGNATURE'
  | 'USER_REJECTED_SUBMISSION'
  | 'SIGNING_FAILED'
  | 'SUBMISSION_FAILED'
  | 'UNSUPPORTED_PROVIDER'
  | 'UNSUPPORTED_OPERATION'
  | 'TRACKING_FAILED'
  | 'MALFORMED_REQUEST'
  | 'CONTRACT_ERROR';

/**
 * Structured domain error for transaction request failures.
 */
export class TransactionRequestError extends Error {
  readonly code: TransactionRequestErrorCode;
  readonly action?: LifecycleTransactionAction;
  readonly circuitName?: string;
  readonly loanId?: string;
  readonly originalError?: unknown;

  constructor(
    code: TransactionRequestErrorCode,
    message: string,
    context?: {
      action?: LifecycleTransactionAction;
      circuitName?: string;
      loanId?: string;
      originalError?: unknown;
    }
  ) {
    super(message);
    this.name = 'TransactionRequestError';
    this.code = code;
    this.action = context?.action;
    this.circuitName = context?.circuitName;
    this.loanId = context?.loanId;
    this.originalError = context?.originalError;
  }
}

/**
 * Public parameters for preparing a contract lifecycle transaction.
 * PRIVACY INVARIANT:
 * Strictly contains public loan terms and public caller identifiers.
 * Zero confidential inputs, secret credentials, or hidden parameters.
 */
export interface TransactionRequestParameters {
  loanId: string;
  action: LifecycleTransactionAction;
  circuitName: string;
  callerPublicKey: Uint8Array | null;
  callerPublicKeyHex: string | null;
  amount: bigint;
  interestRateBps: bigint;
  durationBlocks: bigint;
}

/**
 * Explicit request payload for wallet signature generation.
 */
export interface TransactionSigningRequest {
  requestId: string;
  loanId: string;
  action: LifecycleTransactionAction;
  circuitName: string;
  callerPublicKey: Uint8Array;
  parameters: TransactionRequestParameters;
  createdAt: number;
}

/**
 * Result returned by the wallet provider upon signing request completion.
 */
export interface TransactionSigningResult {
  success: boolean;
  status: TransactionSigningStatus;
  signatureBytes?: Uint8Array;
  signatureHex?: string;
  error?: string;
  errorCode?: TransactionRequestErrorCode;
  signedAt?: number;
}

/**
 * Explicit request payload for network transaction submission.
 */
export interface TransactionSubmissionRequest {
  requestId: string;
  loanId: string;
  action: LifecycleTransactionAction;
  callerPublicKey: Uint8Array;
  signatureReference?: string;
  signedPayload?: unknown;
  createdAt: number;
}

/**
 * Result returned by the wallet provider upon transaction submission.
 */
export interface TransactionSubmissionResult {
  success: boolean;
  status: TransactionSubmissionStatus;
  transactionId?: string;
  blockHeight?: bigint;
  error?: string;
  errorCode?: TransactionRequestErrorCode;
  submittedAt?: number;
}

/**
 * Tracked status query result for an active or past transaction.
 */
export interface TransactionStatusResult {
  transactionId: string;
  status: TrackedTransactionStatus;
  blockHeight?: bigint;
  confirmations?: number;
  updatedAt: number;
  error?: string;
}

/**
 * End-to-end aggregate representing an active transaction lifecycle request.
 */
export interface TransactionRequest {
  id: string;
  loanId: string;
  action: LifecycleTransactionAction;
  circuitName: string;
  status: TransactionRequestStatus;
  parameters: TransactionRequestParameters;
  signingRequest?: TransactionSigningRequest;
  signingResult?: TransactionSigningResult;
  submissionRequest?: TransactionSubmissionRequest;
  submissionResult?: TransactionSubmissionResult;
  statusResult?: TransactionStatusResult;
  createdAt: number;
  updatedAt: number;
  error?: string;
  errorCode?: TransactionRequestErrorCode;
}

/**
 * Comprehensive outcome of the end-to-end transaction pipeline.
 */
export interface TransactionRequestResult {
  success: boolean;
  status: TransactionRequestStatus;
  action: LifecycleTransactionAction;
  circuitName: string;
  loanId: string;
  message: string;
  request: TransactionRequest;
  signingResult?: TransactionSigningResult;
  submissionResult?: TransactionSubmissionResult;
  statusResult?: TransactionStatusResult;
  registryUpdated: boolean;
  updatedRegistry?: any;
  error?: string;
  errorCode?: TransactionRequestErrorCode;
}
