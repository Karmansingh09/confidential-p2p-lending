import React from 'react';
import type { AccountContext } from '../types/account.ts';
import { NetworkStatusPanel } from '../components/NetworkStatusPanel.tsx';
import type { NavigationTab } from '../types/navigation.ts';
import { getNetworkConfigService } from '../lib/network-config-service.ts';
import { getContractVerificationService } from '../lib/contract-verification-service.ts';
import { getWalletProvider } from '../lib/account-service.ts';

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
  const provider = getWalletProvider();

  const isConnected = accountContext.connectionStatus === 'CONNECTED';
  const isContractVerified = verificationResult.status === 'VERIFIED';
  const isProto = provider.isPrototype || netConfig.isPrototype;
  const networkNameDisplay = isProto
    ? 'Local Prototype (In-Memory)'
    : 'MIDNIGHT PREPROD';
  const environmentDisplay = isProto
    ? 'Local Sandbox'
    : 'Midnight Preprod';

  return (
    <div className="network-workspace" data-testid="network-page">
      {/* 1. HERO SECTION & VISUAL NETWORK DIAGRAM (35-40% VIEWPORT) */}
      <section className="network-hero-section">
        <div className="network-hero-left">
          <span className="network-hero-eyebrow">MIDNIGHT NETWORK</span>
          <h1 className="network-hero-title">Network</h1>
          <p className="network-hero-lead">
            Monitor network connectivity, wallet access, and contract readiness.
          </p>

          {/* Primary Network Status Area */}
          <div className="network-primary-status">
            <div className="status-heading-row">
              <span className="status-kicker font-mono">BLOCKCHAIN NETWORK</span>
              <div className="status-network-name-row">
                <span className="network-name-display">{networkNameDisplay}</span>
                <div className="status-badge-inline">
                  <span className={`status-dot ${netConfig.status === 'CONFIGURED' ? 'dot-success' : 'dot-warning'}`} />
                  <span className="status-badge-text">
                    {netConfig.status === 'CONFIGURED' ? 'Configured' : netConfig.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="status-sub-grid">
              <div className="sub-grid-item">
                <span className="sub-item-label">Environment</span>
                <span className="sub-item-val">{environmentDisplay}</span>
              </div>
              <div className="sub-grid-item">
                <span className="sub-item-label">DApp Host</span>
                <span className="sub-item-val font-mono" style={{ fontSize: '11px' }}>Local App</span>
              </div>
              <div className="sub-grid-item">
                <span className="sub-item-label">Wallet</span>
                <span className="sub-item-val">{isConnected ? 'Connected' : 'Disconnected'}</span>
              </div>
              <div className="sub-grid-item">
                <span className="sub-item-label">Contract</span>
                <span className="sub-item-val">{isContractVerified ? 'Verified' : 'Not verified'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. VISUAL NETWORK DIAGRAM (Right Hero) */}
        <div className="network-hero-right">
          <div className="network-diagram-card">
            <div className="diagram-header">
              <span className="diagram-title font-mono">TOPOLOGY OVERVIEW</span>
              <span className="diagram-status-pulse">
                <span className="status-dot dot-success" />
                <span className="font-mono text-xs text-accent">ACTIVE</span>
              </span>
            </div>

            <div className="network-tree-diagram">
              {/* Root: Network */}
              <div className="diagram-node root-node">
                <div className="node-icon-dot dot-network" />
                <div className="node-info">
                  <span className="node-label">Network</span>
                  <span className="node-sub font-mono">{networkNameDisplay}</span>
                </div>
                <span className="node-status-tag status-tag-success">ONLINE</span>
              </div>

              {/* Tree Trunk & Branches */}
              <div className="diagram-branches">
                {/* Branch 1: Wallet */}
                <div className="diagram-branch-item">
                  <div className="branch-line-horiz" />
                  <div className="diagram-node child-node">
                    <div className="node-icon-dot dot-wallet" />
                    <div className="node-info">
                      <span className="node-label">Wallet</span>
                      <span className="node-sub font-mono">{provider.name}</span>
                    </div>
                    <span className={`node-status-tag ${isConnected ? 'status-tag-success' : 'status-tag-muted'}`}>
                      {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
                    </span>
                  </div>
                </div>

                {/* Branch 2: Contract */}
                <div className="diagram-branch-item">
                  <div className="branch-line-horiz" />
                  <div className="diagram-node child-node">
                    <div className="node-icon-dot dot-contract" />
                    <div className="node-info">
                      <span className="node-label">Contract</span>
                      <span className="node-sub font-mono">
                        {isProto ? 'Compact Facade' : 'ConfidentialP2PLending'}
                      </span>
                    </div>
                    <span className={`node-status-tag ${isContractVerified ? 'status-tag-success' : 'status-tag-warning'}`}>
                      {isContractVerified ? 'VERIFIED' : 'NOT VERIFIED'}
                    </span>
                  </div>
                </div>

                {/* Branch 3: Transaction Layer */}
                <div className="diagram-branch-item">
                  <div className="branch-line-horiz" />
                  <div className="diagram-node child-node">
                    <div className="node-icon-dot dot-tx" />
                    <div className="node-info">
                      <span className="node-label">Transaction Layer</span>
                      <span className="node-sub font-mono">Atomic Ledger</span>
                    </div>
                    <span className="node-status-tag status-tag-amber">UNSUPPORTED</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="diagram-footer">
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

      {/* 3. NETWORK HEALTH HORIZONTAL FLOW */}
      <section className="network-health-section" aria-label="Network health">
        <div className="health-section-header">
          <h2 className="section-heading">Network health</h2>
          <span className="health-meta-tag font-mono">INFRASTRUCTURE STATUS</span>
        </div>

        <div className="network-health-flow">
          {/* Stage 1: NETWORK */}
          <div className="health-stage">
            <div className="stage-top">
              <span className="stage-step-num font-mono">01</span>
              <span className="stage-name font-mono">NETWORK</span>
            </div>
            <div className="stage-status-row">
              <span className="status-dot dot-success" />
              <span className="stage-status-text">Available</span>
            </div>
          </div>

          <div className="health-flow-connector" aria-hidden="true" />

          {/* Stage 2: WALLET */}
          <div className="health-stage">
            <div className="stage-top">
              <span className="stage-step-num font-mono">02</span>
              <span className="stage-name font-mono">WALLET</span>
            </div>
            <div className="stage-status-row">
              <span className={`status-dot ${isConnected ? 'dot-success' : 'dot-muted'}`} />
              <span className="stage-status-text">{isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
          </div>

          <div className="health-flow-connector" aria-hidden="true" />

          {/* Stage 3: CONTRACT */}
          <div className="health-stage">
            <div className="stage-top">
              <span className="stage-step-num font-mono">03</span>
              <span className="stage-name font-mono">CONTRACT</span>
            </div>
            <div className="stage-status-row">
              <span className={`status-dot ${isContractVerified ? 'dot-success' : 'dot-warning'}`} />
              <span className="stage-status-text">{isContractVerified ? 'Verified' : 'Not verified'}</span>
            </div>
          </div>

          <div className="health-flow-connector" aria-hidden="true" />

          {/* Stage 4: TRANSACTIONS */}
          <div className="health-stage">
            <div className="stage-top">
              <span className="stage-step-num font-mono">04</span>
              <span className="stage-name font-mono">TRANSACTIONS</span>
            </div>
            <div className="stage-status-row">
              <span className="status-dot dot-warning" />
              <span className="stage-status-text">Unsupported</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. DETAILED INFRASTRUCTURE & CONTRACT READINESS */}
      <NetworkStatusPanel
        accountContext={accountContext}
        onDisconnect={onDisconnect}
        onConnect={onConnect}
      />
    </div>
  );
};

export default NetworkPage;
