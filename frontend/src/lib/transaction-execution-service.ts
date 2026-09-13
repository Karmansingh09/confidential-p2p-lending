import type { LoanDetailsModel } from '../types/index.js';
import type { LoanRegistry } from './loan-registry.ts';
import type { WalletProvider } from './wallet-provider.ts';
import {
  WalletSessionService,
  getWalletSessionService,
} from './wallet-session-service.ts';
import {
  prepareLifecycleTransaction,
  getCircuitNameForAction,
  evaluateTransactionReadiness,
  type TransactionReadinessEvaluation,
} from './transaction-orchestrator.ts';
import { getNetworkConfigService } from './network-config-service.ts';
import { evaluateNetworkCompatibility } from './wallet-network-compatibility.ts';
import type { LifecycleTransactionAction } from '../types/transaction-orchestration.ts';
import type { NetworkAccount } from '../types/network.ts';
import type { WalletAccountIdentity } from '../types/wallet-adapter.ts';
import type {
  TransactionExecutionRequest,
  TransactionExecutionResult,
  TransactionReceipt,
  TransactionExecutionStatus,
  TransactionExecutionErrorCode,
  ConfirmationState,
} from '../types/transaction-execution.ts';
import { TransactionExecutionError } from '../types/transaction-execution.ts';

/**
 * TransactionExecutionService establishes the real-wallet transaction execution boundary.
 *
 * ARCHITECTURAL PRINCIPLES:
 * 1. Read-Only Preparation Separation: Preparation validates contract guards without side effects.
 * 2. Provider Delegation: Delegates signing and network submission to the active WalletProvider boundary.
 * 3. Anti-Fabrication Invariant: Never fabricates transaction hashes, block heights, or simulated confirmations.
 * 4. Registry Immutability: The central LoanRegistry is NEVER mutated on unconfirmed, pending, blocked, or failed operations.
 * 5. Strict Zero-Knowledge Privacy: Operates exclusively on public agreement terms and caller public identities.
 */
export class TransactionExecutionService {
  private sessionService: WalletSessionService;
  private customProvider?: WalletProvider;

  constructor(sessionService?: WalletSessionService, customProvider?: WalletProvider) {
    this.sessionService = sessionService ?? getWalletSessionService();
    this.customProvider = customProvider;
  }

  /**
   * Resolves the active wallet provider.
   */
  getProvider(): WalletProvider {
    return this.customProvider ?? this.sessionService.getProvider();
  }

  /**
   * Sets or overrides the active provider (useful for testing).
   */
  setProvider(provider: WalletProvider): void {
    this.customProvider = provider;
  }

  /**
   * Evaluates complete transaction readiness pipeline across account, network, connector, and contract guards.
   */
  evaluateReadiness(
    loan: LoanDetailsModel,
    account: NetworkAccount | WalletAccountIdentity | null,
    action: LifecycleTransactionAction
  ): TransactionReadinessEvaluation {
    return evaluateTransactionReadiness(loan, account, action, this.getProvider());
  }

