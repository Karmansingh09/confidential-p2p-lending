import type { LoanDetailsModel } from '../types/index.js';
import type { LoanRegistry } from './loan-registry.ts';
import type { WalletProvider } from './wallet-provider.ts';
import {
  WalletSessionService,
  getWalletSessionService,
} from './wallet-session-service.ts';
import {
  ContractDeploymentService,
  getContractDeploymentService,
} from './contract-deployment-service.ts';
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
import type {
  TransactionRequestStatus,
  TransactionSigningStatus,
  TransactionSubmissionStatus,
  TrackedTransactionStatus,
  TransactionRequestErrorCode,
  TransactionRequestParameters,
  TransactionSigningRequest,
  TransactionSigningResult,
  TransactionSubmissionRequest,
  TransactionSubmissionResult,
  TransactionStatusResult,
  TransactionRequest,
  TransactionRequestResult,
} from '../types/transaction-request.ts';
import { TransactionRequestError } from '../types/transaction-request.ts';
import {
  TransactionStatusService,
  getTransactionStatusService,
} from './transaction-status-service.ts';
import {
  TransactionPersistenceService,
  getTransactionPersistenceService,
} from './transaction-persistence-service.ts';
import {
  TransactionEventService,
  getTransactionEventService,
} from './transaction-event-service.ts';
import type { TransactionLifecycleEventType } from '../types/transaction-events.ts';
import type {
  PersistedTransaction,
  TransactionRecoveryStatus,
} from '../types/transaction-persistence.ts';
import type { TransactionPreparation } from '../types/transaction-orchestration.ts';

