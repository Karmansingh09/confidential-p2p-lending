import type {
  ContractStateInspectionRequest,
  ContractStateInspectionResult,
  ContractStateSnapshot,
} from '../types/contract-state-inspection.ts';
import type { ContractStateProvider } from './contract-state-provider.ts';
import { LocalPrototypeContractStateProvider } from './contract-state-provider.ts';
import { isKnownCircuit, getCircuitDefinition } from './contract-manifest.ts';

/**
 * Configuration options for testing mock state queries against MidnightContractStateAdapter.
 */
export interface MockStateQueryConfig {
  /** If true, simulates a state query execution failure */
  shouldFail?: boolean;
  /** If true, simulates node RPC or network endpoint unreachability */
  isUnavailable?: boolean;
  /** If true, simulates unsupported state query capability */
  isUnsupported?: boolean;
  /** If true, simulates unhandled or unexpected provider state response */
  unknownProviderState?: boolean;
  /** Whether the queried contract state exists on-chain */
  stateFound?: boolean;
  /** Genuine block height reported by the network */
  blockHeight?: bigint | null;
  /** State version tag */
  stateVersion?: string | number | null;
  /** Raw on-chain state reference hash */
  rawStateReference?: string | null;
  /** State payload returned */
  data?: Record<string, unknown> | null;
  /** Custom error message */
  errorMessage?: string;
  /** Network ID observed */
  observedNetworkId?: string | null;
}

/**
 * Real Midnight Contract State Adapter.
 *
 * Establishes the authoritative boundary for reading on-chain contract state from
 * the Midnight network when an authentic provider/indexer is available.
 *
 * CRITICAL ARCHITECTURAL PRINCIPLES:
 * 1. Read-Only Boundary: Strictly inspects state; never signs transactions or alters LoanRegistry.
 * 2. Honest Fallback: In the absence of installed indexer packages, reports typed UNSUPPORTED / UNAVAILABLE.
 * 3. Anti-Fabrication: Never invents fake block heights, synthetic confirmations, or fake ledger state.
 * 4. Testing Hooks: Injected mocks enable deterministic unit testing without altering production invariants.
 */
export class MidnightContractStateAdapter implements ContractStateProvider {
  readonly id = 'midnight-contract-state-adapter';
  readonly name = 'Midnight Contract State Adapter';

  private supported: boolean;
  private mockConfig: MockStateQueryConfig | null = null;

  constructor(isSupported = false) {
    this.supported = isSupported;
  }

  get isSupported(): boolean {
    return this.supported || this.mockConfig !== null;
  }

  getProviderKind(): string {
    return 'MIDNIGHT';
  }

  isStateQuerySupported(): boolean {
    if (this.mockConfig) {
      return !this.mockConfig.isUnsupported;
    }
    return this.supported;
  }

  injectMockStateQuery(config: MockStateQueryConfig): void {
    this.mockConfig = { ...config };
  }

  clearMockStateQuery(): void {
    this.mockConfig = null;
  }

  setSupported(supported: boolean): void {
    this.supported = supported;
  }

