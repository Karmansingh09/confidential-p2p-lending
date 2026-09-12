import type {
  WalletProviderKind,
  WalletDetectionStatus,
  WalletAccountIdentity,
  WalletNetworkInfo,
  WalletCapabilitySet,
} from './wallet-adapter.ts';
import type { AccountRole } from './account.ts';
import type { LoanDetailsModel } from './index.ts';

/**
 * Formal lifecycle states of a wallet session.
 * Clearly separates connected sessions from various disconnection and failure modes.
 */
export type WalletSessionStatus =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'UNSUPPORTED'
  | 'REJECTED'
  | 'FAILED';

/**
 * Standard error codes for wallet session operations.
 */
export type WalletSessionErrorCode =
  | 'WALLET_NOT_DETECTED'
  | 'USER_REJECTED'
  | 'CONNECTION_FAILED'
  | 'UNSUPPORTED_PROVIDER'
  | 'SESSION_EXPIRED'
  | 'NOT_CONNECTED'
  | 'ALREADY_CONNECTING';

/**
 * Strongly typed domain error for wallet session failures.
 * Sanitized to ensure zero exposure of sensitive credentials or internal stack details.
 */
export class WalletSessionError extends Error {
  readonly code: WalletSessionErrorCode;
  readonly details?: unknown;

  constructor(
    code: WalletSessionErrorCode,
    message: string,
    details?: unknown
  ) {
    super(message);
    this.name = 'WalletSessionError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, WalletSessionError.prototype);
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
 * Comprehensive wallet session model.
 * STRICT PRIVACY GUARANTEE:
 * Contains only public account identifiers, provider metadata, and connection parameters.
 * Sensitive signing credentials, secret off-chain data, and confidential financial metrics
 * NEVER exist in this session model.
 */
export interface WalletSession {
  /** Current connection lifecycle state */
  status: WalletSessionStatus;
  /** Kind of active provider backing this session */
  providerKind: WalletProviderKind;
  /** Detection status of browser wallet connector */
  detectionStatus: WalletDetectionStatus;
  /** Connected public account identity, or null if disconnected */
  account: WalletAccountIdentity | null;
  /** Active network context information */
  network: WalletNetworkInfo;
  /** Atomic capability matrix supported by active provider in this session */
  capabilities: WalletCapabilitySet;
  /** Detailed error descriptor if in an error or rejected state */
  error: WalletSessionError | null;
  /** Epoch millisecond timestamp when session connected, or null */
  connectedAt?: number | null;
}

/**
 * Parameters for establishing or updating a wallet session.
 */
export interface WalletSessionRequest {
  providerKind?: WalletProviderKind;
  role?: AccountRole;
  customLoan?: LoanDetailsModel;
}

/**
 * Standardized outcome returned after initiating or terminating a session.
 */
export interface WalletSessionResult {
  success: boolean;
  session: WalletSession;
  error?: WalletSessionError;
}
