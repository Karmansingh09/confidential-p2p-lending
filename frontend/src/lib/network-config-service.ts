import {
  NetworkConfigurationError,
  type NetworkConfig,
  type NetworkConfigurationStatus,
  type NetworkEndpoint,
} from '../types/network-config.ts';

export { NetworkConfigurationError };

/**
 * Default offline local prototype network configuration.
 * Contains ZERO fake remote endpoints, synthetic network IDs, or private credentials.
 */
export const DEFAULT_LOCAL_NETWORK_CONFIG: Readonly<NetworkConfig> = Object.freeze({
  environment: 'LOCAL',
  networkName: 'Local Prototype (In-Memory)',
  networkId: 'midnight-prototype-local',
  nodeRpcEndpoint: null,
  indexerEndpoint: null,
  walletConnectorAvailable: false,
  isRealNetwork: false,
  isPrototype: true,
  status: 'CONFIGURED',
});

/**
 * Validates a candidate NetworkConfig against architectural rules.
 *
 * VALIDATION RULES:
 * 1. Environment must be one of 'LOCAL', 'TESTNET', or 'MAINNET'.
 * 2. LOCAL environment is valid for prototype mode without external endpoints.
 * 3. TESTNET and MAINNET require an authentic nodeRpcEndpoint with valid URL protocol.
 * 4. Never fabricates default external endpoints.
 */
export function validateNetworkConfig(config: NetworkConfig): {
  valid: boolean;
  error?: NetworkConfigurationError;
} {
  if (!config || typeof config !== 'object') {
    const err = new NetworkConfigurationError(
      'INVALID_ENVIRONMENT',
      'Configuration object must be a valid non-null object.'
    );
    return { valid: false, error: err };
  }

  const validEnvironments = ['LOCAL', 'TESTNET', 'MAINNET'];
  if (!validEnvironments.includes(config.environment)) {
    const err = new NetworkConfigurationError(
      'INVALID_ENVIRONMENT',
      `Unknown network environment "${config.environment}". Must be LOCAL, TESTNET, or MAINNET.`
    );
    return { valid: false, error: err };
  }

  if (config.environment === 'LOCAL') {
    return { valid: true };
  }

  // TESTNET or MAINNET requires a genuine nodeRpcEndpoint
  if (!config.nodeRpcEndpoint || !config.nodeRpcEndpoint.url || config.nodeRpcEndpoint.url.trim() === '') {
    const err = new NetworkConfigurationError(
      'MISSING_REQUIRED_ENDPOINT',
      `Real network environment "${config.environment}" requires a valid nodeRpcEndpoint.url.`
    );
    return { valid: false, error: err };
  }

  const validateEndpointUrl = (endpoint: NetworkEndpoint, endpointName: string): NetworkConfigurationError | null => {
    try {
      const parsed = new URL(endpoint.url);
      const validProtocols = ['http:', 'https:', 'ws:', 'wss:'];
      if (!validProtocols.includes(parsed.protocol)) {
        return new NetworkConfigurationError(
          'INVALID_URL_SCHEME',
          `${endpointName} URL scheme "${parsed.protocol}" is invalid. Expected http, https, ws, or wss.`
        );
      }
    } catch {
      return new NetworkConfigurationError(
        'INVALID_URL_SCHEME',
        `Malformed ${endpointName} URL: "${endpoint.url}".`
      );
    }
    return null;
  };

  const rpcErr = validateEndpointUrl(config.nodeRpcEndpoint, 'nodeRpcEndpoint');
  if (rpcErr) {
    return { valid: false, error: rpcErr };
  }

  if (config.indexerEndpoint && config.indexerEndpoint.url && config.indexerEndpoint.url.trim() !== '') {
    const indexerErr = validateEndpointUrl(config.indexerEndpoint, 'indexerEndpoint');
    if (indexerErr) {
      return { valid: false, error: indexerErr };
    }
  }

  return { valid: true };
}

type ConfigListener = (config: NetworkConfig) => void;

/**
 * Network Configuration Service.
 *
 * Centralized, authoritative manager for application network configuration.
 *
 * ARCHITECTURAL INVARIANTS:
 * - Single source of truth for active network configuration.
 * - Enforces truthful representation of local vs real networks.
 * - Rejects malformed or incomplete real-network configurations.
 * - Never invents synthetic network RPC endpoints or network identifiers.
 * - Zero sensitive underwriting metrics or confidential signing credentials handled.
 */
