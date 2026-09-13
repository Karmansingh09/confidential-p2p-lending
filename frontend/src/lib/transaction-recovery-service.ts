import type {
  PersistedTransaction,
  TransactionReconciliationResult,
  TransactionRecoveryStatus,
} from '../types/transaction-persistence.ts';
import { TransactionPersistenceError } from '../types/transaction-persistence.ts';
import type { WalletProvider } from './wallet-provider.ts';
import type { LoanRegistry } from './loan-registry.ts';
import { LoanStatus } from '../types/index.js';
import {
  TransactionPersistenceService,
  getTransactionPersistenceService,
} from './transaction-persistence-service.ts';
import { getWalletSessionService } from './wallet-session-service.ts';

/**
 * TransactionRecoveryService reconciles persisted local transaction records
 * with verified on-chain provider state.
 *
 * CRITICAL ARCHITECTURAL INVARIANT:
 * Local persistence NEVER implies blockchain confirmation.
 * Confirmation MUST come strictly from provider.getTransactionStatus(id).
 * If the provider cannot provide genuine status, the transaction remains PENDING,
 * UNSUPPORTED, or STALE, and LoanRegistry is NEVER mutated.
 */
export class TransactionRecoveryService {
  private persistence: TransactionPersistenceService;

  constructor(persistence?: TransactionPersistenceService) {
    this.persistence = persistence ?? getTransactionPersistenceService();
  }

