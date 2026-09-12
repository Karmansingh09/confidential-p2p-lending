/**
 * Connection status of the account abstraction.
 */
export type AccountConnectionStatus =
  | 'DISCONNECTED'
  | 'CONNECTED'
  | 'CONNECTING'
  | 'ERROR';

/**
 * High-level persona / role simulated by the prototype account.
 */
export type AccountRole =
  | 'BORROWER'
  | 'LENDER'
  | 'PARTICIPANT'
  | 'NONE';

/**
 * Public identity of an active or prototype account.
 * STRICT PRIVACY REQUIREMENT:
 * This model contains ONLY public keys and public identifiers.
 * No cryptographic secrets, signing credentials, or sensitive inputs are stored.
 */
export interface AccountIdentity {
  publicKey: Uint8Array | null;
  publicKeyHex: string;
  connectionStatus: AccountConnectionStatus;
  displayName: string;
  shortLabel: string;
  role: AccountRole;
  isPrototype: boolean;
}

/**
 * Overall account context provided to UI components and services.
 */
export interface AccountContext {
  identity: AccountIdentity | null;
  selectedRole: AccountRole;
  availableRoles: AccountRole[];
  connectionStatus: AccountConnectionStatus;
  networkName: string;
  isRealNetwork: boolean;
  isPrototype: boolean;
}

/**
 * Authorization evaluation for the currently active account against a selected loan.
 * Combines active account identity, loan participant public keys, and canonical lifecycle guards.
 */
export interface AccountAuthorization {
  isBorrower: boolean;
  isLender: boolean;
  canVerifyEligibility: boolean;
  canFundLoan: boolean;
  canRepayLoan: boolean;
  canSettleLoan: boolean;
  reasons: {
    verify?: string;
    fund?: string;
    repay?: string;
    settle?: string;
  };
}
