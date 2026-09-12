import type { LoanDetailsModel } from '../types/index.js';
import type {
  AccountConnectionStatus,
  AccountRole,
  AccountIdentity,
  AccountContext,
} from '../types/account.js';

export const MOCK_BORROWER_PK = new Uint8Array(32).fill(1);
export const MOCK_LENDER_PK = new Uint8Array(32).fill(10);
export const MOCK_THIRD_PARTY_PK = new Uint8Array(32).fill(99);

export function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Returns a strongly typed prototype account identity for the given role.
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
      isPrototype: true,
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
    isPrototype: true,
  };
}

/**
 * Connects to a prototype account context with the designated role.
 */
export function connectMockAccount(
  role: AccountRole = 'BORROWER',
  customLoan?: LoanDetailsModel
): AccountContext {
  const identity = getMockAccount(role, customLoan);
  const connectionStatus: AccountConnectionStatus =
    role === 'NONE' ? 'DISCONNECTED' : 'CONNECTED';

  return {
    identity: role === 'NONE' ? null : identity,
    selectedRole: role,
    availableRoles: ['BORROWER', 'LENDER', 'PARTICIPANT', 'NONE'],
    connectionStatus,
    networkName: 'Local Prototype',
    isRealNetwork: false,
    isPrototype: true,
  };
}

/**
 * Disconnects the active prototype account.
 */
export function disconnectMockAccount(): AccountContext {
  return connectMockAccount('NONE');
}

/**
 * Switches the active prototype role.
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

