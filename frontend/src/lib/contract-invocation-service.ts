import type { LoanRegistry } from './loan-registry.ts';
import type { WalletProvider } from './wallet-provider.ts';
import {
  ContractInvocationError,
  type ContractInvocationRequest,
  type ContractInvocationPreparation,
  type ContractInvocationResult,
  type ContractInvocationStatus,
  type ContractInvocationErrorCode,
} from '../types/contract-invocation.ts';
import type { LifecycleTransactionAction } from '../types/transaction-orchestration.ts';
import {
  getCircuitDefinition,
  resolveCircuitNameForAction,
  isKnownCircuit,
} from './contract-manifest.ts';
import {
  ContractDeploymentService,
  getContractDeploymentService,
} from './contract-deployment-service.ts';
import {
  NetworkConfigService,
  getNetworkConfigService,
  setNetworkConfig,
} from './network-config-service.ts';
import {
  WalletSessionService,
  getWalletSessionService,
} from './wallet-session-service.ts';
import {
  TransactionExecutionService,
  getTransactionExecutionService,
} from './transaction-execution-service.ts';
import { evaluateNetworkCompatibility } from './wallet-network-compatibility.ts';

export interface ContractInvocationDispatchOptions {
  loanRegistry?: LoanRegistry;
  localProofExecutor?: () => Promise<void>;
  skipRegistryUpdate?: boolean;
}

/**
 * Service orchestrating the real contract circuit invocation boundary.
 *
 * CRITICAL ARCHITECTURAL INVARIANTS:
 * 1. CANONICAL MANIFEST GATING:
 *    Every invocation must map to one of the 6 canonical circuits in contracts/src/index.compact.
 * 2. ON-CHAIN DEPLOYMENT VERIFICATION GATING:
 *    Transaction-executing circuits require configured contract and verified on-chain deployment.
 * 3. STRICT ANTI-FABRICATION:
 *    Never fabricates transaction hashes, block heights, or ledger confirmations.
 *    No synthetic 'CONFIRMED' status in the invocation layer; finality belongs to the provider.
 * 4. LOAN REGISTRY IMMUTABILITY:
 *    LoanRegistry is NEVER mutated prior to genuine provider confirmation.
 * 5. STRICT ZERO-KNOWLEDGE PRIVACY:
 *    Operates purely on public parameters and public identity keys; zero private metrics handled.
 */
export class ContractInvocationService {
  private deploymentService: ContractDeploymentService;
  private networkConfigService: NetworkConfigService;
  private sessionService: WalletSessionService;
  private executionService: TransactionExecutionService;
  private customProvider?: WalletProvider;

  constructor(
    deploymentService?: ContractDeploymentService,
    networkConfigService?: NetworkConfigService,
    sessionService?: WalletSessionService,
    executionService?: TransactionExecutionService,
    customProvider?: WalletProvider
  ) {
    this.deploymentService = deploymentService ?? getContractDeploymentService();
    this.networkConfigService = networkConfigService ?? getNetworkConfigService();
    this.sessionService = sessionService ?? getWalletSessionService();
    this.executionService = executionService ?? getTransactionExecutionService();
    this.customProvider = customProvider;
  }

  getDeploymentService(): ContractDeploymentService {
    return this.deploymentService;
  }

  setDeploymentService(service: ContractDeploymentService): void {
    this.deploymentService = service;
  }

  getNetworkConfigService(): NetworkConfigService {
    return this.networkConfigService;
  }

  setNetworkConfigService(service: NetworkConfigService): void {
    this.networkConfigService = service;
  }

  getSessionService(): WalletSessionService {
    return this.sessionService;
  }

  setSessionService(service: WalletSessionService): void {
    this.sessionService = service;
  }

  getExecutionService(): TransactionExecutionService {
    return this.executionService;
  }

  setExecutionService(service: TransactionExecutionService): void {
    this.executionService = service;
  }

  getProvider(): WalletProvider {
    return this.customProvider ?? this.sessionService.getProvider();
  }

  setProvider(provider: WalletProvider): void {
    this.customProvider = provider;
  }