export class NetworkConfigService {
  private activeConfig: NetworkConfig;
  private listeners: Set<ConfigListener> = new Set();

  constructor(initialConfig: NetworkConfig = { ...DEFAULT_LOCAL_NETWORK_CONFIG }) {
    const validation = validateNetworkConfig(initialConfig);
    if (!validation.valid) {
      this.activeConfig = {
        ...initialConfig,
        status: 'INVALID',
      };
    } else {
      this.activeConfig = {
        ...initialConfig,
        status: 'CONFIGURED',
      };
    }
  }

  /**
   * Returns a copy of the active network configuration.
   */
  getNetworkConfig(): NetworkConfig {
    return { ...this.activeConfig };
  }

  /**
   * Alias for getNetworkConfig.
   */
  getConfig(): NetworkConfig {
    return this.getNetworkConfig();
  }

  /**
   * Returns the validation status of the active network configuration.
   */
  getNetworkConfigurationStatus(): NetworkConfigurationStatus {
    return this.activeConfig.status;
  }

  /**
   * Validates a candidate configuration.
   */
  validate(config: NetworkConfig): { valid: boolean; error?: NetworkConfigurationError } {
    return validateNetworkConfig(config);
  }

  /**
   * Sets a new network configuration.
   * Throws NetworkConfigurationError if the configuration is invalid and bypassValidation is false.
   */
  setNetworkConfig(config: NetworkConfig, bypassValidation: boolean = false): void {
    if (!bypassValidation) {
      const validation = validateNetworkConfig(config);
      if (!validation.valid) {
        throw validation.error!;
      }
      this.activeConfig = {
        ...config,
        status: 'CONFIGURED',
      };
    } else {
      this.activeConfig = {
        ...config,
      };
    }

    this.notifyListeners();
  }

  /**
   * Safely updates configuration status (e.g. when wallet connector availability changes).
   */
  updateConnectorAvailability(available: boolean): void {
    if (this.activeConfig.walletConnectorAvailable !== available) {
      this.activeConfig = {
        ...this.activeConfig,
        walletConnectorAvailable: available,
      };
      this.notifyListeners();
    }
  }

  /**
   * Resets active configuration back to default Local Prototype configuration.
   */
  resetNetworkConfig(): void {
    this.activeConfig = { ...DEFAULT_LOCAL_NETWORK_CONFIG };
    this.notifyListeners();
  }

  /**
   * Subscribes to network configuration updates.
   */
  subscribe(listener: ConfigListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const current = this.getNetworkConfig();
    for (const listener of this.listeners) {
      try {
        listener(current);
      } catch (err) {
        console.error('Error notifying network configuration listener:', err);
      }
    }
  }
}

let serviceInstance: NetworkConfigService | null = null;

/**
 * Returns the singleton instance of NetworkConfigService.
 */
export function getNetworkConfigService(): NetworkConfigService {
  if (!serviceInstance) {
    serviceInstance = new NetworkConfigService();
  }
  return serviceInstance;
}

/**
 * Helper function: retrieves the active NetworkConfig.
 */
export function getNetworkConfig(): NetworkConfig {
  return getNetworkConfigService().getNetworkConfig();
}

/**
 * Helper function: retrieves the active NetworkConfigurationStatus.
 */
export function getNetworkConfigurationStatus(): NetworkConfigurationStatus {
  return getNetworkConfigService().getNetworkConfigurationStatus();
}

/**
 * Helper function: sets the active NetworkConfig.
 */
export function setNetworkConfig(config: NetworkConfig): void {
  getNetworkConfigService().setNetworkConfig(config);
}

/**
 * Resets the singleton instance of NetworkConfigService (useful for unit tests).
 */
export function resetNetworkConfigService(initialConfig?: NetworkConfig): NetworkConfigService {
  serviceInstance = new NetworkConfigService(initialConfig);
  return serviceInstance;
}

/**
 * Helper function: resets to default NetworkConfig.
 */
export function resetNetworkConfig(): void {
  getNetworkConfigService().resetNetworkConfig();
}

