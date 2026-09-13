import type {
  ContractDeployment,
  ContractDeploymentStatus,
  ContractDeploymentErrorCode,
} from '../types/contract-deployment.ts';
import { ContractDeploymentError } from '../types/contract-deployment.ts';
import { validateContractAddress } from './contract-address-validator.ts';
import {
  CANONICAL_CIRCUIT_NAMES,
  COMPACT_SOURCE_FINGERPRINT,
  CONTRACT_CIRCUIT_DEFINITIONS,
} from './contract-manifest.ts';
import { getNetworkConfigService } from './network-config-service.ts';

const STORAGE_KEY = 'midnight_contract_deployment_v1';

/**
 * Default offline local prototype deployment configuration.
 * Contains ZERO fabricated addresses, synthetic tx hashes, or fake block numbers.
 */
export const DEFAULT_UNCONFIGURED_DEPLOYMENT: Readonly<ContractDeployment> = Object.freeze({
  contractId: 'confidential-p2p-lending-compact',
  contractName: 'MicroLendingCompactContract',
  networkId: null,
  environment: null,
  contractAddress: null,
  deploymentTransactionId: null,
  deploymentBlockHeight: null,
  deployedAt: null,
  status: 'NOT_DEPLOYED',
  sourceFingerprint: COMPACT_SOURCE_FINGERPRINT,
  circuitNames: CANONICAL_CIRCUIT_NAMES,
  circuitManifest: CONTRACT_CIRCUIT_DEFINITIONS,
  isVerified: false,
  isPrototype: true,
});

export interface DeploymentValidationResult {
  valid: boolean;
  isValid: boolean;
  errors: string[];
  error?: string;
  code?: ContractDeploymentErrorCode;
  errorCode?: ContractDeploymentErrorCode;
  status?: ContractDeploymentStatus;
}

/**
 * Service managing the configuration and validation boundary for a deployed
 * Midnight Compact contract.
 *
 * CRITICAL INVARIANTS:
 * 1. Default state is NOT_DEPLOYED or UNCONFIGURED.
 * 2. READY is reached IF AND ONLY IF valid address, matching network, known circuits,
 *    and valid network config are satisfied.
 * 3. Never fabricates contract addresses, block numbers, or confirmations.
 * 4. Never mutates LoanRegistry.
 */
export class ContractDeploymentService {
  private deployment: ContractDeployment;

  constructor(initialDeployment?: Partial<ContractDeployment>) {
    this.deployment = initialDeployment
      ? { ...DEFAULT_UNCONFIGURED_DEPLOYMENT, ...initialDeployment }
      : (this.loadFromStorage() ?? { ...DEFAULT_UNCONFIGURED_DEPLOYMENT });
  }

  /**
   * Retrieves the current contract deployment configuration.
   */
  getDeployment(): ContractDeployment {
    return { ...this.deployment };
  }

  /**
   * Returns current deployment status.
   */
  getDeploymentStatus(): ContractDeploymentStatus {
    return this.deployment.status;
  }

  /**
   * Asserts that contract is configured and deployed; throws ContractDeploymentError otherwise.
   */
  requireDeployment(): ContractDeployment {
    if (this.deployment.status === 'NOT_DEPLOYED' || !this.deployment.contractAddress) {
      throw new ContractDeploymentError(
        'NOT_DEPLOYED',
        'Contract is not deployed or not configured.'
      );
    }
    const validation = this.validateDeployment();
    if (!validation.isValid) {
      throw new ContractDeploymentError(
        validation.errorCode ?? 'NOT_CONFIGURED',
        validation.error ?? 'Contract deployment configuration is invalid.'
      );
    }
    return this.getDeployment();
  }

