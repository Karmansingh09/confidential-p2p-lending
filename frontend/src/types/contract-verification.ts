/**
 * Discrete lifecycle verification statuses for a configured Midnight Compact contract.
 *
 * ANTI-FABRICATION & VERIFICATION INVARIANTS:
 * - A configured address stored in memory or storage is merely configuration.
 * - VERIFIED is reached IF AND ONLY IF genuine verification against a network provider/indexer confirms existence.
 * - Default state is NOT_CHECKED.
 */
export type ContractVerificationStatus =
  | 'NOT_CHECKED'
  | 'CHECKING'
  | 'VERIFIED'
  | 'NOT_DEPLOYED'
  | 'NETWORK_MISMATCH'
  | 'INVALID'
  | 'UNAVAILABLE'
  | 'UNSUPPORTED'
  | 'FAILED';

/**
 * Granular architectural reasons explaining the verification outcome.
 */
export type ContractVerificationReason =
  | 'NO_CONTRACT_CONFIGURED'
  | 'ADDRESS_INVALID'
  | 'NETWORK_NOT_CONFIGURED'
  | 'NETWORK_MISMATCH'
  | 'CONTRACT_NOT_FOUND'
  | 'CONTRACT_FOUND'
  | 'PROVIDER_UNAVAILABLE'
  | 'INDEXER_UNAVAILABLE'
  | 'VERIFICATION_UNSUPPORTED'
  | 'VERIFICATION_FAILED'
  | 'SOURCE_FINGERPRINT_UNVERIFIED'
  | 'MANIFEST_UNVERIFIED';

/**
 * Structured public technical verification result.
 *
 * All blockchain metadata (transaction ID, block height, timestamps, fingerprints)
 * must remain strictly nullable unless genuinely returned by an authoritative network node or indexer.
 * Never contains sensitive underwriting metrics or private credentials.
 */
export interface ContractVerificationResult {
  /** High-level verification lifecycle status */
  status: ContractVerificationStatus;
  /** Granular technical reason for current status */
  reason: ContractVerificationReason;
  /** Normalized 32-byte hex address evaluated, or null if unconfigured */
  contractAddress: string | null;
  /** Network identifier expected by active application configuration */
  expectedNetworkId: string | null;
  /** Network identifier genuinely observed from provider/indexer, or null */
  observedNetworkId: string | null;
  /** Genuine on-chain deployment transaction hash, or null if unconfirmed */
  deploymentTransactionId: string | null;
  /** Genuine on-chain block height at deployment, or null if unconfirmed */
  deploymentBlockHeight: bigint | null;
  /** Genuine epoch millisecond timestamp of deployment, or null */
  deployedAt: number | null;
  /** Epoch millisecond timestamp when this verification check occurred */
  verificationTimestamp: number;
  /** Cryptographic source code fingerprint (SHA-256) of Compact source, or null */
  sourceFingerprint: string | null;
  /** Cryptographic circuit manifest fingerprint, or null */
  manifestFingerprint: string | null;
  /** Technical error message if verification encountered an exception */
  error?: string | null;
}

/**
 * Public technical metadata regarding a deployed contract instance.
 * Blockchain-specific values remain nullable when unconfirmed.
 */
export interface ContractDeploymentMetadata {
  contractAddress: string;
  networkId?: string | null;
  deploymentTransactionId?: string | null;
  deploymentBlockHeight?: bigint | null;
  deployedAt?: number | null;
  sourceFingerprint?: string | null;
  manifestFingerprint?: string | null;
}

/**
 * Public identification properties of a contract on a target network.
 */
export interface ContractIdentity {
  contractAddress: string;
  networkId?: string | null;
  contractName?: string;
}

/**
 * Bytecode or source metadata for contract verification, only when genuinely supported.
 */
export interface ContractCodeMetadata {
  bytecodeHash?: string | null;
  sourceFingerprint?: string | null;
  isVerified?: boolean;
}

/**
 * Machine-readable error codes for contract verification failures.
 */
export type ContractVerificationErrorCode =
  | 'NO_CONTRACT_CONFIGURED'
  | 'ADDRESS_INVALID'
  | 'NETWORK_NOT_CONFIGURED'
  | 'NETWORK_MISMATCH'
  | 'CONTRACT_NOT_FOUND'
  | 'PROVIDER_UNAVAILABLE'
  | 'INDEXER_UNAVAILABLE'
  | 'VERIFICATION_UNSUPPORTED'
  | 'VERIFICATION_FAILED'
  | 'SOURCE_FINGERPRINT_UNVERIFIED'
  | 'MANIFEST_UNVERIFIED';

/**
 * Typed domain error representing contract deployment verification failures.
 */
export class ContractVerificationError extends Error {
  readonly code: ContractVerificationErrorCode;
  readonly details?: unknown;

  constructor(code: ContractVerificationErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ContractVerificationError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ContractVerificationError.prototype);
  }
}
