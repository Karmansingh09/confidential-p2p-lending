import type {
  ContractVerificationResult,
  ContractDeploymentMetadata,
  ContractIdentity,
  ContractCodeMetadata,
} from '../types/contract-verification.ts';
import { COMPACT_SOURCE_FINGERPRINT } from './contract-manifest.ts';

export type {
  ContractDeploymentMetadata,
  ContractIdentity,
  ContractCodeMetadata,
};

/**
 * Read-only contract deployment verification provider abstraction.
 *
 * ARCHITECTURAL PRINCIPLES:
 * 1. Read-Only Boundary: Never deploys contracts, signs transactions, or mutates state.
 * 2. Anti-Fabrication: Only genuine provider/indexer responses may confirm existence.
 *    Never invents transaction hashes, block numbers, or timestamps.
 * 3. Honest Unsupported Boundary: If live Midnight node/indexer SDK is unavailable,
 *    reports honest UNSUPPORTED rather than pretending verification succeeded.
 */
export interface ContractVerificationProvider {
  readonly id: string;
  readonly name: string;
  readonly isSupported: boolean;

  /**
   * Verifies whether a given contract address exists on the specified network.
   */
  verifyContractExists(
    address: string,
    networkId?: string | null
  ): Promise<ContractVerificationResult>;

  /**
   * Retrieves public technical deployment metadata if genuinely supported.
   */
  getDeploymentMetadata(
    address: string,
    networkId?: string | null
  ): Promise<ContractDeploymentMetadata | null>;

  /**
   * Retrieves public contract identity descriptor.
   */
  getContractIdentity(
    address: string,
    networkId?: string | null
  ): Promise<ContractIdentity | null>;

  /**
   * Retrieves on-chain code metadata if genuinely supported.
   */
  getContractCodeMetadata(
    address: string,
    networkId?: string | null
  ): Promise<ContractCodeMetadata | null>;
}

/**
 * Local Prototype Verification Provider.
 *
 * Strictly enforces that local simulation mode never claims an on-chain blockchain deployment exists.
 */
export class LocalPrototypeVerificationProvider implements ContractVerificationProvider {
  readonly id = 'prototype-verification-provider';
  readonly name = 'Local Prototype Verification Provider';
  readonly isSupported = false;

  async verifyContractExists(
    address: string,
    networkId?: string | null
  ): Promise<ContractVerificationResult> {
    return {
      status: 'UNSUPPORTED',
      reason: 'VERIFICATION_UNSUPPORTED',
      contractAddress: address,
      expectedNetworkId: networkId ?? 'midnight-prototype-local',
      observedNetworkId: null,
      deploymentTransactionId: null,
      deploymentBlockHeight: null,
      deployedAt: null,
      verificationTimestamp: Date.now(),
      sourceFingerprint: COMPACT_SOURCE_FINGERPRINT,
      manifestFingerprint: null,
      error: 'Local prototype mode does not connect to live blockchain networks and cannot verify on-chain deployment.',
    };
  }

  async getDeploymentMetadata(
    _address: string,
    _networkId?: string | null
  ): Promise<ContractDeploymentMetadata | null> {
    return null;
  }

  async getContractIdentity(
    address: string,
    networkId?: string | null
  ): Promise<ContractIdentity | null> {
    return {
      contractAddress: address,
      networkId: networkId ?? 'midnight-prototype-local',
      contractName: 'MicroLendingCompactContract (Local Prototype)',
    };
  }

  async getContractCodeMetadata(
    _address: string,
    _networkId?: string | null
  ): Promise<ContractCodeMetadata | null> {
    return null;
  }
}

export interface MockVerificationConfig {
  mockExists?: boolean;
  mockResult?: Partial<ContractVerificationResult>;
  mockMetadata?: Partial<ContractDeploymentMetadata>;
  mockIdentity?: Partial<ContractIdentity>;
  mockCodeMetadata?: Partial<ContractCodeMetadata>;
  shouldFail?: boolean;
  errorMessage?: string;
  observedNetworkId?: string | null;
  isUnavailable?: boolean;
  isIndexerUnavailable?: boolean;
  isUnsupported?: boolean;
  networkMismatch?: boolean;
}

/**
 * Midnight / Lace Live Verification Adapter Boundary.
 *
 * Implements the ContractVerificationProvider boundary for real Midnight networks.
 * In the absence of live indexer packages, reports honest UNSUPPORTED or UNAVAILABLE
 * and provides test injection hooks.
 */