  /**
   * Evaluates the complete readiness pipeline for invoking a contract circuit.
   */
  prepareInvocation(request: ContractInvocationRequest): ContractInvocationPreparation {
    // 1. Resolve circuit from action or explicit name
    let circuitName = request.circuitName;
    let action = request.action;

    if (!circuitName && action) {
      try {
        circuitName = resolveCircuitNameForAction(action);
      } catch {
        // Unmapped action
      }
    }

    if (!circuitName || !isKnownCircuit(circuitName)) {
      return {
        isReady: false,
        status: 'FAILED',
        circuitName: circuitName ?? 'UNKNOWN',
        action,
        classification: 'WRITE',
        requiresWallet: true,
        requiresProof: false,
        requiresSignature: false,
        requiresSubmission: false,
        isReadOnly: false,
        contractAddress: null,
        networkId: null,
        isContractConfigured: false,
        isContractVerified: false,
        isNetworkMatched: false,
        isWalletConnected: false,
        hasSigningCapability: false,
        hasSubmissionCapability: false,
        errorCode: 'CIRCUIT_UNAVAILABLE',
        message: `Circuit "${circuitName ?? 'UNKNOWN'}" is not defined in the canonical contract manifest.`,
      };
    }

    const circuitDef = getCircuitDefinition(circuitName)!;
    action = action ?? circuitDef.action;

    const isReadOnly = circuitDef.isReadOnly ?? circuitDef.classification === 'STATE_READ';
    const isLocalProof = circuitDef.classification === 'LOCAL_PROOF';
    const isTxExecution = circuitDef.classification === 'TRANSACTION_EXECUTION';

    // 2. Validate agreement parameters if provided
    if (request.loan) {
      const loan = request.loan as any;
      if (typeof loan.amount === 'bigint' && loan.amount <= 0n) {
        return {
          isReady: false,
          status: 'FAILED',
          circuitName,
          action,
          classification: circuitDef.classification,
          requiresWallet: circuitDef.requiresWallet,
          requiresProof: circuitDef.requiresProof,
          requiresSignature: circuitDef.requiresSignature,
          requiresSubmission: circuitDef.requiresSubmission,
          isReadOnly,
          contractAddress: null,
          networkId: null,
          isContractConfigured: false,
          isContractVerified: false,
          isNetworkMatched: false,
          isWalletConnected: false,
          hasSigningCapability: false,
          hasSubmissionCapability: false,
          errorCode: 'INVALID_PARAMS',
          message: 'Invalid agreement parameters: amount must be positive.',
        };
      }
    }

    if (request.parameters?.amount !== undefined) {
      const amt = request.parameters.amount;
      if ((typeof amt === 'bigint' && amt <= 0n) || (typeof amt === 'number' && amt <= 0)) {
        return {
          isReady: false,
          status: 'FAILED',
          circuitName,
          action,
          classification: circuitDef.classification,
          requiresWallet: circuitDef.requiresWallet,
          requiresProof: circuitDef.requiresProof,
          requiresSignature: circuitDef.requiresSignature,
          requiresSubmission: circuitDef.requiresSubmission,
          isReadOnly,
          contractAddress: null,
          networkId: null,
          isContractConfigured: false,
          isContractVerified: false,
          isNetworkMatched: false,
          isWalletConnected: false,
          hasSigningCapability: false,
          hasSubmissionCapability: false,
          errorCode: 'INVALID_PARAMS',
          message: 'Invalid invocation parameters: amount must be positive.',
        };
      }
    }

    // 3. Contract Deployment Evaluation
    const deployment = this.deploymentService.getDeployment();
    const isContractConfigured =
      Boolean(deployment.contractAddress) &&
      deployment.status !== 'NOT_DEPLOYED' &&
      deployment.status !== 'UNCONFIGURED' &&
      deployment.status !== 'INVALID';

    const isContractVerified =
      deployment.isVerified ||
      deployment.status === 'VERIFIED' ||
      deployment.status === 'READY';

    // 4. Network Configuration & Matching
    const netConfig = this.networkConfigService.getNetworkConfig();
    const activeNetworkId = netConfig.networkId ?? (netConfig.environment === 'LOCAL' ? 'midnight-prototype-local' : null);
    const provider = this.getProvider();
    const walletNetworkId = typeof provider.getReportedNetworkId === 'function' ? provider.getReportedNetworkId() : null;

    let isNetworkMatched = true;
    if (deployment.networkId && activeNetworkId && deployment.networkId !== activeNetworkId) {
      isNetworkMatched = false;
    }
    if (netConfig.environment !== 'LOCAL' && walletNetworkId) {
      const comp = evaluateNetworkCompatibility(netConfig, walletNetworkId);
      if (comp.compatibility === 'MISMATCH') {
        isNetworkMatched = false;
      }
    }

    // 5. Wallet Session & Identity Evaluation
    const session = this.sessionService.getSession();
    const isWalletConnected = session.status === 'CONNECTED' && Boolean(session.account);

    const callerPublicKey =
      request.callerPublicKey !== undefined
        ? request.callerPublicKey
        : (session.account ? session.account.publicKey : undefined);

    const callerPublicKeyHex =
      request.callerPublicKeyHex !== undefined
        ? request.callerPublicKeyHex
        : (session.account?.publicKeyHex ?? undefined);

    // 6. Provider Capabilities
    const caps = provider.getCapabilities();
    const hasSigningCapability = Boolean(caps.SIGN_TRANSACTION);
    const hasSubmissionCapability = Boolean(caps.SUBMIT_TRANSACTION);

    // Gating for Read-Only circuits
    if (isReadOnly) {
      return {
        isReady: true,
        status: 'READY',
        circuitName,
        action,
        classification: circuitDef.classification,
        requiresWallet: circuitDef.requiresWallet,
        requiresProof: circuitDef.requiresProof,
        requiresSignature: circuitDef.requiresSignature,
        requiresSubmission: circuitDef.requiresSubmission,
        isReadOnly: true,
        contractAddress: deployment.contractAddress,
        networkId: deployment.networkId,
        isContractConfigured,
        isContractVerified,
        isNetworkMatched,
        isWalletConnected,
        hasSigningCapability,
        hasSubmissionCapability,
        callerPublicKey,
        callerPublicKeyHex,
        message: `Read inspection circuit "${circuitName}" is ready for evaluation.`,
      };
    }

    // Gating for Contract Deployment (Local Proof & Transaction Execution)
    if (!isContractConfigured) {
      const code: ContractInvocationErrorCode =
        deployment.status === 'NOT_DEPLOYED' ? 'CONTRACT_NOT_DEPLOYED' : 'CONTRACT_NOT_CONFIGURED';
      return {
        isReady: false,
        status: 'BLOCKED',
        circuitName,
        action,
        classification: circuitDef.classification,
        requiresWallet: circuitDef.requiresWallet,
        requiresProof: circuitDef.requiresProof,
        requiresSignature: circuitDef.requiresSignature,
        requiresSubmission: circuitDef.requiresSubmission,
        isReadOnly: false,
        contractAddress: deployment.contractAddress,
        networkId: deployment.networkId,
        isContractConfigured: false,
        isContractVerified: false,
        isNetworkMatched,
        isWalletConnected,
        hasSigningCapability,
        hasSubmissionCapability,
        callerPublicKey,
        callerPublicKeyHex,
        errorCode: code,
        message: 'Contract is not configured or not deployed on this network.',
      };
    }

    // 4. Contract / Network Configuration Compatibility Check
    const isContractNetworkMatched =
      !deployment.networkId || !activeNetworkId || deployment.networkId === activeNetworkId;
    if (!isContractNetworkMatched) {
      return {
        isReady: false,
        status: 'BLOCKED',
        circuitName,
        action,
        classification: circuitDef.classification,
        requiresWallet: circuitDef.requiresWallet,
        requiresProof: circuitDef.requiresProof,
        requiresSignature: circuitDef.requiresSignature,
        requiresSubmission: circuitDef.requiresSubmission,
        isReadOnly: false,
        contractAddress: deployment.contractAddress,
        networkId: deployment.networkId,
        isContractConfigured,
        isContractVerified,
        isNetworkMatched: false,
        isWalletConnected,
        hasSigningCapability,
        hasSubmissionCapability,
        callerPublicKey,
        callerPublicKeyHex,
        errorCode: 'NETWORK_MISMATCH',
        message: `Network mismatch between contract (${deployment.networkId}) and active network (${activeNetworkId}).`,
      };
    }

    // 5. Gating for Transaction Execution circuits: Must be verified on-chain
    if (isTxExecution && !isContractVerified) {
      return {
        isReady: false,
        status: 'BLOCKED',
        circuitName,
        action,
        classification: circuitDef.classification,
        requiresWallet: circuitDef.requiresWallet,
        requiresProof: circuitDef.requiresProof,
        requiresSignature: circuitDef.requiresSignature,
        requiresSubmission: circuitDef.requiresSubmission,
        isReadOnly: false,
        contractAddress: deployment.contractAddress,
        networkId: deployment.networkId,
        isContractConfigured,
        isContractVerified: false,
        isNetworkMatched: true,
        isWalletConnected,
        hasSigningCapability,
        hasSubmissionCapability,
        callerPublicKey,
        callerPublicKeyHex,
        errorCode: 'CONTRACT_NOT_VERIFIED',
        message: 'Contract deployment is not verified on-chain. Live execution blocked.',
      };
    }

    // 6. Gating for Wallet Connection
    if (circuitDef.requiresWallet && !isWalletConnected) {
      return {
        isReady: false,
        status: 'BLOCKED',
        circuitName,
        action,
        classification: circuitDef.classification,
        requiresWallet: true,
        requiresProof: circuitDef.requiresProof,
        requiresSignature: circuitDef.requiresSignature,
        requiresSubmission: circuitDef.requiresSubmission,
        isReadOnly: false,
        contractAddress: deployment.contractAddress,
        networkId: deployment.networkId,
        isContractConfigured,
        isContractVerified,
        isNetworkMatched: true,
        isWalletConnected: false,
        hasSigningCapability,
        hasSubmissionCapability,
        callerPublicKey,
        callerPublicKeyHex,
        errorCode: 'WALLET_DISCONNECTED',
        message: 'Wallet is disconnected. Active connected wallet required.',
      };
    }

    // 7. Gating for Caller Identity
    if (circuitDef.requiresWallet && !callerPublicKey) {
      return {
        isReady: false,
        status: 'BLOCKED',
        circuitName,
        action,
        classification: circuitDef.classification,
        requiresWallet: true,
        requiresProof: circuitDef.requiresProof,
        requiresSignature: circuitDef.requiresSignature,
        requiresSubmission: circuitDef.requiresSubmission,
        isReadOnly: false,
        contractAddress: deployment.contractAddress,
        networkId: deployment.networkId,
        isContractConfigured,
        isContractVerified,
        isNetworkMatched: true,
        isWalletConnected: true,
        hasSigningCapability,
        hasSubmissionCapability,
        errorCode: 'WALLET_IDENTITY_UNAVAILABLE',
        message: 'Caller public key identity is unavailable.',
      };
    }

    // 8. Gating for Wallet Network Compatibility (when wallet is connected)
    if (isWalletConnected && netConfig.environment !== 'LOCAL' && walletNetworkId) {
      const comp = evaluateNetworkCompatibility(netConfig, walletNetworkId);
      if (comp.compatibility === 'MISMATCH') {
        return {
          isReady: false,
          status: 'BLOCKED',
          circuitName,
          action,
          classification: circuitDef.classification,
          requiresWallet: circuitDef.requiresWallet,
          requiresProof: circuitDef.requiresProof,
          requiresSignature: circuitDef.requiresSignature,
          requiresSubmission: circuitDef.requiresSubmission,
          isReadOnly: false,
          contractAddress: deployment.contractAddress,
          networkId: deployment.networkId,
          isContractConfigured,
          isContractVerified,
          isNetworkMatched: false,
          isWalletConnected: true,
          hasSigningCapability,
          hasSubmissionCapability,
          callerPublicKey,
          callerPublicKeyHex,
          errorCode: 'NETWORK_MISMATCH',
          message: `Wallet reported network (${walletNetworkId}) does not match active network (${activeNetworkId}).`,
        };
      }
    }

    // Prototype Mode Limitation for Transaction Circuits
    if (provider.isPrototype && circuitDef.requiresSubmission) {
      return {
        isReady: false,
        status: 'UNSUPPORTED',
        circuitName,
        action,
        classification: circuitDef.classification,
        requiresWallet: circuitDef.requiresWallet,
        requiresProof: circuitDef.requiresProof,
        requiresSignature: circuitDef.requiresSignature,
        requiresSubmission: circuitDef.requiresSubmission,
        isReadOnly: false,
        contractAddress: deployment.contractAddress,
        networkId: deployment.networkId,
        isContractConfigured,
        isContractVerified,
        isNetworkMatched,
        isWalletConnected,
        hasSigningCapability,
        hasSubmissionCapability,
        callerPublicKey,
        callerPublicKeyHex,
        errorCode: 'UNSUPPORTED_OPERATION',
        message: `Live transaction submission for circuit "${circuitName}" is unavailable in prototype mode.`,
      };
    }

    // Gating for Signing Capability
    if (circuitDef.requiresSignature && !hasSigningCapability) {
      return {
        isReady: false,
        status: 'UNSUPPORTED',
        circuitName,
        action,
        classification: circuitDef.classification,
        requiresWallet: circuitDef.requiresWallet,
        requiresProof: circuitDef.requiresProof,
        requiresSignature: true,
        requiresSubmission: circuitDef.requiresSubmission,
        isReadOnly: false,
        contractAddress: deployment.contractAddress,
        networkId: deployment.networkId,
        isContractConfigured,
        isContractVerified,
        isNetworkMatched,
        isWalletConnected,
        hasSigningCapability: false,
        hasSubmissionCapability,
        callerPublicKey,
        callerPublicKeyHex,
        errorCode: 'SIGNING_UNAVAILABLE',
        message: 'Active provider does not support transaction signing.',
      };
    }

    // Gating for Submission Capability
    if (circuitDef.requiresSubmission && !hasSubmissionCapability) {
      return {
        isReady: false,
        status: 'UNSUPPORTED',
        circuitName,
        action,
        classification: circuitDef.classification,
        requiresWallet: circuitDef.requiresWallet,
        requiresProof: circuitDef.requiresProof,
        requiresSignature: circuitDef.requiresSignature,
        requiresSubmission: true,
        isReadOnly: false,
        contractAddress: deployment.contractAddress,
        networkId: deployment.networkId,
        isContractConfigured,
        isContractVerified,
        isNetworkMatched,
        isWalletConnected,
        hasSigningCapability,
        hasSubmissionCapability: false,
        callerPublicKey,
        callerPublicKeyHex,
        errorCode: 'SUBMISSION_UNAVAILABLE',
        message: 'Active provider does not support transaction submission.',
      };
    }

    // All conditions satisfied
    return {
      isReady: true,
      status: 'READY',
      circuitName,
      action,
      classification: circuitDef.classification,
      requiresWallet: circuitDef.requiresWallet,
      requiresProof: circuitDef.requiresProof,
      requiresSignature: circuitDef.requiresSignature,
      requiresSubmission: circuitDef.requiresSubmission,
      isReadOnly: false,
      contractAddress: deployment.contractAddress,
      networkId: deployment.networkId,
      isContractConfigured,
      isContractVerified,
      isNetworkMatched: true,
      isWalletConnected: true,
      hasSigningCapability,
      hasSubmissionCapability,
      callerPublicKey,
      callerPublicKeyHex,
      message: `Circuit "${circuitName}" is ready for invocation.`,
    };
  }

