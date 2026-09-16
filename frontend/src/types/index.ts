import type {
  LoanDetailsModel,
  LoanStatusText,
} from '@contracts';

/**
 * Compact contract enum matching contracts/managed/contract/index.d.ts
 */
export enum LoanStatus {
  requested = 0,
  funded = 1,
  repaid = 2,
  settled = 3,
}

export type { LoanDetailsModel, LoanStatusText };

/**
 * Protocol lifecycle stages reflecting the 5 sequential transitions.
 */
export type ProtocolPhase =
  | 'REQUESTED'
  | 'ELIGIBILITY_VERIFIED'
  | 'FUNDED'
  | 'REPAID'
  | 'SETTLED';

export interface LifecycleStepInfo {
  phase: ProtocolPhase;
  title: string;
  description: string;
  isComplete: boolean;
  isCurrent: boolean;
}

export interface NetworkConnectionState {
  isConnected: boolean;
  networkName: string;
  isMockMode: boolean;
  notice: string;
}

export type {
  LifecycleFilter,
  SortOption,
  MarketplaceLoanItem,
  LifecycleActionDescriptor,
} from '../lib/marketplace.js';

export type {
  EligibilityVerificationState,
  EligibilityFailureReason,
  EligibilityVerificationRequest,
  EligibilityPrivacyAttestation,
  EligibilityVerificationResult,
  ProofGenerationStep,
} from './eligibility.js';

export type {
  FundingReadinessStatus,
  LenderDecisionState,
  FundingReadiness,
  EvaluationWarning,
  PrivacyAttestation,
  LenderLoanEvaluation,
  FundingExecutionResult,
} from './lender.js';

export type {
  RepaymentState,
  RepaymentReadinessStatus,
  RepaymentReadiness,
  RepaymentCalculation,
  RepaymentRequest,
  RepaymentPrivacyAttestation,
  RepaymentResult,
  RepaymentFailureReason,
} from './repayment.js';

export type {
  SettlementReadinessStatus,
  SettlementReadiness,
  SettlementEvaluation,
  SettlementRequest,
  SettlementPrivacyAttestation,
  SettlementResult,
} from './settlement.js';

export type {
  AccountConnectionStatus,
  AccountRole,
  AccountIdentity,
  AccountContext,
  AccountAuthorization,
} from './account.js';

export {
  LoanRegistryError,
  type LoanRegistryErrorCode,
  type LoanRegistryState,
  type LoanRegistryPersistence,
  type LoanRegistryFilterCounts,
} from './application-state.ts';

export {
  ProviderError,
  type NetworkEnvironment,
  type NetworkConnectionStatus,
  type WalletConnectionStatus,
  type ProviderCapability,
  type ProviderCapabilities,
  type NetworkAccount,
  type NetworkContext,
  type ProviderErrorCode,
} from './network.ts';

export type {
  TransactionStatus,
  TransactionCapability,
  TransactionRequest,
  TransactionResult,
} from './transaction.ts';

export {
  TransactionOrchestrationError,
  type LifecycleTransactionAction,
  type TransactionPreparationStatus,
  type TransactionExecutionStatus,
  type TransactionPreparation,
  type TransactionExecution,
  type TransactionOrchestrationResult,
  type TransactionOrchestrationErrorCode,
} from './transaction-orchestration.ts';

export {
  WalletAdapterError,
  type WalletProviderKind,
  type WalletDetectionStatus,
  type WalletAdapterStatus,
  type WalletAccountIdentity,
  type WalletNetworkInfo,
  type WalletCapabilitySet,
  type WalletConnectionResult,
  type WalletTransactionRequest,
  type WalletTransactionResult,
  type WalletAdapterErrorCode,
} from './wallet-adapter.ts';

export {
  WalletSessionError,
  type WalletSessionStatus,
  type WalletSessionErrorCode,
  type WalletSession,
  type WalletSessionRequest,
  type WalletSessionResult,
} from './wallet-session.ts';

export {
  TransactionExecutionError,
  type ProviderSubmissionStatus,
  type ConfirmationState,
  type ConfirmationPollState,
  type TransactionExecutionStage,
  type TransactionExecutionMode,
  type TransactionExecutionErrorCode,
  type TransactionReceipt,
  type TransactionExecutionContext,
  type TransactionExecutionRequest,
  type TransactionExecutionResult,
} from './transaction-execution.ts';

export {
  NetworkConfigurationError,
  type MidnightNetwork,
  type NetworkConfigurationStatus,
  type NetworkConfigurationErrorCode,
  type NetworkEndpoint,
  type NetworkConfig,
  type ConnectorReadinessState,
  type TransactionReadinessReason,
} from './network-config.ts';

export {
  WalletHandshakeError,
  type WalletHandshakeStatus,
  type NetworkCompatibilityStatus,
  type WalletHandshakeErrorCode,
  type WalletHandshakeCapabilities,
  type WalletHandshakeState,
  type WalletHandshakeRequest,
  type WalletHandshakeResult,
} from './wallet-handshake.ts';

export {
  TransactionRequestError,
  type TransactionRequestStatus,
  type TransactionSigningStatus,
  type TransactionSubmissionStatus,
  type TrackedTransactionStatus,
  type TransactionRequestErrorCode,
  type TransactionRequestParameters,
  type TransactionSigningRequest,
  type TransactionSigningResult,
  type TransactionSubmissionRequest,
  type TransactionSubmissionResult,
  type TransactionStatusResult,
  type TransactionRequest as TransactionLifecycleRequest,
  type TransactionRequestResult,
} from './transaction-request.ts';

export {
  TransactionPersistenceError,
  type PersistedTransaction,
  type TransactionPersistenceState,
  type TransactionRecoveryStatus,
  type TransactionPersistenceErrorCode,
  type TransactionReconciliationResult,
} from './transaction-persistence.ts';

export {
  type TransactionLifecycleEventType,
  type TransactionEventSource,
  type TransactionLifecycleEvent,
} from './transaction-events.ts';

export {
  type ReconciliationStatus,
  type ReconciliationReason,
} from './transaction-reconciliation.ts';

export {
  ContractDeploymentError,
  type ContractDeploymentStatus,
  type ContractDeployment,
  type ContractCircuitClassification,
  type ContractCircuitDefinition,
  type ContractDeploymentErrorCode,
} from './contract-deployment.ts';

export {
  ContractVerificationError,
  type ContractVerificationStatus,
  type ContractVerificationReason,
  type ContractVerificationResult,
  type ContractDeploymentMetadata,
  type ContractIdentity,
  type ContractCodeMetadata,
  type ContractVerificationErrorCode,
} from './contract-verification.ts';

export {
  ContractInvocationError,
  type ContractInvocationStatus,
  type ContractInvocationErrorCode,
  type ContractInvocationRequest,
  type ContractInvocationPreparation,
  type ContractInvocationResult,
  type ContractInvocationArguments,
  type ContractInvocationContext,
  type VerifyEligibilityArguments,
  type FundLoanArguments,
  type RepayLoanArguments,
  type SettleLoanArguments,
  type GetLoanStatusArguments,
  type GetLoanDetailsArguments,
} from './contract-invocation.ts';

export {
  ContractStateInspectionError,
  DEFAULT_UNINSPECTED_SNAPSHOT,
  type ContractStateInspectionStatus,
  type ContractStateInspectionReason,
  type ContractStateSource,
  type ContractStateSnapshot,
  type ContractStateInspectionRequest,
  type ContractStateInspectionResult,
} from './contract-state-inspection.ts';

