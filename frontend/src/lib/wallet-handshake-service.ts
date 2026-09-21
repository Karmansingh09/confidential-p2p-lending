import type { WalletProvider } from './wallet-provider.ts';
import { getWalletSessionService, WalletSessionService } from './wallet-session-service.ts';
import { getNetworkConfigService, getRealMidnightNetworkId } from './network-config-service.ts';
import { discoverWalletConnector } from './wallet-connector-discovery.ts';
import { evaluateNetworkCompatibility } from './wallet-network-compatibility.ts';
import type {
  WalletHandshakeStatus,
  WalletHandshakeState,
  WalletHandshakeRequest,
  WalletHandshakeResult,
  WalletHandshakeCapabilities,
} from '../types/wallet-handshake.ts';
import { WalletHandshakeError } from '../types/wallet-handshake.ts';
import {
  WalletAdapterError,
  type LaceConnectionState,
} from '../types/wallet-adapter.ts';
import { LOCAL_PROTOTYPE_NETWORK_ID } from '../types/network-config.ts';

export type WalletHandshakeListener = (state: WalletHandshakeState) => void;

/**
 * Production-ready Wallet Handshake Service.
 *
 * Coordinates the full connection handshake pipeline:
 * 1. Safe connector discovery (SSR/Node.js guarded)
 * 2. Provider connection request
 * 3. Public identity resolution
 * 4. Wallet network identification
 * 5. Network compatibility evaluation
 * 6. Dynamic capability verification
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. DETECTED != CONNECTED: An existing extension on window.midnight does not imply user approval.
 * 2. CONNECTED != TRANSACTION_CAPABLE: Active connection does not imply signing or submission support.
 * 3. UNKNOWN != MATCH: If the wallet fails to report a network, compatibility is UNKNOWN.
 * 4. STRICT PRIVACY: Only public keys, addresses, and network identifiers enter handshake state.
 * 5. ZERO FABRICATION: Never claims connection, network match, or signing when unverified.
 */
export class WalletHandshakeService {
  private sessionService: WalletSessionService;
  private customProvider?: WalletProvider;
  private listeners: Set<WalletHandshakeListener> = new Set();
  private lastError: WalletHandshakeError | null = null;
  private isConnecting: boolean = false;

  constructor(sessionService?: WalletSessionService, customProvider?: WalletProvider) {
    this.sessionService = sessionService ?? getWalletSessionService();
    this.customProvider = customProvider;
  }

  /**
   * Resolves the active wallet provider.
   */
  getProvider(): WalletProvider {
    return this.customProvider ?? this.sessionService.getProvider();
  }

  /**
   * Sets or overrides the active provider (primarily for hermetic testing).
   */
  setProvider(provider: WalletProvider): void {
    this.customProvider = provider;
    this.notifyListeners();
  }

