import type {
  WalletSession,
  WalletSessionStatus,
  WalletSessionRequest,
  WalletSessionResult,
} from '../types/wallet-session.ts';
import { WalletSessionError } from '../types/wallet-session.ts';
import type {
  WalletDetectionStatus,
  WalletAccountIdentity,
  WalletNetworkInfo,
  WalletCapabilitySet,
  WalletProviderKind,
} from '../types/wallet-adapter.ts';
import { WalletAdapterError } from '../types/wallet-adapter.ts';
import type { WalletProvider } from './wallet-provider.ts';
import {
  LocalPrototypeWalletProvider,
  createDefaultWalletProvider,
} from './midnight-provider.ts';
import {
  MidnightWalletAdapter,
  createMidnightWalletAdapter,
} from './midnight-wallet-adapter.ts';
import type { AccountRole } from '../types/account.ts';
import type { LoanDetailsModel } from '../types/index.ts';

/**
 * Listener callback invoked on session transitions.
 */
export type WalletSessionListener = (session: WalletSession) => void;

/**
 * WalletSessionService coordinates wallet connection lifecycle, active provider detection,
 * session subscriptions, and public account identity resolution.
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. Honest State: Disconnected sessions report status 'DISCONNECTED', missing connectors report 'UNSUPPORTED' or 'NOT_DETECTED'.
 * 2. Anti-Fabrication: Never fabricates connected status or synthetic blockchain primitives.
 * 3. Strict Privacy: Zero private underwriting inputs, secret witnesses, or credentials ever enter session state.
 * 4. Browser/SSR Safety: All window.midnight inspections are guarded by typeof window !== 'undefined'.
 */
export class WalletSessionService {
  private activeProvider: WalletProvider;
  private currentSession: WalletSession;
  private listeners: Set<WalletSessionListener> = new Set();

  constructor(initialProvider?: WalletProvider) {
    this.activeProvider = initialProvider ?? createDefaultWalletProvider();
    this.currentSession = this.createInitialSession(this.activeProvider);
  }

  /**
   * Initializes session snapshot based on the active provider's initial state.
   */
  private createInitialSession(provider: WalletProvider): WalletSession {
    const isProto = provider.isPrototype;
    const kind: WalletProviderKind =
      provider.kind ?? (isProto ? 'LOCAL_PROTOTYPE' : 'MIDNIGHT');

    const detectionStatus: WalletDetectionStatus = provider.getDetectionStatus
      ? provider.getDetectionStatus()
      : isProto
      ? 'DETECTED'
      : typeof window === 'undefined'
      ? 'UNSUPPORTED'
      : 'NOT_DETECTED';

    const netContext = provider.getNetworkContext();
    const network: WalletNetworkInfo = {
      environment: netContext.environment,
      networkName: netContext.networkName,
      isPrototype: netContext.isPrototype,
      isRealNetwork: netContext.isRealNetwork,
    };

    const capabilities: WalletCapabilitySet = provider.getCapabilities();

    // In prototype provider, if account is pre-attached, read it; otherwise disconnected
    const rawAccount = provider.getAccount();
    const account: WalletAccountIdentity | null = rawAccount
      ? {
          address: rawAccount.address ?? rawAccount.publicKeyHex ?? '',
          publicKey: rawAccount.publicKey,
          publicKeyHex: rawAccount.publicKeyHex,
          role: rawAccount.role,
          displayName: rawAccount.displayName,
        }
      : null;

    const status: WalletSessionStatus =
      provider.getConnectionStatus() === 'CONNECTED' && account
        ? 'CONNECTED'
        : 'DISCONNECTED';

    return {
      status,
      providerKind: kind,
      detectionStatus,
      account,
      network,
      capabilities,
      error: null,
      connectedAt: status === 'CONNECTED' ? Date.now() : null,
    };
  }

  /**
   * Returns current active wallet provider.
   */
  getProvider(): WalletProvider {
    return this.activeProvider;
  }

  /**
   * Returns a snapshot of the current wallet session.
   */
  getSession(): WalletSession {
    return {
      ...this.currentSession,
      capabilities: { ...this.currentSession.capabilities },
      network: { ...this.currentSession.network },
      account: this.currentSession.account ? { ...this.currentSession.account } : null,
    };
  }

