import type { LoanStatus, LoanDetailsModel } from '../types/index.ts';
import type { ContractDeploymentErrorCode } from '../types/contract-deployment.ts';
import { ContractDeploymentError } from '../types/contract-deployment.ts';
import type { LoanRegistry } from './loan-registry.ts';
import {
  getContractDeploymentService,
  ContractDeploymentService,
} from './contract-deployment-service.ts';
import {
  ContractInvocationService,
  getContractInvocationService,
  type ContractInvocationDispatchOptions,
} from './contract-invocation-service.ts';
import {
  ContractStateInspectionService,
  getContractStateInspectionService,
} from './contract-state-inspection-service.ts';
import type {
  ContractInvocationRequest,
  ContractInvocationResult,
} from '../types/contract-invocation.ts';
import type {
  ContractStateInspectionRequest,
  ContractStateInspectionResult,
} from '../types/contract-state-inspection.ts';
import {
  getCircuitDefinition,
  getCircuitForAction,
  resolveCircuitNameForAction,
} from './contract-manifest.ts';
import type { LifecycleTransactionAction } from '../types/transaction-orchestration.ts';

export type ContractCallStatus =
  | 'READY'
  | 'UNSUPPORTED'
  | 'NOT_CONFIGURED'
  | 'NETWORK_MISMATCH'
  | 'FAILED';

export interface ContractCallPreparation {
  isReady: boolean;
  status: ContractCallStatus;
  circuitName: string;
  classification?: string;
  requiresSignature?: boolean;
  requiresSubmission?: boolean;
  callerPublicKey?: Uint8Array;
  contractAddress: string | null;
  networkId: string | null;
  errorCode?: ContractDeploymentErrorCode;
  message: string;
}

export interface ContractCallResult<T = void> {
  success: boolean;
  status: ContractCallStatus;
  data?: T;
  error?: string;
  errorCode?: ContractDeploymentErrorCode | string;
  message: string;
}

/**
 * Client abstraction interfacing with Midnight Compact contract circuits.
 *
 * CRITICAL INVARIANTS:
 * 1. Does NOT directly mutate LoanRegistry.
 * 2. If no genuine deployed contract is available, returns NOT_CONFIGURED or UNSUPPORTED.
 * 3. Never synthesizes on-chain states or fabricated transaction hashes.
 */
export class ContractClient {
  private deploymentService: ContractDeploymentService;
  private invocationService: ContractInvocationService;
  private stateInspectionService: ContractStateInspectionService;

  constructor(
    deploymentService?: ContractDeploymentService,
    invocationService?: ContractInvocationService,
    stateInspectionService?: ContractStateInspectionService
  ) {
    this.deploymentService = deploymentService ?? getContractDeploymentService();
    this.invocationService = invocationService ?? getContractInvocationService(this.deploymentService);
    this.stateInspectionService =
      stateInspectionService ?? getContractStateInspectionService(this.deploymentService);
  }

  getDeploymentService(): ContractDeploymentService {
    return this.deploymentService;
  }

  getInvocationService(): ContractInvocationService {
    return this.invocationService;
  }

  getStateInspectionService(): ContractStateInspectionService {
    return this.stateInspectionService;
  }

  /**
   * Directly invokes a contract circuit via the ContractInvocationService boundary.
   */
  async invokeCircuit<T = unknown>(
    request: ContractInvocationRequest,
    options?: ContractInvocationDispatchOptions
  ): Promise<ContractInvocationResult<T>> {
    return this.invocationService.dispatchInvocation<T>(request, options);
  }

