import type { LoanRegistry } from '../lib/loan-registry.ts';
import type {
  TransactionRequestStatus,
  TrackedTransactionStatus,
} from './transaction-request.ts';
import type {
  TransactionRecoveryStatus,
  TransactionPersistenceErrorCode,
} from './transaction-persistence.ts';

/**
 * Standardized status of a transaction reconciliation check.
 */
export type ReconciliationStatus =
  | 'NOT_REQUIRED'
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'RECONCILED'
  | 'DISCREPANCY'
  | 'UNSUPPORTED'
  | 'FAILED';

/**
 * Deterministic explanation for the reconciliation outcome.
 */
export type ReconciliationReason =
  | 'LOCAL_RECORD_ONLY'
  | 'PROVIDER_CONFIRMED'
  | 'PROVIDER_PENDING'
  | 'PROVIDER_REJECTED'
  | 'PROVIDER_FAILED'
  | 'PROVIDER_UNSUPPORTED'
  | 'TRANSACTION_NOT_FOUND'
  | 'STATUS_UNAVAILABLE'
  | 'LOCAL_PROVIDER'
  | 'NETWORK_MISMATCH'
  | 'UNKNOWN_PROVIDER_STATE';

/**
 * Comprehensive result of a transaction reconciliation evaluation between
 * local persistence and the active wallet provider.
 *
 * CRITICAL INVARIANT:
 * registryMutationAllowed is TRUE IF AND ONLY IF genuine provider verification
 * returned CONFIRMED on-chain.
 */
export interface TransactionReconciliationResult {
  transactionId: string;
  agreementId?: string;
  localStatus: TransactionRequestStatus | string;
  providerStatus?: TrackedTransactionStatus | string;
  reconciliationStatus: ReconciliationStatus;
  reason: ReconciliationReason;
  registryMutationAllowed: boolean;
  reconciledAt: number;
  message: string;

  // Compatibility fields for Commit #30 consumers and tests
  success?: boolean;
  previousStatus?: TransactionRequestStatus;
  reconciledStatus?: TransactionRequestStatus;
  recoveryStatus?: TransactionRecoveryStatus;
  providerTransactionId?: string;
  blockHeight?: bigint;
  registryUpdated?: boolean;
  updatedRegistry?: LoanRegistry;
  error?: string;
  errorCode?: TransactionPersistenceErrorCode | string;
}
