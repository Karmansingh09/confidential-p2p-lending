import type {
  ContractStateSnapshot,
  ContractStateInspectionStatus,
  ContractStateInspectionReason,
  ContractStateInspectionRequest,
  ContractStateInspectionResult,
} from '../types/contract-state-inspection.ts';
import {
  ContractStateInspectionError,
  DEFAULT_UNINSPECTED_SNAPSHOT,
} from '../types/contract-state-inspection.ts';
import type { ContractStateProvider } from './contract-state-provider.ts';
import {
  LocalPrototypeContractStateProvider,
} from './contract-state-provider.ts';
import {
  createDefaultContractStateProvider,
} from './midnight-contract-state-adapter.ts';
import {
  ContractDeploymentService,
  getContractDeploymentService,
} from './contract-deployment-service.ts';
import {
  NetworkConfigService,
  getNetworkConfigService,
} from './network-config-service.ts';
import { validateContractAddress } from './contract-address-validator.ts';
import {
  isKnownCircuit,
  getCircuitDefinition,
} from './contract-manifest.ts';
import type { LoanRegistry } from './loan-registry.ts';

export type StateInspectionListener = (snapshot: ContractStateSnapshot) => void;

/**
 * Service managing the authoritative on-chain contract state inspection boundary.
 *
 * CRITICAL ARCHITECTURAL AXIOMS:
 * 1. LOCAL REGISTRY STATE != PROVIDER-READ LEDGER STATE != VERIFIED CONTRACT DEPLOYMENT != CANONICAL APPLICATION STATE
 * 2. Zero Fabrication: Local prototype mode never generates synthetic block heights, transaction hashes, or fake confirmations.
 * 3. Read-Only Scope: Never performs transactions, signs messages, submits broadcasts, or alters LoanRegistry.
 * 4. Deterministic State Transitions:
 *    NOT_CHECKED -> CHECKING -> VERIFIED / AVAILABLE / NOT_DEPLOYED / NETWORK_MISMATCH / UNSUPPORTED / FAILED
 */
export class ContractStateInspectionService {
  private deploymentService: ContractDeploymentService;
  private networkConfigService: NetworkConfigService;
  private provider: ContractStateProvider;
  private currentSnapshot: ContractStateSnapshot;
  private listeners: Set<StateInspectionListener> = new Set();

  constructor(
    deploymentService?: ContractDeploymentService,
    networkConfigService?: NetworkConfigService,
    provider?: ContractStateProvider
  ) {
    this.deploymentService = deploymentService ?? getContractDeploymentService();
    this.networkConfigService = networkConfigService ?? getNetworkConfigService();
    const netConfig = this.networkConfigService.getNetworkConfig();
    this.provider =
      provider ?? createDefaultContractStateProvider(netConfig.environment === 'LOCAL');
    this.currentSnapshot = { ...DEFAULT_UNINSPECTED_SNAPSHOT };
  }

  getDeploymentService(): ContractDeploymentService {
    return this.deploymentService;
  }

  getNetworkConfigService(): NetworkConfigService {
    return this.networkConfigService;
  }

  getProvider(): ContractStateProvider {
    return this.provider;
  }

  setProvider(provider: ContractStateProvider): void {
    this.provider = provider;
  }

  getInspectionState(): ContractStateSnapshot {
    return { ...this.currentSnapshot };
  }

  resetInspectionState(): void {
    this.currentSnapshot = { ...DEFAULT_UNINSPECTED_SNAPSHOT };
    this.notifyListeners();
  }

  subscribe(listener: StateInspectionListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const snapshotCopy = { ...this.currentSnapshot };
    for (const listener of this.listeners) {
      try {
        listener(snapshotCopy);
      } catch {
        // Safe listener execution
      }
    }
  }

