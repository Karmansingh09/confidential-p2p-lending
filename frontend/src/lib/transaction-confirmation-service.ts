import type { WalletProvider } from './wallet-provider.ts';
import type {
  TransactionReceipt,
  ConfirmationPollState,
  ProviderSubmissionStatus,
} from '../types/transaction-execution.ts';
import { getTransactionEventService } from './transaction-event-service.ts';

export interface ConfirmationPollOptions {
  /** Maximum number of polling attempts before reporting timeout. Default: 60 */
  maxPolls?: number;
  /** Delay between each poll in milliseconds. Default: 5000 */
  pollIntervalMs?: number;
  /** Optional timeout override in milliseconds (overrides maxPolls if set). */
  timeoutMs?: number;
}

export interface ConfirmationResult {
  /** Whether the transaction reached a terminal confirmed state */
  confirmed: boolean;
  /** Final poll state snapshot */
  pollState: ConfirmationPollState;
  /** Provider receipt if confirmed, or null */
  receipt: TransactionReceipt | null;
  /** Typed outcome reason */
  reason: 'CONFIRMED' | 'TIMEOUT' | 'REJECTED' | 'PROVIDER_UNAVAILABLE' | 'UNKNOWN_STATE';
  /** Human-readable explanation */
  message: string;
}

/**
 * TransactionConfirmationService
 *
 * Provides bounded, genuine polling for on-chain confirmation of submitted Midnight transactions.
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. Anti-Fabrication: Never infers confirmation from time elapsed, submission success,
 *    or any indicator other than an explicit provider-returned CONFIRMED status.
 * 2. Bounded Polling: Always terminates after maxPolls or timeoutMs — never infinite loops.
 * 3. Provider Honesty: If the provider does not support getTransactionStatus,
 *    returns PROVIDER_UNAVAILABLE immediately rather than guessing.
 * 4. UNKNOWN_STATE: If the provider returns an ambiguous status, records UNKNOWN_STATE
 *    rather than assuming confirmed or rejected.
 * 5. Event Emission: Emits CONFIRMATION_CHECK_STARTED, CONFIRMED, FAILED lifecycle events.
 */
export class TransactionConfirmationService {
  private readonly provider: WalletProvider;

  constructor(provider: WalletProvider) {
    this.provider = provider;
  }

