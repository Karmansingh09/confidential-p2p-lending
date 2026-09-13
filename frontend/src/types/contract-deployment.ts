import type { NetworkEnvironment } from './network-config.ts';
import type { LifecycleTransactionAction } from './transaction-orchestration.ts';

/**
 * Validated status of a Midnight Compact contract deployment.
 *
 * ANTI-FABRICATION INVARIANT:
 * Default state is NOT_DEPLOYED or UNCONFIGURED. The READY state is reached
 * IF AND ONLY IF genuine configuration requirements are satisfied.
 */
export type ContractDeploymentStatus =
  | 'UNCONFIGURED'
  | 'CONFIGURING'
  | 'CONFIGURED'
  | 'VALIDATING'
  | 'READY'
  | 'INVALID'
  | 'NOT_DEPLOYED'
  | 'UNSUPPORTED';

/**
 * Structured specification of a deployed Midnight Compact contract.
 *
 * All fields representing real blockchain facts (address, deployment tx ID, block height)
 * must be nullable when unavailable to prevent fabrication of synthetic ledger state.
 */
export interface ContractDeployment {
  /** Unique application-level identifier for the contract instance */
  contractId: string;
  /** Human-readable display label for the contract */
  contractName: string;
  /** Authentic network ID if genuinely known, otherwise null */
  networkId: string | null;
  /** Execution environment classification, or null if unconfigured */
  environment: NetworkEnvironment | null;
  /** Genuine Midnight contract address (32-byte hex), or null if unconfigured */
  contractAddress: string | null;
  /** Genuine deployment transaction hash, or null if unconfirmed */
  deploymentTransactionId: string | null;
  /** Genuine blockchain block height at deployment, or null if unconfirmed */
  deploymentBlockHeight: bigint | null;
  /** Epoch millisecond timestamp of deployment, or null */
  deployedAt: number | null;
  /** Current deployment lifecycle state */
  status: ContractDeploymentStatus;
  /** Deterministic cryptographic hash (SHA-256) of Compact source code */
  sourceFingerprint: string | null;
  /** Canonical circuit names supported by this contract */
  circuitNames: readonly string[];
  /** Manifest definitions for canonical circuits */
  circuitManifest?: readonly ContractCircuitDefinition[];
  /** Whether the on-chain bytecode has been independently verified */
  isVerified: boolean;
  /** Indicates whether running in local offline prototype simulation */
  isPrototype: boolean;
}

/**
 * Classification for Compact contract circuits.
 */
export type ContractCircuitClassification =
  | 'READ'
  | 'WRITE'
  | 'STATE_READ'
  | 'LOCAL_PROOF'
  | 'TRANSACTION_EXECUTION';

/**
 * Metadata descriptor for a canonical Compact smart contract circuit.
 */
export interface ContractCircuitDefinition {
  /** Canonical circuit identifier matching contracts/src/index.compact */
  name: string;
  /** Optional alias for name */
  circuitName?: string;
  /** Human-readable explanation of circuit function */
  purpose: string;
  /** Whether circuit can be invoked directly by external callers */
  callable: boolean;
  /** Whether caller must possess an active connected wallet identity */
  requiresWallet: boolean;
  /** Whether execution requires generating a client-side Zero-Knowledge proof */
  requiresProof: boolean;
  /** Whether execution requires signing a wallet transaction */
  requiresSignature: boolean;
  /** Whether execution requires submitting a transaction to the network ledger */
  requiresSubmission: boolean;
  /** High-level lifecycle action mapped 1:1 to this circuit, if applicable */
  action?: LifecycleTransactionAction;
  /** Circuit operational classification */
  classification: ContractCircuitClassification;
  /** Whether circuit is read-only without state mutation */
  isReadOnly?: boolean;
}

/**
 * Strongly typed error codes for contract deployment validation and interaction.
 */
export type ContractDeploymentErrorCode =
  | 'NOT_CONFIGURED'
  | 'NOT_DEPLOYED'
  | 'INVALID_ADDRESS'
  | 'NETWORK_MISMATCH'
  | 'DEPLOYMENT_NOT_FOUND'
  | 'CONTRACT_NOT_VERIFIED'
  | 'CIRCUIT_MISMATCH'
  | 'SOURCE_MISMATCH'
  | 'UNSUPPORTED_NETWORK'
  | 'INVALID_CONFIGURATION'
  | 'PROVIDER_UNAVAILABLE'
  | 'INVALID_PARAMS'
  | 'INVALID_STATUS';

/**
 * Typed domain error representing contract deployment configuration failures.
 */
export class ContractDeploymentError extends Error {
  readonly code: ContractDeploymentErrorCode;
  readonly details?: unknown;

  constructor(code: ContractDeploymentErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ContractDeploymentError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ContractDeploymentError.prototype);
  }
}
