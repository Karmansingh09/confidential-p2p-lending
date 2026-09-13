import type {
  TransactionLifecycleEvent,
  TransactionLifecycleEventType,
  TransactionEventSource,
} from '../types/transaction-events.ts';
import type { LifecycleTransactionAction } from '../types/transaction-orchestration.ts';

export interface AppendEventParams {
  transactionId: string;
  eventType: TransactionLifecycleEventType;
  action: LifecycleTransactionAction | string;
  status: string;
  source: TransactionEventSource;
  eventId?: string;
  timestamp?: number;
  agreementId?: string;
  providerKind?: string;
  networkId?: string;
  message?: string;
  sequenceNumber?: number;
}

/**
 * TransactionEventService maintains an immutable, append-only repository
 * of transaction lifecycle events.
 *
 * ARCHITECTURAL PRINCIPLE:
 * Events represent recorded application observations and provider query outcomes.
 * They are never fabricated and provide a tamper-evident audit trail for reconciliation.
 */
export class TransactionEventService {
  private events: TransactionLifecycleEvent[] = [];
  private eventIds: Set<string> = new Set();
  private txSequenceCounters: Map<string, number> = new Map();

  /**
   * Appends an event to the ledger with deterministic sequence numbering.
   * Duplicate event IDs are safely deduplicated.
   */
  appendEvent(params: AppendEventParams): TransactionLifecycleEvent {
    const transactionId = params.transactionId;
    const currentSeq = this.txSequenceCounters.get(transactionId) ?? 0;
    const sequenceNumber = params.sequenceNumber ?? currentSeq + 1;
    this.txSequenceCounters.set(transactionId, Math.max(currentSeq, sequenceNumber));

    const timestamp = params.timestamp ?? Date.now();
    const eventId = params.eventId ?? `evt-${transactionId}-${sequenceNumber}`;

    if (this.eventIds.has(eventId)) {
      const existing = this.events.find((e) => e.eventId === eventId);
      if (existing) {
        return Object.freeze({ ...existing });
      }
    }

    const event: TransactionLifecycleEvent = Object.freeze({
      eventId,
      transactionId,
      eventType: params.eventType,
      timestamp,
      action: params.action,
      agreementId: params.agreementId,
      providerKind: params.providerKind,
      networkId: params.networkId,
      status: params.status,
      message: params.message,
      source: params.source,
      sequenceNumber,
    });

    this.eventIds.add(eventId);
    this.events.push(event);

    return event;
  }

  /**
   * Retrieves all events recorded for a given transaction, sorted by sequence number ascending.
   */
  getEventsForTransaction(transactionId: string): TransactionLifecycleEvent[] {
    return this.events
      .filter((e) => e.transactionId === transactionId)
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
      .map((e) => Object.freeze({ ...e }));
  }

  /**
   * Retrieves all events recorded for a given agreement ID (loanId).
   */
  getEventsForAgreement(agreementId: string): TransactionLifecycleEvent[] {
    return this.events
      .filter((e) => e.agreementId === agreementId)
      .sort((a, b) => a.timestamp - b.timestamp || a.sequenceNumber - b.sequenceNumber)
      .map((e) => Object.freeze({ ...e }));
  }

  /**
   * Returns the most recent event recorded for a transaction.
   */
  getLatestEvent(transactionId: string): TransactionLifecycleEvent | undefined {
    const txEvents = this.getEventsForTransaction(transactionId);
    if (txEvents.length === 0) return undefined;
    return txEvents[txEvents.length - 1];
  }

  /**
   * Returns an immutable snapshot copy of all recorded events.
   */
  getAllEvents(): TransactionLifecycleEvent[] {
    return this.events.map((e) => Object.freeze({ ...e }));
  }

  /**
   * Clears all recorded events and resets sequence counters.
   * Intended for testing and development environments.
   */
  clearEvents(): void {
    this.events = [];
    this.eventIds.clear();
    this.txSequenceCounters.clear();
  }
}

let globalEventService: TransactionEventService | null = null;

/**
 * Returns the singleton TransactionEventService instance.
 */
export function getTransactionEventService(): TransactionEventService {
  if (!globalEventService) {
    globalEventService = new TransactionEventService();
  }
  return globalEventService;
}

/**
 * Resets and returns the global TransactionEventService instance.
 */
export function resetTransactionEventService(): TransactionEventService {
  globalEventService = new TransactionEventService();
  return globalEventService;
}
