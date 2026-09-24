import React from 'react';
import type { LoanRegistry } from '../lib/loan-registry.ts';
import { TransactionHistoryPanel } from '../components/TransactionHistoryPanel.tsx';
import type { NavigationTab } from '../types/navigation.ts';
import { getWalletProvider } from '../lib/account-service.ts';
import { getWalletSessionService } from '../lib/wallet-session-service.ts';

export interface TransactionsPageProps {
  loanRegistry?: LoanRegistry;
  onRegistryUpdated?: (registry: LoanRegistry) => void;
  onNavigate: (tab: NavigationTab) => void;
}

export const TransactionsPage: React.FC<TransactionsPageProps> = ({
  loanRegistry,
  onRegistryUpdated,
  onNavigate,
}) => {
  const provider = getWalletProvider();
  const session = getWalletSessionService().getSession();
  const isProto = provider.isPrototype;
  const isConnected = session.status === 'CONNECTED';
  const executionModeLabel = isProto
    ? 'LOCAL PROTOTYPE'
    : session.network.networkName || 'MIDNIGHT PREPROD';
  const systemStateLabel = isProto
    ? 'SANDBOX ACTIVE'
    : isConnected
    ? 'PREPROD CONNECTED'
    : 'AWAITING WALLET';

  return (
    <div className="transactions-workspace">
      {/* 1. WORKSPACE HEADER & SYSTEM TELEMETRY ENCLAVE (60% / 40%) */}
      <section className="tx-hero-section">
        <div className="tx-hero-left">
          <div className="tx-hero-kicker font-mono">
            <span>MIDNIGHT NETWORK</span>
            <span className="kicker-sep">//</span>
            <span>CRYPTOGRAPHIC EXECUTION CONSOLE</span>
          </div>
          <h1 className="tx-hero-headline">Transactions Console</h1>
          <p className="tx-hero-lead">
            Track transaction requests, signing, provider submission, confirmation, reconciliation, and canonical state transitions.
          </p>
        </div>

        <div className="tx-hero-right">
          <div className="tx-telemetry-enclave font-mono">
            <div className="tx-telemetry-header">
              <span className="tx-telemetry-title">SYSTEM STATE</span>
              <span className="tx-telemetry-indicator">
                <span className={`status-dot-sm ${isProto || isConnected ? 'dot-live' : ''}`} />
                <span className="status-text-live text-accent">{systemStateLabel}</span>
              </span>
            </div>

            <div className="tx-telemetry-body">
              <div className="tx-telemetry-row">
                <span className="tx-telemetry-key">EXECUTION MODE</span>
                <span className="tx-telemetry-val text-accent">{executionModeLabel}</span>
              </div>
              <div className="tx-telemetry-row">
                <span className="tx-telemetry-key">SETTLEMENT</span>
                <span className="tx-telemetry-val">ATOMIC LEDGER</span>
              </div>
              <div className="tx-telemetry-row">
                <span className="tx-telemetry-key">RECONCILIATION</span>
                <span className="tx-telemetry-val text-accent">AUTOMATIC</span>
              </div>
              <div className="tx-telemetry-row">
                <span className="tx-telemetry-key">DATA INTEGRITY</span>
                <span className="tx-telemetry-val">VERIFIABLE</span>
              </div>
            </div>

            <div className="tx-telemetry-footer">
              <button
                type="button"
                className="btn-desk-nav font-mono"
                onClick={() => onNavigate('overview')}
              >
                Desk Overview &rarr;
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. 6-STAGE TRANSACTION LIFECYCLE PIPELINE */}
      <section className="tx-pipeline-section" aria-label="Transaction Lifecycle Execution Pipeline">
        <div className="tx-pipeline-header">
          <div>
            <div className="tx-pipeline-kicker font-mono">EXECUTION &amp; RECONCILIATION</div>
            <h2 className="tx-pipeline-title">Transaction Lifecycle</h2>
            <p className="tx-pipeline-sub">
              Deterministic 6-stage lifecycle from client parameter formation through consensus finalization.
            </p>
          </div>
          <div className="tx-pipeline-tag font-mono">
            <span>6-STAGE PIPELINE</span>
          </div>
        </div>

        <div className="tx-pipeline-track font-mono">
          {/* Stage 1: REQUEST */}
          <div className="tx-pipeline-step">
            <div className="step-num-badge">01</div>
            <div className="step-content">
              <div className="step-label">REQUEST</div>
              <strong className="step-title">Intent Init</strong>
              <p className="step-desc">Client-side parameter formation &amp; validation</p>
            </div>
            <span className="step-status status-completed">READY</span>
          </div>

          <div className="tx-pipeline-arrow" aria-hidden="true">&rarr;</div>

          {/* Stage 2: SIGNATURE */}
          <div className="tx-pipeline-step">
            <div className="step-num-badge">02</div>
            <div className="step-content">
              <div className="step-label">SIGNATURE</div>
              <strong className="step-title">Key Witness</strong>
              <p className="step-desc">Wallet cryptographic authorization</p>
            </div>
            <span className="step-status status-active">SIGNING</span>
          </div>

          <div className="tx-pipeline-arrow" aria-hidden="true">&rarr;</div>

          {/* Stage 3: SUBMISSION */}
          <div className="tx-pipeline-step">
            <div className="step-num-badge">03</div>
            <div className="step-content">
              <div className="step-label">SUBMISSION</div>
              <strong className="step-title">RPC Dispatch</strong>
              <p className="step-desc">Payload dispatched to network node</p>
            </div>
            <span className="step-status status-pending">DISPATCH</span>
          </div>

          <div className="tx-pipeline-arrow" aria-hidden="true">&rarr;</div>

          {/* Stage 4: PROVIDER */}
          <div className="tx-pipeline-step">
            <div className="step-num-badge">04</div>
            <div className="step-content">
              <div className="step-label">PROVIDER</div>
              <strong className="step-title">Node Ingest</strong>
              <p className="step-desc">Mempool queuing &amp; circuit verification</p>
            </div>
            <span className="step-status status-pending">INGEST</span>
          </div>

          <div className="tx-pipeline-arrow" aria-hidden="true">&rarr;</div>

          {/* Stage 5: CONFIRMATION */}
          <div className="tx-pipeline-step">
            <div className="step-num-badge">05</div>
            <div className="step-content">
              <div className="step-label">CONFIRMATION</div>
              <strong className="step-title">Block Inclusion</strong>
              <p className="step-desc">Consensus ledger block finalization</p>
            </div>
            <span className="step-status status-pending">CONSENSUS</span>
          </div>

          <div className="tx-pipeline-arrow" aria-hidden="true">&rarr;</div>

          {/* Stage 6: CANONICAL */}
          <div className="tx-pipeline-step">
            <div className="step-num-badge">06</div>
            <div className="step-content">
              <div className="step-label">CANONICAL</div>
              <strong className="step-title">State Update</strong>
              <p className="step-desc">Registry transitions deterministically</p>
            </div>
            <span className="step-status status-pending">COMMITTED</span>
          </div>
        </div>
      </section>

      {/* 3. TRANSACTION HISTORY & RECOVERY CONSOLE */}
      <section className="tx-history-container">
        <TransactionHistoryPanel
          loanRegistry={loanRegistry}
          onTransactionReconciled={(res) => {
            if (res.updatedRegistry && onRegistryUpdated) {
              onRegistryUpdated(res.updatedRegistry);
            }
          }}
        />
      </section>
    </div>
  );
};

export default TransactionsPage;
