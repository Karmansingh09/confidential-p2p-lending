import type { LoanDetailsModel } from '../types/index.js';
import type { LoanRegistryPersistence } from '../types/application-state.ts';
import { LoanRegistry } from './loan-registry.ts';
import { MOCK_LOANS } from './mock-data.js';

/**
 * In-memory persistence adapter. Default for testing and non-browser runtimes.
 */
export class InMemoryLoanRegistryPersistence implements LoanRegistryPersistence {
  private data: Record<string, LoanDetailsModel> | null = null;

  load(): Record<string, LoanDetailsModel> | null {
    if (!this.data) return null;
    return { ...this.data };
  }

  save(loans: Record<string, LoanDetailsModel>): void {
    this.data = { ...loans };
  }

  clear(): void {
    this.data = null;
  }
}

const STORAGE_KEY = 'midnight_confidential_p2p_loan_registry_v1';

/**
 * Browser LocalStorage persistence adapter.
 * STRICT PRIVACY REQUIREMENT:
 * Only public LoanDetailsModel metadata is serialized.
 * Zero confidential underwriting credentials, witnesses, or signing keys are persisted.
 */
export class LocalStorageLoanRegistryPersistence implements LoanRegistryPersistence {
  private inMemoryFallback: InMemoryLoanRegistryPersistence =
    new InMemoryLoanRegistryPersistence();

  private isAvailable(): boolean {
    try {
      return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
    } catch {
      return false;
    }
  }

  load(): Record<string, LoanDetailsModel> | null {
    if (!this.isAvailable()) {
      return this.inMemoryFallback.load();
    }

    try {
      const storage = window.localStorage;
      if (!storage) return null;
      const raw = storage[STORAGE_KEY] as string | undefined;
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      const result: Record<string, LoanDetailsModel> = {};

      for (const [id, item] of Object.entries(parsed)) {
        const anyItem = item as any;
        result[id] = {
          borrower: anyItem.borrower,
          borrowerBytes: new Uint8Array(anyItem.borrowerBytes || []),
          lender: anyItem.lender ?? null,
          lenderBytes: anyItem.lenderBytes ? new Uint8Array(anyItem.lenderBytes) : null,
          amount: BigInt(anyItem.amount),
          interestRateBasisPoints: BigInt(anyItem.interestRateBasisPoints),
          durationBlocks: BigInt(anyItem.durationBlocks),
          status: Number(anyItem.status),
          statusText: anyItem.statusText,
          eligibilityThreshold: BigInt(anyItem.eligibilityThreshold),
          isEligibilityVerified: Boolean(anyItem.isEligibilityVerified),
        };
      }

      return result;
    } catch {
      return null;
    }
  }

  save(loans: Record<string, LoanDetailsModel>): void {
    if (!this.isAvailable()) {
      this.inMemoryFallback.save(loans);
      return;
    }

    try {
      const serialized = JSON.stringify(loans, (key, value) => {
        if (typeof value === 'bigint') {
          return value.toString();
        }
        if (value instanceof Uint8Array) {
          return Array.from(value);
        }
        return value;
      });
      const storage = window.localStorage;
      storage[STORAGE_KEY] = serialized;
    } catch {
      this.inMemoryFallback.save(loans);
    }
  }

  clear(): void {
    if (this.isAvailable()) {
      try {
        const storage = window.localStorage;
        delete storage[STORAGE_KEY];
      } catch {
        // Fallback
      }
    }
    this.inMemoryFallback.clear();
  }
}

/**
 * Creates the default loan registry with mock loans.
 */
export function createDefaultLoanRegistry(
  persistence: LoanRegistryPersistence = new InMemoryLoanRegistryPersistence()
): LoanRegistry {
  return new LoanRegistry(MOCK_LOANS, undefined, undefined, persistence);
}
