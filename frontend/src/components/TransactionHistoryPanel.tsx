import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { LoanRegistry } from '../lib/loan-registry.ts';
import type {
  PersistedTransaction,
  TransactionReconciliationResult,
  TransactionRecoveryStatus,
} from '../types/transaction-persistence.ts';
import { getTransactionPersistenceService } from '../lib/transaction-persistence-service.ts';
import { getTransactionRecoveryService } from '../lib/transaction-recovery-service.ts';
import { getTransactionEventService } from '../lib/transaction-event-service.ts';

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
  const eventService = getTransactionEventService();

  const [transactions, setTransactions] = useState<PersistedTransaction[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterAction, setFilterAction] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);
  const [isReconcilingAll, setIsReconcilingAll] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);

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

  // Summary Metrics derived directly from real transactions
  const totalCount = transactions.length;
  const pendingCount = transactions.filter(
    (tx) => tx.status === 'SUBMITTED' || tx.status === 'SUBMITTING' || tx.recoveryStatus === 'PENDING'
  ).length;
  const confirmedCount = transactions.filter((tx) => tx.status === 'CONFIRMED').length;
  const failedCount = transactions.filter((tx) => tx.status === 'FAILED' || tx.status === 'REJECTED').length;
  const recoverableCount = transactions.filter(
    (tx) => tx.recoveryStatus === 'RECOVERABLE' || (tx.recoveryStatus === 'PENDING' && tx.status !== 'CONFIRMED')
  ).length;

  // Filter items
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (filterStatus !== 'ALL') {
        if (
          filterStatus === 'PENDING' &&
          tx.status !== 'SUBMITTED' &&
          tx.status !== 'SUBMITTING' &&
          tx.recoveryStatus !== 'PENDING'
        ) {
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
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesId = tx.id.toLowerCase().includes(q);
        const matchesLoan = tx.loanId.toLowerCase().includes(q);
        const matchesAction = tx.action.toLowerCase().includes(q);
        const matchesCircuit = tx.circuitName.toLowerCase().includes(q);
        const matchesTxId = tx.providerTransactionId?.toLowerCase().includes(q) ?? false;
        if (!matchesId && !matchesLoan && !matchesAction && !matchesCircuit && !matchesTxId) {
          return false;
        }
      }
      return true;
    });
  }, [transactions, filterStatus, filterAction, searchQuery]);

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return 'status-badge-confirmed';
      case 'SUBMITTED':
      case 'SUBMITTING':
        return 'status-badge-submitted';
      case 'REJECTED':
        return 'status-badge-rejected';
      case 'FAILED':
        return 'status-badge-failed';
      case 'UNSUPPORTED':
      case 'BLOCKED':
      default:
        return 'status-badge-unsupported';
    }
  };

  const getRecoveryBadgeClass = (recovery: TransactionRecoveryStatus) => {
    switch (recovery) {
      case 'CONFIRMED':
        return 'recovery-badge-confirmed';
      case 'PENDING':
      case 'RECOVERABLE':
        return 'recovery-badge-pending';
      case 'UNSUPPORTED':
        return 'recovery-badge-unsupported';
      case 'FAILED':
      case 'REJECTED':
      default:
        return 'recovery-badge-failed';
    }
  };

  const formatTimestamp = (ts?: number) => {
    if (!ts) return 'N/A';
    return new Date(ts).toLocaleTimeString();
  };

  const getTimelineSteps = (tx: PersistedTransaction) => {
    const isConfirmed = tx.status === 'CONFIRMED';
    const isRejected = tx.status === 'REJECTED';
    const isFailed = tx.status === 'FAILED';
    const isUnsupported = tx.status === 'UNSUPPORTED' || tx.status === 'BLOCKED';
    const isSubmitted = tx.status === 'SUBMITTED' || tx.status === 'SUBMITTING' || isConfirmed;
    const isSigned = tx.status === 'SIGNED' || isSubmitted;
    const isPrepared = tx.status !== 'DRAFT';

    return [
      { name: 'Created', completed: true, active: false, failed: false },
      { name: 'Prepared', completed: isPrepared, active: tx.status === 'PREPARING', failed: isUnsupported && !isPrepared },
      { name: 'Signing', completed: isSigned, active: tx.status === 'SIGNATURE_REQUESTED', failed: isRejected && !isSubmitted },
      { name: 'Submitted', completed: isSubmitted, active: tx.status === 'SUBMITTING', failed: isFailed && !isConfirmed },
      { name: 'Checking Network', completed: isConfirmed, active: tx.recoveryStatus === 'PENDING', failed: false },
      {
        name: isConfirmed ? 'Confirmed' : isRejected ? 'Rejected' : isFailed ? 'Failed' : isUnsupported ? 'Unsupported' : 'Pending Verification',
        completed: isConfirmed,
        active: tx.recoveryStatus === 'PENDING',
        failed: isRejected || isFailed || isUnsupported,
      },
    ];
  };

  return (
    <div className="tx-history-panel" data-testid="transaction-history-panel">
      {/* 1. Panel Header & Primary Actions */}
      <div className="tx-panel-header">
        <div className="tx-panel-title-wrap">
          <div className="tx-panel-kicker font-mono">
            <span>RECONCILIATION &amp; AUDIT</span>
            <span className="kicker-sep">//</span>
            <span>PERSISTED LOGS</span>
          </div>
          <h3 className="tx-panel-title">Transaction History &amp; Lifecycle Recovery</h3>
          <p className="tx-panel-sub">
            Locally persisted records with provider-backed reconciliation and crash recovery.
          </p>
        </div>

        <div className="tx-panel-actions font-mono">
          <button
            type="button"
            onClick={handleReconcileAll}
            disabled={isReconcilingAll || transactions.length === 0}
            className="btn-tx-reconcile-all"
            data-testid="reconcile-all-button"
          >
            {isReconcilingAll ? 'Reconciling...' : 'Reconcile All'}
          </button>
          <button
            type="button"
            onClick={handleClearHistory}
            disabled={transactions.length === 0}
            className="btn-tx-clear"
            data-testid="clear-history-button"
          >
            Clear
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="btn-tx-close"
              aria-label="Close panel"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 2. Transaction Summary Metrics Rail (Derived Real Data) */}
      <div className="tx-summary-grid font-mono">
        <div className="tx-summary-card">
          <span className="tx-summary-label">TOTAL RECORDS</span>
          <span className="tx-summary-val">{totalCount}</span>
          <span className="tx-summary-sub">Persisted Logs</span>
        </div>
        <div className="tx-summary-card">
          <span className="tx-summary-label">PENDING</span>
          <span className="tx-summary-val text-amber">{pendingCount}</span>
          <span className="tx-summary-sub">Awaiting Network</span>
        </div>
        <div className="tx-summary-card">
          <span className="tx-summary-label">CONFIRMED</span>
          <span className="tx-summary-val text-success">{confirmedCount}</span>
          <span className="tx-summary-sub">Provider Verified</span>
        </div>
        <div className="tx-summary-card">
          <span className="tx-summary-label">FAILED</span>
          <span className="tx-summary-val text-danger">{failedCount}</span>
          <span className="tx-summary-sub">Rejected / Errored</span>
        </div>
        <div className="tx-summary-card">
          <span className="tx-summary-label">RECOVERABLE</span>
          <span className="tx-summary-val text-accent">{recoverableCount}</span>
          <span className="tx-summary-sub">Reconciliation Ready</span>
        </div>
      </div>

      {/* 3. Honest Anti-Fabrication Notice */}
      <div className="tx-notice-strip font-mono">
        <div className="notice-icon">⚠</div>
        <div className="notice-content">
          <strong className="notice-heading">LOCAL PERSISTENCE ≠ BLOCKCHAIN CONFIRMATION</strong>
          <p className="notice-text">
            This panel records locally persisted lifecycle metadata and off-chain execution requests.
            Canonical loan registry status is updated strictly when the active wallet provider verifies
            on-chain confirmation.
          </p>
        </div>
      </div>

      {/* 4. Feedback Banner */}
      {feedback && (
        <div
          className={`tx-feedback-banner feedback-${feedback.type} font-mono`}
          data-testid="transaction-history-feedback"
        >
          <span className="feedback-dot" />
          <span>{feedback.message}</span>
        </div>
      )}

      {/* 5. Filter & Search Toolbar */}
      <div className="tx-filter-toolbar">
        <div className="tx-search-box">
          <span className="search-icon" aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </span>
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="tx-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
            >
              ✕
            </button>
          )}
        </div>

        <div className="tx-filter-group">
          <label htmlFor="filter-status-select" className="filter-label">Status:</label>
          <select
            id="filter-status-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="tx-filter-select"
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

        <div className="tx-filter-group">
          <label htmlFor="filter-action-select" className="filter-label">Action:</label>
          <select
            id="filter-action-select"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="tx-filter-select"
            data-testid="filter-action-select"
          >
            <option value="ALL">All Actions</option>
            <option value="FUND_LOAN">Fund Loan</option>
            <option value="REPAY_LOAN">Repay Loan</option>
            <option value="SETTLE_LOAN">Settle Loan</option>
            <option value="VERIFY_ELIGIBILITY">Verify Eligibility</option>
          </select>
        </div>

        <div className="tx-filter-counter">
          Showing {filteredTransactions.length} of {transactions.length} transactions
        </div>
      </div>

      {/* 6. Transaction List / Empty State */}
      {filteredTransactions.length === 0 ? (
        <div className="tx-empty-state font-mono" data-testid="empty-transaction-history">
          <div className="empty-icon-shield">
            <span>⬡</span>
          </div>
          <h4 className="empty-title">
            {transactions.length === 0 ? '0 TRANSACTIONS' : 'NO TRANSACTION RECORDS'}
          </h4>
          <p className="empty-desc">
            {transactions.length === 0
              ? 'NO PERSISTED EXECUTION RECORDS'
              : 'No persisted transactions found matching the selected filters.'}
          </p>
          <p className="empty-sub">
            When transaction activity occurs, lifecycle records will appear here.
          </p>
        </div>
      ) : (
        <div className="tx-records-stack">
          {filteredTransactions.map((tx) => {
            const statusClass = getStatusBadgeClass(tx.status);
            const recoveryClass = getRecoveryBadgeClass(tx.recoveryStatus);
            const isReconcilingThis = reconcilingId === tx.id;
            const canReconcile =
              tx.recoveryStatus === 'PENDING' ||
              tx.recoveryStatus === 'RECOVERABLE' ||
              tx.status === 'SUBMITTED' ||
              tx.status === 'SUBMITTING';
            const isExpanded = expandedTxId === tx.id;

            return (
              <div
                key={tx.id}
                className={`tx-record-card ${isExpanded ? 'is-expanded' : ''}`}
                data-testid={`tx-row-${tx.id}`}
              >
                {/* Card Top Row */}
                <div className="tx-record-top">
                  <div className="tx-record-identity">
                    <span className="tx-action-title font-mono">{tx.action}</span>
                    <span className="tx-loan-badge font-mono">Loan: {tx.loanId}</span>
                    <span className="tx-id-badge font-mono" title={tx.id}>
                      ID: {tx.id.slice(0, 8)}...
                    </span>
                  </div>

                  <div className="tx-badges-group font-mono">
                    <span
                      className={`tx-status-pill ${statusClass}`}
                      data-testid={`tx-status-${tx.id}`}
                    >
                      <span className="pill-dot" />
                      {tx.status}
                    </span>
                    <span
                      className={`tx-recovery-pill ${recoveryClass}`}
                      data-testid={`tx-recovery-${tx.id}`}
                    >
                      {tx.recoveryStatus}
                    </span>
                  </div>
                </div>

                {/* Metadata Grid */}
                <div className="tx-meta-grid font-mono">
                  <div className="meta-cell">
                    <span className="cell-label">Circuit:</span>
                    <code className="cell-code">{tx.circuitName}()</code>
                  </div>
                  <div className="meta-cell">
                    <span className="cell-label">Network:</span>
                    <span className="cell-val">{tx.networkId}</span>
                  </div>
                  <div className="meta-cell">
                    <span className="cell-label">Provider:</span>
                    <span className="cell-val">{tx.providerKind}</span>
                  </div>
                  <div className="meta-cell">
                    <span className="cell-label">Created:</span>
                    <span className="cell-val">{formatTimestamp(tx.createdAt)}</span>
                  </div>
                  {tx.providerTransactionId && (
                    <div className="meta-cell col-span-2">
                      <span className="cell-label">Tx ID:</span>
                      <code className="cell-code">{tx.providerTransactionId}</code>
                    </div>
                  )}
                  {tx.blockHeight !== undefined && (
                    <div className="meta-cell">
                      <span className="cell-label">Block:</span>
                      <span className="cell-val">#{tx.blockHeight.toString()}</span>
                    </div>
                  )}
                  {tx.amount !== undefined && (
                    <div className="meta-cell">
                      <span className="cell-label">Amount:</span>
                      <span className="cell-val">{tx.amount.toString()} UNITS</span>
                    </div>
                  )}
                </div>

                {/* Compact Lifecycle Timeline */}
                <div
                  className="tx-timeline-track font-mono"
                  data-testid={`tx-timeline-${tx.id}`}
                >
                  <span className="timeline-title">Timeline:</span>
                  <div className="timeline-steps-wrap">
                    {getTimelineSteps(tx).map((step, idx, arr) => (
                      <React.Fragment key={step.name}>
                        <span
                          className={`timeline-step ${
                            step.active
                              ? 'step-active'
                              : step.completed
                              ? 'step-completed'
                              : step.failed
                              ? 'step-failed'
                              : 'step-pending'
                          }`}
                        >
                          {step.completed ? '✓ ' : step.failed ? '✗ ' : ''}
                          {step.name}
                        </span>
                        {idx < arr.length - 1 && (
                          <span className="timeline-arrow" aria-hidden="true">→</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* Technical Diagnostic Section (LOCAL vs PROVIDER vs CANONICAL) */}
                <div
                  className="tx-diagnostic-bar font-mono"
                  data-testid={`tx-diagnostic-${tx.id}`}
                >
                  <div className="diag-item">
                    <span className="diag-label">LOCAL: </span>
                    <span className="diag-val diag-val-local">{tx.status}</span>
                  </div>
                  <div className="diag-sep" aria-hidden="true">|</div>
                  <div className="diag-item">
                    <span className="diag-label">PROVIDER: </span>
                    <span
                      className={`diag-val ${
                        tx.status === 'CONFIRMED'
                          ? 'diag-val-success'
                          : tx.recoveryStatus === 'PENDING'
                          ? 'diag-val-pending'
                          : 'diag-val-muted'
                      }`}
                    >
                      {tx.status === 'CONFIRMED'
                        ? 'CONFIRMED'
                        : tx.providerTransactionId
                        ? tx.recoveryStatus
                        : 'UNAVAILABLE'}
                    </span>
                  </div>
                  <div className="diag-sep" aria-hidden="true">|</div>
                  <div className="diag-item">
                    <span className="diag-label">RECONCILIATION: </span>
                    <span
                      className={`diag-val ${
                        tx.recoveryStatus === 'CONFIRMED' ? 'diag-val-success' : 'diag-val-accent'
                      }`}
                    >
                      {tx.recoveryStatus === 'CONFIRMED' ? 'RECONCILED' : tx.recoveryStatus}
                    </span>
                  </div>
                  <div className="diag-sep" aria-hidden="true">|</div>
                  <div className="diag-item">
                    <span className="diag-label">REGISTRY: </span>
                    <span
                      className={`diag-val ${
                        tx.status === 'CONFIRMED' ? 'diag-val-success' : 'diag-val-muted'
                      }`}
                    >
                      {tx.status === 'CONFIRMED' ? 'UPDATED' : 'UNCHANGED'}
                    </span>
                  </div>
                </div>

                {/* Event Count & Error Notes */}
                <div className="tx-card-bottom-row font-mono">
                  {(() => {
                    const txEvents = eventService.getEventsForTransaction(tx.id);
                    return (
                      <div className="tx-events-count">
                        Lifecycle Events Recorded: <span className="events-num">{txEvents.length}</span>
                      </div>
                    );
                  })()}

                  <div className="tx-card-actions">
                    <button
                      type="button"
                      className="btn-tx-details-toggle font-mono"
                      onClick={() => setExpandedTxId(isExpanded ? null : tx.id)}
                    >
                      {isExpanded ? 'Hide Details ▲' : 'Technical Details ▼'}
                    </button>
                    {canReconcile && (
                      <button
                        type="button"
                        onClick={() => handleReconcile(tx.id)}
                        disabled={isReconcilingThis}
                        className="btn-tx-reconcile-single font-mono"
                        data-testid={`reconcile-btn-${tx.id}`}
                      >
                        {isReconcilingThis ? 'Checking Status...' : 'Reconcile Status'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Technical Details */}
                {isExpanded && (
                  <div className="tx-expanded-details font-mono">
                    <div className="details-header">TECHNICAL DIAGNOSTIC LOG</div>
                    <div className="details-grid">
                      <div>
                        <span className="detail-key">Full Tx ID:</span>
                        <code className="detail-val">{tx.id}</code>
                      </div>
                      <div>
                        <span className="detail-key">Action Type:</span>
                        <span className="detail-val">{tx.action}</span>
                      </div>
                      <div>
                        <span className="detail-key">Circuit Target:</span>
                        <span className="detail-val">{tx.circuitName}</span>
                      </div>
                      <div>
                        <span className="detail-key">Caller PK:</span>
                        <code className="detail-val">{tx.callerPublicKeyHex || 'N/A'}</code>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error / Notice Message if any */}
                {tx.error && (
                  <div className="tx-error-notice font-mono">
                    Note: {tx.error}
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

export default TransactionHistoryPanel;
