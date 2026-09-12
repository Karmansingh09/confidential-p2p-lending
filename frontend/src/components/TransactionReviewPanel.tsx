import React from 'react';
import type { LoanDetailsModel } from '../types/index.ts';
import type { AccountContext } from '../types/account.ts';
import type {
  LifecycleTransactionAction,
  TransactionOrchestrationResult,
} from '../types/transaction-orchestration.ts';
import {
  prepareLifecycleTransaction,
  getCircuitNameForAction,
  getRequiredCapabilitiesForAction,
} from '../lib/transaction-orchestrator.ts';
import { getWalletProvider } from '../lib/account-service.ts';

export interface TransactionReviewPanelProps {
  loan: LoanDetailsModel | null;
  loanId: string;
  action: LifecycleTransactionAction;
  accountContext?: AccountContext;
  onExecute?: () => void;
  onClose: () => void;
  isExecuting?: boolean;
  executionResult?: TransactionOrchestrationResult | null;
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
  const prep = prepareLifecycleTransaction(loan, accountContext, action, provider);
  const circuitName = getCircuitNameForAction(action);
  const requiredCaps = getRequiredCapabilitiesForAction(action);
  const providerCaps = provider.getCapabilities();
  const netContext = provider.getNetworkContext();

  const isReady = prep.status === 'READY';
  const callerHex = prep.callerPublicKeyHex || 'None (Disconnected)';
  const shortCallerHex =
    callerHex.length > 16
      ? `${callerHex.slice(0, 8)}...${callerHex.slice(-6)}`
      : callerHex;

  const getStatusBadge = () => {
    switch (prep.status) {
      case 'READY':
        return { text: 'READY TO EXECUTE', bg: '#14532d', color: '#86efac' };
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
          <span style={{ fontSize: '20px' }}>🔍</span>
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
              fontSize: '11px',
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
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>
            Agreement Identifier
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#60a5fa', marginTop: '2px' }}>
            {loanId}
          </div>
        </div>

        <div style={{ background: '#1e293b', padding: '12px', borderRadius: '6px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>
            Lifecycle Action
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
            {action}
          </div>
        </div>

        <div style={{ background: '#1e293b', padding: '12px', borderRadius: '6px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>
            Mapped Compact Circuit
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#a78bfa', marginTop: '2px' }}>
            <code>{circuitName}()</code>
          </div>
        </div>

        <div style={{ background: '#1e293b', padding: '12px', borderRadius: '6px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>
            Caller Role &amp; Identity
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
            {accountContext?.selectedRole ?? 'NONE'} ({shortCallerHex})
          </div>
        </div>

        <div style={{ background: '#1e293b', padding: '12px', borderRadius: '6px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>
            Active Provider
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
            {provider.name} {provider.isPrototype ? '(Simulation)' : '(Real Adapter)'}
          </div>
        </div>

        <div style={{ background: '#1e293b', padding: '12px', borderRadius: '6px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>
            Network Environment
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
            {netContext.networkName}
          </div>
        </div>
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
                  fontSize: '11px',
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
          background: prep.status === 'READY' ? '#064e3b' : '#334155',
          borderLeft: `4px solid ${prep.status === 'READY' ? '#10b981' : '#f59e0b'}`,
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
        </p>
      </div>

      {/* Execution Result (if dispatched) */}
      {executionResult && (
        <div
          style={{
            background: executionResult.success ? '#064e3b' : '#450a0a',
            border: `1px solid ${executionResult.success ? '#059669' : '#b91c1c'}`,
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '16px',
          }}
          data-testid="execution-result-banner"
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc' }}>
            {executionResult.success ? 'Dispatch Outcome: Success' : `Dispatch Outcome: ${executionResult.status}`}
          </div>
          <div style={{ fontSize: '12px', color: '#e2e8f0', marginTop: '4px' }}>
            {executionResult.message}
          </div>
          {executionResult.unsupportedReason && (
            <div style={{ fontSize: '11px', color: '#fca5a5', marginTop: '4px' }}>
              Reason: {executionResult.unsupportedReason}
            </div>
          )}
        </div>
      )}

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