export class MidnightVerificationAdapter implements ContractVerificationProvider {
  readonly id = 'midnight-verification-adapter';
  readonly name = 'Midnight Verification Adapter';
  readonly isSupported = false;

  private mockConfig: MockVerificationConfig | null = null;

  injectMockVerifierForTesting(config: MockVerificationConfig): void {
    this.mockConfig = config;
  }

  clearMockVerifierForTesting(): void {
    this.mockConfig = null;
  }

  async verifyContractExists(
    address: string,
    networkId?: string | null
  ): Promise<ContractVerificationResult> {
    const now = Date.now();

    if (this.mockConfig) {
      if (this.mockConfig.shouldFail) {
        return {
          status: 'FAILED',
          reason: 'VERIFICATION_FAILED',
          contractAddress: address,
          expectedNetworkId: networkId ?? null,
          observedNetworkId: this.mockConfig.observedNetworkId ?? null,
          deploymentTransactionId: null,
          deploymentBlockHeight: null,
          deployedAt: null,
          verificationTimestamp: now,
          sourceFingerprint: COMPACT_SOURCE_FINGERPRINT,
          manifestFingerprint: null,
          error: this.mockConfig.errorMessage ?? 'Verification query failed on provider.',
        };
      }

      if (this.mockConfig.isUnavailable) {
        return {
          status: 'UNAVAILABLE',
          reason: 'PROVIDER_UNAVAILABLE',
          contractAddress: address,
          expectedNetworkId: networkId ?? null,
          observedNetworkId: null,
          deploymentTransactionId: null,
          deploymentBlockHeight: null,
          deployedAt: null,
          verificationTimestamp: now,
          sourceFingerprint: COMPACT_SOURCE_FINGERPRINT,
          manifestFingerprint: null,
          error: this.mockConfig.errorMessage ?? 'Node RPC provider endpoint is unavailable.',
        };
      }

      if (this.mockConfig.isIndexerUnavailable) {
        return {
          status: 'UNAVAILABLE',
          reason: 'INDEXER_UNAVAILABLE',
          contractAddress: address,
          expectedNetworkId: networkId ?? null,
          observedNetworkId: null,
          deploymentTransactionId: null,
          deploymentBlockHeight: null,
          deployedAt: null,
          verificationTimestamp: now,
          sourceFingerprint: COMPACT_SOURCE_FINGERPRINT,
          manifestFingerprint: null,
          error: this.mockConfig.errorMessage ?? 'Indexer GraphQL endpoint is unavailable.',
        };
      }

      if (this.mockConfig.isUnsupported) {
        return {
          status: 'UNSUPPORTED',
          reason: 'VERIFICATION_UNSUPPORTED',
          contractAddress: address,
          expectedNetworkId: networkId ?? null,
          observedNetworkId: null,
          deploymentTransactionId: null,
          deploymentBlockHeight: null,
          deployedAt: null,
          verificationTimestamp: now,
          sourceFingerprint: COMPACT_SOURCE_FINGERPRINT,
          manifestFingerprint: null,
          error: this.mockConfig.errorMessage ?? 'Deployment verification is unsupported.',
        };
      }

      if (this.mockConfig.networkMismatch) {
        return {
          status: 'NETWORK_MISMATCH',
          reason: 'NETWORK_MISMATCH',
          contractAddress: address,
          expectedNetworkId: networkId ?? null,
          observedNetworkId: this.mockConfig.observedNetworkId ?? 'midnight-other-network',
          deploymentTransactionId: null,
          deploymentBlockHeight: null,
          deployedAt: null,
          verificationTimestamp: now,
          sourceFingerprint: COMPACT_SOURCE_FINGERPRINT,
          manifestFingerprint: null,
          error: `Observed network "${this.mockConfig.observedNetworkId ?? 'midnight-other-network'}" does not match expected network "${networkId}".`,
        };
      }

      if (this.mockConfig.mockExists === true) {
        const custom = this.mockConfig.mockResult;
        return {
          status: 'VERIFIED',
          reason: 'CONTRACT_FOUND',
          contractAddress: address,
          expectedNetworkId: networkId ?? null,
          observedNetworkId: this.mockConfig.observedNetworkId ?? networkId ?? null,
          deploymentTransactionId: custom?.deploymentTransactionId ?? this.mockConfig.mockMetadata?.deploymentTransactionId ?? null,
          deploymentBlockHeight: custom?.deploymentBlockHeight ?? this.mockConfig.mockMetadata?.deploymentBlockHeight ?? null,
          deployedAt: custom?.deployedAt ?? this.mockConfig.mockMetadata?.deployedAt ?? null,
          verificationTimestamp: now,
          sourceFingerprint: custom?.sourceFingerprint ?? COMPACT_SOURCE_FINGERPRINT,
          manifestFingerprint: custom?.manifestFingerprint ?? null,
          error: null,
        };
      }

      if (this.mockConfig.mockExists === false) {
        return {
          status: 'NOT_DEPLOYED',
          reason: 'CONTRACT_NOT_FOUND',
          contractAddress: address,
          expectedNetworkId: networkId ?? null,
          observedNetworkId: this.mockConfig.observedNetworkId ?? networkId ?? null,
          deploymentTransactionId: null,
          deploymentBlockHeight: null,
          deployedAt: null,
          verificationTimestamp: now,
          sourceFingerprint: COMPACT_SOURCE_FINGERPRINT,
          manifestFingerprint: null,
          error: 'Contract was not found on the specified network ledger.',
        };
      }

      if (this.mockConfig.mockResult) {
        return {
          status: this.mockConfig.mockResult.status ?? 'VERIFIED',
          reason: this.mockConfig.mockResult.reason ?? 'CONTRACT_FOUND',
          contractAddress: address,
          expectedNetworkId: networkId ?? null,
          observedNetworkId: this.mockConfig.mockResult.observedNetworkId ?? networkId ?? null,
          deploymentTransactionId: this.mockConfig.mockResult.deploymentTransactionId ?? null,
          deploymentBlockHeight: this.mockConfig.mockResult.deploymentBlockHeight ?? null,
          deployedAt: this.mockConfig.mockResult.deployedAt ?? null,
          verificationTimestamp: now,
          sourceFingerprint: this.mockConfig.mockResult.sourceFingerprint ?? COMPACT_SOURCE_FINGERPRINT,
          manifestFingerprint: this.mockConfig.mockResult.manifestFingerprint ?? null,
          error: this.mockConfig.mockResult.error ?? null,
        };
      }
    }

    // Default real runtime behaviour when live indexer/node packages are pending installation
    return {
      status: 'UNSUPPORTED',
      reason: 'VERIFICATION_UNSUPPORTED',
      contractAddress: address,
      expectedNetworkId: networkId ?? null,
      observedNetworkId: null,
      deploymentTransactionId: null,
      deploymentBlockHeight: null,
      deployedAt: null,
      verificationTimestamp: now,
      sourceFingerprint: COMPACT_SOURCE_FINGERPRINT,
      manifestFingerprint: null,
      error: 'On-chain contract deployment verification is unsupported until live Midnight indexer/node SDK is integrated.',
    };
  }