  /**
   * Validates a candidate deployment configuration against architectural invariants.
   */
  validateDeployment(candidateOrExpectedNetwork?: ContractDeployment | string): DeploymentValidationResult {
    let candidate: ContractDeployment;
    let expectedNetworkId: string | null = null;

    if (typeof candidateOrExpectedNetwork === 'string') {
      candidate = this.deployment;
      expectedNetworkId = candidateOrExpectedNetwork;
    } else if (candidateOrExpectedNetwork && typeof candidateOrExpectedNetwork === 'object') {
      candidate = candidateOrExpectedNetwork;
    } else {
      candidate = this.deployment;
    }

    const errors: string[] = [];

    // 1. Check if invalid
    if (candidate.status === 'INVALID') {
      return {
        valid: false,
        isValid: false,
        status: 'INVALID',
        errors: ['Contract deployment status is INVALID.'],
        error: 'Contract deployment status is INVALID.',
        code: 'INVALID_STATUS',
        errorCode: 'INVALID_STATUS',
      };
    }

    // 2. Validate contract address
    if (!candidate.contractAddress) {
      errors.push('Missing contract address.');
      return {
        valid: false,
        isValid: false,
        status: candidate.status ?? 'NOT_DEPLOYED',
        errors,
        error: errors[0],
        code: 'NOT_CONFIGURED',
        errorCode: 'NOT_CONFIGURED',
      };
    }

    const addrValidation = validateContractAddress(candidate.contractAddress);
    if (!addrValidation.valid) {
      const errMsg = addrValidation.error ?? 'Invalid contract address structure.';
      errors.push(errMsg);
      return {
        valid: false,
        isValid: false,
        status: candidate.status,
        errors,
        error: errMsg,
        code: 'INVALID_ADDRESS',
        errorCode: 'INVALID_ADDRESS',
      };
    }

    // 3. Network binding validation
    if (expectedNetworkId) {
      if (candidate.networkId !== expectedNetworkId) {
        const errMsg = `Contract deployment network "${candidate.networkId}" does not match expected network "${expectedNetworkId}".`;
        errors.push(errMsg);
        return {
          valid: false,
          isValid: false,
          status: candidate.status,
          errors,
          error: errMsg,
          code: 'NETWORK_MISMATCH',
          errorCode: 'NETWORK_MISMATCH',
        };
      }
    } else {
      if (!candidate.networkId) {
        errors.push('Contract deployment network ID is missing.');
        return {
          valid: false,
          isValid: false,
          status: candidate.status,
          errors,
          error: errors[0],
          code: 'NETWORK_MISMATCH',
          errorCode: 'NETWORK_MISMATCH',
        };
      }
    }

    // 4. Circuit manifest verification
    if (!candidate.circuitNames || candidate.circuitNames.length === 0) {
      errors.push('Contract deployment does not declare supported circuit names.');
      return {
        valid: false,
        isValid: false,
        status: candidate.status,
        errors,
        error: errors[0],
        code: 'CIRCUIT_MISMATCH',
        errorCode: 'CIRCUIT_MISMATCH',
      };
    }

    for (const reqCircuit of CANONICAL_CIRCUIT_NAMES) {
      if (!candidate.circuitNames.includes(reqCircuit)) {
        errors.push(`Required circuit "${reqCircuit}" is missing from deployment manifest.`);
        return {
          valid: false,
          isValid: false,
          status: candidate.status,
          errors,
          error: errors[0],
          code: 'CIRCUIT_MISMATCH',
          errorCode: 'CIRCUIT_MISMATCH',
        };
      }
    }

    // 5. Source fingerprint consistency check
    if (candidate.sourceFingerprint && candidate.sourceFingerprint !== COMPACT_SOURCE_FINGERPRINT) {
      errors.push('Contract source fingerprint mismatch with local Compact source.');
      return {
        valid: false,
        isValid: false,
        status: candidate.status,
        errors,
        error: errors[0],
        code: 'SOURCE_MISMATCH',
        errorCode: 'SOURCE_MISMATCH',
      };
    }

    return {
      valid: true,
      isValid: true,
      status: candidate.status,
      errors: [],
    };
  }

  /**
   * Updates and validates deployment configuration.
   */
  configureDeployment(updates: Partial<ContractDeployment>): ContractDeployment {
    const candidate: ContractDeployment = {
      ...this.deployment,
      ...updates,
      updatedAt: Date.now(),
    } as ContractDeployment;

    // Normalise address if provided
    if (candidate.contractAddress) {
      const addrRes = validateContractAddress(candidate.contractAddress);
      if (addrRes.valid && addrRes.normalizedAddress) {
        candidate.contractAddress = addrRes.normalizedAddress;
      }
    }

    // Evaluate candidate state
    const validation = this.validateDeployment(candidate);

    if (candidate.contractAddress && validation.valid) {
      candidate.status = updates.status ?? 'CONFIGURED';
    } else if (!candidate.contractAddress) {
      candidate.status = updates.status ?? 'UNCONFIGURED';
    } else {
      candidate.status = 'INVALID';
    }

    this.deployment = candidate;
    this.saveToStorage(candidate);
    return { ...this.deployment };
  }

