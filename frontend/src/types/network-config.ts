import type { NetworkEnvironment } from './network.ts';

export type { NetworkEnvironment };

/**
 * Canonical local prototype identifier used exclusively for deterministic tests and offline sandbox.
 * MUST NEVER be sent to the real Midnight Lace browser extension.
 */
export const LOCAL_PROTOTYPE_NETWORK_ID = 'midnight-prototype-local';

/**
 * Authentic Midnight networks accepted by the Midnight Lace DApp Connector.
 * Directly validated against Midnight Lace runtime extension error:
 * "valid networks are: mainnet, testnet, devnet, undeployed, preview, preprod"
 */
export const VALID_LACE_NETWORKS = [
  'mainnet',
  'testnet',
  'devnet',
  'undeployed',
  'preview',
  'preprod',
] as const;

export type ValidLaceNetworkId = (typeof VALID_LACE_NETWORKS)[number];

export const DEFAULT_REAL_MIDNIGHT_NETWORK_ID: ValidLaceNetworkId = 'preprod';

/**
 * Official Midnight Preprod network endpoints.
 */
export const OFFICIAL_PREPROD_NODE_URL = 'https://rpc.preprod.midnight.network';
export const OFFICIAL_PREPROD_INDEXER_URL = 'https://indexer.preprod.midnight.network/api/v3/graphql';
export const OFFICIAL_PREPROD_INDEXER_WS_URL = 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws';
export const OFFICIAL_PREPROD_PROOF_SERVER_URL = 'http://localhost:6300';

/**
 * Supported Midnight network identifiers.
 */
export type MidnightNetwork =
  | 'local-standalone'
  | 'preview-testnet'
  | 'preprod-testnet'
  | 'mainnet'
  | 'testnet'
  | 'devnet'
  | 'undeployed'
  | 'preview'
  | 'preprod';

/**
 * Validated status of a network configuration descriptor.
 */
export type NetworkConfigurationStatus =
  | 'CONFIGURED'
  | 'NOT_CONFIGURED'
  | 'INVALID';

/**
 * Error codes associated with network configuration validation.
 */
export type NetworkConfigurationErrorCode =
  | 'MISSING_REQUIRED_ENDPOINT'
  | 'UNSUPPORTED_NETWORK'
  | 'INVALID_URL_SCHEME'
  | 'INVALID_ENVIRONMENT'
  | 'UNAVAILABLE_NETWORK';

/**
 * Typed domain error for network configuration failures.
 */
export class NetworkConfigurationError extends Error {
  readonly code: NetworkConfigurationErrorCode;
  readonly details?: unknown;

  constructor(code: NetworkConfigurationErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'NetworkConfigurationError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, NetworkConfigurationError.prototype);
  }
}

/**
 * Strongly typed network endpoint specification.
 */
export interface NetworkEndpoint {
  url: string;
  protocol: 'http' | 'https' | 'ws' | 'wss';
  isAccessible?: boolean;
}

/**
 * Canonical Network Configuration definition.
 *
 * ANTI-FABRICATION & PRIVACY INVARIANTS:
 * - Does NOT hardcode fake RPC or indexer URLs.
 * - Local prototype runs with null remote endpoints.
 * - Never contains or manages sensitive underwriting metrics or confidential signing credentials.
 */
export interface NetworkConfig {
  /** Execution environment classification */
  environment: NetworkEnvironment;
  /** Human-readable display label */
  networkName: string;
  /** Authentic network ID if genuinely known, otherwise null */
  networkId?: string | null;
  /** Authenticated RPC node endpoint, or null if unconfigured */
  nodeRpcEndpoint?: NetworkEndpoint | null;
  /** Indexer GraphQL/REST endpoint, or null if unconfigured */
  indexerEndpoint?: NetworkEndpoint | null;
  /** Local or remote proof server endpoint, or null if default */
  proofServerEndpoint?: NetworkEndpoint | null;
  /** Indicates whether a compatible wallet connector was detected */
  walletConnectorAvailable: boolean;
  /** Indicates if pointing to real distributed ledger infrastructure */
  isRealNetwork: boolean;
  /** Indicates if running in offline prototype simulation */
  isPrototype: boolean;
  /** Validation status of this configuration */
  status: NetworkConfigurationStatus;
}

/**
 * Canonical official Midnight Preprod network configuration.
 */
export const OFFICIAL_PREPROD_NETWORK_CONFIG: Readonly<NetworkConfig> = Object.freeze({
  environment: 'TESTNET',
  networkName: 'Midnight Preprod Testnet',
  networkId: 'preprod',
  nodeRpcEndpoint: {
    url: OFFICIAL_PREPROD_NODE_URL,
    protocol: 'https' as const,
    isAccessible: true,
  },
  indexerEndpoint: {
    url: OFFICIAL_PREPROD_INDEXER_URL,
    protocol: 'https' as const,
    isAccessible: true,
  },
  proofServerEndpoint: {
    url: OFFICIAL_PREPROD_PROOF_SERVER_URL,
    protocol: 'http' as const,
    isAccessible: true,
  },
  walletConnectorAvailable: true,
  isRealNetwork: true,
  isPrototype: false,
  status: 'CONFIGURED',
});

/**
 * Discrete states representing wallet connector discovery and lifecycle readiness.
 *
 * CRITICAL ARCHITECTURAL DISTINCTIONS:
 * - DETECTED != CONNECTED (browser object exists != session established)
 * - CONNECTED != TRANSACTION_CAPABLE (session established != signed transaction can be submitted)
 */
export type ConnectorReadinessState =
  | 'NOT_DETECTED'
  | 'DETECTED'
  | 'INCOMPATIBLE'
  | 'CONFIGURATION_REQUIRED'
  | 'READY'
  | 'CONNECTED'
  | 'TRANSACTION_CAPABLE'
  | 'ERROR';

/**
 * Explicit typed reasons returned by the transaction readiness evaluation pipeline.
 */
export type TransactionReadinessReason =
  | 'READY'
  | 'BLOCKED_NETWORK_CONFIGURATION'
  | 'WALLET_NOT_DETECTED'
  | 'WALLET_NOT_CONNECTED'
  | 'NETWORK_MISMATCH'
  | 'UNKNOWN_WALLET_NETWORK'
  | 'UNSUPPORTED_CONNECTOR'
  | 'SIGNING_UNAVAILABLE'
  | 'SUBMISSION_UNAVAILABLE'
  | 'GUARD_VALIDATION_FAILED'
  | 'CONTRACT_NOT_DEPLOYED'
  | 'CONTRACT_NOT_CONFIGURED'
  | 'CONTRACT_INVALID'
  | 'CONTRACT_NETWORK_MISMATCH'
  | 'CONTRACT_CIRCUIT_UNAVAILABLE'
  | 'CONTRACT_VERIFICATION_UNAVAILABLE'
  | 'CONTRACT_UNVERIFIED'
  | 'STATE_INSPECTION_UNAVAILABLE'
  | 'STATE_NOT_AVAILABLE';
