import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createLoan,
  verifyLoanEligibility,
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
  LoanApiError,
  LoanErrorCode,
  LoanDesk,
  bytesToHex,
  hexToBytes,
} from '../contracts/dist/index.js';
import { LoanStatus } from '../contracts/managed/contract/index.js';

describe('Canonical Loan Lifecycle API Tests', () => {
  const borrowerPk = new Uint8Array(32).fill(10);
  const lenderPk = new Uint8Array(32).fill(20);
  const otherPk = new Uint8Array(32).fill(30);

  const principalAmount = 15000n;
  const interestRateBasisPoints = 800n; // 8% simple interest
  const durationBlocks = 250n;
  const eligibilityThreshold = 35000n;
  const privateFinancialValue = 50000n;

  it('TEST A: Create a valid loan through the canonical API', () => {
    const res = createLoan({
      borrowerPk,
      principalAmount,
      interestRateBasisPoints,
      durationBlocks,
      eligibilityThreshold,
    });

    assert.equal(res.success, true);
    assert.ok(res.contractState);
    assert.equal(res.loanDetails.amount, principalAmount);
    assert.equal(res.loanDetails.interestRateBasisPoints, interestRateBasisPoints);
    assert.equal(res.loanDetails.durationBlocks, durationBlocks);
    assert.equal(res.loanDetails.eligibilityThreshold, eligibilityThreshold);
    assert.equal(res.loanDetails.status, LoanStatus.requested);
    assert.equal(res.loanDetails.statusText, 'requested');
    assert.equal(res.loanDetails.isEligibilityVerified, false);
    assert.equal(res.loanDetails.borrower, bytesToHex(borrowerPk));
    assert.equal(res.loanDetails.lender, null);
  });

  it('TEST B: Read loan details and status through the API', () => {
    const res = createLoan({
      borrowerPk,
      principalAmount,
      interestRateBasisPoints,
      durationBlocks,
      eligibilityThreshold,
    });

    const status = getLoanStatus(res.contractState);
    assert.equal(status, LoanStatus.requested);

    const details = getLoanDetails(res.contractState);
    assert.equal(details.amount, principalAmount);
    assert.equal(details.statusText, 'requested');
    assert.equal(details.isEligibilityVerified, false);
    assert.deepEqual(details.borrowerBytes, borrowerPk);
  });

  it('TEST C: Verify eligibility through the API', () => {
    const loan = createLoan({
      borrowerPk,
      principalAmount,
      interestRateBasisPoints,
      durationBlocks,
      eligibilityThreshold,
    });

    const verifyRes = verifyLoanEligibility({
      contractState: loan.contractState,
      borrowerPk,
      privateFinancialValue,
    });

    assert.equal(verifyRes.success, true);
    assert.equal(verifyRes.isVerified, true);
    assert.equal(verifyRes.loanDetails.statusText, 'requested');
    assert.equal(verifyRes.loanDetails.isEligibilityVerified, true);
    assert.ok(verifyRes.proofData);
  });

  it('TEST D: Fund loan through the API', () => {
    const loan = createLoan({
      borrowerPk,
      principalAmount,
      interestRateBasisPoints,
      durationBlocks,
      eligibilityThreshold,
    });

    const verifyRes = verifyLoanEligibility({
      contractState: loan.contractState,
      borrowerPk,
      privateFinancialValue,
    });

    const fundRes = fundLoan({
      contractState: verifyRes.contractState,
      lenderPk,
      callerPk: lenderPk,
    });

    assert.equal(fundRes.success, true);
    assert.equal(fundRes.loanDetails.status, LoanStatus.funded);
    assert.equal(fundRes.loanDetails.statusText, 'funded');
    assert.equal(fundRes.loanDetails.lender, bytesToHex(lenderPk));
    assert.deepEqual(fundRes.loanDetails.lenderBytes, lenderPk);
    assert.equal(fundRes.isAssetTransferExecuted, false);
  });

  it('TEST E: Calculate repayment obligation through the API', () => {
    // 15000 + (15000 * 800 / 10000) = 15000 + 1200 = 16200
    const obligation = calculateRepaymentObligation(principalAmount, interestRateBasisPoints);
    assert.equal(obligation, 16200n);

    // LoanDesk facade also exposes the calculation
    assert.equal(LoanDesk.calculateRepaymentObligation(10000n, 500n), 10500n);
  });

  it('TEST F: Repay loan through the API', () => {
    const loan = createLoan({
      borrowerPk,
      principalAmount,
      interestRateBasisPoints,
      durationBlocks,
      eligibilityThreshold,
    });

    const verifyRes = verifyLoanEligibility({
      contractState: loan.contractState,
      borrowerPk,
      privateFinancialValue,
    });

    const fundRes = fundLoan({
      contractState: verifyRes.contractState,
      lenderPk,
      callerPk: lenderPk,
    });

    const repayRes = repayLoan({
      contractState: fundRes.contractState,
      borrowerPk,
      callerPk: borrowerPk,
    });

    assert.equal(repayRes.success, true);
    assert.equal(repayRes.repaidAmount, 16200n);
    assert.equal(repayRes.loanDetails.status, LoanStatus.repaid);
    assert.equal(repayRes.loanDetails.statusText, 'repaid');
    assert.equal(repayRes.isAssetTransferExecuted, false);
  });

  it('TEST G: Settle loan through the API', () => {
    const loan = createLoan({
      borrowerPk,
      principalAmount,
      interestRateBasisPoints,
      durationBlocks,
      eligibilityThreshold,
    });

    const verifyRes = verifyLoanEligibility({
      contractState: loan.contractState,
      borrowerPk,
      privateFinancialValue,
    });

    const fundRes = fundLoan({
      contractState: verifyRes.contractState,
      lenderPk,
      callerPk: lenderPk,
    });

    const repayRes = repayLoan({
      contractState: fundRes.contractState,
      borrowerPk,
      callerPk: borrowerPk,
    });

    const settleRes = settleLoan({
      contractState: repayRes.contractState,
      callerPk: lenderPk,
    });

    assert.equal(settleRes.success, true);
    assert.equal(settleRes.loanDetails.status, LoanStatus.settled);
    assert.equal(settleRes.loanDetails.statusText, 'settled');
    assert.equal(settleRes.isAssetTransferExecuted, false);
  });

  it('TEST H: Run the complete lifecycle through the canonical LoanDesk facade', () => {
    // 1. Create
    const step1 = LoanDesk.createLoan({
      borrowerPk,
      principalAmount: 30000n,
      interestRateBasisPoints: 1000n, // 10%
      durationBlocks: 500n,
      eligibilityThreshold: 40000n,
    });
    assert.equal(step1.loanDetails.statusText, 'requested');

    // 2. Verify
    const step2 = LoanDesk.verifyLoanEligibility({
      contractState: step1.contractState,
      borrowerPk,
      privateFinancialValue: 55000n,
    });
    assert.equal(step2.isVerified, true);

    // 3. Fund
    const step3 = LoanDesk.fundLoan({
      contractState: step2.contractState,
      lenderPk,
      callerPk: lenderPk,
    });
    assert.equal(step3.loanDetails.statusText, 'funded');

    // 4. Repay (30000 + 30000 * 1000 / 10000 = 33000)
    const step4 = LoanDesk.repayLoan({
      contractState: step3.contractState,
      borrowerPk,
      callerPk: borrowerPk,
    });
    assert.equal(step4.repaidAmount, 33000n);
    assert.equal(step4.loanDetails.statusText, 'repaid');

    // 5. Settle
    const step5 = LoanDesk.settleLoan({
      contractState: step4.contractState,
      callerPk: borrowerPk,
    });
    assert.equal(step5.loanDetails.statusText, 'settled');

    // Inspect final state via facade
    assert.equal(LoanDesk.getLoanStatus(step5.contractState), LoanStatus.settled);
    const finalDetails = LoanDesk.getLoanDetails(step5.contractState);
    assert.equal(finalDetails.statusText, 'settled');
    assert.equal(finalDetails.amount, 30000n);
  });

  it('TEST I: Verify client-side lifecycle helper behavior', () => {
    const loan = createLoan({
      borrowerPk,
      principalAmount,
      interestRateBasisPoints,
      durationBlocks,
      eligibilityThreshold,
    });

    // In requested, unverified state
    assert.equal(canVerifyEligibility(loan.loanDetails, borrowerPk).canExecute, true);
    assert.equal(canVerifyEligibility(loan.loanDetails, otherPk).canExecute, false);
    assert.equal(canFundLoan(loan.loanDetails, lenderPk).canExecute, false); // needs verification
    assert.equal(canRepayLoan(loan.loanDetails, borrowerPk).canExecute, false); // not funded
    assert.equal(canSettleLoan(loan.loanDetails, borrowerPk).canExecute, false); // not repaid

    // After verification
    const verified = verifyLoanEligibility({
      contractState: loan.contractState,
      borrowerPk,
      privateFinancialValue,
    });
    assert.equal(canVerifyEligibility(verified.loanDetails, borrowerPk).canExecute, false); // already verified
    assert.equal(canFundLoan(verified.loanDetails, lenderPk).canExecute, true);
    assert.equal(canFundLoan(verified.loanDetails, borrowerPk).canExecute, false); // cannot self-fund

    // After funding
    const funded = fundLoan({
      contractState: verified.contractState,
      lenderPk,
      callerPk: lenderPk,
    });
    assert.equal(canFundLoan(funded.loanDetails, otherPk).canExecute, false); // already funded
    assert.equal(canRepayLoan(funded.loanDetails, borrowerPk).canExecute, true);
    assert.equal(canRepayLoan(funded.loanDetails, lenderPk).canExecute, false); // only borrower can repay

    // After repayment
    const repaid = repayLoan({
      contractState: funded.contractState,
      borrowerPk,
      callerPk: borrowerPk,
    });
    assert.equal(canRepayLoan(repaid.loanDetails, borrowerPk).canExecute, false); // already repaid
    assert.equal(canSettleLoan(repaid.loanDetails, borrowerPk).canExecute, true);
    assert.equal(canSettleLoan(repaid.loanDetails, lenderPk).canExecute, true);
    assert.equal(canSettleLoan(repaid.loanDetails, otherPk).canExecute, false); // third party blocked

    // After settlement
    const settled = settleLoan({
      contractState: repaid.contractState,
      callerPk: lenderPk,
    });
    assert.equal(canSettleLoan(settled.loanDetails, lenderPk).canExecute, false); // already settled
  });

  it('TEST J: Verify errors are consistently surfaced and mapped to LoanApiError', () => {
    // 1. Invalid parameter (amount = 0)
    assert.throws(
      () => {
        createLoan({
          borrowerPk,
          principalAmount: 0n,
          interestRateBasisPoints,
          durationBlocks,
          eligibilityThreshold,
        });
      },
      (err) => {
        assert.ok(err instanceof LoanApiError);
        assert.equal(err.code, LoanErrorCode.INVALID_PARAMETERS);
        assert.match(err.message, /Loan amount must be greater than zero/);
        return true;
      }
    );

    // 2. Failed eligibility proof (under threshold)
    const loan = createLoan({
      borrowerPk,
      principalAmount,
      interestRateBasisPoints,
      durationBlocks,
      eligibilityThreshold: 50000n,
    });
    assert.throws(
      () => {
        verifyLoanEligibility({
          contractState: loan.contractState,
          borrowerPk,
          privateFinancialValue: 20000n, // fails threshold
        });
      },
      (err) => {
        assert.ok(err instanceof LoanApiError);
        assert.equal(err.code, LoanErrorCode.ELIGIBILITY_VERIFICATION_FAILED);
        assert.match(err.message, /Borrower does not meet the required eligibility threshold/);
        return true;
      }
    );

    // 3. Unauthorized funding (caller is borrower attempting self-funding)
    const verified = verifyLoanEligibility({
      contractState: loan.contractState,
      borrowerPk,
      privateFinancialValue: 60000n,
    });
    assert.throws(
      () => {
        fundLoan({
          contractState: verified.contractState,
          lenderPk: borrowerPk,
          callerPk: borrowerPk,
        });
      },
      (err) => {
        assert.ok(err instanceof LoanApiError);
        assert.equal(err.code, LoanErrorCode.UNAUTHORIZED_CALLER);
        assert.match(err.message, /Borrower cannot fund their own loan/);
        return true;
      }
    );
  });

  it('TEST K: Verify no private witness or financial values appear in API results', () => {
    const secretValue = 77777n;

    const loan = createLoan({
      borrowerPk,
      principalAmount: 10000n,
      interestRateBasisPoints: 500n,
      durationBlocks: 100n,
      eligibilityThreshold: 30000n,
    });

    const verifyRes = verifyLoanEligibility({
      contractState: loan.contractState,
      borrowerPk,
      privateFinancialValue: secretValue,
    });

    const serializedResult = JSON.stringify(verifyRes, (_, v) =>
      typeof v === 'bigint' ? v.toString() : v
    );
    const serializedDetails = JSON.stringify(verifyRes.loanDetails, (_, v) =>
      typeof v === 'bigint' ? v.toString() : v
    );

    assert.equal(serializedResult.includes('77777'), false);
    assert.equal(serializedDetails.includes('77777'), false);

    // Ensure hex roundtrip utility works cleanly
    const sampleBytes = new Uint8Array([1, 2, 3, 255]);
    const hex = bytesToHex(sampleBytes);
    assert.equal(hex, '0x010203ff');
    assert.deepEqual(hexToBytes(hex), sampleBytes);
  });
});