  /**
   * Safely inspects detection status of the active provider / browser connector.
   */
  getDetectionStatus(): WalletDetectionStatus {
    if (this.activeProvider.getDetectionStatus) {
      return this.activeProvider.getDetectionStatus();
    }
    if (this.activeProvider.isPrototype) {
      return 'DETECTED';
    }
    if (typeof window === 'undefined') {
      return 'UNSUPPORTED';
    }
    return 'NOT_DETECTED';
  }

  /**
   * Returns the connected public account identity, or null if disconnected.
   */
  getAccount(): WalletAccountIdentity | null {
    return this.currentSession.account ? { ...this.currentSession.account } : null;
  }

  /**
   * Returns public key bytes of connected account, or null.
   */
  getPublicKey(): Uint8Array | null {
    return this.currentSession.account?.publicKey ?? null;
  }

  /**
   * Returns public network info.
   */
  getNetworkInfo(): WalletNetworkInfo {
    return { ...this.currentSession.network };
  }

  /**
   * Returns atomic capability matrix.
   */
  getCapabilities(): WalletCapabilitySet {
    return { ...this.currentSession.capabilities };
  }

  /**
   * Subscribes a listener to session state updates.
   * Returns an unsubscribe function.
   */
  subscribe(listener: WalletSessionListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notifies all registered listeners of a session state transition.
   */
  private notifyListeners(): void {
    const snapshot = this.getSession();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch {
        // Prevent listener exceptions from interrupting notify loop
      }
    }
  }

  /**
   * Switches active provider to the Local Prototype Provider.
   */
  switchToPrototypeProvider(
    role: AccountRole = 'BORROWER',
    customLoan?: LoanDetailsModel
  ): WalletSession {
    const protoProvider = new LocalPrototypeWalletProvider();
    protoProvider.connectSync(role, customLoan);
    this.activeProvider = protoProvider;
    this.currentSession = this.createInitialSession(protoProvider);
    this.notifyListeners();
    return this.getSession();
  }

  /**
   * Switches active provider to the Midnight / Lace Wallet Adapter.
   */
  switchToMidnightAdapter(adapter?: WalletProvider): WalletSession {
    this.activeProvider = adapter ?? createMidnightWalletAdapter();
    this.currentSession = this.createInitialSession(this.activeProvider);
    this.notifyListeners();
    return this.getSession();
  }

  /**
   * Directly sets the active provider adapter (for testing or injection).
   */
  setProvider(provider: WalletProvider): WalletSession {
    this.activeProvider = provider;
    this.currentSession = this.createInitialSession(provider);
    this.notifyListeners();
    return this.getSession();
  }

