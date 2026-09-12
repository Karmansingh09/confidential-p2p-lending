import {
  LoanStatus,
  type LoanDetailsModel,
} from '../types/index.js';
import type {
  FundingReadiness,
  EvaluationWarning,
  LenderLoanEvaluation,
  FundingExecutionResult,
} from '../types/lender.js';
import {
  canFundLoan,
  calculateRepaymentObligation,
  areByteArraysEqual,
  hexToBytes,
  bytesToHex,
} from 'contracts';

/** Default mock lender public key for prototype funding demonstrations */
export const DEFAULT_LENDER_PK_BYTES = new Uint8Array(32).fill(10);
export const DEFAULT_LENDER_PK_HEX = bytesToHex(DEFAULT_LENDER_PK_BYTES);

/** Alternative mock lender public key */
export const ALTERNATIVE_LENDER_PK_BYTES = new Uint8Array(32).fill(20);
export const ALTERNATIVE_LENDER_PK_HEX = bytesToHex(ALTERNATIVE_LENDER_PK_BYTES);

/**
 * Calculates interest return using exact BigInt arithmetic.
 * Formula: floor(Principal * RateBasisPoints / 10000)
 */
export function calculateInterestEarnings(
  principal: bigint,
  rateBasisPoints: bigint
): bigint {
  return (principal * rateBasisPoints) / 10000n;
}

/**
 * Calculates total expected return (principal + simple interest)
 * using the canonical contract calculation.
 */
export function calculateExpectedReturn(
  principal: bigint,
  rateBasisPoints: bigint
): bigint {
  return calculateRepaymentObligation(principal, rateBasisPoints);
}

/**
 * Helper to normalize lender key input to Uint8Array and hex string.
 */
export function normalizeLenderKey(
  key?: Uint8Array | string
): { bytes: Uint8Array; hex: string } {
  if (!key) {
    return { bytes: DEFAULT_LENDER_PK_BYTES, hex: DEFAULT_LENDER_PK_HEX };
  }
  if (typeof key === 'string') {
    const bytes = hexToBytes(key);
    return { bytes, hex: key.startsWith('0x') ? key : `0x${key}` };
  }
  return { bytes: key, hex: bytesToHex(key) };
}

/**
 * Evaluates funding readiness by connecting to canonical contract guards.
 *
 * Rules:
 * A. Eligible for funding:
 *    - status === requested
 *    - isEligibilityVerified === true
 *    - lender is not already assigned
 *    - lender is not the borrower
 * B. Not fundable:
 *    - status !== requested
 *    - !isEligibilityVerified
 *    - lender already assigned
 *    - selected lender is the borrower
 */
export function getFundingReadiness(
  loan: LoanDetailsModel,
  lenderKeyInput?: Uint8Array | string
): FundingReadiness {
  // 1. Check terminal or inactive lifecycle states
  if (loan.status === LoanStatus.settled) {
    return {
      status: 'AGREEMENT_CONCLUDED',
      canFund: false,
      title: 'Agreement Concluded',
      description: 'This agreement has concluded and reached its immutable terminal state.',
      badgeType: 'info',
    };
  }

  if (loan.status === LoanStatus.repaid) {
    return {
      status: 'LOAN_NOT_AVAILABLE',
      canFund: false,
      title: 'Loan Already Repaid',
      description: 'Borrower has already satisfied debt obligations. Awaiting settlement.',
      badgeType: 'info',
    };
  }

  if (loan.status === LoanStatus.funded || loan.lender !== null) {
    return {
      status: 'LOAN_ALREADY_FUNDED',
      canFund: false,
      title: 'Loan Already Funded',
      description: 'Capital has already been committed by a lender to this agreement.',
      badgeType: 'warning',
    };
  }

  // 2. Check requested state verification
  if (!loan.isEligibilityVerified) {
    return {
      status: 'ELIGIBILITY_NOT_VERIFIED',
      canFund: false,
      title: 'Eligibility Not Verified',
      description: 'Borrower qualification has not been verified via Zero-Knowledge proof yet.',
      badgeType: 'warning',
    };
  }

  // 3. Check borrower vs lender identity
  if (lenderKeyInput) {
    const { bytes: lenderBytes } = normalizeLenderKey(lenderKeyInput);
    if (areByteArraysEqual(lenderBytes, loan.borrowerBytes)) {
      return {
        status: 'BORROWER_CANNOT_FUND_OWN_LOAN',
        canFund: false,
        title: 'Borrower Cannot Fund Own Loan',
        description: 'Protocol rules prohibit borrowers from committing capital to their own loan requests.',
        badgeType: 'error',
      };
    }

    // Connect directly to canonical contract guard
    const guard = canFundLoan(loan, lenderBytes);
    if (!guard.canExecute) {
      return {
        status: 'LOAN_NOT_AVAILABLE',
        canFund: false,
        title: 'Funding Invariant Check Failed',
        description: guard.reason ?? 'Contract assertions prevent funding at this stage.',
        badgeType: 'error',
      };
    }
  }

  // 4. All criteria satisfied
  return {
    status: 'READY_TO_FUND',
    canFund: true,
    title: 'Ready to Fund',
    description: 'Loan request terms are valid and borrower qualification is verified in zero knowledge.',
    badgeType: 'success',
  };
}

