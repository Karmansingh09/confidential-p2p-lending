import {
  type ContractState,
  type ProofData,
} from '@midnight-ntwrk/compact-runtime';
import {
  ledger,
  type Ledger,
  LoanStatus,
} from '../managed/contract/index.js';
import {
  createLoanRequest,
  executeEligibilityProof,
  fundLoan as executeFundLoan,
  repayLoan as executeRepayLoan,
  settleLoan as executeSettleLoan,
  calculateRepaymentObligation,
  initializeLoanContract,
  type CreateLoanRequestParams,
  type ExecuteEligibilityProofParams,
  type FundLoanParams,
  type RepayLoanParams,
  type SettleLoanParams,
} from './eligibility-client.js';

// -----------------------------------------------------------------------------
// 1. Error Model & Codes
// -----------------------------------------------------------------------------

export enum LoanErrorCode {
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',
  ELIGIBILITY_VERIFICATION_FAILED = 'ELIGIBILITY_VERIFICATION_FAILED',
  UNAUTHORIZED_CALLER = 'UNAUTHORIZED_CALLER',
  INVALID_STATE = 'INVALID_STATE',
  ALREADY_FUNDED = 'ALREADY_FUNDED',
  ALREADY_VERIFIED = 'ALREADY_VERIFIED',
  REPAYMENT_AMOUNT_INVALID = 'REPAYMENT_AMOUNT_INVALID',
  SETTLEMENT_UNAUTHORIZED = 'SETTLEMENT_UNAUTHORIZED',
  EXECUTION_FAILED = 'EXECUTION_FAILED',
}

/**
 * Standardized client API error with structured error codes.
 * Preserves the original contract error for forensic diagnostics.
 */
export class LoanApiError extends Error {
  readonly code: LoanErrorCode;
  readonly originalError?: unknown;

  constructor(code: LoanErrorCode, message: string, originalError?: unknown) {
    super(message);
    this.name = 'LoanApiError';
    this.code = code;
    this.originalError = originalError;
  }
}

/**
 * Maps raw runtime/assertion error messages to typed LoanApiErrors.
 */
export function mapContractErrorToApiError(err: unknown): LoanApiError {
  if (err instanceof LoanApiError) {
    return err;
  }

  const message = err instanceof Error ? err.message : String(err);

  if (message.includes('Borrower does not meet the required eligibility threshold')) {
    return new LoanApiError(LoanErrorCode.ELIGIBILITY_VERIFICATION_FAILED, message, err);
  }
  if (message.includes('Eligibility is already verified')) {
    return new LoanApiError(LoanErrorCode.ALREADY_VERIFIED, message, err);
  }
  if (message.includes('Caller is not authorized to settle this loan')) {
    return new LoanApiError(LoanErrorCode.SETTLEMENT_UNAUTHORIZED, message, err);
  }
  if (
    message.includes('Caller is not the borrower') ||
    message.includes('Caller is not the designated lender') ||
    message.includes('Borrower cannot fund their own loan')
  ) {
    return new LoanApiError(LoanErrorCode.UNAUTHORIZED_CALLER, message, err);
  }
  if (
    message.includes('Loan is not in requested state') ||
    message.includes('Loan is not in funded state') ||
    message.includes('Loan is not in repaid state') ||
    message.includes('Loan eligibility has not been verified')
  ) {
    return new LoanApiError(LoanErrorCode.INVALID_STATE, message, err);
  }
  if (
    message.includes('greater than zero') ||
    message.includes('between 1 and 10000') ||
    message.includes('cannot be empty') ||
    message.includes('must be 32 bytes')
  ) {
    return new LoanApiError(LoanErrorCode.INVALID_PARAMETERS, message, err);
  }
  if (
    message.includes('Repayment amount') ||
    message.includes('insufficient for required interest')
  ) {
    return new LoanApiError(LoanErrorCode.REPAYMENT_AMOUNT_INVALID, message, err);
  }

  return new LoanApiError(LoanErrorCode.EXECUTION_FAILED, message, err);
}

// -----------------------------------------------------------------------------
// 2. Typed Loan Models
// -----------------------------------------------------------------------------

export { LoanStatus };
export type LoanStatusText = 'requested' | 'funded' | 'repaid' | 'settled';

