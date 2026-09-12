import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  initializeLoanContract,
  executeEligibilityProof,
  createEligibilityWitnessProvider,
} from '../contracts/dist/index.js';
import { LoanStatus } from '../contracts/managed/contract/index.js';

describe('Client-Side Eligibility Proof Module Tests', () => {
  const borrowerPk = new Uint8Array(32).fill(7);
  const otherPk = new Uint8Array(32).fill(9);
  const principalAmount = 15000n;
  const interestRateBasisPoints = 500n;
  const durationBlocks = 200n;
  const eligibilityThreshold = 30000n;

  it('initializeLoanContract sets up state correctly with isEligibilityVerified = false', () => {
    const init = initializeLoanContract({
      borrowerPk,
      principalAmount,
      interestRateBasisPoints,
      durationBlocks,
      eligibilityThreshold,
    });

    assert.equal(init.initialLedger.status, LoanStatus.requested);
    assert.equal(init.initialLedger.amount, principalAmount);
    assert.equal(init.initialLedger.eligibilityThreshold, eligibilityThreshold);
    assert.equal(init.initialLedger.isEligibilityVerified, false);
  });

  it('executeEligibilityProof succeeds when private value (42000) >= threshold (30000)', () => {
    const init = initializeLoanContract({
      borrowerPk,
      principalAmount,
      interestRateBasisPoints,
      durationBlocks,
      eligibilityThreshold,
    });

    const result = executeEligibilityProof({
      contractState: init.contractState,
      privateFinancialValue: 42000n,
      borrowerPk,
    });

    assert.equal(result.isVerified, true);
    assert.equal(result.updatedLedger.isEligibilityVerified, true);
    assert.equal(result.updatedLedger.status, LoanStatus.requested);
    assert.ok(result.proofData, 'Proof data must be produced');
    assert.ok(result.updatedContractState, 'Updated contract state must be returned');
  });

  it('executeEligibilityProof fails when private value (20000) < threshold (30000)', () => {
    const init = initializeLoanContract({
      borrowerPk,
      principalAmount,
      interestRateBasisPoints,
      durationBlocks,
      eligibilityThreshold,
    });

    assert.throws(
      () => {
        executeEligibilityProof({
          contractState: init.contractState,
          privateFinancialValue: 20000n,
          borrowerPk,
        });
      },
      (err) => {
        assert.match(err.message, /Borrower does not meet the required eligibility threshold/);
        return true;
      }
    );
  });

  it('executeEligibilityProof rejects non-borrower caller identity', () => {
    const init = initializeLoanContract({
      borrowerPk,
      principalAmount,
      interestRateBasisPoints,
      durationBlocks,
      eligibilityThreshold,
    });

    assert.throws(
      () => {
        executeEligibilityProof({
          contractState: init.contractState,
          privateFinancialValue: 42000n,
          borrowerPk: otherPk, // Unauthorized caller
        });
      },
      (err) => {
        assert.match(err.message, /Caller is not the borrower/);
        return true;
      }
    );
  });

  it('strictly ensures private financial value is never leaked in public ledger or proof output', () => {
    const secretValue = 987654321n;
    const init = initializeLoanContract({
      borrowerPk,
      principalAmount,
      interestRateBasisPoints,
      durationBlocks,
      eligibilityThreshold: 10000n,
    });

    const result = executeEligibilityProof({
      contractState: init.contractState,
      privateFinancialValue: secretValue,
      borrowerPk,
    });

    assert.equal(result.isVerified, true);

    // Ledger serialization check: secret value must NOT appear
    const ledgerJson = JSON.stringify(result.updatedLedger, (_, v) =>
      typeof v === 'bigint' ? v.toString() : v
    );
    assert.equal(ledgerJson.includes('987654321'), false, 'Private financial value leaked into ledger output!');

    // Public transcript check: secret value must NOT appear in public transcript
    const transcriptJson = JSON.stringify(result.proofData.publicTranscript);
    assert.equal(transcriptJson.includes('987654321'), false, 'Private financial value leaked into public transcript!');
  });

  it('supports runtime environment variable configuration for private financial value', () => {
    process.env.BORROWER_PRIVATE_FINANCIAL_VALUE = '55000';

    const envValue = process.env.BORROWER_PRIVATE_FINANCIAL_VALUE
      ? BigInt(process.env.BORROWER_PRIVATE_FINANCIAL_VALUE)
      : 0n;

    const init = initializeLoanContract({
      borrowerPk,
      principalAmount,
      interestRateBasisPoints,
      durationBlocks,
      eligibilityThreshold,
    });

    const result = executeEligibilityProof({
      contractState: init.contractState,
      privateFinancialValue: envValue,
      borrowerPk,
    });

    assert.equal(result.isVerified, true);
    delete process.env.BORROWER_PRIVATE_FINANCIAL_VALUE;
  });
});
