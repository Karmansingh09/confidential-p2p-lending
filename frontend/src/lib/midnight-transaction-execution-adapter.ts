import type { WalletProvider } from './wallet-provider.ts';
import type {
  TransactionExecutionRequest,
  TransactionExecutionResult,
  TransactionExecutionStage,
  TransactionExecutionMode,
  TransactionReceipt,
  ConfirmationPollState,
  TransactionExecutionErrorCode,
} from '../types/transaction-execution.ts';
import type {
  TransactionSigningRequest,
  TransactionStatusResult,
} from '../types/transaction-request.ts';
import type { LoanRegistry } from './loan-registry.ts';
import { getTransactionEventService } from './transaction-event-service.ts';
import { getNetworkConfigService } from './network-config-service.ts';
import { evaluateNetworkCompatibility } from './wallet-network-compatibility.ts';

/**
 * Circuit classification discriminator.
 * LOCAL_PROOF: verifyEligibility — client-side ZK only, NO wallet lifecycle.
 * STATE_READ: getLoanStatus / getLoanDetails — read-only, NO wallet lifecycle.
 * TRANSACTION_EXECUTION: fundLoan / repayLoan / settleLoan — full signing → submission → confirmation.
 */
type CircuitClass = 'LOCAL_PROOF' | 'STATE_READ' | 'TRANSACTION_EXECUTION';

function classifyCircuit(circuitName: string): CircuitClass {
  if (circuitName === 'verifyEligibility') return 'LOCAL_PROOF';
  if (circuitName === 'getLoanStatus' || circuitName === 'getLoanDetails') return 'STATE_READ';
  return 'TRANSACTION_EXECUTION';
}

/**
 * Resolves execution mode from the active provider.
 */
function resolveExecutionMode(provider: WalletProvider): TransactionExecutionMode {
  if (provider.isPrototype) return 'PROTOTYPE_LOCAL';
  if (
    typeof (provider as any).getDetectionStatus === 'function' &&
    ((provider as any).getDetectionStatus() === 'NOT_DETECTED' ||
      (provider as any).getDetectionStatus() === 'UNSUPPORTED')
  ) {
    return 'ADAPTER_UNSUPPORTED';
  }
  if (provider.submitTransaction) return 'LIVE_WALLET';
  return 'UNKNOWN';
}

/**
 * MidnightTransactionExecutionAdapter
 *
 * Production-grade adapter routing validated invocations through the Midnight/Lace
 * wallet boundary and returning authentic provider IDs from genuine API calls.
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. Anti-Fabrication: Never generates fake transaction IDs, hashes, block heights,
 *    signatures, or confirmation states.
 * 2. Honest Degradation: Returns typed UNSUPPORTED/UNAVAILABLE when live Midnight SDK
 *    is not integrated. Never pretends execution succeeded.
 * 3. Circuit Classification: LOCAL_PROOF and STATE_READ circuits bypass signing/submission.
 * 4. Registry Safety: LoanRegistry is NEVER mutated unless provider confirms the transaction.
 * 5. Event Emission: Emits SIGNING_STARTED, SIGNED, SUBMISSION_STARTED, SUBMITTED,
 *    CONFIRMATION_CHECK_STARTED, CONFIRMED, REJECTED, FAILED lifecycle events.
 */
export class MidnightTransactionExecutionAdapter {
  private readonly provider: WalletProvider;

  constructor(provider: WalletProvider) {
    this.provider = provider;
  }

  /**
   * Returns the current execution mode without executing any transaction.
   */
  getExecutionMode(): TransactionExecutionMode {
    return resolveExecutionMode(this.provider);
  }

