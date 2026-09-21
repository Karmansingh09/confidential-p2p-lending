import React from 'react';
import type { SettlementResult } from '../types/settlement.ts';
import { formatAmount, shortenAddress } from '../lib/formatters.ts';

interface SettlementConfirmationProps {
  result: SettlementResult;
  onDismiss?: () => void;
}

export const SettlementConfirmation: React.FC<SettlementConfirmationProps> = ({
  result,
  onDismiss,
}) => {
  return (
    <div className="settlement-confirmation-card">
      <div className="confirmation-header">
        <div className="confirmation-icon-badge settlement-badge" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
        </div>
        <div className="confirmation-header-text">
          <h3>Loan Agreement Concluded &amp; Settled</h3>
          <span className="confirmation-subtitle">
            Agreement <strong>{result.loanId}</strong> permanently transitioned to terminal <strong>SETTLED</strong> state
          </span>
        </div>
      </div>

      {/* Lifecycle Flow Stepper: Terminal SETTLED highlighted */}
      <div className="settlement-flow-indicator">
        <span className="flow-step step-complete">REQUESTED</span>
        <span className="flow-arrow">→</span>
        <span className="flow-step step-complete">VERIFIED</span>
        <span className="flow-arrow">→</span>
        <span className="flow-step step-complete">FUNDED</span>
        <span className="flow-arrow">→</span>
        <span className="flow-step step-complete">REPAID</span>
        <span className="flow-arrow">→</span>
        <span className="flow-step step-terminal">SETTLED</span>
      </div>

      {/* Terminal Closure Notice */}
      <div className="settlement-terminal-banner">
        <span className="banner-icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        </span>
        <div className="banner-content">
          <strong>Terminal Protocol Closure:</strong> All contractual terms, principal repayments, and simple interest obligations have been successfully concluded. No further state transitions are permitted.
        </div>
      </div>

      {/* Details Grid */}
      <div className="confirmation-grid">
        <div className="confirmation-grid-item">
          <span className="item-label">Agreement Status</span>
          <strong className="item-val status-settled">SETTLED (Terminal)</strong>
        </div>

        <div className="confirmation-grid-item">
          <span className="item-label">Settled By</span>
          <strong className="item-val">{result.settledBy}</strong>
        </div>

        <div className="confirmation-grid-item highlight-total">
          <span className="item-label">Total Obligation Cleared</span>
          <strong className="item-val">{formatAmount(result.totalObligationCleared)}</strong>
        </div>

        <div className="confirmation-grid-item">
          <span className="item-label">Borrower</span>
          <strong className="item-val">{shortenAddress(result.borrower)}</strong>
        </div>

        <div className="confirmation-grid-item">
          <span className="item-label">Designated Lender</span>
          <strong className="item-val">{shortenAddress(result.lender)}</strong>
        </div>

        <div className="confirmation-grid-item">
          <span className="item-label">Network Status</span>
          <span className="item-val network-status-tag">{result.networkStatus}</span>
        </div>

        <div className="confirmation-grid-item full-width">
          <span className="item-label">Asset Transfer Status</span>
          <span className="item-val asset-transfer-badge">
            {result.assetTransferStatus}
          </span>
        </div>

        <div className="confirmation-grid-item full-width">
          <span className="item-label">Privacy Assurance</span>
          <span className="item-val privacy-status-text">
            Zero Private Financial Data Disclosed &bull; Public State Machine Only
          </span>
        </div>
      </div>

      {/* Prototype Disclosure Box */}
      <div className="confirmation-disclaimer-box">
        <span className="disclaimer-icon">ℹ️</span>
        <span>
          <strong>Prototype Disclosure:</strong> {result.disclaimer}
        </span>
      </div>

      {/* Actions */}
      {onDismiss && (
        <div className="confirmation-actions">
          <button
            type="button"
            className="btn btn-primary btn-confirmation-dismiss"
            onClick={onDismiss}
          >
            Return to Dashboard
          </button>
        </div>
      )}
    </div>
  );
};
