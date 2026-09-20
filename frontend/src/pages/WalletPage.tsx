import React, { useState } from 'react';
import type { AccountContext, AccountRole } from '../types/account.ts';
import { getWalletProvider } from '../lib/account-service.ts';
import { WalletSessionPanel } from '../components/WalletSessionPanel.tsx';
import { WalletConnectionPanel } from '../components/WalletConnectionPanel.tsx';
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
  const caps = provider.getCapabilities();
  const isConnected = accountContext.connectionStatus === 'CONNECTED';
  const isDetected = true; // Provider exists in browser
  const isTxCapable = caps.SIGN_TRANSACTION && caps.SUBMIT_TRANSACTION;

  return (
    <div className="overview-page wallet-page">
      {/* 1. Header */}
      <section className="overview-intro">
        <div className="overview-intro-left">
          <div className="overview-kicker font-mono">
            <span>MIDNIGHT NETWORK</span>
            <span className="kicker-sep">//</span>
            <span>CRYPTOGRAPHIC WALLET STATE</span>
          </div>
          <h1 className="overview-headline">Wallet Readiness</h1>
          <p className="overview-lead">
            Cryptographic identity verification, wallet provider session lifecycle, and zero-knowledge execution capabilities.
          </p>
        </div>

        <div className="overview-intro-right">
          <div className="overview-protocol-meta font-mono">
            <div className="meta-item">
              <span className="meta-label">PROVIDER</span>
              <span className="meta-val text-accent">{provider.name}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">ACTIVE ROLE</span>
              <span className="meta-val">{accountContext.selectedRole || 'BORROWER'}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">NETWORK</span>
              <span className="meta-val">{accountContext.networkName || 'MIDNIGHT LOCAL'}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">STATUS</span>
              <span className="meta-val text-accent">{accountContext.connectionStatus}</span>
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

      {/* 2. Visual Tri-State Readiness Indicator: DETECTED → CONNECTED → TRANSACTION CAPABLE */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '24px',
        padding: '24px 0',
        marginBottom: '40px',
        borderTop: '1px solid rgba(159, 184, 216, 0.08)',
        borderBottom: '1px solid rgba(159, 184, 216, 0.08)',
      }} className="font-mono">
        <div style={{
          padding: '16px 20px',
          backgroundColor: 'rgba(13, 17, 26, 0.4)',
          borderLeft: `2px solid ${isDetected ? 'var(--status-success)' : 'var(--status-warning)'}`,
        }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', letterSpacing: '0.06em' }}>01 / DISCOVERY</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>DETECTED</strong>
            <span className={`badge ${isDetected ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '10px' }}>
              {isDetected ? 'AVAILABLE' : 'NOT DETECTED'}
            </span>
          </div>
          <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.4 }}>
            Wallet connector recognized in browser runtime environment.
          </p>
        </div>

        <div style={{
          padding: '16px 20px',
          backgroundColor: 'rgba(13, 17, 26, 0.4)',
          borderLeft: `2px solid ${isConnected ? 'var(--status-success)' : 'var(--status-warning)'}`,
        }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', letterSpacing: '0.06em' }}>02 / IDENTITY</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>CONNECTED</strong>
            <span className={`badge ${isConnected ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '10px' }}>
              {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
            </span>
          </div>
          <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.4 }}>
            Public account key authenticated. Ready for session queries.
          </p>
        </div>

        <div style={{
          padding: '16px 20px',
          backgroundColor: 'rgba(13, 17, 26, 0.4)',
          borderLeft: `2px solid ${isTxCapable ? 'var(--accent-primary)' : 'var(--status-warning)'}`,
        }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', letterSpacing: '0.06em' }}>03 / AUTHORIZATION</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>TRANSACTION CAPABLE</strong>
            <span className={`badge ${isTxCapable ? 'badge-accent' : 'badge-warning'}`} style={{ fontSize: '10px' }}>
              {isTxCapable ? 'CAPABLE' : 'READ ONLY'}
            </span>
          </div>
          <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.4 }}>
            Cryptographic proof creation and transaction signing enabled.
          </p>
        </div>
      </div>

      {/* 3. Account Persona Switcher */}
      <section className="active-lending-workspace">
        <div className="active-lending-header">
          <div className="active-lending-title-group">
            <h2>ACCOUNT IDENTITY & PERSONA</h2>
            <span className="active-lending-count font-mono">{provider.name}</span>
          </div>
        </div>

        <AccountSwitcher
          accountContext={accountContext}
          onSwitchRole={onSwitchRole}
          onDisconnect={onDisconnect}
          onConnect={onConnect}
        />
      </section>

      {/* 4. Provider Lifecycle Panels */}
      <section className="active-lending-workspace">
        <div className="active-lending-header">
          <div className="active-lending-title-group">
            <h2>WALLET CONNECTIONS & CAPABILITIES</h2>
            <span className="active-lending-count font-mono">DETERMINISTIC TESTING</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
          <WalletSessionPanel onProviderSwitched={handleProviderSwitched} />
          <WalletConnectionPanel onProviderSwitched={handleProviderSwitched} />
        </div>
      </section>
    </div>
  );
};

export default WalletPage;