/**
 * Computes descriptive evaluation warnings and notices for lender review.
 */
export function getEvaluationWarnings(
  loan: LoanDetailsModel,
  lenderKeyInput?: Uint8Array | string
): EvaluationWarning[] {
  const warnings: EvaluationWarning[] = [];

  if (!loan.isEligibilityVerified) {
    warnings.push({
      code: 'VERIFICATION_PENDING',
      message: 'Borrower proof submission is pending. Funding is locked until verified.',
      severity: 'warning',
    });
  }

  if (loan.durationBlocks > 300n) {
    warnings.push({
      code: 'LONG_DURATION',
      message: 'Long-term commitment: Duration exceeds 300 consensus blocks.',
      severity: 'info',
    });
  }

  if (loan.interestRateBasisPoints >= 800n) {
    warnings.push({
      code: 'HIGH_YIELD',
      message: 'High-yield agreement: Proposed rate is 8.00% APR or higher.',
      severity: 'info',
    });
  }

  if (lenderKeyInput) {
    const { bytes: lenderBytes } = normalizeLenderKey(lenderKeyInput);
    if (areByteArraysEqual(lenderBytes, loan.borrowerBytes)) {
      warnings.push({
        code: 'SELF_FUNDING_BLOCK',
        message: 'Self-funding violation: Caller identity matches borrower public key.',
        severity: 'critical',
      });
    }
  }

  return warnings;
}

/**
 * Builds a comprehensive lender evaluation using ONLY public LoanDetailsModel data.
 * STRICT PRIVACY INVARIANT: Never requests or surfaces confidential borrower data.
 */
export function evaluateLoanForLender(
  loanId: string,
  loan: LoanDetailsModel,
  lenderKeyInput?: Uint8Array | string
): LenderLoanEvaluation {
  const expectedInterest = calculateInterestEarnings(loan.amount, loan.interestRateBasisPoints);
  const expectedTotalReturn = calculateExpectedReturn(loan.amount, loan.interestRateBasisPoints);
  const readiness = getFundingReadiness(loan, lenderKeyInput);
  const warnings = getEvaluationWarnings(loan, lenderKeyInput);

  return {
    loanId,
    terms: {
      loanId,
      borrower: loan.borrower,
      lender: loan.lender,
      amount: loan.amount,
      interestRateBasisPoints: loan.interestRateBasisPoints,
      durationBlocks: loan.durationBlocks,
      eligibilityThreshold: loan.eligibilityThreshold,
      isEligibilityVerified: loan.isEligibilityVerified,
      status: loan.status,
      statusText: loan.statusText,
      totalRepaymentObligation: expectedTotalReturn,
      expectedInterest,
    },
    readiness,
    warnings,
    expectedInterest,
    expectedTotalReturn,
    privacyAttestation: {
      isVerifiedWithoutPrivateDisclosure: loan.isEligibilityVerified,
      statement:
        'Borrower eligibility has been verified without revealing the borrower\'s underlying financial data.',
      notice: 'Private financial information is not exposed to lenders.',
    },
  };
}

/**
 * Executes local lender funding simulation.
 *
 * NOTE: Operates in Local Prototype Mode.
 * This simulates the protocol state transition honestly without claiming
 * on-chain token movement or blockchain transactions.
 */
export function executeLocalFunding(
  loanId: string,
  loan: LoanDetailsModel,
  lenderKeyInput?: Uint8Array | string
): { updatedLoan: LoanDetailsModel; result: FundingExecutionResult } {
  const { bytes: lenderBytes, hex: lenderHex } = normalizeLenderKey(lenderKeyInput);
  const readiness = getFundingReadiness(loan, lenderBytes);

  if (!readiness.canFund) {
    throw new Error(`Cannot fund loan ${loanId}: ${readiness.description}`);
  }

  const expectedInterest = calculateInterestEarnings(loan.amount, loan.interestRateBasisPoints);
  const expectedRepayment = calculateExpectedReturn(loan.amount, loan.interestRateBasisPoints);

  const updatedLoan: LoanDetailsModel = {
    ...loan,
    lender: lenderHex,
    lenderBytes,
    status: LoanStatus.funded,
    statusText: 'funded',
  };

  const result: FundingExecutionResult = {
    success: true,
    loanId,
    previousStatus: 'REQUESTED',
    newStatus: 'FUNDED',
    lender: lenderHex,
    amount: loan.amount,
    expectedRepayment,
    expectedInterest,
    assetTransferStatus: 'Not executed — local prototype mode',
    disclaimer:
      'Prototype mode: simulated local state transition. No real cryptocurrency tokens or Midnight native assets were transferred on-chain.',
    timestamp: Date.now(),
  };

  return { updatedLoan, result };
}
