import {
  LoanStatus,
  type LoanDetailsModel,
} from '../types/index.ts';
import {
  LoanRegistryError,
  type LoanRegistryState,
  type LoanRegistryPersistence,
  type LoanRegistryFilterCounts,
} from '../types/application-state.ts';
import {
  areByteArraysEqual,
  canVerifyEligibility,
  canFundLoan,
  canRepayLoan,
  canSettleLoan,
} from 'contracts';
import { MOCK_LOANS } from './mock-data.ts';

function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validates that a lifecycle transition between two loan statuses is permitted.
 */
export function validateLifecycleTransition(
  prev: LoanDetailsModel,
  next: LoanDetailsModel
): void {
  // If status did not change, check verification change
  if (prev.status === next.status) {
    if (prev.status === LoanStatus.requested) {
      // Transition from unverified to verified is valid
      if (!prev.isEligibilityVerified && next.isEligibilityVerified) {
        return;
      }
      // Reverting from verified to unverified is invalid
      if (prev.isEligibilityVerified && !next.isEligibilityVerified) {
        throw new LoanRegistryError(
          'INVALID_TRANSITION',
          'Cannot revert verified loan to unverified state'
        );
      }
    }
    return;
  }

  // 1. Terminal state protection: settled loans can never transition to any other state
  if (prev.status === LoanStatus.settled) {
    throw new LoanRegistryError(
      'ALREADY_SETTLED',
      'Settled agreements represent terminal protocol closure and cannot be modified'
    );
  }

  // 2. requested -> funded (requires verification first)
  if (prev.status === LoanStatus.requested && next.status === LoanStatus.funded) {
    if (!prev.isEligibilityVerified) {
      throw new LoanRegistryError(
        'INVALID_TRANSITION',
        'Cannot transition unverified requested loan directly to funded'
      );
    }
    if (!next.lenderBytes) {
      throw new LoanRegistryError(
        'INVALID_TRANSITION',
        'Funded loan must designate a valid lender public identity'
      );
    }
    return;
  }

  // 3. funded -> repaid
  if (prev.status === LoanStatus.funded && next.status === LoanStatus.repaid) {
    return;
  }

  // 4. repaid -> settled
  if (prev.status === LoanStatus.repaid && next.status === LoanStatus.settled) {
    return;
  }

  // All other state jumps are strictly invalid
  throw new LoanRegistryError(
    'INVALID_TRANSITION',
    `Invalid lifecycle transition: cannot transition loan from status ${prev.statusText} (${prev.status}) to ${next.statusText} (${next.status})`
  );
}

/**
 * Verifies that immutable loan terms were not modified during an update.
 */
export function assertImmutableTermsPreserved(
  prev: LoanDetailsModel,
  next: LoanDetailsModel
): void {
  if (prev.amount !== next.amount) {
    throw new LoanRegistryError(
      'IMMUTABLE_TERM_MUTATION',
      `Cannot mutate immutable loan principal amount: ${prev.amount} -> ${next.amount}`
    );
  }
  if (prev.interestRateBasisPoints !== next.interestRateBasisPoints) {
    throw new LoanRegistryError(
      'IMMUTABLE_TERM_MUTATION',
      `Cannot mutate immutable interest rate: ${prev.interestRateBasisPoints} -> ${next.interestRateBasisPoints}`
    );
  }
  if (prev.durationBlocks !== next.durationBlocks) {
    throw new LoanRegistryError(
      'IMMUTABLE_TERM_MUTATION',
      `Cannot mutate immutable loan duration: ${prev.durationBlocks} -> ${next.durationBlocks}`
    );
  }
  if (prev.eligibilityThreshold !== next.eligibilityThreshold) {
    throw new LoanRegistryError(
      'IMMUTABLE_TERM_MUTATION',
      `Cannot mutate immutable eligibility threshold: ${prev.eligibilityThreshold} -> ${next.eligibilityThreshold}`
    );
  }
  if (prev.borrower !== next.borrower || !areByteArraysEqual(prev.borrowerBytes, next.borrowerBytes)) {
    throw new LoanRegistryError(
      'IMMUTABLE_TERM_MUTATION',
      'Cannot mutate immutable borrower identity'
    );
  }
}

/**
 * Authoritative, immutable registry managing active loan agreements in the frontend.
 */
