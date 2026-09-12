import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as runtime from '@midnight-ntwrk/compact-runtime';
import { Contract, ledger, LoanStatus } from '../contracts/managed/contract/index.js';
import {
  createLoanRequest,
  executeEligibilityProof,
  fundLoan,
  repayLoan,
  settleLoan,
  calculateRepaymentObligation,
} from '../contracts/dist/index.js';

describe('Loan Settlement Workflow Tests', () => {
  const borrowerPk = new Uint8Array(32).fill(1);
  const lenderPk = new Uint8Array(32).fill(2);
  const otherPk = new Uint8Array(32).fill(3);

  const principalAmount = 10000n;
  const interestRateBasisPoints = 500n; // 5% simple interest
  const durationBlocks = 100n;
  const eligibilityThreshold = 30000n;
  const privateFinancialValue = 42000n;

  // Helper to establish a fully repaid loan ready for settlement
  const setupRepaidLoan = () => {
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

    const repaymentResult = repayLoan({
      contractState: fundingResult.updatedContractState,
      borrowerPk,
      callerPk: borrowerPk,
    });

    return {
      loanRequest,
      repaidState: repaymentResult.updatedContractState,
      repaidLedger: repaymentResult.updatedLedger,
    };
  };

  it('Test A: repaid loan settled by lender succeeds and reaches terminal state', () => {
    const { repaidState } = setupRepaidLoan();

    const settlementResult = settleLoan({
      contractState: repaidState,
      callerPk: lenderPk, // Lender settles
    });

    assert.equal(settlementResult.updatedLedger.status, LoanStatus.settled);
    assert.equal(settlementResult.updatedLedger.isEligibilityVerified, true);
    assert.deepEqual(settlementResult.updatedLedger.borrower, borrowerPk);
    assert.deepEqual(settlementResult.updatedLedger.lender.value, lenderPk);
    assert.equal(settlementResult.isAssetTransferExecuted, false);
  });

  it('Test B: repaid loan settled by borrower succeeds and reaches terminal state', () => {
    const { repaidState } = setupRepaidLoan();

    const settlementResult = settleLoan({
      contractState: repaidState,
      callerPk: borrowerPk, // Borrower settles
    });

    assert.equal(settlementResult.updatedLedger.status, LoanStatus.settled);
    assert.equal(settlementResult.updatedLedger.isEligibilityVerified, true);
    assert.deepEqual(settlementResult.updatedLedger.borrower, borrowerPk);
    assert.deepEqual(settlementResult.updatedLedger.lender.value, lenderPk);
  });

  it('Test C: unauthorized third party attempting settlement is rejected by contract assertion', () => {
    const { repaidState } = setupRepaidLoan();

    assert.throws(
      () => {
        settleLoan({
          contractState: repaidState,
          callerPk: otherPk, // Neither borrower nor lender
        });
      },
      (err) => {
        assert.match(err.message, /Caller is not authorized to settle this loan/);
        return true;
      }
    );
  });

  it('Test D: settling a loan in requested state is rejected by contract assertion', () => {
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
        settleLoan({
          contractState: loanRequest.contractState,
          callerPk: borrowerPk,
        });
      },
      (err) => {
        assert.match(err.message, /Loan is not in repaid state/);
        return true;
      }
    );
  });

  it('Test E: settling a loan in funded state (prior to repayment) is rejected', () => {
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

    assert.equal(fundingResult.updatedLedger.status, LoanStatus.funded);

    assert.throws(
      () => {
        settleLoan({
          contractState: fundingResult.updatedContractState,
          callerPk: lenderPk,
        });
      },
      (err) => {
        assert.match(err.message, /Loan is not in repaid state/);
        return true;
      }
    );
  });

  it('Test F: settling an already settled loan is rejected by contract assertion', () => {
    const { repaidState } = setupRepaidLoan();

    // First settlement succeeds
    const firstSettlement = settleLoan({
      contractState: repaidState,
      callerPk: lenderPk,
    });
    assert.equal(firstSettlement.updatedLedger.status, LoanStatus.settled);

    // Second settlement attempt
    assert.throws(
      () => {
        settleLoan({
          contractState: firstSettlement.updatedContractState,
          callerPk: lenderPk,
        });
      },
      (err) => {
        assert.match(err.message, /Loan is not in repaid state/);
        return true;
      }
    );
  });

  it('Test G: all inspection circuits reflect settled status and preserve immutable terms', () => {
    const { repaidState } = setupRepaidLoan();

    const settlementResult = settleLoan({
      contractState: repaidState,
      callerPk: lenderPk,
    });

    const contract = new Contract({
      getPrivateFinancialValue: (ctx) => [ctx.privateState, 0n],
    });
    const inspectContext = runtime.createCircuitContext(
      runtime.dummyContractAddress(),
      { bytes: lenderPk },
      settlementResult.updatedContractState.data,
      {}
    );

    const statusQuery = contract.circuits.getLoanStatus(inspectContext);
    assert.equal(statusQuery.result, LoanStatus.settled);

    const detailsQuery = contract.circuits.getLoanDetails(inspectContext);
    assert.equal(detailsQuery.result.status, LoanStatus.settled);
    assert.equal(detailsQuery.result.isEligibilityVerified, true);
    assert.deepEqual(detailsQuery.result.borrower, borrowerPk);
    assert.deepEqual(detailsQuery.result.lender.value, lenderPk);
    assert.equal(detailsQuery.result.amount, principalAmount);
    assert.equal(detailsQuery.result.interestRateBasisPoints, interestRateBasisPoints);
  });

  it('Integration: complete 5-phase lifecycle from creation to terminal settlement', () => {
    // 1. Creation
    const loanRequest = createLoanRequest({
      borrowerPk,
      principalAmount: 20000n,
      interestRateBasisPoints: 600n,
      durationBlocks: 300n,
      eligibilityThreshold: 35000n,
    });
    assert.equal(loanRequest.initialLedger.status, LoanStatus.requested);
    assert.equal(loanRequest.initialLedger.isEligibilityVerified, false);

    // 2. Private ZK Eligibility
    const proofResult = executeEligibilityProof({
      contractState: loanRequest.contractState,
      borrowerPk,
      privateFinancialValue: 45000n,
    });
    assert.equal(proofResult.updatedLedger.status, LoanStatus.requested);
    assert.equal(proofResult.updatedLedger.isEligibilityVerified, true);

    // 3. Lender Funding
    const fundingResult = fundLoan({
      contractState: proofResult.updatedContractState,
      lenderPk,
      callerPk: lenderPk,
    });
    assert.equal(fundingResult.updatedLedger.status, LoanStatus.funded);
    assert.deepEqual(fundingResult.updatedLedger.lender.value, lenderPk);

    // 4. Borrower Repayment (20000 + 20000 * 600 / 10000 = 21200)
    const expectedTotal = calculateRepaymentObligation(20000n, 600n);
    assert.equal(expectedTotal, 21200n);

    const repaymentResult = repayLoan({
      contractState: fundingResult.updatedContractState,
      borrowerPk,
      callerPk: borrowerPk,
      repaymentAmount: expectedTotal,
    });
    assert.equal(repaymentResult.updatedLedger.status, LoanStatus.repaid);

    // 5. Final Settlement
    const settlementResult = settleLoan({
      contractState: repaymentResult.updatedContractState,
      callerPk: lenderPk,
    });
    assert.equal(settlementResult.updatedLedger.status, LoanStatus.settled);
  });
});
