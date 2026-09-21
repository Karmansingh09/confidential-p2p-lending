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
import {
  getWalletSessionService,
  resetWalletSessionService,
} from './wallet-session-service.ts';

export const MOCK_BORROWER_PK = PROTOTYPE_BORROWER_PK;
export const MOCK_LENDER_PK = PROTOTYPE_LENDER_PK;
export const MOCK_THIRD_PARTY_PK = PROTOTYPE_THIRD_PARTY_PK;

export function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Returns the currently active wallet provider adapter via the WalletSessionService.
 */
export function getWalletProvider(): WalletProvider {
  return getWalletSessionService().getProvider();
}

/**
 * Sets or injects a wallet provider adapter (useful for testing or future provider switching).
 */
export function setWalletProvider(provider: WalletProvider): void {
  getWalletSessionService().setProvider(provider);
}

/**
 * Resets the wallet provider adapter to the default local prototype provider.
 */
export function resetWalletProvider(): void {
  const defaultProvider = createDefaultWalletProvider();
  resetWalletSessionService(defaultProvider);
}

/**
 * Returns the architectural kind of the currently active wallet provider.
 */
export function getActiveProviderKind(): WalletProviderKind {
  const provider = getWalletProvider();
  return provider.kind ?? (provider.isPrototype ? 'LOCAL_PROTOTYPE' : 'MIDNIGHT');
}

/**
 * Switches the active wallet provider to a real Midnight / Lace Wallet Adapter.
 */
export function switchToMidnightAdapter(adapter?: WalletProvider): void {
  getWalletSessionService().switchToMidnightAdapter(adapter);
}

/**
 * Switches the active wallet provider back to the Local Prototype Provider.
 */
export function switchToPrototypeProvider(): void {
  getWalletSessionService().switchToPrototypeProvider();
}

/**
 * Returns a strongly typed account identity by translating provider and session state.
 *
 * PRIVACY GUARANTEE:
 * Operates purely on public account identities.
 * No cryptographic secrets or confidential inputs are ever held or created.
 */
export function getMockAccount(
  role: AccountRole = 'BORROWER',
  customLoan?: LoanDetailsModel
): AccountIdentity {
  const provider = getWalletProvider();
  const session = getWalletSessionService().getSession();

  // If role is explicitly NONE or session is disconnected
  if (role === 'NONE') {
    return {
      publicKey: null,
      publicKeyHex: '',
      connectionStatus: 'DISCONNECTED',
      displayName: 'Disconnected',
      shortLabel: 'No Account Connected',
      role: 'NONE',
      isPrototype: provider.isPrototype,
    };
  }

  // If active provider is a real Midnight/Lace adapter (not prototype)
  if (!provider.isPrototype) {
    const rawAccount = provider.getAccount() ?? session.account;
    if (session.status === 'CONNECTED' && rawAccount) {
      const pk = rawAccount.publicKey;
      const hex = rawAccount.publicKeyHex || (pk ? bytesToHex(pk) : '');
      const addr = rawAccount.address || hex;
      const shortAddr = addr ? (addr.length > 14 ? `${addr.slice(0, 8)}...${addr.slice(-4)}` : addr) : 'Adapter Account';
      return {
        publicKey: pk,
        publicKeyHex: hex,
        connectionStatus: 'CONNECTED',
        displayName: rawAccount.displayName ?? 'Midnight Wallet Account',
        shortLabel: `Lace (${shortAddr})`,
        role: rawAccount.role ?? role,
        isPrototype: false,
        address: rawAccount.address,
      };
    }

    // Disconnected adapter
    return {
      publicKey: null,
      publicKeyHex: '',
      connectionStatus: 'DISCONNECTED',
      displayName: 'Midnight Wallet (Disconnected)',
      shortLabel: 'Disconnected',
      role: 'NONE',
      isPrototype: false,
    };
  }

  // Prototype provider identities (clearly marked as simulation)
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
    isPrototype: true,
  };
}

/**
 * Connects to an account context with the designated role via the active provider and session service.
 */
export function connectMockAccount(
  role: AccountRole = 'BORROWER',
  customLoan?: LoanDetailsModel
): AccountContext {
  const sessionService = getWalletSessionService();
  const provider = sessionService.getProvider();

  if (role === 'NONE') {
    void sessionService.disconnect();
  } else if (provider instanceof LocalPrototypeWalletProvider) {
    provider.connectSync(role, customLoan);
    // Sync session
    void sessionService.connect({ providerKind: 'LOCAL_PROTOTYPE', role, customLoan });
  } else {
    void sessionService.connect({ role, customLoan });
  }

  const netContext = provider.getNetworkContext();
  const identity = getMockAccount(role, customLoan);
  const connectionStatus: AccountConnectionStatus =
    role === 'NONE' || identity.connectionStatus === 'DISCONNECTED'
      ? 'DISCONNECTED'
      : 'CONNECTED';

  return {
    identity: connectionStatus === 'DISCONNECTED' ? null : identity,
    selectedRole: connectionStatus === 'DISCONNECTED' ? 'NONE' : role,
    availableRoles: ['BORROWER', 'LENDER', 'PARTICIPANT', 'NONE'],
    connectionStatus,
    networkName: netContext.networkName,
    isRealNetwork: netContext.isRealNetwork,
    isPrototype: netContext.isPrototype,
  };
}

/**
 * Disconnects the active account via the wallet session and provider.
 */
export function disconnectMockAccount(): AccountContext {
  const sessionService = getWalletSessionService();
  void sessionService.disconnect();
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
