import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as runtime from '@midnight-ntwrk/compact-runtime';
import { Contract, ledger, LoanStatus } from '../contracts/managed/contract/index.js';
import {
  createLoanRequest,
  executeEligibilityProof,
  initializeLoanContract,
} from '../contracts/dist/index.js';

describe('Loan Request Creation and Validation Tests', () => {
  const borrowerPk = new Uint8Array(32).fill(1);
  const validAmount = 10000n;
  const validInterestRate = 500n; // 5% (500 bps)
  const validDuration = 100n;
  const validThreshold = 30000n;

  const createContractInstance = () => {
    return new Contract({
      getPrivateFinancialValue: (ctx) => [ctx.privateState, 0n],
    });
  };

  const invokeInitialState = (
    amount = validAmount,
    interestRate = validInterestRate,
    duration = validDuration,
    threshold = validThreshold,
    callerPk = borrowerPk
  ) => {
    const constructorContext = runtime.createConstructorContext({}, { bytes: callerPk });
    const contract = createContractInstance();
    return contract.initialState(
      constructorContext,
      borrowerPk,
      amount,
      interestRate,
      duration,
      threshold
    );
  };

  it('Test A: valid loan request is created successfully on-chain', () => {
    const initResult = invokeInitialState(validAmount, validInterestRate, validDuration, validThreshold);
    const initialLedger = ledger(initResult.currentContractState.data);

    assert.equal(initialLedger.amount, validAmount);
    assert.equal(initialLedger.interestRateBasisPoints, validInterestRate);
    assert.equal(initialLedger.durationBlocks, validDuration);
    assert.equal(initialLedger.eligibilityThreshold, validThreshold);
    assert.deepEqual(initialLedger.borrower, borrowerPk);
    assert.equal(initialLedger.lender.is_some, false);
    assert.equal(initialLedger.status, LoanStatus.requested);
    assert.equal(initialLedger.isEligibilityVerified, false);
  });

  it('Test B: amount = 0 is rejected by contract assertion', () => {
    assert.throws(
      () => {
        invokeInitialState(0n, validInterestRate, validDuration, validThreshold);
      },
      (err) => {
        assert.match(err.message, /Loan amount must be greater than zero/);
        return true;
      }
    );
  });

  it('Test C: duration = 0 is rejected by contract assertion', () => {
    assert.throws(
      () => {
        invokeInitialState(validAmount, validInterestRate, 0n, validThreshold);
      },
      (err) => {
        assert.match(err.message, /Loan duration must be greater than zero/);
        return true;
      }
    );
  });

  it('Test D: invalid interest rate is rejected by contract assertion', () => {
    // Zero interest rate
    assert.throws(
      () => {
        invokeInitialState(validAmount, 0n, validDuration, validThreshold);
      },
      (err) => {
        assert.match(err.message, /Interest rate must be between 1 and 10000 basis points/);
        return true;
      }
    );

    // Rate exceeding protocol maximum (10000 bps = 100%)
    assert.throws(
      () => {
        invokeInitialState(validAmount, 10001n, validDuration, validThreshold);
      },
      (err) => {
        assert.match(err.message, /Interest rate must be between 1 and 10000 basis points/);
        return true;
      }
    );
  });

  it('Test E: invalid eligibility threshold is rejected by contract assertion', () => {
    assert.throws(
      () => {
        invokeInitialState(validAmount, validInterestRate, validDuration, 0n);
      },
      (err) => {
        assert.match(err.message, /Eligibility threshold must be greater than zero/);
        return true;
      }
    );
  });

  it('Test F: newly created request has status = requested and isEligibilityVerified = false', () => {
    const initResult = invokeInitialState();
    const initialLedger = ledger(initResult.currentContractState.data);

    // Strict status and verification initial checks
    assert.equal(initialLedger.status, LoanStatus.requested);
    assert.notEqual(initialLedger.status, LoanStatus.funded);
    assert.notEqual(initialLedger.status, LoanStatus.repaid);
    assert.notEqual(initialLedger.status, LoanStatus.settled);
    assert.equal(initialLedger.isEligibilityVerified, false);

    // Verify inspection circuits reflect the identical state
    const contract = new Contract({
      getPrivateFinancialValue: (ctx) => [ctx.privateState, 0n],
    });
    const circuitContext = runtime.createCircuitContext(
      runtime.dummyContractAddress(),
      { bytes: borrowerPk },
      initResult.currentContractState.data,
      {}
    );

    const statusResult = contract.circuits.getLoanStatus(circuitContext);
    assert.equal(statusResult.result, LoanStatus.requested);

    const detailsResult = contract.circuits.getLoanDetails(circuitContext);
    assert.equal(detailsResult.result.status, LoanStatus.requested);
    assert.equal(detailsResult.result.isEligibilityVerified, false);
    assert.equal(detailsResult.result.amount, validAmount);
    assert.equal(detailsResult.result.interestRateBasisPoints, validInterestRate);
    assert.equal(detailsResult.result.durationBlocks, validDuration);
    assert.equal(detailsResult.result.eligibilityThreshold, validThreshold);
  });

  it('Compatibility: newly created loan request transitions cleanly to verified in verifyEligibility flow', () => {
    // 1. Create loan request via client helper
    const loanRequest = createLoanRequest({
      borrowerPk,
      principalAmount: validAmount,
      interestRateBasisPoints: validInterestRate,
      durationBlocks: validDuration,
      eligibilityThreshold: validThreshold,
    });

    assert.equal(loanRequest.initialLedger.status, LoanStatus.requested);
    assert.equal(loanRequest.initialLedger.isEligibilityVerified, false);

    // 2. Execute eligibility proof on newly created request with valid private value
    const proofResult = executeEligibilityProof({
      contractState: loanRequest.contractState,
      borrowerPk,
      privateFinancialValue: 42000n, // satisfies >= 30000 threshold
    });

    assert.equal(proofResult.isVerified, true);
    assert.equal(proofResult.updatedLedger.isEligibilityVerified, true);
    assert.equal(proofResult.updatedLedger.status, LoanStatus.requested);
    assert.equal(proofResult.updatedLedger.amount, validAmount);
  });

  it('Client validation: createLoanRequest rejects invalid parameters before contract invocation', () => {
    // Invalid amount
    assert.throws(() => {
      createLoanRequest({
        borrowerPk,
        principalAmount: 0n,
        interestRateBasisPoints: validInterestRate,
        durationBlocks: validDuration,
        eligibilityThreshold: validThreshold,
      });
    }, /Loan amount must be greater than zero/);

    // Invalid duration
    assert.throws(() => {
      createLoanRequest({
        borrowerPk,
        principalAmount: validAmount,
        interestRateBasisPoints: validInterestRate,
        durationBlocks: 0n,
        eligibilityThreshold: validThreshold,
      });
    }, /Loan duration must be greater than zero/);

    // Invalid interest rate (0)
    assert.throws(() => {
      createLoanRequest({
        borrowerPk,
        principalAmount: validAmount,
        interestRateBasisPoints: 0n,
        durationBlocks: validDuration,
        eligibilityThreshold: validThreshold,
      });
    }, /Interest rate must be between 1 and 10000 basis points/);

    // Invalid interest rate (> 10000)
    assert.throws(() => {
      createLoanRequest({
        borrowerPk,
        principalAmount: validAmount,
        interestRateBasisPoints: 12000n,
        durationBlocks: validDuration,
        eligibilityThreshold: validThreshold,
      });
    }, /Interest rate must be between 1 and 10000 basis points/);

    // Invalid threshold
    assert.throws(() => {
      createLoanRequest({
        borrowerPk,
        principalAmount: validAmount,
        interestRateBasisPoints: validInterestRate,
        durationBlocks: validDuration,
        eligibilityThreshold: 0n,
      });
    }, /Eligibility threshold must be greater than zero/);
  });
});
