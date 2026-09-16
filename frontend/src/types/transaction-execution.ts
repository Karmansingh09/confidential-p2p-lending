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
  | 'AWAITING_SIGNATURE'
  | 'SIGNED'
  | 'SUBMITTING'
  | 'SUBMITTED'
  | 'CHECKING_CONFIRMATION'
  | 'BLOCKED'
  | 'PENDING'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'FAILED'
  | 'UNSUPPORTED'
  | 'UNKNOWN_PROVIDER_STATE';

/**
 * Granular execution stage for the 19-stage lifecycle pipeline.
 * Provides finer-grained observability than TransactionExecutionStatus.
 */
export type TransactionExecutionStage =
  | 'NOT_STARTED'
  | 'SESSION_VALIDATION'
  | 'NETWORK_CONFIG_VALIDATION'
  | 'NETWORK_COMPATIBILITY_CHECK'
  | 'CONNECTOR_DETECTION'
  | 'DEPLOYMENT_VALIDATION'
  | 'CIRCUIT_CLASSIFICATION'
  | 'LIFECYCLE_GUARD_EVALUATION'
  | 'CAPABILITY_VERIFICATION'
  | 'SIGNING_REQUEST'
  | 'AWAITING_USER_SIGNATURE'
  | 'SIGNATURE_VERIFIED'
  | 'SUBMISSION_REQUEST'
  | 'AWAITING_NETWORK_ACKNOWLEDGEMENT'
  | 'SUBMISSION_ACKNOWLEDGED'
  | 'CONFIRMATION_POLLING'
  | 'CONFIRMATION_VERIFIED'
  | 'REGISTRY_MUTATION_GATE'
  | 'COMPLETE';

/**
 * Classification of the active transaction execution mode.
 */
export type TransactionExecutionMode =
  | 'PROTOTYPE_LOCAL'       // Offline local prototype; no signing/submission
  | 'ADAPTER_UNSUPPORTED'   // Real adapter boundary reached; SDK not integrated
  | 'LIVE_WALLET'           // Real Midnight/Lace wallet; full lifecycle
  | 'UNKNOWN';              // Mode cannot be determined

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
 * State of an active bounded confirmation poll.
 * Used by TransactionConfirmationService to track polling progress without fabricating status.
 */
export interface ConfirmationPollState {
  /** Transaction ID being polled */
  transactionId: string;
  /** Number of polls executed so far */
  pollCount: number;
  /** Maximum allowed polls before timeout */
  maxPolls: number;
  /** Interval between polls in milliseconds */
  pollIntervalMs: number;
  /** Whether a timeout has been reached */
  timedOut: boolean;
  /** Current provider-reported status */
  lastStatus: ProviderSubmissionStatus | null;
  /** Timestamp of the last poll */
  lastPollAt: number | null;
}

/**
 * Sanitized domain error codes for transaction execution failures.
 */
export type TransactionExecutionErrorCode =
  | 'DISCONNECTED_WALLET'
  | 'WALLET_NOT_CONNECTED'
  | 'UNSUPPORTED_PROVIDER'
  | 'REJECTED_SIGNATURE'
  | 'REJECTED_CONNECTION'
  | 'USER_REJECTED'
  | 'UNSUPPORTED_CAPABILITY'
  | 'GUARD_VALIDATION_FAILED'
  | 'MALFORMED_REQUEST'
  | 'PROVIDER_ERROR'
  | 'NETWORK_ERROR'
  | 'NETWORK_MISMATCH'
  | 'UNKNOWN_WALLET_NETWORK'
  | 'CONTRACT_NOT_VERIFIED'
  | 'CONTRACT_NOT_DEPLOYED'
  | 'CIRCUIT_UNAVAILABLE'
  | 'SIGNING_FAILED'
  | 'SUBMISSION_FAILED'
  | 'TRANSACTION_NOT_FOUND'
  | 'CONFIRMATION_TIMEOUT'
  | 'PROVIDER_UNAVAILABLE'
  | 'UNKNOWN_PROVIDER_STATE'
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
  /** Active execution mode, if resolved */
  executionMode?: TransactionExecutionMode;
  /** Granular execution stage reached, if resolved */
  executionStage?: TransactionExecutionStage;
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