  /**
   * Evaluates readiness to invoke a contract circuit.
   */
  prepareContractCall(
    actionOrCircuit: string,
    loan?: LoanDetailsModel,
    callerPk?: Uint8Array | null
  ): ContractCallPreparation {
    const deployment = this.deploymentService.getDeployment();
    const isAction =
      actionOrCircuit === 'VERIFY_ELIGIBILITY' ||
      actionOrCircuit === 'FUND_LOAN' ||
      actionOrCircuit === 'REPAY_LOAN' ||
      actionOrCircuit === 'SETTLE_LOAN';

    const circuitName = isAction
      ? resolveCircuitNameForAction(actionOrCircuit as LifecycleTransactionAction)
      : actionOrCircuit;

    const circuitDef = getCircuitDefinition(circuitName);
    if (!circuitDef) {
      return {
        isReady: false,
        status: 'FAILED',
        circuitName,
        contractAddress: deployment.contractAddress,
        networkId: deployment.networkId,
        errorCode: 'CIRCUIT_MISMATCH',
        message: `Circuit "${circuitName}" is not defined in the canonical contract manifest.`,
      };
    }

    if (circuitDef.requiresWallet && callerPk === null) {
      throw new ContractDeploymentError('INVALID_PARAMS', 'Caller identity required for circuit invocation.');
    }

    if (loan && typeof (loan as any).amount === 'bigint' && (loan as any).amount <= 0n) {
      throw new ContractDeploymentError('INVALID_PARAMS', 'Invalid agreement parameters: amount must be positive.');
    }

    // 1. Check if contract deployment is unconfigured
    if (deployment.status === 'NOT_DEPLOYED' || deployment.status === 'UNCONFIGURED') {
      return {
        isReady: false,
        status: 'NOT_CONFIGURED',
        circuitName,
        classification: circuitDef.classification,
        requiresSignature: circuitDef.requiresSignature,
        requiresSubmission: circuitDef.requiresSubmission,
        callerPublicKey: callerPk ?? undefined,
        contractAddress: null,
        networkId: deployment.networkId,
        errorCode: 'NOT_CONFIGURED',
        message: 'Contract deployment is unconfigured or not deployed.',
      };
    }

    // 2. Validate deployment state
    const validation = this.deploymentService.validateDeployment();
    if (!validation.isValid) {
      const code = validation.errorCode ?? 'INVALID_CONFIGURATION';
      const status: ContractCallStatus = code === 'NETWORK_MISMATCH' ? 'NETWORK_MISMATCH' : 'FAILED';
      return {
        isReady: false,
        status,
        circuitName,
        classification: circuitDef.classification,
        requiresSignature: circuitDef.requiresSignature,
        requiresSubmission: circuitDef.requiresSubmission,
        callerPublicKey: callerPk ?? undefined,
        contractAddress: deployment.contractAddress,
        networkId: deployment.networkId,
        errorCode: code,
        message: validation.error || 'Contract deployment validation failed.',
      };
    }

    // 3. Check prototype mode constraints
    if (deployment.isPrototype && circuitDef.requiresSubmission) {
      return {
        isReady: false,
        status: 'UNSUPPORTED',
        circuitName,
        classification: circuitDef.classification,
        requiresSignature: circuitDef.requiresSignature,
        requiresSubmission: circuitDef.requiresSubmission,
        callerPublicKey: callerPk ?? undefined,
        contractAddress: deployment.contractAddress,
        networkId: deployment.networkId,
        errorCode: 'PROVIDER_UNAVAILABLE',
        message: `Circuit "${circuitName}" requires on-chain transaction submission, which is unavailable in prototype mode.`,
      };
    }

    return {
      isReady: true,
      status: 'READY',
      circuitName,
      classification: circuitDef.classification,
      requiresSignature: circuitDef.requiresSignature,
      requiresSubmission: circuitDef.requiresSubmission,
      callerPublicKey: callerPk ?? undefined,
      contractAddress: deployment.contractAddress,
      networkId: deployment.networkId,
      message: `Contract call to "${circuitName}" is ready.`,
    };
  }

  // ---------------------------------------------------------------------------
  // Read Operations (getLoanStatus, getLoanDetails)
  // ---------------------------------------------------------------------------

  getLoanStatus(
    loanId: string,
    loanRegistry?: LoanRegistry
  ): ContractCallResult<{ status: LoanStatus; isEligibilityVerified: boolean }> {
    if (loanRegistry) {
      const loan = loanRegistry.getLoan(loanId);
      if (loan) {
        return {
          circuitName: 'getLoanStatus',
          success: true,
          status: 'READY',
          data: { status: loan.status, isEligibilityVerified: loan.isEligibilityVerified },
          message: `Read loan status for agreement ${loanId}.`,
        } as any;
      }
    }

    const prep = this.prepareContractCall('getLoanStatus');
    if (!prep.isReady) {
      return {
        success: false,
        status: prep.status,
        error: prep.message,
        errorCode: prep.errorCode,
        message: prep.message,
      };
    }

    return {
      success: false,
      status: 'UNSUPPORTED',
      error: 'On-chain ledger status queries require live Midnight RPC connection.',
      errorCode: 'PROVIDER_UNAVAILABLE',
      message: 'On-chain ledger status queries require live Midnight RPC connection.',
    };
  }

  getLoanDetails(
    loanId: string,
    loanRegistry?: LoanRegistry
  ): ContractCallResult<LoanDetailsModel> {
    if (loanRegistry) {
      const loan = loanRegistry.getLoan(loanId);
      if (loan) {
        return {
          circuitName: 'getLoanDetails',
          success: true,
          status: 'READY',
          data: loan,
          message: `Read loan details for agreement ${loanId}.`,
        } as any;
      }
    }

    const prep = this.prepareContractCall('getLoanDetails');
    if (!prep.isReady) {
      return {
        success: false,
        status: prep.status,
        error: prep.message,
        errorCode: prep.errorCode,
        message: prep.message,
      };
    }

    return {
      success: false,
      status: 'UNSUPPORTED',
      error: 'On-chain ledger details queries require live Midnight RPC connection.',
      errorCode: 'PROVIDER_UNAVAILABLE',
      message: 'On-chain ledger details queries require live Midnight RPC connection.',
    };
  }

  // ---------------------------------------------------------------------------
  // Authoritative State Inspection (Commit #35)
  // ---------------------------------------------------------------------------

  /**
   * Inspects contract state via the authoritative state inspection boundary.
   */
  async inspectContractState(
    request?: Partial<ContractStateInspectionRequest>,
    loanRegistry?: LoanRegistry
  ): Promise<ContractStateInspectionResult> {
    return this.stateInspectionService.inspectContractState(request, loanRegistry);
  }

