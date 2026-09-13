import type {
  TransactionReconciliationResult,
  ReconciliationStatus,
  ReconciliationReason,
} from '../types/transaction-reconciliation.ts';
import type { PersistedTransaction } from '../types/transaction-persistence.ts';
import type { WalletProvider } from './wallet-provider.ts';
import type { LoanRegistry } from './loan-registry.ts';
import { LoanStatus } from '../types/index.js';
import {
  TransactionPersistenceService,
  getTransactionPersistenceService,
} from './transaction-persistence-service.ts';
import {
  TransactionEventService,
  getTransactionEventService,
} from './transaction-event-service.ts';
import { getWalletSessionService } from './wallet-session-service.ts';
import { evaluateNetworkCompatibility } from './wallet-network-compatibility.ts';
import { getNetworkConfigService } from './network-config-service.ts';
import {
  ContractDeploymentService,
  getContractDeploymentService,
} from './contract-deployment-service.ts';

export interface ReconcileOptions {
  provider?: WalletProvider;
  loanRegistry?: LoanRegistry;
  expectedNetworkId?: string;
  deploymentService?: ContractDeploymentService;
}

/**
 * TransactionReconciliationService orchestrates deterministic reconciliation
 * between local persisted transactions and authoritative on-chain provider state.
 *
 * CRITICAL ARCHITECTURAL PRINCIPLE:
 * LOCAL TRANSACTION RECORD ≠ PROVIDER STATUS ≠ CANONICAL LOAN REGISTRY STATE
 *
 * Persisted transaction records store only public metadata and off-chain execution stage.
 * Only genuine provider verification returning CONFIRMED may authorize mutation of the
 * authoritative LoanRegistry.
 */
export class TransactionReconciliationService {
  private persistence: TransactionPersistenceService;
  private eventService: TransactionEventService;
  private deploymentService?: ContractDeploymentService;

  constructor(
    persistence?: TransactionPersistenceService,
    eventService?: TransactionEventService,
    deploymentService?: ContractDeploymentService
  ) {
    this.persistence = persistence ?? getTransactionPersistenceService();
    this.eventService = eventService ?? getTransactionEventService();
    this.deploymentService = deploymentService;
  }

