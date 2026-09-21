import type { NetworkConfig } from '../types/network-config.ts';
import { LOCAL_PROTOTYPE_NETWORK_ID } from '../types/network-config.ts';
import type { NetworkCompatibilityStatus } from '../types/wallet-handshake.ts';

export interface NetworkCompatibilityEvaluation {
  compatibility: NetworkCompatibilityStatus;
  isMatch: boolean;
  expectedNetworkId: string;
  reportedNetworkId: string | null;
  reason: string;
}

/**
 * Normalizes a network identifier string for deterministic comparison.
 */
export function normalizeNetworkId(networkId?: string | null): string {
  if (!networkId) return '';
  const cleaned = networkId.trim().toLowerCase();
  if (cleaned === 'preprod-testnet' || cleaned === 'preprod') return 'preprod';
  if (cleaned === 'preview-testnet' || cleaned === 'preview') return 'preview';
  return cleaned;
}

/**
 * Evaluates whether a wallet-reported network matches the expected application network configuration.
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. UNKNOWN IS NEVER MATCH: If the wallet does not report a network, compatibility is UNKNOWN (not MATCH).
 * 2. MISMATCH IS STRICT: Different network identifiers are reported as MISMATCH and block transaction preparation.
 * 3. LOCAL PROTOTYPE: When running in local prototype mode, matching local identifiers evaluates to MATCH.
 * 4. ANTI-FABRICATION: Never guesses or fabricates a matching network identifier when none was provided.
 */
export function evaluateNetworkCompatibility(
  expectedConfig: NetworkConfig,
  reportedNetworkId?: string | null
): NetworkCompatibilityEvaluation {
  const expectedId =
    expectedConfig.networkId ??
    (expectedConfig.environment === 'LOCAL' ? LOCAL_PROTOTYPE_NETWORK_ID : '');
  const normalizedExpected = normalizeNetworkId(expectedId);
  const normalizedReported = normalizeNetworkId(reportedNetworkId);

  // If wallet reported network is absent or empty, status is UNKNOWN
  if (!normalizedReported) {
    return {
      compatibility: 'UNKNOWN',
      isMatch: false,
      expectedNetworkId: expectedId,
      reportedNetworkId: null,
      reason: 'Wallet has not reported a network identifier. Network compatibility is unknown.',
    };
  }

  // Exact or normalized match
  if (normalizedExpected === normalizedReported) {
    return {
      compatibility: 'MATCH',
      isMatch: true,
      expectedNetworkId: expectedId,
      reportedNetworkId: reportedNetworkId ?? null,
      reason: `Wallet network "${reportedNetworkId}" matches expected configuration "${expectedId}".`,
    };
  }

  // Known canonical equivalence aliases (e.g. preview-testnet vs preview, or midnight-testnet if same generic testnet)
  const isGenericTestnetPair =
    (normalizedExpected.includes('testnet') || normalizedExpected === 'testnet') &&
    (normalizedReported.includes('testnet') || normalizedReported === 'testnet') &&
    !normalizedExpected.includes('preview') &&
    !normalizedReported.includes('preview') &&
    !normalizedExpected.includes('preprod') &&
    !normalizedReported.includes('preprod');

  if (isGenericTestnetPair && expectedConfig.environment === 'TESTNET') {
    return {
      compatibility: 'MATCH',
      isMatch: true,
      expectedNetworkId: expectedId,
      reportedNetworkId: reportedNetworkId ?? null,
      reason: `Wallet network "${reportedNetworkId}" is compatible with expected testnet "${expectedId}".`,
    };
  }

  // Mismatch detected
  return {
    compatibility: 'MISMATCH',
    isMatch: false,
    expectedNetworkId: expectedId,
    reportedNetworkId: reportedNetworkId ?? null,
    reason: `Network mismatch: Wallet reports "${reportedNetworkId}", but application expects "${expectedId}".`,
  };
}
