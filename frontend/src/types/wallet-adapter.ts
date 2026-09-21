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
 * Formal 9-state lifecycle model for Midnight Lace Wallet connection.
 * STRICT INVARIANT: Never collapse into a single boolean.
 */
export type LaceConnectionState =
  | 'LACE_NOT_DETECTED'
  | 'LACE_DETECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'CONNECTION_REJECTED'
  | 'UNSUPPORTED_NETWORK'
  | 'CONNECTED_NOT_TRANSACTION_CAPABLE'
  | 'READY';

/**
 * Official Midnight DApp Connector Initial API representation (injected on window.midnight).
 * Conforms to @midnight-ntwrk/dapp-connector-api specification.
 */
export interface MidnightInitialAPI {
  name: string;
  icon: string;
  apiVersion: string;
  rdns?: string;
  connect: (networkId: string) => Promise<MidnightConnectedAPI>;
  enable?: () => Promise<MidnightConnectedAPI>;
  isEnabled?: () => Promise<boolean>;
}

/**
 * Shielded address structure returned by Midnight wallet connector.
 */
export interface MidnightShieldedAddresses {
  shieldedAddress: string;
  shieldedCoinPublicKey?: string;
  shieldedEncryptionPublicKey?: string;
}

/**
 * Connection status reported by the connected wallet.
 */
export interface MidnightConnectionStatus {
  status: 'connected' | 'disconnected';
  networkId?: string;
}

/**
 * Service URI and network configuration provided by Midnight wallet connector.
 */
export interface MidnightServiceUriConfig {
  indexerUri?: string;
  indexerWsUri?: string;
  proverServerUri?: string;
  substrateNodeUri?: string;
  networkId?: string;
  [key: string]: unknown;
}

/**
 * Official Midnight DApp Connector Connected API representation (returned from connect()).
 * Conforms to @midnight-ntwrk/dapp-connector-api WalletConnectedAPI specification.
 */
export interface MidnightConnectedAPI {
  hintUsage?: (methodNames: string[]) => Promise<void>;
  getShieldedAddresses?: () => Promise<MidnightShieldedAddresses | string[]>;
  getUnshieldedAddress?: () => Promise<string | { unshieldedAddress: string }>;
  getDustAddress?: () => Promise<string | { dustAddress: string }>;
  getDustBalance?: () => Promise<{ cap: bigint; balance: bigint }>;
  getShieldedBalances?: () => Promise<Record<string, bigint>>;
  getUnshieldedBalances?: () => Promise<Record<string, bigint>>;
  balanceUnsealedTransaction?: (tx: unknown, options?: { payFees?: boolean }) => Promise<{ tx: unknown; [key: string]: unknown }>;
  balanceSealedTransaction?: (tx: unknown, options?: { payFees?: boolean }) => Promise<{ tx: unknown; [key: string]: unknown }>;
  submitTransaction?: (tx: unknown) => Promise<string | { txHash?: string; id?: string } | void>;
  getConnectionStatus?: () => Promise<MidnightConnectionStatus>;
  getConfiguration?: () => Promise<MidnightServiceUriConfig>;
  serviceUriConfig?: () => Promise<MidnightServiceUriConfig>;
  state?: () => Promise<unknown>;
}

/**
 * Safe, read-only diagnostic report for inspecting Midnight Preprod Lace connection and DUST state.
 * STRICT PRIVACY INVARIANT: Never contains sensitive credentials or confidential underwriting data.
 */
export interface SafeDustDiagnosticReport {
  timestamp: string;
  networkId: string | null;
  walletConnectionState: string;
  transactionCapability: {
    canSign: boolean;
    canSubmit: boolean;
    isTxCapable: boolean;
  };
  installedSpecVersion: string;
  connectorInfo: {
    name: string | null;
    rdns: string | null;
    apiVersion: string | null;
  };
  availableApiMethods: string[];
  dustApiMethods: {
    hasGetDustAddress: boolean;
    hasGetDustBalance: boolean;
    hasBalanceUnsealedTransaction: boolean;
    hasBalanceSealedTransaction: boolean;
    hasAnyRegistrationMethod: boolean;
  };
  dustState: {
    dustAddress: string | null;
    dustBalance: string | null;
    dustCapacity: string | null;
    readStatus: 'SUCCESS' | 'PARTIAL' | 'NOT_AVAILABLE' | 'ERROR';
    details: string;
  };
  networkEndpoints: {
    indexerUri?: string;
    substrateNodeUri?: string;
    networkId?: string;
  } | null;
}

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
 * ANTI-FABRICATION GUARANTEE:
 * networkId and networkName are the ACTUAL reported values, or null if unavailable.
 * Never infers Preprod merely because application expects Preprod.
 */
export interface WalletNetworkInfo {
  environment: NetworkEnvironment;
  networkId: string | null;
  networkName: string | null;
  networkCompatible: boolean;
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
  laceState?: LaceConnectionState;
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
  | 'CONFIGURATION_ERROR'
  | 'UNSUPPORTED_OPERATION'
  | 'NETWORK_UNAVAILABLE'
  | 'UNSUPPORTED_NETWORK'
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