  async getDeploymentMetadata(
    address: string,
    networkId?: string | null
  ): Promise<ContractDeploymentMetadata | null> {
    if (this.mockConfig && this.mockConfig.mockMetadata) {
      return {
        contractAddress: address,
        networkId: networkId ?? this.mockConfig.observedNetworkId ?? null,
        ...this.mockConfig.mockMetadata,
      };
    }
    return null;
  }

  async getContractIdentity(
    address: string,
    networkId?: string | null
  ): Promise<ContractIdentity | null> {
    if (this.mockConfig && this.mockConfig.mockIdentity) {
      return {
        contractAddress: address,
        networkId: networkId ?? this.mockConfig.observedNetworkId ?? null,
        ...this.mockConfig.mockIdentity,
      };
    }
    return null;
  }

  async getContractCodeMetadata(
    _address: string,
    _networkId?: string | null
  ): Promise<ContractCodeMetadata | null> {
    if (this.mockConfig && this.mockConfig.mockCodeMetadata) {
      return {
        ...this.mockConfig.mockCodeMetadata,
      };
    }
    return null;
  }
}

/**
 * Creates the default contract verification provider for the active environment.
 */
export function createDefaultVerificationProvider(isPrototype: boolean = true): ContractVerificationProvider {
  return isPrototype ? new LocalPrototypeVerificationProvider() : new MidnightVerificationAdapter();
}
