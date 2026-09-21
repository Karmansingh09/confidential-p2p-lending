import React from 'react';
import type { LoanDetailsModel } from '../types/index.ts';
import type { AccountContext } from '../types/account.ts';
import type {
  LifecycleTransactionAction,
  TransactionOrchestrationResult,
} from '../types/transaction-orchestration.ts';
import type { TransactionExecutionResult } from '../types/transaction-execution.ts';
import {
  prepareLifecycleTransaction,
  getCircuitNameForAction,
  getRequiredCapabilitiesForAction,
} from '../lib/transaction-orchestrator.ts';
import {
  getCircuitDefinition,
  getInvocationClassification,
} from '../lib/contract-manifest.ts';
import { getWalletProvider } from '../lib/account-service.ts';
import { getContractDeploymentService } from '../lib/contract-deployment-service.ts';
import { getContractStateInspectionService } from '../lib/contract-state-inspection-service.ts';
import { getNetworkConfigService } from '../lib/network-config-service.ts';
import { evaluateNetworkCompatibility } from '../lib/wallet-network-compatibility.ts';

export interface TransactionReviewPanelProps {
  loan: LoanDetailsModel | null;
  loanId: string;
  action: LifecycleTransactionAction;
  accountContext?: AccountContext;
  onExecute?: () => void;
  onClose: () => void;
  isExecuting?: boolean;
  executionResult?: TransactionOrchestrationResult | TransactionExecutionResult | null;
}

/**
 * Pre-execution Transaction Review Panel.
 *
 * Provides full transparency before executing any contract-guarded lifecycle action:
 * - Displays exact mapped Midnight Compact circuit
 * - Verifies caller authorization and public identity
 * - Assesses atomic provider capabilities
 * - Discloses honest limitations without fake transaction hashes
 */
