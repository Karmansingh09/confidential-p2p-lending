/**
 * Contract Address Validator for Midnight Compact Contracts.
 *
 * SPECIFICATION REFERENCE:
 * Matches @midnight-ntwrk/compact-runtime specification:
 * - CONTRACT_ADDRESS_BYTE_LENGTH = 32 (32 bytes = 64 hexadecimal characters)
 * - HEX_REGEX_NO_PREFIX = /^([0-9A-Fa-f]{2})*$/
 *
 * Supports raw 64-character hex strings and standard '0x'-prefixed 66-character hex strings.
 * Rejects missing, empty, malformed, non-hex, and incorrectly sized strings.
 */

import { ContractDeploymentError } from '../types/contract-deployment.ts';

export const CONTRACT_ADDRESS_BYTE_LENGTH = 32;
export const CONTRACT_ADDRESS_HEX_LENGTH = CONTRACT_ADDRESS_BYTE_LENGTH * 2; // 64

export interface ContractAddressValidationResult {
  /** Whether the address structure conforms to Midnight contract address rules */
  valid: boolean;
  isValid: boolean;
  /** Explanatory failure reason if invalid */
  error?: string;
  /** Machine-readable error code if invalid */
  errorCode?: 'EMPTY_ADDRESS' | 'INVALID_LENGTH' | 'INVALID_HEX' | 'INVALID_ADDRESS';
  /** Normalized lowercase 64-character hex string without 0x prefix if valid */
  normalizedAddress?: string;
  /** Formatted display address with 0x prefix */
  formattedAddress?: string;
}

/**
 * Normalizes a candidate address by stripping whitespace and optional 0x prefix,
 * returning a lowercase hexadecimal string.
 * Throws ContractDeploymentError if invalid.
 */
export function normalizeContractAddress(raw: string): string {
  const res = validateContractAddress(raw);
  if (!res.isValid || !res.normalizedAddress) {
    throw new ContractDeploymentError('INVALID_ADDRESS', res.error ?? 'Invalid contract address structure.');
  }
  return res.normalizedAddress;
}

/**
 * Validates a candidate Midnight contract address structure.
 *
 * INVARIANTS:
 * 1. Must be a non-empty string.
 * 2. Must consist strictly of hexadecimal digits (0-9, a-f, A-F).
 * 3. Must represent exactly 32 bytes (64 hex characters, or 66 with '0x' prefix).
 * 4. Never fabricates or synthesizes addresses.
 */
export function validateContractAddress(candidate: unknown): ContractAddressValidationResult {
  if (candidate === null || candidate === undefined) {
    return {
      valid: false,
      isValid: false,
      errorCode: 'EMPTY_ADDRESS',
      error: 'Contract address is required but was null or undefined.',
    };
  }

  if (typeof candidate !== 'string') {
    return {
      valid: false,
      isValid: false,
      errorCode: 'INVALID_ADDRESS',
      error: `Contract address must be a string, received ${typeof candidate}.`,
    };
  }

  const trimmed = candidate.trim();
  if (trimmed.length === 0) {
    return {
      valid: false,
      isValid: false,
      errorCode: 'EMPTY_ADDRESS',
      error: 'Contract address cannot be an empty string.',
    };
  }

  const rawHex = trimmed.startsWith('0x') || trimmed.startsWith('0X')
    ? trimmed.slice(2)
    : trimmed;

  if (rawHex.length !== CONTRACT_ADDRESS_HEX_LENGTH) {
    return {
      valid: false,
      isValid: false,
      errorCode: 'INVALID_LENGTH',
      error: `Invalid contract address length: expected ${CONTRACT_ADDRESS_HEX_LENGTH} hex characters (32 bytes), received ${rawHex.length}.`,
    };
  }

  const hexPattern = /^[0-9a-fA-F]{64}$/;
  if (!hexPattern.test(rawHex)) {
    return {
      valid: false,
      isValid: false,
      errorCode: 'INVALID_HEX',
      error: 'Contract address contains invalid non-hexadecimal characters.',
    };
  }

  const normalized = rawHex.toLowerCase();
  return {
    valid: true,
    isValid: true,
    normalizedAddress: normalized,
    formattedAddress: `0x${normalized}`,
  };
}

/**
 * Simple boolean predicate for checking contract address validity.
 */
export function isValidContractAddress(candidate: unknown): boolean {
  return validateContractAddress(candidate).valid;
}
