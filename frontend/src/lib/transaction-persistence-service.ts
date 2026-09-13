import type {
  PersistedTransaction,
  TransactionPersistenceState,
} from '../types/transaction-persistence.ts';
import { TransactionPersistenceError } from '../types/transaction-persistence.ts';

/**
 * Storage interface for persisting transaction lifecycle records.
 * Follows the replaceable adapter pattern established by LoanRegistryPersistence.
 */
export interface TransactionPersistence {
  saveTransaction(tx: PersistedTransaction): void;
  getTransaction(id: string): PersistedTransaction | null;
  listTransactions(): PersistedTransaction[];
  updateTransaction(id: string, updates: Partial<PersistedTransaction>): PersistedTransaction;
  removeTransaction(id: string): boolean;
  clearTransactions(): void;
  recoverTransactions(): PersistedTransaction[];
}

/**
 * In-memory transaction persistence adapter.
 * Default for testing, Node.js environments, and non-browser runtimes.
 */
export class InMemoryTransactionPersistence implements TransactionPersistence {
  private records: Map<string, PersistedTransaction> = new Map();

  saveTransaction(tx: PersistedTransaction): void {
    this.records.set(tx.id, { ...tx });
  }

  getTransaction(id: string): PersistedTransaction | null {
    const record = this.records.get(id);
    if (!record) return null;
    return { ...record };
  }

  listTransactions(): PersistedTransaction[] {
    return Array.from(this.records.values())
      .map((r) => ({ ...r }))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  updateTransaction(id: string, updates: Partial<PersistedTransaction>): PersistedTransaction {
    const existing = this.records.get(id);
    if (!existing) {
      throw new TransactionPersistenceError(
        'TRANSACTION_NOT_FOUND',
        `Cannot update non-existent transaction ${id}`,
        { transactionId: id }
      );
    }
    const updated: PersistedTransaction = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };
    this.records.set(id, updated);
    return { ...updated };
  }

  removeTransaction(id: string): boolean {
    return this.records.delete(id);
  }

  clearTransactions(): void {
    this.records.clear();
  }

  recoverTransactions(): PersistedTransaction[] {
    return this.listTransactions();
  }
}

export const TRANSACTION_STORAGE_KEY = 'midnight_confidential_p2p_transactions_v1';

/**
 * LocalStorage transaction persistence adapter with safe BigInt / Uint8Array serialization
 * and fault-tolerant corrupted storage recovery.
 *
 * STRICT PRIVACY REQUIREMENT:
 * Only public transaction metadata is serialized.
 * Operates strictly on public agreement identifiers and caller identities.
 */
export class LocalStorageTransactionPersistence implements TransactionPersistence {
  private inMemoryFallback: InMemoryTransactionPersistence = new InMemoryTransactionPersistence();

  private isAvailable(): boolean {
    try {
      return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
    } catch {
      return false;
    }
  }

  private loadRaw(): Record<string, PersistedTransaction> {
    if (!this.isAvailable()) {
      const inMem = this.inMemoryFallback.listTransactions();
      const map: Record<string, PersistedTransaction> = {};
      for (const tx of inMem) {
        map[tx.id] = tx;
      }
      return map;
    }

    try {
      const storage = window.localStorage;
      const raw = storage.getItem(TRANSACTION_STORAGE_KEY);
      if (!raw) return {};

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (parseErr) {
        // Corrupted JSON in localStorage: recover gracefully without crashing
        console.warn('Corrupted transaction storage detected, initializing empty state.', parseErr);
        return {};
      }

      if (!parsed || typeof parsed !== 'object') {
        return {};
      }

      const state = parsed as any;
      const transactions = state.transactions || state;
      const result: Record<string, PersistedTransaction> = {};

      for (const [id, item] of Object.entries(transactions)) {
        if (!item || typeof item !== 'object') continue;
        try {
          const anyItem = item as any;
          result[id] = {
            id: String(anyItem.id || id),
            action: anyItem.action,
            loanId: String(anyItem.loanId || ''),
            circuitName: String(anyItem.circuitName || ''),
            callerPublicKeyHex: anyItem.callerPublicKeyHex ?? null,
            callerPublicKey: anyItem.callerPublicKey
              ? new Uint8Array(anyItem.callerPublicKey)
              : null,
            networkId: String(anyItem.networkId || 'unknown'),
            providerKind: String(anyItem.providerKind || 'UNKNOWN'),
            status: anyItem.status,
            recoveryStatus: anyItem.recoveryStatus || 'RECOVERABLE',
            providerTransactionId: anyItem.providerTransactionId,
            blockHeight: anyItem.blockHeight !== undefined && anyItem.blockHeight !== null
              ? BigInt(anyItem.blockHeight)
              : undefined,
            amount: anyItem.amount !== undefined && anyItem.amount !== null
              ? BigInt(anyItem.amount)
              : undefined,
            interestRateBps: anyItem.interestRateBps !== undefined && anyItem.interestRateBps !== null
              ? BigInt(anyItem.interestRateBps)
              : undefined,
            durationBlocks: anyItem.durationBlocks !== undefined && anyItem.durationBlocks !== null
              ? BigInt(anyItem.durationBlocks)
              : undefined,
            createdAt: Number(anyItem.createdAt || Date.now()),
            updatedAt: Number(anyItem.updatedAt || Date.now()),
            reconciledAt: anyItem.reconciledAt ? Number(anyItem.reconciledAt) : undefined,
            error: anyItem.error,
            errorCode: anyItem.errorCode,
            metadata: anyItem.metadata,
          };
        } catch {
          // Skip individually corrupted transaction record rather than failing the whole set
          continue;
        }
      }

      return result;
    } catch {
      return {};
    }
  }