/**
 * Safe, public frontend representation of on-chain loan details.
 * Contains ZERO private witness data or secrets.
 */
export interface LoanDetailsModel {
  /** Hex-encoded borrower public key ("0x...") */
  borrower: string;
  /** Raw 32-byte borrower public key */
  borrowerBytes: Uint8Array;
  /** Hex-encoded lender public key ("0x...") or null if unassigned */
  lender: string | null;
  /** Raw 32-byte lender public key or null */
  lenderBytes: Uint8Array | null;
  /** Principal amount */
  amount: bigint;
  /** Interest rate in basis points (100 bps = 1%) */
  interestRateBasisPoints: bigint;
  /** Loan duration in blocks */
  durationBlocks: bigint;
  /** Compact enum status (0: requested, 1: funded, 2: repaid, 3: settled) */
  status: LoanStatus;
  /** Human-readable status string */
  statusText: LoanStatusText;
  /** Required eligibility threshold */
  eligibilityThreshold: bigint;
  /** Whether borrower proved eligibility via ZK circuit */
  isEligibilityVerified: boolean;
}

export function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (cleanHex.length % 2 !== 0) {
    throw new Error('Invalid hex string length');
  }
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

export function areByteArraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function loanStatusToText(status: LoanStatus): LoanStatusText {
  switch (status) {
    case LoanStatus.requested:
      return 'requested';
    case LoanStatus.funded:
      return 'funded';
    case LoanStatus.repaid:
      return 'repaid';
    case LoanStatus.settled:
      return 'settled';
    default:
      throw new Error(`Unknown loan status: ${status}`);
  }
}

/**
 * Maps raw ledger state into a frontend-safe LoanDetailsModel.
 */
export function mapLedgerToLoanDetails(ledgerState: Ledger): LoanDetailsModel {
  return {
    borrower: bytesToHex(ledgerState.borrower),
    borrowerBytes: ledgerState.borrower,
    lender: ledgerState.lender.is_some ? bytesToHex(ledgerState.lender.value) : null,
    lenderBytes: ledgerState.lender.is_some ? ledgerState.lender.value : null,
    amount: ledgerState.amount,
    interestRateBasisPoints: ledgerState.interestRateBasisPoints,
    durationBlocks: ledgerState.durationBlocks,
    status: ledgerState.status,
    statusText: loanStatusToText(ledgerState.status),
    eligibilityThreshold: ledgerState.eligibilityThreshold,
    isEligibilityVerified: ledgerState.isEligibilityVerified,
  };
}

// -----------------------------------------------------------------------------
// 3. Operation Results
// -----------------------------------------------------------------------------

export interface CreateLoanResult {
  success: true;
  contractState: ContractState;
  loanDetails: LoanDetailsModel;
}

export interface VerifyLoanEligibilityResult {
  success: true;
  isVerified: boolean;
  contractState: ContractState;
  loanDetails: LoanDetailsModel;
  proofData: ProofData;
}

export interface FundLoanResult {
  success: true;
  contractState: ContractState;
  loanDetails: LoanDetailsModel;
  updatedContractState: ContractState;
  updatedLedger: Ledger;
  proofData: ProofData;
  isAssetTransferExecuted: boolean;
}

export interface RepayLoanResult {
  success: true;
  repaidAmount: bigint;
  contractState: ContractState;
  loanDetails: LoanDetailsModel;
  updatedContractState: ContractState;
  updatedLedger: Ledger;
  proofData: ProofData;
  isAssetTransferExecuted: boolean;
}

export interface SettleLoanResult {
  success: true;
  contractState: ContractState;
  loanDetails: LoanDetailsModel;
  updatedContractState: ContractState;
  updatedLedger: Ledger;
  proofData: ProofData;
  isAssetTransferExecuted: boolean;
}

// -----------------------------------------------------------------------------
// 4. Client-Side Lifecycle UX Helpers
// -----------------------------------------------------------------------------

/**
 * Result of client-side lifecycle validation helpers.
 * NOTE: These checks are defensive UX helpers for UI buttons/tooltips.
 * They are NOT security boundaries; Compact contract assertions remain authoritative.
 */
