import type {
  PersistedTransaction,
  TransactionRecoveryStatus,
} from '../types/transaction-persistence.ts';
import type {
  TransactionReconciliationResult,
} from '../types/transaction-reconciliation.ts';
import type { WalletProvider } from './wallet-provider.ts';
import type { LoanRegistry } from './loan-registry.ts';
import {
  TransactionPersistenceService,
  getTransactionPersistenceService,
} from './transaction-persistence-service.ts';
import {
  TransactionEventService,
  getTransactionEventService,
} from './transaction-event-service.ts';
import {
  TransactionReconciliationService,
  getTransactionReconciliationService,
} from './transaction-reconciliation-service.ts';

/**
 * TransactionRecoveryService coordinates transaction recovery on startup and on-demand,
 * delegating on-chain verification to TransactionReconciliationService.
 *
 * CRITICAL ARCHITECTURAL INVARIANT:
 * Local persistence NEVER implies blockchain confirmation.
 * Confirmation MUST come strictly from provider.getTransactionStatus(id).
 * A persisted transaction with SUBMITTED remains unconfirmed until the provider confirms it.
 */
export class TransactionRecoveryService {
  private persistence: TransactionPersistenceService;
  private reconciliationService: TransactionReconciliationService;
  private eventService: TransactionEventService;

  constructor(
    persistence?: TransactionPersistenceService,
    reconciliationService?: TransactionReconciliationService,
    eventService?: TransactionEventService
  ) {
    this.persistence = persistence ?? getTransactionPersistenceService();
    this.eventService = eventService ?? getTransactionEventService();
    this.reconciliationService =
      reconciliationService ??
      new TransactionReconciliationService(this.persistence, this.eventService);
  }

  /**
   * Discovers all transactions that were interrupted or remain pending,
   * emitting RECOVERY_STARTED lifecycle events.
   */
  recoverPendingTransactions(): PersistedTransaction[] {
    const all = this.persistence.listTransactions();
    const pending = all.filter((tx) =>
      tx.status === 'SUBMITTED' ||
      tx.status === 'SUBMITTING' ||
      tx.status === 'SIGNATURE_REQUESTED' ||
      tx.status === 'PREPARING' ||
      tx.recoveryStatus === 'PENDING' ||
      tx.recoveryStatus === 'RECOVERABLE'
    );

    for (const tx of pending) {
      this.eventService.appendEvent({
        transactionId: tx.id,
        eventType: 'RECOVERY_STARTED',
        action: tx.action,
        agreementId: tx.loanId,
        providerKind: tx.providerKind,
        networkId: tx.networkId,
        status: tx.status,
        source: 'RECOVERY_SERVICE',
        message: `Discovered pending transaction ${tx.id} for lifecycle recovery.`,
      });
    }

    return pending;
  }

  /**
   * Discovers all transactions eligible for on-chain status reconciliation.
   */
  getRecoverableTransactions(): PersistedTransaction[] {
    const all = this.persistence.listTransactions();
    return all.filter((tx) =>
      tx.status === 'SUBMITTED' ||
      tx.status === 'SUBMITTING' ||
      tx.recoveryStatus === 'PENDING' ||
      tx.recoveryStatus === 'RECOVERABLE'
    );
  }

  /**
   * Reconciles a single persisted transaction with the active wallet provider.
   */
  async reconcileTransaction(
    persistedTxId: string,
    providerOrRegistry?: WalletProvider | LoanRegistry,
    loanRegistry?: LoanRegistry
  ): Promise<TransactionReconciliationResult> {
    const result = await this.reconciliationService.reconcileTransaction(
      persistedTxId,
      providerOrRegistry,
      loanRegistry
    );

    const tx = this.persistence.getTransaction(persistedTxId);
    if (result.reconciliationStatus === 'RECONCILED' || result.success) {
      this.eventService.appendEvent({
        transactionId: persistedTxId,
        eventType: 'RECOVERY_COMPLETED',
        action: tx ? tx.action : 'UNKNOWN',
        agreementId: result.agreementId,
        status: 'CONFIRMED',
        source: 'RECOVERY_SERVICE',
        message: `Recovery completed for transaction ${persistedTxId}. Confirmed on-chain.`,
      });
    }

    return result;
  }

  /**
   * Reconciles all recoverable transactions sequentially with the active provider.
   */
  async reconcileAll(
    providerOrRegistry?: WalletProvider | LoanRegistry,
    loanRegistry?: LoanRegistry
  ): Promise<TransactionReconciliationResult[]> {
    return this.reconciliationService.reconcileAll(providerOrRegistry, loanRegistry);
  }
}

let globalRecoveryService: TransactionRecoveryService | null = null;

/**
 * Returns the singleton TransactionRecoveryService instance.
 */
export function getTransactionRecoveryService(
  persistence?: TransactionPersistenceService,
  reconciliationService?: TransactionReconciliationService,
  eventService?: TransactionEventService
): TransactionRecoveryService {
  if (!globalRecoveryService || persistence || reconciliationService || eventService) {
    globalRecoveryService = new TransactionRecoveryService(persistence, reconciliationService, eventService);
  }
  return globalRecoveryService;
}

/**
 * Resets the global recovery service instance.
 */
export function resetTransactionRecoveryService(
  persistence?: TransactionPersistenceService,
  reconciliationService?: TransactionReconciliationService,
  eventService?: TransactionEventService
): TransactionRecoveryService {
  globalRecoveryService = new TransactionRecoveryService(persistence, reconciliationService, eventService);
  return globalRecoveryService;
}
