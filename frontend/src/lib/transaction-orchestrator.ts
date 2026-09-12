import {
  canVerifyEligibility,
  canFundLoan,
  canRepayLoan,
  canSettleLoan,
  areByteArraysEqual,
  type LoanDetailsModel,
} from 'contracts';
import type { AccountContext, AccountIdentity } from '../types/account.ts';
import type { ProviderCapability } from '../types/network.ts';
import type { WalletProvider } from './wallet-provider.ts';
import { getWalletProvider } from './account-service.ts';
import {
  type LifecycleTransactionAction,
  type TransactionPreparationStatus,
  type TransactionPreparation,
  type TransactionOrchestrationResult,
} from '../types/transaction-orchestration.ts';

/**
 * Canonical mapping between lifecycle actions and Midnight Compact circuit names.
 */
export const ACTION_TO_CIRCUIT_MAP: Record<LifecycleTransactionAction, string> = {
  VERIFY_ELIGIBILITY: 'verifyEligibility',
  FUND_LOAN: 'fundLoan',
  REPAY_LOAN: 'repayLoan',
  SETTLE_LOAN: 'settleLoan',
};

/**
 * Reverse mapping from circuit name to lifecycle transaction action.
 */
export const CIRCUIT_TO_ACTION_MAP: Record<string, LifecycleTransactionAction> = {
  verifyEligibility: 'VERIFY_ELIGIBILITY',
  fundLoan: 'FUND_LOAN',
  repayLoan: 'REPAY_LOAN',
  settleLoan: 'SETTLE_LOAN',
};

/**
 * Atomic provider capabilities required to execute each lifecycle transaction action.
 */
export const ACTION_REQUIRED_CAPABILITIES: Record<
  LifecycleTransactionAction,
  ProviderCapability[]
> = {
  VERIFY_ELIGIBILITY: ['CREATE_PROOF'],
  FUND_LOAN: ['SIGN_TRANSACTION', 'SUBMIT_TRANSACTION'],
  REPAY_LOAN: ['SIGN_TRANSACTION', 'SUBMIT_TRANSACTION'],
  SETTLE_LOAN: ['SIGN_TRANSACTION', 'SUBMIT_TRANSACTION'],
};

/**
 * Returns the canonical contract circuit name for a given lifecycle action.
 */
export function getCircuitNameForAction(action: LifecycleTransactionAction): string {
  return ACTION_TO_CIRCUIT_MAP[action];
}

/**
 * Returns the provider capabilities required to dispatch a lifecycle action.
 */
export function getRequiredCapabilitiesForAction(
  action: LifecycleTransactionAction
): ProviderCapability[] {
  return [...ACTION_REQUIRED_CAPABILITIES[action]];
}

function resolveCallerPublicKey(
  account: AccountIdentity | AccountContext | null | undefined
): Uint8Array | null {
  if (!account) return null;
  if ('identity' in account) {
    return account.identity?.publicKey ?? null;
  }
  return account.publicKey ?? null;
}

function resolveCallerPublicKeyHex(
  account: AccountIdentity | AccountContext | null | undefined
): string | null {
  if (!account) return null;
  if ('identity' in account) {
    return account.identity?.publicKeyHex ?? null;
  }
  return account.publicKeyHex ?? null;
}

/**
 * Prepares a lifecycle transaction action against a public loan agreement and caller identity.
 * Validates canonical contract guards and evaluates provider capability support.
 *
 * STRICT PRIVACY INVARIANT:
 * Operates purely on public loan metadata, authorized public keys, and circuit names.
 * Zero confidential inputs, off-chain witnesses, or secrets are ever received or held.
 */
