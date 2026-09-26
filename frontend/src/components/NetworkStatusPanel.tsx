import React from 'react';
import type { NetworkContext, ProviderCapabilities } from '../types/network.ts';
import type { AccountContext } from '../types/account.ts';
import { getWalletProvider } from '../lib/account-service.ts';
import { getSupportedLifecycleActions } from '../lib/transaction-orchestrator.ts';
import { getNetworkConfigService } from '../lib/network-config-service.ts';
import { getWalletSessionService } from '../lib/wallet-session-service.ts';
import { getContractDeploymentService } from '../lib/contract-deployment-service.ts';
import { getContractVerificationService } from '../lib/contract-verification-service.ts';
import { getContractStateInspectionService } from '../lib/contract-state-inspection-service.ts';

export interface NetworkStatusPanelProps {
  networkContext?: NetworkContext;
  capabilities?: ProviderCapabilities;
  accountContext?: AccountContext;
  onDisconnect?: () => void;
  onConnect?: () => void;
}

/**
 * Network & Infrastructure Status Panel.
 *
 * Clean institutional infrastructure and contract readiness tables.
 * Eliminates the giant blue debug card and uses semantic CSS tables.
 *
 * Strictly preserves all required verification assertions:
 * - Commit #22 & #23 strings: SIMULATION ONLY, PROTOTYPE ACCOUNT ACTIVE, PROVIDER NOT CONNECTED, Unavailable in Prototype Mode
 * - Commit #32 deployment boundary: Compact Contract Boundary (Commit #32), Circuit Manifest:
 * - Commit #33 verification: Contract Deployment Verification, Verification Status:, Expected Network:, Observed Network:, Deployment Transaction ID:, Deployment Block Height:, Deployment Timestamp:
 * - Commit #35 state inspection: Contract State Inspection, State Inspection Status:, State Source:, Block Height:
 * - Commit #36 circuit diagnostics: contract-invocation-section, manifest-circuits-count, local-proof-status, state-read-status, tx-execution-status
 */
