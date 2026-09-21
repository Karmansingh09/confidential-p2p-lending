import type {
  ProviderCapabilities,
  WalletConnectionStatus,
} from '../types/network.ts';
import type {
  ConnectorReadinessState,
  NetworkConfigurationStatus,
} from '../types/network-config.ts';
import type {
  LaceConnectionState,
  MidnightInitialAPI,
  MidnightConnectedAPI,
} from '../types/wallet-adapter.ts';
import type { WalletProvider } from './wallet-provider.ts';

/**
 * Expected Midnight window connector interface representation.
 * Kept for backward compatibility with testing harnesses.
 */
export interface MidnightLaceConnector {
  enable?: () => Promise<MidnightConnectedAPI | unknown>;
  isEnabled?: () => Promise<boolean>;
  apiVersion?: string;
  name?: string;
  connect?: (networkId: string) => Promise<MidnightConnectedAPI>;
  signTransaction?: (tx: unknown) => Promise<unknown>;
  submitTransaction?: (tx: unknown) => Promise<unknown>;
}

export interface MidnightBrowserWindow {
  midnight?: {
    mnLace?: MidnightInitialAPI | MidnightLaceConnector;
    lace?: MidnightInitialAPI | MidnightLaceConnector;
    [key: string]: unknown;
  };
}

export interface ConnectorDiscoveryResult {
  isBrowser: boolean;
  detected: boolean;
  compatible: boolean;
  connectorName?: string;
  apiVersion?: string;
  description: string;
  connector?: MidnightInitialAPI | MidnightLaceConnector | unknown;
}

/**
 * Safely inspects the execution environment for a Midnight/Lace wallet connector.
 *
 * CONSERVATIVE DISCOVERY INVARIANT:
 * - Prefers officially documented Midnight Lace injection on `window.midnight.mnLace`.
 * - Falls back to `window.midnight.lace`.
 * - Strictly avoids treating arbitrary objects as wallets: any additional key must
 *   explicitly identify itself via `rdns` or `name` matching Midnight / Lace and
 *   provide the standard `connect` or `enable` interface.
 * - Supports mock injection for hermetic unit testing without global pollution.
 */
