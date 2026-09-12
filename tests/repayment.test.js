import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as runtime from '@midnight-ntwrk/compact-runtime';
import { Contract, ledger, LoanStatus } from '../contracts/managed/contract/index.js';
import {
  createLoanRequest,
  executeEligibilityProof,
  fundLoan,
  repayLoan,
  calculateRepaymentObligation,
} from '../contracts/dist/index.js';

describe('Borrower Repayment Workflow Tests', () => {
  const borrowerPk = new Uint8Array(32).fill(1);
  const lenderPk = new Uint8Array(32).fill(2);
  const otherPk = new Uint8Array(32).fill(3);

  const principalAmount = 10000n;
  const interestRateBasisPoints = 500n; // 5% simple interest
  const durationBlocks = 100n;
  const eligibilityThreshold = 30000n;
  const privateFinancialValue = 42000n;

  // Expected obligation: 10000 + (10000 * 500 / 10000) = 10500
  const expectedObligation = 10500n;

  // Helper to establish an active, funded loan ready for repayment
  const setupFundedLoan = () => {
    const loanRequest = createLoanRequest({
      borrowerPk,
      principalAmount,
      interestRateBasisPoints,
      durationBlocks,
      eligibilityThreshold,
    });

    const proofResult = executeEligibilityProof({
      contractState: loanRequest.contractState,
      borrowerPk,
      privateFinancialValue,
    });

    const fundingResult = fundLoan({
      contractState: proofResult.updatedContractState,
      lenderPk,
      callerPk: lenderPk,
    });

    return {
      loanRequest,
      fundedState: fundingResult.updatedContractState,
      fundedLedger: fundingResult.updatedLedger,
    };
  };

  it('calculateRepaymentObligation computes exact simple interest obligation', () => {
    const amount = calculateRepaymentObligation(principalAmount, interestRateBasisPoints);
    assert.equal(amount, expectedObligation);

    // Additional calculation check: 25000 with 750 bps = 25000 + 1875 = 26875
    const amount2 = calculateRepaymentObligation(25000n, 750n);
    assert.equal(amount2, 26875n);
  });

  it('Test A: funded loan repaid by borrower with exact obligation succeeds', () => {
    const { fundedState } = setupFundedLoan();

    const repaymentResult = repayLoan({
      contractState: fundedState,
      borrowerPk,
      callerPk: borrowerPk,
      repaymentAmount: expectedObligation,
    });

    assert.equal(repaymentResult.updatedLedger.status, LoanStatus.repaid);
    assert.equal(repaymentResult.repaidAmount, expectedObligation);
    assert.equal(repaymentResult.updatedLedger.isEligibilityVerified, true);
    assert.deepEqual(repaymentResult.updatedLedger.borrower, borrowerPk);
    assert.deepEqual(repaymentResult.updatedLedger.lender.value, lenderPk);
    assert.equal(repaymentResult.isAssetTransferExecuted, false);
  });

  it('Test B: repaying a loan in requested state is rejected by contract assertion', () => {
    // Loan is created and verified, but NOT funded yet
    const loanRequest = createLoanRequest({
      borrowerPk,
      principalAmount,
      interestRateBasisPoints,
      durationBlocks,
      eligibilityThreshold,
    });

    assert.equal(loanRequest.initialLedger.status, LoanStatus.requested);

    assert.throws(
      () => {
        repayLoan({
          contractState: loanRequest.contractState,
          borrowerPk,
          callerPk: borrowerPk,
          repaymentAmount: expectedObligation,
        });
      },
      (err) => {
        assert.match(err.message, /Loan is not in funded state/);
        return true;
      }
    );
  });

  it('Test C: repaying an already repaid loan is rejected by contract assertion', () => {
    const { fundedState } = setupFundedLoan();

    // First repayment succeeds
    const firstRepayment = repayLoan({
      contractState: fundedState,
      borrowerPk,
      callerPk: borrowerPk,
      repaymentAmount: expectedObligation,
    });
    assert.equal(firstRepayment.updatedLedger.status, LoanStatus.repaid);

    // Second repayment attempt
    assert.throws(
      () => {
        repayLoan({
          contractState: firstRepayment.updatedContractState,
          borrowerPk,
          callerPk: borrowerPk,
          repaymentAmount: expectedObligation,
        });
      },
      (err) => {
        assert.match(err.message, /Loan is not in funded state/);
        return true;
      }
    );
  });

  it('Test D: lender attempting to call repayLoan is rejected', () => {
    const { fundedState } = setupFundedLoan();

    // Lender tries to call repayLoan
    assert.throws(
      () => {
        repayLoan({
          contractState: fundedState,
          borrowerPk,
          callerPk: lenderPk, // Caller is lender
          repaymentAmount: expectedObligation,
        });
      },
      (err) => {
        assert.match(err.message, /Caller is not the borrower/);
        return true;
      }
    );
  });

  it('Test E: third party attempting to call repayLoan is rejected', () => {
    const { fundedState } = setupFundedLoan();

    assert.throws(
      () => {
        repayLoan({
          contractState: fundedState,
          borrowerPk,
          callerPk: otherPk, // Caller is unrelated third party
          repaymentAmount: expectedObligation,
        });
      },
      (err) => {
        assert.match(err.message, /Caller is not the borrower/);
        return true;
      }
    );
  });

  it('Test F: insufficient repayment amounts are rejected by contract assertion', () => {
    const { fundedState } = setupFundedLoan();

    // 1. Amount less than principal (e.g. 9999 < 10000)
    assert.throws(
      () => {
        repayLoan({
          contractState: fundedState,
          borrowerPk,
          callerPk: borrowerPk,
          repaymentAmount: 9999n,
        });
      },
      (err) => {
        assert.match(err.message, /Repayment amount must cover at least the principal/);
        return true;
      }
    );

    // 2. Amount covers principal but underpays required interest (e.g. 10499 instead of 10500)
    assert.throws(
      () => {
        repayLoan({
          contractState: fundedState,
          borrowerPk,
          callerPk: borrowerPk,
          repaymentAmount: 10499n,
        });
      },
      (err) => {
        assert.match(err.message, /Repayment amount is insufficient for required interest/);
        return true;
      }
    );
  });

  it('Test G: repayment amount exceeding required interest is rejected', () => {
    const { fundedState } = setupFundedLoan();

    // Overpaying interest (e.g. 10501 instead of 10500)
    // Field modular subtraction wraps around to prime modulus and fails 64-bit bounds
    assert.throws(() => {
      repayLoan({
        contractState: fundedState,
        borrowerPk,
        callerPk: borrowerPk,
        repaymentAmount: 10501n,
      });
    });
  });

  it('Test H: default parameter behavior automatically computes exact repayment obligation', () => {
    const { fundedState } = setupFundedLoan();

    // When repaymentAmount is omitted, helper automatically computes required amount
    const repaymentResult = repayLoan({
      contractState: fundedState,
      borrowerPk,
      callerPk: borrowerPk,
    });

    assert.equal(repaymentResult.repaidAmount, expectedObligation);
    assert.equal(repaymentResult.updatedLedger.status, LoanStatus.repaid);
  });

  it('Integration: complete loan lifecycle from request through verification, funding, to repayment', () => {
    // 1. Create loan request
    const loanRequest = createLoanRequest({
      borrowerPk,
      principalAmount: 50000n,
      interestRateBasisPoints: 1000n, // 10% interest
      durationBlocks: 1000n,
      eligibilityThreshold: 40000n,
    });
    assert.equal(loanRequest.initialLedger.status, LoanStatus.requested);

    // 2. Private ZK eligibility verification
    const proofResult = executeEligibilityProof({
      contractState: loanRequest.contractState,
      borrowerPk,
      privateFinancialValue: 60000n,
    });
    assert.equal(proofResult.updatedLedger.isEligibilityVerified, true);

    // 3. Lender funds loan
    const fundingResult = fundLoan({
      contractState: proofResult.updatedContractState,
      lenderPk,
      callerPk: lenderPk,
    });
    assert.equal(fundingResult.updatedLedger.status, LoanStatus.funded);
    assert.deepEqual(fundingResult.updatedLedger.lender.value, lenderPk);

    // 4. Expected repayment: 50000 + (50000 * 1000 / 10000) = 55000
    const expected = calculateRepaymentObligation(50000n, 1000n);
    assert.equal(expected, 55000n);

    // 5. Borrower repays loan
    const repaymentResult = repayLoan({
      contractState: fundingResult.updatedContractState,
      borrowerPk,
      callerPk: borrowerPk,
      repaymentAmount: expected,
    });
    assert.equal(repaymentResult.updatedLedger.status, LoanStatus.repaid);
    assert.equal(repaymentResult.repaidAmount, 55000n);

    // 6. Verify inspection circuits on repaid contract
    const contract = new Contract({
      getPrivateFinancialValue: (ctx) => [ctx.privateState, 0n],
    });
    const inspectContext = runtime.createCircuitContext(
      runtime.dummyContractAddress(),
      { bytes: borrowerPk },
      repaymentResult.updatedContractState.data,
      {}
    );

    const statusQuery = contract.circuits.getLoanStatus(inspectContext);
    assert.equal(statusQuery.result, LoanStatus.repaid);

    const detailsQuery = contract.circuits.getLoanDetails(inspectContext);
    assert.equal(detailsQuery.result.status, LoanStatus.repaid);
    assert.equal(detailsQuery.result.isEligibilityVerified, true);
    assert.deepEqual(detailsQuery.result.borrower, borrowerPk);
    assert.deepEqual(detailsQuery.result.lender.value, lenderPk);
  });
});