export interface LifecycleGuardResult {
  canExecute: boolean;
  reason?: string;
}

function resolveDetails(loan: LoanDetailsModel | ContractState): LoanDetailsModel {
  if ('status' in loan && 'borrowerBytes' in loan) {
    return loan as LoanDetailsModel;
  }
  return mapLedgerToLoanDetails(ledger((loan as ContractState).data));
}

export function canVerifyEligibility(
  loan: LoanDetailsModel | ContractState,
  callerPk?: Uint8Array
): LifecycleGuardResult {
  const details = resolveDetails(loan);
  if (details.status !== LoanStatus.requested) {
    return { canExecute: false, reason: 'Loan is not in requested state' };
  }
  if (details.isEligibilityVerified) {
    return { canExecute: false, reason: 'Eligibility is already verified' };
  }
  if (callerPk && !areByteArraysEqual(callerPk, details.borrowerBytes)) {
    return { canExecute: false, reason: 'Caller is not the borrower' };
  }
  return { canExecute: true };
}

export function canFundLoan(
  loan: LoanDetailsModel | ContractState,
  callerPk?: Uint8Array
): LifecycleGuardResult {
  const details = resolveDetails(loan);
  if (details.status !== LoanStatus.requested) {
    return { canExecute: false, reason: 'Loan is not in requested state' };
  }
  if (!details.isEligibilityVerified) {
    return { canExecute: false, reason: 'Loan eligibility has not been verified' };
  }
  if (callerPk) {
    if (areByteArraysEqual(callerPk, details.borrowerBytes)) {
      return { canExecute: false, reason: 'Borrower cannot fund their own loan' };
    }
    if (callerPk.every((b) => b === 0)) {
      return { canExecute: false, reason: 'Lender public key cannot be empty' };
    }
  }
  return { canExecute: true };
}

export function canRepayLoan(
  loan: LoanDetailsModel | ContractState,
  callerPk?: Uint8Array
): LifecycleGuardResult {
  const details = resolveDetails(loan);
  if (details.status !== LoanStatus.funded) {
    return { canExecute: false, reason: 'Loan is not in funded state' };
  }
  if (callerPk && !areByteArraysEqual(callerPk, details.borrowerBytes)) {
    return { canExecute: false, reason: 'Caller is not the borrower' };
  }
  return { canExecute: true };
}

export function canSettleLoan(
  loan: LoanDetailsModel | ContractState,
  callerPk?: Uint8Array
): LifecycleGuardResult {
  const details = resolveDetails(loan);
  if (details.status !== LoanStatus.repaid) {
    return { canExecute: false, reason: 'Loan is not in repaid state' };
  }
  if (callerPk) {
    const isBorrower = areByteArraysEqual(callerPk, details.borrowerBytes);
    const isLender = details.lenderBytes ? areByteArraysEqual(callerPk, details.lenderBytes) : false;
    if (!isBorrower && !isLender) {
      return { canExecute: false, reason: 'Caller is not authorized to settle this loan' };
    }
  }
  return { canExecute: true };
}

// -----------------------------------------------------------------------------
// 5. Canonical Lifecycle API Methods
// -----------------------------------------------------------------------------

/**
 * Creates and initializes a new loan request on the Compact contract runtime.
 */
export function createLoan(params: CreateLoanRequestParams): CreateLoanResult {
  try {
    const initResult = createLoanRequest(params);
    const loanDetails = mapLedgerToLoanDetails(initResult.initialLedger);
    return {
      success: true,
      contractState: initResult.contractState,
      loanDetails,
    };
  } catch (err) {
    throw mapContractErrorToApiError(err);
  }
}

/**
 * Proves confidential eligibility for a requested loan in zero knowledge.
 */
export function verifyLoanEligibility(
  params: ExecuteEligibilityProofParams
): VerifyLoanEligibilityResult {
  try {
    const proofResult = executeEligibilityProof(params);
    const loanDetails = mapLedgerToLoanDetails(proofResult.updatedLedger);
    return {
      success: true,
      isVerified: proofResult.isVerified,
      contractState: proofResult.updatedContractState,
      loanDetails,
      proofData: proofResult.proofData,
    };
  } catch (err) {
    throw mapContractErrorToApiError(err);
  }
}