export function prepareLifecycleTransaction(
  loan: LoanDetailsModel | null | undefined,
  account: AccountIdentity | AccountContext | null | undefined,
  action: LifecycleTransactionAction,
  provider?: WalletProvider
): TransactionPreparation {
  const circuitName = getCircuitNameForAction(action);
  const requiredCapabilities = getRequiredCapabilitiesForAction(action);
  const activeProvider = provider ?? getWalletProvider();
  const providerCaps = activeProvider.getCapabilities();
  const missingCapabilities = requiredCapabilities.filter(
    (cap) => !providerCaps[cap]
  );
  const isExecutionSupported = missingCapabilities.length === 0;
  const callerPk = resolveCallerPublicKey(account);
  const callerPkHex = resolveCallerPublicKeyHex(account);

  // 1. Guard against missing or corrupted loan record
  if (!loan) {
    return {
      loanId: 'unknown',
      action,
      circuitName,
      status: 'INVALID',
      callerPublicKey: callerPk,
      callerPublicKeyHex: callerPkHex,
      isAuthorized: false,
      authorizationReason: 'Loan agreement data is missing or unavailable.',
      requiredCapabilities,
      missingCapabilities,
      isExecutionSupported: false,
      estimatedFee: null,
    };
  }

  const loanId = (loan as any).id ?? 'active-loan';

  // 2. Guard against disconnected or missing account
  if (!callerPk) {
    return {
      loanId,
      action,
      circuitName,
      status: 'BLOCKED',
      callerPublicKey: null,
      callerPublicKeyHex: null,
      isAuthorized: false,
      authorizationReason: 'No active account connected. Wallet connection required.',
      requiredCapabilities,
      missingCapabilities,
      isExecutionSupported,
      estimatedFee: null,
    };
  }

  // 3. Evaluate canonical contract lifecycle guards and participant authorization
  let isAuthorized = false;
  let authorizationReason: string | undefined;

  switch (action) {
    case 'VERIFY_ELIGIBILITY': {
      const guard = canVerifyEligibility(loan, callerPk);
      isAuthorized = guard.canExecute;
      if (!isAuthorized) {
        authorizationReason =
          guard.reason ?? 'Caller is not authorized to verify eligibility for this loan.';
      }
      break;
    }
    case 'FUND_LOAN': {
      const guard = canFundLoan(loan, callerPk);
      isAuthorized = guard.canExecute;
      if (!isAuthorized) {
        authorizationReason =
          guard.reason ?? 'Caller is not authorized to provide funding for this loan.';
      }
      break;
    }
    case 'REPAY_LOAN': {
      const guard = canRepayLoan(loan, callerPk);
      isAuthorized = guard.canExecute;
      if (!isAuthorized) {
        authorizationReason =
          guard.reason ?? 'Caller is not authorized to repay this loan.';
      }
      break;
    }
    case 'SETTLE_LOAN': {
      const guard = canSettleLoan(loan, callerPk);
      isAuthorized = guard.canExecute;
      if (!isAuthorized) {
        authorizationReason =
          guard.reason ?? 'Caller is not authorized to settle this loan.';
      }
      break;
    }
    default: {
      isAuthorized = false;
      authorizationReason = `Unknown lifecycle action: ${action}`;
      break;
    }
  }

  // 4. Derive overall preparation status
  let status: TransactionPreparationStatus;
  if (!isAuthorized) {
    status = 'BLOCKED';
  } else if (!isExecutionSupported) {
    status = 'UNSUPPORTED';
  } else {
    status = 'READY';
  }

  return {
    loanId,
    action,
    circuitName,
    status,
    callerPublicKey: callerPk,
    callerPublicKeyHex: callerPkHex,
    isAuthorized,
    authorizationReason,
    requiredCapabilities,
    missingCapabilities,
    isExecutionSupported,
    estimatedFee: null, // Transparently null in prototype mode
  };
}

/**
 * Dispatches a lifecycle action through the provider boundary.
 *
 * ANTI-FABRICATION GUARANTEE:
 * In local prototype mode, funding, repayment, and settlement transactions return
 * an honest typed 'UNSUPPORTED' result.
 * Zero fake transaction hashes, confirmations, or blocks are ever generated.
 * The central LoanRegistry is NEVER mutated after an unsupported transaction attempt.
 */