  /**
   * Establishes a wallet session through the active provider.
   *
   * ANTI-FABRICATION GUARANTEE:
   * In non-browser environments or when Lace is absent, maps failures to typed
   * WalletSessionError ('WALLET_NOT_DETECTED' or 'UNSUPPORTED_PROVIDER').
   */
  async connect(request?: WalletSessionRequest): Promise<WalletSessionResult> {
    if (this.currentSession.status === 'CONNECTING') {
      const error = new WalletSessionError(
        'ALREADY_CONNECTING',
        'Connection request is already in progress.'
      );
      return { success: false, session: this.getSession(), error };
    }

    // If a different provider kind was explicitly requested, switch first
    if (request?.providerKind) {
      if (
        request.providerKind === 'LOCAL_PROTOTYPE' &&
        !this.activeProvider.isPrototype
      ) {
        this.switchToPrototypeProvider(request.role ?? 'BORROWER', request.customLoan);
      } else if (
        request.providerKind === 'MIDNIGHT' ||
        request.providerKind === 'LACE'
      ) {
        if (this.activeProvider.isPrototype) {
          this.switchToMidnightAdapter();
        }
      }
    }

    const provider = this.activeProvider;

    // Transition to CONNECTING
    this.currentSession = {
      ...this.currentSession,
      status: 'CONNECTING',
      error: null,
    };
    this.notifyListeners();

    try {
      const role = request?.role ?? 'BORROWER';
      const netAccount = await provider.connect(role, request?.customLoan);

      const netContext = provider.getNetworkContext();
      const capabilities = provider.getCapabilities();

      const account: WalletAccountIdentity = {
        address: netAccount.address ?? netAccount.publicKeyHex ?? '',
        publicKey: netAccount.publicKey,
        publicKeyHex: netAccount.publicKeyHex,
        role: netAccount.role,
        displayName: netAccount.displayName,
      };

      this.currentSession = {
        status: 'CONNECTED',
        providerKind: provider.kind ?? (provider.isPrototype ? 'LOCAL_PROTOTYPE' : 'MIDNIGHT'),
        detectionStatus: this.getDetectionStatus(),
        account,
        network: {
          environment: netContext.environment,
          networkName: netContext.networkName,
          isPrototype: netContext.isPrototype,
          isRealNetwork: netContext.isRealNetwork,
        },
        capabilities,
        error: null,
        connectedAt: Date.now(),
      };

      this.notifyListeners();
      return { success: true, session: this.getSession() };
    } catch (err: unknown) {
      let sessionStatus: WalletSessionStatus = 'FAILED';
      let sessionError: WalletSessionError;

      if (err instanceof WalletAdapterError) {
        if (err.code === 'WALLET_NOT_DETECTED') {
          sessionStatus = 'UNSUPPORTED';
          sessionError = new WalletSessionError(
            'WALLET_NOT_DETECTED',
            'Lace Wallet extension is not installed or detected in this browser.',
            err.details
          );
        } else if (err.code === 'USER_REJECTED') {
          sessionStatus = 'REJECTED';
          sessionError = new WalletSessionError(
            'USER_REJECTED',
            'Wallet connection request was declined by the user.',
            err.details
          );
        } else if (err.code === 'UNSUPPORTED_OPERATION') {
          sessionStatus = 'UNSUPPORTED';
          sessionError = new WalletSessionError(
            'UNSUPPORTED_PROVIDER',
            err.message,
            err.details
          );
        } else {
          sessionStatus = 'FAILED';
          sessionError = new WalletSessionError(
            'CONNECTION_FAILED',
            err.message,
            err.details
          );
        }
      } else if (err instanceof Error) {
        sessionStatus = 'FAILED';
        sessionError = new WalletSessionError(
          'CONNECTION_FAILED',
          err.message
        );
      } else {
        sessionStatus = 'FAILED';
        sessionError = new WalletSessionError(
          'CONNECTION_FAILED',
          'An unknown error occurred while establishing wallet session.'
        );
      }

      this.currentSession = {
        ...this.currentSession,
        status: sessionStatus,
        account: null,
        error: sessionError,
        connectedAt: null,
      };

      this.notifyListeners();
      return { success: false, session: this.getSession(), error: sessionError };
    }
  }

  /**
   * Disconnects the active wallet session cleanly.
   */
  async disconnect(): Promise<WalletSessionResult> {
    try {
      await this.activeProvider.disconnect();
    } catch {
      // Ignore disconnect provider errors
    }

    const netContext = this.activeProvider.getNetworkContext();
    this.currentSession = {
      status: 'DISCONNECTED',
      providerKind:
        this.activeProvider.kind ??
        (this.activeProvider.isPrototype ? 'LOCAL_PROTOTYPE' : 'MIDNIGHT'),
      detectionStatus: this.getDetectionStatus(),
      account: null,
      network: {
        environment: netContext.environment,
        networkName: netContext.networkName,
        isPrototype: netContext.isPrototype,
        isRealNetwork: netContext.isRealNetwork,
      },
      capabilities: this.activeProvider.getCapabilities(),
      error: null,
      connectedAt: null,
    };

    this.notifyListeners();
    return { success: true, session: this.getSession() };
  }
}

/**
 * Singleton instance of the WalletSessionService for global app lifecycle.
 */
let globalSessionService: WalletSessionService | null = null;

export function getWalletSessionService(): WalletSessionService {
  if (!globalSessionService) {
    globalSessionService = new WalletSessionService();
  }
  return globalSessionService;
}

/**
 * Resets the global session service instance (useful for unit tests).
 */
export function resetWalletSessionService(provider?: WalletProvider): WalletSessionService {
  globalSessionService = new WalletSessionService(provider);
  return globalSessionService;
}

/**
 * Helper to retrieve current session snapshot.
 */
export function getCurrentWalletSession(): WalletSession {
  return getWalletSessionService().getSession();
}

/**
 * Helper to initiate wallet connection.
 */
export async function connectWalletSession(
  request?: WalletSessionRequest
): Promise<WalletSessionResult> {
  return getWalletSessionService().connect(request);
}

/**
 * Helper to terminate wallet connection.
 */
export async function disconnectWalletSession(): Promise<WalletSessionResult> {
  return getWalletSessionService().disconnect();
}

/**
 * Helper to subscribe to session state changes.
 */
export function subscribeToWalletSession(
  listener: WalletSessionListener
): () => void {
  return getWalletSessionService().subscribe(listener);
}
