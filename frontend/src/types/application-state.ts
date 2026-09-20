import type { LoanDetailsModel } from './index.ts';

/**
 * Standard error codes for loan registry operations.
 */
export type LoanRegistryErrorCode =
  | 'DUPLICATE_LOAN_ID'
  | 'LOAN_NOT_FOUND'
  | 'INVALID_TRANSITION'
  | 'ALREADY_SETTLED'
  | 'IMMUTABLE_TERM_MUTATION'
  | 'UNAUTHORIZED_ACTION'
  | 'INVALID_INITIAL_STATE';

/**
 * Typed domain error representing a failed registry operation or forbidden transition.
 */
export class LoanRegistryError extends Error {
  readonly code: LoanRegistryErrorCode;

  constructor(code: LoanRegistryErrorCode, message: string) {
    super(message);
    this.name = 'LoanRegistryError';
    this.code = code;
    Object.setPrototypeOf(this, LoanRegistryError.prototype);
  }
}

/**
 * State snapshot of the centralized loan registry.
 */
export interface LoanRegistryState {
  loans: Record<string, LoanDetailsModel>;
  orderedIds: string[];
  selectedLoanId: string;
  lastUpdated: number;
}

/**
 * Clean persistence adapter boundary for local agreement storage.
 * STRICT PRIVACY REQUIREMENT:
 * Adapters must persist ONLY public LoanDetailsModel records.
 * No ephemeral witnesses, financial credentials, or signing keys are ever stored.
 */
export interface LoanRegistryPersistence {
  load(): Record<string, LoanDetailsModel> | null;
  save(loans: Record<string, LoanDetailsModel>): void;
  clear(): void;
}

/**
 * Aggregated category counts for marketplace filtering and badge indicators.
 */
export interface LoanRegistryFilterCounts {
  all: number;
  requested: number;
  verified: number;
  funded: number;
  repaid: number;
  settled: number;
}