export class LoanRegistry {
  private readonly loans: Record<string, LoanDetailsModel>;
  private readonly orderedIds: string[];
  private readonly selectedLoanId: string;
  private readonly persistence?: LoanRegistryPersistence;

  constructor(
    initialLoans: Record<string, LoanDetailsModel> = MOCK_LOANS,
    selectedLoanId?: string,
    orderedIds?: string[],
    persistence?: LoanRegistryPersistence
  ) {
    this.persistence = persistence;
    const loaded = persistence?.load();
    const sourceLoans = loaded && Object.keys(loaded).length > 0 ? loaded : initialLoans;

    this.loans = { ...sourceLoans };
    this.orderedIds = orderedIds ? [...orderedIds] : Object.keys(this.loans);
    this.selectedLoanId =
      selectedLoanId && this.loans[selectedLoanId]
        ? selectedLoanId
        : this.orderedIds[0] ?? 'loan-001';

    if (persistence && (!loaded || Object.keys(loaded).length === 0)) {
      persistence.save(this.loans);
    }
  }

  /**
   * Returns a copy of all active loans in the registry.
   */
  getLoans(): Record<string, LoanDetailsModel> {
    return { ...this.loans };
  }

  /**
   * Retrieves a single loan agreement by ID.
   */
  getLoan(loanId: string): LoanDetailsModel | undefined {
    return this.loans[loanId];
  }

  /**
   * Returns loan IDs in deterministic insertion order.
   */
  getOrderedLoanIds(): string[] {
    return [...this.orderedIds];
  }

  /**
   * Returns loan items in deterministic order.
   */
  getOrderedLoans(): Array<{ id: string; loan: LoanDetailsModel }> {
    return this.orderedIds
      .filter((id) => Boolean(this.loans[id]))
      .map((id) => ({ id, loan: this.loans[id] }));
  }

  /**
   * Returns the currently selected loan ID.
   */
  getSelectedLoanId(): string {
    return this.selectedLoanId;
  }

  /**
   * Returns the currently selected loan model.
   */
  getSelectedLoan(): LoanDetailsModel | undefined {
    return this.loans[this.selectedLoanId];
  }

