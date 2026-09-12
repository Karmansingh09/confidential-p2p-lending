import type { AccountRole } from './account.ts';

/**
 * Network environment designation.
 */
export type NetworkEnvironment = 'LOCAL' | 'TESTNET' | 'MAINNET';

/**
 * Connection status of the underlying network layer.
 */
export type NetworkConnectionStatus =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'ERROR';

/**
 * Connection status of the wallet provider adapter.
 */
export type WalletConnectionStatus =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'ERROR';

/**
 * Atomic capabilities that a wallet or network provider may support.
 */
export type ProviderCapability =
  | 'READ_PUBLIC_LEDGER'
  | 'CREATE_PROOF'
  | 'SIGN_TRANSACTION'
  | 'SUBMIT_TRANSACTION'
  | 'READ_TRANSACTION_STATUS'
  | 'READ_BALANCE';

/**
 * Comprehensive capability matrix for the active provider.
 */
export type ProviderCapabilities = Record<ProviderCapability, boolean>;

/**
 * Public network account representation provided by the wallet layer.
 * STRICT PRIVACY REQUIREMENT:
 * Exposes ONLY public 32-byte account keys and public addresses.
 * No cryptographic secrets or underwriting credentials are ever held.
 */
export interface NetworkAccount {
  publicKey: Uint8Array | null;
  publicKeyHex: string;
  address?: string;
  role?: AccountRole;
  displayName?: string;
}

/**
 * Detailed network context describing the active environment and provider status.
 */
export interface NetworkContext {
  environment: NetworkEnvironment;
  networkName: string;
  connectionStatus: NetworkConnectionStatus;
  isConnected: boolean;
  isPrototype: boolean;
  isRealNetwork: boolean;
}

/**
 * Standard error codes for provider and wallet operations.
 */
export type ProviderErrorCode =
  | 'PROVIDER_UNAVAILABLE'
  | 'WALLET_NOT_CONNECTED'
  | 'UNSUPPORTED_OPERATION'
  | 'NETWORK_UNAVAILABLE'
  | 'USER_REJECTED'
  | 'INVALID_PROVIDER_STATE';

/**
 * Typed domain error representing an error in the wallet/network provider layer.
 */
export class ProviderError extends Error {
  readonly code: ProviderErrorCode;

  constructor(code: ProviderErrorCode, message: string) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    Object.setPrototypeOf(this, ProviderError.prototype);
  }
}