/**
 * Funds an eligible loan request, transitioning it to funded status.
 */
export function fundLoan(params: FundLoanParams): FundLoanResult {
  try {
    const result = executeFundLoan(params);
    const loanDetails = mapLedgerToLoanDetails(result.updatedLedger);
    return {
      success: true,
      contractState: result.updatedContractState,
      loanDetails,
      ...result,
    };
  } catch (err) {
    throw mapContractErrorToApiError(err);
  }
}

/**
 * Repays a funded loan with verified principal + simple interest.
 */
export function repayLoan(params: RepayLoanParams): RepayLoanResult {
  try {
    const result = executeRepayLoan(params);
    const loanDetails = mapLedgerToLoanDetails(result.updatedLedger);
    return {
      success: true,
      contractState: result.updatedContractState,
      loanDetails,
      ...result,
    };
  } catch (err) {
    throw mapContractErrorToApiError(err);
  }
}

/**
 * Settles a repaid loan, reaching terminal closure.
 */
export function settleLoan(params: SettleLoanParams): SettleLoanResult {
  try {
    const result = executeSettleLoan(params);
    const loanDetails = mapLedgerToLoanDetails(result.updatedLedger);
    return {
      success: true,
      contractState: result.updatedContractState,
      loanDetails,
      ...result,
    };
  } catch (err) {
    throw mapContractErrorToApiError(err);
  }
}

/**
 * Inspects current loan status from contract state.
 */
export function getLoanStatus(contractState: ContractState): LoanStatus {
  try {
    const currentLedger = ledger(contractState.data);
    return currentLedger.status;
  } catch (err) {
    throw mapContractErrorToApiError(err);
  }
}

/**
 * Inspects full public loan details from contract state.
 */
export function getLoanDetails(contractState: ContractState): LoanDetailsModel {
  try {
    const currentLedger = ledger(contractState.data);
    return mapLedgerToLoanDetails(currentLedger);
  } catch (err) {
    throw mapContractErrorToApiError(err);
  }
}

/**
 * Parameters for executing zero-knowledge eligibility verification with an off-chain witness.
 */
export interface VerifyEligibilityWithWitnessParams {
  loan: LoanDetailsModel;
  witnessAmount: bigint;
  contractState?: ContractState;
  callerPk?: Uint8Array;
}

/**
 * Executes zero-knowledge eligibility verification using an off-chain witness amount.
 * Binds the loan terms to the Compact eligibility circuit and executes the proof.
 */
export function verifyLoanEligibilityWithWitness(
  params: VerifyEligibilityWithWitnessParams
): VerifyLoanEligibilityResult {
  const callerPk = params.callerPk ?? params.loan.borrowerBytes;

  const guard = canVerifyEligibility(params.loan, callerPk);
  if (!guard.canExecute) {
    throw new LoanApiError(LoanErrorCode.INVALID_STATE, guard.reason ?? 'Cannot verify eligibility');
  }

  let activeState = params.contractState;
  if (!activeState) {
    const init = initializeLoanContract({
      borrowerPk: params.loan.borrowerBytes,
      principalAmount: params.loan.amount,
      interestRateBasisPoints: params.loan.interestRateBasisPoints,
      durationBlocks: params.loan.durationBlocks,
      eligibilityThreshold: params.loan.eligibilityThreshold,
    });
    activeState = init.contractState;
  }

  return verifyLoanEligibility({
    contractState: activeState,
    borrowerPk: callerPk,
    privateFinancialValue: params.witnessAmount,
  });
}

// -----------------------------------------------------------------------------
// 6. Unified LoanDesk Facade
// -----------------------------------------------------------------------------

export const LoanDesk = {
  createLoan,
  createLoanRequest,
  verifyLoanEligibility,
  verifyLoanEligibilityWithWitness,
  executeEligibilityProof,
  fundLoan,
  repayLoan,
  settleLoan,
  getLoanStatus,
  getLoanDetails,
  calculateRepaymentObligation,
  canVerifyEligibility,
  canFundLoan,
  canRepayLoan,
  canSettleLoan,
  mapLedgerToLoanDetails,
  bytesToHex,
  hexToBytes,
  loanStatusToText,
};
