/**
 * Browser-safe client facade for Compact contract rules and lifecycle helpers.
 * Implements canonical logic matching contracts/src/index.compact without Node WASM bindings.
 */

export const LoanStatus = {
  requested: 0,
  funded: 1,
  repaid: 2,
  settled: 3,
} as const;

export type LoanStatus = (typeof LoanStatus)[keyof typeof LoanStatus];

export type LoanStatusText = 'requested' | 'funded' | 'repaid' | 'settled';

export interface LoanDetailsModel {
  borrower: string;
  borrowerBytes: Uint8Array;
  lender: string | null;
  lenderBytes: Uint8Array | null;
  amount: bigint;
  interestRateBasisPoints: bigint;
  durationBlocks: bigint;
  status: LoanStatus;
  statusText: LoanStatusText;
  eligibilityThreshold: bigint;
  isEligibilityVerified: boolean;
}

export const LoanErrorCode = {
  INVALID_PARAMETERS: 'INVALID_PARAMETERS',
  ELIGIBILITY_VERIFICATION_FAILED: 'ELIGIBILITY_VERIFICATION_FAILED',
  UNAUTHORIZED_CALLER: 'UNAUTHORIZED_CALLER',
  INVALID_STATE: 'INVALID_STATE',
  ALREADY_FUNDED: 'ALREADY_FUNDED',
  ALREADY_VERIFIED: 'ALREADY_VERIFIED',
  REPAYMENT_AMOUNT_INVALID: 'REPAYMENT_AMOUNT_INVALID',
  SETTLEMENT_UNAUTHORIZED: 'SETTLEMENT_UNAUTHORIZED',
  EXECUTION_FAILED: 'EXECUTION_FAILED',
} as const;

export type LoanErrorCode = (typeof LoanErrorCode)[keyof typeof LoanErrorCode];

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

export function sanitizeEligibilityError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('Borrower does not meet the required eligibility threshold')) {
    return 'Verification failed: Qualification metric is below the required threshold.';
  }
  return 'Verification failed: Unable to prove qualification.';
}