export function discoverWalletConnector(
  mockConnector?: unknown
): ConnectorDiscoveryResult {
  const isMockWindow = mockConnector && typeof mockConnector === 'object' && ('midnight' in mockConnector);

  if (mockConnector !== undefined && !isMockWindow) {
    if (mockConnector && typeof mockConnector === 'object') {
      const mockObj = mockConnector as Record<string, unknown>;
      const hasLace = !!mockObj.lace || !!mockObj.mnLace || typeof mockObj.connect === 'function' || typeof mockObj.enable === 'function' || Object.keys(mockObj).length > 0;
      const innerConnector = mockObj.mnLace || mockObj.lace || mockObj;
      return {
        isBrowser: true,
        detected: hasLace,
        compatible: hasLace,
        connectorName: (mockObj.name as string) || (mockObj.connectorName as string) || 'Midnight / Lace Mock Connector',
        apiVersion: (mockObj.apiVersion as string) || '1.0.0',
        description: hasLace
          ? 'Midnight connector detected via injected mock harness.'
          : 'Injected mock connector is missing expected Lace properties.',
        connector: hasLace ? innerConnector : null,
      };
    }
    return {
      isBrowser: true,
      detected: false,
      compatible: false,
      description: 'Injected mock connector is empty, null, or unavailable.',
      connector: null,
    };
  }

  const win = isMockWindow
    ? (mockConnector as unknown as MidnightBrowserWindow)
    : (typeof window !== 'undefined' ? (window as unknown as MidnightBrowserWindow) : null);

  if (!win) {
    return {
      isBrowser: false,
      detected: false,
      compatible: false,
      description: 'Connector API unavailable in current workspace (SSR/Node.js environment).',
      connector: null,
    };
  }

  try {
    if (!win.midnight || typeof win.midnight !== 'object' || Object.keys(win.midnight).length === 0) {
      return {
        isBrowser: true,
        detected: false,
        compatible: false,
        description: 'No Midnight wallet extension detected on window.midnight.',
        connector: null,
      };
    }

    // 1. Primary official Midnight Lace injection path: window.midnight.mnLace
    const mnLace = win.midnight.mnLace;
    if (mnLace && typeof mnLace === 'object') {
      const candidate = mnLace as MidnightInitialAPI | MidnightLaceConnector;
      const isCompatible = typeof candidate.connect === 'function' || typeof candidate.enable === 'function' || typeof candidate.isEnabled === 'function';
      return {
        isBrowser: true,
        detected: true,
        compatible: isCompatible,
        connectorName: candidate.name || 'mnLace',
        apiVersion: candidate.apiVersion || 'unknown',
        description: isCompatible
          ? 'Official Midnight Lace connector (window.midnight.mnLace) discovered.'
          : 'window.midnight.mnLace present but missing connect/enable method.',
        connector: candidate,
      };
    }

    // 2. Secondary/legacy injection path: window.midnight.lace
    const lace = win.midnight.lace;
    if (lace && typeof lace === 'object') {
      const candidate = lace as MidnightInitialAPI | MidnightLaceConnector;
      const isCompatible = typeof candidate.connect === 'function' || typeof candidate.enable === 'function' || typeof candidate.isEnabled === 'function';
      return {
        isBrowser: true,
        detected: true,
        compatible: isCompatible,
        connectorName: candidate.name || 'lace',
        apiVersion: candidate.apiVersion || 'unknown',
        description: isCompatible
          ? 'Compatible Midnight Lace wallet connector (window.midnight.lace) discovered.'
          : 'window.midnight.lace connector object present but lacks standard connect/enable interface.',
        connector: candidate,
      };
    }

    // 3. Conservative UUID discovery: only accept objects that explicitly identify as Midnight/Lace
    for (const [key, val] of Object.entries(win.midnight)) {
      if (val && typeof val === 'object') {
        const candidate = val as Record<string, unknown>;
        const name = typeof candidate.name === 'string' ? candidate.name.toLowerCase() : '';
        const rdns = typeof candidate.rdns === 'string' ? candidate.rdns.toLowerCase() : '';
        const isLaceOrMidnight = name.includes('lace') || name.includes('midnight') || rdns.includes('lace') || rdns.includes('midnight');
        const hasConnect = typeof candidate.connect === 'function' || typeof candidate.enable === 'function';

        if (isLaceOrMidnight && hasConnect) {
          return {
            isBrowser: true,
            detected: true,
            compatible: true,
            connectorName: (candidate.name as string) || `Midnight Wallet (${key})`,
            apiVersion: (candidate.apiVersion as string) || 'unknown',
            description: `Compatible Midnight wallet connector discovered at window.midnight.${key}.`,
            connector: candidate,
          };
        }
      }
    }

    return {
      isBrowser: true,
      detected: false,
      compatible: false,
      description: 'window.midnight is present but no valid Midnight Lace wallet connector was identified.',
      connector: null,
    };
  } catch (err) {
    return {
      isBrowser: true,
      detected: false,
      compatible: false,
      description: `Error inspecting browser environment: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Dynamically evaluates provider capabilities.
 *
 * PRIVACY & ANTI-FABRICATION GUARANTEES:
 * - LocalPrototypeWalletProvider strictly returns SIGN_TRANSACTION: false and SUBMIT_TRANSACTION: false.
 * - Real connectors only report capabilities that are actively supported and exposed.
 * - Zero sensitive underwriting metrics or confidential signing credentials are held.
 */
export function evaluateConnectorCapabilities(
  provider: WalletProvider | null
): ProviderCapabilities {
  if (!provider) {
    return {
      READ_PUBLIC_LEDGER: true,
      CREATE_PROOF: true,
      READ_ACCOUNT_IDENTITY: false,
      SIGN_TRANSACTION: false,
      SUBMIT_TRANSACTION: false,
      READ_TRANSACTION_STATUS: false,
      READ_BALANCE: false,
    };
  }

  if (provider.isPrototype) {
    return {
      READ_PUBLIC_LEDGER: true,
      CREATE_PROOF: true,
      READ_ACCOUNT_IDENTITY: true,
      SIGN_TRANSACTION: false,
      SUBMIT_TRANSACTION: false,
      READ_TRANSACTION_STATUS: false,
      READ_BALANCE: false,
    };
  }

  // Derive from active provider
  const baseCaps = provider.getCapabilities();
  return {
    READ_PUBLIC_LEDGER: !!baseCaps.READ_PUBLIC_LEDGER,
    CREATE_PROOF: !!baseCaps.CREATE_PROOF,
    READ_ACCOUNT_IDENTITY: !!baseCaps.READ_ACCOUNT_IDENTITY || provider.getConnectionStatus() === 'CONNECTED',
    SIGN_TRANSACTION: !!baseCaps.SIGN_TRANSACTION,
    SUBMIT_TRANSACTION: !!baseCaps.SUBMIT_TRANSACTION,
    READ_TRANSACTION_STATUS: !!baseCaps.READ_TRANSACTION_STATUS,
    READ_BALANCE: !!baseCaps.READ_BALANCE,
  };
}

export interface ReadinessEvaluationParams {
  detected: boolean;
  compatible: boolean;
  networkStatus: NetworkConfigurationStatus;
  connectionStatus: WalletConnectionStatus;
  capabilities: ProviderCapabilities;
  hasError?: boolean;
  isReadyToConnect?: boolean;
}

/**
 * Resolves the formal ConnectorReadinessState.
 *
 * CRITICAL DISCRIMINATIONS:
 * 1. DETECTED != CONNECTED: An available browser extension does not imply an established session.
 * 2. CONNECTED != TRANSACTION_CAPABLE: An active session cannot submit transactions unless
 *    both SIGN_TRANSACTION and SUBMIT_TRANSACTION capabilities are genuinely available.
 * 3. Local Prototype Provider can reach CONNECTED, but NEVER TRANSACTION_CAPABLE.
 */
export function resolveConnectorReadinessState(
  params: ReadinessEvaluationParams
): ConnectorReadinessState {
  if (params.hasError) {
    return 'ERROR';
  }

  if (!params.detected) {
    return 'NOT_DETECTED';
  }

  if (!params.compatible) {
    return 'INCOMPATIBLE';
  }

  if (params.networkStatus !== 'CONFIGURED') {
    return 'CONFIGURATION_REQUIRED';
  }

  if (params.connectionStatus !== 'CONNECTED') {
    return params.isReadyToConnect ? 'READY' : 'DETECTED';
  }

  // Session is CONNECTED at this point.
  // Check whether active provider is genuinely capable of signing and submitting on-chain transactions.
  const canSign = params.capabilities.SIGN_TRANSACTION;
  const canSubmit = params.capabilities.SUBMIT_TRANSACTION;

  if (canSign && canSubmit) {
    return 'TRANSACTION_CAPABLE';
  }

  return 'CONNECTED';
}

export interface LaceStateEvaluationParams {
  isDetected: boolean;
  isConnecting?: boolean;
  isConnected: boolean;
  isRejected?: boolean;
  networkCompatible?: boolean;
  canSign?: boolean;
  canSubmit?: boolean;
}

/**
 * Resolves the formal 9-state LaceConnectionState.
 *
 * CRITICAL DISCRIMINATIONS:
 * 1. DETECTED != CONNECTED
 * 2. CONNECTED != TRANSACTION_CAPABLE
 * 3. TRANSACTION_CAPABLE != CONTRACT_READY
 * 4. NEVER collapse the 9 states into a single boolean.
 */
export function resolveLaceConnectionState(
  params: LaceStateEvaluationParams
): LaceConnectionState {
  if (params.isRejected) {
    return 'CONNECTION_REJECTED';
  }
  if (!params.isDetected) {
    return 'LACE_NOT_DETECTED';
  }
  if (params.isConnecting) {
    return 'CONNECTING';
  }
  if (!params.isConnected) {
    return 'LACE_DETECTED';
  }
  if (params.networkCompatible === false) {
    return 'UNSUPPORTED_NETWORK';
  }
  if (!params.canSign || !params.canSubmit) {
    return 'CONNECTED_NOT_TRANSACTION_CAPABLE';
  }
  return 'READY';
}

