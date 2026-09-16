import type { LoanDetailsModel } from './index.ts';
import type { LifecycleTransactionAction } from './transaction-orchestration.ts';
import type { ContractCircuitClassification } from './contract-deployment.ts';
import type { TransactionReceipt } from './transaction-execution.ts';
import type { ProviderCapabilities } from './network.ts';

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
  | 'BLOCKED'
  | 'PREPARING'
  | 'PREPARED'
  | 'READY'
  | 'READY_FOR_SIGNATURE'
  | 'SUBMITTED'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'FAILED'
  | 'UNSUPPORTED'
  | 'DISPATCHED';

/**
 * Strongly typed error codes for contract circuit invocation.
 */
export type ContractInvocationErrorCode =
  | 'CONTRACT_NOT_VERIFIED'
  | 'CONTRACT_NOT_DEPLOYED'
  | 'CONTRACT_NOT_CONFIGURED'
  | 'CONTRACT_NETWORK_MISMATCH'
  | 'CIRCUIT_NOT_FOUND'
  | 'CIRCUIT_NOT_IN_MANIFEST'
  | 'CIRCUIT_UNAVAILABLE'
  | 'INVALID_ARGUMENTS'
  | 'INVALID_PARAMS'
  | 'CALLER_NOT_AUTHORIZED'
  | 'WALLET_NOT_CONNECTED'
  | 'WALLET_DISCONNECTED'
  | 'WALLET_IDENTITY_UNAVAILABLE'
  | 'SIGNING_UNAVAILABLE'
  | 'SUBMISSION_UNAVAILABLE'
  | 'NETWORK_MISMATCH'
  | 'PROVIDER_UNSUPPORTED'
  | 'UNSUPPORTED_OPERATION'
  | 'PROVIDER_ERROR'
  | 'CONTRACT_STATE_INVALID'
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

// -----------------------------------------------------------------------------
// Explicit Circuit Argument Schemas (All 6 Canonical Compact Circuits)
// -----------------------------------------------------------------------------

/**
 * Arguments schema for 'verifyEligibility' circuit (LOCAL_PROOF).
 * Operates purely on public agreement ID and caller public key.
 * Confidential qualification data remains off-chain in local memory.
 */
export interface VerifyEligibilityArguments {
  circuitName: 'verifyEligibility';
  loanId: string;
  borrowerPublicKey: Uint8Array;
  borrowerPublicKeyHex?: string;
  qualificationProofValue?: bigint;
  contractAddress?: string;
}

/**
 * Arguments schema for 'fundLoan' circuit (TRANSACTION_EXECUTION).
 */
export interface FundLoanArguments {
  circuitName: 'fundLoan';
  loanId: string;
  lenderPublicKey: Uint8Array;
  lenderPublicKeyHex?: string;
  callerPublicKey: Uint8Array;
  callerPublicKeyHex?: string;
  contractAddress?: string;
}

/**
 * Arguments schema for 'repayLoan' circuit (TRANSACTION_EXECUTION).
 */
export interface RepayLoanArguments {
  circuitName: 'repayLoan';
  loanId: string;
  callerPublicKey: Uint8Array;
  callerPublicKeyHex?: string;
  borrowerPublicKey?: Uint8Array;
  borrowerPublicKeyHex?: string;
  repaymentAmount?: bigint;
  contractAddress?: string;
}

/**
 * Arguments schema for 'settleLoan' circuit (TRANSACTION_EXECUTION).
 */
export interface SettleLoanArguments {
  circuitName: 'settleLoan';
  loanId: string;
  callerPublicKey: Uint8Array;
  callerPublicKeyHex?: string;
  contractAddress?: string;
}

/**
 * Arguments schema for 'getLoanStatus' circuit (STATE_READ).
 */
export interface GetLoanStatusArguments {
  circuitName: 'getLoanStatus';
  loanId: string;
  contractAddress?: string;
}

/**
 * Arguments schema for 'getLoanDetails' circuit (STATE_READ).
 */
export interface GetLoanDetailsArguments {
  circuitName: 'getLoanDetails';
  loanId: string;
  contractAddress?: string;
}

/**
 * Discriminated union of all canonical circuit arguments.
 */
export type ContractInvocationArguments =
  | VerifyEligibilityArguments
  | FundLoanArguments
  | RepayLoanArguments
  | SettleLoanArguments
  | GetLoanStatusArguments
  | GetLoanDetailsArguments;

/**
 * Technical execution context capturing the environment and capabilities
 * under which a circuit invocation is prepared or executed.
 */
export interface ContractInvocationContext {
  callerPublicKey: Uint8Array | null;
  callerPublicKeyHex: string | null;
  activeNetworkId: string | null;
  targetNetworkId: string | null;
  contractAddress: string | null;
  isContractVerified: boolean;
  isWalletConnected: boolean;
  walletReportedNetworkId: string | null;
  providerId?: string;
  providerCapabilities?: ProviderCapabilities;
  timestamp?: number;
}

/**
 * Standardized request to prepare or invoke a Midnight Compact contract circuit.
 * Contains only public parameters and public identity keys; zero private metrics.
 */
export interface ContractInvocationRequest<TArgs = ContractInvocationArguments | Record<string, unknown>> {
  circuitName: string;
  action?: LifecycleTransactionAction;
  loanId?: string;
  loan?: LoanDetailsModel;
  callerPublicKey?: Uint8Array | null;
  callerPublicKeyHex?: string | null;
  arguments?: TArgs;
  parameters?: Record<string, unknown>;
  context?: Partial<ContractInvocationContext>;
  createdAt?: number;
}

/**
 * Technical preparation descriptor capturing circuit classification, operational
 * requirements, deployment verification status, network status, provider capabilities,
 * and validated arguments.
 */
export interface ContractInvocationPreparation {
  preparationId?: string;
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
  validatedArguments?: ContractInvocationArguments | null;
  context?: ContractInvocationContext;
  errorCode?: ContractInvocationErrorCode;
  message: string;
  blockingReason?: string;
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
  preparation?: ContractInvocationPreparation;
}
