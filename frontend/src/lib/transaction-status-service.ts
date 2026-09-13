import type {
  TrackedTransactionStatus,
  TransactionStatusResult,
} from '../types/transaction-request.ts';
import type { LifecycleTransactionAction } from '../types/transaction-orchestration.ts';

/**
 * Granular statuses for transaction reconciliation between local client operations
 * and network provider responses.
 */
export type DetailedReconciliationStatus =
  | 'LOCAL_REQUEST_CREATED'
  | 'SIGNATURE_REQUESTED'
  | 'SIGNED'
  | 'SUBMITTED'
  | 'NETWORK_PENDING'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'FAILED'
  | 'UNKNOWN'
  | 'UNSUPPORTED';

/**
 * Safely maps raw provider status strings to canonical TrackedTransactionStatus.
 * Unknown or unsupported statuses are never guessed — they map safely to UNKNOWN.
 */
export function normalizeProviderStatus(status: string | undefined | null): TrackedTransactionStatus {
  if (!status) return 'UNKNOWN';
  const normalized = status.toUpperCase().trim();
  switch (normalized) {
    case 'CONFIRMED':
    case 'SUCCESS':
      return 'CONFIRMED';
    case 'PENDING':
    case 'NETWORK_PENDING':
    case 'IN_PROGRESS':
      return 'PENDING';
    case 'SUBMITTED':
      return 'SUBMITTED';
    case 'REJECTED':
    case 'USER_REJECTED':
      return 'REJECTED';
    case 'FAILED':
    case 'ERROR':
      return 'FAILED';
    case 'UNSUPPORTED':
      return 'UNSUPPORTED';
    default:
      return 'UNKNOWN';
  }
}

/**
 * Internal record for tracking transaction status.
 */
interface TrackedRecord {
  transactionId: string;
  status: TrackedTransactionStatus;
  detailedStatus?: DetailedReconciliationStatus;
  loanId?: string;
  action?: LifecycleTransactionAction;
  blockHeight?: bigint;
  confirmations?: number;
  createdAt: number;
  updatedAt: number;
  error?: string;
}

/**
 * TransactionStatusService provides an in-memory tracking service for all
 * transaction requests submitted to the network, with explicit reconciliation support.
 *
 * ANTI-FABRICATION INVARIANT:
 * This service NEVER assumes a submitted transaction is confirmed.
 * A transaction remains in SUBMITTED or PENDING status until an authentic
 * indexer or node receipt confirms it with block height metadata.
 */
export class TransactionStatusService {
  private records: Map<string, TrackedRecord> = new Map();

  /**
   * Registers a new transaction for status tracking.
   */
  trackTransaction(
    transactionId: string,
    initialStatus: TrackedTransactionStatus = 'PENDING',
    details?: {
      loanId?: string;
      action?: LifecycleTransactionAction;
      blockHeight?: bigint;
      confirmations?: number;
      error?: string;
    }
  ): TransactionStatusResult {
    const now = Date.now();
    const record: TrackedRecord = {
      transactionId,
      status: initialStatus,
      loanId: details?.loanId,
      action: details?.action,
      blockHeight: details?.blockHeight,
      confirmations: details?.confirmations,
      createdAt: now,
      updatedAt: now,
      error: details?.error,
    };

    this.records.set(transactionId, record);
    return this.toResult(record);
  }

  /**
   * Updates status and optional metadata for an existing tracked transaction.
   */
  updateStatus(
    transactionId: string,
    status: TrackedTransactionStatus,
    details?: {
      blockHeight?: bigint;
      confirmations?: number;
      error?: string;
    }
  ): TransactionStatusResult {
    const existing = this.records.get(transactionId);
    const now = Date.now();

    if (!existing) {
      // Auto-register if not yet tracked
      const newRecord: TrackedRecord = {
        transactionId,
        status,
        blockHeight: details?.blockHeight,
        confirmations: details?.confirmations,
        createdAt: now,
        updatedAt: now,
        error: details?.error,
      };
      this.records.set(transactionId, newRecord);
      return this.toResult(newRecord);
    }

    existing.status = status;
    existing.updatedAt = now;
    if (details?.blockHeight !== undefined) existing.blockHeight = details.blockHeight;
    if (details?.confirmations !== undefined) existing.confirmations = details.confirmations;
    if (details?.error !== undefined) existing.error = details.error;

    return this.toResult(existing);
  }

  /**
   * Reconciles a tracked transaction against an authoritative provider status string.
   * Maps unrecognized or unsupported states safely to UNKNOWN.
   */
  reconcileStatus(
    transactionId: string,
    rawProviderStatus: string | undefined,
    details?: {
      blockHeight?: bigint;
      confirmations?: number;
      error?: string;
    }
  ): TransactionStatusResult {
    const canonicalStatus = normalizeProviderStatus(rawProviderStatus);
    return this.updateStatus(transactionId, canonicalStatus, details);
  }

  /**
   * Queries status for a tracked transaction. Returns null if unknown.
   */
  getStatus(transactionId: string): TransactionStatusResult | null {
    const record = this.records.get(transactionId);
    if (!record) return null;
    return this.toResult(record);
  }

  /**
   * Returns all tracked transactions.
   */
  getAllTracked(): TransactionStatusResult[] {
    return Array.from(this.records.values()).map((r) => this.toResult(r));
  }

  /**
   * Clears tracked records (useful for test isolation).
   */
  clear(): void {
    this.records.clear();
  }

  private toResult(record: TrackedRecord): TransactionStatusResult {
    return {
      transactionId: record.transactionId,
      status: record.status,
      blockHeight: record.blockHeight,
      confirmations: record.confirmations,
      updatedAt: record.updatedAt,
      error: record.error,
    };
  }
}

let globalStatusService: TransactionStatusService | null = null;

/**
 * Returns the singleton TransactionStatusService instance.
 */
export function getTransactionStatusService(): TransactionStatusService {
  if (!globalStatusService) {
    globalStatusService = new TransactionStatusService();
  }
  return globalStatusService;
}

/**
 * Resets the singleton TransactionStatusService instance for testing.
 */
export function resetTransactionStatusService(): TransactionStatusService {
  globalStatusService = new TransactionStatusService();
  return globalStatusService;
}
