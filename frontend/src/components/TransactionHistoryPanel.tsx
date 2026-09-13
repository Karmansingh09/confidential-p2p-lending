import React, { useState, useEffect, useCallback } from 'react';
import type { LoanRegistry } from '../lib/loan-registry.ts';
import type {
  PersistedTransaction,
  TransactionReconciliationResult,
  TransactionRecoveryStatus,
} from '../types/transaction-persistence.ts';
import { getTransactionPersistenceService } from '../lib/transaction-persistence-service.ts';
import { getTransactionRecoveryService } from '../lib/transaction-recovery-service.ts';

export interface TransactionHistoryPanelProps {
  onTransactionReconciled?: (result: TransactionReconciliationResult) => void;
  loanRegistry?: LoanRegistry;
  onClose?: () => void;
}

/**
 * TransactionHistoryPanel
 *
 * Visualizes locally persisted transaction lifecycle records and provides
 * recovery and reconciliation controls.
 *
 * ARCHITECTURAL PRINCIPLE:
 * "LOCAL PERSISTENCE ≠ BLOCKCHAIN CONFIRMATION"
 * Persisted records store public agreement metadata and caller identities.
 * Registry state is updated exclusively through verified wallet provider status.
 */
export const TransactionHistoryPanel: React.FC<TransactionHistoryPanelProps> = ({
  onTransactionReconciled,
  loanRegistry,
  onClose,
}) => {
  const persistenceService = getTransactionPersistenceService();
  const recoveryService = getTransactionRecoveryService();

  const [transactions, setTransactions] = useState<PersistedTransaction[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterAction, setFilterAction] = useState<string>('ALL');
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);
  const [isReconcilingAll, setIsReconcilingAll] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const loadTransactions = useCallback(() => {
    try {
      const allTxs = persistenceService.listTransactions();
      setTransactions(allTxs);
    } catch {
      setTransactions([]);
    }
  }, [persistenceService]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const handleReconcile = async (txId: string) => {
    setReconcilingId(txId);
    setFeedback(null);
    try {
      const result = await recoveryService.reconcileTransaction(txId, loanRegistry);
      loadTransactions();
      onTransactionReconciled?.(result);

      if (result.success) {
        setFeedback({
          message: `Transaction ${txId.slice(0, 10)}... reconciled: ${result.reconciledStatus} (Registry updated: ${result.registryUpdated ? 'Yes' : 'No'})`,
          type: 'success',
        });
      } else {
        setFeedback({
          message: `Reconciliation note: ${result.error ?? 'Status remains unconfirmed by provider.'}`,
          type: 'info',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFeedback({
        message: `Reconciliation error: ${msg}`,
        type: 'error',
      });
    } finally {
      setReconcilingId(null);
    }
  };

  const handleReconcileAll = async () => {
    setIsReconcilingAll(true);
    setFeedback(null);
    try {
      const results = await recoveryService.reconcileAll(loanRegistry);
      loadTransactions();
      const updatedCount = results.filter((r) => r.registryUpdated).length;
      const confirmedCount = results.filter((r) => r.reconciledStatus === 'CONFIRMED').length;

      setFeedback({
        message: `Reconciliation complete: ${results.length} checked, ${confirmedCount} confirmed, ${updatedCount} registry updates applied.`,
        type: 'success',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFeedback({
        message: `Bulk reconciliation error: ${msg}`,
        type: 'error',
      });
    } finally {
      setIsReconcilingAll(false);
    }
  };

  const handleClearHistory = () => {
    persistenceService.clearTransactions();
    loadTransactions();
    setFeedback({
      message: 'Local transaction history cleared.',
      type: 'info',
    });
  };

  // Filter items
  const filteredTransactions = transactions.filter((tx) => {
    if (filterStatus !== 'ALL') {
      if (filterStatus === 'PENDING' && tx.status !== 'SUBMITTED' && tx.status !== 'SUBMITTING' && tx.recoveryStatus !== 'PENDING') {
        return false;
      }
      if (filterStatus === 'CONFIRMED' && tx.status !== 'CONFIRMED') {
        return false;
      }
      if (filterStatus === 'FAILED' && tx.status !== 'FAILED') {
        return false;
      }
      if (filterStatus === 'REJECTED' && tx.status !== 'REJECTED') {
        return false;
      }
      if (filterStatus === 'UNSUPPORTED' && tx.status !== 'UNSUPPORTED' && tx.status !== 'BLOCKED') {
        return false;
      }
    }
    if (filterAction !== 'ALL' && tx.action !== filterAction) {
      return false;
    }
    return true;
  });

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return { background: '#14532d', color: '#86efac', border: '1px solid #16a34a' };
      case 'SUBMITTED':
      case 'SUBMITTING':
        return { background: '#1e3a8a', color: '#93c5fd', border: '1px solid #2563eb' };
      case 'REJECTED':
        return { background: '#581c87', color: '#d8b4fe', border: '1px solid #9333ea' };
      case 'FAILED':
        return { background: '#7f1d1d', color: '#fca5a5', border: '1px solid #dc2626' };
      case 'UNSUPPORTED':
      case 'BLOCKED':
      default:
        return { background: '#334155', color: '#94a3b8', border: '1px solid #475569' };
    }
  };

  const getRecoveryBadgeStyle = (recovery: TransactionRecoveryStatus) => {
    switch (recovery) {
      case 'CONFIRMED':
        return { background: '#064e3b', color: '#a7f3d0' };
      case 'PENDING':
      case 'RECOVERABLE':
        return { background: '#78350f', color: '#fde68a' };
      case 'UNSUPPORTED':
        return { background: '#1e293b', color: '#94a3b8' };
      case 'FAILED':
      case 'REJECTED':
      default:
        return { background: '#450a0a', color: '#fecaca' };
    }
  };

  const formatTimestamp = (ts?: number) => {
    if (!ts) return 'N/A';
    return new Date(ts).toLocaleTimeString();
  };

  return (
    <div
      style={{
        background: '#0f172a',
        border: '1px solid #334155',
        borderRadius: '10px',
        padding: '20px',
        margin: '16px 0',
        color: '#f8fafc',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
      }}
      data-testid="transaction-history-panel"
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
        <div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#f8fafc', fontWeight: 600 }}>
            Transaction History & Lifecycle Recovery
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
            Locally persisted records with provider-backed reconciliation and crash recovery.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleReconcileAll}
            disabled={isReconcilingAll || transactions.length === 0}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              background: isReconcilingAll ? '#334155' : '#2563eb',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: isReconcilingAll || transactions.length === 0 ? 'not-allowed' : 'pointer',
            }}
            data-testid="reconcile-all-button"
          >
            {isReconcilingAll ? 'Reconciling...' : 'Reconcile All'}
          </button>
          <button
            onClick={handleClearHistory}
            disabled={transactions.length === 0}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #475569',
              background: 'transparent',
              color: '#94a3b8',
              fontSize: '0.85rem',
              cursor: transactions.length === 0 ? 'not-allowed' : 'pointer',
            }}
            data-testid="clear-history-button"
          >
            Clear
          </button>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #475569',
                background: 'transparent',
                color: '#94a3b8',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Honest Anti-Fabrication Notice */}
      <div
        style={{
          background: 'rgba(30, 58, 138, 0.25)',
          borderLeft: '4px solid #3b82f6',
          padding: '10px 14px',
          borderRadius: '4px',
          marginBottom: '16px',
          fontSize: '0.8rem',
          color: '#cbd5e1',
          lineHeight: '1.4',
        }}
      >
        <span style={{ fontWeight: 600, color: '#93c5fd' }}>LOCAL PERSISTENCE ≠ BLOCKCHAIN CONFIRMATION:</span>{' '}
        This panel records locally persisted lifecycle metadata and off-chain execution requests.
        Canonical loan registry status is updated strictly when the active wallet provider verifies
        on-chain confirmation.
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '6px',
            marginBottom: '14px',
            fontSize: '0.85rem',
            background:
              feedback.type === 'success'
                ? 'rgba(20, 83, 45, 0.3)'
                : feedback.type === 'error'
                ? 'rgba(127, 29, 29, 0.3)'
                : 'rgba(30, 58, 138, 0.3)',
            color:
              feedback.type === 'success'
                ? '#86efac'
                : feedback.type === 'error'
                ? '#fca5a5'
                : '#93c5fd',
            border:
              feedback.type === 'success'
                ? '1px solid #16a34a'
                : feedback.type === 'error'
                ? '1px solid #dc2626'
                : '1px solid #2563eb',
          }}
          data-testid="transaction-history-feedback"
        >
          {feedback.message}
        </div>
      )}

      {/* Filter Controls */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '14px',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Status:</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              background: '#1e293b',
              color: '#f8fafc',
              border: '1px solid #334155',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '0.8rem',
            }}
            data-testid="filter-status-select"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending / Submitting</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="FAILED">Failed</option>
            <option value="REJECTED">Rejected</option>
            <option value="UNSUPPORTED">Unsupported / Blocked</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Action:</label>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            style={{
              background: '#1e293b',
              color: '#f8fafc',
              border: '1px solid #334155',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '0.8rem',
            }}
            data-testid="filter-action-select"
          >
            <option value="ALL">All Actions</option>
            <option value="FUND_LOAN">Fund Loan</option>
            <option value="REPAY_LOAN">Repay Loan</option>
            <option value="SETTLE_LOAN">Settle Loan</option>
            <option value="VERIFY_ELIGIBILITY">Verify Eligibility</option>
          </select>
        </div>

        <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: 'auto' }}>
          Showing {filteredTransactions.length} of {transactions.length} transactions
        </span>
      </div>

      {/* Transaction List */}
      {filteredTransactions.length === 0 ? (
        <div
          style={{
            padding: '24px',
            textAlign: 'center',
            color: '#64748b',
            fontSize: '0.9rem',
            background: '#0b1120',
            borderRadius: '8px',
            border: '1px dashed #334155',
          }}
          data-testid="empty-transaction-history"
        >
          No persisted transactions found matching the selected filters.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredTransactions.map((tx) => {
            const statusStyle = getStatusBadgeStyle(tx.status);
            const recoveryStyle = getRecoveryBadgeStyle(tx.recoveryStatus);
            const isReconcilingThis = reconcilingId === tx.id;
            const canReconcile =
              tx.recoveryStatus === 'PENDING' ||
              tx.recoveryStatus === 'RECOVERABLE' ||
              tx.status === 'SUBMITTED' ||
              tx.status === 'SUBMITTING';

            return (
              <div
                key={tx.id}
                style={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '14px',
                }}
                data-testid={`tx-row-${tx.id}`}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '8px',
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        color: '#f8fafc',
                        marginRight: '8px',
                      }}
                    >
                      {tx.action}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      Loan ID: {tx.loanId}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '10px',
                        ...statusStyle,
                      }}
                      data-testid={`tx-status-${tx.id}`}
                    >
                      {tx.status}
                    </span>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '10px',
                        ...recoveryStyle,
                      }}
                      data-testid={`tx-recovery-${tx.id}`}
                    >
                      {tx.recoveryStatus}
                    </span>
                  </div>
                </div>

                {/* Metadata Row */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: '8px',
                    fontSize: '0.78rem',
                    color: '#cbd5e1',
                    marginBottom: '10px',
                  }}
                >
                  <div>
                    <span style={{ color: '#64748b' }}>Circuit: </span>
                    <code>{tx.circuitName}()</code>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Network: </span>
                    <span>{tx.networkId}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Provider: </span>
                    <span>{tx.providerKind}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Created: </span>
                    <span>{formatTimestamp(tx.createdAt)}</span>
                  </div>
                  {tx.providerTransactionId && (
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ color: '#64748b' }}>Tx ID: </span>
                      <code style={{ fontSize: '0.72rem' }}>{tx.providerTransactionId}</code>
                    </div>
                  )}
                  {tx.blockHeight !== undefined && (
                    <div>
                      <span style={{ color: '#64748b' }}>Block: </span>
                      <span>#{tx.blockHeight.toString()}</span>
                    </div>
                  )}
                  {tx.amount !== undefined && (
                    <div>
                      <span style={{ color: '#64748b' }}>Amount: </span>
                      <span>{tx.amount.toString()}</span>
                    </div>
                  )}
                </div>

                {/* Error/Notice Message if any */}
                {tx.error && (
                  <div
                    style={{
                      fontSize: '0.76rem',
                      color: '#fca5a5',
                      background: 'rgba(127, 29, 29, 0.2)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      marginBottom: '8px',
                    }}
                  >
                    Note: {tx.error}
                  </div>
                )}

                {/* Reconcile Action Button */}
                {canReconcile && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                    <button
                      onClick={() => handleReconcile(tx.id)}
                      disabled={isReconcilingThis}
                      style={{
                        padding: '4px 12px',
                        borderRadius: '4px',
                        border: '1px solid #3b82f6',
                        background: isReconcilingThis ? '#1e293b' : 'rgba(59, 130, 246, 0.15)',
                        color: '#93c5fd',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: isReconcilingThis ? 'not-allowed' : 'pointer',
                      }}
                      data-testid={`reconcile-btn-${tx.id}`}
                    >
                      {isReconcilingThis ? 'Checking Status...' : 'Reconcile Status'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