  /**
   * Replaces full deployment state directly.
   */
  setDeployment(deployment: Partial<ContractDeployment>): void {
    this.deployment = { ...DEFAULT_UNCONFIGURED_DEPLOYMENT, ...this.deployment, ...deployment } as ContractDeployment;
    this.saveToStorage(this.deployment);
  }

  /**
   * Resets deployment to unconfigured state with null address and metadata.
   */
  clearDeployment(): void {
    const activeNetwork = getNetworkConfigService().getNetworkConfig();
    this.deployment = {
      ...DEFAULT_UNCONFIGURED_DEPLOYMENT,
      networkId: activeNetwork.networkId ?? 'midnight-prototype-local',
      environment: activeNetwork.environment,
      status: 'NOT_DEPLOYED',
      contractAddress: null,
      deploymentTransactionId: null,
      deploymentBlockHeight: null,
      deployedAt: null,
      isVerified: false,
    };
    this.saveToStorage(this.deployment);
  }

  /**
   * Resets deployment to default prototype configuration.
   */
  reset(): void {
    this.deployment = { ...DEFAULT_UNCONFIGURED_DEPLOYMENT };
    this.clearStorage();
  }

  /**
   * Quick predicate to test if contract deployment is ready for transaction execution.
   */
  isReady(): boolean {
    return (
      (this.deployment.status === 'READY' || this.deployment.status === 'CONFIGURED') &&
      this.validateDeployment().valid
    );
  }

  // ---------------------------------------------------------------------------
  // Safe Storage Persistence (Public Metadata Only)
  // ---------------------------------------------------------------------------

  private loadFromStorage(): ContractDeployment | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return null;
      }
      const raw = window.localStorage[STORAGE_KEY];
      if (!raw || typeof raw !== 'string') {
        return null;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !parsed.contractId) {
        return null;
      }

      return {
        contractId: String(parsed.contractId),
        contractName: String(parsed.contractName ?? 'Confidential P2P Lending Compact Contract'),
        networkId: parsed.networkId ? String(parsed.networkId) : null,
        environment: parsed.environment ?? null,
        contractAddress: parsed.contractAddress ? String(parsed.contractAddress) : null,
        deploymentTransactionId: parsed.deploymentTransactionId ? String(parsed.deploymentTransactionId) : null,
        deploymentBlockHeight: parsed.deploymentBlockHeight ? BigInt(parsed.deploymentBlockHeight) : null,
        deployedAt: parsed.deployedAt ? Number(parsed.deployedAt) : null,
        status: parsed.status ?? 'UNCONFIGURED',
        sourceFingerprint: parsed.sourceFingerprint ? String(parsed.sourceFingerprint) : null,
        circuitNames: Array.isArray(parsed.circuitNames) ? parsed.circuitNames : CANONICAL_CIRCUIT_NAMES,
        isVerified: Boolean(parsed.isVerified),
        isPrototype: Boolean(parsed.isPrototype),
      };
    } catch {
      return null;
    }
  }

  private saveToStorage(deployment: ContractDeployment): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }
      const serialized = JSON.stringify({
        contractId: deployment.contractId,
        contractName: deployment.contractName,
        networkId: deployment.networkId,
        environment: deployment.environment,
        contractAddress: deployment.contractAddress,
        deploymentTransactionId: deployment.deploymentTransactionId,
        deploymentBlockHeight: deployment.deploymentBlockHeight ? deployment.deploymentBlockHeight.toString() : null,
        deployedAt: deployment.deployedAt,
        status: deployment.status,
        sourceFingerprint: deployment.sourceFingerprint,
        circuitNames: deployment.circuitNames,
        isVerified: deployment.isVerified,
        isPrototype: deployment.isPrototype,
      });
      window.localStorage[STORAGE_KEY] = serialized;
    } catch {
      // Safe non-blocking
    }
  }

  private clearStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        delete window.localStorage[STORAGE_KEY];
      }
    } catch {
      // Safe non-blocking
    }
  }
}

// Global singleton instance
let serviceInstance: ContractDeploymentService | null = null;

export function getContractDeploymentService(): ContractDeploymentService {
  if (!serviceInstance) {
    serviceInstance = new ContractDeploymentService();
  }
  return serviceInstance;
}

export function setContractDeploymentService(service: ContractDeploymentService): void {
  serviceInstance = service;
}

export function resetContractDeploymentService(initialDeployment?: Partial<ContractDeployment>): ContractDeploymentService {
  serviceInstance = new ContractDeploymentService(initialDeployment);
  return serviceInstance;
}
