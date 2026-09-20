import React, { useState } from 'react';
import type { AccountContext, AccountRole } from '../types/account.ts';
import {
  getWalletProvider,
  switchToPrototypeProvider,
  switchToMidnightAdapter,
  getActiveProviderKind,
} from '../lib/account-service.ts';
import { AccountSwitcher } from '../components/AccountSwitcher.tsx';
import type { NavigationTab } from '../types/navigation.ts';

export interface WalletPageProps {
  accountContext: AccountContext;
  onSwitchRole: (role: AccountRole) => void;
  onDisconnect: () => void;
  onConnect: (role?: AccountRole) => void;
  onNavigate: (tab: NavigationTab) => void;
}

export const WalletPage: React.FC<WalletPageProps> = ({
  accountContext,
  onSwitchRole,
  onDisconnect,
  onConnect,
  onNavigate,
}) => {
  const [, setProviderTick] = useState<number>(0);
  const handleProviderSwitched = () => setProviderTick((t) => t + 1);

  const provider = getWalletProvider();
  const providerKind = getActiveProviderKind();
  const caps = provider.getCapabilities();
  const isConnected = accountContext.connectionStatus === 'CONNECTED';
  const isTxCapable = Boolean(caps.SIGN_TRANSACTION && caps.SUBMIT_TRANSACTION);
  const role = accountContext.selectedRole || 'BORROWER';

  const handleSelectPrototype = () => {
    switchToPrototypeProvider();
    handleProviderSwitched();
  };

  const handleSelectMidnightAdapter = () => {
    switchToMidnightAdapter();
    handleProviderSwitched();
  };

  const capabilities = [
    {
      name: 'Account identity',
      status: isConnected ? 'Available' : 'Disconnected',
      detail: 'Inspect active simulated persona address and role permissions',
      statusType: isConnected ? 'success' : 'muted',
    },
    {
      name: 'Network detection',
      status: 'Available',
      detail: 'Recognize browser runtime and local mock devnet environment',
      statusType: 'success',
    },
    {
      name: 'ZK proof generation',
      status: 'Available',
      detail: 'Execute qualification circuits with client-side witness privacy',
      statusType: 'success',
    },
    {
      name: 'Transaction signing',
      status: isTxCapable ? 'Available' : 'Read only',
      detail: isTxCapable
        ? 'Cryptographic signing enabled'
        : 'Locked to local simulation; external signing keys disabled',
      statusType: isTxCapable ? 'success' : 'warning',
    },
    {
      name: 'Transaction submission',
      status: isTxCapable ? 'Available' : 'Local prototype',
      detail: 'Dispatched directly to in-memory ledger; external network RPC disabled',
      statusType: isTxCapable ? 'success' : 'warning',
    },
    {
      name: 'Account balance query',
      status: 'Unsupported',
      detail: 'Confidential shield prevents arbitrary off-chain balance indexing',
      statusType: 'muted',
    },
  ];

  return (
    <div className="wallet-workspace" data-testid="wallet-workspace">
      {/* 1. WORKSPACE HERO & SYSTEM TELEMETRY ENCLAVE (60% / 40%) */}
      <section className="wallet-hero-section">
        <div className="wallet-hero-left">
          <div className="wallet-hero-kicker font-mono">
            <span>MIDNIGHT NETWORK</span>
            <span className="kicker-sep">//</span>
            <span>CRYPTOGRAPHIC WALLET &amp; IDENTITY</span>
          </div>
          <h1 className="wallet-hero-headline">Wallet &amp; Readiness</h1>
          <p className="wallet-hero-lead">
            Manage your connected cryptographic identity, persona roles, and atomic transaction execution readiness.
          </p>
        </div>

        <div className="wallet-hero-right">
          <div className="wallet-telemetry-enclave font-mono">
            <div className="wallet-telemetry-header">
              <span className="wallet-telemetry-title">WALLET RUNTIME</span>
              <span className="wallet-telemetry-indicator">
                <span className="status-dot-sm dot-live" />
                <span className="status-text-live text-accent">LOCAL ACTIVE</span>
              </span>
            </div>

            <div className="wallet-telemetry-body">
              <div className="wallet-telemetry-row">
                <span className="wallet-telemetry-key">PROVIDER</span>
                <span className="wallet-telemetry-val text-accent">{provider.name}</span>
              </div>
              <div className="wallet-telemetry-row">
                <span className="wallet-telemetry-key">ACTIVE PERSONA</span>
                <span className="wallet-telemetry-val">{role}</span>
              </div>
              <div className="wallet-telemetry-row">
                <span className="wallet-telemetry-key">SETTLEMENT</span>
                <span className="wallet-telemetry-val">ATOMIC LEDGER</span>
              </div>
              <div className="wallet-telemetry-row">
                <span className="wallet-telemetry-key">PRIVACY ENCLAVE</span>
                <span className="wallet-telemetry-val text-accent">SHIELDED (0 LEAKS)</span>
              </div>
            </div>

            <div className="wallet-telemetry-footer">
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

      {/* 2. TWO-COLUMN BALANCED WORKSPACE GRID (62% / 38%) */}
      <div className="wallet-grid-layout">
        {/* LEFT COLUMN: IDENTITY, PERSONA, READINESS PIPELINE & CAPABILITIES */}
        <div className="wallet-grid-main">
          {/* Identity & Persona Console */}
          <AccountSwitcher
            accountContext={accountContext}
            onSwitchRole={onSwitchRole}
            onDisconnect={onDisconnect}
            onConnect={onConnect}
          />

          {/* Execution Readiness Pipeline Card */}
          <section className="wallet-card wallet-readiness-card" aria-label="Transaction Readiness Pipeline">
            <div className="wallet-card-header">
              <div>
                <span className="card-kicker font-mono">EXECUTION READINESS</span>
                <h2 className="wallet-card-title">Transaction Readiness Pipeline</h2>
              </div>
              <span className="card-tag font-mono">3-STAGE VERIFICATION</span>
            </div>

            <div className="wallet-readiness-pipeline">
              {/* Stage 1 */}
              <div className="readiness-step">
                <div className="step-num-badge font-mono">01</div>
                <div className="step-content">
                  <span className="step-label font-mono">DISCOVERY</span>
                  <strong className="step-title">Wallet Detected</strong>
                  <p className="step-desc">Local Prototype Adapter</p>
                </div>
                <span className="step-badge status-completed font-mono">AVAILABLE</span>
              </div>

              {/* Stage 2 */}
              <div className="readiness-step">
                <div className="step-num-badge font-mono">02</div>
                <div className="step-content">
                  <span className="step-label font-mono">IDENTITY</span>
                  <strong className="step-title">Identity Connected</strong>
                  <p className="step-desc">
                    {isConnected ? 'Active Persona Authenticated' : 'No Account Connected'}
                  </p>
                </div>
                <span className={`step-badge ${isConnected ? 'status-completed' : 'status-pending'} font-mono`}>
                  {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
                </span>
              </div>

              {/* Stage 3 */}
              <div className="readiness-step">
                <div className="step-num-badge font-mono">03</div>
                <div className="step-content">
                  <span className="step-label font-mono">CONSENSUS</span>
                  <strong className="step-title">Transactions</strong>
                  <p className="step-desc">Atomic Execution Engine</p>
                </div>
                <span className={`step-badge ${isTxCapable ? 'status-completed' : 'status-warning'} font-mono`}>
                  {isTxCapable ? 'AUTHORIZED' : 'READ ONLY'}
                </span>
              </div>
            </div>
          </section>

          {/* Capabilities List Table */}
          <section className="wallet-card wallet-capabilities-card" aria-label="Protocol Capabilities">
            <div className="wallet-card-header">
              <div>
                <span className="card-kicker font-mono">PROTOCOL CAPABILITIES</span>
                <h2 className="wallet-card-title">Atomic Protocol Capabilities</h2>
              </div>
              <span className="card-tag font-mono">6 OPERATIONS</span>
            </div>

            <div className="capabilities-table-container">
              <div className="cap-table-header font-mono">
                <span className="col-cap-name">CAPABILITY</span>
                <span className="col-cap-scope">SCOPE</span>
                <span className="col-cap-status">STATUS</span>
              </div>

              <div className="cap-table-body">
                {capabilities.map((c) => (
                  <div key={c.name} className="cap-table-row">
                    <span className="col-cap-name font-medium">{c.name}</span>
                    <span className="col-cap-scope">{c.detail}</span>
                    <span className={`col-cap-status font-mono status-${c.statusType}`}>{c.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: PROVIDER CONFIG, PRIVACY SHIELD & QUICK ACTIONS */}
        <aside className="wallet-grid-sidebar">
          {/* Provider Runtime Card */}
          <section className="wallet-card provider-runtime-card" aria-label="Provider Runtime">
            <div className="wallet-card-header">
              <div>
                <span className="card-kicker font-mono">RUNTIME BOUNDARY</span>
                <h3 className="wallet-card-title">Provider Runtime</h3>
              </div>
            </div>

            <div className="provider-boundary-toggle" role="group" aria-label="Provider Adapter Selector">
              <button
                type="button"
                className={`boundary-btn ${providerKind === 'LOCAL_PROTOTYPE' ? 'is-active' : ''}`}
                onClick={handleSelectPrototype}
              >
                Prototype Sandbox
              </button>
              <button
                type="button"
                className={`boundary-btn ${providerKind === 'LACE' ? 'is-active' : ''}`}
                onClick={handleSelectMidnightAdapter}
              >
                Midnight / Lace Adapter
              </button>
            </div>

            <div className="provider-specs-list font-mono">
              <div className="spec-row">
                <span className="spec-key">PROVIDER ID</span>
                <span className="spec-val text-accent">prototype-local</span>
              </div>
              <div className="spec-row">
                <span className="spec-key">ADAPTER TYPE</span>
                <span className="spec-val">In-Memory Simulation</span>
              </div>
              <div className="spec-row">
                <span className="spec-key">NETWORK RPC</span>
                <span className="spec-val">in-memory://ledger</span>
              </div>
              <div className="spec-row">
                <span className="spec-key">CONSENSUS</span>
                <span className="spec-val">Mock DevNet (Instant)</span>
              </div>
              <div className="spec-row">
                <span className="spec-key">KEY MANAGEMENT</span>
                <span className="spec-val">Deterministic Ephemeral</span>
              </div>
            </div>
          </section>

          {/* Confidential Privacy Shield Card */}
          <section className="wallet-card privacy-shield-card" aria-label="Confidential Privacy Shield">
            <div className="wallet-card-header">
              <div>
                <span className="card-kicker font-mono">SHIELDED ENCLAVE</span>
                <h3 className="wallet-card-title">Confidential Shield</h3>
              </div>
              <span className="badge-shield-active font-mono">ACTIVE (0 LEAKS)</span>
            </div>

            <div className="shield-specs-list font-mono">
              <div className="spec-row">
                <span className="spec-key">WITNESS PRIVACY</span>
                <span className="spec-val text-accent">100% Client-Side</span>
              </div>
              <div className="spec-row">
                <span className="spec-key">LEDGER VISIBILITY</span>
                <span className="spec-val">Shielded State Only</span>
              </div>
              <div className="spec-row">
                <span className="spec-key">PROOF SCHEME</span>
                <span className="spec-val">Compact BLS12-381</span>
              </div>
            </div>

            <div className="shield-note">
              <p className="shield-note-text">
                All financial witnesses and qualification thresholds are verified client-side before transaction dispatch. No unshielded values are broadcast to the network.
              </p>
            </div>
          </section>

          {/* Quick Actions Card */}
          <section className="wallet-card quick-nav-card" aria-label="Desk Navigation">
            <div className="wallet-card-header">
              <div>
                <span className="card-kicker font-mono">DESK WORKSPACE</span>
                <h3 className="wallet-card-title">Quick Actions</h3>
              </div>
            </div>

            <div className="quick-actions-list">
              <button
                type="button"
                className="btn-quick-action"
                onClick={() => onNavigate('transactions')}
              >
                <span>Transactions Console</span>
                <span className="action-arrow font-mono">&rarr;</span>
              </button>
              <button
                type="button"
                className="btn-quick-action"
                onClick={() => onNavigate('marketplace')}
              >
                <span>Loan Marketplace</span>
                <span className="action-arrow font-mono">&rarr;</span>
              </button>
              <button
                type="button"
                className="btn-quick-action"
                onClick={() => onNavigate('create-loan')}
              >
                <span>Propose New Loan</span>
                <span className="action-arrow font-mono">&rarr;</span>
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};

export default WalletPage;
