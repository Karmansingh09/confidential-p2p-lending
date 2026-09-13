import type { LoanDetailsModel } from '../types/index.ts';
import type { AccountRole } from '../types/account.ts';
import {
  ProviderError,
  type WalletConnectionStatus,
  type NetworkContext,
  type NetworkAccount,
  type ProviderCapabilities,
} from '../types/network.ts';
import type {
  TransactionRequest,
  TransactionResult,
} from '../types/transaction.ts';
import type {
  WalletProviderKind,
  WalletDetectionStatus,
} from '../types/wallet-adapter.ts';
import type {
  TransactionSigningRequest,
  TransactionSigningResult,
  TransactionSubmissionRequest,
  TransactionSubmissionResult,
  TransactionStatusResult,
} from '../types/transaction-request.ts';
import type { WalletProvider } from './wallet-provider.ts';

export const PROTOTYPE_BORROWER_PK = new Uint8Array(32).fill(1);
export const PROTOTYPE_LENDER_PK = new Uint8Array(32).fill(10);
export const PROTOTYPE_THIRD_PARTY_PK = new Uint8Array(32).fill(99);

function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Local Prototype Wallet Provider.
 *
 * Implements the WalletProvider interface for offline prototype demonstration.
 *
 * STRICT PRIVACY & INTEGRITY GUARANTEES:
 * - Operates purely in Local Prototype mode (`environment = 'LOCAL'`).
 * - Never claims connection to Midnight Network when offline.
 * - Exposes only public 32-byte account keys.
 * - NEVER creates, stores, or handles confidential signing credentials or off-chain data.
 * - NEVER fabricates blockchain transactions, hashes, or confirmations.
 * - Unsupported operations throw typed `ProviderError('UNSUPPORTED_OPERATION')`.
 */
export class LocalPrototypeWalletProvider implements WalletProvider {
  readonly id = 'midnight-local-prototype';
  readonly name = 'Local Prototype Provider';
  readonly isPrototype = true;
  readonly kind: WalletProviderKind = 'LOCAL_PROTOTYPE';

  private status: WalletConnectionStatus;
  private activeRole: AccountRole;
  private activeAccount: NetworkAccount | null;

  constructor(initialRole: AccountRole = 'BORROWER', customLoan?: LoanDetailsModel) {
    if (initialRole === 'NONE') {
      this.status = 'DISCONNECTED';
      this.activeRole = 'NONE';
      this.activeAccount = null;
    } else {
      this.status = 'CONNECTED';
      this.activeRole = initialRole;
      this.activeAccount = this.deriveNetworkAccount(initialRole, customLoan);
    }
  }

  isAvailable(): boolean {
    return true;
  }

  getDetectionStatus(): WalletDetectionStatus {
    return 'DETECTED';
  }

  getConnectionStatus(): WalletConnectionStatus {
    return this.status;
  }

  getNetworkContext(): NetworkContext {
    return {
      environment: 'LOCAL',
      networkName: 'Local Prototype',
      connectionStatus: this.status === 'CONNECTED' ? 'CONNECTED' : 'DISCONNECTED',
      isConnected: this.status === 'CONNECTED',
      isPrototype: true,
      isRealNetwork: false,
    };
  }

  /**
   * Returns the network identifier reported by this prototype provider.
   */
  getReportedNetworkId(): string | null {
    return 'midnight-prototype-local';
  }

  getCapabilities(): ProviderCapabilities {
    return {
      READ_PUBLIC_LEDGER: true,
      CREATE_PROOF: true, // Supported via local client prover workflow
      READ_ACCOUNT_IDENTITY: true,
      SIGN_TRANSACTION: false, // Unsupported in prototype mode
      SUBMIT_TRANSACTION: false, // Unsupported in prototype mode
      READ_TRANSACTION_STATUS: false, // Unsupported in prototype mode
      READ_BALANCE: false, // Unsupported in prototype mode
    };
  }

  getAccount(): NetworkAccount | null {
    if (this.status !== 'CONNECTED') {
      return null;
    }
    return this.activeAccount ? { ...this.activeAccount } : null;
  }

  getPublicKey(): Uint8Array | null {
    if (this.status !== 'CONNECTED' || !this.activeAccount) {
      return null;
    }
    return this.activeAccount.publicKey;
  }

  connectSync(
    personaRole: AccountRole = 'BORROWER',
    customLoan?: LoanDetailsModel
  ): NetworkAccount {
    if (personaRole === 'NONE') {
      this.status = 'DISCONNECTED';
      this.activeRole = 'NONE';
      this.activeAccount = null;
      return {
        publicKey: null,
        publicKeyHex: '',
        role: 'NONE',
        displayName: 'Disconnected',
      };
    }

    this.status = 'CONNECTED';
    this.activeRole = personaRole;
    this.activeAccount = this.deriveNetworkAccount(personaRole, customLoan);
    return { ...this.activeAccount };
  }

  async connect(
    personaRole: AccountRole = 'BORROWER',
    customLoan?: LoanDetailsModel
  ): Promise<NetworkAccount> {
    return this.connectSync(personaRole, customLoan);
  }

  disconnectSync(): void {
    this.status = 'DISCONNECTED';
    this.activeRole = 'NONE';
    this.activeAccount = null;
  }

  async disconnect(): Promise<void> {
    this.disconnectSync();
  }

  async requestSignature(
    request: TransactionSigningRequest
  ): Promise<TransactionSigningResult> {
    // In local prototype mode, live wallet signing is unavailable.
    // Zero fake signatures are fabricated.
    throw new ProviderError(
      'UNSUPPORTED_OPERATION',
      'Wallet signature generation is unavailable in prototype mode.'
    );
  }

  async submitTransaction(
    request: TransactionSubmissionRequest | TransactionRequest
  ): Promise<TransactionSubmissionResult | TransactionResult> {
    // In local prototype mode, live wallet transactions are unavailable.
    // Zero fake transaction hashes or simulated confirmations are fabricated.
    throw new ProviderError(
      'UNSUPPORTED_OPERATION',
      'Live wallet transactions are unavailable in prototype mode.'
    );
  }

  async getTransactionStatus(
    transactionId: string
  ): Promise<TransactionStatusResult | null> {
    throw new ProviderError(
      'UNSUPPORTED_OPERATION',
      'Transaction status tracking is unavailable in prototype mode.'
    );
  }

  private deriveNetworkAccount(
    role: AccountRole,
    customLoan?: LoanDetailsModel
  ): NetworkAccount {
    let pk: Uint8Array;
    let displayName: string;

    switch (role) {
      case 'BORROWER':
        pk = customLoan?.borrowerBytes ?? PROTOTYPE_BORROWER_PK;
        displayName = 'Mock Borrower Account';
        break;
      case 'LENDER':
        pk = customLoan?.lenderBytes ?? PROTOTYPE_LENDER_PK;
        displayName = 'Mock Lender Account';
        break;
      case 'PARTICIPANT':
      default:
        pk = PROTOTYPE_THIRD_PARTY_PK;
        displayName = 'Mock Third-Party Account';
        break;
    }

    const hex = bytesToHex(pk);
    return {
      publicKey: pk,
      publicKeyHex: hex,
      address: hex,
      role,
      displayName,
    };
  }
}

/**
 * Factory creating the default wallet provider for the current environment.
 */
export function createDefaultWalletProvider(): WalletProvider {
  return new LocalPrototypeWalletProvider();
}
