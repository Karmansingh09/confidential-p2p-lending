import type { AccountRole } from './account.ts';
import type { NetworkAccount } from './network.ts';
import type {
  WalletAccountIdentity,
  WalletProviderKind,
  LaceConnectionState,
} from './wallet-adapter.ts';
import type { LoanDetailsModel } from './index.ts';

/**
 * High-level lifecycle statuses of the wallet connection handshake.
 *
 * CRITICAL ARCHITECTURAL DISTINCTIONS:
 * 1. NOT_DETECTED: No compatible browser extension found.
 * 2. DETECTED: Extension detected on window.midnight, but NOT connected.
 * 3. CONNECTING: Connection request actively pending user permission in wallet enclave.
 * 4. CONNECTED: Connection established with public identity resolved.
 * 5. NETWORK_MISMATCH: Wallet reports a network different from the application's expected configuration.
 * 6. IDENTITY_UNAVAILABLE: Wallet connected but failed to return a valid public account identity.
 * 7. READY: Fully connected, identity resolved, network matched, and capabilities confirmed.
 * 8. REJECTED: User explicitly rejected the connection or signature request.
 * 9. FAILED: Unexpected provider or communication failure.
 * 10. UNSUPPORTED: Feature not supported in the active environment.
 */
export type WalletHandshakeStatus =
  | 'DORMANT'
  | 'DETECTING'
  | 'NOT_DETECTED'
  | 'DETECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'NETWORK_MISMATCH'
  | 'IDENTITY_UNAVAILABLE'
  | 'READY'
  | 'REJECTED'
  | 'FAILED'
  | 'UNSUPPORTED';

/**
 * Network compatibility assessment outcome.
 */
export type NetworkCompatibilityStatus = 'MATCH' | 'MISMATCH' | 'UNKNOWN';

/**
 * Standard error codes for wallet handshake operations.
 */
export type WalletHandshakeErrorCode =
  | 'WALLET_NOT_DETECTED'
  | 'USER_REJECTED'
  | 'CONNECTION_FAILED'
  | 'NETWORK_MISMATCH'
  | 'UNKNOWN_NETWORK'
  | 'IDENTITY_UNAVAILABLE'
  | 'UNSUPPORTED_PROVIDER'
  | 'CAPABILITY_MISMATCH'
  | 'NOT_CONNECTED';

/**
 * Strongly typed domain error representing wallet connection handshake failures.
 * Sanitized to prevent credential leakage.
 */
export class WalletHandshakeError extends Error {
  readonly code: WalletHandshakeErrorCode;
  readonly details?: unknown;

  constructor(code: WalletHandshakeErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'WalletHandshakeError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, WalletHandshakeError.prototype);
  }

  toJSON(): { name: string; code: string; message: string } {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
    };
  }
}

/**
 * Atomic capabilities verified during the wallet handshake.
 */
export interface WalletHandshakeCapabilities {
  /** Able to read public on-chain agreement state */
  canReadLedger: boolean;
  /** Able to compute local zero-knowledge proofs */
  canCreateProof: boolean;
  /** Able to expose caller's public account key */
  canReadIdentity: boolean;
  /** Able to sign transactions with enclave signatures */
  canSign: boolean;
  /** Able to broadcast signed transactions to the Midnight network */
  canSubmit: boolean;
}

/**
 * Authoritative wallet handshake state representation.
 *
 * STRICT PRIVACY INVARIANT:
 * Contains ONLY public network accounts, public keys, and network identifiers.
 * Confidential borrower financial values, underwriting witnesses, and signing secrets NEVER enter this state.
 */
export interface WalletHandshakeState {
  /** Current stage of the handshake state machine */
  status: WalletHandshakeStatus;
  /** Whether the wallet connector extension was detected */
  isDetected: boolean;
  /** Whether an active connection session has been established */
  isConnected: boolean;
  /** Whether the public account key and identity were resolved */
  identityResolved: boolean;
  /** Resolved public account representation */
  account: NetworkAccount | WalletAccountIdentity | null;
  /** Expected network identifier configured in NetworkConfigService */
  expectedNetwork: string;
  /** Actual network identifier reported by the wallet, or null if unknown */
  walletNetwork: string | null;
  /** Compatibility evaluation between expected and reported networks */
  networkCompatibility: NetworkCompatibilityStatus;
  /** Boolean indicating whether reported network is strictly compatible */
  networkCompatible: boolean;
  /** Human-readable display label for reported network */
  networkName: string | null;
  /** Formal 9-state Midnight Lace connection state */
  laceConnectionState: LaceConnectionState;
  /** Verified atomic capabilities */
  capabilities: WalletHandshakeCapabilities;
  /** Whether the wallet is fully ready to sign and broadcast on-chain transactions */
  isTransactionCapable: boolean;
  /** Structured error descriptor if handshake failed or encountered an error */
  error: WalletHandshakeError | null;
  /** Timestamp when this handshake state snapshot was evaluated */
  timestamp: number;
}

/**
 * Parameters for requesting a wallet connection handshake.
 */
export interface WalletHandshakeRequest {
  providerKind?: WalletProviderKind;
  role?: AccountRole;
  customLoan?: LoanDetailsModel;
}

/**
 * Outcome returned after initiating or refreshing a wallet handshake.
 */
export interface WalletHandshakeResult {
  success: boolean;
  state: WalletHandshakeState;
  error?: WalletHandshakeError | null;
}
