import type { LoanDetailsModel } from '../types/index.ts';
import type {
  AccountConnectionStatus,
  AccountRole,
  AccountIdentity,
  AccountContext,
} from '../types/account.ts';
import type { WalletProvider } from './wallet-provider.ts';
import {
  LocalPrototypeWalletProvider,
  createDefaultWalletProvider,
  PROTOTYPE_BORROWER_PK,
  PROTOTYPE_LENDER_PK,
  PROTOTYPE_THIRD_PARTY_PK,
} from './midnight-provider.ts';
import {
  createMidnightWalletAdapter,
  MidnightWalletAdapter,
} from './midnight-wallet-adapter.ts';
import type { WalletProviderKind } from '../types/wallet-adapter.ts';

export const MOCK_BORROWER_PK = PROTOTYPE_BORROWER_PK;
export const MOCK_LENDER_PK = PROTOTYPE_LENDER_PK;
export const MOCK_THIRD_PARTY_PK = PROTOTYPE_THIRD_PARTY_PK;

export function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Active provider instance mediating all wallet and network identity behaviors.
 * Conceptual Architecture (Commit #22 & #24):
 * Account Service → WalletProvider Interface → [LocalPrototypeWalletProvider | MidnightWalletAdapter]
 */
let activeProvider: WalletProvider = createDefaultWalletProvider();

/**
 * Returns the currently active wallet provider adapter.
 */
export function getWalletProvider(): WalletProvider {
  return activeProvider;
}

/**
 * Sets or injects a wallet provider adapter (useful for testing or future provider switching).
 */
export function setWalletProvider(provider: WalletProvider): void {
  activeProvider = provider;
}

/**
 * Resets the wallet provider adapter to the default local prototype provider.
 */
export function resetWalletProvider(): void {
  activeProvider = createDefaultWalletProvider();
}

/**
 * Returns the architectural kind of the currently active wallet provider.
 */
export function getActiveProviderKind(): WalletProviderKind {
  return activeProvider.kind ?? (activeProvider.isPrototype ? 'LOCAL_PROTOTYPE' : 'MIDNIGHT');
}

/**
 * Switches the active wallet provider to a real Midnight / Lace Wallet Adapter.
 */
export function switchToMidnightAdapter(adapter?: WalletProvider): void {
  activeProvider = adapter ?? createMidnightWalletAdapter();
}

/**
 * Switches the active wallet provider back to the Local Prototype Provider.
 */
export function switchToPrototypeProvider(): void {
  activeProvider = createDefaultWalletProvider();
}

/**
 * Returns a strongly typed account identity by translating provider state.
 * STRICT PRIVACY GUARANTEE:
 * Operates purely on public account identities.
 * No cryptographic credentials or confidential user inputs are ever created or stored.
 */
export function getMockAccount(
  role: AccountRole = 'BORROWER',
  customLoan?: LoanDetailsModel
): AccountIdentity {
  if (role === 'NONE') {
    return {
      publicKey: null,
      publicKeyHex: '',
      connectionStatus: 'DISCONNECTED',
      displayName: 'Disconnected',
      shortLabel: 'No Account Connected',
      role: 'NONE',
      isPrototype: activeProvider.isPrototype,
    };
  }

  let pk: Uint8Array;
  let displayName: string;
  let labelPrefix: string;

  switch (role) {
    case 'BORROWER':
      pk = customLoan?.borrowerBytes ?? MOCK_BORROWER_PK;
      displayName = 'Mock Borrower Account';
      labelPrefix = 'Borrower';
      break;
    case 'LENDER':
      pk = customLoan?.lenderBytes ?? MOCK_LENDER_PK;
      displayName = 'Mock Lender Account';
      labelPrefix = 'Lender';
      break;
    case 'PARTICIPANT':
    default:
      pk = MOCK_THIRD_PARTY_PK;
      displayName = 'Mock Third-Party Account';
      labelPrefix = 'Third-Party';
      break;
  }

  const hex = bytesToHex(pk);
  const shortHex = `${hex.slice(0, 6)}...${hex.slice(-4)}`;

  return {
    publicKey: pk,
    publicKeyHex: hex,
    connectionStatus: 'CONNECTED',
    displayName,
    shortLabel: `${labelPrefix} (${shortHex})`,
    role,
    isPrototype: activeProvider.isPrototype,
  };
}

/**
 * Connects to a prototype account context with the designated role via the active provider.
 */
export function connectMockAccount(
  role: AccountRole = 'BORROWER',
  customLoan?: LoanDetailsModel
): AccountContext {
  if (activeProvider instanceof LocalPrototypeWalletProvider) {
    activeProvider.connectSync(role, customLoan);
  } else {
    void activeProvider.connect(role, customLoan);
  }

  const netContext = activeProvider.getNetworkContext();
  const identity = getMockAccount(role, customLoan);
  const connectionStatus: AccountConnectionStatus =
    role === 'NONE' ? 'DISCONNECTED' : 'CONNECTED';

  return {
    identity: role === 'NONE' ? null : identity,
    selectedRole: role,
    availableRoles: ['BORROWER', 'LENDER', 'PARTICIPANT', 'NONE'],
    connectionStatus,
    networkName: netContext.networkName,
    isRealNetwork: netContext.isRealNetwork,
    isPrototype: netContext.isPrototype,
  };
}

/**
 * Disconnects the active prototype account via the wallet provider.
 */
export function disconnectMockAccount(): AccountContext {
  if (activeProvider instanceof LocalPrototypeWalletProvider) {
    activeProvider.disconnectSync();
  } else {
    void activeProvider.disconnect();
  }
  return connectMockAccount('NONE');
}

/**
 * Switches the active prototype role via the wallet provider.
 */
export function switchMockRole(
  role: AccountRole,
  customLoan?: LoanDetailsModel
): AccountContext {
  return connectMockAccount(role, customLoan);
}

/**
 * Returns the list of standard mock identities available for simulation.
 */
export function getAvailableMockIdentities(
  customLoan?: LoanDetailsModel
): AccountIdentity[] {
  return [
    getMockAccount('BORROWER', customLoan),
    getMockAccount('LENDER', customLoan),
    getMockAccount('PARTICIPANT', customLoan),
  ];
}
