/**
 * Authoritative On-Chain Contract State Inspection Domain Models.
 *
 * CRITICAL ARCHITECTURAL AXIOMS:
 * 1. LOCAL REGISTRY STATE != PROVIDER-READ LEDGER STATE != VERIFIED CONTRACT DEPLOYMENT != CANONICAL APPLICATION STATE
 * 2. ZERO FABRICATION: Local prototype mode never invents synthetic block heights, transaction hashes, or fake confirmations.
 * 3. READ-ONLY SCOPE: State inspection queries NEVER perform transactions, sign messages, submit broadcasts, or mutate LoanRegistry.
 * 4. STRICT ZERO-KNOWLEDGE PRIVACY: Zero private underwriting metrics, confidential credentials, or secret witnesses.
 */

/**
 * Discrete lifecycle statuses for contract state inspection.
 */
export type ContractStateInspectionStatus =
  | 'NOT_CHECKED'
  | 'CHECKING'
  | 'AVAILABLE'
  | 'VERIFIED'
  | 'NOT_DEPLOYED'
  | 'NETWORK_MISMATCH'
  | 'UNAVAILABLE'
  | 'UNSUPPORTED'
  | 'FAILED';

/**
 * Granular architectural reasons explaining contract state inspection outcomes.
 */
export type ContractStateInspectionReason =
  | 'CONTRACT_NOT_CONFIGURED'
  | 'CONTRACT_NOT_DEPLOYED'
  | 'CONTRACT_VERIFICATION_UNAVAILABLE'
  | 'NETWORK_MISMATCH'
  | 'PROVIDER_UNAVAILABLE'
  | 'STATE_QUERY_UNSUPPORTED'
  | 'STATE_QUERY_FAILED'
  | 'STATE_FOUND'
  | 'STATE_NOT_FOUND'
  | 'LOCAL_PROTOTYPE'
  | 'INVALID_CONTRACT_ADDRESS'
  | 'UNKNOWN_PROVIDER_STATE';

/**
 * Source of contract state data.
 */
export type ContractStateSource = 'LOCAL_PROTOTYPE' | 'PROVIDER_VERIFIED' | 'NONE';

/**
 * Authoritative public contract state snapshot.
 * STRICT PRIVACY: Contains strictly public on-chain or simulation metadata.
 */
export interface ContractStateSnapshot {
  /** Contract address evaluated, or null if unconfigured */
  contractAddress: string | null;
  /** Network identifier evaluated */
  networkId: string | null;
  /** Epoch millisecond timestamp of last inspection */
  inspectedAt: number | null;
  /** Genuine on-chain block height reported by network, or null if local prototype / unconfirmed */
  blockHeight: bigint | null;
  /** Whether the underlying deployment is verified on-chain */
  deploymentVerified: boolean;
  /** Whether public state is available from the provider */
  stateAvailable: boolean;
  /** High-level state inspection status */
  status: ContractStateInspectionStatus;
  /** Granular technical reason for current inspection status */
  reason: ContractStateInspectionReason;
  /** Optional state version descriptor if reported */
  stateVersion?: string | number | null;
  /** Optional raw state root or hash reference */
  rawStateReference?: string | null;
  /** Source provenance of the inspected state */
  source: ContractStateSource;
  /** Public parsed state attributes */
  data?: Record<string, unknown> | null;
}

/**
 * Request payload for contract state inspection.
 */
export interface ContractStateInspectionRequest {
  /** Target contract address override */
  contractAddress?: string | null;
  /** Target network ID override */
  networkId?: string | null;
  /** Canonical circuit name (e.g. 'getLoanStatus', 'getLoanDetails') */
  circuitName?: string;
  /** Target agreement identifier */
  loanId?: string;
  /** Specific state storage key */
  stateKey?: string;
  /** State reference or block hash context */
  reference?: string | null;
  /** Historical block height query target */
  blockHeight?: bigint | null;
}

/**
 * Standardized result of a contract state inspection query.
 */
export interface ContractStateInspectionResult<T = unknown> {
  /** Whether state inspection query succeeded */
  success: boolean;
  /** Lifecycle inspection status */
  status: ContractStateInspectionStatus;
  /** Technical reason code */
  reason: ContractStateInspectionReason;
  /** Authoritative state snapshot */
  snapshot: ContractStateSnapshot;
  /** Query outcome payload */
  data?: T | null;
  /** Detailed error message if failed */
  error?: string | null;
  /** Standardized domain error code */
  errorCode?: ContractStateInspectionReason | null;
  /** Human-readable explanation */
  message: string;
  /** Source provenance */
  source: ContractStateSource;
}

/**
 * Domain error class for contract state inspection failures.
 */
export class ContractStateInspectionError extends Error {
  readonly code: ContractStateInspectionReason;
  readonly details?: unknown;

  constructor(code: ContractStateInspectionReason, message: string, details?: unknown) {
    super(message);
    this.name = 'ContractStateInspectionError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ContractStateInspectionError.prototype);
  }
}

/**
 * Default uninspected state snapshot.
 */
export const DEFAULT_UNINSPECTED_SNAPSHOT: Readonly<ContractStateSnapshot> = Object.freeze({
  contractAddress: null,
  networkId: null,
  inspectedAt: null,
  blockHeight: null,
  deploymentVerified: false,
  stateAvailable: false,
  status: 'NOT_CHECKED',
  reason: 'CONTRACT_NOT_CONFIGURED',
  stateVersion: null,
  rawStateReference: null,
  source: 'NONE',
  data: null,
});