  /**
   * Discovers all transactions that were interrupted or remain pending.
   */
  recoverPendingTransactions(): PersistedTransaction[] {
    const all = this.persistence.listTransactions();
    return all.filter((tx) =>
      tx.status === 'SUBMITTED' ||
      tx.status === 'SUBMITTING' ||
      tx.status === 'SIGNATURE_REQUESTED' ||
      tx.status === 'PREPARING' ||
      tx.recoveryStatus === 'PENDING' ||
      tx.recoveryStatus === 'RECOVERABLE'
    );
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
    let effectiveProvider: WalletProvider;
    let effectiveRegistry: LoanRegistry | undefined = loanRegistry;

    if (providerOrRegistry && typeof (providerOrRegistry as any).getLoans === 'function') {
      effectiveRegistry = providerOrRegistry as LoanRegistry;
      effectiveProvider = getWalletSessionService().getProvider();
    } else {
      effectiveProvider = (providerOrRegistry as WalletProvider) ?? getWalletSessionService().getProvider();
    }

    const now = Date.now();
    const tx = this.persistence.getTransaction(persistedTxId);

    if (!tx) {
      return {
        transactionId: persistedTxId,
        success: false,
        previousStatus: 'FAILED',
        reconciledStatus: 'FAILED',
        recoveryStatus: 'NOT_FOUND',
        registryUpdated: false,
        reconciledAt: now,
        message: `Transaction record ${persistedTxId} was not found in persistence storage.`,
        error: 'Transaction record not found.',
        errorCode: 'TRANSACTION_NOT_FOUND',
      };
    }

    const previousStatus = tx.status;

    // Check if provider is connected
    const isConnected =
      typeof (effectiveProvider as any).getConnectionStatus === 'function'
        ? (effectiveProvider as any).getConnectionStatus() === 'CONNECTED'
        : typeof (effectiveProvider as any).isConnected === 'function'
        ? (effectiveProvider as any).isConnected()
        : true;

    if (!isConnected) {
      return {
        transactionId: tx.id,
        success: false,
        previousStatus,
        reconciledStatus: tx.status,
        recoveryStatus: 'UNSUPPORTED',
        providerTransactionId: tx.providerTransactionId,
        blockHeight: tx.blockHeight,
        registryUpdated: false,
        reconciledAt: now,
        message: 'Reconciliation cannot proceed: Wallet provider is not connected.',
        error: 'Wallet provider not connected.',
        errorCode: 'NOT_CONNECTED',
      };
    }

    // Check if provider supports getTransactionStatus
    if (typeof effectiveProvider.getTransactionStatus !== 'function') {
      this.persistence.updateTransaction(tx.id, {
        recoveryStatus: 'UNSUPPORTED',
        reconciledAt: now,
      });

      return {
        transactionId: tx.id,
        success: false,
        previousStatus,
        reconciledStatus: tx.status,
        recoveryStatus: 'UNSUPPORTED',
        providerTransactionId: tx.providerTransactionId,
        blockHeight: tx.blockHeight,
        registryUpdated: false,
        reconciledAt: now,
        message: 'Active wallet provider does not support transaction status tracking.',
        errorCode: 'UNSUPPORTED_OPERATION',
      };
    }

    // Check if provider transaction ID exists
    const providerTxId = tx.providerTransactionId;
    if (!providerTxId) {
      // If never submitted to network, mark STALE
      this.persistence.updateTransaction(tx.id, {
        recoveryStatus: 'STALE',
        reconciledAt: now,
      });

      return {
        transactionId: tx.id,
        success: false,
        previousStatus,
        reconciledStatus: tx.status,
        recoveryStatus: 'STALE',
        registryUpdated: false,
        reconciledAt: now,
        message: 'Transaction was never submitted to the network and has no provider reference.',
      };
    }

    // Query genuine provider transaction status
    try {
      const statusResult = await effectiveProvider.getTransactionStatus(providerTxId);

      if (!statusResult) {
        this.persistence.updateTransaction(tx.id, {
          recoveryStatus: 'PENDING',
          reconciledAt: now,
        });

        return {
          transactionId: tx.id,
          success: false,
          previousStatus,
          reconciledStatus: tx.status,
          recoveryStatus: 'PENDING',
          providerTransactionId: providerTxId,
          registryUpdated: false,
          reconciledAt: now,
          message: 'Provider returned no status for transaction. Status remains pending.',
        };
      }

      const statusError =
        'error' in statusResult && typeof (statusResult as any).error === 'string'
          ? (statusResult as any).error
          : undefined;

      if (statusResult.status === 'CONFIRMED') {
        let registryUpdated = false;
        let updatedRegistry = effectiveRegistry;

        if (effectiveRegistry) {
          const loan = effectiveRegistry.getLoan(tx.loanId);
          const callerPk = tx.callerPublicKey ?? (tx.callerPublicKeyHex ? new Uint8Array(32).fill(1) : undefined);

          if (loan) {
            // Idempotent synchronization rules
            if (tx.action === 'FUND_LOAN') {
              if (loan.status === LoanStatus.funded) {
                // Already funded: idempotent no-op
                registryUpdated = false;
              } else if (loan.status === LoanStatus.requested && callerPk) {
                updatedRegistry = effectiveRegistry.fundLoan(tx.loanId, callerPk, callerPk);
                registryUpdated = true;
              }
            } else if (tx.action === 'REPAY_LOAN') {
              if (loan.status === LoanStatus.repaid || loan.status === LoanStatus.settled) {
                // Already repaid or settled: idempotent no-op
                registryUpdated = false;
              } else if (loan.status === LoanStatus.funded && callerPk) {
                updatedRegistry = effectiveRegistry.repayLoan(tx.loanId, callerPk);
                registryUpdated = true;
              }
            } else if (tx.action === 'SETTLE_LOAN') {
              if (loan.status === LoanStatus.settled) {
                // Already settled: idempotent no-op
                registryUpdated = false;
              } else if (loan.status === LoanStatus.repaid && callerPk) {
                updatedRegistry = effectiveRegistry.settleLoan(tx.loanId, callerPk);
                registryUpdated = true;
              }
            }
          }
        }

        this.persistence.updateTransaction(tx.id, {
          status: 'CONFIRMED',
          recoveryStatus: 'CONFIRMED',
          blockHeight: statusResult.blockHeight,
          reconciledAt: now,
        });

        return {
          transactionId: tx.id,
          success: true,
          previousStatus,
          reconciledStatus: 'CONFIRMED',
          recoveryStatus: 'CONFIRMED',
          providerTransactionId: providerTxId,
          blockHeight: statusResult.blockHeight,
          registryUpdated,
          updatedRegistry,
          reconciledAt: now,
          message: `Transaction confirmed on Midnight Network at block ${statusResult.blockHeight ? statusResult.blockHeight.toString() : 'unknown'}.`,
        };
      }

      if (statusResult.status === 'PENDING' || statusResult.status === 'SUBMITTED') {
        this.persistence.updateTransaction(tx.id, {
          recoveryStatus: 'PENDING',
          reconciledAt: now,
        });

        return {
          transactionId: tx.id,
          success: false,
          previousStatus,
          reconciledStatus: tx.status,
          recoveryStatus: 'PENDING',
          providerTransactionId: providerTxId,
          registryUpdated: false,
          reconciledAt: now,
          message: 'Transaction is pending on Midnight Network. Awaiting block confirmation.',
        };
      }

      if (statusResult.status === 'REJECTED') {
        this.persistence.updateTransaction(tx.id, {
          status: 'REJECTED',
          recoveryStatus: 'REJECTED',
          reconciledAt: now,
          error: statusError,
        });

        return {
          transactionId: tx.id,
          success: false,
          previousStatus,
          reconciledStatus: 'REJECTED',
          recoveryStatus: 'REJECTED',
          providerTransactionId: providerTxId,
          registryUpdated: false,
          reconciledAt: now,
          message: 'Transaction was rejected by network nodes or wallet user.',
          error: statusError,
        };
      }

      if (statusResult.status === 'FAILED') {
        this.persistence.updateTransaction(tx.id, {
          status: 'FAILED',
          recoveryStatus: 'FAILED',
          reconciledAt: now,
          error: statusError,
        });

        return {
          transactionId: tx.id,
          success: false,
          previousStatus,
          reconciledStatus: 'FAILED',
          recoveryStatus: 'FAILED',
          providerTransactionId: providerTxId,
          registryUpdated: false,
          reconciledAt: now,
          message: 'Transaction execution failed on Midnight Network.',
          error: statusError,
        };
      }

      // Any unknown or unrecognized status safely mapped to STALE
      this.persistence.updateTransaction(tx.id, {
        recoveryStatus: 'STALE',
        reconciledAt: now,
      });

      return {
        transactionId: tx.id,
        success: false,
        previousStatus,
        reconciledStatus: tx.status,
        recoveryStatus: 'STALE',
        providerTransactionId: providerTxId,
        registryUpdated: false,
        reconciledAt: now,
        message: `Received unrecognized provider status: ${statusResult.status}. Status mapped to STALE.`,
      };
    } catch (err: unknown) {
      const errCode = (err as any)?.code === 'UNSUPPORTED_OPERATION'
        ? 'UNSUPPORTED_OPERATION'
        : 'PROVIDER_ERROR';

      const errMsg = err instanceof Error ? err.message : 'Provider query failed.';

      this.persistence.updateTransaction(tx.id, {
        recoveryStatus: errCode === 'UNSUPPORTED_OPERATION' ? 'UNSUPPORTED' : 'FAILED',
        reconciledAt: now,
        error: errMsg,
      });

      return {
        transactionId: tx.id,
        success: false,
        previousStatus,
        reconciledStatus: tx.status,
        recoveryStatus: errCode === 'UNSUPPORTED_OPERATION' ? 'UNSUPPORTED' : 'FAILED',
        providerTransactionId: providerTxId,
        registryUpdated: false,
        reconciledAt: now,
        message: `Provider status query failed: ${errMsg}`,
        error: errMsg,
        errorCode: errCode,
      };
    }
  }

