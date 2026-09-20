import React from 'react';
import type { LoanRegistry } from '../lib/loan-registry.ts';
import { TransactionHistoryPanel } from '../components/TransactionHistoryPanel.tsx';
import type { NavigationTab } from '../types/navigation.ts';

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
  return (
    <div className="overview-page transactions-page">
      {/* 1. Transactions Header */}
      <section className="overview-intro">
        <div className="overview-intro-left">
          <div className="overview-kicker font-mono">
            <span>MIDNIGHT NETWORK</span>
            <span className="kicker-sep">//</span>
            <span>CRYPTOGRAPHIC EXECUTION CONSOLE</span>
          </div>
          <h1 className="overview-headline">Transactions Console</h1>
          <p className="overview-lead">
            Tamper-evident transaction tracking, zero-knowledge proof lifecycle verification, and deterministic state reconciliation.
          </p>
        </div>

        <div className="overview-intro-right">
          <div className="overview-protocol-meta font-mono">
            <div className="meta-item">
              <span className="meta-label">EXECUTION MODE</span>
              <span className="meta-val text-accent">LOCAL PROTOTYPE</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">SETTLEMENT</span>
              <span className="meta-val">ATOMIC LEDGER</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">RECONCILIATION</span>
              <span className="meta-val text-accent">AUTOMATIC</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">DATA INTEGRITY</span>
              <span className="meta-val">VERIFIABLE</span>
            </div>
          </div>
          <div className="intro-actions-row">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => onNavigate('overview')}
            >
              Desk Overview &rarr;
            </button>
          </div>
        </div>
      </section>

      {/* 2. 6-Stage Cryptographic Execution State Pipeline */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: '16px',
        padding: '20px 0',
        marginBottom: '40px',
        borderTop: '1px solid rgba(159, 184, 216, 0.08)',
        borderBottom: '1px solid rgba(159, 184, 216, 0.08)',
      }} className="font-mono">
        <div>
          <div style={{ fontSize: '10px', color: 'var(--accent-primary)', marginBottom: '4px', letterSpacing: '0.06em' }}>01 / REQUEST</div>
          <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Intent Init</strong>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.35 }}>Client-side parameter formation.</p>
        </div>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--accent-primary)', marginBottom: '4px', letterSpacing: '0.06em' }}>02 / SIGNATURE</div>
          <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Key Witness</strong>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.35 }}>Wallet cryptographic authorization.</p>
        </div>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--status-info)', marginBottom: '4px', letterSpacing: '0.06em' }}>03 / SUBMISSION</div>
          <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>RPC Dispatch</strong>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.35 }}>Payload dispatched to node.</p>
        </div>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--status-warning)', marginBottom: '4px', letterSpacing: '0.06em' }}>04 / PROVIDER</div>
          <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Node Ingest</strong>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.35 }}>Mempool & circuit validation.</p>
        </div>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--status-success)', marginBottom: '4px', letterSpacing: '0.06em' }}>05 / CONFIRM</div>
          <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Block Inclusion</strong>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.35 }}>Consensus ledger finalization.</p>
        </div>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--accent-primary)', marginBottom: '4px', letterSpacing: '0.06em' }}>06 / CANONICAL</div>
          <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>State Update</strong>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.35 }}>Registry transitions deterministically.</p>
        </div>
      </div>

      {/* 3. Transaction History Table */}
      <div className="active-lending-workspace">
        <TransactionHistoryPanel
          loanRegistry={loanRegistry}
          onTransactionReconciled={(res) => {
            if (res.updatedRegistry && onRegistryUpdated) {
              onRegistryUpdated(res.updatedRegistry);
            }
          }}
        />
      </div>
    </div>
  );
};

export default TransactionsPage;
