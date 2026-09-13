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
import type { TransactionReceipt } from '../types/transaction-execution.ts';
import {
  WalletAdapterError,
  type WalletProviderKind,
  type WalletDetectionStatus,
  type WalletAccountIdentity,
} from '../types/wallet-adapter.ts';
import type { WalletProvider } from './wallet-provider.ts';

/**
 * Interface representing a potential browser window containing Midnight wallet bindings.
 */
interface MidnightWindowConnector {
  midnight?: {
    lace?: {
      enable?: () => Promise<unknown>;
      isEnabled?: () => Promise<boolean>;
      apiVersion?: string;
      name?: string;
    };
    [key: string]: unknown;
  };
}

/**
 * Real Midnight / Lace Wallet Adapter.
 *
 * Implements the WalletProvider interface as a verified, strongly typed boundary
 * for future live Lace Wallet and Midnight.js integration.
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. Honest Detection: Reports NOT_DETECTED or UNSUPPORTED when Lace is not installed.
 * 2. Anti-Fabrication: Never claims CONNECTED unless verified wallet connection succeeds.
 * 3. Anti-Fabrication: Never returns fake transaction hashes, block numbers, or confirmations.
 * 4. Strict Privacy: Zero private underwriting inputs, secret witnesses, or credentials ever enter this adapter.
 * 5. Registry Safety: Unsupported or failed operations never mutate the central LoanRegistry.
 */
export class MidnightWalletAdapter implements WalletProvider {
  readonly id = 'midnight-lace-adapter';
  readonly name = 'Midnight / Lace Wallet Adapter';
  readonly isPrototype = false;
  readonly kind: WalletProviderKind = 'LACE';

  private status: WalletConnectionStatus = 'DISCONNECTED';
  private activeAccount: NetworkAccount | null = null;
  private mockConnector: unknown = null;

  constructor() {
    // Initial state is cleanly disconnected
    this.status = 'DISCONNECTED';
    this.activeAccount = null;
  }

  /**
   * For automated testing: Allows setting a simulated browser connector object
   * without mutating global window state.
   */
  injectMockConnectorForTesting(connector: unknown): void {
    this.mockConnector = connector;
  }

  /**
   * For automated testing: Clears any injected mock connector.
   */
  clearMockConnectorForTesting(): void {
    this.mockConnector = null;
  }

  /**
   * Safely checks whether the browser environment has a Midnight/Lace wallet extension injected.
   */
  isAvailable(): boolean {
    return this.getDetectionStatus() === 'DETECTED';
  }

  /**
   * Queries the environment to determine if a genuine Midnight/Lace wallet connector is detected.
   */
  getDetectionStatus(): WalletDetectionStatus {
    if (this.mockConnector !== null) {
      return this.mockConnector ? 'DETECTED' : 'NOT_DETECTED';
    }

    if (typeof window === 'undefined') {
      return 'UNSUPPORTED';
    }

    const win = window as unknown as MidnightWindowConnector;
    if (win.midnight && (win.midnight.lace || Object.keys(win.midnight).length > 0)) {
      return 'DETECTED';
    }

    return 'NOT_DETECTED';
  }

  /**
   * Returns current connection status.
   */
  getConnectionStatus(): WalletConnectionStatus {
    return this.status;
  }

  /**
   * Returns network environment details without fabricating faux testnet identifiers.
   */
  getNetworkContext(): NetworkContext {
    return {
      environment: 'LOCAL',
      networkName: 'Midnight Network (Adapter Boundary)',
      connectionStatus: this.status,
      isConnected: this.status === 'CONNECTED',
      isPrototype: false,
      isRealNetwork: true,
    };
  }

  /**
   * Returns the atomic capability matrix based on actual dependency and connection state.
   */
  getCapabilities(): ProviderCapabilities {
    const isConnected = this.status === 'CONNECTED';
    let canSign = isConnected;
    let canSubmit = isConnected;

    if (this.mockConnector && typeof this.mockConnector === 'object') {
      const mockObj = this.mockConnector as Record<string, unknown>;
      if (mockObj.capabilities && typeof mockObj.capabilities === 'object') {
        const customCaps = mockObj.capabilities as Partial<ProviderCapabilities>;
        if (customCaps.SIGN_TRANSACTION !== undefined) {
          canSign = isConnected && !!customCaps.SIGN_TRANSACTION;
        }
        if (customCaps.SUBMIT_TRANSACTION !== undefined) {
          canSubmit = isConnected && !!customCaps.SUBMIT_TRANSACTION;
        }
      }
      if (mockObj.signingAvailable !== undefined) {
        canSign = isConnected && !!mockObj.signingAvailable;
      }
      if (mockObj.submissionAvailable !== undefined) {
        canSubmit = isConnected && !!mockObj.submissionAvailable;
      }
    }

    return {
      READ_PUBLIC_LEDGER: true, // Available via client contract query APIs
      CREATE_PROOF: true, // Available via local client zero-knowledge prover
      READ_ACCOUNT_IDENTITY: isConnected,
      SIGN_TRANSACTION: canSign, // Available only when real wallet is connected and capable
      SUBMIT_TRANSACTION: canSubmit, // Available only when real wallet is connected and capable
      READ_TRANSACTION_STATUS: false, // Pending live indexer integration
      READ_BALANCE: false, // Pending live native token queries
    };
  }

  /**
   * Returns the public account identity of the connected wallet, or null if disconnected.
   */
  getAccount(): NetworkAccount | null {
    if (this.status !== 'CONNECTED' || !this.activeAccount) {
      return null;
    }
    return { ...this.activeAccount };
  }