  /**
   * Performs authoritative contract state inspection.
   */
  async inspectContractState(
    request?: Partial<ContractStateInspectionRequest>,
    loanRegistry?: LoanRegistry
  ): Promise<ContractStateInspectionResult> {
    const now = Date.now();
    const deployment = this.deploymentService.getDeployment();
    const netConfig = this.networkConfigService.getNetworkConfig();
    const activeNetworkId =
      netConfig.networkId ?? (netConfig.environment === 'LOCAL' ? 'midnight-prototype-local' : null);

    const contractAddress = request?.contractAddress ?? deployment.contractAddress;
    const targetNetworkId = request?.networkId ?? deployment.networkId ?? activeNetworkId;

    // 1. Contract Address Validation
    if (contractAddress) {
      const addrValidation = validateContractAddress(contractAddress);
      if (!addrValidation.isValid) {
        const snapshot: ContractStateSnapshot = {
          contractAddress,
          networkId: targetNetworkId,
          inspectedAt: now,
          blockHeight: null,
          deploymentVerified: false,
          stateAvailable: false,
          status: 'FAILED',
          reason: 'INVALID_CONTRACT_ADDRESS',
          source: 'NONE',
          data: null,
        };
        this.currentSnapshot = snapshot;
        this.notifyListeners();
        return {
          success: false,
          status: 'FAILED',
          reason: 'INVALID_CONTRACT_ADDRESS',
          snapshot,
          data: null,
          errorCode: 'INVALID_CONTRACT_ADDRESS',
          error: addrValidation.error ?? 'Contract address format is invalid.',
          message: addrValidation.error ?? 'Contract address format is invalid.',
          source: 'NONE',
        };
      }
    }

    // 2. Contract Configuration Evaluation
    if (!contractAddress || deployment.status === 'UNCONFIGURED') {
      const snapshot: ContractStateSnapshot = {
        contractAddress: null,
        networkId: targetNetworkId,
        inspectedAt: now,
        blockHeight: null,
        deploymentVerified: false,
        stateAvailable: false,
        status: 'UNAVAILABLE',
        reason: 'CONTRACT_NOT_CONFIGURED',
        source: 'NONE',
        data: null,
      };
      this.currentSnapshot = snapshot;
      this.notifyListeners();
      return {
        success: false,
        status: 'UNAVAILABLE',
        reason: 'CONTRACT_NOT_CONFIGURED',
        snapshot,
        data: null,
        errorCode: 'CONTRACT_NOT_CONFIGURED',
        error: 'No contract address is configured for state inspection.',
        message: 'No contract address is configured for state inspection.',
        source: 'NONE',
      };
    }

    if (deployment.status === 'NOT_DEPLOYED') {
      const snapshot: ContractStateSnapshot = {
        contractAddress,
        networkId: targetNetworkId,
        inspectedAt: now,
        blockHeight: null,
        deploymentVerified: false,
        stateAvailable: false,
        status: 'NOT_DEPLOYED',
        reason: 'CONTRACT_NOT_DEPLOYED',
        source: 'NONE',
        data: null,
      };
      this.currentSnapshot = snapshot;
      this.notifyListeners();
      return {
        success: false,
        status: 'NOT_DEPLOYED',
        reason: 'CONTRACT_NOT_DEPLOYED',
        snapshot,
        data: null,
        errorCode: 'CONTRACT_NOT_DEPLOYED',
        error: 'Contract deployment is marked as NOT_DEPLOYED.',
        message: 'Contract deployment is marked as NOT_DEPLOYED.',
        source: 'NONE',
      };
    }

    if (deployment.status === 'INVALID') {
      const snapshot: ContractStateSnapshot = {
        contractAddress,
        networkId: targetNetworkId,
        inspectedAt: now,
        blockHeight: null,
        deploymentVerified: false,
        stateAvailable: false,
        status: 'FAILED',
        reason: 'INVALID_CONTRACT_ADDRESS',
        source: 'NONE',
        data: null,
      };
      this.currentSnapshot = snapshot;
      this.notifyListeners();
      return {
        success: false,
        status: 'FAILED',
        reason: 'INVALID_CONTRACT_ADDRESS',
        snapshot,
        data: null,
        errorCode: 'INVALID_CONTRACT_ADDRESS',
        error: 'Contract deployment configuration is invalid.',
        message: 'Contract deployment configuration is invalid.',
        source: 'NONE',
      };
    }

    // 3. Network Configuration Check
    if (netConfig.status !== 'CONFIGURED' || (netConfig.environment !== 'LOCAL' && !netConfig.nodeRpcEndpoint?.url)) {
      const snapshot: ContractStateSnapshot = {
        contractAddress,
        networkId: targetNetworkId,
        inspectedAt: now,
        blockHeight: null,
        deploymentVerified: false,
        stateAvailable: false,
        status: 'UNAVAILABLE',
        reason: 'NETWORK_MISMATCH',
        source: 'NONE',
        data: null,
      };
      this.currentSnapshot = snapshot;
      this.notifyListeners();
      return {
        success: false,
        status: 'UNAVAILABLE',
        reason: 'NETWORK_MISMATCH',
        snapshot,
        data: null,
        errorCode: 'NETWORK_MISMATCH',
        error: 'Active network configuration is invalid or missing required RPC endpoint.',
        message: 'Active network configuration is invalid or missing required RPC endpoint.',
        source: 'NONE',
      };
    }

    // 4. Contract / Network Configuration Compatibility Check
    const isNetworkMatched =
      !deployment.networkId || !activeNetworkId || deployment.networkId === activeNetworkId;
    if (!isNetworkMatched) {
      const snapshot: ContractStateSnapshot = {
        contractAddress,
        networkId: deployment.networkId,
        inspectedAt: now,
        blockHeight: null,
        deploymentVerified: false,
        stateAvailable: false,
        status: 'NETWORK_MISMATCH',
        reason: 'NETWORK_MISMATCH',
        source: 'NONE',
        data: null,
      };
      this.currentSnapshot = snapshot;
      this.notifyListeners();
      return {
        success: false,
        status: 'NETWORK_MISMATCH',
        reason: 'NETWORK_MISMATCH',
        snapshot,
        data: null,
        errorCode: 'NETWORK_MISMATCH',
        error: `Contract network (${deployment.networkId}) does not match active network (${activeNetworkId}).`,
        message: `Contract network (${deployment.networkId}) does not match active network (${activeNetworkId}).`,
        source: 'NONE',
      };
    }

    // 5. Contract Deployment Verification Gating for genuine on-chain providers
    const isVerified =
      deployment.isVerified || deployment.status === 'VERIFIED' || deployment.status === 'READY';
    const isLocalProvider = this.provider.getProviderKind() === 'LOCAL_PROTOTYPE';

    if (!isVerified && !isLocalProvider) {
      const snapshot: ContractStateSnapshot = {
        contractAddress,
        networkId: targetNetworkId,
        inspectedAt: now,
        blockHeight: null,
        deploymentVerified: false,
        stateAvailable: false,
        status: 'UNAVAILABLE',
        reason: 'CONTRACT_VERIFICATION_UNAVAILABLE',
        source: 'NONE',
        data: null,
      };
      this.currentSnapshot = snapshot;
      this.notifyListeners();
      return {
        success: false,
        status: 'UNAVAILABLE',
        reason: 'CONTRACT_VERIFICATION_UNAVAILABLE',
        snapshot,
        data: null,
        errorCode: 'CONTRACT_VERIFICATION_UNAVAILABLE',
        error: 'Contract deployment is not verified on-chain. State inspection unavailable.',
        message: 'Contract deployment is not verified on-chain. State inspection unavailable.',
        source: 'NONE',
      };
    }

    // 6. Circuit Validation if circuitName provided
    if (request?.circuitName) {
      const circuitName = request.circuitName;
      if (!isKnownCircuit(circuitName)) {
        const snapshot: ContractStateSnapshot = {
          contractAddress,
          networkId: targetNetworkId,
          inspectedAt: now,
          blockHeight: null,
          deploymentVerified: isVerified,
          stateAvailable: false,
          status: 'FAILED',
          reason: 'STATE_QUERY_UNSUPPORTED',
          source: isLocalProvider ? 'LOCAL_PROTOTYPE' : 'PROVIDER_VERIFIED',
          data: null,
        };
        this.currentSnapshot = snapshot;
        this.notifyListeners();
        return {
          success: false,
          status: 'FAILED',
          reason: 'STATE_QUERY_UNSUPPORTED',
          snapshot,
          data: null,
          errorCode: 'STATE_QUERY_UNSUPPORTED',
          error: `Circuit "${circuitName}" is not defined in the canonical contract manifest.`,
          message: `Circuit "${circuitName}" is not defined in the canonical contract manifest.`,
          source: isLocalProvider ? 'LOCAL_PROTOTYPE' : 'PROVIDER_VERIFIED',
        };
      }

      const circuitDef = getCircuitDefinition(circuitName)!;
      if (circuitDef.classification === 'TRANSACTION_EXECUTION') {
        const snapshot: ContractStateSnapshot = {
          contractAddress,
          networkId: targetNetworkId,
          inspectedAt: now,
          blockHeight: null,
          deploymentVerified: isVerified,
          stateAvailable: false,
          status: 'FAILED',
          reason: 'STATE_QUERY_UNSUPPORTED',
          source: isLocalProvider ? 'LOCAL_PROTOTYPE' : 'PROVIDER_VERIFIED',
          data: null,
        };
        this.currentSnapshot = snapshot;
        this.notifyListeners();
        return {
          success: false,
          status: 'FAILED',
          reason: 'STATE_QUERY_UNSUPPORTED',
          snapshot,
          data: null,
          errorCode: 'STATE_QUERY_UNSUPPORTED',
          error: `Circuit "${circuitName}" is a transaction-executing circuit and cannot be inspected as state.`,
          message: `Circuit "${circuitName}" is a transaction-executing circuit and cannot be inspected as state.`,
          source: isLocalProvider ? 'LOCAL_PROTOTYPE' : 'PROVIDER_VERIFIED',
        };
      }

      if (circuitDef.classification === 'LOCAL_PROOF') {
        const snapshot: ContractStateSnapshot = {
          contractAddress,
          networkId: targetNetworkId,
          inspectedAt: now,
          blockHeight: null,
          deploymentVerified: isVerified,
          stateAvailable: false,
          status: 'FAILED',
          reason: 'STATE_QUERY_UNSUPPORTED',
          source: isLocalProvider ? 'LOCAL_PROTOTYPE' : 'PROVIDER_VERIFIED',
          data: null,
        };
        this.currentSnapshot = snapshot;
        this.notifyListeners();
        return {
          success: false,
          status: 'FAILED',
          reason: 'STATE_QUERY_UNSUPPORTED',
          snapshot,
          data: null,
          errorCode: 'STATE_QUERY_UNSUPPORTED',
          error: `Circuit "${circuitName}" is an off-chain local proof circuit, not a contract state query.`,
          message: `Circuit "${circuitName}" is an off-chain local proof circuit, not a contract state query.`,
          source: isLocalProvider ? 'LOCAL_PROTOTYPE' : 'PROVIDER_VERIFIED',
        };
      }
    }

    // 7. Transition to CHECKING state
    this.currentSnapshot = {
      contractAddress,
      networkId: targetNetworkId,
      inspectedAt: now,
      blockHeight: null,
      deploymentVerified: isVerified,
      stateAvailable: false,
      status: 'CHECKING',
      reason: 'STATE_NOT_FOUND',
      source: isLocalProvider ? 'LOCAL_PROTOTYPE' : 'PROVIDER_VERIFIED',
      data: null,
    };
    this.notifyListeners();

    // Attach local registry to prototype provider if passed
    if (loanRegistry && this.provider instanceof LocalPrototypeContractStateProvider) {
      this.provider.setLoanRegistry(loanRegistry);
    }

    // 8. Execute Provider Query
    try {
      const fullRequest: ContractStateInspectionRequest = {
        contractAddress,
        networkId: targetNetworkId,
        circuitName: request?.circuitName,
        loanId: request?.loanId,
        stateKey: request?.stateKey,
        reference: request?.reference,
        blockHeight: request?.blockHeight,
      };

      const result = await this.provider.inspectContractState(fullRequest);

      this.currentSnapshot = {
        ...result.snapshot,
        contractAddress,
        networkId: targetNetworkId,
        deploymentVerified: isVerified || result.snapshot.deploymentVerified,
      };
      this.notifyListeners();

      return {
        ...result,
        snapshot: { ...this.currentSnapshot },
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Contract state inspection failed unexpectedly.';
      const failureSnapshot: ContractStateSnapshot = {
        contractAddress,
        networkId: targetNetworkId,
        inspectedAt: Date.now(),
        blockHeight: null,
        deploymentVerified: isVerified,
        stateAvailable: false,
        status: 'FAILED',
        reason: 'STATE_QUERY_FAILED',
        source: isLocalProvider ? 'LOCAL_PROTOTYPE' : 'PROVIDER_VERIFIED',
        data: null,
      };
      this.currentSnapshot = failureSnapshot;
      this.notifyListeners();

      return {
        success: false,
        status: 'FAILED',
        reason: 'STATE_QUERY_FAILED',
        snapshot: failureSnapshot,
        data: null,
        errorCode: 'STATE_QUERY_FAILED',
        error: errMsg,
        message: errMsg,
        source: isLocalProvider ? 'LOCAL_PROTOTYPE' : 'PROVIDER_VERIFIED',
      };
    }
  }

  /**
   * Queries circuit-specific state (getLoanStatus or getLoanDetails).
   */
  async queryCircuitState<T = unknown>(
    circuitName: string,
    params?: Record<string, unknown>,
    loanRegistry?: LoanRegistry
  ): Promise<ContractStateInspectionResult<T>> {
    return this.inspectContractState(
      {
        circuitName,
        loanId: params?.loanId as string,
      },
      loanRegistry
    ) as Promise<ContractStateInspectionResult<T>>;
  }
}

let serviceInstance: ContractStateInspectionService | null = null;

/**
 * Returns the singleton instance of ContractStateInspectionService.
 */
export function getContractStateInspectionService(
  deploymentService?: ContractDeploymentService,
  networkConfigService?: NetworkConfigService,
  provider?: ContractStateProvider
): ContractStateInspectionService {
  if (!serviceInstance) {
    serviceInstance = new ContractStateInspectionService(
      deploymentService,
      networkConfigService,
      provider
    );
  }
  return serviceInstance;
}

/**
 * Resets the singleton instance (primarily for unit testing).
 */
export function resetContractStateInspectionService(
  initialService?: ContractStateInspectionService
): ContractStateInspectionService {
  serviceInstance = initialService ?? null;
  return serviceInstance ?? getContractStateInspectionService();
}
