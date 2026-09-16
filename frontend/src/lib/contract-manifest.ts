import type {
  ContractCircuitDefinition,
  ContractCircuitClassification,
} from '../types/contract-deployment.ts';
import type { LifecycleTransactionAction } from '../types/transaction-orchestration.ts';

/**
 * The 6 canonical circuits declared in contracts/src/index.compact.
 * Cryptographic source of truth: contracts/src/index.compact.
 */
export const CANONICAL_CIRCUIT_NAMES = [
  'verifyEligibility',
  'fundLoan',
  'repayLoan',
  'settleLoan',
  'getLoanStatus',
  'getLoanDetails',
] as const;

export type CanonicalCircuitName = (typeof CANONICAL_CIRCUIT_NAMES)[number];

/**
 * Expected SHA-256 fingerprint of contracts/src/index.compact.
 */
export const COMPACT_SOURCE_FINGERPRINT =
  '608d88fbbf3380ebf479d6cfb4310dd9dd8eb0db124797de16a0fe77f9785f53';

/**
 * Authoritative Application-Side Contract Circuit Manifest.
 *
 * Single frontend reference for Compact smart contract circuit metadata,
 * operational requirements, and lifecycle action mappings.
 */
export const CONTRACT_CIRCUIT_MANIFEST: readonly ContractCircuitDefinition[] = Object.freeze([
  {
    name: 'verifyEligibility',
    circuitName: 'verifyEligibility',
    purpose: 'Verifies that borrower confidential underwriting metric satisfies the public threshold in zero-knowledge',
    callable: true,
    requiresWallet: true,
    requiresProof: true,
    requiresSignature: false,
    requiresSubmission: false,
    action: 'VERIFY_ELIGIBILITY',
    classification: 'LOCAL_PROOF',
    isReadOnly: false,
  },
  {
    name: 'fundLoan',
    circuitName: 'fundLoan',
    purpose: 'Records lender capital commitment and transitions loan agreement to funded state',
    callable: true,
    requiresWallet: true,
    requiresProof: false,
    requiresSignature: true,
    requiresSubmission: true,
    action: 'FUND_LOAN',
    classification: 'TRANSACTION_EXECUTION',
    isReadOnly: false,
  },
  {
    name: 'repayLoan',
    circuitName: 'repayLoan',
    purpose: 'Validates borrower repayment obligation via field division proof and transitions loan to repaid state',
    callable: true,
    requiresWallet: true,
    requiresProof: false,
    requiresSignature: true,
    requiresSubmission: true,
    action: 'REPAY_LOAN',
    classification: 'TRANSACTION_EXECUTION',
    isReadOnly: false,
  },
  {
    name: 'settleLoan',
    circuitName: 'settleLoan',
    purpose: 'Extinguishes obligations in terminal settlement callable by borrower or lender',
    callable: true,
    requiresWallet: true,
    requiresProof: false,
    requiresSignature: true,
    requiresSubmission: true,
    action: 'SETTLE_LOAN',
    classification: 'TRANSACTION_EXECUTION',
    isReadOnly: false,
  },
  {
    name: 'getLoanStatus',
    circuitName: 'getLoanStatus',
    purpose: 'Queries the current on-chain lifecycle status from the ledger state',
    callable: true,
    requiresWallet: false,
    requiresProof: false,
    requiresSignature: false,
    requiresSubmission: false,
    classification: 'STATE_READ',
    isReadOnly: true,
  },
  {
    name: 'getLoanDetails',
    circuitName: 'getLoanDetails',
    purpose: 'Inspects the complete public loan details structure from the ledger state',
    callable: true,
    requiresWallet: false,
    requiresProof: false,
    requiresSignature: false,
    requiresSubmission: false,
    classification: 'STATE_READ',
    isReadOnly: true,
  },
]);

export const CONTRACT_CIRCUIT_DEFINITIONS = CONTRACT_CIRCUIT_MANIFEST;

const CIRCUIT_LOOKUP = new Map<string, ContractCircuitDefinition>(
  CONTRACT_CIRCUIT_MANIFEST.map((c) => [c.name, c])
);

const ACTION_CIRCUIT_LOOKUP = new Map<LifecycleTransactionAction, ContractCircuitDefinition>(
  CONTRACT_CIRCUIT_MANIFEST.filter((c): c is ContractCircuitDefinition & { action: LifecycleTransactionAction } =>
    c.action !== undefined
  ).map((c) => [c.action, c])
);

/**
 * Retrieves circuit definition by canonical name.
 */
export function getCircuitDefinition(name: string): ContractCircuitDefinition | undefined {
  return CIRCUIT_LOOKUP.get(name);
}

/**
 * Retrieves circuit definition mapped 1:1 to a lifecycle transaction action.
 */
export function getCircuitForAction(
  action: LifecycleTransactionAction
): ContractCircuitDefinition | undefined {
  return ACTION_CIRCUIT_LOOKUP.get(action);
}

/**
 * Resolves canonical circuit name for a lifecycle action.
 */
export function resolveCircuitNameForAction(action: LifecycleTransactionAction): string {
  const def = ACTION_CIRCUIT_LOOKUP.get(action);
  if (!def) {
    throw new Error(`Unmapped lifecycle action: ${action}`);
  }
  return def.name;
}

/**
 * Tests if a circuit name belongs to the canonical Compact contract.
 */
export function isKnownCircuit(name: string): boolean {
  return CIRCUIT_LOOKUP.has(name);
}

/**
 * Returns all circuits requiring transaction signing & submission.
 */
export function getOnChainCircuits(): ContractCircuitDefinition[] {
  return CONTRACT_CIRCUIT_MANIFEST.filter((c) => c.requiresSignature && c.requiresSubmission);
}

/**
 * Returns all read-only inspection circuits.
 */
export function getReadInspectionCircuits(): ContractCircuitDefinition[] {
  return CONTRACT_CIRCUIT_MANIFEST.filter(
    (c) => c.classification === 'READ' || c.classification === 'STATE_READ' || c.isReadOnly === true
  );
}

/**
 * Resolves the operational classification of a circuit.
 */
export function getInvocationClassification(
  name: string
): ContractCircuitClassification | undefined {
  return CIRCUIT_LOOKUP.get(name)?.classification;
}