  /**
   * Asserts readiness, throwing ContractInvocationError if unready.
   */
  assertReady(request: ContractInvocationRequest): ContractInvocationPreparation {
    const prep = this.prepareInvocation(request);
    if (!prep.isReady) {
      throw new ContractInvocationError(
        prep.errorCode ?? 'EXECUTION_FAILED',
        prep.message
      );
    }
    return prep;
  }

  /**
   * Dispatches circuit invocation through the appropriate execution boundary.
   */
  async dispatchInvocation<T = unknown>(
    request: ContractInvocationRequest,
    options?: ContractInvocationDispatchOptions
  ): Promise<ContractInvocationResult<T>> {
    const prep = this.prepareInvocation(request);

    if (!prep.isReady) {
      return {
        success: false,
        status: prep.status,
        circuitName: prep.circuitName,
        action: prep.action,
        loanId: request.loanId,
        error: prep.message,
        errorCode: prep.errorCode,
        message: prep.message,
      };
    }

    // Case 1: Read-Only Circuits (getLoanStatus, getLoanDetails)
    if (prep.isReadOnly) {
      if (options?.loanRegistry && request.loanId) {
        const loan = options.loanRegistry.getLoan(request.loanId);
        if (loan) {
          if (prep.circuitName === 'getLoanStatus') {
            return {
              success: true,
              status: 'READY',
              circuitName: prep.circuitName,
              action: prep.action,
              loanId: request.loanId,
              data: {
                status: loan.status,
                isEligibilityVerified: loan.isEligibilityVerified,
              } as unknown as T,
              message: `Read loan status for agreement ${request.loanId}.`,
            };
          }
          if (prep.circuitName === 'getLoanDetails') {
            return {
              success: true,
              status: 'READY',
              circuitName: prep.circuitName,
              action: prep.action,
              loanId: request.loanId,
              data: loan as unknown as T,
              message: `Read loan details for agreement ${request.loanId}.`,
            };
          }
        }
      }
      return {
        success: false,
        status: 'UNSUPPORTED',
        circuitName: prep.circuitName,
        action: prep.action,
        loanId: request.loanId,
        error: 'On-chain ledger status queries require live Midnight RPC connection.',
        errorCode: 'UNSUPPORTED_OPERATION',
        message: 'On-chain ledger status queries require live Midnight RPC connection.',
      };
    }

    // Case 2: Off-chain Local Proof (verifyEligibility)
    if (prep.classification === 'LOCAL_PROOF') {
      if (options?.localProofExecutor) {
        try {
          await options.localProofExecutor();
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : 'Local proof generation failed.';
          return {
            success: false,
            status: 'FAILED',
            circuitName: prep.circuitName,
            action: prep.action,
            loanId: request.loanId,
            error: errMsg,
            errorCode: 'EXECUTION_FAILED',
            message: errMsg,
          };
        }
      }

      if (options?.loanRegistry && request.loanId && prep.callerPublicKey && !options.skipRegistryUpdate) {
        try {
          const updated = options.loanRegistry.verifyLoanEligibility(request.loanId, prep.callerPublicKey);
          if ((options.loanRegistry as any).loans && (updated as any).loans) {
            (options.loanRegistry as any).loans[request.loanId] = (updated as any).loans[request.loanId];
          }
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : 'Failed to record eligibility verification in registry.';
          return {
            success: false,
            status: 'FAILED',
            circuitName: prep.circuitName,
            action: prep.action,
            loanId: request.loanId,
            error: errMsg,
            errorCode: 'EXECUTION_FAILED',
            message: errMsg,
          };
        }
      }

      return {
        success: true,
        status: 'READY',
        circuitName: prep.circuitName,
        action: prep.action,
        loanId: request.loanId,
        message: 'Off-chain Zero-Knowledge verification circuit prepared and evaluated.',
      };
    }

    // Case 3: Transaction-Executing Circuits (fundLoan, repayLoan, settleLoan)
    const provider = this.getProvider();
    if (provider.isPrototype) {
      return {
        success: false,
        status: 'UNSUPPORTED',
        circuitName: prep.circuitName,
        action: prep.action,
        loanId: request.loanId,
        error: 'Live transaction submission is unavailable in prototype mode.',
        errorCode: 'UNSUPPORTED_OPERATION',
        message: 'Live transaction submission is unavailable in prototype mode.',
      };
    }

    // Dispatch via TransactionExecutionService
    const action = prep.action;
    if (!action) {
      return {
        success: false,
        status: 'FAILED',
        circuitName: prep.circuitName,
        action: prep.action,
        loanId: request.loanId,
        error: `Circuit "${prep.circuitName}" cannot be dispatched without a mapped lifecycle action.`,
        errorCode: 'EXECUTION_FAILED',
        message: `Circuit "${prep.circuitName}" cannot be dispatched without a mapped lifecycle action.`,
      };
    }

    const session = this.sessionService.getSession();
    const account = (session.account as any) ?? {
      publicKey: prep.callerPublicKey ?? null,
      publicKeyHex: prep.callerPublicKeyHex ?? '',
      connectionStatus: 'CONNECTED',
      displayName: 'Wallet Account',
      shortLabel: 'Wallet',
      role: 'PARTICIPANT',
      isPrototype: false,
    };

    try {
      this.executionService.setDeploymentService(this.deploymentService);
      const activeNet = this.networkConfigService.getNetworkConfig();
      if (activeNet && activeNet.status === 'CONFIGURED') {
        try {
          setNetworkConfig(activeNet);
        } catch {
          // safe non-blocking
        }
      }
      const execResult = await this.executionService.executeTransaction(
        {
          loan: (request.loan ?? (options?.loanRegistry && request.loanId ? options.loanRegistry.getLoan(request.loanId) : null)) as any,
          account,
          action,
          loanId: request.loanId ?? 'unknown',
          circuitName: prep.circuitName,
          options: {
            skipRegistryUpdate: options?.skipRegistryUpdate,
            deploymentService: this.deploymentService,
            networkConfigService: this.networkConfigService,
          } as any,
        },
        options?.loanRegistry
      );

      const res = execResult.result;

      if (res.status === 'PENDING' || res.status === 'CONFIRMED') {
        return {
          success: true,
          status: 'DISPATCHED',
          circuitName: prep.circuitName,
          action: prep.action,
          loanId: request.loanId,
          transactionId: res.transactionId ?? res.receipt?.transactionId ?? null,
          blockHeight: res.blockHeight ?? res.receipt?.blockHeight ?? (res as any).submissionResult?.blockHeight ?? null,
          receipt: res.receipt,
          message: res.message,
        };
      }

      let invocationStatus: ContractInvocationStatus = 'FAILED';
      if (res.status === 'UNSUPPORTED') invocationStatus = 'UNSUPPORTED';
      else if (res.status === 'BLOCKED') invocationStatus = 'BLOCKED';

      return {
        success: false,
        status: invocationStatus,
        circuitName: prep.circuitName,
        action: prep.action,
        loanId: request.loanId,
        error: res.error ?? res.message,
        errorCode: (res.errorCode as ContractInvocationErrorCode) ?? 'EXECUTION_FAILED',
        message: res.message,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Transaction execution failed unexpectedly.';
      return {
        success: false,
        status: 'FAILED',
        circuitName: prep.circuitName,
        action: prep.action,
        loanId: request.loanId,
        error: errMsg,
        errorCode: 'EXECUTION_FAILED',
        message: errMsg,
      };
    }
  }
}

// Global singleton instance
let serviceInstance: ContractInvocationService | null = null;

export function getContractInvocationService(
  deploymentService?: ContractDeploymentService,
  networkConfigService?: NetworkConfigService,
  sessionService?: WalletSessionService,
  executionService?: TransactionExecutionService,
  provider?: WalletProvider
): ContractInvocationService {
  if (
    !serviceInstance ||
    deploymentService ||
    networkConfigService ||
    sessionService ||
    executionService ||
    provider
  ) {
    serviceInstance = new ContractInvocationService(
      deploymentService,
      networkConfigService,
      sessionService,
      executionService,
      provider
    );
  }
  return serviceInstance;
}

export function setContractInvocationService(service: ContractInvocationService): void {
  serviceInstance = service;
}

export function resetContractInvocationService(
  deploymentService?: ContractDeploymentService,
  networkConfigService?: NetworkConfigService,
  sessionService?: WalletSessionService,
  executionService?: TransactionExecutionService,
  provider?: WalletProvider
): ContractInvocationService {
  serviceInstance = new ContractInvocationService(
    deploymentService,
    networkConfigService,
    sessionService,
    executionService,
    provider
  );
  return serviceInstance;
}
