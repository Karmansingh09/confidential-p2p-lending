import {
  canRepayLoan,
  calculateRepaymentObligation,
  areByteArraysEqual,
  LoanStatus,
  type LoanDetailsModel,
} from 'contracts';
import type {
  RepaymentReadiness,
  RepaymentCalculation,
  RepaymentRequest,
  RepaymentResult,
  RepaymentPrivacyAttestation,
} from '../types/repayment.ts';

/**
 * Calculates repayment breakdown and total obligation using canonical contract arithmetic.
 * STRICT ARITHMETIC INVARIANT: Exact BigInt integer operations only.
 */
export function calculateRepaymentPreview(loan: LoanDetailsModel): RepaymentCalculation {
  const principal = loan.amount;
  const rateBps = BigInt(loan.interestRateBasisPoints);

  // Exact interest calculation using basis points (10000 bps = 100.00%)
  const interestAmount = (principal * rateBps) / 10000n;

  // Canonical contract calculation guarantees identical field arithmetic
  const totalObligation = calculateRepaymentObligation(principal, rateBps);

  return {
    principal,
    interestRateBasisPoints: rateBps,
    interestAmount,
    totalObligation,
  };
}

/**
 * Derives deterministic repayment readiness from canonical contract lifecycle guards.
 */
export function getRepaymentReadiness(
  loan?: LoanDetailsModel | null,
  callerPk?: Uint8Array
): RepaymentReadiness {
  if (!loan) {
    return {
      status: 'LOAN_NOT_AVAILABLE',
      canRepay: false,
      reason: 'Loan agreement not found or unavailable.',
    };
  }

  // Phase check: Requested loans cannot be repaid
  if (loan.status === LoanStatus.requested) {
    return {
      status: 'LOAN_NOT_FUNDED',
      canRepay: false,
      reason: 'Loan has not been funded by a lender yet.',
    };
  }

  // Phase check: Already repaid
  if (loan.status === LoanStatus.repaid) {
    return {
      status: 'ALREADY_REPAID',
      canRepay: false,
      reason: 'This loan has already been repaid.',
    };
  }

  // Phase check: Concluded settlement
  if (loan.status === LoanStatus.settled) {
    return {
      status: 'AGREEMENT_CONCLUDED',
      canRepay: false,
      reason: 'This agreement has concluded and reached terminal settlement.',
    };
  }

  // Status must be funded
  if (loan.status !== LoanStatus.funded) {
    return {
      status: 'LOAN_NOT_AVAILABLE',
      canRepay: false,
      reason: 'Loan is not in funded state.',
    };
  }

  // Caller identity authorization: only borrower may repay
  if (callerPk && !areByteArraysEqual(callerPk, loan.borrowerBytes)) {
    return {
      status: 'UNAUTHORIZED_BORROWER',
      canRepay: false,
      reason: 'Caller is not the borrower of this loan agreement.',
    };
  }

  // Validate canonical lifecycle guard
  const guard = canRepayLoan(loan, callerPk);
  if (!guard.canExecute) {
    return {
      status: 'UNAUTHORIZED_BORROWER',
      canRepay: false,
      reason: guard.reason ?? 'Cannot execute repayment.',
    };
  }

  return {
    status: 'READY_TO_REPAY',
    canRepay: true,
  };
}

/**
 * Creates privacy attestation confirming that repayment exposes zero confidential data.
 */
export function createRepaymentAttestation(loanId: string): RepaymentPrivacyAttestation {
  return {
    title: 'Immutable Repayment Calculation',
    statement: `Repayment obligation for ${loanId} is derived strictly from public immutable contract parameters.`,
    notice: 'No confidential underwriting credentials or secret witnesses are required to calculate or execute repayment.',
  };
}

/**
 * Executes a prototype borrower repayment state transition.
 *
 * NOTE: Operates in Local Prototype Mode.
 * Updates local protocol state from FUNDED to REPAID while explicitly disclosing
 * that real on-chain token movement is pending live Midnight infrastructure.
 */
export async function executeRepaymentPrototype(
  request: RepaymentRequest
): Promise<{ updatedLoan: LoanDetailsModel; result: RepaymentResult }> {
  const { loanId, loan, callerPk, repaymentAmount } = request;

  const readiness = getRepaymentReadiness(loan, callerPk);
  if (!readiness.canRepay) {
    throw new Error(`Cannot repay loan ${loanId}: ${readiness.reason}`);
  }

  const calculation = calculateRepaymentPreview(loan);
  const actualRepaidAmount = repaymentAmount ?? calculation.totalObligation;

  // Validate obligation match
  if (actualRepaidAmount < calculation.totalObligation) {
    throw new Error('Repayment amount is insufficient for required principal + interest.');
  }
  if (actualRepaidAmount > calculation.totalObligation) {
    throw new Error('Repayment amount exceeds required principal + interest.');
  }

  const updatedLoan: LoanDetailsModel = {
    ...loan,
    status: LoanStatus.repaid,
    statusText: 'repaid',
  };

  const result: RepaymentResult = {
    success: true,
    loanId,
    previousStatus: 'FUNDED',
    updatedStatus: LoanStatus.repaid,
    updatedStatusText: 'repaid',
    calculation,
    repaidAmount: actualRepaidAmount,
    borrower: loan.borrower,
    lender: loan.lender,
    assetTransferStatus: 'Not executed — local prototype mode',
    disclaimer:
      'Prototype state transition only — network asset transfer pending live Midnight infrastructure.',
    timestamp: Date.now(),
    privacyAttestation: createRepaymentAttestation(loanId),
    isPrototypeExecution: true,
  };

  return { updatedLoan, result };
}
