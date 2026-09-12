import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as runtime from '@midnight-ntwrk/compact-runtime';
import { Contract, ledger, LoanStatus } from '../contracts/managed/contract/index.js';
import {
  createLoanRequest,
  executeEligibilityProof,
  fundLoan,
} from '../contracts/dist/index.js';

describe('Lender Funding Workflow Tests', () => {
  const borrowerPk = new Uint8Array(32).fill(1);
  const lenderPk = new Uint8Array(32).fill(2);
  const otherPk = new Uint8Array(32).fill(3);
  const emptyPk = new Uint8Array(32).fill(0);

  const principalAmount = 10000n;
  const interestRateBasisPoints = 500n;
  const durationBlocks = 100n;
  const eligibilityThreshold = 30000n;
  const privateFinancialValue = 42000n; // >= threshold

  // Helper to establish a verified loan request ready for funding
  const setupVerifiedLoan = () => {
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

    return {
      loanRequest,
      verifiedState: proofResult.updatedContractState,
      verifiedLedger: proofResult.updatedLedger,
    };
  };

  it('Test A: eligible requested loan + valid lender results in successful funding', () => {
    const { verifiedState } = setupVerifiedLoan();

    const fundingResult = fundLoan({
      contractState: verifiedState,
      lenderPk,
      callerPk: lenderPk,
    });

    // Verify on-chain state transition
    assert.equal(fundingResult.updatedLedger.status, LoanStatus.funded);
    assert.equal(fundingResult.updatedLedger.lender.is_some, true);
    assert.deepEqual(fundingResult.updatedLedger.lender.value, lenderPk);
    assert.equal(fundingResult.updatedLedger.isEligibilityVerified, true);
    assert.equal(fundingResult.updatedLedger.amount, principalAmount);
    assert.deepEqual(fundingResult.updatedLedger.borrower, borrowerPk);

    // Verify honest reporting on simulated vs live asset escrow
    assert.equal(fundingResult.isAssetTransferExecuted, false);
  });

  it('Test B: unverified loan request is rejected by contract assertion', () => {
    // Unverified loan request (isEligibilityVerified = false)
    const unverifiedLoan = createLoanRequest({
      borrowerPk,
      principalAmount,
      interestRateBasisPoints,
      durationBlocks,
      eligibilityThreshold,
    });

    assert.equal(unverifiedLoan.initialLedger.isEligibilityVerified, false);

    assert.throws(
      () => {
        fundLoan({
          contractState: unverifiedLoan.contractState,
          lenderPk,
          callerPk: lenderPk,
        });
      },
      (err) => {
        assert.match(err.message, /Loan eligibility has not been verified/);
        return true;
      }
    );
  });

  it('Test C: funding an already funded loan is rejected by contract assertion', () => {
    const { verifiedState } = setupVerifiedLoan();

    // First funding succeeds
    const firstFunding = fundLoan({
      contractState: verifiedState,
      lenderPk,
      callerPk: lenderPk,
    });
    assert.equal(firstFunding.updatedLedger.status, LoanStatus.funded);

    // Second funding attempt on already funded contract
    assert.throws(
      () => {
        fundLoan({
          contractState: firstFunding.updatedContractState,
          lenderPk: otherPk,
          callerPk: otherPk,
        });
      },
      (err) => {
        assert.match(err.message, /Loan is not in requested state/);
        return true;
      }
    );
  });

  it('Test D: borrower attempting to fund own loan is rejected by contract assertion', () => {
    const { verifiedState } = setupVerifiedLoan();

    // Borrower tries to be the lender
    assert.throws(
      () => {
        fundLoan({
          contractState: verifiedState,
          lenderPk: borrowerPk,
          callerPk: borrowerPk,
        });
      },
      (err) => {
        assert.match(err.message, /Borrower cannot fund their own loan/);
        return true;
      }
    );
  });

  it('Test E: invalid lender identity is rejected', () => {
    const { verifiedState } = setupVerifiedLoan();

    // 1. All-zero lender public key rejected by on-chain assert and client validation
    assert.throws(
      () => {
        fundLoan({
          contractState: verifiedState,
          lenderPk: emptyPk,
          callerPk: emptyPk,
        });
      },
      (err) => {
        assert.match(err.message, /Lender public key cannot be empty/);
        return true;
      }
    );

    // 2. Caller does not match designated lender public key (caller authorization check)
    // Directly invoke circuit to verify contract-level assertion
    const contract = new Contract({
      getPrivateFinancialValue: (ctx) => [ctx.privateState, 0n],
    });
    const circuitContext = runtime.createCircuitContext(
      runtime.dummyContractAddress(),
      { bytes: otherPk }, // Caller is otherPk
      verifiedState.data,
      {}
    );

    assert.throws(
      () => {
        contract.circuits.fundLoan(circuitContext, lenderPk); // lenderPk is lenderPk != otherPk
      },
      (err) => {
        assert.match(err.message, /Caller is not the designated lender/);
        return true;
      }
    );
  });

  it('Test F: funding does not alter private eligibility data or expose secrets', () => {
    const { verifiedState } = setupVerifiedLoan();

    const fundingResult = fundLoan({
      contractState: verifiedState,
      lenderPk,
      callerPk: lenderPk,
    });

    const serializedLedger = JSON.stringify(fundingResult.updatedLedger, (_, v) =>
      typeof v === 'bigint' ? v.toString() : v
    );
    const serializedProof = JSON.stringify(fundingResult.proofData);

    // Verify secret private value (42000) is nowhere in public state or proof
    assert.equal(serializedLedger.includes('42000'), false);
    assert.equal(serializedProof.includes('42000'), false);

    // Verify only status and lender changed
    assert.equal(fundingResult.updatedLedger.status, LoanStatus.funded);
    assert.equal(fundingResult.updatedLedger.isEligibilityVerified, true);
    assert.equal(fundingResult.updatedLedger.eligibilityThreshold, eligibilityThreshold);
  });

  it('Integration: complete lifecycle from request creation through ZK verification to lender funding', () => {
    // 1. Borrower creates loan request
    const loanRequest = createLoanRequest({
      borrowerPk,
      principalAmount: 25000n,
      interestRateBasisPoints: 750n,
      durationBlocks: 500n,
      eligibilityThreshold: 50000n,
    });

    assert.equal(loanRequest.initialLedger.status, LoanStatus.requested);
    assert.equal(loanRequest.initialLedger.isEligibilityVerified, false);
    assert.equal(loanRequest.initialLedger.lender.is_some, false);

    // 2. Borrower proves eligibility with private income = 65000 (>= 50000)
    const proofResult = executeEligibilityProof({
      contractState: loanRequest.contractState,
      borrowerPk,
      privateFinancialValue: 65000n,
    });

    assert.equal(proofResult.isVerified, true);
    assert.equal(proofResult.updatedLedger.status, LoanStatus.requested);
    assert.equal(proofResult.updatedLedger.isEligibilityVerified, true);
    assert.equal(proofResult.updatedLedger.lender.is_some, false);

    // 3. Marketplace lender inspects verified request and funds the loan
    const fundingResult = fundLoan({
      contractState: proofResult.updatedContractState,
      lenderPk,
      callerPk: lenderPk,
    });

    assert.equal(fundingResult.updatedLedger.status, LoanStatus.funded);
    assert.equal(fundingResult.updatedLedger.lender.is_some, true);
    assert.deepEqual(fundingResult.updatedLedger.lender.value, lenderPk);
    assert.equal(fundingResult.updatedLedger.amount, 25000n);

    // 4. Verify inspection circuits on the funded contract
    const contract = new Contract({
      getPrivateFinancialValue: (ctx) => [ctx.privateState, 0n],
    });
    const inspectContext = runtime.createCircuitContext(
      runtime.dummyContractAddress(),
      { bytes: lenderPk },
      fundingResult.updatedContractState.data,
      {}
    );

    const statusQuery = contract.circuits.getLoanStatus(inspectContext);
    assert.equal(statusQuery.result, LoanStatus.funded);

    const detailsQuery = contract.circuits.getLoanDetails(inspectContext);
    assert.equal(detailsQuery.result.status, LoanStatus.funded);
    assert.equal(detailsQuery.result.isEligibilityVerified, true);
    assert.equal(detailsQuery.result.lender.is_some, true);
    assert.deepEqual(detailsQuery.result.lender.value, lenderPk);
    assert.equal(detailsQuery.result.amount, 25000n);
  });
});