  /**
   * Executes a contract-guarded lifecycle transaction through the provider boundary.
   *
   * @param request Standardized transaction execution request.
   * @param loanRegistry Optional central registry instance to update upon genuine confirmation.
   */
  async executeTransaction(
    request: TransactionExecutionRequest,
    loanRegistry?: LoanRegistry
  ): Promise<{
    result: TransactionExecutionResult;
    updatedRegistry?: LoanRegistry;
  }> {
    const { loan, account, action, loanId, options } = request;
    const circuitName = request.circuitName ?? getCircuitNameForAction(action);
    const provider = this.getProvider();
    const session = this.sessionService.getSession();

    // -------------------------------------------------------------------------
    // Phase 1: Session Readiness Validation
    // -------------------------------------------------------------------------
    if (session.status !== 'CONNECTED' || !session.account) {
      const result: TransactionExecutionResult = {
        success: false,
        status: 'BLOCKED',
        action,
        circuitName,
        loanId,
        message: 'Cannot execute transaction: Wallet session is disconnected. Connect wallet first.',
        errorCode: 'DISCONNECTED_WALLET',
        error: 'Wallet session disconnected.',
        registryUpdated: false,
        confirmationState: 'NOT_CONFIRMED',
      };
      return { result };
    }

    // -------------------------------------------------------------------------
    // Phase 2: Network Configuration Evaluation
    // -------------------------------------------------------------------------
    const netConfig = getNetworkConfigService().getNetworkConfig();
    const isNetworkBlocked =
      netConfig.status !== 'CONFIGURED' ||
      (netConfig.environment !== 'LOCAL' && (!netConfig.nodeRpcEndpoint || !netConfig.nodeRpcEndpoint.url));

    if (isNetworkBlocked) {
      const result: TransactionExecutionResult = {
        success: false,
        status: 'BLOCKED',
        action,
        circuitName,
        loanId,
        message: 'Transaction blocked by network configuration: Real network endpoints are missing or invalid.',
        errorCode: 'NETWORK_ERROR',
        error: 'BLOCKED_NETWORK_CONFIGURATION',
        unsupportedReason: 'Network configuration required.',
        registryUpdated: false,
        confirmationState: 'NOT_CONFIRMED',
      };
      return { result };
    }

    // -------------------------------------------------------------------------
    // Phase 2.5: Wallet Network Compatibility Evaluation
    // -------------------------------------------------------------------------
    if (netConfig.environment !== 'LOCAL') {
      const walletNetwork =
        typeof provider.getReportedNetworkId === 'function' ? provider.getReportedNetworkId() : null;
      const comp = evaluateNetworkCompatibility(netConfig, walletNetwork);
      if (comp.compatibility === 'MISMATCH') {
        const result: TransactionExecutionResult = {
          success: false,
          status: 'BLOCKED',
          action,
          circuitName,
          loanId,
          message: `Transaction blocked by network mismatch: ${comp.reason}`,
          errorCode: 'NETWORK_ERROR',
          error: 'NETWORK_MISMATCH',
          unsupportedReason: comp.reason,
          registryUpdated: false,
          confirmationState: 'NOT_CONFIRMED',
        };
        return { result };
      }
      if (comp.compatibility === 'UNKNOWN') {
        const result: TransactionExecutionResult = {
          success: false,
          status: 'BLOCKED',
          action,
          circuitName,
          loanId,
          message: 'Transaction blocked: Wallet network is unknown and cannot be verified against configuration.',
          errorCode: 'NETWORK_ERROR',
          error: 'UNKNOWN_WALLET_NETWORK',
          unsupportedReason: comp.reason,
          registryUpdated: false,
          confirmationState: 'NOT_CONFIRMED',
        };
        return { result };
      }
    }

    // -------------------------------------------------------------------------
    // Phase 3: Provider Connector Detection Evaluation
    // -------------------------------------------------------------------------
    const isConnectorMissing =
      !provider.isPrototype &&
      provider.getDetectionStatus &&
      (provider.getDetectionStatus() === 'NOT_DETECTED' ||
        provider.getDetectionStatus() === 'UNSUPPORTED');

    if (isConnectorMissing) {
      const result: TransactionExecutionResult = {
        success: false,
        status: 'UNSUPPORTED',
        action,
        circuitName,
        loanId,
        message: 'Wallet connector is not detected or unsupported in this environment.',
        errorCode: 'UNSUPPORTED_PROVIDER',
        error: 'Wallet connector not detected.',
        registryUpdated: false,
        confirmationState: 'NOT_CONFIRMED',
      };
      return { result };
    }

    // -------------------------------------------------------------------------
    // Phase 3: Contract Lifecycle Guards & Capability Preparation
    // -------------------------------------------------------------------------
    const prep = prepareLifecycleTransaction(loan, account, action, provider);

    if (prep.status === 'INVALID') {
      const result: TransactionExecutionResult = {
        success: false,
        status: 'FAILED',
        action,
        circuitName,
        loanId,
        message: prep.authorizationReason ?? 'Invalid loan agreement parameters.',
        errorCode: 'MALFORMED_REQUEST',
        error: prep.authorizationReason,
        registryUpdated: false,
        confirmationState: 'NOT_CONFIRMED',
      };
      return { result };
    }

    if (prep.status === 'BLOCKED') {
      const result: TransactionExecutionResult = {
        success: false,
        status: 'REJECTED',
        action,
        circuitName,
        loanId,
        message:
          prep.authorizationReason ??
          'Lifecycle transaction rejected by canonical contract guards.',
        errorCode: 'GUARD_VALIDATION_FAILED',
        error: prep.authorizationReason,
        registryUpdated: false,
        confirmationState: 'NOT_CONFIRMED',
      };
      return { result };
    }

    if (prep.status === 'UNSUPPORTED') {
      const message = provider.isPrototype
        ? 'Live transaction submission is unavailable in prototype mode.'
        : 'Wallet detected, but this transaction capability is not available through the current adapter.';
      const unsupportedReason = `Missing required provider capabilities: ${prep.missingCapabilities.join(', ')}`;
      const result: TransactionExecutionResult = {
        success: false,
        status: 'UNSUPPORTED',
        action,
        circuitName,
        loanId,
        message,
        unsupportedReason,
        errorCode: 'UNSUPPORTED_CAPABILITY',
        registryUpdated: false,
        confirmationState: 'NOT_CONFIRMED',
      };
      return { result };
    }

    // -------------------------------------------------------------------------
    // Phase 4: Action-Specific Execution & Provider Delegation
    // -------------------------------------------------------------------------

    // Case A: VERIFY_ELIGIBILITY (Off-chain zero-knowledge proof execution)
    if (action === 'VERIFY_ELIGIBILITY') {
      if (options?.localProofExecutor) {
        try {
          await options.localProofExecutor();
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : 'Off-chain zero-knowledge proof execution failed.';
          const result: TransactionExecutionResult = {
            success: false,
            status: 'FAILED',
            action,
            circuitName,
            loanId,
            message: errMsg,
            errorCode: 'CONTRACT_ERROR',
            error: errMsg,
            registryUpdated: false,
            confirmationState: 'NOT_CONFIRMED',
          };
          return { result };
        }
      }

      let updatedRegistry: LoanRegistry | undefined;
      let registryUpdated = false;

      if (loanRegistry && !options?.skipRegistryUpdate && prep.callerPublicKey) {
        try {
          updatedRegistry = loanRegistry.verifyLoanEligibility(loanId, prep.callerPublicKey);
          registryUpdated = true;
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : 'Failed to update registry verification state.';
          const result: TransactionExecutionResult = {
            success: false,
            status: 'FAILED',
            action,
            circuitName,
            loanId,
            message: errMsg,
            errorCode: 'CONTRACT_ERROR',
            error: errMsg,
            registryUpdated: false,
            confirmationState: 'NOT_CONFIRMED',
          };
          return { result };
        }
      }

      const result: TransactionExecutionResult = {
        success: true,
        status: 'CONFIRMED',
        action,
        circuitName,
        loanId,
        message: 'Borrower eligibility verified in zero-knowledge off-chain.',
        receipt: {
          status: 'CONFIRMED',
          confirmedAt: Date.now(),
        },
        registryUpdated,
        confirmationState: 'CONFIRMED',
      };

      return { result, updatedRegistry };
    }

    // Case B: On-chain transactions (FUND_LOAN, REPAY_LOAN, SETTLE_LOAN)
    // Local prototype provider: Honest limitation disclosure without fake hashes
    if (provider.isPrototype) {
      const result: TransactionExecutionResult = {
        success: false,
        status: 'UNSUPPORTED',
        action,
        circuitName,
        loanId,
        message: 'Live transaction submission is unavailable in prototype mode.',
        unsupportedReason: 'Prototype provider does not connect to live network RPC or wallet signing extension.',
        errorCode: 'UNSUPPORTED_CAPABILITY',
        registryUpdated: false,
        confirmationState: 'NOT_CONFIRMED',
      };
      return { result };
    }

    // Delegation to live adapter provider
    if (!provider.submitTransaction || !prep.callerPublicKey) {
      const result: TransactionExecutionResult = {
        success: false,
        status: 'UNSUPPORTED',
        action,
        circuitName,
        loanId,
        message: 'Active wallet provider does not support transaction submission.',
        errorCode: 'UNSUPPORTED_CAPABILITY',
        registryUpdated: false,
        confirmationState: 'NOT_CONFIRMED',
      };
      return { result };
    }

    const txAction = action === 'FUND_LOAN' ? 'FUND' : action === 'REPAY_LOAN' ? 'REPAY' : 'SETTLE';

    try {
      const txResult = await provider.submitTransaction({
        loanId,
        action: txAction,
        callerPublicKey: prep.callerPublicKey,
      });

      // Handle Provider PENDING Submission
      if (txResult.status === 'PENDING') {
        const receipt: TransactionReceipt = {
          transactionId: txResult.transactionId,
          status: 'PENDING',
        };
        const result: TransactionExecutionResult = {
          success: true,
          status: 'PENDING',
          action,
          circuitName,
          loanId,
          message: 'Transaction submitted to Midnight Network. Awaiting on-chain confirmation.',
          receipt,
          registryUpdated: false,
          confirmationState: 'UNCONFIRMED_PRESERVED',
        };
        return { result };
      }

      // Handle Provider CONFIRMED Submission
      if (txResult.status === 'CONFIRMED' && txResult.success) {
        let updatedRegistry: LoanRegistry | undefined;
        let registryUpdated = false;

        if (loanRegistry && !options?.skipRegistryUpdate) {
          if (action === 'FUND_LOAN') {
            updatedRegistry = loanRegistry.fundLoan(loanId, prep.callerPublicKey, prep.callerPublicKey);
            registryUpdated = true;
          } else if (action === 'REPAY_LOAN') {
            updatedRegistry = loanRegistry.repayLoan(loanId, prep.callerPublicKey);
            registryUpdated = true;
          } else if (action === 'SETTLE_LOAN') {
            updatedRegistry = loanRegistry.settleLoan(loanId, prep.callerPublicKey);
            registryUpdated = true;
          }
        }

        const receipt: TransactionReceipt = {
          transactionId: txResult.transactionId,
          blockHeight: txResult.blockHeight,
          status: 'CONFIRMED',
          confirmedAt: Date.now(),
        };

        const result: TransactionExecutionResult = {
          success: true,
          status: 'CONFIRMED',
          action,
          circuitName,
          loanId,
          message: `Transaction confirmed on Midnight Network via ${circuitName}().`,
          receipt,
          registryUpdated,
          confirmationState: 'CONFIRMED',
        };

        return { result, updatedRegistry };
      }

      // Handle Provider FAILED Submission
      const result: TransactionExecutionResult = {
        success: false,
        status: 'FAILED',
        action,
        circuitName,
        loanId,
        message: txResult.error ?? 'Transaction submission failed on provider boundary.',
        errorCode: 'PROVIDER_ERROR',
        error: txResult.error,
        registryUpdated: false,
        confirmationState: 'NOT_CONFIRMED',
      };
      return { result };
    } catch (err: unknown) {
      return this.mapProviderException(err, action, circuitName, loanId);
    }
  }