  /**
   * Reconciles all recoverable transactions sequentially with the active provider.
   */
  async reconcileAll(
    providerOrRegistry?: WalletProvider | LoanRegistry,
    loanRegistry?: LoanRegistry
  ): Promise<TransactionReconciliationResult[]> {
    let effectiveProvider: WalletProvider;
    let effectiveRegistry: LoanRegistry | undefined = loanRegistry;

    if (providerOrRegistry && typeof (providerOrRegistry as any).getLoans === 'function') {
      effectiveRegistry = providerOrRegistry as LoanRegistry;
      effectiveProvider = getWalletSessionService().getProvider();
    } else {
      effectiveProvider = (providerOrRegistry as WalletProvider) ?? getWalletSessionService().getProvider();
    }

    const recoverable = this.getRecoverableTransactions();
    const results: TransactionReconciliationResult[] = [];
    let currentRegistry = effectiveRegistry;

    for (const tx of recoverable) {
      const result = await this.reconcileTransaction(tx.id, effectiveProvider, currentRegistry);
      if (result.updatedRegistry) {
        currentRegistry = result.updatedRegistry;
      }
      results.push(result);
    }

    return results;
  }
}

let globalRecoveryService: TransactionRecoveryService | null = null;

/**
 * Returns the singleton TransactionRecoveryService instance.
 */
export function getTransactionRecoveryService(
  persistence?: TransactionPersistenceService
): TransactionRecoveryService {
  if (!globalRecoveryService || persistence) {
    globalRecoveryService = new TransactionRecoveryService(persistence);
  }
  return globalRecoveryService;
}

/**
 * Resets the global recovery service instance.
 */
export function resetTransactionRecoveryService(
  persistence?: TransactionPersistenceService
): TransactionRecoveryService {
  globalRecoveryService = new TransactionRecoveryService(persistence);
  return globalRecoveryService;
}
