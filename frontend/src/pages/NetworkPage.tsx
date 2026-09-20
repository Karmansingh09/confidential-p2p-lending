import React from 'react';
import type { AccountContext } from '../types/account.ts';
import { NetworkStatusPanel } from '../components/NetworkStatusPanel.tsx';
import type { NavigationTab } from '../types/navigation.ts';
import { getNetworkConfigService } from '../lib/network-config-service.ts';
import { getContractVerificationService } from '../lib/contract-verification-service.ts';

export interface NetworkPageProps {
  accountContext: AccountContext;
  onDisconnect?: () => void;
  onConnect?: () => void;
  onNavigate: (tab: NavigationTab) => void;
}

export const NetworkPage: React.FC<NetworkPageProps> = ({
  accountContext,
  onDisconnect,
  onConnect,
  onNavigate,
}) => {
  const netConfig = getNetworkConfigService().getNetworkConfig();
  const verificationService = getContractVerificationService();
  const verificationResult = verificationService.getVerificationResult();

  const isConnected = accountContext.connectionStatus === 'CONNECTED';

  return (
    <div className="overview-page network-page">
      {/* 1. Network Header */}
      <section className="overview-intro">
        <div className="overview-intro-left">
          <div className="overview-kicker font-mono">
            <span>MIDNIGHT NETWORK</span>
            <span className="kicker-sep">//</span>
            <span>INFRASTRUCTURE MONITOR</span>
          </div>
          <h1 className="overview-headline">Network Infrastructure</h1>
          <p className="overview-lead">
            Real-time ledger transport configuration, RPC node connectivity, and contract verification status.
          </p>
        </div>

        <div className="overview-intro-right">
          <div className="overview-protocol-meta font-mono">
            <div className="meta-item">
              <span className="meta-label">NETWORK ID</span>
              <span className="meta-val text-accent">{netConfig.networkName || 'MIDNIGHT LOCAL'}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">ENVIRONMENT</span>
              <span className="meta-val">{netConfig.environment}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">TRANSPORT STATUS</span>
              <span className="meta-val text-accent">{netConfig.status}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">VERIFICATION</span>
              <span className="meta-val">{verificationResult.status}</span>
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

      {/* 2. Real Infrastructure Telemetry Strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '28px',
        padding: '24px 0',
        marginBottom: '40px',
        borderTop: '1px solid rgba(159, 184, 216, 0.08)',
        borderBottom: '1px solid rgba(159, 184, 216, 0.08)',
      }} className="font-mono">
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', letterSpacing: '0.06em' }}>01 / LEDGER TRANSPORT</div>
          <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{netConfig.networkName || 'Midnight Local'}</strong>
          <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {netConfig.environment} &bull; <span className={netConfig.status === 'CONFIGURED' ? 'text-success' : 'text-warning'}>{netConfig.status}</span>
          </p>
        </div>

        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', letterSpacing: '0.06em' }}>02 / WALLET CONNECTOR</div>
          <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{accountContext.selectedRole || 'BORROWER'}</strong>
          <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            <span className={isConnected ? 'text-success' : 'text-muted'}>{accountContext.connectionStatus}</span>
          </p>
        </div>

        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', letterSpacing: '0.06em' }}>03 / CONTRACT VERIFICATION</div>
          <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{verificationResult.status}</strong>
          <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            <code>{verificationResult.contractAddress ? `${verificationResult.contractAddress.slice(0, 10)}...` : 'Local Compact Facade'}</code>
          </p>
        </div>
      </div>

      {/* 3. Detailed Infrastructure Monitor */}
      <section className="active-lending-workspace">
        <div className="active-lending-header">
          <div className="active-lending-title-group">
            <h2>SUBSYSTEM DETAILS</h2>
            <span className="active-lending-count font-mono">READINESS AUDIT</span>
          </div>
        </div>

        <NetworkStatusPanel
          accountContext={accountContext}
          onDisconnect={onDisconnect}
          onConnect={onConnect}
        />
      </section>
    </div>
  );
};

export default NetworkPage;