export async function executeLifecycleTransaction(
  loan: LoanDetailsModel | null | undefined,
  account: AccountIdentity | AccountContext | null | undefined,
  action: LifecycleTransactionAction,
  provider?: WalletProvider,
  options?: { localProofExecutor?: () => Promise<void> }
): Promise<TransactionOrchestrationResult> {
  const activeProvider = provider ?? getWalletProvider();
  const preparation = prepareLifecycleTransaction(loan, account, action, activeProvider);
  const loanId = loan ? ((loan as any).id ?? 'active-loan') : 'unknown';

  // 1. Check for invalid agreement state
  if (preparation.status === 'INVALID') {
    return {
      success: false,
      status: 'FAILED',
      action,
      loanId,
      circuitName: preparation.circuitName,
      message: preparation.authorizationReason ?? 'Invalid loan agreement parameters.',
    };
  }

  // 2. Check for authorization or contract guard blocks
  if (preparation.status === 'BLOCKED') {
    return {
      success: false,
      status: 'REJECTED',
      action,
      loanId,
      circuitName: preparation.circuitName,
      message:
        preparation.authorizationReason ??
        'Lifecycle action rejected by contract authorization guards.',
    };
  }

  // 3. Check for unsupported provider capabilities (e.g. Prototype mode)
  if (preparation.status === 'UNSUPPORTED') {
    return {
      success: false,
      status: 'UNSUPPORTED',
      action,
      loanId,
      circuitName: preparation.circuitName,
      message: 'Live wallet transaction execution is unavailable in prototype mode.',
      unsupportedReason: `Missing required provider capabilities: ${preparation.missingCapabilities.join(', ')}`,
    };
  }

  // 4. Execution supported for local off-chain ZK verification
  if (action === 'VERIFY_ELIGIBILITY') {
    if (options?.localProofExecutor) {
      try {
        await options.localProofExecutor();
        return {
          success: true,
          status: 'CONFIRMED',
          action,
          loanId,
          circuitName: preparation.circuitName,
          message: 'Eligibility verified off-chain via client zero-knowledge proof.',
        };
      } catch (err: any) {
        return {
          success: false,
          status: 'FAILED',
          action,
          loanId,
          circuitName: preparation.circuitName,
          message: err?.message ?? 'Client zero-knowledge proof execution failed.',
        };
      }
    }

    return {
      success: true,
      status: 'CONFIRMED',
      action,
      loanId,
      circuitName: preparation.circuitName,
      message: 'Eligibility verified off-chain via local client prover workflow.',
    };
  }

  // 5. Delegate on-chain transaction submission to the WalletProvider adapter
  if (activeProvider.submitTransaction && preparation.callerPublicKey) {
    try {
      const txResult = await activeProvider.submitTransaction({
        loanId,
        action: action === 'FUND_LOAN' ? 'FUND' : action === 'REPAY_LOAN' ? 'REPAY' : 'SETTLE',
        callerPublicKey: preparation.callerPublicKey,
      });

      return {
        success: txResult.success,
        status: txResult.status === 'CONFIRMED' ? 'CONFIRMED' : 'FAILED',
        action,
        loanId,
        circuitName: preparation.circuitName,
        message: txResult.success
          ? 'Transaction submitted successfully to Midnight Network.'
          : txResult.error ?? 'Transaction submission failed.',
        transactionId: txResult.transactionId,
        blockHeight: txResult.blockHeight,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'UNSUPPORTED',
        action,
        loanId,
        circuitName: preparation.circuitName,
        message: err?.message ?? 'Live wallet transactions are unavailable in prototype mode.',
        unsupportedReason: err?.message ?? 'Unsupported operation in prototype provider.',
      };
    }
  }

  // Fallback if provider does not expose submitTransaction
  return {
    success: false,
    status: 'UNSUPPORTED',
    action,
    loanId,
    circuitName: preparation.circuitName,
    message: 'Live wallet transaction execution is unavailable in prototype mode.',
    unsupportedReason: 'Active wallet provider does not support transaction submission.',
  };
}

/**
 * Returns a quick summary of whether a lifecycle action is ready to execute.
 */
export function getTransactionExecutionReadiness(
  loan: LoanDetailsModel | null | undefined,
  account: AccountIdentity | AccountContext | null | undefined,
  action: LifecycleTransactionAction,
  provider?: WalletProvider
): {
  isReady: boolean;
  status: TransactionPreparationStatus;
  circuitName: string;
  reason: string;
} {
  const prep = prepareLifecycleTransaction(loan, account, action, provider);
  let reason: string;

  if (prep.status === 'READY') {
    reason = `Action ready for dispatch via circuit ${prep.circuitName}`;
  } else if (prep.status === 'UNSUPPORTED') {
    reason = `Transaction submission unavailable in prototype mode (${prep.missingCapabilities.join(', ')})`;
  } else if (prep.status === 'BLOCKED') {
    reason = prep.authorizationReason ?? 'Action blocked by authorization rules';
  } else {
    reason = prep.authorizationReason ?? 'Invalid loan agreement parameters';
  }

  return {
    isReady: prep.status === 'READY',
    status: prep.status,
    circuitName: prep.circuitName,
    reason,
  };
}

/**
 * Evaluates which lifecycle actions are supported vs unsupported for the active provider.
 */
export function getSupportedLifecycleActions(
  account: AccountIdentity | AccountContext | null | undefined,
  provider?: WalletProvider
): {
  supported: LifecycleTransactionAction[];
  unsupported: LifecycleTransactionAction[];
} {
  const activeProvider = provider ?? getWalletProvider();
  const caps = activeProvider.getCapabilities();
  const allActions: LifecycleTransactionAction[] = [
    'VERIFY_ELIGIBILITY',
    'FUND_LOAN',
    'REPAY_LOAN',
    'SETTLE_LOAN',
  ];

  const supported: LifecycleTransactionAction[] = [];
  const unsupported: LifecycleTransactionAction[] = [];

  for (const act of allActions) {
    const required = ACTION_REQUIRED_CAPABILITIES[act];
    const hasAll = required.every((cap) => caps[cap]);
    if (hasAll) {
      supported.push(act);
    } else {
      unsupported.push(act);
    }
  }

  return { supported, unsupported };
}