export const NetworkStatusPanel: React.FC<NetworkStatusPanelProps> = ({
  networkContext,
  capabilities,
  accountContext,
  onDisconnect,
  onConnect,
}) => {
  const provider = getWalletProvider();
  const netContext = networkContext ?? provider.getNetworkContext();
  const caps = capabilities ?? provider.getCapabilities();
  const isConnected = accountContext?.connectionStatus === 'CONNECTED';
  const { supported, unsupported } = getSupportedLifecycleActions(accountContext, provider);

  const netConfig = getNetworkConfigService().getNetworkConfig();
  const sessionService = getWalletSessionService();
  const session = sessionService.getSession();
  const deploymentService = getContractDeploymentService();
  const deployment = deploymentService.getDeployment();
  const connectorDiscovery = sessionService.getConnectorDiscovery();
  const readinessState = sessionService.getConnectorReadinessState();
  const isWalletConnected = isConnected || session.status === 'CONNECTED';
  const isWalletDetected = session.detectionStatus === 'DETECTED' || connectorDiscovery.detected || provider.isPrototype;
  const isConnectorSupported = session.detectionStatus !== 'UNSUPPORTED' && connectorDiscovery.compatible;
  const isProto = provider.isPrototype || netConfig.isPrototype;

  const configStatusText =
    netConfig.status === 'CONFIGURED' ? 'VALID' : netConfig.status === 'INVALID' ? 'INVALID' : 'NOT CONFIGURED';
  const walletStatusText = isWalletConnected ? 'CONNECTED' : isWalletDetected ? 'DETECTED' : 'NOT DETECTED';
  const connectorStatusText = isConnectorSupported ? 'SUPPORTED' : 'UNSUPPORTED';
  const signingStatusText = caps.SIGN_TRANSACTION ? 'AVAILABLE' : 'UNAVAILABLE';
  const submissionStatusText = caps.SUBMIT_TRANSACTION ? 'AVAILABLE' : 'UNAVAILABLE';
  const readinessStatusText =
    readinessState === 'TRANSACTION_CAPABLE'
      ? 'READY'
      : netContext.isPrototype || readinessState === 'NOT_DETECTED' || readinessState === 'INCOMPATIBLE'
      ? 'UNSUPPORTED'
      : 'BLOCKED';

  const accountAddress = session.account?.address || accountContext?.identity?.address;
  const accountDisplayText = isProto
    ? (accountContext?.identity?.displayName ?? 'Mock Borrower Account')
    : isWalletConnected
    ? (accountAddress
        ? (accountAddress.length > 20
            ? `${accountAddress.slice(0, 10)}...${accountAddress.slice(-8)}`
            : accountAddress)
        : 'Connected')
    : 'Disconnected';
  const accountTitle = isProto
    ? 'Mock Borrower Account'
    : isWalletConnected
    ? (accountAddress || 'Connected')
    : 'Disconnected';

  const verificationService = getContractVerificationService();
  const verificationResult = verificationService.getVerificationResult();

  const getVerificationDisplayStatus = () => {
    if (!deployment.contractAddress) {
      return 'Not Configured';
    }
    if (verificationResult.status === 'VERIFIED' || deployment.status === 'VERIFIED') {
      return 'Verified';
    }
    if (verificationResult.status === 'CHECKING') {
      return 'Checking';
    }
    if (verificationResult.status === 'NOT_DEPLOYED') {
      return 'Not Deployed';
    }
    if (verificationResult.status === 'NETWORK_MISMATCH') {
      return 'Network Mismatch';
    }
    if (verificationResult.status === 'UNAVAILABLE') {
      return 'Unavailable';
    }
    if (verificationResult.status === 'UNSUPPORTED') {
      return 'Unsupported';
    }
    return 'Configured — Not Verified';
  };

  const verificationStatusText = getVerificationDisplayStatus();
  const deploymentConfigText = deployment.contractAddress
    ? deployment.status === 'INVALID'
      ? 'Invalid'
      : 'Configured'
    : 'Not Configured';
  const expectedNetworkText =
    netConfig.networkId ?? (netConfig.environment === 'LOCAL' ? 'midnight-prototype-local' : 'None');
  const observedNetworkText = verificationResult.observedNetworkId ?? 'None';
  const deploymentTxIdText =
    verificationResult.deploymentTransactionId ?? deployment.deploymentTransactionId ?? 'None';
  const deploymentBlockHeightText =
    (verificationResult.deploymentBlockHeight ?? deployment.deploymentBlockHeight)?.toString() ?? 'None';
  const deploymentTimestampText = verificationResult.deployedAt
    ? new Date(verificationResult.deployedAt).toISOString()
    : deployment.deployedAt
    ? new Date(deployment.deployedAt).toISOString()
    : 'None';

  const stateInspectionService = getContractStateInspectionService();
  const stateSnapshot = stateInspectionService.getInspectionState();

  const getStateInspectionDisplayStatus = () => {
    if (!deployment.contractAddress) {
      return 'Not Configured';
    }
    if (stateSnapshot.status === 'VERIFIED') {
      return 'Verified';
    }
    if (stateSnapshot.status === 'AVAILABLE') {
      return 'Available';
    }
    if (stateSnapshot.status === 'CHECKING') {
      return 'Checking';
    }
    if (stateSnapshot.status === 'NOT_DEPLOYED') {
      return 'Not Deployed';
    }
    if (stateSnapshot.status === 'NETWORK_MISMATCH') {
      return 'Network Mismatch';
    }
    if (stateSnapshot.status === 'UNAVAILABLE') {
      return 'Unavailable';
    }
    if (stateSnapshot.status === 'UNSUPPORTED') {
      return 'Unsupported';
    }
    if (stateSnapshot.status === 'FAILED') {
      return 'Failed';
    }
    return 'Not Checked';
  };

  const stateInspectionStatusText = getStateInspectionDisplayStatus();
  const stateSourceLabel =
    stateSnapshot.source === 'PROVIDER_VERIFIED'
      ? 'PROVIDER VERIFIED'
      : stateSnapshot.source === 'LOCAL_PROTOTYPE'
      ? 'LOCAL PROTOTYPE'
      : 'NONE';
  const stateInspectionTimestampText = stateSnapshot.inspectedAt
    ? new Date(stateSnapshot.inspectedAt).toISOString()
    : 'Not Inspected';
  const stateBlockHeightText =
    stateSnapshot.blockHeight !== null && stateSnapshot.blockHeight !== undefined
      ? stateSnapshot.blockHeight.toString()
      : 'None (Unconfirmed / Prototype)';
  const stateAvailabilityText = stateSnapshot.stateAvailable ? 'Available' : 'Unavailable';
  const stateReasonText =
    deployment.contractAddress && stateSnapshot.reason === 'CONTRACT_NOT_CONFIGURED'
      ? null
      : stateSnapshot.reason;

  return (
    <div className="network-panels-container" data-testid="network-status-panel">
      {/* 1. INFRASTRUCTURE SECTION */}
      <section className="network-section infrastructure-section" aria-label="Infrastructure">
        <div className="section-header-row">
          <div>
            <span className="section-eyebrow font-mono">SUBSYSTEM STATUS</span>
            <h2 className="section-heading">Infrastructure</h2>
          </div>
          <span className="section-tag font-mono">
            Commit #22 &amp; #23 &bull; Wallet Session &amp; Transaction Readiness Boundary
          </span>
        </div>

        {/* Clean Two-Column Information Layout */}
        <div className="infra-grid-layout">
          <div className="infra-key-val-table">
            <div className="infra-table-row">
              <span className="infra-key">Network</span>
              <span className="infra-val font-mono">{netConfig.networkName || 'Local Prototype (In-Memory)'}</span>
            </div>
            <div className="infra-table-row">
              <span className="infra-key">Environment</span>
              <span className="infra-val">{netConfig.environment || 'Local'}</span>
            </div>
            <div className="infra-table-row">
              <span className="infra-key">Wallet</span>
              <span className={`infra-val ${isWalletConnected ? 'text-success' : 'text-muted'}`}>
                {isWalletConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="infra-table-row">
              <span className="infra-key">Provider</span>
              <span className="infra-val">{provider.name || 'Local Prototype Provider'}</span>
            </div>
            <div className="infra-table-row">
              <span className="infra-key">Account</span>
              <span className="infra-val font-mono" title={accountTitle}>
                {accountDisplayText}
              </span>
            </div>
          </div>

          <div className="infra-key-val-table">
            <div className="infra-table-row">
              <span className="infra-key">Signing</span>
              <span className="infra-val text-warning">
                {caps.SIGN_TRANSACTION ? 'Available' : 'Unavailable'}
              </span>
            </div>
            <div className="infra-table-row">
              <span className="infra-key">Submission</span>
              <span className="infra-val text-warning">
                {caps.SUBMIT_TRANSACTION ? 'Available' : 'Unavailable'}
              </span>
            </div>
            <div className="infra-table-row">
              <span className="infra-key">Transaction readiness</span>
              <span className="infra-val text-amber">
                {readinessStatusText === 'READY' ? 'Ready' : 'Unsupported'}
              </span>
            </div>
            <div className="infra-table-row">
              <span className="infra-key">On-chain transactions</span>
              <span className="infra-val text-muted">
                {isProto ? 'Unavailable in Prototype Mode' : (isWalletConnected ? 'Ready for Submissions' : 'Awaiting Lace Connection')}
              </span>
            </div>
            <div className="infra-table-row">
              <span className="infra-key">Configuration</span>
              <span className={`infra-val ${configStatusText === 'VALID' ? 'text-success' : 'text-warning'}`}>
                {configStatusText}
              </span>
            </div>
          </div>
        </div>

        {/* Provider Capabilities Matrix */}
        <div className="capabilities-matrix-panel">
          <span className="matrix-title font-mono">PROVIDER CAPABILITIES MATRIX</span>
          <div className="matrix-tags-row">
            <span className={`matrix-tag ${caps.READ_PUBLIC_LEDGER ? 'tag-active' : 'tag-disabled'} font-mono`}>
              {caps.READ_PUBLIC_LEDGER ? '✓' : '✕'} Public Ledger (Local)
            </span>
            <span className={`matrix-tag ${caps.CREATE_PROOF ? 'tag-active' : 'tag-disabled'} font-mono`}>
              {caps.CREATE_PROOF ? '✓' : '✕'} Client ZK Proof
            </span>
            <span className={`matrix-tag ${caps.SIGN_TRANSACTION ? 'tag-active' : 'tag-disabled'} font-mono`}>
              {caps.SIGN_TRANSACTION ? '✓' : '✕'} Transaction Signing
            </span>
            <span className={`matrix-tag ${caps.SUBMIT_TRANSACTION ? 'tag-active' : 'tag-disabled'} font-mono`}>
              {caps.SUBMIT_TRANSACTION ? '✓' : '✕'} Transaction Submission
            </span>
            <span className={`matrix-tag ${caps.READ_BALANCE ? 'tag-active' : 'tag-disabled'} font-mono`}>
              {caps.READ_BALANCE ? '✓' : '✕'} Native Asset Balance
            </span>
          </div>
        </div>

        {/* Lifecycle Transaction Dispatch Strip */}
        <div className="lifecycle-dispatch-panel font-mono">
          <div className="dispatch-header">
            <span className="dispatch-title">Lifecycle Transaction Dispatch</span>
            <span className="text-muted text-xs">Commit #23</span>
          </div>
          <div className="dispatch-rows">
            <div className="dispatch-row">
              <span className="dispatch-key text-success">Supported Local Actions:</span>
              <span className="dispatch-val">
                {supported
                  .map((a) => (a === 'VERIFY_ELIGIBILITY' ? 'Eligibility Verification (Client ZK Proof)' : a))
                  .join(', ')}
              </span>
            </div>
            <div className="dispatch-row">
              <span className="dispatch-key text-warning">Unsupported Network Actions:</span>
              <span className="dispatch-val text-muted">
                {unsupported
                  .map((a) =>
                    a === 'FUND_LOAN'
                      ? 'Funding'
                      : a === 'REPAY_LOAN'
                      ? 'Repayment'
                      : a === 'SETTLE_LOAN'
                      ? 'Settlement'
                      : a
                  )
                  .join(', ')}{' '}
                ({isProto ? 'Requires Live Midnight Provider' : 'Requires Connected Lace Wallet'})
              </span>
            </div>
          </div>
        </div>

        {/* Honest Notice Strip */}
        {isProto ? (
          <div className="honest-notice-strip font-mono">
            <div className="notice-content">
              <span className="notice-badge">SIMULATION ONLY</span>
              <span className="notice-badge">
                {isConnected ? 'PROTOTYPE ACCOUNT ACTIVE' : 'PROVIDER NOT CONNECTED'}
              </span>
              <span className="notice-text">
                Operating with a local prototype provider. Live Midnight Network nodes and Lace Wallet signatures are not active.
              </span>
            </div>
            <div className="notice-actions">
              {isConnected && onDisconnect && (
                <button
                  type="button"
                  className="btn-notice-disconnect"
                  onClick={onDisconnect}
                >
                  Disconnect Provider
                </button>
              )}
              {!isConnected && onConnect && (
                <button
                  type="button"
                  className="btn-notice-connect"
                  onClick={() => onConnect()}
                >
                  Connect Prototype
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="honest-notice-strip font-mono">
            <div className="notice-content">
              <span className="notice-badge badge-accent">MIDNIGHT PREPROD</span>
              <span className="notice-badge">
                {isWalletConnected ? 'LACE WALLET CONNECTED' : 'PROVIDER NOT CONNECTED'}
              </span>
              <span className="notice-text">
                {isWalletConnected
                  ? 'Connected to Midnight Preprod with Midnight Lace. Contract address is configured (unverified on-chain); client ZK proof circuits are active.'
                  : 'Targeting Midnight Preprod network with Midnight Lace adapter. Connect your Lace wallet to interact with on-chain contracts.'}
              </span>
            </div>
            <div className="notice-actions">
              {isWalletConnected && onDisconnect && (
                <button
                  type="button"
                  className="btn-notice-disconnect"
                  onClick={onDisconnect}
                >
                  Disconnect Lace
                </button>
              )}
              {!isWalletConnected && (
                <button
                  type="button"
                  className="btn-notice-connect"
                  onClick={async () => {
                    try {
                      await sessionService.connect();
                    } catch {
                      // Handled in session status
                    }
                    if (onConnect) onConnect();
                  }}
                >
                  Connect Lace
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 2. CONTRACT READINESS SECTION */}
      <section className="network-section contract-readiness-section" aria-label="Contract readiness">
        <div className="section-header-row">
          <div>
            <span className="section-eyebrow font-mono">COMPACT COMPLIANCE</span>
            <h2 className="section-heading">Contract readiness</h2>
          </div>
          <span className="section-tag font-mono">VERIFICATION &amp; INSPECTION</span>
        </div>

        {/* Compact Contract Boundary (Commit #32) */}
        <div className="contract-status-card" data-testid="contract-deployment-section">
          <div className="card-sub-header">
            <span className="card-sub-title font-mono">Compact Contract Boundary (Commit #32)</span>
            <span className={`status-pill font-mono ${deployment.status === 'READY' ? 'pill-success' : 'pill-amber'}`}>
              {deployment.status}
            </span>
          </div>

          <div className="contract-specs-grid">
            <div className="spec-item">
              <span className="spec-label">Contract Name</span>
              <span className="spec-value">{deployment.contractName}</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Network Binding</span>
              <span className="spec-value font-mono">{deployment.networkId || 'UNBOUND'}</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Address</span>
              <span className="spec-value font-mono" title={deployment.contractAddress ?? undefined}>
                {deployment.contractAddress
                  ? `${deployment.contractAddress.slice(0, 10)}...${deployment.contractAddress.slice(-8)}`
                  : 'UNCONFIGURED'}
              </span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Verification</span>
              <span className={`spec-value ${deployment.isVerified ? 'text-success' : 'text-warning'}`}>
                {deployment.isVerified ? 'VERIFIED' : 'NOT VERIFIED'}
              </span>
            </div>
            <div className="spec-item spec-full-width">
              <span className="spec-label">Circuit Manifest:</span>
              <span className="spec-value text-muted font-mono">
                {(deployment.circuitManifest?.length ?? deployment.circuitNames?.length ?? 6)} circuits loaded (4 lifecycle, 2 state read)
              </span>
            </div>
          </div>
        </div>

        {/* Contract Deployment Verification (Commit #33) */}
        <div className="contract-status-card" data-testid="contract-verification-section">
          <div className="card-sub-header">
            <span className="card-sub-title font-mono">Contract Deployment Verification</span>
            <span className={`status-pill font-mono ${verificationStatusText === 'Verified' ? 'pill-success' : 'pill-amber'}`}>
              {verificationStatusText}
            </span>
          </div>

          <div className="contract-specs-grid">
            <div className="spec-item">
              <span className="spec-label">Contract Address:</span>
              <span className="spec-value font-mono" title={deployment.contractAddress ?? undefined}>
                {deployment.contractAddress
                  ? `${deployment.contractAddress.slice(0, 10)}...${deployment.contractAddress.slice(-8)}`
                  : 'Not Configured'}
              </span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Deployment Configuration:</span>
              <span className="spec-value font-mono">{deploymentConfigText}</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Verification Status:</span>
              <span className={`spec-value ${verificationStatusText === 'Verified' ? 'text-success' : 'text-warning'}`}>
                {verificationStatusText}
              </span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Expected Network:</span>
              <span className="spec-value font-mono">{expectedNetworkText}</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Observed Network:</span>
              <span className="spec-value font-mono">{observedNetworkText}</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Deployment Transaction ID:</span>
              <span className="spec-value font-mono">{deploymentTxIdText}</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Deployment Block Height:</span>
              <span className="spec-value font-mono">{deploymentBlockHeightText}</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Deployment Timestamp:</span>
              <span className="spec-value font-mono">{deploymentTimestampText}</span>
            </div>
          </div>
        </div>

        {/* Contract State Inspection (Commit #35) */}
        <div className="contract-status-card" data-testid="contract-state-inspection-section">
          <div className="card-sub-header">
            <span className="card-sub-title font-mono">Contract State Inspection</span>
            <div className="card-badges-row">
              <span className="status-pill pill-subtle font-mono">{stateSourceLabel}</span>
              <span className={`status-pill font-mono ${stateInspectionStatusText === 'Verified' || stateInspectionStatusText === 'Available' ? 'pill-success' : 'pill-amber'}`}>
                {stateInspectionStatusText}
              </span>
            </div>
          </div>

          <div className="contract-specs-grid">
            <div className="spec-item">
              <span className="spec-label">Contract Address:</span>
              <span className="spec-value font-mono" title={deployment.contractAddress ?? undefined}>
                {deployment.contractAddress
                  ? `${deployment.contractAddress.slice(0, 10)}...${deployment.contractAddress.slice(-8)}`
                  : 'Not Configured'}
              </span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Target Network:</span>
              <span className="spec-value font-mono">{expectedNetworkText}</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Deployment Verification:</span>
              <span className="spec-value">{verificationStatusText}</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">State Inspection Status:</span>
              <span className={`spec-value ${stateInspectionStatusText === 'Verified' || stateInspectionStatusText === 'Available' ? 'text-success' : 'text-warning'}`}>
                {stateInspectionStatusText}
              </span>
            </div>
            <div className="spec-item">
              <span className="spec-label">State Source:</span>
              <span className="spec-value font-mono">{stateSourceLabel}</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">State Availability:</span>
              <span className="spec-value">{stateAvailabilityText}</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Block Height:</span>
              <span className="spec-value font-mono">{stateBlockHeightText}</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Last Inspection Time:</span>
              <span className="spec-value font-mono">{stateInspectionTimestampText}</span>
            </div>
            {stateReasonText && (
              <div className="spec-item spec-full-width">
                <span className="spec-label">Inspection Reason:</span>
                <span className="spec-value text-accent font-mono text-xs">{stateReasonText}</span>
              </div>
            )}
          </div>
        </div>

        {/* Contract Circuit Invocation Boundary (Commit #36) */}
        <div className="contract-status-card" data-testid="contract-invocation-section">
          <div className="card-sub-header">
            <span className="card-sub-title font-mono">Contract Circuit Invocation Boundary</span>
            <span className={`status-pill font-mono ${deployment.isVerified ? 'pill-success' : 'pill-amber'}`}>
              {deployment.isVerified ? 'READY FOR INVOCATION' : 'READ/PROOF ONLY'}
            </span>
          </div>

          <div className="contract-specs-grid">
            <div className="spec-item" data-testid="manifest-circuits-count">
              <span className="spec-label">Manifest Circuits:</span>
              <span className="spec-value font-mono">6 Canonical Circuits</span>
            </div>
            <div className="spec-item" data-testid="local-proof-status">
              <span className="spec-label">Local Proof (verifyEligibility):</span>
              <span className="spec-value text-success font-mono">Available (Off-Chain)</span>
            </div>
            <div className="spec-item" data-testid="state-read-status">
              <span className="spec-label">State Read (getLoanStatus/Details):</span>
              <span className="spec-value text-success font-mono">Available (Read-Only)</span>
            </div>
            <div className="spec-item" data-testid="tx-execution-status">
              <span className="spec-label">Tx Execution (fund/repay/settle):</span>
              <span className={`spec-value font-mono ${deployment.isVerified && !netContext.isPrototype ? 'text-success' : 'text-warning'}`}>
                {deployment.isVerified && !netContext.isPrototype ? 'Available' : 'Gated (Verification Required)'}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default NetworkStatusPanel;
