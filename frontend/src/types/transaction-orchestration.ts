import type { ProviderCapability } from './network.ts';
import type { TransactionReadinessReason } from './network-config.ts';

/**
 * Standard protocol lifecycle actions that can be orchestrated.
 */
export type LifecycleTransactionAction =
  | 'VERIFY_ELIGIBILITY'
  | 'FUND_LOAN'
  | 'REPAY_LOAN'
  | 'SETTLE_LOAN';

/**
 * Readiness status of a prepared lifecycle transaction before execution.
 */
export type TransactionPreparationStatus =
  | 'READY'
  | 'BLOCKED'
  | 'UNSUPPORTED'
  | 'INVALID';

import type { TransactionExecutionStatus } from './transaction-execution.ts';
export type { TransactionExecutionStatus };

/**
 * Structured preparation descriptor produced before attempting lifecycle transaction dispatch.
 * STRICT PRIVACY REQUIREMENT:
 * Contains only public agreement IDs, participant public keys, and contract circuit metadata.
 * No private witnesses or confidential underwriting credentials are ever accepted or stored.
 */
export interface TransactionPreparation {
  loanId: string;
  action: LifecycleTransactionAction;
  circuitName: string;
  status: TransactionPreparationStatus;
  readinessReason?: TransactionReadinessReason;
  callerPublicKey: Uint8Array | null;
  callerPublicKeyHex: string | null;
  isAuthorized: boolean;
  authorizationReason?: string;
  requiredCapabilities: ProviderCapability[];
  missingCapabilities: ProviderCapability[];
  isExecutionSupported: boolean;
  estimatedFee?: string | null;
}

/**
 * Active or historical transaction execution tracking record.
 */
export interface TransactionExecution {
  preparation: TransactionPreparation;
  status: TransactionExecutionStatus;
  startedAt: number;
  completedAt?: number;
  error?: string;
}

/**
 * Standardized outcome returned by the transaction orchestration engine.
 * In prototype mode, funding, repayment, and settlement return typed UNSUPPORTED results.
 * Zero fake transaction hashes or block heights are ever fabricated.
 */
export interface TransactionOrchestrationResult {
  success: boolean;
  status: TransactionExecutionStatus;
  action: LifecycleTransactionAction;
  loanId: string;
  circuitName: string;
  message: string;
  unsupportedReason?: string;
  transactionId?: string;
  blockHeight?: bigint;
}

/**
 * Standard error codes for transaction orchestration failures.
 */
export type TransactionOrchestrationErrorCode =
  | 'UNAUTHORIZED'
  | 'UNSUPPORTED_CAPABILITY'
  | 'INVALID_LOAN'
  | 'PROVIDER_ERROR'
  | 'EXECUTION_REJECTED'
  | 'CIRCUIT_GUARD_FAILED';

/**
 * Typed domain error representing an orchestration-level validation or dispatch failure.
 */
export class TransactionOrchestrationError extends Error {
  readonly code: TransactionOrchestrationErrorCode;

  constructor(code: TransactionOrchestrationErrorCode, message: string) {
    super(message);
    this.name = 'TransactionOrchestrationError';
    this.code = code;
    Object.setPrototypeOf(this, TransactionOrchestrationError.prototype);
  }
}
