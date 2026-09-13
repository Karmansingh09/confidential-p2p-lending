import type { LifecycleTransactionAction } from './transaction-orchestration.ts';
import type {
  TransactionRequestStatus,
  TransactionRequestErrorCode,
} from './transaction-request.ts';
import type { LoanRegistry } from '../lib/loan-registry.js';

/**
 * High-level recovery status for transactions evaluated during application startup
 * or manual user reconciliation.
 */
export type TransactionRecoveryStatus =
  | 'NOT_FOUND'
  | 'RECOVERABLE'
  | 'PENDING'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'FAILED'
  | 'STALE'
  | 'UNSUPPORTED';

/**
 * Domain error codes specific to the transaction persistence and recovery boundaries.
 */
export type TransactionPersistenceErrorCode =
  | 'STORAGE_UNAVAILABLE'
  | 'SERIALIZATION_FAILED'
  | 'DESERIALIZATION_FAILED'
  | 'TRANSACTION_NOT_FOUND'
  | 'CORRUPTED_DATA'
  | 'RECONCILIATION_FAILED'
  | 'PROVIDER_ERROR'
  | 'UNSUPPORTED_OPERATION'
  | 'NOT_CONNECTED'
  | 'NETWORK_MISMATCH';

/**
 * Structured domain error for transaction persistence failures.
 */
export class TransactionPersistenceError extends Error {
  readonly code: TransactionPersistenceErrorCode;
  readonly transactionId?: string;
  readonly originalError?: unknown;

  constructor(
    code: TransactionPersistenceErrorCode,
    message: string,
    context?: {
      transactionId?: string;
      originalError?: unknown;
    }
  ) {
    super(message);
    this.name = 'TransactionPersistenceError';
    this.code = code;
    this.transactionId = context?.transactionId;
    this.originalError = context?.originalError;
  }
}

/**
 * A persistent transaction record stored in local storage or memory.
 *
 * STRICT PRIVACY INVARIANT:
 * A persisted transaction contains ONLY public agreement metadata, public identity keys,
 * and genuine network references.
 */
export interface PersistedTransaction {
  id: string;
  action: LifecycleTransactionAction;
  loanId: string;
  circuitName: string;
  callerPublicKeyHex: string | null;
  callerPublicKey?: Uint8Array | null;
  networkId: string;
  providerKind: string;
  status: TransactionRequestStatus;
  recoveryStatus: TransactionRecoveryStatus;
  providerTransactionId?: string;
  blockHeight?: bigint;
  amount?: bigint;
  interestRateBps?: bigint;
  durationBlocks?: bigint;
  createdAt: number;
  updatedAt: number;
  reconciledAt?: number;
  error?: string;
  errorCode?: TransactionRequestErrorCode | string;
  metadata?: Record<string, unknown>;
}

/**
 * Internal schema for persisting multiple transaction records.
 */
export interface TransactionPersistenceState {
  version: string;
  lastSavedAt: number;
  transactions: Record<string, PersistedTransaction>;
}

export type {
  ReconciliationStatus,
  ReconciliationReason,
  TransactionReconciliationResult,
} from './transaction-reconciliation.ts';