  /**
   * Authoritatively reads loan status, clearly distinguishing LOCAL_PROTOTYPE from PROVIDER_VERIFIED.
   */
  async getAuthoritativeLoanStatus(
    loanId: string,
    loanRegistry?: LoanRegistry
  ): Promise<ContractStateInspectionResult<{ status: LoanStatus; isEligibilityVerified: boolean }>> {
    return this.stateInspectionService.queryCircuitState<{ status: LoanStatus; isEligibilityVerified: boolean }>(
      'getLoanStatus',
      { loanId },
      loanRegistry
    );
  }

  /**
   * Authoritatively reads loan details, clearly distinguishing LOCAL_PROTOTYPE from PROVIDER_VERIFIED.
   */
  async getAuthoritativeLoanDetails(
    loanId: string,
    loanRegistry?: LoanRegistry
  ): Promise<ContractStateInspectionResult<LoanDetailsModel>> {
    return this.stateInspectionService.queryCircuitState<LoanDetailsModel>(
      'getLoanDetails',
      { loanId },
      loanRegistry
    );
  }

  // ---------------------------------------------------------------------------
  // Lifecycle Operations (verifyEligibility, fundLoan, repayLoan, settleLoan)
  // ---------------------------------------------------------------------------

  verifyEligibility(
    loanOrId: string | LoanDetailsModel,
    callerPk: Uint8Array
  ): ContractCallPreparation | ContractCallResult<void> {
    if (typeof loanOrId === 'object') {
      return this.prepareContractCall('verifyEligibility', loanOrId, callerPk);
    }
    const prep = this.prepareContractCall('VERIFY_ELIGIBILITY');
    if (!prep.isReady) {
      return {
        success: false,
        status: prep.status,
        error: prep.message,
        errorCode: prep.errorCode,
        message: prep.message,
      };
    }

    return {
      success: true,
      status: 'READY',
      message: 'Off-chain Zero-Knowledge verification circuit prepared.',
    };
  }

  fundLoan(
    loanOrId: string | LoanDetailsModel,
    callerPk: Uint8Array
  ): ContractCallPreparation | ContractCallResult<void> {
    if (typeof loanOrId === 'object') {
      return this.prepareContractCall('fundLoan', loanOrId, callerPk);
    }
    const prep = this.prepareContractCall('FUND_LOAN');
    if (!prep.isReady) {
      return {
        success: false,
        status: prep.status,
        error: prep.message,
        errorCode: prep.errorCode,
        message: prep.message,
      };
    }

    return {
      success: false,
      status: 'UNSUPPORTED',
      error: 'On-chain funding requires live Midnight provider signing and submission.',
      errorCode: 'PROVIDER_UNAVAILABLE',
      message: 'On-chain funding requires live Midnight provider signing and submission.',
    };
  }

  repayLoan(
    loanOrId: string | LoanDetailsModel,
    callerPk: Uint8Array,
    repaymentAmount?: bigint
  ): ContractCallPreparation | ContractCallResult<void> {
    if (typeof loanOrId === 'object') {
      return this.prepareContractCall('repayLoan', loanOrId, callerPk);
    }
    const prep = this.prepareContractCall('REPAY_LOAN');
    if (!prep.isReady) {
      return {
        success: false,
        status: prep.status,
        error: prep.message,
        errorCode: prep.errorCode,
        message: prep.message,
      };
    }

    return {
      success: false,
      status: 'UNSUPPORTED',
      error: 'On-chain repayment requires live Midnight provider signing and submission.',
      errorCode: 'PROVIDER_UNAVAILABLE',
      message: 'On-chain repayment requires live Midnight provider signing and submission.',
    };
  }

  settleLoan(
    loanOrId: string | LoanDetailsModel,
    callerPk: Uint8Array
  ): ContractCallPreparation | ContractCallResult<void> {
    if (typeof loanOrId === 'object') {
      return this.prepareContractCall('settleLoan', loanOrId, callerPk);
    }
    const prep = this.prepareContractCall('SETTLE_LOAN');
    if (!prep.isReady) {
      return {
        success: false,
        status: prep.status,
        error: prep.message,
        errorCode: prep.errorCode,
        message: prep.message,
      };
    }

    return {
      success: false,
      status: 'UNSUPPORTED',
      error: 'On-chain settlement requires live Midnight provider signing and submission.',
      errorCode: 'PROVIDER_UNAVAILABLE',
      message: 'On-chain settlement requires live Midnight provider signing and submission.',
    };
  }
}

// Global singleton instance
let clientInstance: ContractClient | null = null;

export function getContractClient(): ContractClient {
  if (!clientInstance) {
    clientInstance = new ContractClient();
  }
  return clientInstance;
}

export function resetContractClient(
  deploymentService?: ContractDeploymentService,
  invocationService?: ContractInvocationService
): ContractClient {
  clientInstance = new ContractClient(deploymentService, invocationService);
  return clientInstance;
}