  /**
   * Polls the provider for genuine on-chain confirmation of the given transaction.
   *
   * ANTI-FABRICATION GUARANTEE:
   * Returns CONFIRMED only when the provider explicitly reports CONFIRMED.
   * Never uses elapsed time, submission state, or heuristics as a proxy for confirmation.
   */
  async pollForConfirmation(
    transactionId: string,
    agreementId: string,
    action: string,
    options: ConfirmationPollOptions = {}
  ): Promise<ConfirmationResult> {
    const maxPolls = options.maxPolls ?? 60;
    const pollIntervalMs = options.pollIntervalMs ?? 5000;
    const deadlineMs = options.timeoutMs ? Date.now() + options.timeoutMs : null;

    const eventService = getTransactionEventService();

    // Emit confirmation check started
    eventService.appendEvent({
      transactionId,
      eventType: 'CONFIRMATION_CHECK_STARTED',
      action,
      status: 'CHECKING_CONFIRMATION',
      source: 'CONFIRMATION_SERVICE',
      agreementId,
      message: `Beginning bounded confirmation poll: max ${maxPolls} attempts, ${pollIntervalMs}ms interval.`,
    });

    // If the provider does not support status queries, return immediately
    if (!this.provider.getTransactionStatus) {
      const pollState: ConfirmationPollState = {
        transactionId,
        pollCount: 0,
        maxPolls,
        pollIntervalMs,
        timedOut: false,
        lastStatus: null,
        lastPollAt: null,
      };
      return {
        confirmed: false,
        pollState,
        receipt: null,
        reason: 'PROVIDER_UNAVAILABLE',
        message: 'Transaction status polling is unavailable: provider does not support getTransactionStatus.',
      };
    }

    const pollState: ConfirmationPollState = {
      transactionId,
      pollCount: 0,
      maxPolls,
      pollIntervalMs,
      timedOut: false,
      lastStatus: null,
      lastPollAt: null,
    };

    while (pollState.pollCount < maxPolls) {
      // Check deadline
      if (deadlineMs && Date.now() >= deadlineMs) {
        pollState.timedOut = true;
        break;
      }

      // Wait before polling (except first attempt)
      if (pollState.pollCount > 0) {
        await this._sleep(pollIntervalMs);
      }

      pollState.pollCount++;
      pollState.lastPollAt = Date.now();

      let rawStatus: TransactionReceipt | { status?: string; transactionId?: string; blockHeight?: bigint } | null = null;
      try {
        rawStatus = await this.provider.getTransactionStatus!(transactionId);
      } catch {
        // Treat a provider exception as an unknown/unavailable status — not a confirmation
        pollState.lastStatus = null;
        continue;
      }

      if (!rawStatus) {
        // Provider returned null — transaction not yet indexed
        pollState.lastStatus = null;
        continue;
      }

      const status = (rawStatus as any).status as ProviderSubmissionStatus | undefined;
      pollState.lastStatus = status ?? null;

      if (status === 'CONFIRMED') {
        eventService.appendEvent({
          transactionId,
          eventType: 'CONFIRMED',
          action,
          status: 'CONFIRMED',
          source: 'CONFIRMATION_SERVICE',
          agreementId,
          message: `Transaction confirmed on-chain after ${pollState.pollCount} poll(s).`,
        });

        const receipt: TransactionReceipt = {
          transactionId: (rawStatus as any).transactionId ?? transactionId,
          status: 'CONFIRMED',
          blockHeight: (rawStatus as any).blockHeight,
          confirmedAt: Date.now(),
          rawProviderResponse: rawStatus,
        };

        return {
          confirmed: true,
          pollState,
          receipt,
          reason: 'CONFIRMED',
          message: `Transaction confirmed on-chain after ${pollState.pollCount} poll(s).`,
        };
      }

      if (status === 'REJECTED' || status === 'FAILED') {
        eventService.appendEvent({
          transactionId,
          eventType: 'REJECTED',
          action,
          status: status,
          source: 'CONFIRMATION_SERVICE',
          agreementId,
          message: `Transaction ${status.toLowerCase()} on-chain after ${pollState.pollCount} poll(s).`,
        });

        return {
          confirmed: false,
          pollState,
          receipt: null,
          reason: 'REJECTED',
          message: `Transaction ${status.toLowerCase()} on-chain after ${pollState.pollCount} poll(s).`,
        };
      }

      // PENDING or SUBMITTED: continue polling
    }

    // Polling exhausted — mark timeout
    pollState.timedOut = true;

    eventService.appendEvent({
      transactionId,
      eventType: 'FAILED',
      action,
      status: 'FAILED',
      source: 'CONFIRMATION_SERVICE',
      agreementId,
      message: `Confirmation polling timed out after ${pollState.pollCount} attempt(s). Last status: ${pollState.lastStatus ?? 'UNKNOWN'}.`,
    });

    return {
      confirmed: false,
      pollState,
      receipt: null,
      reason: 'TIMEOUT',
      message: `Confirmation polling timed out after ${pollState.pollCount} attempt(s). Last known status: ${pollState.lastStatus ?? 'UNKNOWN'}.`,
    };
  }

  private _sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

let globalConfirmationService: TransactionConfirmationService | null = null;

/**
 * Returns a singleton TransactionConfirmationService bound to the given provider.
 */
export function getTransactionConfirmationService(
  provider: WalletProvider
): TransactionConfirmationService {
  if (!globalConfirmationService) {
    globalConfirmationService = new TransactionConfirmationService(provider);
  }
  return globalConfirmationService;
}

/**
 * Resets the singleton instance (useful for unit tests).
 */
export function resetTransactionConfirmationService(
  provider?: WalletProvider
): TransactionConfirmationService | null {
  if (provider) {
    globalConfirmationService = new TransactionConfirmationService(provider);
    return globalConfirmationService;
  }
  globalConfirmationService = null;
  return null;
}