  async inspectContractState(
    request: ContractStateInspectionRequest
  ): Promise<ContractStateInspectionResult> {
    const now = Date.now();
    const networkId = request.networkId ?? 'midnight-testnet-01';
    const contractAddress = request.contractAddress ?? null;

    // Check circuit classification if circuitName is specified
    if (request.circuitName) {
      if (!isKnownCircuit(request.circuitName)) {
        const snapshot: ContractStateSnapshot = {
          contractAddress,
          networkId,
          inspectedAt: now,
          blockHeight: null,
          deploymentVerified: false,
          stateAvailable: false,
          status: 'FAILED',
          reason: 'STATE_QUERY_UNSUPPORTED',
          source: 'PROVIDER_VERIFIED',
          data: null,
        };
        return {
          success: false,
          status: 'FAILED',
          reason: 'STATE_QUERY_UNSUPPORTED',
          snapshot,
          data: null,
          errorCode: 'STATE_QUERY_UNSUPPORTED',
          error: `Circuit "${request.circuitName}" is not defined in the canonical contract manifest.`,
          message: `Circuit "${request.circuitName}" is not defined in the canonical contract manifest.`,
          source: 'PROVIDER_VERIFIED',
        };
      }

      const circuitDef = getCircuitDefinition(request.circuitName)!;
      if (circuitDef.classification === 'TRANSACTION_EXECUTION') {
        const snapshot: ContractStateSnapshot = {
          contractAddress,
          networkId,
          inspectedAt: now,
          blockHeight: null,
          deploymentVerified: false,
          stateAvailable: false,
          status: 'FAILED',
          reason: 'STATE_QUERY_UNSUPPORTED',
          source: 'PROVIDER_VERIFIED',
          data: null,
        };
        return {
          success: false,
          status: 'FAILED',
          reason: 'STATE_QUERY_UNSUPPORTED',
          snapshot,
          data: null,
          errorCode: 'STATE_QUERY_UNSUPPORTED',
          error: `Circuit "${request.circuitName}" is a transaction-executing circuit and cannot be inspected as state.`,
          message: `Circuit "${request.circuitName}" is a transaction-executing circuit and cannot be inspected as state.`,
          source: 'PROVIDER_VERIFIED',
        };
      }

      if (circuitDef.classification === 'LOCAL_PROOF') {
        const snapshot: ContractStateSnapshot = {
          contractAddress,
          networkId,
          inspectedAt: now,
          blockHeight: null,
          deploymentVerified: false,
          stateAvailable: false,
          status: 'FAILED',
          reason: 'STATE_QUERY_UNSUPPORTED',
          source: 'PROVIDER_VERIFIED',
          data: null,
        };
        return {
          success: false,
          status: 'FAILED',
          reason: 'STATE_QUERY_UNSUPPORTED',
          snapshot,
          data: null,
          errorCode: 'STATE_QUERY_UNSUPPORTED',
          error: `Circuit "${request.circuitName}" is an off-chain local proof circuit, not a contract state query.`,
          message: `Circuit "${request.circuitName}" is an off-chain local proof circuit, not a contract state query.`,
          source: 'PROVIDER_VERIFIED',
        };
      }
    }

    // Mock evaluation path for unit & integration testing
    if (this.mockConfig) {
      if (this.mockConfig.shouldFail) {
        const snapshot: ContractStateSnapshot = {
          contractAddress,
          networkId: this.mockConfig.observedNetworkId ?? networkId,
          inspectedAt: now,
          blockHeight: null,
          deploymentVerified: false,
          stateAvailable: false,
          status: 'FAILED',
          reason: 'STATE_QUERY_FAILED',
          source: 'PROVIDER_VERIFIED',
          data: null,
        };
        return {
          success: false,
          status: 'FAILED',
          reason: 'STATE_QUERY_FAILED',
          snapshot,
          data: null,
          errorCode: 'STATE_QUERY_FAILED',
          error: this.mockConfig.errorMessage ?? 'On-chain state query failed on Midnight provider.',
          message: this.mockConfig.errorMessage ?? 'On-chain state query failed on Midnight provider.',
          source: 'PROVIDER_VERIFIED',
        };
      }

      if (this.mockConfig.isUnavailable) {
        const snapshot: ContractStateSnapshot = {
          contractAddress,
          networkId,
          inspectedAt: now,
          blockHeight: null,
          deploymentVerified: false,
          stateAvailable: false,
          status: 'UNAVAILABLE',
          reason: 'PROVIDER_UNAVAILABLE',
          source: 'PROVIDER_VERIFIED',
          data: null,
        };
        return {
          success: false,
          status: 'UNAVAILABLE',
          reason: 'PROVIDER_UNAVAILABLE',
          snapshot,
          data: null,
          errorCode: 'PROVIDER_UNAVAILABLE',
          error: this.mockConfig.errorMessage ?? 'Midnight network RPC endpoint is unavailable.',
          message: this.mockConfig.errorMessage ?? 'Midnight network RPC endpoint is unavailable.',
          source: 'PROVIDER_VERIFIED',
        };
      }

      if (this.mockConfig.isUnsupported) {
        const snapshot: ContractStateSnapshot = {
          contractAddress,
          networkId,
          inspectedAt: now,
          blockHeight: null,
          deploymentVerified: false,
          stateAvailable: false,
          status: 'UNSUPPORTED',
          reason: 'STATE_QUERY_UNSUPPORTED',
          source: 'PROVIDER_VERIFIED',
          data: null,
        };
        return {
          success: false,
          status: 'UNSUPPORTED',
          reason: 'STATE_QUERY_UNSUPPORTED',
          snapshot,
          data: null,
          errorCode: 'STATE_QUERY_UNSUPPORTED',
          error: this.mockConfig.errorMessage ?? 'State query operation is unsupported by active provider.',
          message: this.mockConfig.errorMessage ?? 'State query operation is unsupported by active provider.',
          source: 'PROVIDER_VERIFIED',
        };
      }

      if (this.mockConfig.unknownProviderState) {
        const snapshot: ContractStateSnapshot = {
          contractAddress,
          networkId,
          inspectedAt: now,
          blockHeight: null,
          deploymentVerified: false,
          stateAvailable: false,
          status: 'FAILED',
          reason: 'UNKNOWN_PROVIDER_STATE',
          source: 'PROVIDER_VERIFIED',
          data: null,
        };
        return {
          success: false,
          status: 'FAILED',
          reason: 'UNKNOWN_PROVIDER_STATE',
          snapshot,
          data: null,
          errorCode: 'UNKNOWN_PROVIDER_STATE',
          error: 'Provider returned unrecognized state format.',
          message: 'Provider returned unrecognized state format.',
          source: 'PROVIDER_VERIFIED',
        };
      }

      if (this.mockConfig.stateFound === false) {
        const snapshot: ContractStateSnapshot = {
          contractAddress,
          networkId,
          inspectedAt: now,
          blockHeight: this.mockConfig.blockHeight ?? null,
          deploymentVerified: true,
          stateAvailable: false,
          status: 'AVAILABLE',
          reason: 'STATE_NOT_FOUND',
          stateVersion: this.mockConfig.stateVersion ?? null,
          rawStateReference: this.mockConfig.rawStateReference ?? null,
          source: 'PROVIDER_VERIFIED',
          data: null,
        };
        return {
          success: true,
          status: 'AVAILABLE',
          reason: 'STATE_NOT_FOUND',
          snapshot,
          data: null,
          message: 'Contract state not found for the requested key on Midnight network.',
          source: 'PROVIDER_VERIFIED',
        };
      }

      // Successful state inspection from authentic mock
      const snapshot: ContractStateSnapshot = {
        contractAddress,
        networkId,
        inspectedAt: now,
        blockHeight: this.mockConfig.blockHeight ?? null,
        deploymentVerified: true,
        stateAvailable: true,
        status: 'VERIFIED',
        reason: 'STATE_FOUND',
        stateVersion: this.mockConfig.stateVersion ?? '1.0.0',
        rawStateReference: this.mockConfig.rawStateReference ?? null,
        source: 'PROVIDER_VERIFIED',
        data: this.mockConfig.data ?? null,
      };

      return {
        success: true,
        status: 'VERIFIED',
        reason: 'STATE_FOUND',
        snapshot,
        data: this.mockConfig.data ?? null,
        message: 'Authoritative contract state inspected successfully from Midnight network.',
        source: 'PROVIDER_VERIFIED',
      };
    }

    // Default: in the absence of installed indexer / Midnight query SDK, report honest UNSUPPORTED
    const snapshot: ContractStateSnapshot = {
      contractAddress,
      networkId,
      inspectedAt: now,
      blockHeight: null,
      deploymentVerified: false,
      stateAvailable: false,
      status: 'UNSUPPORTED',
      reason: 'STATE_QUERY_UNSUPPORTED',
      source: 'PROVIDER_VERIFIED',
      data: null,
    };

    return {
      success: false,
      status: 'UNSUPPORTED',
      reason: 'STATE_QUERY_UNSUPPORTED',
      snapshot,
      data: null,
      errorCode: 'STATE_QUERY_UNSUPPORTED',
      error: 'Live Midnight contract state queries require installed Midnight indexer/query SDK package.',
      message: 'Live Midnight contract state queries require installed Midnight indexer/query SDK package.',
      source: 'PROVIDER_VERIFIED',
    };
  }

  async queryCircuitState<T = unknown>(
    circuitName: string,
    params?: Record<string, unknown>
  ): Promise<ContractStateInspectionResult<T>> {
    return this.inspectContractState({
      circuitName,
      loanId: params?.loanId as string,
    }) as Promise<ContractStateInspectionResult<T>>;
  }

  async getStateAtReference<T = unknown>(
    reference: string,
    options?: Record<string, unknown>
  ): Promise<ContractStateInspectionResult<T>> {
    return this.inspectContractState({
      reference,
      blockHeight: options?.blockHeight as bigint,
    }) as Promise<ContractStateInspectionResult<T>>;
  }
}

/**
 * Factory helper creating the appropriate ContractStateProvider based on environment.
 */
export function createDefaultContractStateProvider(isLocal = true): ContractStateProvider {
  if (isLocal) {
    return new LocalPrototypeContractStateProvider();
  }
  return new MidnightContractStateAdapter();
}
