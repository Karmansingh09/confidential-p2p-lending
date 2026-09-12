import { LoanStatus, type LoanDetailsModel } from '../types/index.js';
import type { ValidatedLoanRequestData } from './validation.js';

// Default mock borrower identity for local simulation
const defaultBorrowerPk = new Uint8Array(32).fill(7);

function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Prepares and instantiates a local mock loan request model adhering strictly
 * to the Compact contract ledger state specification.
 *
 * NOTE: Operates in Local Simulation Mode. Zero private data is included.
 */
export function createLocalLoanRequest(
  data: ValidatedLoanRequestData,
  borrowerPk: Uint8Array = defaultBorrowerPk
): LoanDetailsModel {
  return {
    borrower: bytesToHex(borrowerPk),
    borrowerBytes: borrowerPk,
    lender: null,
    lenderBytes: null,
    amount: data.principalAmount,
    interestRateBasisPoints: data.interestRateBasisPoints,
    durationBlocks: data.durationBlocks,
    status: LoanStatus.requested,
    statusText: 'requested',
    eligibilityThreshold: data.eligibilityThreshold,
    isEligibilityVerified: false,
  };
}
