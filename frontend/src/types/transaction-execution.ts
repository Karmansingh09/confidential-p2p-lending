import type { LoanDetailsModel } from './index.js';
import type { AccountContext, AccountIdentity } from './account.ts';
import type { LifecycleTransactionAction } from './transaction-orchestration.ts';
import type { WalletProviderKind } from './wallet-adapter.ts';
import type { NetworkEnvironment } from './network.ts';

/**
 * Execution lifecycle status for a contract transaction.
 */
export type TransactionExecutionStatus =
  | 'IDLE'
  | 'NOT_STARTED'
  | 'VALIDATING'
  | 'PREPARING'
  | 'SUBMITTING'
  | 'BLOCKED'
  | 'PENDING'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'FAILED'
  | 'UNSUPPORTED';

/**
 * Low-level submission status returned by or negotiated with the wallet provider.
 */
export type ProviderSubmissionStatus =
  | 'UNSUBMITTED'
  | 'SUBMITTED'
  | 'PENDING'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'FAILED'
  | 'UNSUPPORTED';

/**
 * Explicit confirmation state for protocol lifecycle and ledger mutations.
 */
export type ConfirmationState =
  | 'NOT_CONFIRMED'
  | 'PENDING'
  | 'CONFIRMED'
  | 'UNCONFIRMED_PRESERVED';

/**
 * Sanitized domain error codes for transaction execution failures.
 */
export type TransactionExecutionErrorCode =
  | 'DISCONNECTED_WALLET'
  | 'UNSUPPORTED_PROVIDER'
  | 'REJECTED_SIGNATURE'
  | 'REJECTED_CONNECTION'
  | 'UNSUPPORTED_CAPABILITY'
  | 'GUARD_VALIDATION_FAILED'
  | 'MALFORMED_REQUEST'
  | 'PROVIDER_ERROR'
  | 'NETWORK_ERROR'
  | 'CONFIRMATION_TIMEOUT'
  | 'UNKNOWN_STATUS'
  | 'CONTRACT_ERROR';

/**
 * Public transaction receipt containing only genuine provider-returned metadata.
 * ANTI-FABRICATION GUARANTEE:
 * Zero synthetic hashes, faux block numbers, or fake confirmations are ever generated.
 */
export interface TransactionReceipt {
  /** Provider-returned transaction identifier, if genuinely available */
  transactionId?: string;
  /** Block height on ledger, if confirmed on chain */
  blockHeight?: bigint;
  /** Submission or confirmation status */
  status: ProviderSubmissionStatus;
  /** Timestamp when transaction reached confirmed status */
  confirmedAt?: number;
  /** Optional raw provider response details (sanitized) */
  rawProviderResponse?: unknown;
}

/**
 * Contextual metadata about the active execution environment.
 * STRICT PRIVACY BOUNDARY:
 * Holds purely public account addresses, public keys, and network parameters.
 */
export interface TransactionExecutionContext {
  loanId: string;
  action: LifecycleTransactionAction;
  circuitName: string;
  callerPublicKey: Uint8Array | null;
  callerPublicKeyHex: string | null;
  providerKind: WalletProviderKind;
  networkEnvironment: NetworkEnvironment;
}

/**
 * Standardized request to execute a contract-guarded lifecycle transaction.
 */
export interface TransactionExecutionRequest {
  loanId: string;
  action: LifecycleTransactionAction;
  circuitName?: string;
  loan: LoanDetailsModel;
  account: AccountIdentity | AccountContext;
  options?: {
    localProofExecutor?: () => Promise<void>;
    timeoutMs?: number;
    skipRegistryUpdate?: boolean;
  };
}

/**
 * Comprehensive result of a transaction execution attempt.
 */
export interface TransactionExecutionResult {
  /** Whether the lifecycle action was executed and confirmed successfully */
  success: boolean;
  /** High-level execution status */
  status: TransactionExecutionStatus;
  /** The lifecycle action targeted */
  action: LifecycleTransactionAction;
  /** Mapped Compact circuit name */
  circuitName: string;
  /** Target loan agreement ID */
  loanId: string;
  /** Transaction receipt from provider, if submitted */
  receipt?: TransactionReceipt;
  /** Optional transaction identifier from provider receipt */
  transactionId?: string;
  /** Optional confirmed block height */
  blockHeight?: bigint;
  /** Human-readable explanation of outcome */
  message: string;
  /** Standardized domain error code if execution did not succeed */
  errorCode?: TransactionExecutionErrorCode;
  /** Detailed error message if failed or rejected */
  error?: string;
  /** Technical reason if operation is unsupported */
  unsupportedReason?: string;
  /** Whether the central LoanRegistry was mutated as a result of confirmed execution */
  registryUpdated: boolean;
  /** Explicit confirmation state */
  confirmationState: ConfirmationState;
}

/**
 * Structured domain error for transaction execution failures.
 */
export class TransactionExecutionError extends Error {
  readonly code: TransactionExecutionErrorCode;
  readonly action?: LifecycleTransactionAction;
  readonly circuitName?: string;
  readonly loanId?: string;
  readonly originalError?: unknown;

  constructor(
    code: TransactionExecutionErrorCode,
    message: string,
    context?: {
      action?: LifecycleTransactionAction;
      circuitName?: string;
      loanId?: string;
      originalError?: unknown;
    }
  ) {
    super(message);
    this.name = 'TransactionExecutionError';
    this.code = code;
    this.action = context?.action;
    this.circuitName = context?.circuitName;
    this.loanId = context?.loanId;
    this.originalError = context?.originalError;
  }
}