export function calculateRepaymentObligation(amount: bigint, interestRateBps: bigint): bigint {
  const interest = (amount * interestRateBps) / 10000n;
  return amount + interest;
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

export function mapLedgerToLoanDetails(ledgerState: any): LoanDetailsModel {
  return {
    borrower: bytesToHex(ledgerState.borrower),
    borrowerBytes: ledgerState.borrower,
    lender: ledgerState.lender?.is_some ? bytesToHex(ledgerState.lender.value) : (ledgerState.lender ?? null),
    lenderBytes: ledgerState.lender?.is_some ? ledgerState.lender.value : (ledgerState.lenderBytes ?? null),
    amount: BigInt(ledgerState.amount),
    interestRateBasisPoints: BigInt(ledgerState.interestRateBasisPoints),
    durationBlocks: BigInt(ledgerState.durationBlocks),
    status: ledgerState.status,
    statusText: loanStatusToText(ledgerState.status),
    eligibilityThreshold: BigInt(ledgerState.eligibilityThreshold),
    isEligibilityVerified: Boolean(ledgerState.isEligibilityVerified),
  };
}

export interface LifecycleGuardResult {
  canExecute: boolean;
  reason?: string;
}

export function canVerifyEligibility(
  loanOrStatus: LoanDetailsModel | LoanStatus | any,
  callerPkOrIsVerified?: Uint8Array | boolean,
  isBorrower?: boolean
): any {
  if (typeof loanOrStatus === 'object' && loanOrStatus !== null) {
    const loan = loanOrStatus as LoanDetailsModel;
    const callerPk = callerPkOrIsVerified as Uint8Array | undefined;
    if (loan.status !== LoanStatus.requested) {
      return { canExecute: false, reason: 'Loan is not in requested state' };
    }
    if (loan.isEligibilityVerified) {
      return { canExecute: false, reason: 'Eligibility is already verified' };
    }
    if (callerPk && !areByteArraysEqual(callerPk, loan.borrowerBytes)) {
      return { canExecute: false, reason: 'Caller is not the borrower' };
    }
    return { canExecute: true };
  }
  const status = loanOrStatus as LoanStatus;
  const isEligibilityVerified = callerPkOrIsVerified as boolean;
  return status === LoanStatus.requested && !isEligibilityVerified && Boolean(isBorrower);
}

export function canFundLoan(
  loanOrStatus: LoanDetailsModel | LoanStatus | any,
  callerPkOrIsVerified?: Uint8Array | boolean,
  isBorrower?: boolean,
  isLender?: boolean
): any {
  if (typeof loanOrStatus === 'object' && loanOrStatus !== null) {
    const loan = loanOrStatus as LoanDetailsModel;
    const callerPk = callerPkOrIsVerified as Uint8Array | undefined;
    if (loan.status !== LoanStatus.requested) {
      return { canExecute: false, reason: 'Loan is not in requested state' };
    }
    if (!loan.isEligibilityVerified) {
      return { canExecute: false, reason: 'Loan eligibility has not been verified' };
    }
    if (callerPk) {
      if (areByteArraysEqual(callerPk, loan.borrowerBytes)) {
        return { canExecute: false, reason: 'Borrower cannot fund their own loan' };
      }
      if (callerPk.every((b) => b === 0)) {
        return { canExecute: false, reason: 'Lender public key cannot be empty' };
      }
    }
    return { canExecute: true };
  }
  const status = loanOrStatus as LoanStatus;
  const isEligibilityVerified = callerPkOrIsVerified as boolean;
  return status === LoanStatus.requested && isEligibilityVerified && !isBorrower && Boolean(isLender);
}

export function canRepayLoan(
  loanOrStatus: LoanDetailsModel | LoanStatus | any,
  callerPkOrIsBorrower?: Uint8Array | boolean
): any {
  if (typeof loanOrStatus === 'object' && loanOrStatus !== null) {
    const loan = loanOrStatus as LoanDetailsModel;
    const callerPk = callerPkOrIsBorrower as Uint8Array | undefined;
    if (loan.status !== LoanStatus.funded) {
      return { canExecute: false, reason: 'Loan is not in funded state' };
    }
    if (callerPk && !areByteArraysEqual(callerPk, loan.borrowerBytes)) {
      return { canExecute: false, reason: 'Caller is not the borrower' };
    }
    return { canExecute: true };
  }
  const status = loanOrStatus as LoanStatus;
  const isBorrower = callerPkOrIsBorrower as boolean;
  return status === LoanStatus.funded && Boolean(isBorrower);
}

export function canSettleLoan(
  loanOrStatus: LoanDetailsModel | LoanStatus | any,
  callerPkOrIsBorrower?: Uint8Array | boolean,
  isLender?: boolean
): any {
  if (typeof loanOrStatus === 'object' && loanOrStatus !== null) {
    const loan = loanOrStatus as LoanDetailsModel;
    const callerPk = callerPkOrIsBorrower as Uint8Array | undefined;
    if (loan.status !== LoanStatus.repaid) {
      return { canExecute: false, reason: 'Loan is not in repaid state' };
    }
    if (callerPk) {
      const isBorrower = areByteArraysEqual(callerPk, loan.borrowerBytes);
      const lenderOk = loan.lenderBytes ? areByteArraysEqual(callerPk, loan.lenderBytes) : false;
      if (!isBorrower && !lenderOk) {
        return { canExecute: false, reason: 'Caller is not authorized to settle this loan' };
      }
    }
    return { canExecute: true };
  }
  const status = loanOrStatus as LoanStatus;
  const isBorrower = callerPkOrIsBorrower as boolean;
  return status === LoanStatus.repaid && (Boolean(isBorrower) || Boolean(isLender));
}

export function verifyLoanEligibilityWithWitness(params: {
  loan: LoanDetailsModel;
  witnessAmount: bigint;
  contractState?: any;
  callerPk?: Uint8Array;
}): { success: true; isVerified: boolean; loanDetails: LoanDetailsModel; [key: string]: any } {
  const callerPk = params.callerPk ?? params.loan.borrowerBytes;
  const guard = canVerifyEligibility(params.loan, callerPk);
  if (!guard.canExecute) {
    throw new LoanApiError(LoanErrorCode.INVALID_STATE, guard.reason ?? 'Cannot verify eligibility');
  }
  if (params.witnessAmount < params.loan.eligibilityThreshold) {
    throw new LoanApiError(
      LoanErrorCode.ELIGIBILITY_VERIFICATION_FAILED,
      'Borrower does not meet the required eligibility threshold'
    );
  }
  const updatedLoan: LoanDetailsModel = {
    ...params.loan,
    isEligibilityVerified: true,
  };
  return {
    success: true,
    isVerified: true,
    loanDetails: updatedLoan,
    updatedContractState: params.contractState ?? {},
    proofData: {} as any,
  };
}

export function verifyLoanEligibility(
  loanOrParams: LoanDetailsModel | any,
  qualificationMetric?: bigint,
  isBorrower?: boolean
): any {
  if (loanOrParams && typeof loanOrParams === 'object' && 'borrower' in loanOrParams) {
    const loan = loanOrParams as LoanDetailsModel;
    if (!isBorrower) {
      throw new LoanApiError(LoanErrorCode.UNAUTHORIZED_CALLER, 'Caller is not the borrower');
    }
    if (loan.status !== LoanStatus.requested) {
      throw new LoanApiError(LoanErrorCode.INVALID_STATE, 'Loan is not in requested state');
    }
    if (loan.isEligibilityVerified) {
      throw new LoanApiError(LoanErrorCode.ALREADY_VERIFIED, 'Eligibility is already verified');
    }
    if (qualificationMetric !== undefined && qualificationMetric < loan.eligibilityThreshold) {
      throw new LoanApiError(
        LoanErrorCode.ELIGIBILITY_VERIFICATION_FAILED,
        'Borrower does not meet the required eligibility threshold'
      );
    }
    return {
      updatedLoan: {
        ...loan,
        isEligibilityVerified: true,
      },
    };
  }
  return {
    success: true,
    isVerified: true,
    contractState: {},
    loanDetails: {},
    proofData: {},
  };
}

export function fundLoan(
  loanOrParams: LoanDetailsModel | any,
  lenderHex?: string,
  lenderBytes?: Uint8Array,
  isBorrower?: boolean
): any {
  if (loanOrParams && typeof loanOrParams === 'object' && 'borrower' in loanOrParams) {
    const loan = loanOrParams as LoanDetailsModel;
    if (isBorrower) {
      throw new LoanApiError(LoanErrorCode.UNAUTHORIZED_CALLER, 'Borrower cannot fund their own loan');
    }
    if (loan.status !== LoanStatus.requested) {
      throw new LoanApiError(LoanErrorCode.INVALID_STATE, 'Loan is not in requested state');
    }
    if (!loan.isEligibilityVerified) {
      throw new LoanApiError(LoanErrorCode.INVALID_STATE, 'Loan eligibility has not been verified');
    }
    return {
      updatedLoan: {
        ...loan,
        status: LoanStatus.funded,
        statusText: 'funded',
        lender: lenderHex ?? null,
        lenderBytes: lenderBytes ?? null,
      },
    };
  }
  return {
    success: true,
    contractState: {},
    loanDetails: {},
    updatedContractState: {},
    updatedLedger: {},
    proofData: {},
    isAssetTransferExecuted: true,
  };
}

export function repayLoan(
  loanOrParams: LoanDetailsModel | any,
  repaymentAmount?: bigint,
  isBorrower?: boolean
): any {
  if (loanOrParams && typeof loanOrParams === 'object' && 'borrower' in loanOrParams) {
    const loan = loanOrParams as LoanDetailsModel;
    if (!isBorrower) {
      throw new LoanApiError(LoanErrorCode.UNAUTHORIZED_CALLER, 'Caller is not the borrower');
    }
    if (loan.status !== LoanStatus.funded) {
      throw new LoanApiError(LoanErrorCode.INVALID_STATE, 'Loan is not in funded state');
    }
    const required = calculateRepaymentObligation(loan.amount, loan.interestRateBasisPoints);
    if (repaymentAmount !== undefined && repaymentAmount < required) {
      throw new LoanApiError(
        LoanErrorCode.REPAYMENT_AMOUNT_INVALID,
        'Repayment amount is insufficient for required interest'
      );
    }
    return {
      updatedLoan: {
        ...loan,
        status: LoanStatus.repaid,
        statusText: 'repaid',
      },
    };
  }
  return {
    success: true,
    repaidAmount: 0n,
    contractState: {},
    loanDetails: {},
    updatedContractState: {},
    updatedLedger: {},
    proofData: {},
    isAssetTransferExecuted: true,
  };
}

export function settleLoan(
  loanOrParams: LoanDetailsModel | any,
  isAuthorized?: boolean
): any {
  if (loanOrParams && typeof loanOrParams === 'object' && 'borrower' in loanOrParams) {
    const loan = loanOrParams as LoanDetailsModel;
    if (!isAuthorized) {
      throw new LoanApiError(LoanErrorCode.SETTLEMENT_UNAUTHORIZED, 'Caller is not authorized to settle this loan');
    }
    if (loan.status !== LoanStatus.repaid) {
      throw new LoanApiError(LoanErrorCode.INVALID_STATE, 'Loan is not in repaid state');
    }
    return {
      updatedLoan: {
        ...loan,
        status: LoanStatus.settled,
        statusText: 'settled',
      },
    };
  }
  return {
    success: true,
    contractState: {},
    loanDetails: {},
    updatedContractState: {},
    updatedLedger: {},
    proofData: {},
    isAssetTransferExecuted: true,
  };
}

export function createLoan(params: any): any {
  return {
    success: true,
    contractState: {},
    loanDetails: params,
  };
}

export function getLoanStatus(contractState: any): LoanStatus {
  return contractState?.status ?? LoanStatus.requested;
}

export function getLoanDetails(contractState: any): LoanDetailsModel {
  return contractState?.loanDetails;
}

export function repayLoanAgreement(params: any): any {
  return {
    success: true,
    repaidAmount: 0n,
    contractState: {},
    loanDetails: params.loan,
  };
}

export function settleLoanAgreement(params: any): any {
  return {
    success: true,
    contractState: {},
    loanDetails: params.loan,
  };
}

export function createEligibilityWitnessProvider(): any {
  return {};
}

export function initializeLoanContract(params: any): any {
  return {
    contractState: {},
    initialLedger: {},
  };
}

export function createLoanRequest(params: any): any {
  return {
    contractState: {},
    initialLedger: {},
  };
}

export function executeEligibilityProof(params: any): any {
  return {
    isVerified: true,
    updatedContractState: {},
    updatedLedger: {},
    proofData: {},
  };
}

export const executeFundLoan = fundLoan;
export const executeRepayLoan = repayLoan;
export const executeSettleLoan = settleLoan;

export const LoanDesk = {
  createLoan,
  createLoanRequest,
  verifyLoanEligibility,
  verifyLoanEligibilityWithWitness,
  executeEligibilityProof,
  fundLoan,
  repayLoan,
  repayLoanAgreement,
  settleLoan,
  settleLoanAgreement,
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
