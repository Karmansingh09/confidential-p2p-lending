import type {
  ContractVerificationResult,
  ContractVerificationStatus,
  ContractVerificationReason,
} from '../types/contract-verification.ts';
import { validateContractAddress } from './contract-address-validator.ts';
import {
  COMPACT_SOURCE_FINGERPRINT,
} from './contract-manifest.ts';
import {
  ContractDeploymentService,
  getContractDeploymentService,
} from './contract-deployment-service.ts';
import {
  NetworkConfigService,
  getNetworkConfigService,
} from './network-config-service.ts';
import {
  type ContractVerificationProvider,
  createDefaultVerificationProvider,
} from './contract-verification-provider.ts';

export const DEFAULT_UNVERIFIED_RESULT: Readonly<ContractVerificationResult> = Object.freeze({
  status: 'NOT_CHECKED',
  reason: 'NO_CONTRACT_CONFIGURED',
  contractAddress: null,
  expectedNetworkId: null,
  observedNetworkId: null,
  deploymentTransactionId: null,
  deploymentBlockHeight: null,
  deployedAt: null,
  verificationTimestamp: 0,
  sourceFingerprint: null,
  manifestFingerprint: null,
  error: null,
});

type VerificationListener = (result: ContractVerificationResult) => void;

/**
 * Service managing read-only verification of on-chain Midnight Compact contract deployments.
 *
 * CRITICAL ARCHITECTURAL INVARIANTS:
 * 1. CONFIGURED ADDRESS != ON-CHAIN DEPLOYMENT:
 *    A contract address stored in memory/localStorage is only configuration.
 *    It must never automatically become READY or VERIFIED merely because it is syntactically valid.
 * 2. WALLET CONNECTION != CONTRACT DEPLOYMENT:
 *    A connected wallet does not prove that the contract exists.
 * 3. MANIFEST != BYTECODE PROOF:
 *    Local circuit manifest describes the interface, not on-chain existence.
 * 4. AUTHORITATIVE PROVIDER RESPONSES ONLY:
 *    Never fabricates deployment transaction IDs, block heights, timestamps, or confirmations.
 * 5. HONEST LOCAL PROTOTYPE:
 *    Local prototype mode never claims a real blockchain deployment exists.
 * 6. NO TRANSACTION EXECUTION:
 *    Pure read-only verification boundary.
 * 7. IMMUTABLE LOAN REGISTRY:
 *    Contract verification never mutates LoanRegistry state.
 * 8. STRICT PRIVACY:
 *    Zero confidential underwriting metrics, secret witnesses, or credentials handled.
 */
export class ContractVerificationService {
  private deploymentService: ContractDeploymentService;
  private networkConfigService: NetworkConfigService;
  private verificationProvider: ContractVerificationProvider;
  private currentResult: ContractVerificationResult;
  private listeners: Set<VerificationListener> = new Set();

  constructor(
    deploymentService?: ContractDeploymentService,
    networkConfigService?: NetworkConfigService,
    verificationProvider?: ContractVerificationProvider
  ) {
    this.deploymentService = deploymentService ?? getContractDeploymentService();
    this.networkConfigService = networkConfigService ?? getNetworkConfigService();
    const netConfig = this.networkConfigService.getNetworkConfig();
    this.verificationProvider =
      verificationProvider ?? createDefaultVerificationProvider(netConfig.environment === 'LOCAL');
    this.currentResult = { ...DEFAULT_UNVERIFIED_RESULT };
  }

  /**
   * Retrieves a copy of the current verification result.
   */
  getVerificationResult(): ContractVerificationResult {
    return { ...this.currentResult };
  }

  /**
   * Returns current verification lifecycle status.
   */
  getVerificationStatus(): ContractVerificationStatus {
    return this.currentResult.status;
  }

  /**
   * Sets or overrides the active verification provider (e.g. for testing adapter mocks).
   */
  setVerificationProvider(provider: ContractVerificationProvider): void {
    this.verificationProvider = provider;
  }

  /**
   * Gets the active verification provider.
   */
  getVerificationProvider(): ContractVerificationProvider {
    return this.verificationProvider;
  }

