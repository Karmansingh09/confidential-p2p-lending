import React, { useState } from 'react';
import { getWalletProvider } from '../lib/account-service.ts';
import { getNetworkConfigService } from '../lib/network-config-service.ts';
import { getWalletSessionService } from '../lib/wallet-session-service.ts';
import { getContractDeploymentService } from '../lib/contract-deployment-service.ts';
import type { AccountContext } from '../types/account.ts';
import type { NavigationTab } from '../types/navigation.ts';

export interface SystemReadinessBadgeProps {
  accountContext?: AccountContext;
  onNavigateToTab?: (tab: NavigationTab) => void;
  compact?: boolean;
}

export const SystemReadinessBadge: React.FC<SystemReadinessBadgeProps> = ({
  accountContext,
  onNavigateToTab,
  compact = false,
}) => {
  const [showModal, setShowModal] = useState(false);

  const provider = getWalletProvider();
  const netConfig = getNetworkConfigService().getNetworkConfig();
  const sessionService = getWalletSessionService();
  const session = sessionService.getSession();
  const deploymentService = getContractDeploymentService();
  const deployment = deploymentService.getDeployment();

  const isWalletConnected = accountContext?.connectionStatus === 'CONNECTED' || session.status === 'CONNECTED';
  const isNetworkConfigured = netConfig.status === 'CONFIGURED';
  const isContractVerified = deployment.isVerified || deployment.status === 'VERIFIED' || deployment.status === 'READY';
  const isTransactionReady = isWalletConnected && isNetworkConfigured && isContractVerified && !provider.isPrototype;

  const walletStatusLabel = isWalletConnected ? 'Connected' : 'Disconnected';
  const networkStatusLabel = isNetworkConfigured ? 'Configured' : netConfig.status === 'INVALID' ? 'Invalid' : 'Not Configured';
  const contractStatusLabel = isContractVerified ? 'Verified' : deployment.status === 'NOT_DEPLOYED' ? 'Not Deployed' : 'Unverified';
  const txStatusLabel = isTransactionReady ? 'Ready' : provider.isPrototype ? 'Prototype (Read-Only)' : 'Blocked';

  const overallReady = isWalletConnected && isNetworkConfigured && isContractVerified;

  if (compact) {
    return (
      <div className="system-readiness-compact" onClick={() => setShowModal(true)} title="Click to view full System Readiness diagnostics">
        <div className="readiness-dots-row">
          <span className={`readiness-indicator-dot ${isWalletConnected ? 'dot-success' : 'dot-warning'}`} title={`Wallet: ${walletStatusLabel}`} />
          <span className={`readiness-indicator-dot ${isNetworkConfigured ? 'dot-success' : 'dot-danger'}`} title={`Network: ${networkStatusLabel}`} />
          <span className={`readiness-indicator-dot ${isContractVerified ? 'dot-success' : 'dot-warning'}`} title={`Contract: ${contractStatusLabel}`} />
          <span className={`readiness-indicator-dot ${isTransactionReady ? 'dot-success' : 'dot-muted'}`} title={`Transaction: ${txStatusLabel}`} />
        </div>
        <span className="readiness-compact-label">
          {overallReady ? 'System Ready' : 'Diagnostics'}
        </span>

        {showModal && (
          <div className="readiness-modal-backdrop" onClick={(e) => { e.stopPropagation(); setShowModal(false); }}>
            <div className="readiness-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="readiness-modal-header">
                <h3>System Infrastructure Readiness</h3>
                <button type="button" className="btn-close-modal" onClick={() => setShowModal(false)}>&times;</button>
              </div>
              <div className="readiness-items-grid">
                <div className="readiness-item-card">
                  <div className="item-card-top">
                    <span className="item-name">Wallet Boundary</span>
                    <span className={`item-badge ${isWalletConnected ? 'badge-success' : 'badge-warning'}`}>{walletStatusLabel}</span>
                  </div>
                  <p className="item-desc">
                    {isWalletConnected ? `Connected to ${provider.name}` : 'Connect a wallet to sign transactions and commit funds.'}
                  </p>
                </div>
                <div className="readiness-item-card">
                  <div className="item-card-top">
                    <span className="item-name">Network Config</span>
                    <span className={`item-badge ${isNetworkConfigured ? 'badge-success' : 'badge-danger'}`}>{networkStatusLabel}</span>
                  </div>
                  <p className="item-desc">
                    Target: {netConfig.networkName || 'Midnight Local'} ({netConfig.environment})
                  </p>
                </div>
                <div className="readiness-item-card">
                  <div className="item-card-top">
                    <span className="item-name">Compact Contract</span>
                    <span className={`item-badge ${isContractVerified ? 'badge-success' : 'badge-warning'}`}>{contractStatusLabel}</span>
                  </div>
                  <p className="item-desc">
                    {deployment.contractAddress ? `Address: ${deployment.contractAddress.slice(0, 10)}...` : 'Contract address not configured'}
                  </p>
                </div>
                <div className="readiness-item-card">
                  <div className="item-card-top">
                    <span className="item-name">Transaction Pipeline</span>
                    <span className={`item-badge ${isTransactionReady ? 'badge-success' : 'badge-neutral'}`}>{txStatusLabel}</span>
                  </div>
                  <p className="item-desc">
                    {provider.isPrototype ? 'Prototype mode operates client-side only without broadcasting.' : 'Live transaction submission enabled.'}
                  </p>
                </div>
              </div>
              <div className="readiness-modal-footer">
                {onNavigateToTab && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setShowModal(false);
                      onNavigateToTab('network');
                    }}
                  >
                    View Network &amp; Contract Details &rarr;
                  </button>
                )}
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="system-readiness-card">
      <div className="system-readiness-header">
        <div className="readiness-header-left">
          <span className="readiness-pulse-icon">&#9679;</span>
          <h4>System Infrastructure Readiness</h4>
        </div>
        <span className={`status-pill ${overallReady ? 'pill-success' : 'pill-neutral'}`}>
          {overallReady ? 'All Systems Operational' : 'Partial / Prototype Readiness'}
        </span>
      </div>
      <div className="readiness-indicators-grid">
        <div className="indicator-cell">
          <div className="indicator-title-row">
            <span className={`indicator-dot ${isWalletConnected ? 'dot-success' : 'dot-warning'}`} />
            <span className="indicator-label">Wallet</span>
          </div>
          <strong className="indicator-val">{walletStatusLabel}</strong>
          <span className="indicator-sub">{provider.name}</span>
        </div>
        <div className="indicator-cell">
          <div className="indicator-title-row">
            <span className={`indicator-dot ${isNetworkConfigured ? 'dot-success' : 'dot-danger'}`} />
            <span className="indicator-label">Network</span>
          </div>
          <strong className="indicator-val">{networkStatusLabel}</strong>
          <span className="indicator-sub">{netConfig.networkName || 'Local Prototype'}</span>
        </div>
        <div className="indicator-cell">
          <div className="indicator-title-row">
            <span className={`indicator-dot ${isContractVerified ? 'dot-success' : 'dot-warning'}`} />
            <span className="indicator-label">Contract</span>
          </div>
          <strong className="indicator-val">{contractStatusLabel}</strong>
          <span className="indicator-sub">Compact Circuits</span>
        </div>
        <div className="indicator-cell">
          <div className="indicator-title-row">
            <span className={`indicator-dot ${isTransactionReady ? 'dot-success' : 'dot-muted'}`} />
            <span className="indicator-label">Execution</span>
          </div>
          <strong className="indicator-val">{txStatusLabel}</strong>
          <span className="indicator-sub">{provider.isPrototype ? 'Zero Fake Hashes' : 'Live Submission'}</span>
        </div>
      </div>
    </div>
  );
};