function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

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
  private persistenceService: TransactionPersistenceService;
  private deploymentService?: ContractDeploymentService;

  constructor(
    sessionService?: WalletSessionService,
    customProvider?: WalletProvider,
    persistenceService?: TransactionPersistenceService,
    deploymentService?: ContractDeploymentService
  ) {
    this.sessionService = sessionService ?? getWalletSessionService();
    this.customProvider = customProvider;
    this.persistenceService = persistenceService ?? getTransactionPersistenceService();
    this.deploymentService = deploymentService;
  }

  getPersistenceService(): TransactionPersistenceService {
    return this.persistenceService;
  }

  setPersistenceService(persistence: TransactionPersistenceService): void {
    this.persistenceService = persistence;
  }

  getDeploymentService(): ContractDeploymentService | undefined {
    return this.deploymentService;
  }

  setDeploymentService(deploymentService: ContractDeploymentService): void {
    this.deploymentService = deploymentService;
  }

  /**
   * Persists the active transaction request to persistent storage.
   */
  persistRequest(
    request: TransactionRequest,
    extra?: Partial<PersistedTransaction>
  ): void {
    const provider = this.getProvider();
    const providerKind = (provider as any).isPrototype ? 'PROTOTYPE' : (provider as any).name ?? 'MIDNIGHT_WALLET';
    const networkId = provider.getReportedNetworkId ? (provider.getReportedNetworkId() ?? 'unknown') : 'unknown';

    let recoveryStatus: TransactionRecoveryStatus = 'RECOVERABLE';
    if (request.status === 'CONFIRMED') recoveryStatus = 'CONFIRMED';
    else if (request.status === 'SUBMITTED' || request.status === 'SUBMITTING') recoveryStatus = 'PENDING';
    else if (request.status === 'REJECTED') recoveryStatus = 'REJECTED';
    else if (request.status === 'FAILED') recoveryStatus = 'FAILED';
    else if (request.status === 'UNSUPPORTED' || request.status === 'BLOCKED') recoveryStatus = 'UNSUPPORTED';

    const persisted: PersistedTransaction = {
      id: request.id,
      action: request.action,
      loanId: request.loanId,
      circuitName: request.circuitName,
      callerPublicKeyHex: request.parameters.callerPublicKeyHex,
      callerPublicKey: request.parameters.callerPublicKey,
      networkId,
      providerKind,
      status: request.status,
      recoveryStatus,
      providerTransactionId: request.submissionResult?.transactionId,
      blockHeight: request.submissionResult?.blockHeight ?? request.statusResult?.blockHeight,
      amount: request.parameters.amount,
      interestRateBps: request.parameters.interestRateBps,
      durationBlocks: request.parameters.durationBlocks,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      error: request.error,
      errorCode: request.errorCode,
      ...extra,
    };

    try {
      this.persistenceService.saveTransaction(persisted);
    } catch {
      // Safe non-blocking persistence
    }

    try {
      let eventType: TransactionLifecycleEventType = 'CREATED';
      switch (request.status) {
        case 'DRAFT':
          eventType = 'CREATED';
          break;
        case 'PREPARING':
        case 'PREPARED':
          eventType = 'PREPARED';
          break;
        case 'SIGNATURE_REQUESTED':
          eventType = 'SIGNING_STARTED';
          break;
        case 'READY_TO_SUBMIT':
        case 'SIGNED':
          eventType = 'SIGNED';
          break;
        case 'SUBMITTING':
          eventType = 'SUBMISSION_STARTED';
          break;
        case 'SUBMITTED':
          eventType = 'SUBMITTED';
          break;
        case 'CONFIRMED':
          eventType = 'CONFIRMED';
          break;
        case 'REJECTED':
          eventType = 'REJECTED';
          break;
        case 'FAILED':
          eventType = 'FAILED';
          break;
        case 'BLOCKED':
          eventType = 'BLOCKED';
          break;
        case 'UNSUPPORTED':
          eventType = 'UNSUPPORTED';
          break;
        default:
          eventType = 'CREATED';
      }

      const eventService = getTransactionEventService();
      eventService.appendEvent({
        transactionId: request.id,
        eventType,
        action: request.action,
        agreementId: request.loanId,
        providerKind,
        networkId,
        status: request.status,
        message: request.error ?? `Transaction transitioned to ${request.status}.`,
        source: 'EXECUTION_SERVICE',
      });
    } catch {
      // Safe non-blocking event logging
    }
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
    action: LifecycleTransactionAction,
    deploymentService?: ContractDeploymentService
  ): TransactionReadinessEvaluation {
    return evaluateTransactionReadiness(
      loan,
      account,
      action,
      this.getProvider(),
      deploymentService ?? this.deploymentService
    );
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
    const netConfig = (options as any)?.networkConfigService
      ? (options as any).networkConfigService.getNetworkConfig()
      : getNetworkConfigService().getNetworkConfig();
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
    // Phase 2.8: Contract Deployment Configuration Evaluation
    // -------------------------------------------------------------------------
    const activeDeploymentService = (options as any)?.deploymentService ?? this.deploymentService;
    if (activeDeploymentService) {
      const deployment = activeDeploymentService.getDeployment();
      if (deployment.status === 'NOT_DEPLOYED' || deployment.status === 'UNCONFIGURED') {
        const result: TransactionExecutionResult = {
          success: false,
          status: 'BLOCKED',
          action,
          circuitName,
          loanId,
          message: 'Transaction blocked: Contract deployment is not configured or not deployed on this network.',
          errorCode: 'NOT_CONFIGURED' as any,
          error: 'Contract deployment not configured.',
          unsupportedReason: 'Contract deployment is unconfigured or not deployed.',
          registryUpdated: false,
          confirmationState: 'NOT_CONFIRMED',
        };
        return { result };
      }
      if (deployment.status === 'INVALID') {
        const result: TransactionExecutionResult = {
          success: false,
          status: 'BLOCKED',
          action,
          circuitName,
          loanId,
          message: 'Transaction blocked: Contract deployment configuration is invalid.',
          errorCode: 'INVALID_CONFIG' as any,
          error: 'Contract deployment configuration invalid.',
          unsupportedReason: 'Contract deployment is invalid.',
          registryUpdated: false,
          confirmationState: 'NOT_CONFIRMED',
        };
        return { result };
      }
      if (deployment.networkId && netConfig.networkId && deployment.networkId !== netConfig.networkId) {
        const result: TransactionExecutionResult = {
          success: false,
          status: 'BLOCKED',
          action,
          circuitName,
          loanId,
          message: `Transaction blocked: Contract network mismatch (${deployment.networkId} !== ${netConfig.networkId}).`,
          errorCode: 'NETWORK_ERROR',
          error: 'CONTRACT_NETWORK_MISMATCH',
          unsupportedReason: `Contract network mismatch (${deployment.networkId} !== ${netConfig.networkId}).`,
          registryUpdated: false,
          confirmationState: 'NOT_CONFIRMED',
        };
        return { result };
      }
      const isExecutingAction = action === 'FUND_LOAN' || action === 'REPAY_LOAN' || action === 'SETTLE_LOAN';
      const isVerifiedOrReady = deployment.isVerified || deployment.status === 'VERIFIED' || deployment.status === 'READY';
      if (isExecutingAction && !isVerifiedOrReady) {
        const result: TransactionExecutionResult = {
          success: false,
          status: 'BLOCKED',
          action,
          circuitName,
          loanId,
          message: 'Transaction blocked: Contract deployment is not verified on this network.',
          errorCode: 'CONTRACT_NOT_VERIFIED' as any,
          error: 'Contract deployment not verified.',
          unsupportedReason: 'Contract deployment verification required before on-chain execution.',
          registryUpdated: false,
          confirmationState: 'NOT_CONFIRMED',
        };
        return { result };
      }
    }

    // -------------------------------------------------------------------------
    // Phase 3: Contract Lifecycle Guards & Capability Preparation
    // -------------------------------------------------------------------------
    const prep = prepareLifecycleTransaction(loan, account, action, provider, activeDeploymentService);

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

    // -------------------------------------------------------------------------
    // Phase 4: Wallet Signing Request (if supported by provider)
    // -------------------------------------------------------------------------
    if (provider.requestSignature && prep.callerPublicKey) {
      const signingReq: TransactionSigningRequest = {
        requestId: `req-${Date.now()}`,
        loanId,
        action,
        circuitName,
        callerPublicKey: prep.callerPublicKey,
        parameters: {
          loanId,
          action,
          circuitName,
          callerPublicKey: prep.callerPublicKey,
          callerPublicKeyHex: prep.callerPublicKeyHex,
          amount: loan.amount,
          interestRateBps: (loan as any).interestRateBps ?? loan.interestRateBasisPoints,
          durationBlocks: loan.durationBlocks,
        },
        createdAt: Date.now(),
      };

      try {
        const signingResult = await provider.requestSignature(signingReq);
        if (!signingResult.success) {
          const result: TransactionExecutionResult = {
            success: false,
            status: signingResult.status === 'REJECTED' ? 'REJECTED' : 'FAILED',
            action,
            circuitName,
            loanId,
            message: signingResult.error ?? 'Transaction signing failed or was rejected.',
            errorCode: signingResult.status === 'REJECTED' ? 'REJECTED_SIGNATURE' : 'PROVIDER_ERROR',
            error: signingResult.error,
            registryUpdated: false,
            confirmationState: 'NOT_CONFIRMED',
          };
          return { result };
        }
      } catch (err: unknown) {
        return this.mapProviderException(err, action, circuitName, loanId);
      }
    }

    const txAction = action === 'FUND_LOAN' ? 'FUND' : action === 'REPAY_LOAN' ? 'REPAY' : 'SETTLE';

    try {
      const txResult = await provider.submitTransaction({
        loanId,
        action: txAction,
        callerPublicKey: prep.callerPublicKey,
      });

      if (txResult.transactionId) {
        const statusService = getTransactionStatusService();
        statusService.trackTransaction(
          txResult.transactionId,
          txResult.status === 'CONFIRMED' ? 'CONFIRMED' : 'SUBMITTED',
          {
            loanId,
            action,
            blockHeight: txResult.blockHeight,
            error: txResult.error,
          }
        );
      }

      // Handle Provider PENDING Submission
      if (txResult.status === 'PENDING') {
        const receipt: TransactionReceipt = {
          transactionId: txResult.transactionId,
          status: 'PENDING',
          blockHeight: txResult.blockHeight,
        };
        const result: TransactionExecutionResult = {
          success: true,
          status: 'PENDING',
          action,
          circuitName,
          loanId,
          message: 'Transaction submitted to Midnight Network. Awaiting on-chain confirmation.',
          receipt,
          transactionId: txResult.transactionId,
          blockHeight: txResult.blockHeight,
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
  async getTransactionStatus(
    transactionId: string
  ): Promise<TransactionReceipt | TransactionStatusResult | null> {
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

  /**
   * Creates an un-executed, standardized TransactionRequest instance in DRAFT status.
   * PRIVACY INVARIANT: Operates strictly on public loan parameters and public account identity.
   */
  createTransactionRequest(
    loan: LoanDetailsModel,
    account: NetworkAccount | WalletAccountIdentity | null,
    action: LifecycleTransactionAction,
    loanId?: string
  ): TransactionRequest {
    const circuitName = getCircuitNameForAction(action);
    const callerPk = account?.publicKey ?? null;
    const callerHex = account?.publicKeyHex ?? (callerPk ? bytesToHex(callerPk) : null);
    const effectiveLoanId = loanId ?? (loan as any).loanId ?? (loan as any).id ?? 'active-loan';
    const id = `tx-req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();

    const parameters: TransactionRequestParameters = {
      loanId: effectiveLoanId,
      action,
      circuitName,
      callerPublicKey: callerPk,
      callerPublicKeyHex: callerHex,
      amount: loan.amount,
      interestRateBps: (loan as any).interestRateBps ?? loan.interestRateBasisPoints,
      durationBlocks: loan.durationBlocks,
    };

    const req: TransactionRequest = {
      id,
      loanId: effectiveLoanId,
      action,
      circuitName,
      status: 'DRAFT',
      parameters,
      createdAt: now,
      updatedAt: now,
    };

    this.persistRequest(req);
    return req;
  }

  /**
   * Stage 2: Read-Only Transaction Preparation & Validation.
   * Validates account context, network compatibility, connector availability,
   * Compact contract guards, and required capabilities without mutating state.
   */
  prepareAndValidate(
    request: TransactionRequest,
    loan: LoanDetailsModel,
    account: NetworkAccount | WalletAccountIdentity | null,
    options?: { deploymentService?: ContractDeploymentService }
  ): {
    isReady: boolean;
    reason?: string;
    errorCode?: TransactionRequestErrorCode;
    prep: TransactionPreparation;
  } {
    request.status = 'PREPARING';
    request.updatedAt = Date.now();

    const provider = this.getProvider();
    const session = this.sessionService.getSession();
    const activeDeploymentService = options?.deploymentService ?? this.deploymentService;

    // 1. Session Connection Check
    if (session.status !== 'CONNECTED' || !session.account) {
      request.status = 'BLOCKED';
      request.error = 'Wallet is disconnected.';
      request.errorCode = 'NOT_CONNECTED';
      request.updatedAt = Date.now();
      const prep = prepareLifecycleTransaction(loan, account as any, request.action, provider, activeDeploymentService);
      this.persistRequest(request);
      return { isReady: false, reason: 'Wallet is disconnected.', errorCode: 'NOT_CONNECTED', prep };
    }

    // 2. Network Config Check
    const netConfig = getNetworkConfigService().getNetworkConfig();
    const isNetworkBlocked =
      netConfig.status !== 'CONFIGURED' ||
      (netConfig.environment !== 'LOCAL' && (!netConfig.nodeRpcEndpoint || !netConfig.nodeRpcEndpoint.url));

    if (isNetworkBlocked) {
      request.status = 'BLOCKED';
      request.error = 'Network configuration required.';
      request.errorCode = 'UNKNOWN_NETWORK';
      request.updatedAt = Date.now();
      const prep = prepareLifecycleTransaction(loan, account as any, request.action, provider, activeDeploymentService);
      this.persistRequest(request);
      return { isReady: false, reason: 'Network configuration required.', errorCode: 'UNKNOWN_NETWORK', prep };
    }

    // 3. Wallet Network Compatibility Check
    if (netConfig.environment !== 'LOCAL') {
      const walletNetwork =
        typeof provider.getReportedNetworkId === 'function' ? provider.getReportedNetworkId() : null;
      const comp = evaluateNetworkCompatibility(netConfig, walletNetwork);
      if (comp.compatibility === 'MISMATCH') {
        request.status = 'BLOCKED';
        request.error = comp.reason;
        request.errorCode = 'NETWORK_MISMATCH';
        request.updatedAt = Date.now();
        const prep = prepareLifecycleTransaction(loan, account as any, request.action, provider, activeDeploymentService);
        this.persistRequest(request);
        return { isReady: false, reason: comp.reason, errorCode: 'NETWORK_MISMATCH', prep };
      }
      if (comp.compatibility === 'UNKNOWN') {
        request.status = 'BLOCKED';
        request.error = comp.reason;
        request.errorCode = 'UNKNOWN_NETWORK';
        request.updatedAt = Date.now();
        const prep = prepareLifecycleTransaction(loan, account as any, request.action, provider, activeDeploymentService);
        this.persistRequest(request);
        return { isReady: false, reason: comp.reason, errorCode: 'UNKNOWN_NETWORK', prep };
      }
    }

    // 3.5. Contract Deployment Configuration Check
    if (activeDeploymentService) {
      const deployment = activeDeploymentService.getDeployment();
      if (deployment.status === 'NOT_DEPLOYED' || deployment.status === 'UNCONFIGURED') {
        request.status = 'BLOCKED';
        request.error = 'Transaction blocked: Contract deployment is not configured or not deployed on this network.';
        request.errorCode = 'NOT_CONFIGURED';
        request.updatedAt = Date.now();
        const prep = prepareLifecycleTransaction(loan, account as any, request.action, provider, activeDeploymentService);
        this.persistRequest(request);
        return {
          isReady: false,
          reason: 'Transaction blocked: Contract deployment is not configured or not deployed on this network.',
          errorCode: 'NOT_CONFIGURED',
          prep,
        };
      }
      if (deployment.status === 'INVALID') {
        request.status = 'BLOCKED';
        request.error = 'Transaction blocked: Contract deployment configuration is invalid.';
        request.errorCode = 'INVALID_CONFIG';
        request.updatedAt = Date.now();
        const prep = prepareLifecycleTransaction(loan, account as any, request.action, provider, activeDeploymentService);
        this.persistRequest(request);
        return {
          isReady: false,
          reason: 'Transaction blocked: Contract deployment configuration is invalid.',
          errorCode: 'INVALID_CONFIG',
          prep,
        };
      }
      if (deployment.networkId && netConfig.networkId && deployment.networkId !== netConfig.networkId) {
        request.status = 'BLOCKED';
        request.error = `Transaction blocked: Contract network mismatch (${deployment.networkId} !== ${netConfig.networkId}).`;
        request.errorCode = 'NETWORK_MISMATCH';
        request.updatedAt = Date.now();
        const prep = prepareLifecycleTransaction(loan, account as any, request.action, provider, activeDeploymentService);
        this.persistRequest(request);
        return {
          isReady: false,
          reason: `Transaction blocked: Contract network mismatch (${deployment.networkId} !== ${netConfig.networkId}).`,
          errorCode: 'NETWORK_MISMATCH',
          prep,
        };
      }
      const isExecuting =
        request.action === 'FUND_LOAN' || request.action === 'REPAY_LOAN' || request.action === 'SETTLE_LOAN';
      const isVerifiedOrReady =
        deployment.isVerified || deployment.status === 'VERIFIED' || deployment.status === 'READY';
      if (isExecuting && !isVerifiedOrReady) {
        request.status = 'BLOCKED';
        request.error = 'Transaction blocked: Contract deployment is not verified on this network.';
        request.errorCode = 'CONTRACT_NOT_VERIFIED' as any;
        request.updatedAt = Date.now();
        const prep = prepareLifecycleTransaction(loan, account as any, request.action, provider, activeDeploymentService);
        this.persistRequest(request);
        return {
          isReady: false,
          reason: 'Transaction blocked: Contract deployment is not verified on this network.',
          errorCode: 'CONTRACT_NOT_VERIFIED' as any,
          prep,
        };
      }
    }

    // 4. Connector Detection Check
    const isConnectorMissing =
      !provider.isPrototype &&
      provider.getDetectionStatus &&
      (provider.getDetectionStatus() === 'NOT_DETECTED' ||
        provider.getDetectionStatus() === 'UNSUPPORTED');

    if (isConnectorMissing) {
      request.status = 'UNSUPPORTED';
      request.error = 'Wallet connector not detected.';
      request.errorCode = 'UNSUPPORTED_PROVIDER';
      request.updatedAt = Date.now();
      const prep = prepareLifecycleTransaction(loan, account as any, request.action, provider, activeDeploymentService);
      this.persistRequest(request);
      return { isReady: false, reason: 'Wallet connector not detected.', errorCode: 'UNSUPPORTED_PROVIDER', prep };
    }

    // 5. Contract Guard and Capability Evaluation
    const prep = prepareLifecycleTransaction(loan, account as any, request.action, provider, activeDeploymentService);

    if (prep.status === 'INVALID') {
      request.status = 'FAILED';
      request.error = prep.authorizationReason ?? 'Invalid agreement parameters.';
      request.errorCode = 'MALFORMED_REQUEST';
      request.updatedAt = Date.now();
      this.persistRequest(request);
      return { isReady: false, reason: prep.authorizationReason, errorCode: 'MALFORMED_REQUEST', prep };
    }

    if (prep.status === 'BLOCKED') {
      request.status = 'BLOCKED';
      request.error = prep.authorizationReason ?? 'Lifecycle transaction rejected by canonical contract guards.';
      request.errorCode = 'GUARD_VALIDATION_FAILED';
      request.updatedAt = Date.now();
      this.persistRequest(request);
      return { isReady: false, reason: prep.authorizationReason, errorCode: 'GUARD_VALIDATION_FAILED', prep };
    }

    if (prep.status === 'UNSUPPORTED') {
      request.status = 'UNSUPPORTED';
      const reason = `Missing required provider capabilities: ${prep.missingCapabilities.join(', ')}`;
      request.error = reason;
      request.errorCode = 'MISSING_CAPABILITY';
      request.updatedAt = Date.now();
      this.persistRequest(request);
      return { isReady: false, reason, errorCode: 'MISSING_CAPABILITY', prep };
    }

    request.status = 'PREPARED';
    request.updatedAt = Date.now();
    this.persistRequest(request);
    return { isReady: true, prep };
  }

  /**
   * Stage 3: Wallet Signing Request.
   * Delegates signing request to the active provider boundary.
   */
  async requestSignature(
    request: TransactionRequest
  ): Promise<TransactionSigningResult> {
    const provider = this.getProvider();
    request.status = 'SIGNATURE_REQUESTED';
    request.updatedAt = Date.now();
    this.persistRequest(request);

    if (!request.parameters.callerPublicKey) {
      const result: TransactionSigningResult = {
        success: false,
        status: 'FAILED',
        error: 'Cannot sign transaction: Missing caller identity.',
        errorCode: 'MALFORMED_REQUEST',
      };
      request.status = 'FAILED';
      request.error = result.error;
      request.errorCode = result.errorCode;
      request.signingResult = result;
      this.persistRequest(request);
      return result;
    }

    if (provider.isPrototype) {
      const result: TransactionSigningResult = {
        success: false,
        status: 'UNSUPPORTED',
        error: 'Wallet signature generation is unavailable in prototype mode.',
        errorCode: 'UNSUPPORTED_OPERATION',
      };
      request.status = 'UNSUPPORTED';
      request.error = result.error;
      request.errorCode = result.errorCode;
      request.signingResult = result;
      this.persistRequest(request);
      return result;
    }

    if (!provider.requestSignature) {
      const result: TransactionSigningResult = {
        success: false,
        status: 'UNSUPPORTED',
        error: 'Active provider does not support signature requests.',
        errorCode: 'UNSUPPORTED_OPERATION',
      };
      request.status = 'UNSUPPORTED';
      request.error = result.error;
      request.errorCode = result.errorCode;
      request.signingResult = result;
      this.persistRequest(request);
      return result;
    }

    const signingReq: TransactionSigningRequest = {
      requestId: request.id,
      loanId: request.loanId,
      action: request.action,
      circuitName: request.circuitName,
      callerPublicKey: request.parameters.callerPublicKey,
      parameters: request.parameters,
      createdAt: Date.now(),
    };
    request.signingRequest = signingReq;

    try {
      const signingResult = await provider.requestSignature(signingReq);
      request.signingResult = signingResult;
      request.updatedAt = Date.now();

      if (signingResult.success) {
        request.status = 'SIGNED';
      } else {
        request.status = signingResult.status === 'REJECTED'
          ? 'REJECTED'
          : signingResult.status === 'UNSUPPORTED'
          ? 'UNSUPPORTED'
          : 'FAILED';
        request.error = signingResult.error;
        request.errorCode = signingResult.errorCode;
      }
      this.persistRequest(request);
      return signingResult;
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      const errCode = (err as any)?.code;

      let status: TransactionSigningStatus = 'FAILED';
      let errorCode: TransactionRequestErrorCode = 'SIGNING_FAILED';

      if (errCode === 'USER_REJECTED' || rawMsg.toLowerCase().includes('reject')) {
        status = 'REJECTED';
        errorCode = 'USER_REJECTED_SIGNATURE';
      } else if (errCode === 'UNSUPPORTED_OPERATION' || rawMsg.toLowerCase().includes('unsupported')) {
        status = 'UNSUPPORTED';
        errorCode = 'UNSUPPORTED_OPERATION';
      }

      const signingResult: TransactionSigningResult = {
        success: false,
        status,
        error: rawMsg,
        errorCode,
      };

      request.status = status;
      request.error = rawMsg;
      request.errorCode = errorCode;
      request.signingResult = signingResult;
      request.updatedAt = Date.now();
      this.persistRequest(request);
      return signingResult;
    }
  }

  /**
   * Stage 4: Network Transaction Submission.
   * Delegates submission to provider boundary and records in TransactionStatusService.
   */
  async submitTransaction(
    request: TransactionRequest,
    signingResult?: TransactionSigningResult
  ): Promise<TransactionSubmissionResult> {
    const provider = this.getProvider();
    request.status = 'SUBMITTING';
    request.updatedAt = Date.now();

    if (!request.parameters.callerPublicKey) {
      const result: TransactionSubmissionResult = {
        success: false,
        status: 'FAILED',
        error: 'Cannot submit transaction: Missing caller identity.',
        errorCode: 'MALFORMED_REQUEST',
      };
      request.status = 'FAILED';
      request.error = result.error;
      request.errorCode = result.errorCode;
      request.submissionResult = result;
      this.persistRequest(request);
      return result;
    }

    if (provider.isPrototype) {
      const result: TransactionSubmissionResult = {
        success: false,
        status: 'UNSUPPORTED',
        error: 'Live transaction submission is unavailable in prototype mode.',
        errorCode: 'UNSUPPORTED_OPERATION',
      };
      request.status = 'UNSUPPORTED';
      request.error = result.error;
      request.errorCode = result.errorCode;
      request.submissionResult = result;
      this.persistRequest(request);
      return result;
    }

    if (!provider.submitTransaction) {
      const result: TransactionSubmissionResult = {
        success: false,
        status: 'UNSUPPORTED',
        error: 'Active provider does not support transaction submission.',
        errorCode: 'UNSUPPORTED_OPERATION',
      };
      request.status = 'UNSUPPORTED';
      request.error = result.error;
      request.errorCode = result.errorCode;
      request.submissionResult = result;
      this.persistRequest(request);
      return result;
    }

    const subReq: TransactionSubmissionRequest = {
      requestId: request.id,
      loanId: request.loanId,
      action: request.action,
      callerPublicKey: request.parameters.callerPublicKey,
      signatureReference: signingResult?.signatureHex,
      createdAt: Date.now(),
    };
    request.submissionRequest = subReq;

    try {
      const txAction = request.action === 'FUND_LOAN' ? 'FUND' : request.action === 'REPAY_LOAN' ? 'REPAY' : 'SETTLE';
      const txResult = await provider.submitTransaction({
        loanId: request.loanId,
        action: txAction,
        callerPublicKey: request.parameters.callerPublicKey,
      });

      let status: TransactionSubmissionStatus = 'SUBMITTED';
      if (txResult.status === 'CONFIRMED' && txResult.success) {
        status = 'CONFIRMED';
      } else if (txResult.status === 'FAILED' || !txResult.success) {
        status = 'FAILED';
      }

      const submissionResult: TransactionSubmissionResult = {
        success: txResult.success,
        status,
        transactionId: txResult.transactionId,
        blockHeight: txResult.blockHeight,
        error: txResult.error,
        submittedAt: Date.now(),
      };

      request.submissionResult = submissionResult;
      request.status = status;
      request.updatedAt = Date.now();

      // Track in TransactionStatusService if transactionId returned
      if (txResult.transactionId) {
        const statusService = getTransactionStatusService();
        const trackedStatus: TrackedTransactionStatus =
          status === 'CONFIRMED' ? 'CONFIRMED' : 'SUBMITTED';
        request.statusResult = statusService.trackTransaction(
          txResult.transactionId,
          trackedStatus,
          {
            loanId: request.loanId,
            action: request.action,
            blockHeight: txResult.blockHeight,
            error: txResult.error,
          }
        );
      }

      this.persistRequest(request);
      return submissionResult;
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      const errCode = (err as any)?.code;

      let status: TransactionSubmissionStatus = 'FAILED';
      let errorCode: TransactionRequestErrorCode = 'SUBMISSION_FAILED';

      if (errCode === 'USER_REJECTED' || rawMsg.toLowerCase().includes('reject')) {
        status = 'REJECTED';
        errorCode = 'USER_REJECTED_SUBMISSION';
      } else if (errCode === 'UNSUPPORTED_OPERATION' || rawMsg.toLowerCase().includes('unsupported')) {
        status = 'UNSUPPORTED';
        errorCode = 'UNSUPPORTED_OPERATION';
      }

      const submissionResult: TransactionSubmissionResult = {
        success: false,
        status,
        error: rawMsg,
        errorCode,
      };

      request.status = status;
      request.error = rawMsg;
      request.errorCode = errorCode;
      request.submissionResult = submissionResult;
      request.updatedAt = Date.now();
      this.persistRequest(request);
      return submissionResult;
    }
  }

  /**
   * Orchestrates the complete 5-stage pipeline for a transaction request.
   * Invariant: LoanRegistry is mutated ONLY when provider confirms the transaction.
   */
  async executePipeline(
    request: TransactionRequest,
    loan: LoanDetailsModel,
    account: NetworkAccount | WalletAccountIdentity | null,
    loanRegistry?: LoanRegistry,
    options?: { deploymentService?: ContractDeploymentService }
  ): Promise<TransactionRequestResult> {
    const { action, circuitName, loanId } = request;

    // Stage 1 & 2: Prepare & Validate
    const prepResult = this.prepareAndValidate(request, loan, account, options);
    if (!prepResult.isReady) {
      request.status = prepResult.prep.status === 'BLOCKED'
        ? 'BLOCKED'
        : prepResult.prep.status === 'UNSUPPORTED'
        ? 'UNSUPPORTED'
        : 'FAILED';
      request.error = prepResult.reason;
      request.errorCode = prepResult.errorCode;
      request.updatedAt = Date.now();
      this.persistRequest(request);

      return {
        success: false,
        status: request.status,
        action,
        circuitName,
        loanId,
        message: prepResult.reason ?? 'Transaction blocked by validation guards.',
        request,
        registryUpdated: false,
        error: prepResult.reason,
        errorCode: prepResult.errorCode,
      };
    }

    // Special case for VERIFY_ELIGIBILITY (off-chain zero-knowledge proof)
    if (action === 'VERIFY_ELIGIBILITY') {
      let registryUpdated = false;
      const callerPk = request.parameters.callerPublicKey;

      if (loanRegistry && callerPk) {
        try {
          loanRegistry.verifyLoanEligibility(loanId, callerPk);
          registryUpdated = true;
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : 'Failed to update registry verification state.';
          request.status = 'FAILED';
          request.error = errMsg;
          request.errorCode = 'CONTRACT_ERROR';
          request.updatedAt = Date.now();
          this.persistRequest(request);
          return {
            success: false,
            status: 'FAILED',
            action,
            circuitName,
            loanId,
            message: errMsg,
            request,
            registryUpdated: false,
            error: errMsg,
            errorCode: 'CONTRACT_ERROR',
          };
        }
      }

      request.status = 'CONFIRMED';
      request.updatedAt = Date.now();
      this.persistRequest(request);
      return {
        success: true,
        status: 'CONFIRMED',
        action,
        circuitName,
        loanId,
        message: 'Borrower eligibility verified in zero-knowledge off-chain.',
        request,
        registryUpdated,
      };
    }

    // Stage 3: Wallet Signing Request
    const signingResult = await this.requestSignature(request);
    if (!signingResult.success) {
      this.persistRequest(request);
      return {
        success: false,
        status: request.status,
        action,
        circuitName,
        loanId,
        message: signingResult.error ?? 'Transaction signing failed or was rejected.',
        request,
        signingResult,
        registryUpdated: false,
        error: signingResult.error,
        errorCode: signingResult.errorCode,
      };
    }

    // Stage 4: Network Transaction Submission
    const submissionResult = await this.submitTransaction(request, signingResult);
    if (!submissionResult.success) {
      this.persistRequest(request);
      return {
        success: false,
        status: request.status,
        action,
        circuitName,
        loanId,
        message: submissionResult.error ?? 'Transaction submission failed.',
        request,
        signingResult,
        submissionResult,
        registryUpdated: false,
        error: submissionResult.error,
        errorCode: submissionResult.errorCode,
      };
    }

    // Stage 5: Status Tracking & Registry Mutation Gateway
    let registryUpdated = false;
    let updatedRegistry: LoanRegistry | undefined;
    if (submissionResult.status === 'CONFIRMED') {
      const callerPk = request.parameters.callerPublicKey;
      if (loanRegistry && callerPk) {
        if (action === 'FUND_LOAN') {
          updatedRegistry = loanRegistry.fundLoan(loanId, callerPk, callerPk);
          registryUpdated = true;
        } else if (action === 'REPAY_LOAN') {
          updatedRegistry = loanRegistry.repayLoan(loanId, callerPk);
          registryUpdated = true;
        } else if (action === 'SETTLE_LOAN') {
          updatedRegistry = loanRegistry.settleLoan(loanId, callerPk);
          registryUpdated = true;
        }
      }
    }

    this.persistRequest(request);
    return {
      success: true,
      status: request.status,
      action,
      circuitName,
      loanId,
      message: submissionResult.status === 'CONFIRMED'
        ? `Transaction confirmed on Midnight Network via ${circuitName}().`
        : 'Transaction submitted to Midnight Network. Awaiting on-chain confirmation.',
      request,
      signingResult,
      submissionResult,
      statusResult: request.statusResult,
      registryUpdated,
      updatedRegistry,
    };
  }
}

let globalExecutionService: TransactionExecutionService | null = null;

/**
 * Returns singleton instance of TransactionExecutionService.
 */
export function getTransactionExecutionService(
  sessionService?: WalletSessionService,
  deploymentService?: ContractDeploymentService
): TransactionExecutionService {
  if (!globalExecutionService || sessionService || deploymentService) {
    globalExecutionService = new TransactionExecutionService(sessionService, undefined, undefined, deploymentService);
  }
  return globalExecutionService;
}

/**
 * Resets the global transaction execution service instance (useful for unit tests).
 */
export function resetTransactionExecutionService(
  sessionService?: WalletSessionService,
  provider?: WalletProvider,
  persistenceService?: TransactionPersistenceService,
  deploymentService?: ContractDeploymentService
): TransactionExecutionService {
  globalExecutionService = new TransactionExecutionService(sessionService, provider, persistenceService, deploymentService);
  return globalExecutionService;
}
