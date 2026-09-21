import type { LoanDetailsModel } from '../types/index.ts';
import type { AccountRole } from '../types/account.ts';
import type {
  WalletConnectionStatus,
  NetworkContext,
  NetworkAccount,
  ProviderCapabilities,
} from '../types/network.ts';
import type {
  TransactionRequest,
  TransactionResult,
} from '../types/transaction.ts';
import type {
  WalletProviderKind,
  WalletDetectionStatus,
  LaceConnectionState,
} from '../types/wallet-adapter.ts';
import type { TransactionReceipt } from '../types/transaction-execution.ts';
import type {
  TransactionSigningRequest,
  TransactionSigningResult,
  TransactionSubmissionRequest,
  TransactionSubmissionResult,
  TransactionStatusResult,
} from '../types/transaction-request.ts';
import type {
  ContractInvocationRequest,
  ContractInvocationResult,
} from '../types/contract-invocation.ts';

/**
 * Clean architectural interface representing the minimum wallet and network
 * provider capabilities required by the application.
 *
 * PRIVACY & SECURITY BOUNDARIES:
 * - This interface deals strictly with public account identities and connection states.
 * - Private ZK witnesses, secret underwriting inputs, and financial credentials NEVER cross this boundary.
 * - In local prototype mode, live transactions and signatures are unavailable.
 */
export interface WalletProvider {
  /** Unique provider identifier */
  readonly id: string;

  /** Human-readable provider name */
  readonly name: string;

  /** Indicates whether the provider is operating in local prototype/simulation mode */
  readonly isPrototype: boolean;

  /** Architectural categorization of the provider kind */
  readonly kind?: WalletProviderKind;

  /** Checks if the provider is installed or available in the current environment */
  isAvailable(): boolean;

  /** Returns detection status of the wallet connector in the current environment */
  getDetectionStatus?(): WalletDetectionStatus;

  /** Returns current connection status of the provider */
  getConnectionStatus(): WalletConnectionStatus;

  /** Optional method to query the 9-state Midnight Lace connection lifecycle */
  getLaceConnectionState?(): LaceConnectionState;

  /** Returns the active network context (environment, network name, connection status) */
  getNetworkContext(): NetworkContext;

  /** Returns the atomic capability matrix of the provider */
  getCapabilities(): ProviderCapabilities;

  /** Returns the currently active public network account, if connected */
  getAccount(): NetworkAccount | null;

  /** Returns the public key bytes of the active account, if connected */
  getPublicKey(): Uint8Array | null;

  /**
   * Connects the wallet provider.
   * In prototype mode, simulates connecting a specific persona role.
   */
  connect(
    personaRole?: AccountRole,
    customLoan?: LoanDetailsModel
  ): Promise<NetworkAccount>;

  /**
   * Disconnects the active wallet provider session.
   */
  disconnect(): Promise<void>;

  /**
   * Optional wallet signature request method.
   * Prompts the connected wallet to sign the contract lifecycle transaction.
   * In prototype mode, throws a typed ProviderError indicating live signing is unavailable.
   */
  requestSignature?(
    request: TransactionSigningRequest
  ): Promise<TransactionSigningResult>;

  /**
   * Optional transaction submission method.
   * In prototype mode, throws a typed ProviderError indicating live transactions are unavailable.
   */
  submitTransaction?(
    request: TransactionSubmissionRequest | TransactionRequest
  ): Promise<TransactionSubmissionResult | TransactionResult>;

  /**
   * Optional method to query transaction status from the provider/indexer.
   */
  getTransactionStatus?(
    transactionId: string
  ): Promise<TransactionReceipt | TransactionStatusResult | null>;

  /**
   * Optional method to await reliable transaction confirmation from the network.
   */
  waitForConfirmation?(transactionId: string, timeoutMs?: number): Promise<TransactionReceipt>;

  /**
   * Optional method to query the network identifier reported by the connected wallet.
   */
  getReportedNetworkId?(): string | null;

  /**
   * Optional provider-compatible contract circuit invocation method.
   * Dispatches or delegates circuit execution to the underlying provider runtime.
   */
  invokeCircuit?<T = unknown>(
    request: ContractInvocationRequest
  ): Promise<ContractInvocationResult<T>>;
}