  /**
   * Returns the public key bytes of the connected wallet, or null if disconnected.
   */
  getPublicKey(): Uint8Array | null {
    if (this.status !== 'CONNECTED' || !this.activeAccount) {
      return null;
    }
    return this.activeAccount.publicKey;
  }

  /**
   * Connects to the real Midnight/Lace wallet.
   * Enforces honest failure if the extension is not detected or integration packages are missing.
   */
  async connect(
    personaRole?: AccountRole,
    customLoan?: LoanDetailsModel
  ): Promise<NetworkAccount> {
    const detection = this.getDetectionStatus();

    if (detection === 'UNSUPPORTED') {
      this.status = 'ERROR';
      throw new WalletAdapterError(
        'UNSUPPORTED_OPERATION',
        'Wallet connector is unsupported in this execution environment.'
      );
    }

    if (detection === 'NOT_DETECTED') {
      this.status = 'ERROR';
      throw new WalletAdapterError(
        'WALLET_NOT_DETECTED',
        'Lace Wallet extension is not installed or detected in this browser environment.'
      );
    }

    // When connector is detected via injected mock (for testing authorized connection flows)
    if (this.mockConnector && typeof this.mockConnector === 'object') {
      const mockObj = this.mockConnector as Record<string, unknown>;
      if (mockObj.shouldReject) {
        this.status = 'ERROR';
        throw new WalletAdapterError(
          'USER_REJECTED',
          'User rejected wallet connection request.'
        );
      }

      if (mockObj.mockAccount) {
        const acc = mockObj.mockAccount as WalletAccountIdentity;
        this.status = 'CONNECTED';
        this.activeAccount = {
          publicKey: acc.publicKey ?? null,
          publicKeyHex: acc.publicKeyHex ?? '',
          role: acc.role ?? personaRole ?? 'PARTICIPANT',
          displayName: acc.displayName ?? 'Midnight Wallet Account',
          address: acc.address,
        };
        return { ...this.activeAccount };
      }
    }

    // In a standard browser environment where window.midnight is detected but official
    // @midnight-ntwrk/dapp-connector-api packages are not yet installed in the workspace:
    this.status = 'ERROR';
    throw new WalletAdapterError(
      'CONNECTION_FAILED',
      'Midnight wallet connector detected, but live dApp connector SDK packages are pending installation.'
    );
  }

  /**
   * Disconnects the active wallet session.
   */
  async disconnect(): Promise<void> {
    this.status = 'DISCONNECTED';
    this.activeAccount = null;
  }

  /**
   * Submits an on-chain contract transaction.
   * ANTI-FABRICATION GUARANTEE:
   * Throws typed UNSUPPORTED_OPERATION rather than generating fake transaction hashes or block heights.
   */
  async submitTransaction(request: TransactionRequest): Promise<TransactionResult> {
    if (this.status !== 'CONNECTED') {
      throw new WalletAdapterError(
        'CONNECTION_FAILED',
        'Cannot submit transaction: Wallet is not connected.'
      );
    }

    if (this.mockConnector && typeof this.mockConnector === 'object') {
      const mockObj = this.mockConnector as Record<string, unknown>;
      if (mockObj.shouldRejectSignature) {
        throw new WalletAdapterError(
          'USER_REJECTED',
          'User rejected transaction signing in wallet.'
        );
      }
      if (mockObj.shouldFailSubmission) {
        throw new WalletAdapterError(
          'CONNECTION_FAILED',
          'Network submission failed on RPC endpoint.'
        );
      }
      if (mockObj.mockTxResult) {
        return mockObj.mockTxResult as TransactionResult;
      }
    }

    throw new WalletAdapterError(
      'UNSUPPORTED_OPERATION',
      'On-chain transaction submission is unavailable until live Midnight wallet connector SDK is integrated.'
    );
  }

  /**
   * Queries transaction status from provider or testing mock.
   */
  async getTransactionStatus(transactionId: string): Promise<TransactionReceipt | null> {
    if (this.status !== 'CONNECTED') {
      return null;
    }

    if (this.mockConnector && typeof this.mockConnector === 'object') {
      const mockObj = this.mockConnector as Record<string, unknown>;
      if (typeof mockObj.mockGetStatus === 'function') {
        return (mockObj.mockGetStatus as (txId: string) => Promise<TransactionReceipt | null>)(transactionId);
      }
    }

    return null;
  }

  /**
   * Awaits transaction confirmation from the network.
   */
  async waitForConfirmation(transactionId: string, timeoutMs?: number): Promise<TransactionReceipt> {
    if (this.status !== 'CONNECTED') {
      throw new WalletAdapterError(
        'CONNECTION_FAILED',
        'Cannot await confirmation: Wallet is not connected.'
      );
    }

    if (this.mockConnector && typeof this.mockConnector === 'object') {
      const mockObj = this.mockConnector as Record<string, unknown>;
      if (typeof mockObj.mockWaitForConfirmation === 'function') {
        return (mockObj.mockWaitForConfirmation as (txId: string, timeout?: number) => Promise<TransactionReceipt>)(
          transactionId,
          timeoutMs
        );
      }
    }

    throw new WalletAdapterError(
      'UNSUPPORTED_OPERATION',
      'Transaction confirmation polling is unavailable without live Midnight indexer integration.'
    );
  }
}

/**
 * Singleton factory creating a real MidnightWalletAdapter instance.
 */
export function createMidnightWalletAdapter(): MidnightWalletAdapter {
  return new MidnightWalletAdapter();
}