export const TransactionReviewPanel: React.FC<TransactionReviewPanelProps> = ({
  loan,
  loanId,
  action,
  accountContext,
  onExecute,
  onClose,
  isExecuting = false,
  executionResult,
}) => {
  const provider = getWalletProvider();
  const deploymentService = getContractDeploymentService();
  const deployment = deploymentService.getDeployment();
  const isContractConfigured =
    Boolean(deployment.contractAddress) &&
    deployment.status !== 'NOT_DEPLOYED' &&
    deployment.status !== 'UNCONFIGURED' &&
    deployment.status !== 'INVALID';
  const isContractVerified =
    deployment.isVerified || deployment.status === 'VERIFIED' || deployment.status === 'READY';
  const isExecutingAction =
    action === 'FUND_LOAN' || action === 'REPAY_LOAN' || action === 'SETTLE_LOAN';
  const prep = prepareLifecycleTransaction(loan, accountContext, action, provider, deploymentService);
  const circuitName = getCircuitNameForAction(action);
  const requiredCaps = getRequiredCapabilitiesForAction(action);
  const providerCaps = provider.getCapabilities();
  const netContext = provider.getNetworkContext();

  const isReady =
    prep.status === 'READY' &&
    isContractConfigured &&
    (!isExecutingAction || isContractVerified);
  const callerHex = prep.callerPublicKeyHex || 'None (Disconnected)';
  const shortCallerHex =
    callerHex.length > 16
      ? `${callerHex.slice(0, 8)}...${callerHex.slice(-6)}`
      : callerHex;

  const netConfig = getNetworkConfigService().getNetworkConfig();
  const walletNetworkId = typeof provider.getReportedNetworkId === 'function' ? provider.getReportedNetworkId() : null;
  let networkStatusText: 'MATCH' | 'MISMATCH' | 'UNKNOWN' = 'UNKNOWN';
  if (netConfig.environment === 'LOCAL') {
    networkStatusText = 'MATCH';
  } else if (walletNetworkId && netConfig.networkId) {
    const comp = evaluateNetworkCompatibility(netConfig, walletNetworkId);
    networkStatusText = comp.compatibility === 'MATCH' ? 'MATCH' : comp.compatibility === 'MISMATCH' ? 'MISMATCH' : 'UNKNOWN';
  } else if (netConfig.networkId) {
    networkStatusText = 'MATCH';
  }

  const contractStatusText: 'VERIFIED' | 'NOT VERIFIED' | 'NOT CONFIGURED' = isContractVerified
    ? 'VERIFIED'
    : isContractConfigured
    ? 'NOT VERIFIED'
    : 'NOT CONFIGURED';

  const isWalletConnected = Boolean(accountContext?.identity?.publicKey) || Boolean(prep.callerPublicKeyHex);
  const walletStatusText: 'CONNECTED' | 'DISCONNECTED' = isWalletConnected ? 'CONNECTED' : 'DISCONNECTED';
  const signingStatusText: 'AVAILABLE' | 'UNAVAILABLE' = providerCaps.SIGN_TRANSACTION ? 'AVAILABLE' : 'UNAVAILABLE';
  const submissionStatusText: 'AVAILABLE' | 'UNAVAILABLE' = providerCaps.SUBMIT_TRANSACTION ? 'AVAILABLE' : 'UNAVAILABLE';

  let invocationStatusText: 'READY' | 'BLOCKED' | 'UNSUPPORTED' = 'BLOCKED';
  if (isReady) {
    invocationStatusText = 'READY';
  } else if (prep.status === 'UNSUPPORTED' || (isExecutingAction && provider.isPrototype)) {
    invocationStatusText = 'UNSUPPORTED';
  } else {
    invocationStatusText = 'BLOCKED';
  }

  const stateInspectionService = getContractStateInspectionService();
  const stateSnapshot = stateInspectionService.getInspectionState();
  const stateStatusText = stateSnapshot.status;

  const circuitDef = getCircuitDefinition(circuitName);
  const classification = circuitDef?.classification ?? getInvocationClassification(circuitName) ?? (action === 'VERIFY_ELIGIBILITY' ? 'LOCAL_PROOF' : 'TRANSACTION_EXECUTION');

  const getStatusBadge = () => {
    if (isExecuting) {
      return { text: 'SIGNING / SUBMITTING...', bg: '#1e3a8a', color: '#93c5fd' };
    }
    if (!isContractConfigured) {
      return { text: 'Contract: NOT CONFIGURED', bg: '#7f1d1d', color: '#fca5a5' };
    }
    if (isExecutingAction && !isContractVerified) {
      return { text: 'CONTRACT NOT VERIFIED — BLOCKED', bg: '#7f1d1d', color: '#fca5a5' };
    }
    switch (prep.status) {
      case 'READY':
        return { text: 'READY TO SIGN & SUBMIT', bg: '#14532d', color: '#86efac' };
      case 'BLOCKED':
        return { text: 'BLOCKED BY GUARDS', bg: '#7f1d1d', color: '#fca5a5' };
      case 'UNSUPPORTED':
        return { text: 'UNSUPPORTED IN ENVIRONMENT', bg: '#854d0e', color: '#fef08a' };
      case 'INVALID':
      default:
        return { text: 'INVALID PARAMETERS', bg: '#991b1b', color: '#fecaca' };
    }
  };

  const statusBadge = getStatusBadge();

  return (
    <div
      style={{
        background: '#0f172a',
        border: '1px solid #3b82f6',
        borderRadius: '10px',
        padding: '20px',
        margin: '16px 0',
        color: '#f8fafc',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
      }}
      data-testid="transaction-review-panel"
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #334155',
          paddingBottom: '12px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--accent-primary, #9FB8D8)' }} aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </span>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
              Transaction Review &amp; Pre-Execution Readiness
            </h3>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              Inspect Compact circuit parameters and authorization boundaries before dispatch
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.05em',
              background: statusBadge.bg,
              color: statusBadge.color,
            }}
          >
            {statusBadge.text}
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '0 4px',
            }}
            aria-label="Close review"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Review Details Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div style={{ background: '#1e293b', padding: '12px', borderRadius: '6px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>
            Agreement Identifier
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#60a5fa', marginTop: '2px' }}>
            {loanId}
          </div>
        </div>

        <div style={{ background: '#1e293b', padding: '12px', borderRadius: '6px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>
            Lifecycle Action
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
            {action}
          </div>
        </div>

        <div style={{ background: '#1e293b', padding: '12px', borderRadius: '6px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>
            Mapped Compact Circuit
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#a78bfa', marginTop: '2px' }}>
            <code>{circuitName}()</code>
          </div>
        </div>

        <div style={{ background: '#1e293b', padding: '12px', borderRadius: '6px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>
            Caller Role &amp; Identity
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
            {accountContext?.selectedRole ?? 'NONE'} ({shortCallerHex})
          </div>
        </div>

        <div style={{ background: '#1e293b', padding: '12px', borderRadius: '6px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>
            Active Provider
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
            {provider.name} {provider.isPrototype ? '(Simulation)' : '(Real Adapter)'}
          </div>
        </div>

        <div style={{ background: '#1e293b', padding: '12px', borderRadius: '6px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>
            Network Environment
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
            {netContext.networkName}
          </div>
        </div>

        <div style={{ background: '#1e293b', padding: '12px', borderRadius: '6px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>
            Contract Status
          </div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: isContractVerified ? '#a7f3d0' : isContractConfigured ? '#fde68a' : '#fca5a5',
              marginTop: '2px',
            }}
          >
            {isContractVerified
              ? `VERIFIED ON NETWORK (${deployment.contractName})`
              : isContractConfigured
              ? 'CONFIGURED (NOT VERIFIED ON NETWORK)'
              : 'Contract: NOT CONFIGURED'}
          </div>
        </div>
      </div>

      {/* Technical Invocation Diagnostics Grid */}
      <div
        style={{
          background: '#1e293b',
          padding: '14px',
          borderRadius: '6px',
          marginBottom: '16px',
          border: '1px solid #334155',
        }}
        data-testid="technical-diagnostics-grid"
      >
        <div
          style={{
            fontSize: '12px',
            fontWeight: 600,
            marginBottom: '10px',
            color: '#cbd5e1',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>⚙️</span>
          <span>Technical Invocation Diagnostics</span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '8px',
          }}
        >
          <div style={{ background: '#0f172a', padding: '8px 10px', borderRadius: '4px' }} data-testid="diagnostic-circuit">
            <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Circuit</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#a78bfa', fontFamily: 'monospace', marginTop: '2px' }}>
              {circuitName}
            </div>
          </div>
          <div style={{ background: '#0f172a', padding: '8px 10px', borderRadius: '4px' }} data-testid="diagnostic-classification">
            <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Classification</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-primary)', marginTop: '2px' }}>
              {classification}
            </div>
          </div>
          <div style={{ background: '#0f172a', padding: '8px 10px', borderRadius: '4px' }} data-testid="diagnostic-contract">
            <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Contract</div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: contractStatusText === 'VERIFIED' ? '#86efac' : '#fca5a5',
                marginTop: '2px',
              }}
            >
              {contractStatusText}
            </div>
          </div>
          <div style={{ background: '#0f172a', padding: '8px 10px', borderRadius: '4px' }} data-testid="diagnostic-contract-verification">
            <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Verification</div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: isContractVerified ? '#86efac' : '#fca5a5',
                marginTop: '2px',
              }}
            >
              {isContractVerified ? 'VERIFIED' : 'UNVERIFIED'}
            </div>
          </div>
          <div style={{ background: '#0f172a', padding: '8px 10px', borderRadius: '4px' }} data-testid="diagnostic-network">
            <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Network</div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: networkStatusText === 'MATCH' ? '#86efac' : '#fca5a5',
                marginTop: '2px',
              }}
            >
              {networkStatusText}
            </div>
          </div>
          <div style={{ background: '#0f172a', padding: '8px 10px', borderRadius: '4px' }} data-testid="diagnostic-wallet">
            <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Wallet</div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: walletStatusText === 'CONNECTED' ? '#86efac' : '#fca5a5',
                marginTop: '2px',
              }}
            >
              {walletStatusText}
            </div>
          </div>
          <div style={{ background: '#0f172a', padding: '8px 10px', borderRadius: '4px' }} data-testid="diagnostic-signing">
            <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Signing</div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: signingStatusText === 'AVAILABLE' ? '#86efac' : '#fca5a5',
                marginTop: '2px',
              }}
            >
              {signingStatusText}
            </div>
          </div>
          <div style={{ background: '#0f172a', padding: '8px 10px', borderRadius: '4px' }} data-testid="diagnostic-submission">
            <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Submission</div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: submissionStatusText === 'AVAILABLE' ? '#86efac' : '#fca5a5',
                marginTop: '2px',
              }}
            >
              {submissionStatusText}
            </div>
          </div>
          <div style={{ background: '#0f172a', padding: '8px 10px', borderRadius: '4px' }} data-testid="diagnostic-invocation-readiness">
            <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Readiness</div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color:
                  invocationStatusText === 'READY'
                    ? '#86efac'
                    : invocationStatusText === 'UNSUPPORTED'
                    ? '#fde68a'
                    : '#fca5a5',
                marginTop: '2px',
              }}
            >
              {invocationStatusText}
            </div>
          </div>
          <div style={{ background: '#0f172a', padding: '8px 10px', borderRadius: '4px' }} data-testid="diagnostic-preparation-status">
            <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Preparation</div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: isReady ? '#86efac' : '#fde68a',
                marginTop: '2px',
              }}
            >
              {isReady ? 'PREPARED' : prep.status}
            </div>
          </div>
          <div style={{ background: '#0f172a', padding: '8px 10px', borderRadius: '4px' }} data-testid="diagnostic-required-capabilities">
            <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Required Caps</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0', marginTop: '2px' }}>
              {(prep as any)?.requiresSubmission ? 'SIGN + SUBMIT' : (prep as any)?.requiresProof ? 'CLIENT ZK PROOF' : 'READ LEDGER'}
            </div>
          </div>
          <div style={{ background: '#0f172a', padding: '8px 10px', borderRadius: '4px' }} data-testid="diagnostic-state-inspection">
            <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>State Inspection</div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color:
                  stateStatusText === 'VERIFIED' || stateStatusText === 'AVAILABLE'
                    ? '#86efac'
                    : stateStatusText === 'CHECKING'
                    ? '#93c5fd'
                    : stateStatusText === 'UNSUPPORTED'
                    ? '#fde68a'
                    : '#94a3b8',
                marginTop: '2px',
              }}
            >
              {stateStatusText}
            </div>
          </div>
        </div>
        {(!isReady || invocationStatusText === 'BLOCKED') && (
          <div
            style={{
              marginTop: '10px',
              padding: '8px 12px',
              background: '#450a0a',
              borderRadius: '4px',
              border: '1px solid #7f1d1d',
              fontSize: '12px',
              color: '#fca5a5',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            data-testid="diagnostic-blocking-reason"
          >
            <span style={{ fontWeight: 700 }}>⛔ Blocking Reason:</span>
            <span>{(prep as any)?.reason ?? (prep as any)?.message ?? (!isContractVerified ? 'Contract deployment is not verified on-chain.' : 'Transaction readiness evaluation failed.')}</span>
          </div>
        )}
      </div>

      {/* 5-Stage Boundary Pipeline Chips */}
      <div
        style={{
          background: '#1e293b',
          padding: '10px 14px',
          borderRadius: '6px',
          marginBottom: '16px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          alignItems: 'center',
        }}
        data-testid="transaction-pipeline-ribbon"
      >
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>
          Boundary Pipeline:
        </span>
        <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '4px', background: isReady ? '#14532d' : '#7f1d1d', color: isReady ? '#86efac' : '#fca5a5' }}>
          1. Validated
        </span>
        <span style={{ fontSize: '12px', color: '#64748b' }}>➔</span>
        <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '4px', background: providerCaps.SIGN_TRANSACTION ? '#1e3a8a' : '#475569', color: providerCaps.SIGN_TRANSACTION ? '#93c5fd' : '#cbd5e1' }}>
          2. Sign {providerCaps.SIGN_TRANSACTION ? '(Available)' : '(Unavailable)'}
        </span>
        <span style={{ fontSize: '12px', color: '#64748b' }}>➔</span>
        <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '4px', background: providerCaps.SUBMIT_TRANSACTION ? '#1e3a8a' : '#475569', color: providerCaps.SUBMIT_TRANSACTION ? '#93c5fd' : '#cbd5e1' }}>
          3. Submit {providerCaps.SUBMIT_TRANSACTION ? '(Available)' : '(Unavailable)'}
        </span>
        <span style={{ fontSize: '12px', color: '#64748b' }}>➔</span>
        <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '4px', background: '#334155', color: '#cbd5e1' }}>
          4. Status Tracking
        </span>
      </div>

      {/* Capabilities Comparison */}
      <div
        style={{
          background: '#1e293b',
          padding: '12px 16px',
          borderRadius: '6px',
          marginBottom: '16px',
        }}
      >
        <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: '#cbd5e1' }}>
          Capability Requirements &amp; Evaluation
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {requiredCaps.map((cap) => {
            const hasCap = !!providerCaps[cap];
            return (
              <span
                key={cap}
                style={{
                  fontSize: '12px',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  background: hasCap ? '#14532d' : '#7f1d1d',
                  color: hasCap ? '#bbf7d0' : '#fecaca',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>{hasCap ? '✓' : '✗'}</span>
                <span>{cap}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Honest Technical Explanation & Limitations */}
      <div
        style={{
          background: prep.status === 'READY' ? 'rgba(78, 135, 112, 0.15)' : 'rgba(196, 158, 88, 0.12)',
          borderLeft: `4px solid ${prep.status === 'READY' ? 'var(--status-success)' : 'var(--status-warning)'}`,
          padding: '12px 16px',
          borderRadius: '0 6px 6px 0',
          marginBottom: '16px',
        }}
      >
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc', marginBottom: '4px' }}>
          {prep.status === 'READY'
            ? 'Pre-Execution Verification Passed'
            : 'Execution Constraint Notice'}
        </div>
        <p style={{ margin: 0, fontSize: '12px', color: '#e2e8f0', lineHeight: 1.5 }}>
          {prep.status === 'READY' && action === 'VERIFY_ELIGIBILITY' && (
            <>
              Proof generation occurs locally and privately off-chain using the client zero-knowledge prover.
              Secret underwriting metrics never leave the local environment.
            </>
          )}
          {prep.status === 'UNSUPPORTED' && (
            <>
              Live transaction signing/submission is unavailable in the current environment.{' '}
              {provider.isPrototype
                ? 'Live transaction submission is unavailable in prototype mode.'
                : 'Wallet detected, but this transaction capability is not available through the current adapter.'}{' '}
              {prep.authorizationReason}
            </>
          )}
          {prep.status === 'BLOCKED' && (
            <>
              {prep.authorizationReason ?? 'This action cannot proceed under canonical Compact contract rules.'}
            </>
          )}
          {prep.status === 'INVALID' && (
            <>
              {prep.authorizationReason ?? 'Invalid agreement parameters.'}
            </>
          )}
          {isContractVerified ? (
            <span style={{ display: 'block', color: '#86efac', marginTop: '6px' }}>
              Contract: VERIFIED
            </span>
          ) : isContractConfigured ? (
            <span style={{ display: 'block', color: '#fca5a5', marginTop: '6px' }}>
              Contract: NOT VERIFIED — execution blocked
            </span>
          ) : (
            <span style={{ display: 'block', color: '#fca5a5', marginTop: '6px' }}>
              Contract: NOT CONFIGURED
              <span style={{ display: 'block' }}>
                Contract deployment is not configured for this network.
              </span>
            </span>
          )}
        </p>
      </div>

      {/* Execution Result (if dispatched) */}
      {executionResult && (() => {
        const receipt = 'receipt' in executionResult ? executionResult.receipt : undefined;
        const txId = (executionResult as { transactionId?: string }).transactionId ?? receipt?.transactionId;
        const blockHeight = (executionResult as { blockHeight?: bigint }).blockHeight ?? receipt?.blockHeight;
        const confState = 'confirmationState' in executionResult ? executionResult.confirmationState : undefined;

        let bg = '#450a0a';
        let border = '#b91c1c';
        let title = `Dispatch Outcome: ${executionResult.status}`;

        if (executionResult.status === 'CONFIRMED') {
          bg = 'rgba(78, 135, 112, 0.15)';
          border = 'var(--status-success)';
          title = 'Transaction Confirmed';
        } else if (executionResult.status === 'PENDING') {
          bg = '#1e3a8a';
          border = '#3b82f6';
          title = 'Submission Pending Confirmation';
        } else if (executionResult.status === 'REJECTED') {
          bg = '#7f1d1d';
          border = '#ef4444';
          title = 'Transaction Rejected by User';
        } else if (executionResult.status === 'UNSUPPORTED') {
          bg = '#854d0e';
          border = '#f59e0b';
          title = 'Operation Unsupported';
        } else if (executionResult.status === 'FAILED') {
          bg = '#7f1d1d';
          border = '#b91c1c';
          title = 'Transaction Failed';
        }

        return (
          <div
            style={{
              background: bg,
              border: `1px solid ${border}`,
              borderRadius: '6px',
              padding: '12px',
              marginBottom: '16px',
            }}
            data-testid="execution-result-banner"
          >
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc' }}>
              {title}
            </div>
            <div style={{ fontSize: '12px', color: '#e2e8f0', marginTop: '4px' }}>
              {executionResult.message}
            </div>
            {txId && (
              <div style={{ fontSize: '12px', color: '#93c5fd', marginTop: '4px', fontFamily: 'monospace' }}>
                Transaction ID: {txId}
              </div>
            )}
            {blockHeight !== undefined && (
              <div style={{ fontSize: '12px', color: '#93c5fd', marginTop: '2px', fontFamily: 'monospace' }}>
                Block Height: {blockHeight.toString()}
              </div>
            )}
            {confState === 'UNCONFIRMED_PRESERVED' && (
              <div style={{ fontSize: '12px', color: '#fef08a', marginTop: '4px' }}>
                Agreement state preserved. Registry will not advance until transaction is confirmed.
              </div>
            )}
            {executionResult.unsupportedReason && (
              <div style={{ fontSize: '12px', color: '#fca5a5', marginTop: '4px' }}>
                Reason: {executionResult.unsupportedReason}
              </div>
            )}
          </div>
        );
      })()}

      {/* Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: '#334155',
            color: '#f8fafc',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Cancel Review
        </button>

        {onExecute && (
          <button
            type="button"
            onClick={onExecute}
            disabled={!isReady || isExecuting}
            style={{
              background: isReady ? '#2563eb' : '#475569',
              color: isReady ? '#ffffff' : '#94a3b8',
              border: 'none',
              padding: '8px 20px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: isReady && !isExecuting ? 'pointer' : 'not-allowed',
            }}
            data-testid="execute-reviewed-action-btn"
          >
            {isExecuting
              ? 'Executing Circuit...'
              : isReady
              ? `Confirm & Execute ${circuitName}()`
              : 'Action Unavailable'}
          </button>
        )}
      </div>
    </div>
  );
};