  /**
   * Reconciles a single persisted transaction with the active wallet provider.
   *
   * @param transactionId - The ID of the persisted transaction record.
   * @param providerOrRegistry - Optional WalletProvider, LoanRegistry, or options object.
   * @param loanRegistry - Optional LoanRegistry if provider passed in second position.
   */
  async reconcileTransaction(
    transactionId: string,
    providerOrRegistry?: WalletProvider | LoanRegistry | ReconcileOptions,
    loanRegistry?: LoanRegistry
  ): Promise<TransactionReconciliationResult> {
    let effectiveProvider: WalletProvider;
    let effectiveRegistry: LoanRegistry | undefined = loanRegistry;
    let expectedNetworkId: string | undefined;

    let effectiveDeploymentService = this.deploymentService;

    if (providerOrRegistry && typeof (providerOrRegistry as any).getLoans === 'function') {
      effectiveRegistry = providerOrRegistry as LoanRegistry;
      effectiveProvider = getWalletSessionService().getProvider();
    } else if (
      providerOrRegistry &&
      typeof (providerOrRegistry as any).getTransactionStatus === 'undefined' &&
      typeof (providerOrRegistry as any).getProviderName === 'undefined' &&
      typeof (providerOrRegistry as any).isPrototype === 'undefined'
    ) {
      const opts = providerOrRegistry as ReconcileOptions;
      effectiveProvider = opts.provider ?? getWalletSessionService().getProvider();
      effectiveRegistry = opts.loanRegistry ?? loanRegistry;
      expectedNetworkId = opts.expectedNetworkId;
      if (opts.deploymentService) {
        effectiveDeploymentService = opts.deploymentService;
      }
    } else {
      effectiveProvider = (providerOrRegistry as WalletProvider) ?? getWalletSessionService().getProvider();
    }

    const now = Date.now();
    const tx = this.persistence.getTransaction(transactionId);

    // 1. If no record exists, return NOT_REQUIRED / TRANSACTION_NOT_FOUND without creating state
    if (!tx) {
      return {
        transactionId,
        localStatus: 'FAILED',
        reconciliationStatus: 'NOT_REQUIRED',
        reason: 'TRANSACTION_NOT_FOUND',
        registryMutationAllowed: false,
        reconciledAt: now,
        message: `Transaction record ${transactionId} was not found in persistent storage.`,
        success: false,
        previousStatus: 'FAILED',
        reconciledStatus: 'FAILED',
        recoveryStatus: 'NOT_FOUND',
        registryUpdated: false,
        error: 'Transaction record not found.',
        errorCode: 'TRANSACTION_NOT_FOUND',
      };
    }

    const previousStatus = tx.status;
    const providerKind = (effectiveProvider as any).isPrototype
      ? 'PROTOTYPE'
      : (effectiveProvider as any).name ?? 'WALLET_PROVIDER';
    const networkId = effectiveProvider.getReportedNetworkId ? effectiveProvider.getReportedNetworkId() ?? 'unknown' : 'unknown';

    // Append RECONCILIATION_STARTED lifecycle event
    this.eventService.appendEvent({
      transactionId: tx.id,
      eventType: 'RECONCILIATION_STARTED',
      action: tx.action,
      agreementId: tx.loanId,
      providerKind,
      networkId,
      status: tx.status,
      source: 'RECONCILIATION_SERVICE',
      message: `Initiating reconciliation for transaction ${tx.id} against provider ${providerKind}.`,
    });

    // 2. Check connection status
    const isConnected =
      typeof (effectiveProvider as any).getConnectionStatus === 'function'
        ? (effectiveProvider as any).getConnectionStatus() === 'CONNECTED'
        : typeof (effectiveProvider as any).isConnected === 'function'
        ? (effectiveProvider as any).isConnected()
        : true;

    if (!isConnected) {
      this.eventService.appendEvent({
        transactionId: tx.id,
        eventType: 'RECONCILIATION_FAILED',
        action: tx.action,
        agreementId: tx.loanId,
        providerKind,
        networkId,
        status: tx.status,
        source: 'RECONCILIATION_SERVICE',
        message: 'Reconciliation aborted: Wallet provider is disconnected.',
      });

      return {
        transactionId: tx.id,
        agreementId: tx.loanId,
        localStatus: previousStatus,
        reconciliationStatus: 'UNSUPPORTED',
        reason: 'STATUS_UNAVAILABLE',
        registryMutationAllowed: false,
        reconciledAt: now,
        message: 'Reconciliation cannot proceed: Wallet provider is not connected.',
        success: false,
        previousStatus,
        reconciledStatus: tx.status,
        recoveryStatus: 'UNSUPPORTED',
        providerTransactionId: tx.providerTransactionId,
        blockHeight: tx.blockHeight,
        registryUpdated: false,
        error: 'Wallet provider not connected.',
        errorCode: 'NOT_CONNECTED',
      };
    }

    // 2.5. Evaluate contract deployment configuration
    if (effectiveDeploymentService) {
      const deployment = effectiveDeploymentService.getDeployment();
      if (deployment.status === 'NOT_DEPLOYED' || deployment.status === 'UNCONFIGURED') {
        this.eventService.appendEvent({
          transactionId: tx.id,
          eventType: 'RECONCILIATION_FAILED',
          action: tx.action,
          agreementId: tx.loanId,
          providerKind,
          networkId,
          status: tx.status,
          source: 'RECONCILIATION_SERVICE',
          message: 'Reconciliation aborted: Contract deployment is not configured or not deployed.',
        });

        return {
          transactionId: tx.id,
          agreementId: tx.loanId,
          localStatus: previousStatus,
          reconciliationStatus: 'UNSUPPORTED',
          reason: 'STATUS_UNAVAILABLE',
          registryMutationAllowed: false,
          reconciledAt: now,
          message: 'Reconciliation cannot proceed: Contract deployment is not configured or not deployed.',
          success: false,
          previousStatus,
          reconciledStatus: tx.status,
          recoveryStatus: 'UNSUPPORTED',
          providerTransactionId: tx.providerTransactionId,
          blockHeight: tx.blockHeight,
          registryUpdated: false,
          error: 'Contract deployment not configured.',
          errorCode: 'NOT_CONFIGURED',
        };
      }
    }

    // 3. Evaluate network compatibility
    const networkConfig = getNetworkConfigService().getNetworkConfig();
    const targetExpectedNetwork = expectedNetworkId ?? networkConfig.environment;
    const reportedNetwork = typeof effectiveProvider.getReportedNetworkId === 'function' ? effectiveProvider.getReportedNetworkId() : null;

    if (expectedNetworkId || networkConfig.environment !== 'LOCAL') {
      const evalConfig = expectedNetworkId
        ? { ...networkConfig, networkId: expectedNetworkId, environment: 'TESTNET' as const }
        : networkConfig;
      const networkCompatibility = evaluateNetworkCompatibility(evalConfig, reportedNetwork);

      if (networkCompatibility.compatibility === 'MISMATCH') {
        this.eventService.appendEvent({
          transactionId: tx.id,
          eventType: 'RECONCILIATION_FAILED',
          action: tx.action,
          agreementId: tx.loanId,
          providerKind,
          networkId: reportedNetwork ?? 'unknown',
          status: tx.status,
          source: 'RECONCILIATION_SERVICE',
          message: `Reconciliation blocked by network mismatch. Expected ${targetExpectedNetwork}, got ${reportedNetwork}.`,
        });

        return {
          transactionId: tx.id,
          agreementId: tx.loanId,
          localStatus: previousStatus,
          reconciliationStatus: 'FAILED',
          reason: 'NETWORK_MISMATCH',
          registryMutationAllowed: false,
          reconciledAt: now,
          message: `Network mismatch: expected ${targetExpectedNetwork} but wallet is on ${reportedNetwork}.`,
          success: false,
          previousStatus,
          reconciledStatus: tx.status,
          recoveryStatus: 'FAILED',
          providerTransactionId: tx.providerTransactionId,
          blockHeight: tx.blockHeight,
          registryUpdated: false,
          error: 'Network mismatch',
          errorCode: 'NETWORK_MISMATCH',
        };
      }
    }

    // 4. Check if provider supports getTransactionStatus
    if (typeof effectiveProvider.getTransactionStatus !== 'function') {
      this.persistence.updateTransaction(tx.id, {
        recoveryStatus: 'UNSUPPORTED',
        reconciledAt: now,
      });

      this.eventService.appendEvent({
        transactionId: tx.id,
        eventType: 'UNSUPPORTED',
        action: tx.action,
        agreementId: tx.loanId,
        providerKind,
        networkId,
        status: tx.status,
        source: 'RECONCILIATION_SERVICE',
        message: `Provider ${providerKind} does not support transaction status tracking.`,
      });

      return {
        transactionId: tx.id,
        agreementId: tx.loanId,
        localStatus: previousStatus,
        reconciliationStatus: 'UNSUPPORTED',
        reason: 'PROVIDER_UNSUPPORTED',
        registryMutationAllowed: false,
        reconciledAt: now,
        message: 'Active wallet provider does not support transaction status tracking.',
        success: false,
        previousStatus,
        reconciledStatus: tx.status,
        recoveryStatus: 'UNSUPPORTED',
        providerTransactionId: tx.providerTransactionId,
        blockHeight: tx.blockHeight,
        registryUpdated: false,
        errorCode: 'UNSUPPORTED_OPERATION',
      };
    }

    // 5. Check if provider transaction ID exists
    const providerTxId = tx.providerTransactionId;
    if (!providerTxId) {
      this.persistence.updateTransaction(tx.id, {
        recoveryStatus: 'STALE',
        reconciledAt: now,
      });

      this.eventService.appendEvent({
        transactionId: tx.id,
        eventType: 'RECONCILIATION_FAILED',
        action: tx.action,
        agreementId: tx.loanId,
        providerKind,
        networkId,
        status: tx.status,
        source: 'RECONCILIATION_SERVICE',
        message: 'Transaction was never submitted to the network and has no provider reference.',
      });

      return {
        transactionId: tx.id,
        agreementId: tx.loanId,
        localStatus: previousStatus,
        reconciliationStatus: 'FAILED',
        reason: 'LOCAL_RECORD_ONLY',
        registryMutationAllowed: false,
        reconciledAt: now,
        message: 'Transaction was never submitted to the network and has no provider reference.',
        success: false,
        previousStatus,
        reconciledStatus: tx.status,
        recoveryStatus: 'STALE',
        registryUpdated: false,
      };
    }

    // 6. Query genuine provider transaction status
    try {
      this.eventService.appendEvent({
        transactionId: tx.id,
        eventType: 'CONFIRMATION_CHECK_STARTED',
        action: tx.action,
        agreementId: tx.loanId,
        providerKind,
        networkId,
        status: tx.status,
        source: 'RECONCILIATION_SERVICE',
        message: `Querying status for provider reference ${providerTxId}.`,
      });

      const statusResult = await effectiveProvider.getTransactionStatus(providerTxId);

      if (!statusResult) {
        this.persistence.updateTransaction(tx.id, {
          recoveryStatus: 'PENDING',
          reconciledAt: now,
        });

        return {
          transactionId: tx.id,
          agreementId: tx.loanId,
          localStatus: previousStatus,
          providerStatus: 'PENDING',
          reconciliationStatus: 'PENDING',
          reason: 'PROVIDER_PENDING',
          registryMutationAllowed: false,
          reconciledAt: now,
          message: 'Provider returned no status for transaction. Status remains pending.',
          success: false,
          previousStatus,
          reconciledStatus: tx.status,
          recoveryStatus: 'PENDING',
          providerTransactionId: providerTxId,
          registryUpdated: false,
        };
      }

      const statusError =
        'error' in statusResult && typeof (statusResult as any).error === 'string'
          ? (statusResult as any).error
          : undefined;

      // 7. Handle CONFIRMED: ONLY path where LoanRegistry mutation is permitted
      if (statusResult.status === 'CONFIRMED') {
        let registryUpdated = false;
        let updatedRegistry = effectiveRegistry;

        if (effectiveRegistry) {
          const loan = effectiveRegistry.getLoan(tx.loanId);
          const callerPk = tx.callerPublicKey ?? (tx.callerPublicKeyHex ? new Uint8Array(32).fill(1) : undefined);

          if (loan) {
            // Idempotent state transitions
            if (tx.action === 'FUND_LOAN') {
              if (loan.status === LoanStatus.funded) {
                registryUpdated = false;
              } else if (loan.status === LoanStatus.requested && callerPk) {
                updatedRegistry = effectiveRegistry.fundLoan(tx.loanId, callerPk, callerPk);
                registryUpdated = true;
              }
            } else if (tx.action === 'REPAY_LOAN') {
              if (loan.status === LoanStatus.repaid || loan.status === LoanStatus.settled) {
                registryUpdated = false;
              } else if (loan.status === LoanStatus.funded && callerPk) {
                updatedRegistry = effectiveRegistry.repayLoan(tx.loanId, callerPk);
                registryUpdated = true;
              }
            } else if (tx.action === 'SETTLE_LOAN') {
              if (loan.status === LoanStatus.settled) {
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

        this.eventService.appendEvent({
          transactionId: tx.id,
          eventType: 'CONFIRMED',
          action: tx.action,
          agreementId: tx.loanId,
          providerKind,
          networkId,
          status: 'CONFIRMED',
          source: 'RECONCILIATION_SERVICE',
          message: `Transaction confirmed on Midnight Network at block ${statusResult.blockHeight ? statusResult.blockHeight.toString() : 'unknown'}.`,
        });

        this.eventService.appendEvent({
          transactionId: tx.id,
          eventType: 'RECONCILIATION_COMPLETED',
          action: tx.action,
          agreementId: tx.loanId,
          providerKind,
          networkId,
          status: 'CONFIRMED',
          source: 'RECONCILIATION_SERVICE',
          message: `Reconciliation completed successfully. Registry mutation allowed: true (Updated: ${registryUpdated}).`,
        });

        return {
          transactionId: tx.id,
          agreementId: tx.loanId,
          localStatus: 'CONFIRMED',
          providerStatus: 'CONFIRMED',
          reconciliationStatus: 'RECONCILED',
          reason: 'PROVIDER_CONFIRMED',
          registryMutationAllowed: true,
          reconciledAt: now,
          message: `Transaction confirmed on Midnight Network at block ${statusResult.blockHeight ? statusResult.blockHeight.toString() : 'unknown'}.`,
          success: true,
          previousStatus,
          reconciledStatus: 'CONFIRMED',
          recoveryStatus: 'CONFIRMED',
          providerTransactionId: providerTxId,
          blockHeight: statusResult.blockHeight,
          registryUpdated,
          updatedRegistry,
        };
      }

      // 8. Handle PENDING / SUBMITTED: LoanRegistry MUST remain unchanged
      if (statusResult.status === 'PENDING' || statusResult.status === 'SUBMITTED') {
        this.persistence.updateTransaction(tx.id, {
          recoveryStatus: 'PENDING',
          reconciledAt: now,
        });

        this.eventService.appendEvent({
          transactionId: tx.id,
          eventType: 'SUBMITTED',
          action: tx.action,
          agreementId: tx.loanId,
          providerKind,
          networkId,
          status: tx.status,
          source: 'RECONCILIATION_SERVICE',
          message: 'Transaction is pending on Midnight Network. Awaiting block confirmation.',
        });

        return {
          transactionId: tx.id,
          agreementId: tx.loanId,
          localStatus: previousStatus,
          providerStatus: statusResult.status,
          reconciliationStatus: 'PENDING',
          reason: 'PROVIDER_PENDING',
          registryMutationAllowed: false,
          reconciledAt: now,
          message: 'Transaction is pending on Midnight Network. Awaiting block confirmation.',
          success: false,
          previousStatus,
          reconciledStatus: tx.status,
          recoveryStatus: 'PENDING',
          providerTransactionId: providerTxId,
          registryUpdated: false,
        };
      }

      // 9. Handle REJECTED: LoanRegistry MUST remain unchanged
      if (statusResult.status === 'REJECTED') {
        this.persistence.updateTransaction(tx.id, {
          status: 'REJECTED',
          recoveryStatus: 'REJECTED',
          reconciledAt: now,
          error: statusError,
        });

        this.eventService.appendEvent({
          transactionId: tx.id,
          eventType: 'REJECTED',
          action: tx.action,
          agreementId: tx.loanId,
          providerKind,
          networkId,
          status: 'REJECTED',
          source: 'RECONCILIATION_SERVICE',
          message: 'Transaction was rejected by network nodes or wallet user.',
        });

        this.eventService.appendEvent({
          transactionId: tx.id,
          eventType: 'RECONCILIATION_FAILED',
          action: tx.action,
          agreementId: tx.loanId,
          providerKind,
          networkId,
          status: 'REJECTED',
          source: 'RECONCILIATION_SERVICE',
          message: 'Reconciliation concluded: transaction rejected.',
        });

        return {
          transactionId: tx.id,
          agreementId: tx.loanId,
          localStatus: 'REJECTED',
          providerStatus: 'REJECTED',
          reconciliationStatus: 'FAILED',
          reason: 'PROVIDER_REJECTED',
          registryMutationAllowed: false,
          reconciledAt: now,
          message: 'Transaction was rejected by network nodes or wallet user.',
          success: false,
          previousStatus,
          reconciledStatus: 'REJECTED',
          recoveryStatus: 'REJECTED',
          providerTransactionId: providerTxId,
          registryUpdated: false,
          error: statusError,
        };
      }

      // 10. Handle FAILED: LoanRegistry MUST remain unchanged
      if (statusResult.status === 'FAILED') {
        this.persistence.updateTransaction(tx.id, {
          status: 'FAILED',
          recoveryStatus: 'FAILED',
          reconciledAt: now,
          error: statusError,
        });

        this.eventService.appendEvent({
          transactionId: tx.id,
          eventType: 'FAILED',
          action: tx.action,
          agreementId: tx.loanId,
          providerKind,
          networkId,
          status: 'FAILED',
          source: 'RECONCILIATION_SERVICE',
          message: 'Transaction execution failed on Midnight Network.',
        });

        this.eventService.appendEvent({
          transactionId: tx.id,
          eventType: 'RECONCILIATION_FAILED',
          action: tx.action,
          agreementId: tx.loanId,
          providerKind,
          networkId,
          status: 'FAILED',
          source: 'RECONCILIATION_SERVICE',
          message: 'Reconciliation concluded: transaction execution failed.',
        });

        return {
          transactionId: tx.id,
          agreementId: tx.loanId,
          localStatus: 'FAILED',
          providerStatus: 'FAILED',
          reconciliationStatus: 'FAILED',
          reason: 'PROVIDER_FAILED',
          registryMutationAllowed: false,
          reconciledAt: now,
          message: 'Transaction execution failed on Midnight Network.',
          success: false,
          previousStatus,
          reconciledStatus: 'FAILED',
          recoveryStatus: 'FAILED',
          providerTransactionId: providerTxId,
          registryUpdated: false,
          error: statusError,
        };
      }

      // 11. Unknown / unrecognized status: map safely to DISCREPANCY / STALE
      this.persistence.updateTransaction(tx.id, {
        recoveryStatus: 'STALE',
        reconciledAt: now,
      });

      this.eventService.appendEvent({
        transactionId: tx.id,
        eventType: 'RECONCILIATION_FAILED',
        action: tx.action,
        agreementId: tx.loanId,
        providerKind,
        networkId,
        status: tx.status,
        source: 'RECONCILIATION_SERVICE',
        message: `Unrecognized provider status received: ${statusResult.status}.`,
      });

      return {
        transactionId: tx.id,
        agreementId: tx.loanId,
        localStatus: previousStatus,
        providerStatus: statusResult.status,
        reconciliationStatus: 'DISCREPANCY',
        reason: 'UNKNOWN_PROVIDER_STATE',
        registryMutationAllowed: false,
        reconciledAt: now,
        message: `Received unrecognized provider status: ${statusResult.status}. Status mapped to STALE.`,
        success: false,
        previousStatus,
        reconciledStatus: tx.status,
        recoveryStatus: 'STALE',
        providerTransactionId: providerTxId,
        registryUpdated: false,
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

      this.eventService.appendEvent({
        transactionId: tx.id,
        eventType: errCode === 'UNSUPPORTED_OPERATION' ? 'UNSUPPORTED' : 'RECONCILIATION_FAILED',
        action: tx.action,
        agreementId: tx.loanId,
        providerKind,
        networkId,
        status: tx.status,
        source: 'RECONCILIATION_SERVICE',
        message: `Provider query failed: ${errMsg}`,
      });

      return {
        transactionId: tx.id,
        agreementId: tx.loanId,
        localStatus: previousStatus,
        reconciliationStatus: errCode === 'UNSUPPORTED_OPERATION' ? 'UNSUPPORTED' : 'FAILED',
        reason: errCode === 'UNSUPPORTED_OPERATION' ? 'PROVIDER_UNSUPPORTED' : 'STATUS_UNAVAILABLE',
        registryMutationAllowed: false,
        reconciledAt: now,
        message: `Provider status query failed: ${errMsg}`,
        success: false,
        previousStatus,
        reconciledStatus: tx.status,
        recoveryStatus: errCode === 'UNSUPPORTED_OPERATION' ? 'UNSUPPORTED' : 'FAILED',
        providerTransactionId: providerTxId,
        registryUpdated: false,
        error: errMsg,
        errorCode: errCode,
      };
    }
  }

  /**
   * Reconciles all recoverable transactions sequentially with the active provider.
   */
  async reconcileAll(
    providerOrRegistry?: WalletProvider | LoanRegistry | ReconcileOptions,
    loanRegistry?: LoanRegistry
  ): Promise<TransactionReconciliationResult[]> {
    let effectiveProvider: WalletProvider;
    let effectiveRegistry: LoanRegistry | undefined = loanRegistry;

    if (providerOrRegistry && typeof (providerOrRegistry as any).getLoans === 'function') {
      effectiveRegistry = providerOrRegistry as LoanRegistry;
      effectiveProvider = getWalletSessionService().getProvider();
    } else if (
      providerOrRegistry &&
      typeof (providerOrRegistry as any).getTransactionStatus === 'undefined' &&
      typeof (providerOrRegistry as any).getProviderName === 'undefined' &&
      typeof (providerOrRegistry as any).isPrototype === 'undefined' &&
      (providerOrRegistry as ReconcileOptions).provider
    ) {
      const opts = providerOrRegistry as ReconcileOptions;
      effectiveProvider = opts.provider ?? getWalletSessionService().getProvider();
      effectiveRegistry = opts.loanRegistry ?? loanRegistry;
    } else {
      effectiveProvider = (providerOrRegistry as WalletProvider) ?? getWalletSessionService().getProvider();
    }

    const all = this.persistence.listTransactions();
    const recoverable = all.filter((tx) =>
      tx.status === 'SUBMITTED' ||
      tx.status === 'SUBMITTING' ||
      tx.recoveryStatus === 'PENDING' ||
      tx.recoveryStatus === 'RECOVERABLE'
    );

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

let globalReconciliationService: TransactionReconciliationService | null = null;

/**
 * Returns the singleton TransactionReconciliationService instance.
 */
export function getTransactionReconciliationService(
  persistence?: TransactionPersistenceService,
  eventService?: TransactionEventService,
  deploymentService?: ContractDeploymentService
): TransactionReconciliationService {
  if (!globalReconciliationService || persistence || eventService || deploymentService) {
    globalReconciliationService = new TransactionReconciliationService(persistence, eventService, deploymentService);
  }
  return globalReconciliationService;
}

/**
 * Resets and returns the global TransactionReconciliationService instance.
 */
export function resetTransactionReconciliationService(
  persistence?: TransactionPersistenceService,
  eventService?: TransactionEventService,
  deploymentService?: ContractDeploymentService
): TransactionReconciliationService {
  globalReconciliationService = new TransactionReconciliationService(persistence, eventService, deploymentService);
  return globalReconciliationService;
}