  private saveRaw(transactions: Record<string, PersistedTransaction>): void {
    if (!this.isAvailable()) {
      this.inMemoryFallback.clearTransactions();
      for (const tx of Object.values(transactions)) {
        this.inMemoryFallback.saveTransaction(tx);
      }
      return;
    }

    try {
      const state: TransactionPersistenceState = {
        version: '1.0.0',
        lastSavedAt: Date.now(),
        transactions,
      };

      const serialized = JSON.stringify(state, (_key, value) => {
        if (typeof value === 'bigint') {
          return value.toString();
        }
        if (value instanceof Uint8Array) {
          return Array.from(value);
        }
        return value;
      });

      const storage = window.localStorage;
      storage[TRANSACTION_STORAGE_KEY] = serialized;
    } catch (err: unknown) {
      // Storage quota or permission error fallback
      this.inMemoryFallback.clearTransactions();
      for (const tx of Object.values(transactions)) {
        this.inMemoryFallback.saveTransaction(tx);
      }
    }
  }

  saveTransaction(tx: PersistedTransaction): void {
    const raw = this.loadRaw();
    raw[tx.id] = { ...tx };
    this.saveRaw(raw);
  }

  getTransaction(id: string): PersistedTransaction | null {
    const raw = this.loadRaw();
    const found = raw[id];
    return found ? { ...found } : null;
  }

  listTransactions(): PersistedTransaction[] {
    const raw = this.loadRaw();
    return Object.values(raw).sort((a, b) => b.createdAt - a.createdAt);
  }

  updateTransaction(id: string, updates: Partial<PersistedTransaction>): PersistedTransaction {
    const raw = this.loadRaw();
    const existing = raw[id];
    if (!existing) {
      throw new TransactionPersistenceError(
        'TRANSACTION_NOT_FOUND',
        `Cannot update non-existent transaction ${id}`,
        { transactionId: id }
      );
    }

    const updated: PersistedTransaction = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };
    raw[id] = updated;
    this.saveRaw(raw);
    return { ...updated };
  }

  removeTransaction(id: string): boolean {
    const raw = this.loadRaw();
    if (!raw[id]) return false;
    delete raw[id];
    this.saveRaw(raw);
    return true;
  }

  clearTransactions(): void {
    if (this.isAvailable()) {
      try {
        const storage = window.localStorage;
        delete storage[TRANSACTION_STORAGE_KEY];
        if (typeof storage.removeItem === 'function') {
          storage.removeItem(TRANSACTION_STORAGE_KEY);
        }
      } catch {
        // Fallback
      }
    }
    this.inMemoryFallback.clearTransactions();
  }

  recoverTransactions(): PersistedTransaction[] {
    return this.listTransactions();
  }
}

/**
 * Service encapsulating transaction persistence operations across the application.
 */
export class TransactionPersistenceService implements TransactionPersistence {
  private adapter: TransactionPersistence;

  constructor(adapter?: TransactionPersistence) {
    this.adapter = adapter ?? new LocalStorageTransactionPersistence();
  }

  setAdapter(adapter: TransactionPersistence): void {
    this.adapter = adapter;
  }

  getAdapter(): TransactionPersistence {
    return this.adapter;
  }

  saveTransaction(tx: PersistedTransaction): void {
    this.adapter.saveTransaction(tx);
  }

  getTransaction(id: string): PersistedTransaction | null {
    return this.adapter.getTransaction(id);
  }

  listTransactions(): PersistedTransaction[] {
    return this.adapter.listTransactions();
  }

  updateTransaction(id: string, updates: Partial<PersistedTransaction>): PersistedTransaction {
    return this.adapter.updateTransaction(id, updates);
  }

  removeTransaction(id: string): boolean {
    return this.adapter.removeTransaction(id);
  }

  clearTransactions(): void {
    this.adapter.clearTransactions();
  }

  recoverTransactions(): PersistedTransaction[] {
    return this.adapter.recoverTransactions();
  }
}

let globalPersistenceService: TransactionPersistenceService | null = null;

/**
 * Returns the singleton TransactionPersistenceService instance.
 */
export function getTransactionPersistenceService(
  adapter?: TransactionPersistence
): TransactionPersistenceService {
  if (!globalPersistenceService || adapter) {
    globalPersistenceService = new TransactionPersistenceService(adapter);
  }
  return globalPersistenceService;
}

/**
 * Resets the global persistence service (useful for test isolation).
 */
export function resetTransactionPersistenceService(
  adapter?: TransactionPersistence
): TransactionPersistenceService {
  globalPersistenceService = new TransactionPersistenceService(
    adapter ?? new InMemoryTransactionPersistence()
  );
  return globalPersistenceService;
}
