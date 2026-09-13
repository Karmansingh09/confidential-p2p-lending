import type { LifecycleTransactionAction } from './transaction-orchestration.ts';

/**
 * Granular transaction lifecycle event types representing distinct application
 * and provider observation stages.
 */
export type TransactionLifecycleEventType =
  | 'CREATED'
  | 'PREPARED'
  | 'SIGNING_STARTED'
  | 'SIGNED'
  | 'SUBMISSION_STARTED'
  | 'SUBMITTED'
  | 'CONFIRMATION_CHECK_STARTED'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'FAILED'
  | 'BLOCKED'
  | 'UNSUPPORTED'
  | 'RECOVERY_STARTED'
  | 'RECOVERY_COMPLETED'
  | 'RECONCILIATION_STARTED'
  | 'RECONCILIATION_COMPLETED'
  | 'RECONCILIATION_FAILED';

/**
 * Originating system layer or subsystem that produced the lifecycle event.
 */
export type TransactionEventSource =
  | 'EXECUTION_SERVICE'
  | 'STATUS_SERVICE'
  | 'RECOVERY_SERVICE'
  | 'RECONCILIATION_SERVICE'
  | 'WALLET_PROVIDER'
  | 'SYSTEM';

/**
 * Immutable transaction lifecycle event containing strictly safe public metadata.
 *
 * STRICT PRIVACY INVARIANT:
 * Contains only public agreement terms, caller public account identifiers,
 * timestamps, and operational status codes.
 */
export interface TransactionLifecycleEvent {
  /** Unique deterministic identifier for the event */
  eventId: string;
  /** Associated transaction request ID */
  transactionId: string;
  /** Lifecycle event classification */
  eventType: TransactionLifecycleEventType;
  /** Milliseconds epoch timestamp when the event occurred */
  timestamp: number;
  /** Application action name (e.g. FUND_LOAN, REPAY_LOAN, SETTLE_LOAN) */
  action: LifecycleTransactionAction | string;
  /** Associated agreement identifier */
  agreementId?: string;
  /** Active provider classification (e.g. PROTOTYPE, MIDNIGHT_WALLET) */
  providerKind?: string;
  /** Active network identifier (e.g. undeployed, testnet, devnet) */
  networkId?: string;
  /** Current transaction status at the time the event was recorded */
  status: string;
  /** Human-readable operational description or error explanation */
  message?: string;
  /** Originating subsystem that emitted this event */
  source: TransactionEventSource;
  /** Monotonically increasing sequence number for deterministic ordering */
  sequenceNumber: number;
}