  /**
   * Produces a full state snapshot.
   */
  getState(): LoanRegistryState {
    return {
      loans: { ...this.loans },
      orderedIds: [...this.orderedIds],
      selectedLoanId: this.selectedLoanId,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Selects a loan ID and returns an updated registry instance.
   */
  selectLoan(loanId: string): LoanRegistry {
    if (!this.loans[loanId]) {
      return this;
    }
    return new LoanRegistry(
      this.loans,
      loanId,
      this.orderedIds,
      this.persistence
    );
  }

  /**
   * Inserts a newly created loan agreement into the registry.
   */
  addLoan(loanId: string, loan: LoanDetailsModel): LoanRegistry {
    if (this.loans[loanId]) {
      throw new LoanRegistryError(
        'DUPLICATE_LOAN_ID',
        `Loan agreement with identifier ${loanId} already exists in registry`
      );
    }

    if (
      loan.status !== LoanStatus.requested ||
      loan.isEligibilityVerified ||
      loan.lender !== null ||
      loan.lenderBytes !== null
    ) {
      throw new LoanRegistryError(
        'INVALID_INITIAL_STATE',
        'New loan requests must begin in unverified requested status without assigned lender'
      );
    }

    const updatedLoans = {
      ...this.loans,
      [loanId]: { ...loan },
    };
    const updatedIds = [...this.orderedIds, loanId];

    if (this.persistence) {
      this.persistence.save(updatedLoans);
    }

    return new LoanRegistry(
      updatedLoans,
      loanId, // Automatically select the newly created loan
      updatedIds,
      this.persistence
    );
  }

  /**
   * Immutably updates an existing agreement with full term preservation and transition checks.
   */
  updateLoan(
    loanId: string,
    updater: (prev: LoanDetailsModel) => LoanDetailsModel
  ): LoanRegistry {
    const prev = this.loans[loanId];
    if (!prev) {
      throw new LoanRegistryError(
        'LOAN_NOT_FOUND',
        `Loan agreement ${loanId} was not found in registry`
      );
    }

    const next = updater(prev);
    assertImmutableTermsPreserved(prev, next);
    validateLifecycleTransition(prev, next);

    const updatedLoans = {
      ...this.loans,
      [loanId]: { ...next },
    };

    if (this.persistence) {
      this.persistence.save(updatedLoans);
    }

    return new LoanRegistry(
      updatedLoans,
      this.selectedLoanId,
      this.orderedIds,
      this.persistence
    );
  }

  /**
   * Replaces an existing loan agreement with an updated model.
   */
  replaceLoan(loanId: string, updatedLoan: LoanDetailsModel): LoanRegistry {
    return this.updateLoan(loanId, () => updatedLoan);
  }

  /**
   * Canonical transition: Borrower marks eligibility verified.
   */
  verifyLoanEligibility(loanId: string, callerPk?: Uint8Array): LoanRegistry {
    return this.updateLoan(loanId, (prev) => {
      const guard = canVerifyEligibility(prev, callerPk);
      if (!guard.canExecute) {
        throw new LoanRegistryError(
          'UNAUTHORIZED_ACTION',
          guard.reason ?? 'Cannot verify borrower eligibility'
        );
      }
      return {
        ...prev,
        isEligibilityVerified: true,
      };
    });
  }

  /**
   * Canonical transition: Lender commits capital to fund the agreement.
   */
  fundLoan(loanId: string, lenderPk: Uint8Array, callerPk?: Uint8Array): LoanRegistry {
    return this.updateLoan(loanId, (prev) => {
      const guard = canFundLoan(prev, callerPk ?? lenderPk);
      if (!guard.canExecute) {
        throw new LoanRegistryError(
          'UNAUTHORIZED_ACTION',
          guard.reason ?? 'Cannot fund loan agreement'
        );
      }
      return {
        ...prev,
        status: LoanStatus.funded,
        statusText: 'funded',
        lender: bytesToHex(lenderPk),
        lenderBytes: lenderPk,
      };
    });
  }

  /**
   * Canonical transition: Borrower satisfies repayment obligation.
   */
  repayLoan(loanId: string, callerPk?: Uint8Array): LoanRegistry {
    return this.updateLoan(loanId, (prev) => {
      const guard = canRepayLoan(prev, callerPk);
      if (!guard.canExecute) {
        throw new LoanRegistryError(
          'UNAUTHORIZED_ACTION',
          guard.reason ?? 'Cannot repay loan agreement'
        );
      }
      return {
        ...prev,
        status: LoanStatus.repaid,
        statusText: 'repaid',
      };
    });
  }

  /**
   * Canonical transition: Participant concludes agreement in terminal settlement.
   */
  settleLoan(loanId: string, callerPk?: Uint8Array): LoanRegistry {
    return this.updateLoan(loanId, (prev) => {
      const guard = canSettleLoan(prev, callerPk);
      if (!guard.canExecute) {
        throw new LoanRegistryError(
          'UNAUTHORIZED_ACTION',
          guard.reason ?? 'Cannot settle loan agreement'
        );
      }
      return {
        ...prev,
        status: LoanStatus.settled,
        statusText: 'settled',
      };
    });
  }

  /**
   * Computes category counts for marketplace filters.
   */
  getFilterCounts(): LoanRegistryFilterCounts {
    const counts: LoanRegistryFilterCounts = {
      all: 0,
      requested: 0,
      verified: 0,
      funded: 0,
      repaid: 0,
      settled: 0,
    };

    for (const loan of Object.values(this.loans)) {
      counts.all += 1;
      if (loan.status === LoanStatus.requested && !loan.isEligibilityVerified) {
        counts.requested += 1;
      } else if (loan.status === LoanStatus.requested && loan.isEligibilityVerified) {
        counts.verified += 1;
      } else if (loan.status === LoanStatus.funded) {
        counts.funded += 1;
      } else if (loan.status === LoanStatus.repaid) {
        counts.repaid += 1;
      } else if (loan.status === LoanStatus.settled) {
        counts.settled += 1;
      }
    }

    return counts;
  }

  /**
   * Returns whether the given loan is confirmed on the real Midnight ledger.
   */
  isConfirmedOnChain(loanId: string): boolean {
    return this.loans[loanId]?.isConfirmedOnChain === true;
  }

  /**
   * Returns true if any active loans in the registry are unconfirmed prototype/demo records.
   */
  hasUnconfirmedMockLoans(): boolean {
    return Object.values(this.loans).some((loan) => loan.isConfirmedOnChain !== true);
  }
}