  /**
   * Derives the comprehensive WalletHandshakeState from the active environment and provider.
   */
  getHandshakeState(): WalletHandshakeState {
    const provider = this.getProvider();
    const netConfigService = getNetworkConfigService();
    const expectedConfig = netConfigService.getNetworkConfig();
    const effectiveExpectedConfig =
      !provider.isPrototype && expectedConfig.environment === 'LOCAL'
        ? {
            ...expectedConfig,
            networkId: getRealMidnightNetworkId(),
            environment: 'TESTNET' as const,
          }
        : expectedConfig;

    const expectedNetwork =
      effectiveExpectedConfig.networkId ??
      (effectiveExpectedConfig.environment === 'LOCAL' ? LOCAL_PROTOTYPE_NETWORK_ID : '');

    // 1. Connector Detection
    let isDetected = false;
    if (provider.isPrototype) {
      isDetected = true;
    } else if (provider.getDetectionStatus) {
      isDetected = provider.getDetectionStatus() === 'DETECTED';
    } else {
      const discovery = discoverWalletConnector();
      isDetected = discovery.detected;
    }

    // 2. Connection Status
    const connectionStatus = provider.getConnectionStatus();
    const isConnected = connectionStatus === 'CONNECTED';

    // 3. Identity Resolution
    const account = isConnected ? provider.getAccount() : null;
    const identityResolved = !!(account && (account.publicKey || account.publicKeyHex || account.address));

    // 4. Wallet Network Identification & Compatibility
    const walletNetwork =
      typeof provider.getReportedNetworkId === 'function' ? provider.getReportedNetworkId() : null;

    const netComp = evaluateNetworkCompatibility(effectiveExpectedConfig, walletNetwork);
    const networkCompatibility = netComp.compatibility;

    // 5. Capability Verification
    const caps = provider.getCapabilities();
    const capabilities: WalletHandshakeCapabilities = {
      canReadLedger: !!caps.READ_PUBLIC_LEDGER,
      canCreateProof: !!caps.CREATE_PROOF,
      canReadIdentity: !!caps.READ_ACCOUNT_IDENTITY,
      canSign: !!caps.SIGN_TRANSACTION,
      canSubmit: !!caps.SUBMIT_TRANSACTION,
    };
    const isTransactionCapable = capabilities.canSign && capabilities.canSubmit;

    // 6. State Machine Status Resolution
    let status: WalletHandshakeStatus = 'DORMANT';

    if (this.lastError) {
      if (this.lastError.code === 'USER_REJECTED') {
        status = 'REJECTED';
      } else if (this.lastError.code === 'NETWORK_MISMATCH') {
        status = 'NETWORK_MISMATCH';
      } else if (this.lastError.code === 'WALLET_NOT_DETECTED') {
        status = 'NOT_DETECTED';
      } else if (this.lastError.code === 'UNSUPPORTED_PROVIDER') {
        status = 'UNSUPPORTED';
      } else if (this.lastError.code === 'IDENTITY_UNAVAILABLE') {
        status = 'IDENTITY_UNAVAILABLE';
      } else {
        status = 'FAILED';
      }
    } else if (this.isConnecting) {
      status = 'CONNECTING';
    } else if (!isDetected) {
      status = 'NOT_DETECTED';
    } else if (!isConnected) {
      status = 'DETECTED';
    } else if (!identityResolved) {
      status = 'IDENTITY_UNAVAILABLE';
    } else if (expectedConfig.environment !== 'LOCAL' && networkCompatibility === 'MISMATCH') {
      status = 'NETWORK_MISMATCH';
    } else if (isTransactionCapable && networkCompatibility === 'MATCH') {
      status = 'READY';
    } else {
      status = 'CONNECTED';
    }

    const networkCompatible = netComp.isMatch;
    const networkName = walletNetwork
      ? `Midnight (${walletNetwork})`
      : provider.isPrototype
      ? expectedConfig.networkName
      : null;

    let laceConnectionState: LaceConnectionState = 'LACE_NOT_DETECTED';
    if (this.lastError?.code === 'USER_REJECTED') {
      laceConnectionState = 'CONNECTION_REJECTED';
    } else if (this.lastError?.code === 'NETWORK_MISMATCH') {
      laceConnectionState = 'UNSUPPORTED_NETWORK';
    } else if (!isDetected) {
      laceConnectionState = 'LACE_NOT_DETECTED';
    } else if (this.isConnecting) {
      laceConnectionState = 'CONNECTING';
    } else if (!isConnected) {
      laceConnectionState = 'LACE_DETECTED';
    } else if (walletNetwork && networkCompatibility === 'MISMATCH' && expectedConfig.environment !== 'LOCAL') {
      // Only classify as UNSUPPORTED_NETWORK after actual wallet network ID has been retrieved and compared
      laceConnectionState = 'UNSUPPORTED_NETWORK';
    } else if (!walletNetwork && expectedConfig.environment !== 'LOCAL') {
      // Wallet connected, but network ID is unretrieved or unavailable
      // Honest state: CONNECTED (neither UNSUPPORTED_NETWORK nor READY)
      laceConnectionState = 'CONNECTED';
    } else if (!isTransactionCapable) {
      laceConnectionState = 'CONNECTED_NOT_TRANSACTION_CAPABLE';
    } else if (networkCompatibility === 'MATCH') {
      laceConnectionState = 'READY';
    } else {
      laceConnectionState = 'CONNECTED';
    }

    return {
      status,
      isDetected,
      isConnected,
      identityResolved,
      account,
      expectedNetwork,
      walletNetwork,
      networkCompatibility,
      networkCompatible,
      networkName,
      laceConnectionState,
      capabilities,
      isTransactionCapable,
      error: this.lastError,
      timestamp: Date.now(),
    };
  }

  /**
   * Safely detects the wallet connector in the current runtime environment.
   */
  async detect(): Promise<WalletHandshakeState> {
    this.lastError = null;
    const state = this.getHandshakeState();
    this.notifyListeners();
    return state;
  }