  /**
   * Executes a validated invocation through the wallet provider boundary.
   *
   * Returns a fully typed result with honest status.
   * Never fabricates any blockchain outputs.
   */
  async execute(
    request: TransactionExecutionRequest,
    loanRegistry?: LoanRegistry
  ): Promise<{ result: TransactionExecutionResult; updatedRegistry?: LoanRegistry }> {
    const { action, loanId } = request;
    const circuitName = request.circuitName ?? this._circuitNameForAction(action);
    const circuitClass = classifyCircuit(circuitName);
    const executionMode = resolveExecutionMode(this.provider);

    const eventService = getTransactionEventService();
    const txId = `adapter-${loanId}-${Date.now()}`;

    // -------------------------------------------------------------------------
    // Stage 1: Network Configuration Gate
    // -------------------------------------------------------------------------
    const netConfig = getNetworkConfigService().getNetworkConfig();
    const stage1: TransactionExecutionStage = 'NETWORK_CONFIG_VALIDATION';

    if (
      netConfig.status !== 'CONFIGURED' &&
      netConfig.environment !== 'LOCAL'
    ) {
      return {
        result: this._blocked(
          action, circuitName, loanId,
          'Adapter blocked: Network configuration is not configured or invalid.',
          'NETWORK_ERROR',
          stage1,
          executionMode
        ),
      };
    }

    // -------------------------------------------------------------------------
    // Stage 2: Network Compatibility Gate (non-LOCAL environments)
    // -------------------------------------------------------------------------
    const stage2: TransactionExecutionStage = 'NETWORK_COMPATIBILITY_CHECK';
    if (netConfig.environment !== 'LOCAL') {
      const walletNetwork =
        typeof (this.provider as any).getReportedNetworkId === 'function'
          ? (this.provider as any).getReportedNetworkId()
          : null;
      const comp = evaluateNetworkCompatibility(netConfig, walletNetwork);
      if (comp.compatibility === 'MISMATCH') {
        return {
          result: this._blocked(
            action, circuitName, loanId,
            `Adapter blocked: Network mismatch — ${comp.reason}`,
            'NETWORK_MISMATCH',
            stage2,
            executionMode
          ),
        };
      }
      if (comp.compatibility === 'UNKNOWN') {
        return {
          result: this._blocked(
            action, circuitName, loanId,
            'Adapter blocked: Wallet network cannot be verified.',
            'UNKNOWN_WALLET_NETWORK',
            stage2,
            executionMode
          ),
        };
      }
    }

    // -------------------------------------------------------------------------
    // Stage 3: Circuit Classification
    // LOCAL_PROOF / STATE_READ circuits do NOT enter the signing/submission pipeline.
    // -------------------------------------------------------------------------
    if (circuitClass === 'LOCAL_PROOF' || circuitClass === 'STATE_READ') {
      return {
        result: {
          success: false,
          status: 'UNSUPPORTED',
          action,
          circuitName,
          loanId,
          message: `Circuit "${circuitName}" is classified as ${circuitClass} and does not route through the execution adapter signing/submission lifecycle.`,
          errorCode: 'CIRCUIT_UNAVAILABLE',
          registryUpdated: false,
          confirmationState: 'NOT_CONFIRMED',
          executionMode,
          executionStage: 'CIRCUIT_CLASSIFICATION',
        },
      };
    }

    // -------------------------------------------------------------------------
    // Stage 4: Prototype Provider Honest Rejection
    // -------------------------------------------------------------------------
    if (this.provider.isPrototype) {
      return {
        result: {
          success: false,
          status: 'UNSUPPORTED',
          action,
          circuitName,
          loanId,
          message: 'Real transaction signing and submission are unavailable in prototype mode.',
          unsupportedReason: 'Prototype provider does not connect to live Midnight Network wallet or RPC.',
          errorCode: 'UNSUPPORTED_PROVIDER',
          registryUpdated: false,
          confirmationState: 'NOT_CONFIRMED',
          executionMode: 'PROTOTYPE_LOCAL',
          executionStage: 'CAPABILITY_VERIFICATION',
        },
      };
    }

    // -------------------------------------------------------------------------
    // Stage 5: Provider Connector Detection
    // -------------------------------------------------------------------------
    if (
      typeof (this.provider as any).getDetectionStatus === 'function' &&
      ((this.provider as any).getDetectionStatus() === 'NOT_DETECTED' ||
        (this.provider as any).getDetectionStatus() === 'UNSUPPORTED')
    ) {
      return {
        result: {
          success: false,
          status: 'UNSUPPORTED',
          action,
          circuitName,
          loanId,
          message: 'Midnight wallet connector is not detected or unsupported in this environment.',
          unsupportedReason: 'Midnight wallet connector not detected.',
          errorCode: 'PROVIDER_UNAVAILABLE',
          registryUpdated: false,
          confirmationState: 'NOT_CONFIRMED',
          executionMode: 'ADAPTER_UNSUPPORTED',
          executionStage: 'CONNECTOR_DETECTION',
        },
      };
    }

    // -------------------------------------------------------------------------
    // Stage 6: Capability Verification
    // -------------------------------------------------------------------------
    if (!this.provider.submitTransaction) {
      return {
        result: {
          success: false,
          status: 'UNSUPPORTED',
          action,
          circuitName,
          loanId,
          message: 'Active wallet provider does not support transaction submission.',
          unsupportedReason: 'submitTransaction capability is absent on the current provider.',
          errorCode: 'UNSUPPORTED_CAPABILITY',
          registryUpdated: false,
          confirmationState: 'NOT_CONFIRMED',
          executionMode,
          executionStage: 'CAPABILITY_VERIFICATION',
        },
      };
    }

    // -------------------------------------------------------------------------
    // Stage 7: Signing Request
    // -------------------------------------------------------------------------
    eventService.appendEvent({
      transactionId: txId,
      eventType: 'SIGNING_STARTED',
      action,
      status: 'AWAITING_SIGNATURE',
      source: 'EXECUTION_ADAPTER',
      agreementId: loanId,
    });

    if (this.provider.requestSignature) {
      const callerPk = (request.account as any)?.publicKey ?? null;
      const callerHex = (request.account as any)?.publicKeyHex ?? null;

      const signingReq: TransactionSigningRequest = {
        requestId: `adapter-sign-${Date.now()}`,
        loanId,
        action,
        circuitName,
        callerPublicKey: callerPk,
        parameters: {
          loanId,
          action,
          circuitName,
          callerPublicKey: callerPk,
          callerPublicKeyHex: callerHex,
          amount: (request.loan as any).amount,
          interestRateBps: (request.loan as any).interestRateBps ?? (request.loan as any).interestRateBasisPoints,
          durationBlocks: (request.loan as any).durationBlocks,
        },
        createdAt: Date.now(),
      };

      try {
        const sigResult = await this.provider.requestSignature(signingReq);
        if (!sigResult.success) {
          eventService.appendEvent({
            transactionId: txId,
            eventType: 'REJECTED',
            action,
            status: 'REJECTED',
            source: 'EXECUTION_ADAPTER',
            agreementId: loanId,
            message: sigResult.error ?? 'Transaction signing failed or rejected.',
          });
          return {
            result: {
              success: false,
              status: sigResult.status === 'REJECTED' ? 'REJECTED' : 'FAILED',
              action,
              circuitName,
              loanId,
              message: sigResult.error ?? 'Transaction signing failed or rejected.',
              errorCode: sigResult.status === 'REJECTED' ? 'USER_REJECTED' : 'SIGNING_FAILED',
              error: sigResult.error,
              registryUpdated: false,
              confirmationState: 'NOT_CONFIRMED',
              executionMode,
              executionStage: 'AWAITING_USER_SIGNATURE',
            },
          };
        }

        eventService.appendEvent({
          transactionId: txId,
          eventType: 'SIGNED',
          action,
          status: 'SIGNED',
          source: 'EXECUTION_ADAPTER',
          agreementId: loanId,
        });
      } catch (err: unknown) {
        return this._mapProviderError(err, action, circuitName, loanId, executionMode, 'AWAITING_USER_SIGNATURE');
      }
    }

    // -------------------------------------------------------------------------
    // Stage 8: Network Submission
    // -------------------------------------------------------------------------
    const txAction =
      action === 'FUND_LOAN' ? 'FUND' :
      action === 'REPAY_LOAN' ? 'REPAY' : 'SETTLE';

    eventService.appendEvent({
      transactionId: txId,
      eventType: 'SUBMISSION_STARTED',
      action,
      status: 'SUBMITTING',
      source: 'EXECUTION_ADAPTER',
      agreementId: loanId,
    });

    try {
      const callerPk = (request.account as any)?.publicKey ?? null;
      const txResult = await this.provider.submitTransaction({
        loanId,
        action: txAction,
        callerPublicKey: callerPk,
      });

      // -----------------------------------------------------------------------
      // Stage 9: Submission Result Routing
      // -----------------------------------------------------------------------
      if (txResult.status === 'PENDING' || txResult.status === 'SUBMITTED') {
        eventService.appendEvent({
          transactionId: txId,
          eventType: 'SUBMITTED',
          action,
          status: txResult.status,
          source: 'EXECUTION_ADAPTER',
          agreementId: loanId,
          message: `Transaction submitted with ID: ${txResult.transactionId ?? 'UNKNOWN'}`,
        });

        const receipt: TransactionReceipt = {
          transactionId: txResult.transactionId,
          status: 'PENDING',
          blockHeight: txResult.blockHeight,
        };

        return {
          result: {
            success: true,
            status: 'SUBMITTED',
            action,
            circuitName,
            loanId,
            message: 'Transaction submitted to Midnight Network. Awaiting on-chain confirmation.',
            receipt,
            transactionId: txResult.transactionId,
            blockHeight: txResult.blockHeight,
            registryUpdated: false,
            confirmationState: 'UNCONFIRMED_PRESERVED',
            executionMode,
            executionStage: 'SUBMISSION_ACKNOWLEDGED',
          },
        };
      }

      // -----------------------------------------------------------------------
      // Stage 10: Confirmed — Registry Mutation Gate
      // REGISTRY MUTATION ONLY AFTER AUTHENTIC CONFIRMATION
      // -----------------------------------------------------------------------
      if (txResult.status === 'CONFIRMED' && txResult.success) {
        let updatedRegistry: LoanRegistry | undefined;
        let registryUpdated = false;

        eventService.appendEvent({
          transactionId: txId,
          eventType: 'CONFIRMED',
          action,
          status: 'CONFIRMED',
          source: 'EXECUTION_ADAPTER',
          agreementId: loanId,
          message: `Transaction confirmed at block ${txResult.blockHeight ?? 'unknown'}.`,
        });

        const callerPk = (request.account as any)?.publicKey ?? null;
        if (loanRegistry && callerPk) {
          if (action === 'FUND_LOAN') {
            updatedRegistry = loanRegistry.fundLoan(loanId, callerPk, callerPk);
            registryUpdated = true;
          } else if (action === 'REPAY_LOAN') {
            updatedRegistry = loanRegistry.repayLoan(loanId, callerPk);
            registryUpdated = true;
          } else if (action === 'SETTLE_LOAN') {
            updatedRegistry = loanRegistry.settleLoan(loanId, callerPk);
            registryUpdated = true;
          }
        }

        const receipt: TransactionReceipt = {
          transactionId: txResult.transactionId,
          blockHeight: txResult.blockHeight,
          status: 'CONFIRMED',
          confirmedAt: Date.now(),
        };

        return {
          result: {
            success: true,
            status: 'CONFIRMED',
            action,
            circuitName,
            loanId,
            message: `Transaction confirmed on Midnight Network via ${circuitName}().`,
            receipt,
            transactionId: txResult.transactionId,
            blockHeight: txResult.blockHeight,
            registryUpdated,
            confirmationState: 'CONFIRMED',
            executionMode,
            executionStage: 'CONFIRMATION_VERIFIED',
          },
          updatedRegistry,
        };
      }

      // -----------------------------------------------------------------------
      // Stage 11: Failed Submission
      // -----------------------------------------------------------------------
      eventService.appendEvent({
        transactionId: txId,
        eventType: 'FAILED',
        action,
        status: 'FAILED',
        source: 'EXECUTION_ADAPTER',
        agreementId: loanId,
        message: txResult.error ?? 'Transaction submission failed on provider boundary.',
      });

      return {
        result: {
          success: false,
          status: 'FAILED',
          action,
          circuitName,
          loanId,
          message: txResult.error ?? 'Transaction submission failed on provider boundary.',
          errorCode: 'SUBMISSION_FAILED',
          error: txResult.error,
          registryUpdated: false,
          confirmationState: 'NOT_CONFIRMED',
          executionMode,
          executionStage: 'SUBMISSION_ACKNOWLEDGED',
        },
      };
    } catch (err: unknown) {
      return this._mapProviderError(err, action, circuitName, loanId, executionMode, 'SUBMISSION_REQUEST');
    }
  }

