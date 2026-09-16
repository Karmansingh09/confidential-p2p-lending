import type { LoanDetailsModel } from './index.ts';
import type { LifecycleTransactionAction } from './transaction-orchestration.ts';
import type { ContractCircuitClassification } from './contract-deployment.ts';
import type { TransactionReceipt } from './transaction-execution.ts';

/**
 * Validated lifecycle state of a contract circuit invocation.
 *
 * ANTI-FABRICATION INVARIANT:
 * ContractInvocationStatus distinguishes local preparation and submission dispatch
 * from provider-verified ledger finality. There is strictly NO synthetic 'CONFIRMED'
 * in the invocation layer; final confirmation and LoanRegistry mutation belong exclusively
 * to the provider status verification and reconciliation pipeline.
 */
export type ContractInvocationStatus =
  | 'DRAFT'
  | 'VALIDATING'
  | 'PREPARED'
  | 'READY'
  | 'BLOCKED'
  | 'UNSUPPORTED'
  | 'FAILED'
  | 'DISPATCHED';

/**
 * Strongly typed error codes for contract circuit invocation.
 */
export type ContractInvocationErrorCode =
  | 'CIRCUIT_UNAVAILABLE'
  | 'CONTRACT_NOT_CONFIGURED'
  | 'CONTRACT_NOT_VERIFIED'
  | 'CONTRACT_NOT_DEPLOYED'
  | 'NETWORK_MISMATCH'
  | 'WALLET_DISCONNECTED'
  | 'WALLET_IDENTITY_UNAVAILABLE'
  | 'SIGNING_UNAVAILABLE'
  | 'SUBMISSION_UNAVAILABLE'
  | 'UNSUPPORTED_OPERATION'
  | 'INVALID_PARAMS'
  | 'EXECUTION_FAILED';

/**
 * Domain error class for contract invocation failures.
 */
export class ContractInvocationError extends Error {
  readonly code: ContractInvocationErrorCode;
  readonly details?: unknown;

  constructor(code: ContractInvocationErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ContractInvocationError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ContractInvocationError.prototype);
  }
}

/**
 * Standardized request to prepare or invoke a Midnight Compact contract circuit.
 * Contains only public parameters and public identity keys; zero private metrics.
 */
export interface ContractInvocationRequest {
  circuitName: string;
  action?: LifecycleTransactionAction;
  loanId?: string;
  loan?: LoanDetailsModel;
  callerPublicKey?: Uint8Array | null;
  callerPublicKeyHex?: string | null;
  parameters?: Record<string, unknown>;
  createdAt?: number;
}

/**
 * Technical preparation descriptor capturing circuit classification, operational
 * requirements, deployment verification status, network status, and provider capabilities.
 */
export interface ContractInvocationPreparation {
  isReady: boolean;
  status: ContractInvocationStatus;
  circuitName: string;
  action?: LifecycleTransactionAction;
  classification: ContractCircuitClassification;
  requiresWallet: boolean;
  requiresProof: boolean;
  requiresSignature: boolean;
  requiresSubmission: boolean;
  isReadOnly: boolean;
  contractAddress: string | null;
  networkId: string | null;
  isContractConfigured: boolean;
  isContractVerified: boolean;
  isNetworkMatched: boolean;
  isWalletConnected: boolean;
  hasSigningCapability: boolean;
  hasSubmissionCapability: boolean;
  callerPublicKey?: Uint8Array | null;
  callerPublicKeyHex?: string | null;
  errorCode?: ContractInvocationErrorCode;
  message: string;
}

/**
 * Structured outcome of an invoked circuit execution.
 */
export interface ContractInvocationResult<T = unknown> {
  success: boolean;
  status: ContractInvocationStatus;
  circuitName: string;
  action?: LifecycleTransactionAction;
  loanId?: string;
  data?: T;
  transactionId?: string | null;
  blockHeight?: bigint | null;
  receipt?: TransactionReceipt;
  error?: string;
  errorCode?: ContractInvocationErrorCode;
  message: string;
}