  /**
   * Queries transaction status via provider if supported.
   */
  async getTransactionStatus(transactionId: string): Promise<TransactionReceipt | null> {
    const provider = this.getProvider();
    if (provider.getTransactionStatus) {
      return provider.getTransactionStatus(transactionId);
    }
    return null;
  }

  /**
   * Awaits on-chain transaction confirmation if supported by provider.
   */
  async waitForConfirmation(transactionId: string, timeoutMs?: number): Promise<TransactionReceipt> {
    const provider = this.getProvider();
    if (provider.waitForConfirmation) {
      return provider.waitForConfirmation(transactionId, timeoutMs);
    }
    throw new TransactionExecutionError(
      'UNSUPPORTED_CAPABILITY',
      'Confirmation polling is not supported by active provider.'
    );
  }

  /**
   * Maps raw exceptions into typed, sanitized execution results.
   */
  private mapProviderException(
    err: unknown,
    action: TransactionExecutionRequest['action'],
    circuitName: string,
    loanId: string
  ): { result: TransactionExecutionResult } {
    const rawMsg = err instanceof Error ? err.message : String(err);
    const errCode = (err as any)?.code;

    // 1. User rejection
    if (errCode === 'USER_REJECTED' || rawMsg.toLowerCase().includes('reject')) {
      const result: TransactionExecutionResult = {
        success: false,
        status: 'REJECTED',
        action,
        circuitName,
        loanId,
        message: rawMsg || 'Transaction signing rejected by user.',
        errorCode: 'REJECTED_SIGNATURE',
        error: rawMsg,
        registryUpdated: false,
        confirmationState: 'NOT_CONFIRMED',
      };
      return { result };
    }

    // 2. Unsupported capability / operation
    if (
      errCode === 'UNSUPPORTED_OPERATION' ||
      rawMsg.toLowerCase().includes('unavailable') ||
      rawMsg.toLowerCase().includes('unsupported')
    ) {
      const result: TransactionExecutionResult = {
        success: false,
        status: 'UNSUPPORTED',
        action,
        circuitName,
        loanId,
        message: 'Wallet detected, but this transaction capability is not available through the current adapter.',
        unsupportedReason: rawMsg,
        errorCode: 'UNSUPPORTED_CAPABILITY',
        registryUpdated: false,
        confirmationState: 'NOT_CONFIRMED',
      };
      return { result };
    }

    // 3. Network or connection failure
    if (
      errCode === 'CONNECTION_FAILED' ||
      rawMsg.toLowerCase().includes('network') ||
      rawMsg.toLowerCase().includes('rpc') ||
      rawMsg.toLowerCase().includes('endpoint')
    ) {
      const result: TransactionExecutionResult = {
        success: false,
        status: 'FAILED',
        action,
        circuitName,
        loanId,
        message: rawMsg || 'Network communication failure during transaction submission.',
        errorCode: 'NETWORK_ERROR',
        error: rawMsg,
        registryUpdated: false,
        confirmationState: 'NOT_CONFIRMED',
      };
      return { result };
    }

    // 4. Default provider error
    const result: TransactionExecutionResult = {
      success: false,
      status: 'FAILED',
      action,
      circuitName,
      loanId,
      message: rawMsg || 'Transaction execution failed.',
      errorCode: 'PROVIDER_ERROR',
      error: rawMsg,
      registryUpdated: false,
      confirmationState: 'NOT_CONFIRMED',
    };
    return { result };
  }
}

let globalExecutionService: TransactionExecutionService | null = null;

/**
 * Returns singleton instance of TransactionExecutionService.
 */
export function getTransactionExecutionService(
  sessionService?: WalletSessionService
): TransactionExecutionService {
  if (!globalExecutionService || sessionService) {
    globalExecutionService = new TransactionExecutionService(sessionService);
  }
  return globalExecutionService;
}

/**
 * Resets the global transaction execution service instance (useful for unit tests).
 */
export function resetTransactionExecutionService(
  sessionService?: WalletSessionService,
  provider?: WalletProvider
): TransactionExecutionService {
  globalExecutionService = new TransactionExecutionService(sessionService, provider);
  return globalExecutionService;
}