  /**
   * Queries the current status of a submitted transaction via the provider.
   * Returns null if the provider does not support status queries.
   * ANTI-FABRICATION: Never infers or invents a status.
   */
  async queryTransactionStatus(
    transactionId: string
  ): Promise<TransactionReceipt | TransactionStatusResult | null> {
    if (!this.provider.getTransactionStatus) {
      return null;
    }
    try {
      return await this.provider.getTransactionStatus(transactionId);
    } catch {
      return null;
    }
  }

  /**
   * Returns an initial bounded confirmation poll state for a given transaction.
   * Does NOT poll — call TransactionConfirmationService for polling.
   */
  buildInitialPollState(
    transactionId: string,
    maxPolls = 60,
    pollIntervalMs = 5000
  ): ConfirmationPollState {
    return {
      transactionId,
      pollCount: 0,
      maxPolls,
      pollIntervalMs,
      timedOut: false,
      lastStatus: null,
      lastPollAt: null,
    };
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private _circuitNameForAction(action: string): string {
    switch (action) {
      case 'FUND_LOAN': return 'fundLoan';
      case 'REPAY_LOAN': return 'repayLoan';
      case 'SETTLE_LOAN': return 'settleLoan';
      case 'VERIFY_ELIGIBILITY': return 'verifyEligibility';
      default: return 'unknown';
    }
  }

  private _blocked(
    action: TransactionExecutionRequest['action'],
    circuitName: string,
    loanId: string,
    message: string,
    errorCode: TransactionExecutionErrorCode,
    stage: TransactionExecutionStage,
    executionMode: TransactionExecutionMode
  ): TransactionExecutionResult {
    return {
      success: false,
      status: 'BLOCKED',
      action,
      circuitName,
      loanId,
      message,
      errorCode,
      error: message,
      registryUpdated: false,
      confirmationState: 'NOT_CONFIRMED',
      executionMode,
      executionStage: stage,
    };
  }

  private _mapProviderError(
    err: unknown,
    action: TransactionExecutionRequest['action'],
    circuitName: string,
    loanId: string,
    executionMode: TransactionExecutionMode,
    stage: TransactionExecutionStage
  ): { result: TransactionExecutionResult } {
    const rawMsg = err instanceof Error ? err.message : String(err);
    const errCode = (err as any)?.code;

    const eventService = getTransactionEventService();
    eventService.appendEvent({
      transactionId: `adapter-${loanId}`,
      eventType: errCode === 'USER_REJECTED' || rawMsg.toLowerCase().includes('reject') ? 'REJECTED' : 'FAILED',
      action,
      status: 'FAILED',
      source: 'EXECUTION_ADAPTER',
      agreementId: loanId,
      message: rawMsg,
    });

    if (errCode === 'USER_REJECTED' || rawMsg.toLowerCase().includes('reject')) {
      return {
        result: {
          success: false,
          status: 'REJECTED',
          action,
          circuitName,
          loanId,
          message: rawMsg || 'Transaction rejected by user in wallet.',
          errorCode: 'USER_REJECTED',
          error: rawMsg,
          registryUpdated: false,
          confirmationState: 'NOT_CONFIRMED',
          executionMode,
          executionStage: stage,
        },
      };
    }

    if (
      errCode === 'UNSUPPORTED_OPERATION' ||
      rawMsg.toLowerCase().includes('unavailable') ||
      rawMsg.toLowerCase().includes('unsupported')
    ) {
      return {
        result: {
          success: false,
          status: 'UNSUPPORTED',
          action,
          circuitName,
          loanId,
          message: 'Wallet detected, but this transaction capability is unavailable through the current adapter.',
          unsupportedReason: rawMsg,
          errorCode: 'UNSUPPORTED_CAPABILITY',
          registryUpdated: false,
          confirmationState: 'NOT_CONFIRMED',
          executionMode,
          executionStage: stage,
        },
      };
    }

    return {
      result: {
        success: false,
        status: 'FAILED',
        action,
        circuitName,
        loanId,
        message: rawMsg || 'Transaction execution failed on provider boundary.',
        errorCode: 'PROVIDER_ERROR',
        error: rawMsg,
        registryUpdated: false,
        confirmationState: 'NOT_CONFIRMED',
        executionMode,
        executionStage: stage,
      },
    };
  }
}

/**
 * Factory: creates a MidnightTransactionExecutionAdapter wrapping the given provider.
 */
export function createMidnightTransactionExecutionAdapter(
  provider: WalletProvider
): MidnightTransactionExecutionAdapter {
  return new MidnightTransactionExecutionAdapter(provider);
}
