import React, { useState, useEffect } from 'react';
import type { AccountContext, AccountRole } from '../types/account.ts';
import {
  getWalletProvider,
  switchToPrototypeProvider,
  switchToMidnightAdapter,
  getActiveProviderKind,
} from '../lib/account-service.ts';
import {
  getWalletSessionService,
  subscribeToWalletSession,
} from '../lib/wallet-session-service.ts';
import { getWalletHandshakeService } from '../lib/wallet-handshake-service.ts';
import { AccountSwitcher } from '../components/AccountSwitcher.tsx';
import type { NavigationTab } from '../types/navigation.ts';
import type { LaceConnectionState } from '../types/wallet-adapter.ts';

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
  const sessionService = getWalletSessionService();
  const handshakeService = getWalletHandshakeService();

  const [session, setSession] = useState(() => sessionService.getSession());
  const [handshake, setHandshake] = useState(() => handshakeService.getHandshakeState());
  const [isConnectingLace, setIsConnectingLace] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  useEffect(() => {
    const unsubSession = subscribeToWalletSession((updated) => {
      setSession(updated);
      setHandshake(handshakeService.getHandshakeState());
    });
    const unsubHandshake = handshakeService.subscribe((updated) => {
      setHandshake(updated);
    });
    return () => {
      unsubSession();
      unsubHandshake();
    };
  }, []);

  const provider = sessionService.getProvider();
  const providerKind = getActiveProviderKind();
  const caps = provider.getCapabilities();
  const isConnected = session.status === 'CONNECTED';
  const isTxCapable = Boolean(caps.SIGN_TRANSACTION && caps.SUBMIT_TRANSACTION);
  const role = accountContext.selectedRole || 'NONE';
  const detectionStatus = session.detectionStatus;

  const laceState: LaceConnectionState =
    session.laceConnectionState ?? sessionService.getLaceConnectionState();

  const handleSelectPrototype = () => {
    setConnectError(null);
    switchToPrototypeProvider();
    setSession(sessionService.getSession());
    setHandshake(handshakeService.getHandshakeState());
  };

  const handleSelectMidnightAdapter = () => {
    setConnectError(null);
    switchToMidnightAdapter();
    setSession(sessionService.getSession());
    setHandshake(handshakeService.getHandshakeState());
  };

  const handleConnectLace = async () => {
    setIsConnectingLace(true);
    setConnectError(null);
    try {
      if (provider.isPrototype) {
        switchToMidnightAdapter();
      }
      const result = await sessionService.connect();
      if (!result.success && result.error) {
        setConnectError(result.error.message);
      }
    } catch (err: unknown) {
      setConnectError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setIsConnectingLace(false);
      setSession(sessionService.getSession());
      setHandshake(handshakeService.getHandshakeState());
    }
  };

  const handleDisconnectLace = async () => {
    setConnectError(null);
    try {
      await sessionService.disconnect();
      onDisconnect();
    } finally {
      setSession(sessionService.getSession());
      setHandshake(handshakeService.getHandshakeState());
    }
  };

  const getLaceBadge = (state: LaceConnectionState) => {
    switch (state) {
      case 'READY':
        return { label: 'LACE READY', colorClass: 'status-completed' };
      case 'CONNECTED':
        return { label: 'LACE CONNECTED', colorClass: 'status-completed' };
      case 'CONNECTED_NOT_TRANSACTION_CAPABLE':
        return { label: 'READ ONLY (NOT TX CAPABLE)', colorClass: 'status-warning' };
      case 'CONNECTING':
        return { label: 'CONNECTING...', colorClass: 'status-warning' };
      case 'LACE_DETECTED':
        return { label: 'EXTENSION DETECTED', colorClass: 'status-warning' };
      case 'LACE_NOT_DETECTED':
        return { label: 'NOT DETECTED', colorClass: 'status-pending' };
      case 'CONNECTION_REJECTED':
        return { label: 'USER REJECTED', colorClass: 'status-pending' };
      case 'UNSUPPORTED_NETWORK':
        return { label: 'WRONG NETWORK', colorClass: 'status-pending' };
      case 'DISCONNECTED':
      default:
        return { label: 'DISCONNECTED', colorClass: 'status-pending' };
    }
  };

  const laceBadge = getLaceBadge(laceState);

  const capabilities = [
    {
      name: 'Account identity',
      status: isConnected ? 'Available' : 'Unavailable',
      detail: isConnected
        ? 'Public account address and role permissions verified'
        : 'Connect wallet to expose authenticated public address',
      statusType: isConnected ? 'success' : 'muted',
    },
    {
      name: 'Network detection',
      status: detectionStatus === 'DETECTED' ? 'Available' : 'Unavailable',
      detail: detectionStatus === 'DETECTED'
        ? 'Midnight DApp connector discovered on window.midnight'
        : 'Install Midnight Lace browser extension',
      statusType: detectionStatus === 'DETECTED' ? 'success' : 'muted',
    },
    {
      name: 'ZK proof generation',
      status: 'Available',
      detail: 'Execute qualification circuits with client-side witness privacy',
      statusType: 'success',
    },
    {
      name: 'Transaction signing',
      status: isTxCapable ? 'Available' : 'Unavailable',
      detail: isTxCapable
        ? 'Cryptographic transaction balancing enabled via Lace'
        : 'Transaction balancing unavailable in current session',
      statusType: isTxCapable ? 'success' : 'warning',
    },
    {
      name: 'Transaction submission',
      status: isTxCapable ? 'Available' : 'Unavailable',
      detail: isTxCapable
        ? 'Dispatched directly to Midnight distributed ledger network'
        : 'Direct network submission unavailable in current session',
      statusType: isTxCapable ? 'success' : 'warning',
    },
    {
      name: 'Account balance query',
      status: 'Shielded (Unavailable)',
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
            Manage your connected Midnight Lace identity, persona roles, and atomic transaction execution readiness.
          </p>
        </div>

        <div className="wallet-hero-right">
          <div className="wallet-telemetry-enclave font-mono">
            <div className="wallet-telemetry-header">
              <span className="wallet-telemetry-title">WALLET RUNTIME</span>
              <span className="wallet-telemetry-indicator">
                <span className={`status-dot-sm ${isConnected ? 'dot-live' : ''}`} />
                <span className="status-text-live text-accent">
                  {provider.isPrototype ? 'PROTOTYPE SANDBOX' : laceBadge.label}
                </span>
              </span>
            </div>

            <div className="wallet-telemetry-body">
              <div className="wallet-telemetry-row">
                <span className="wallet-telemetry-key">PROVIDER</span>
                <span className="wallet-telemetry-val text-accent">{provider.name}</span>
              </div>
              <div className="wallet-telemetry-row">
                <span className="wallet-telemetry-key">REPORTED NETWORK</span>
                <span className="wallet-telemetry-val">
                  {session.network.networkId || (provider.isPrototype ? 'prototype-local' : 'Unavailable')}
                </span>
              </div>
              <div className="wallet-telemetry-row">
                <span className="wallet-telemetry-key">ACTIVE PERSONA</span>
                <span className="wallet-telemetry-val">{role}</span>
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
          {/* Dedicated Midnight Lace Extension Status Card */}
          <section className="wallet-card wallet-lace-control-card" aria-label="Midnight Lace Extension Status">
            <div className="wallet-card-header">
              <div>
                <span className="card-kicker font-mono">OFFICIAL DAPP CONNECTOR</span>
                <h2 className="wallet-card-title">Midnight Lace Wallet Integration</h2>
              </div>
              <span className={`card-tag font-mono ${laceBadge.colorClass}`}>{laceBadge.label}</span>
            </div>

            <div style={{ padding: '16px 20px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', border: '1px solid rgba(159, 184, 216, 0.12)', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 600, color: 'var(--text-primary, #F1F5F9)' }}>
                    {laceState === 'LACE_NOT_DETECTED' && 'Midnight Lace Extension Not Detected'}
                    {laceState === 'LACE_DETECTED' && 'Midnight Lace Extension Discovered'}
                    {laceState === 'CONNECTING' && 'Connecting to Midnight Lace...'}
                    {(laceState === 'CONNECTED' || laceState === 'READY') && 'Midnight Lace Connected'}
                    {laceState === 'CONNECTION_REJECTED' && 'Connection Rejected by User'}
                    {laceState === 'UNSUPPORTED_NETWORK' && 'Unsupported Network Detected'}
                    {laceState === 'CONNECTED_NOT_TRANSACTION_CAPABLE' && 'Connected (Read Only)'}
                    {laceState === 'DISCONNECTED' && 'Lace Wallet Disconnected'}
                  </h4>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary, #94A3B8)' }}>
                    {laceState === 'LACE_NOT_DETECTED' && 'Install the official Midnight Lace extension from Chrome Web Store to interact with confidential contracts.'}
                    {laceState === 'LACE_DETECTED' && 'Extension found on window.midnight.mnLace. Click Connect to initiate handshake.'}
                    {laceState === 'CONNECTING' && 'Please approve the connection prompt in your Lace extension window.'}
                    {(laceState === 'CONNECTED' || laceState === 'READY') && `Public address: ${accountContext.identity?.address || session.account?.address || 'Shielded Keyring Active'}`}
                    {laceState === 'CONNECTION_REJECTED' && 'The connection request was declined in Lace. You may retry whenever ready.'}
                    {laceState === 'UNSUPPORTED_NETWORK' && `Wallet is connected to network "${session.network.networkId || 'unknown'}", but desk expects "${handshake.expectedNetwork}".`}
                    {laceState === 'CONNECTED_NOT_TRANSACTION_CAPABLE' && 'Wallet connected, but lacks cryptographic transaction balancing or submission capability.'}
                    {laceState === 'DISCONNECTED' && 'No active wallet session. Connect to access shielded micro-lending features.'}
                  </p>
                  {connectError && (
                    <div style={{ marginTop: '8px', color: '#fca5a5', fontSize: '12px' }}>
                      Error: {connectError}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  {isConnected ? (
                    <button
                      type="button"
                      className="btn-desk-nav font-mono"
                      onClick={handleDisconnectLace}
                      style={{ padding: '8px 16px', background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                    >
                      Disconnect Lace
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-desk-nav font-mono"
                      onClick={handleConnectLace}
                      disabled={isConnectingLace}
                      style={{ padding: '8px 16px', background: 'rgba(159, 184, 216, 0.2)', color: 'var(--accent-primary, #9FB8D8)', border: '1px solid rgba(159, 184, 216, 0.4)' }}
                    >
                      {isConnectingLace ? 'Connecting...' : (laceState === 'CONNECTION_REJECTED' ? 'Retry Connect Lace' : 'Connect Midnight Lace')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

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
                  <strong className="step-title">
                    {provider.isPrototype ? 'Prototype Simulator' : (detectionStatus === 'DETECTED' ? 'Lace Detected' : 'Lace Missing')}
                  </strong>
                  <p className="step-desc">
                    {provider.isPrototype ? 'Offline Mock Harness' : (detectionStatus === 'DETECTED' ? 'Discovered on window.midnight' : 'Extension Not Detected')}
                  </p>
                </div>
                <span className={`step-badge ${detectionStatus === 'DETECTED' || provider.isPrototype ? 'status-completed' : 'status-pending'} font-mono`}>
                  {detectionStatus === 'DETECTED' || provider.isPrototype ? 'AVAILABLE' : 'UNAVAILABLE'}
                </span>
              </div>

              {/* Stage 2 */}
              <div className="readiness-step">
                <div className="step-num-badge font-mono">02</div>
                <div className="step-content">
                  <span className="step-label font-mono">IDENTITY</span>
                  <strong className="step-title">{isConnected ? 'Identity Connected' : 'Identity Disconnected'}</strong>
                  <p className="step-desc">
                    {isConnected ? (accountContext.identity?.displayName || 'Authenticated Public Identity') : 'No Account Connected'}
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
                  <strong className="step-title">{isTxCapable ? 'Transaction Authorized' : 'Read Only'}</strong>
                  <p className="step-desc">
                    {isTxCapable ? 'Cryptographic Signing & Network Broadcast' : (provider.isPrototype ? 'Simulated Ledger In-Memory' : 'Transaction Submission Inactive')}
                  </p>
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
              <div className="cap-table-header">
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
                <span className="spec-val text-accent">{provider.id}</span>
              </div>
              <div className="spec-row">
                <span className="spec-key">ADAPTER TYPE</span>
                <span className="spec-val">
                  {provider.isPrototype ? 'In-Memory Simulation' : 'Official Midnight Lace Extension'}
                </span>
              </div>
              <div className="spec-row">
                <span className="spec-key">REPORTED NETWORK</span>
                <span className="spec-val">
                  {session.network.networkId || (provider.isPrototype ? 'prototype-local' : 'Unavailable')}
                </span>
              </div>
              <div className="spec-row">
                <span className="spec-key">NETWORK STATUS</span>
                <span className="spec-val">
                  {provider.isPrototype
                    ? 'Sandbox Mode'
                    : handshake.networkCompatibility === 'MATCH'
                    ? 'Compatible (MATCH)'
                    : handshake.networkCompatibility === 'MISMATCH'
                    ? 'Mismatch / Unsupported'
                    : isConnected
                    ? 'Pending Network Identification'
                    : 'Awaiting Connection'}
                </span>
              </div>
              <div className="spec-row">
                <span className="spec-key">AUTHENTICATED ADDRESS</span>
                <span className="spec-val" style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {accountContext.identity?.address || session.account?.address || (isConnected && accountContext.identity?.publicKeyHex ? accountContext.identity.publicKeyHex : 'Unavailable')}
                </span>
              </div>
              <div className="spec-row">
                <span className="spec-key">KEY MANAGEMENT</span>
                <span className="spec-val">
                  {provider.isPrototype ? 'Deterministic Ephemeral' : 'Lace Shielded Keyring'}
                </span>
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
