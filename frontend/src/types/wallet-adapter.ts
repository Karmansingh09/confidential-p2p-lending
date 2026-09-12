import type { NetworkEnvironment, ProviderCapabilities } from './network.ts';
import type { AccountRole } from './account.ts';

/**
 * Categorization of wallet providers supported or recognized by the application.
 */
export type WalletProviderKind =
  | 'LOCAL_PROTOTYPE'
  | 'MIDNIGHT'
  | 'LACE'
  | 'UNAVAILABLE';

/**
 * Detection status of a browser extension or native wallet connector.
 */
export type WalletDetectionStatus =
  | 'UNKNOWN'
  | 'DETECTED'
  | 'NOT_DETECTED'
  | 'UNSUPPORTED';

/**
 * Formal lifecycle states of the wallet adapter connection.
 */
export type WalletAdapterStatus =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'UNSUPPORTED'
  | 'ERROR';

/**
 * Public network account identity provided by a connected wallet.
 * STRICT PRIVACY GUARANTEE: Contains exclusively public identifiers.
 * No private cryptographic credentials, seed material, or financial data exist here.
 */
export interface WalletAccountIdentity {
  address: string;
  publicKey: Uint8Array | null;
  publicKeyHex: string;
  role?: AccountRole;
  displayName?: string;
}

/**
 * Structured network environment information provided by the wallet connector.
 */
export interface WalletNetworkInfo {
  environment: NetworkEnvironment;
  networkId?: string;
  networkName: string;
  isPrototype: boolean;
  isRealNetwork: boolean;
}

/**
 * Capability set describing what actions the connected wallet can perform.
 */
export type WalletCapabilitySet = ProviderCapabilities;

/**
 * Standard outcome returned after a wallet connection attempt.
 */
export interface WalletConnectionResult {
  success: boolean;
  status: WalletAdapterStatus;
  account?: WalletAccountIdentity;
  error?: WalletAdapterError;
  message?: string;
}

/**
 * Request payload for future on-chain contract transactions dispatched via wallet.
 */
export interface WalletTransactionRequest {
  loanId: string;
  action: string;
  circuitName: string;
  callerPublicKey: Uint8Array;
  payload?: unknown;
}

/**
 * Standard outcome returned after an on-chain transaction submission attempt.
 */
export interface WalletTransactionResult {
  success: boolean;
  status: string;
  transactionId?: string;
  blockHeight?: bigint;
  error?: string;
  unsupportedReason?: string;
}

/**
 * Standard error codes for wallet adapter operational failures.
 */
export type WalletAdapterErrorCode =
  | 'WALLET_NOT_DETECTED'
  | 'USER_REJECTED'
  | 'CONNECTION_FAILED'
  | 'UNSUPPORTED_OPERATION'
  | 'NETWORK_UNAVAILABLE'
  | 'SIGNATURE_FAILED'
  | 'SUBMISSION_FAILED'
  | 'UNKNOWN_PROVIDER_ERROR';

/**
 * Strongly typed domain error for wallet adapter and connector failures.
 * Sanitized to ensure zero exposure of private credentials or internal stack details.
 */
export class WalletAdapterError extends Error {
  readonly code: WalletAdapterErrorCode;
  readonly details?: unknown;

  constructor(
    code: WalletAdapterErrorCode,
    message: string,
    details?: unknown
  ) {
    super(message);
    this.name = 'WalletAdapterError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, WalletAdapterError.prototype);
  }
}
