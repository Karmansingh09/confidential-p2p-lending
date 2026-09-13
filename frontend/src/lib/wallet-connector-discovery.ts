import type {
  ProviderCapabilities,
  WalletConnectionStatus,
} from '../types/network.ts';
import type {
  ConnectorReadinessState,
  NetworkConfigurationStatus,
} from '../types/network-config.ts';
import type { WalletProvider } from './wallet-provider.ts';

/**
 * Expected Midnight window connector interface representation.
 */
export interface MidnightLaceConnector {
  enable?: () => Promise<unknown>;
  isEnabled?: () => Promise<boolean>;
  apiVersion?: string;
  name?: string;
  signTransaction?: (tx: unknown) => Promise<unknown>;
  submitTransaction?: (tx: unknown) => Promise<unknown>;
}

export interface MidnightBrowserWindow {
  midnight?: {
    lace?: MidnightLaceConnector;
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
}

/**
 * Safely inspects the execution environment for a Midnight/Lace wallet connector.
 *
 * SSR & NODE.JS SAFETY:
 * - Checks `typeof window !== 'undefined'` before accessing window properties.
 * - Never throws runtime ReferenceError in Node.js or server-side rendering contexts.
 * - Supports mock injection for hermetic unit testing without global pollution.
 */
export function discoverWalletConnector(
  mockConnector?: unknown
): ConnectorDiscoveryResult {
  if (mockConnector !== undefined) {
    if (mockConnector && typeof mockConnector === 'object') {
      const mockObj = mockConnector as Record<string, unknown>;
      const hasLace = !!mockObj.lace || Object.keys(mockObj).length > 0;
      return {
        isBrowser: true,
        detected: true,
        compatible: hasLace,
        connectorName: (mockObj.name as string) || 'Midnight / Lace Mock Connector',
        apiVersion: (mockObj.apiVersion as string) || '1.0.0',
        description: hasLace
          ? 'Midnight connector detected via injected mock harness.'
          : 'Injected mock connector is missing expected Lace properties.',
      };
    }
    return {
      isBrowser: true,
      detected: false,
      compatible: false,
      description: 'Injected mock connector is empty, null, or unavailable.',
    };
  }

  if (typeof window === 'undefined') {
    return {
      isBrowser: false,
      detected: false,
      compatible: false,
      description: 'Connector API unavailable in current workspace (SSR/Node.js environment).',
    };
  }

  try {
    const win = window as unknown as MidnightBrowserWindow;
    if (!win.midnight) {
      return {
        isBrowser: true,
        detected: false,
        compatible: false,
        description: 'No Midnight wallet extension detected on window.midnight.',
      };
    }

    const lace = win.midnight.lace;
    if (lace && typeof lace === 'object') {
      const isCompatible = typeof lace.enable === 'function' || typeof lace.isEnabled === 'function';
      return {
        isBrowser: true,
        detected: true,
        compatible: isCompatible,
        connectorName: lace.name || 'Midnight Lace Wallet',
        apiVersion: lace.apiVersion || 'unknown',
        description: isCompatible
          ? 'Compatible Midnight Lace wallet connector discovered.'
          : 'Midnight Lace connector object present but lacks standard enable interface.',
      };
    }

    return {
      isBrowser: true,
      detected: true,
      compatible: false,
      description: 'window.midnight is present but lace connector object was not found.',
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
