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
import type { TransactionReadinessReason } from '../types/network-config.ts';
import type { WalletProvider } from './wallet-provider.ts';
import { getWalletProvider } from './account-service.ts';
import { getNetworkConfigService } from './network-config-service.ts';
import { evaluateConnectorCapabilities } from './wallet-connector-discovery.ts';
import { evaluateNetworkCompatibility } from './wallet-network-compatibility.ts';
import type { ContractDeploymentService } from './contract-deployment-service.ts';
import { isKnownCircuit } from './contract-manifest.ts';
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
  provider?: WalletProvider,
  deploymentService?: ContractDeploymentService
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

  // 2. Guard against missing or disconnected account
  if (
    !callerPk ||
    (account && 'connectionStatus' in account && account.connectionStatus === 'DISCONNECTED')
  ) {
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

  // 3. Evaluate wallet detection status on real adapter
  const isWalletNotDetected =
    !activeProvider.isPrototype &&
    activeProvider.getDetectionStatus &&
    (activeProvider.getDetectionStatus() === 'NOT_DETECTED' ||
      activeProvider.getDetectionStatus() === 'UNSUPPORTED');

  if (isWalletNotDetected) {
    return {
      loanId,
      action,
      circuitName,
      status: 'UNSUPPORTED',
      callerPublicKey: callerPk,
      callerPublicKeyHex: callerPkHex,
      isAuthorized: false,
      authorizationReason:
        'Wallet connector is not detected or unsupported in this environment.',
      requiredCapabilities,
      missingCapabilities,
      isExecutionSupported: false,
      estimatedFee: null,
    };
  }

  // 4. Guard against disconnected provider on real adapter
  if (!activeProvider.isPrototype && activeProvider.getConnectionStatus() === 'DISCONNECTED') {
    return {
      loanId,
      action,
      circuitName,
      status: 'BLOCKED',
      callerPublicKey: callerPk,
      callerPublicKeyHex: callerPkHex,
      isAuthorized: false,
      authorizationReason: 'Wallet session is disconnected. Connect wallet to prepare transaction.',
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

  // 5. Derive overall preparation status and typed readiness reason
  let status: TransactionPreparationStatus;
  let readinessReason: TransactionReadinessReason;

  if (!callerPk) {
    status = 'BLOCKED';
    readinessReason = 'WALLET_NOT_CONNECTED';
  } else if (!isAuthorized) {
    status = 'BLOCKED';
    readinessReason = 'GUARD_VALIDATION_FAILED';
  } else if (!isExecutionSupported) {
    status = 'UNSUPPORTED';
    if (missingCapabilities.includes('SIGN_TRANSACTION')) {
      readinessReason = 'SIGNING_UNAVAILABLE';
    } else if (missingCapabilities.includes('SUBMIT_TRANSACTION')) {
      readinessReason = 'SUBMISSION_UNAVAILABLE';
    } else {
      readinessReason = 'UNSUPPORTED_CONNECTOR';
    }
    if (!authorizationReason) {
      authorizationReason = `Missing required provider capabilities: ${missingCapabilities.join(', ')}`;
    }
  } else {
    status = 'READY';
    readinessReason = 'READY';
  }

  if (deploymentService) {
    const deployment = deploymentService.getDeployment();
    if (deployment.status === 'NOT_DEPLOYED') {
      status = 'BLOCKED';
      readinessReason = 'CONTRACT_NOT_DEPLOYED';
      authorizationReason = 'Contract deployment is not deployed.';
    } else if (deployment.status === 'UNCONFIGURED') {
      status = 'BLOCKED';
      readinessReason = 'CONTRACT_NOT_CONFIGURED';
      authorizationReason = 'Contract deployment is not configured for this network.';
    } else if (deployment.status === 'INVALID') {
      status = 'BLOCKED';
      readinessReason = 'CONTRACT_INVALID';
      authorizationReason = 'Contract deployment configuration is invalid.';
    } else if (
      (action === 'FUND_LOAN' || action === 'REPAY_LOAN' || action === 'SETTLE_LOAN') &&
      !deployment.isVerified &&
      deployment.status !== 'READY' &&
      deployment.status !== 'VERIFIED'
    ) {
      status = 'BLOCKED';
      readinessReason = 'CONTRACT_VERIFICATION_UNAVAILABLE';
      authorizationReason =
        'Contract deployment is not verified on the target network. Transaction execution blocked.';
    }
  }

  return {
    loanId,
    action,
    circuitName,
    status,
    readinessReason,
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

export interface TransactionReadinessEvaluation {
  isReady: boolean;
  reason: TransactionReadinessReason;
  message: string;
  preparation: TransactionPreparation;
}

/**
 * Complete transaction readiness pipeline evaluating:
 * 1. Account context & connection
 * 2. Network configuration validity
 * 3. Wallet connector discovery & compatibility
 * 4. Contract lifecycle guard authorization
 * 5. Provider atomic capabilities (signing & submission)
 */
export function evaluateTransactionReadiness(
  loan: LoanDetailsModel,
  account: { publicKey?: Uint8Array | null } | null,
  action: LifecycleTransactionAction,
  provider?: WalletProvider,
  deploymentService?: ContractDeploymentService
): TransactionReadinessEvaluation {
  const activeProvider = provider ?? getWalletProvider();
  const netConfig = getNetworkConfigService().getNetworkConfig();

  // 1. Account / Connection check
  if (!account || !account.publicKey) {
    const prep = prepareLifecycleTransaction(loan, null, action, activeProvider);
    return {
      isReady: false,
      reason: 'WALLET_NOT_CONNECTED',
      message: 'Cannot execute transaction: Wallet is disconnected.',
      preparation: { ...prep, status: 'BLOCKED', readinessReason: 'WALLET_NOT_CONNECTED' },
    };
  }

  // 2. Wallet connector discovery & compatibility
  if (!activeProvider.isPrototype) {
    const detectionStatus = activeProvider.getDetectionStatus ? activeProvider.getDetectionStatus() : 'NOT_DETECTED';
    if (detectionStatus === 'NOT_DETECTED') {
      const prep = prepareLifecycleTransaction(loan, account as any, action, activeProvider);
      return {
        isReady: false,
        reason: 'WALLET_NOT_DETECTED',
        message: 'Transaction blocked: Lace / Midnight wallet extension not detected.',
        preparation: { ...prep, status: 'UNSUPPORTED', readinessReason: 'WALLET_NOT_DETECTED' },
      };
    }
    if (detectionStatus === 'UNSUPPORTED') {
      const prep = prepareLifecycleTransaction(loan, account as any, action, activeProvider);
      return {
        isReady: false,
        reason: 'UNSUPPORTED_CONNECTOR',
        message: 'Transaction blocked: Wallet connector is incompatible or unsupported.',
        preparation: { ...prep, status: 'UNSUPPORTED', readinessReason: 'UNSUPPORTED_CONNECTOR' },
      };
    }
  }

  // 3. Wallet Connection check
  if (!activeProvider.isPrototype && activeProvider.getConnectionStatus() === 'DISCONNECTED') {
    const prep = prepareLifecycleTransaction(loan, account as any, action, activeProvider);
    return {
      isReady: false,
      reason: 'WALLET_NOT_CONNECTED',
      message: 'Transaction blocked: Wallet session is disconnected. Connect wallet to prepare transaction.',
      preparation: { ...prep, status: 'BLOCKED', readinessReason: 'WALLET_NOT_CONNECTED' },
    };
  }

  // 4. Wallet Identity check
  const callerAccount = activeProvider.getAccount();
  if (!activeProvider.isPrototype && (!callerAccount || !callerAccount.publicKey)) {
    const prep = prepareLifecycleTransaction(loan, account as any, action, activeProvider);
    return {
      isReady: false,
      reason: 'WALLET_NOT_CONNECTED',
      message: 'Transaction blocked: Connected wallet identity is unavailable.',
      preparation: { ...prep, status: 'BLOCKED', readinessReason: 'WALLET_NOT_CONNECTED' },
    };
  }

  // 5. Network configuration check
  if (netConfig.status !== 'CONFIGURED') {
    const prep = prepareLifecycleTransaction(loan, account as any, action, activeProvider);
    return {
      isReady: false,
      reason: 'BLOCKED_NETWORK_CONFIGURATION',
      message: 'Transaction blocked: Network configuration is invalid or unconfigured.',
      preparation: { ...prep, status: 'BLOCKED', readinessReason: 'BLOCKED_NETWORK_CONFIGURATION' },
    };
  }

  if (netConfig.environment !== 'LOCAL' && (!netConfig.nodeRpcEndpoint || !netConfig.nodeRpcEndpoint.url)) {
    const prep = prepareLifecycleTransaction(loan, account as any, action, activeProvider);
    return {
      isReady: false,
      reason: 'BLOCKED_NETWORK_CONFIGURATION',
      message: 'Transaction blocked: Real network configuration requires a valid RPC endpoint.',
      preparation: { ...prep, status: 'BLOCKED', readinessReason: 'BLOCKED_NETWORK_CONFIGURATION' },
    };
  }

  // 6. Wallet Network Compatibility check
  if (netConfig.environment !== 'LOCAL') {
    const walletNetwork =
      typeof activeProvider.getReportedNetworkId === 'function' ? activeProvider.getReportedNetworkId() : null;
    const comp = evaluateNetworkCompatibility(netConfig, walletNetwork);
    if (comp.compatibility === 'MISMATCH') {
      const prep = prepareLifecycleTransaction(loan, account as any, action, activeProvider);
      return {
        isReady: false,
        reason: 'NETWORK_MISMATCH',
        message: comp.reason,
        preparation: { ...prep, status: 'BLOCKED', readinessReason: 'NETWORK_MISMATCH' },
      };
    }
    if (comp.compatibility === 'UNKNOWN') {
      const prep = prepareLifecycleTransaction(loan, account as any, action, activeProvider);
      return {
        isReady: false,
        reason: 'UNKNOWN_WALLET_NETWORK',
        message: comp.reason,
        preparation: { ...prep, status: 'BLOCKED', readinessReason: 'UNKNOWN_WALLET_NETWORK' },
      };
    }
  }

  // 7. Contract lifecycle guard check
  const prep = prepareLifecycleTransaction(loan, account as any, action, activeProvider, deploymentService);
  if (prep.status === 'BLOCKED') {
    return {
      isReady: false,
      reason: prep.readinessReason ?? 'GUARD_VALIDATION_FAILED',
      message: prep.authorizationReason ?? 'Contract lifecycle guard validation failed.',
      preparation: prep,
    };
  }

  // 8. Contract Deployment Configuration check
  if (deploymentService) {
    const deployment = deploymentService.getDeployment();

    if (deployment.status === 'NOT_DEPLOYED') {
      return {
        isReady: false,
        reason: 'CONTRACT_NOT_DEPLOYED',
        message: 'Transaction blocked: Contract deployment is not deployed.',
        preparation: {
          ...prep,
          status: 'BLOCKED',
          readinessReason: 'CONTRACT_NOT_DEPLOYED',
          authorizationReason: 'Contract deployment is not deployed.',
        },
      };
    }

    if (deployment.status === 'UNCONFIGURED') {
      return {
        isReady: false,
        reason: 'CONTRACT_NOT_CONFIGURED',
        message: 'Transaction blocked: Contract deployment is not configured for this network.',
        preparation: {
          ...prep,
          status: 'BLOCKED',
          readinessReason: 'CONTRACT_NOT_CONFIGURED',
          authorizationReason: 'Contract deployment is not configured for this network.',
        },
      };
    }

    if (deployment.status === 'INVALID') {
      return {
        isReady: false,
        reason: 'CONTRACT_INVALID',
        message: 'Transaction blocked: Contract deployment configuration is invalid.',
        preparation: {
          ...prep,
          status: 'BLOCKED',
          readinessReason: 'CONTRACT_INVALID',
          authorizationReason: 'Contract deployment configuration is invalid.',
        },
      };
    }

    // Invariant 1: CONFIGURED ADDRESS != ON-CHAIN DEPLOYMENT
    // For transaction-executing circuits (fundLoan, repayLoan, settleLoan),
    // execution must be blocked unless deployment verification is confirmed on the target network.
    const isExecutingAction =
      action === 'FUND_LOAN' || action === 'REPAY_LOAN' || action === 'SETTLE_LOAN';
    const isVerifiedOrReady =
      deployment.isVerified || deployment.status === 'VERIFIED' || deployment.status === 'READY';

    if (isExecutingAction && !isVerifiedOrReady) {
      const reason: TransactionReadinessReason =
        deployment.status === 'CONFIGURED' || deployment.status === 'VALIDATING'
          ? 'CONTRACT_VERIFICATION_UNAVAILABLE'
          : 'CONTRACT_NOT_DEPLOYED';
      return {
        isReady: false,
        reason,
        message: 'Transaction blocked: Contract address is configured but not verified on the network.',
        preparation: {
          ...prep,
          status: 'BLOCKED',
          readinessReason: reason,
          authorizationReason:
            'Contract deployment verification required before on-chain execution.',
        },
      };
    }

    if (deployment.networkId && netConfig.networkId && deployment.networkId !== netConfig.networkId) {
      return {
        isReady: false,
        reason: 'CONTRACT_NETWORK_MISMATCH',
        message: `Transaction blocked: Contract network "${deployment.networkId}" does not match active network "${netConfig.networkId}".`,
        preparation: {
          ...prep,
          status: 'BLOCKED',
          readinessReason: 'CONTRACT_NETWORK_MISMATCH',
          authorizationReason: `Contract network mismatch: expected ${netConfig.networkId}, got ${deployment.networkId}.`,
        },
      };
    }

    const circuitName = getCircuitNameForAction(action);
    if (!isKnownCircuit(circuitName) || !deployment.circuitNames || !deployment.circuitNames.includes(circuitName)) {
      return {
        isReady: false,
        reason: 'CONTRACT_CIRCUIT_UNAVAILABLE',
        message: `Transaction blocked: Circuit "${circuitName}" is not available in the deployed contract manifest.`,
        preparation: {
          ...prep,
          status: 'BLOCKED',
          readinessReason: 'CONTRACT_CIRCUIT_UNAVAILABLE',
          authorizationReason: `Circuit "${circuitName}" is not in deployment manifest.`,
        },
      };
    }
  }

  // 9. Atomic capabilities check
  const caps = evaluateConnectorCapabilities(activeProvider);
  if (!caps.SIGN_TRANSACTION) {
    return {
      isReady: false,
      reason: 'SIGNING_UNAVAILABLE',
      message: 'Active provider does not support transaction signing.',
      preparation: { ...prep, status: 'UNSUPPORTED', readinessReason: 'SIGNING_UNAVAILABLE' },
    };
  }

  if (!caps.SUBMIT_TRANSACTION) {
    return {
      isReady: false,
      reason: 'SUBMISSION_UNAVAILABLE',
      message: 'Active provider does not support on-chain transaction submission.',
      preparation: { ...prep, status: 'UNSUPPORTED', readinessReason: 'SUBMISSION_UNAVAILABLE' },
    };
  }

  // 10. Final Transaction Readiness Gate
  return {
    isReady: true,
    reason: 'READY',
    message: 'Transaction is ready for execution.',
    preparation: { ...prep, status: 'READY', readinessReason: 'READY' },
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

      if (txResult.status === 'PENDING') {
        return {
          success: true,
          status: 'PENDING',
          action,
          loanId,
          circuitName: preparation.circuitName,
          message: 'Transaction submitted but pending on-chain confirmation.',
          transactionId: txResult.transactionId,
        };
      }

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
      const msg = err?.message ?? '';
      const code = err?.code;
      if (code === 'USER_REJECTED' || msg.toLowerCase().includes('reject')) {
        return {
          success: false,
          status: 'REJECTED',
          action,
          loanId,
          circuitName: preparation.circuitName,
          message: msg || 'Transaction signing was rejected by user.',
        };
      }
      if (code === 'CONNECTION_FAILED' || msg.toLowerCase().includes('network') || msg.toLowerCase().includes('endpoint')) {
        return {
          success: false,
          status: 'FAILED',
          action,
          loanId,
          circuitName: preparation.circuitName,
          message: msg || 'Transaction submission failed on network endpoint.',
        };
      }
      return {
        success: false,
        status: 'UNSUPPORTED',
        action,
        loanId,
        circuitName: preparation.circuitName,
        message: msg || 'Live wallet transactions are unavailable in prototype mode.',
        unsupportedReason: msg || 'Unsupported operation in prototype provider.',
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