  /**
   * Runs the complete read-only contract deployment verification pipeline.
   *
   * @param candidateAddress Optional address override (otherwise reads configured address).
   * @param expectedNetworkId Optional network ID override (otherwise reads active network config).
   */
  async verifyDeployment(
    candidateAddress?: string,
    expectedNetworkId?: string
  ): Promise<ContractVerificationResult> {
    const now = Date.now();
    const deployment = this.deploymentService.getDeployment();
    const netConfig = this.networkConfigService.getNetworkConfig();

    const targetAddress = candidateAddress ?? deployment.contractAddress;
    const targetNetworkId = expectedNetworkId ?? netConfig.networkId ?? (netConfig.environment === 'LOCAL' ? 'midnight-prototype-local' : null);

    // 1. Check for unconfigured address
    if (!targetAddress || targetAddress.trim() === '') {
      this.currentResult = {
        status: 'NOT_DEPLOYED',
        reason: 'NO_CONTRACT_CONFIGURED',
        contractAddress: null,
        expectedNetworkId: targetNetworkId,
        observedNetworkId: null,
        deploymentTransactionId: null,
        deploymentBlockHeight: null,
        deployedAt: null,
        verificationTimestamp: now,
        sourceFingerprint: COMPACT_SOURCE_FINGERPRINT,
        manifestFingerprint: null,
        error: 'No contract address is configured for deployment verification.',
      };
      this.deploymentService.applyVerificationResult?.(this.currentResult);
      this.notifyListeners();
      return this.getVerificationResult();
    }

    // 2. Validate contract address structure (32 bytes hex)
    const addrValidation = validateContractAddress(targetAddress);
    if (!addrValidation.valid || !addrValidation.normalizedAddress) {
      this.currentResult = {
        status: 'INVALID',
        reason: 'ADDRESS_INVALID',
        contractAddress: targetAddress,
        expectedNetworkId: targetNetworkId,
        observedNetworkId: null,
        deploymentTransactionId: null,
        deploymentBlockHeight: null,
        deployedAt: null,
        verificationTimestamp: now,
        sourceFingerprint: COMPACT_SOURCE_FINGERPRINT,
        manifestFingerprint: null,
        error: addrValidation.error ?? 'Contract address format is invalid.',
      };
      this.deploymentService.applyVerificationResult?.(this.currentResult);
      this.notifyListeners();
      return this.getVerificationResult();
    }

    const normalizedAddress = addrValidation.normalizedAddress;

    // 3. Network Configuration Check
    if (netConfig.status !== 'CONFIGURED' || !targetNetworkId) {
      this.currentResult = {
        status: 'UNAVAILABLE',
        reason: 'NETWORK_NOT_CONFIGURED',
        contractAddress: normalizedAddress,
        expectedNetworkId: null,
        observedNetworkId: null,
        deploymentTransactionId: null,
        deploymentBlockHeight: null,
        deployedAt: null,
        verificationTimestamp: now,
        sourceFingerprint: COMPACT_SOURCE_FINGERPRINT,
        manifestFingerprint: null,
        error: 'Network configuration is invalid or target network ID is missing.',
      };
      this.deploymentService.applyVerificationResult?.(this.currentResult);
      this.notifyListeners();
      return this.getVerificationResult();
    }

    // 4. Contract / Network Configuration Compatibility Check
    if (deployment.networkId && targetNetworkId && deployment.networkId !== targetNetworkId) {
      this.currentResult = {
        status: 'NETWORK_MISMATCH',
        reason: 'NETWORK_MISMATCH',
        contractAddress: normalizedAddress,
        expectedNetworkId: targetNetworkId,
        observedNetworkId: deployment.networkId,
        deploymentTransactionId: null,
        deploymentBlockHeight: null,
        deployedAt: null,
        verificationTimestamp: now,
        sourceFingerprint: COMPACT_SOURCE_FINGERPRINT,
        manifestFingerprint: null,
        error: `Configured contract network "${deployment.networkId}" does not match active network "${targetNetworkId}".`,
      };
      this.deploymentService.applyVerificationResult?.(this.currentResult);
      this.notifyListeners();
      return this.getVerificationResult();
    }

    // 5. Local Prototype Mode Check: Must remain honest and never claim a real blockchain deployment
    const isLocalPrototype =
      netConfig.environment === 'LOCAL' ||
      targetNetworkId === 'midnight-prototype-local' ||
      deployment.networkId === 'midnight-prototype-local';

    if (isLocalPrototype) {
      this.currentResult = {
        status: 'UNSUPPORTED',
        reason: 'VERIFICATION_UNSUPPORTED',
        contractAddress: normalizedAddress,
        expectedNetworkId: targetNetworkId,
        observedNetworkId: null,
        deploymentTransactionId: null,
        deploymentBlockHeight: null,
        deployedAt: null,
        verificationTimestamp: now,
        sourceFingerprint: COMPACT_SOURCE_FINGERPRINT,
        manifestFingerprint: null,
        error: 'Contract deployment verification is unsupported in local prototype mode.',
      };
      this.deploymentService.applyVerificationResult?.(this.currentResult);
      this.notifyListeners();
      return this.getVerificationResult();
    }

    // 6. Transition to CHECKING state
    this.currentResult = {
      status: 'CHECKING',
      reason: 'NO_CONTRACT_CONFIGURED',
      contractAddress: normalizedAddress,
      expectedNetworkId: targetNetworkId,
      observedNetworkId: null,
      deploymentTransactionId: null,
      deploymentBlockHeight: null,
      deployedAt: null,
      verificationTimestamp: now,
      sourceFingerprint: COMPACT_SOURCE_FINGERPRINT,
      manifestFingerprint: null,
      error: null,
    };
    this.deploymentService.markVerifying?.();
    this.notifyListeners();

    // 7. Query authoritative verification provider / indexer / node
    try {
      const providerResult = await this.verificationProvider.verifyContractExists(
        normalizedAddress,
        targetNetworkId
      );

      // Verify network identity consistency
      if (
        providerResult.observedNetworkId &&
        targetNetworkId &&
        providerResult.observedNetworkId !== targetNetworkId
      ) {
        this.currentResult = {
          status: 'NETWORK_MISMATCH',
          reason: 'NETWORK_MISMATCH',
          contractAddress: normalizedAddress,
          expectedNetworkId: targetNetworkId,
          observedNetworkId: providerResult.observedNetworkId,
          deploymentTransactionId: null,
          deploymentBlockHeight: null,
          deployedAt: null,
          verificationTimestamp: Date.now(),
          sourceFingerprint: COMPACT_SOURCE_FINGERPRINT,
          manifestFingerprint: null,
          error: `Provider observed network "${providerResult.observedNetworkId}" does not match target network "${targetNetworkId}".`,
        };
        this.deploymentService.applyVerificationResult?.(this.currentResult);
        this.notifyListeners();
        return this.getVerificationResult();
      }

      // Check source fingerprint consistency if provider provided one
      if (
        providerResult.sourceFingerprint &&
        providerResult.sourceFingerprint !== COMPACT_SOURCE_FINGERPRINT
      ) {
        this.currentResult = {
          status: 'INVALID',
          reason: 'SOURCE_FINGERPRINT_UNVERIFIED',
          contractAddress: normalizedAddress,
          expectedNetworkId: targetNetworkId,
          observedNetworkId: providerResult.observedNetworkId ?? targetNetworkId,
          deploymentTransactionId: providerResult.deploymentTransactionId ?? null,
          deploymentBlockHeight: providerResult.deploymentBlockHeight ?? null,
          deployedAt: providerResult.deployedAt ?? null,
          verificationTimestamp: Date.now(),
          sourceFingerprint: providerResult.sourceFingerprint,
          manifestFingerprint: providerResult.manifestFingerprint ?? null,
          error: 'On-chain contract source fingerprint does not match canonical Compact source code.',
        };
        this.deploymentService.applyVerificationResult?.(this.currentResult);
        this.notifyListeners();
        return this.getVerificationResult();
      }

      // Preserve all provider metadata exactly as returned without synthesizing placeholders
      this.currentResult = {
        status: providerResult.status,
        reason: providerResult.reason,
        contractAddress: normalizedAddress,
        expectedNetworkId: targetNetworkId,
        observedNetworkId: providerResult.observedNetworkId ?? (providerResult.status === 'VERIFIED' ? targetNetworkId : null),
        deploymentTransactionId: providerResult.deploymentTransactionId ?? null,
        deploymentBlockHeight: providerResult.deploymentBlockHeight ?? null,
        deployedAt: providerResult.deployedAt ?? null,
        verificationTimestamp: Date.now(),
        sourceFingerprint: providerResult.sourceFingerprint ?? COMPACT_SOURCE_FINGERPRINT,
        manifestFingerprint: providerResult.manifestFingerprint ?? null,
        error: providerResult.error ?? null,
      };

      this.deploymentService.applyVerificationResult?.(this.currentResult);
      this.notifyListeners();
      return this.getVerificationResult();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Verification query failed on provider endpoint.';
      this.currentResult = {
        status: 'FAILED',
        reason: 'VERIFICATION_FAILED',
        contractAddress: normalizedAddress,
        expectedNetworkId: targetNetworkId,
        observedNetworkId: null,
        deploymentTransactionId: null,
        deploymentBlockHeight: null,
        deployedAt: null,
        verificationTimestamp: Date.now(),
        sourceFingerprint: COMPACT_SOURCE_FINGERPRINT,
        manifestFingerprint: null,
        error: errMsg,
      };
      this.deploymentService.applyVerificationResult?.(this.currentResult);
      this.notifyListeners();
      return this.getVerificationResult();
    }
  }