  /**
   * Requests connection handshake through the wallet provider boundary.
   */
  async connect(request?: WalletHandshakeRequest): Promise<WalletHandshakeResult> {
    const provider = this.getProvider();
    this.isConnecting = true;
    this.lastError = null;
    this.notifyListeners();

    try {
      // Prototype mode or custom role
      if (provider.isPrototype) {
        await provider.connect(request?.role ?? 'BORROWER', request?.customLoan);
        this.isConnecting = false;
        const state = this.getHandshakeState();
        this.notifyListeners();
        return { success: true, state };
      }

      // Real adapter boundary
      await provider.connect(request?.role, request?.customLoan);
      this.isConnecting = false;

      // Validate identity resolution
      const state = this.getHandshakeState();
      if (!state.identityResolved) {
        const idErr = new WalletHandshakeError(
          'IDENTITY_UNAVAILABLE',
          'Connected wallet failed to return a valid public account identity.'
        );
        this.lastError = idErr;
        const errState = this.getHandshakeState();
        this.notifyListeners();
        return { success: false, state: errState, error: idErr };
      }

      // Check network compatibility for real networks
      const expectedConfig = getNetworkConfigService().getNetworkConfig();
      if (expectedConfig.environment !== 'LOCAL' && state.networkCompatibility === 'MISMATCH') {
        const netErr = new WalletHandshakeError(
          'NETWORK_MISMATCH',
          `Network mismatch: Wallet reports "${state.walletNetwork}", expected "${state.expectedNetwork}".`
        );
        this.lastError = netErr;
        const mismatchState = this.getHandshakeState();
        this.notifyListeners();
        return { success: false, state: mismatchState, error: netErr };
      }

      this.notifyListeners();
      return { success: true, state };
    } catch (err: unknown) {
      this.isConnecting = false;
      let handshakeErr: WalletHandshakeError;

      if (err instanceof WalletHandshakeError) {
        handshakeErr = err;
      } else if (err instanceof WalletAdapterError) {
        if (err.code === 'USER_REJECTED') {
          handshakeErr = new WalletHandshakeError('USER_REJECTED', err.message);
        } else if (err.code === 'WALLET_NOT_DETECTED') {
          handshakeErr = new WalletHandshakeError('WALLET_NOT_DETECTED', err.message);
        } else if (err.code === 'UNSUPPORTED_OPERATION') {
          handshakeErr = new WalletHandshakeError('UNSUPPORTED_PROVIDER', err.message);
        } else if (err.code === 'UNSUPPORTED_NETWORK') {
          handshakeErr = new WalletHandshakeError('NETWORK_MISMATCH', err.message);
        } else {
          handshakeErr = new WalletHandshakeError('CONNECTION_FAILED', err.message);
        }
      } else {
        const msg = err instanceof Error ? err.message : 'Wallet connection failed.';
        handshakeErr = new WalletHandshakeError('CONNECTION_FAILED', msg);
      }

      this.lastError = handshakeErr;
      const failedState = this.getHandshakeState();
      this.notifyListeners();
      return { success: false, state: failedState, error: handshakeErr };
    }
  }

  /**
   * Alias for connect() to initiate the complete handshake sequence.
   */
  async initiateHandshake(request?: WalletHandshakeRequest): Promise<WalletHandshakeResult> {
    return this.connect(request);
  }


  /**
   * Refreshes detection, network, and connection state.
   */
  async refresh(): Promise<WalletHandshakeState> {
    const state = this.getHandshakeState();
    this.notifyListeners();
    return state;
  }

  /**
   * Disconnects the active wallet provider session.
   */
  async disconnect(): Promise<void> {
    const provider = this.getProvider();
    this.lastError = null;
    this.isConnecting = false;
    await provider.disconnect();
    this.notifyListeners();
  }

  /**
   * Subscribes a listener to handshake state updates.
   */
  subscribe(listener: WalletHandshakeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Resets handshake service state (useful between tests).
   */
  reset(): void {
    this.lastError = null;
    this.isConnecting = false;
    this.listeners.clear();
  }

  private notifyListeners(): void {
    const state = this.getHandshakeState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch {
        // Prevent listener exception from interrupting state propagation
      }
    }
  }
}

let singletonHandshakeService: WalletHandshakeService | null = null;

/**
 * Returns the singleton WalletHandshakeService instance.
 */
export function getWalletHandshakeService(): WalletHandshakeService {
  if (!singletonHandshakeService) {
    singletonHandshakeService = new WalletHandshakeService();
  }
  return singletonHandshakeService;
}

/**
 * Resets the singleton WalletHandshakeService instance.
 */
export function resetWalletHandshakeService(customProvider?: WalletProvider): void {
  if (singletonHandshakeService) {
    singletonHandshakeService.reset();
  }
  singletonHandshakeService = new WalletHandshakeService(undefined, customProvider);
}

/**
 * Convenience helper to initiate a wallet connection handshake.
 */
export async function performWalletHandshake(
  request?: WalletHandshakeRequest
): Promise<WalletHandshakeResult> {
  return getWalletHandshakeService().initiateHandshake(request);
}

/**
 * Convenience helper to query the current handshake state.
 */
export function getWalletHandshakeState(): WalletHandshakeState {
  return getWalletHandshakeService().getHandshakeState();
}

