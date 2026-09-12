import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as runtime from '@midnight-ntwrk/compact-runtime';
import { Contract, ledger, LoanStatus } from '../contracts/managed/contract/index.js';

describe('Private Eligibility Circuit Tests', () => {
  const borrowerPk = new Uint8Array(32).fill(1);
  const otherPk = new Uint8Array(32).fill(2);
  const loanAmount = 10000n;
  const interestRate = 500n;
  const durationBlocks = 100n;
  const threshold = 30000n;

  const createInitialState = (minThreshold = threshold) => {
    const constructorContext = runtime.createConstructorContext({}, { bytes: borrowerPk });
    // Contract instance with dummy witnesses for initialization
    const initContract = new Contract({
      getPrivateFinancialValue: (ctx) => [ctx.privateState, 0n]
    });
    return initContract.initialState(
      constructorContext,
      borrowerPk,
      loanAmount,
      interestRate,
      durationBlocks,
      minThreshold
    );
  };

  it('Test A: private value (42000) >= threshold (30000) succeeds and sets isEligibilityVerified = true', () => {
    const witnesses = {
      getPrivateFinancialValue: (ctx) => [ctx.privateState, 42000n]
    };
    const contract = new Contract(witnesses);
    const initResult = createInitialState(30000n);

    // Initial state verification
    const initialLedger = ledger(initResult.currentContractState.data);
    assert.equal(initialLedger.status, LoanStatus.requested);
    assert.equal(initialLedger.isEligibilityVerified, false);
    assert.equal(initialLedger.eligibilityThreshold, 30000n);

    // Execute verifyEligibility circuit
    const circuitContext = runtime.createCircuitContext(
      runtime.dummyContractAddress(),
      { bytes: borrowerPk },
      initResult.currentContractState.data,
      {}
    );

    const execResult = contract.circuits.verifyEligibility(circuitContext);
    const updatedLedger = ledger(execResult.context.currentQueryContext.state);

    // Verified flag must be true
    assert.equal(updatedLedger.isEligibilityVerified, true);
    // Loan status must remain requested
    assert.equal(updatedLedger.status, LoanStatus.requested);
  });

  it('Test B: private value (20000) < threshold (30000) fails eligibility assertion', () => {
    const witnesses = {
      getPrivateFinancialValue: (ctx) => [ctx.privateState, 20000n]
    };
    const contract = new Contract(witnesses);
    const initResult = createInitialState(30000n);

    const circuitContext = runtime.createCircuitContext(
      runtime.dummyContractAddress(),
      { bytes: borrowerPk },
      initResult.currentContractState.data,
      {}
    );

    assert.throws(
      () => {
        contract.circuits.verifyEligibility(circuitContext);
      },
      (err) => {
        assert.match(err.message, /Borrower does not meet the required eligibility threshold/);
        return true;
      }
    );

    // Unmodified state remains unverified
    const currentLedger = ledger(initResult.currentContractState.data);
    assert.equal(currentLedger.isEligibilityVerified, false);
  });

  it('Test C: second verification attempt on already-verified loan is rejected', () => {
    const witnesses = {
      getPrivateFinancialValue: (ctx) => [ctx.privateState, 42000n]
    };
    const contract = new Contract(witnesses);
    const initResult = createInitialState(30000n);

    // First verification (succeeds)
    const circuitContext1 = runtime.createCircuitContext(
      runtime.dummyContractAddress(),
      { bytes: borrowerPk },
      initResult.currentContractState.data,
      {}
    );
    const execResult = contract.circuits.verifyEligibility(circuitContext1);
    const verifiedState = execResult.context.currentQueryContext.state;

    // Second verification attempt on updated state
    const circuitContext2 = runtime.createCircuitContext(
      runtime.dummyContractAddress(),
      { bytes: borrowerPk },
      verifiedState,
      {}
    );

    assert.throws(
      () => {
        contract.circuits.verifyEligibility(circuitContext2);
      },
      (err) => {
        assert.match(err.message, /Eligibility is already verified/);
        return true;
      }
    );
  });

  it('Test D: verification is rejected when loan is not in requested state', () => {
    const witnesses = {
      getPrivateFinancialValue: (ctx) => [ctx.privateState, 42000n]
    };
    const contract = new Contract(witnesses);
    const initResult = createInitialState(30000n);

    // Construct state with status = funded (1) instead of requested (0)
    const rawArray = initResult.currentContractState.data.state.asArray();
    const descriptorEnum = new runtime.CompactTypeEnum(3, 1);
    const fundedCell = runtime.StateValue.newCell({
      value: descriptorEnum.toValue(LoanStatus.funded),
      alignment: descriptorEnum.alignment()
    });

    let modifiedArray = runtime.StateValue.newArray();
    for (let i = 0; i < rawArray.length; i++) {
      if (i === 5) {
        modifiedArray = modifiedArray.arrayPush(fundedCell);
      } else {
        modifiedArray = modifiedArray.arrayPush(rawArray[i]);
      }
    }

    const modifiedContractState = new runtime.ContractState();
    modifiedContractState.data = new runtime.ChargedState(modifiedArray);
    modifiedContractState.setOperation('verifyEligibility', new runtime.ContractOperation());
    modifiedContractState.setOperation('getLoanStatus', new runtime.ContractOperation());
    modifiedContractState.setOperation('getLoanDetails', new runtime.ContractOperation());

    const circuitContext = runtime.createCircuitContext(
      runtime.dummyContractAddress(),
      { bytes: borrowerPk },
      modifiedContractState.data,
      {}
    );

    assert.throws(
      () => {
        contract.circuits.verifyEligibility(circuitContext);
      },
      (err) => {
        assert.match(err.message, /Loan is not in requested state/);
        return true;
      }
    );
  });

  it('Test E: caller authorization check rejects verification when caller is not the borrower', () => {
    const witnesses = {
      getPrivateFinancialValue: (ctx) => [ctx.privateState, 42000n]
    };
    const contract = new Contract(witnesses);
    const initResult = createInitialState(30000n);

    // Attempt verification with otherPk instead of borrowerPk
    const circuitContext = runtime.createCircuitContext(
      runtime.dummyContractAddress(),
      { bytes: otherPk },
      initResult.currentContractState.data,
      {}
    );

    assert.throws(
      () => {
        contract.circuits.verifyEligibility(circuitContext);
      },
      (err) => {
        assert.match(err.message, /Caller is not the borrower/);
        return true;
      }
    );
  });
});