  /**
   * Resets verification state to default NOT_CHECKED.
   */
  resetVerification(): void {
    this.currentResult = { ...DEFAULT_UNVERIFIED_RESULT };
    this.notifyListeners();
  }

  /**
   * Subscribes to verification result changes.
   */
  subscribe(listener: VerificationListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const result = this.getVerificationResult();
    for (const listener of this.listeners) {
      try {
        listener(result);
      } catch (err) {
        console.error('Error notifying contract verification listener:', err);
      }
    }
  }
}

// Global singleton instance
let serviceInstance: ContractVerificationService | null = null;

export function getContractVerificationService(
  deploymentService?: ContractDeploymentService,
  networkConfigService?: NetworkConfigService,
  verificationProvider?: ContractVerificationProvider
): ContractVerificationService {
  if (!serviceInstance || deploymentService || networkConfigService || verificationProvider) {
    serviceInstance = new ContractVerificationService(
      deploymentService,
      networkConfigService,
      verificationProvider
    );
  }
  return serviceInstance;
}

export function setContractVerificationService(service: ContractVerificationService): void {
  serviceInstance = service;
}

export function resetContractVerificationService(
  deploymentService?: ContractDeploymentService,
  networkConfigService?: NetworkConfigService,
  verificationProvider?: ContractVerificationProvider
): ContractVerificationService {
  serviceInstance = new ContractVerificationService(
    deploymentService,
    networkConfigService,
    verificationProvider
  );
  return serviceInstance;
}
