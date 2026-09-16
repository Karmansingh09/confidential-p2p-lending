import type { NetworkEnvironment } from './network.ts';

export type { NetworkEnvironment };

/**
 * Supported Midnight network identifiers.
 */
export type MidnightNetwork =
  | 'local-standalone'
  | 'preview-testnet'
  | 'preprod-testnet'
  | 'mainnet';

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
  | 'CONTRACT_UNVERIFIED';
