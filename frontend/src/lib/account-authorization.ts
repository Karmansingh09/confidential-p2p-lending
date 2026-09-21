import { LoanStatus, type LoanDetailsModel } from '../types/index.ts';
import type {
  AccountIdentity,
  AccountContext,
  AccountAuthorization,
} from '../types/account.ts';
import {
  canVerifyEligibility,
  canFundLoan,
  canRepayLoan,
  canSettleLoan,
  areByteArraysEqual,
} from 'contracts';

/**
 * Derives dynamic action authorization for an active account against a selected loan agreement.
 * Combines active account identity, loan participant public identifiers, and canonical lifecycle guards.
 */
export function getAccountAuthorization(
  loan: LoanDetailsModel | null | undefined,
  account: AccountIdentity | AccountContext | null | undefined
): AccountAuthorization {
  // 1. Guard against missing loan or account
  if (!account || !loan) {
    return {
      isBorrower: false,
      isLender: false,
      canVerifyEligibility: false,
      canFundLoan: false,
      canRepayLoan: false,
      canSettleLoan: false,
      reasons: {
        verify: !account ? 'Account is disconnected' : 'No loan selected',
        fund: !account ? 'Account is disconnected' : 'No loan selected',
        repay: !account ? 'Account is disconnected' : 'No loan selected',
        settle: !account ? 'Account is disconnected' : 'No loan selected',
      },
    };
  }

  // 2. Extract identity from account or context
  const identity: AccountIdentity | null =
    'identity' in account ? account.identity : account;

  if (!identity || identity.connectionStatus !== 'CONNECTED') {
    return {
      isBorrower: false,
      isLender: false,
      canVerifyEligibility: false,
      canFundLoan: false,
      canRepayLoan: false,
      canSettleLoan: false,
      reasons: {
        verify: 'Account is disconnected',
        fund: 'Account is disconnected',
        repay: 'Account is disconnected',
        settle: 'Account is disconnected',
      },
    };
  }

  const callerPk = identity.publicKey ?? undefined;

  // 3. Determine participant identity relationship to the loan
  const isBorrower = callerPk
    ? areByteArraysEqual(callerPk, loan.borrowerBytes)
    : identity.role === 'BORROWER';
  const isLender = callerPk && loan.lenderBytes
    ? areByteArraysEqual(callerPk, loan.lenderBytes)
    : (identity.role === 'LENDER' && !isBorrower);

  // Third party is any account designated as PARTICIPANT, or an account matching neither participant
  const isThirdParty =
    identity.role === 'PARTICIPANT' ||
    (!isBorrower && !isLender && identity.role !== 'LENDER');

  // 4. Settled agreement represents terminal protocol closure — all state mutations disabled
  if (loan.status === LoanStatus.settled) {
    return {
      isBorrower,
      isLender,
      canVerifyEligibility: false,
      canFundLoan: false,
      canRepayLoan: false,
      canSettleLoan: false,
      reasons: {
        verify: 'Agreement concluded in terminal settled state',
        fund: 'Agreement concluded in terminal settled state',
        repay: 'Agreement concluded in terminal settled state',
        settle: 'Agreement is already settled and closed',
      },
    };
  }

  // 5. Third-party accounts cannot execute borrower or lender actions
  if (isThirdParty) {
    return {
      isBorrower: false,
      isLender: false,
      canVerifyEligibility: false,
      canFundLoan: false,
      canRepayLoan: false,
      canSettleLoan: false,
      reasons: {
        verify: 'Third-party accounts cannot verify borrower eligibility',
        fund: 'Third-party accounts cannot fund loans',
        repay: 'Third-party accounts cannot repay loans',
        settle: 'Third-party accounts cannot settle agreements',
      },
    };
  }

  // 6. Borrower Eligibility Verification Guard
  let canVerify = false;
  let verifyReason: string | undefined;
  if (!isBorrower) {
    verifyReason = 'Only the borrower can verify eligibility';
  } else {
    const guard = canVerifyEligibility(loan, callerPk);
    canVerify = guard.canExecute;
    verifyReason = guard.reason;
  }

  // 7. Lender Capital Funding Guard
  let canFund = false;
  let fundReason: string | undefined;
  if (isBorrower) {
    fundReason = 'Borrower cannot fund their own loan';
  } else if (!isLender && identity.role !== 'LENDER') {
    fundReason = 'Only a lender can fund this loan';
  } else {
    const guard = canFundLoan(loan, callerPk);
    canFund = guard.canExecute;
    fundReason = guard.reason;
  }

  // 8. Borrower Debt Repayment Guard
  let canRepay = false;
  let repayReason: string | undefined;
  if (!isBorrower) {
    repayReason = 'Only the borrower can repay this loan';
  } else {
    const guard = canRepayLoan(loan, callerPk);
    canRepay = guard.canExecute;
    repayReason = guard.reason;
  }

  // 9. Symmetrical Agreement Settlement Guard
  let canSettle = false;
  let settleReason: string | undefined;
  if (!isBorrower && !isLender) {
    settleReason = 'Only the borrower or assigned lender can settle this loan';
  } else {
    const guard = canSettleLoan(loan, callerPk);
    canSettle = guard.canExecute;
    settleReason = guard.reason;
  }

  return {
    isBorrower,
    isLender,
    canVerifyEligibility: canVerify,
    canFundLoan: canFund,
    canRepayLoan: canRepay,
    canSettleLoan: canSettle,
    reasons: {
      verify: verifyReason,
      fund: fundReason,
      repay: repayReason,
      settle: settleReason,
    },
  };
}
