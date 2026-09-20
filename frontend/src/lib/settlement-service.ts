import {
  canSettleLoan,
  calculateRepaymentObligation,
  areByteArraysEqual,
  LoanStatus,
  type LoanDetailsModel,
} from 'contracts';
import type {
  SettlementReadiness,
  SettlementEvaluation,
  SettlementRequest,
  SettlementResult,
  SettlementPrivacyAttestation,
} from '../types/settlement.ts';

/**
 * Evaluates settlement readiness from canonical contract lifecycle guards and authorization rules.
 */
export function getSettlementReadiness(
  loan?: LoanDetailsModel | null,
  callerPk?: Uint8Array
): SettlementReadiness {
  if (!loan) {
    return {
      status: 'LOAN_NOT_AVAILABLE',
      canSettle: false,
      reason: 'Loan agreement not found or unavailable.',
    };
  }

  // Phase check: Already settled
  if (loan.status === LoanStatus.settled) {
    return {
      status: 'ALREADY_SETTLED',
      canSettle: false,
      reason: 'This agreement has already reached terminal settlement.',
    };
  }

  // Phase check: Must be repaid before settlement
  if (loan.status !== LoanStatus.repaid) {
    return {
      status: 'LOAN_NOT_REPAID',
      canSettle: false,
      reason: 'Loan must be fully repaid before settlement can occur.',
    };
  }

  // Caller authorization check: Only borrower or assigned lender can settle
  let detectedRole: 'BORROWER' | 'LENDER' | undefined;
  if (callerPk) {
    const isBorrower = areByteArraysEqual(callerPk, loan.borrowerBytes);
    const isLender = loan.lenderBytes ? areByteArraysEqual(callerPk, loan.lenderBytes) : false;

    if (!isBorrower && !isLender) {
      return {
        status: 'UNAUTHORIZED_PARTICIPANT',
        canSettle: false,
        callerRole: 'UNAUTHORIZED',
        reason: 'Only the borrower or designated lender is authorized to settle this agreement.',
      };
    }

    detectedRole = isBorrower ? 'BORROWER' : 'LENDER';
  }

  // Validate canonical contract guard
  const guard = canSettleLoan(loan, callerPk);
  if (!guard.canExecute) {
    return {
      status: 'UNAUTHORIZED_PARTICIPANT',
      canSettle: false,
      callerRole: detectedRole,
      reason: guard.reason ?? 'Cannot execute settlement.',
    };
  }

  return {
    status: 'READY_TO_SETTLE',
    canSettle: true,
    callerRole: detectedRole,
  };
}

/**
 * Evaluates public settlement conditions for an agreement.
 * STRICT PRIVACY INVARIANT: Operates exclusively on public ledger data.
 */
export function evaluateLoanForSettlement(
  loan: LoanDetailsModel,
  callerPk?: Uint8Array
): SettlementEvaluation {
  const principal = loan.amount;
  const rateBps = BigInt(loan.interestRateBasisPoints);
  const repaymentObligation = calculateRepaymentObligation(principal, rateBps);
  const settlementReadiness = getSettlementReadiness(loan, callerPk);
  const repaymentStatus: 'COMPLETE' | 'PENDING' =
    loan.status === LoanStatus.repaid || loan.status === LoanStatus.settled
      ? 'COMPLETE'
      : 'PENDING';

  return {
    loanId: `loan-${loan.amount.toString()}`,
    principal,
    interestRateBasisPoints: rateBps,
    durationBlocks: loan.durationBlocks,
    repaymentObligation,
    borrower: loan.borrower,
    borrowerBytes: loan.borrowerBytes,
    lender: loan.lender,
    lenderBytes: loan.lenderBytes,
    currentStatus: loan.status,
    currentStatusText: loan.statusText,
    repaymentStatus,
    settlementReadiness,
  };
}

/**
 * Creates privacy attestation confirming settlement preserves confidentiality.
 */
export function createSettlementAttestation(loanId: string): SettlementPrivacyAttestation {
  return {
    title: 'Terminal Agreement Settlement Attestation',
    statement: `Settlement for agreement ${loanId} concludes the lifecycle in accordance with canonical Midnight Compact rules without disclosing confidential data.`,
    notice: 'No private underwriting credentials or off-chain witness data are required or accessed during terminal settlement.',
  };
}

/**
 * Executes a prototype borrower/lender settlement state transition.
 *
 * NOTE: Operates in Local Prototype Mode.
 * Updates local protocol state from REPAID to SETTLED while explicitly disclosing
 * that real on-chain token movement is pending live Midnight infrastructure.
 */
export async function executeSettlementPrototype(
  request: SettlementRequest
): Promise<{ updatedLoan: LoanDetailsModel; result: SettlementResult }> {
  const { loanId, loan, callerPk, callerRole } = request;

  const readiness = getSettlementReadiness(loan, callerPk);
  if (!readiness.canSettle) {
    throw new Error(`Cannot settle loan ${loanId}: ${readiness.reason}`);
  }

  const settledBy: 'BORROWER' | 'LENDER' =
    callerRole ?? (readiness.callerRole === 'LENDER' ? 'LENDER' : 'BORROWER');

  const updatedLoan: LoanDetailsModel = {
    ...loan,
    status: LoanStatus.settled,
    statusText: 'settled',
  };

  const obligation = calculateRepaymentObligation(
    loan.amount,
    BigInt(loan.interestRateBasisPoints)
  );

  const callerAddress =
    settledBy === 'LENDER' ? (loan.lender ?? '0xLender') : loan.borrower;

  const result: SettlementResult = {
    success: true,
    loanId,
    previousStatus: 'REPAID',
    updatedStatus: LoanStatus.settled,
    updatedStatusText: 'settled',
    settledBy,
    callerAddress,
    borrower: loan.borrower,
    lender: loan.lender ?? 'Unassigned',
    totalObligationCleared: obligation,
    assetTransferStatus: 'Not executed — local prototype mode',
    networkStatus: 'Local Prototype',
    disclaimer:
      'Prototype state transition only — terminal agreement closure. No real blockchain transactions or asset movements occurred.',
    timestamp: Date.now(),
    privacyAttestation: createSettlementAttestation(loanId),
    isPrototypeExecution: true,
  };

  return { updatedLoan, result };
}
