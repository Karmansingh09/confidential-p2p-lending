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
 * Network & Provider Status Panel.
 *
 * Displays active infrastructure boundaries, connection status, provider capabilities,
 * and transaction orchestration dispatch readiness.
 * STRICT DISCLOSURE:
 * Clearly communicates when operating in local prototype mode without real Midnight connections.
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
  const stateReasonText = stateSnapshot.reason;

  return (
    <div
      style={{
        background: '#1e293b',
        border: '1px solid #334155',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '20px',
        color: '#f8fafc',
      }}
      data-testid="network-status-panel"
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          borderBottom: '1px solid #334155',
          paddingBottom: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>🌐</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>
              Network & Wallet Infrastructure
            </h3>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              Commit #24 &amp; #25 • Wallet Session &amp; Transaction Readiness Boundary
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.05em',
              background: netContext.isPrototype ? '#854d0e' : '#1e3a8a',
              color: '#fef08a',
            }}
          >
            {netContext.isPrototype ? 'SIMULATION ONLY' : 'LIVE NETWORK'}
          </span>
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 600,
              background: isConnected ? '#14532d' : '#7f1d1d',
              color: isConnected ? '#bbf7d0' : '#fecaca',
            }}
          >
            {isConnected ? 'PROTOTYPE ACCOUNT ACTIVE' : 'PROVIDER NOT CONNECTED'}
          </span>
        </div>
      </div>

      {/* Infrastructure Details Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          marginBottom: '14px',
        }}
      >
        <div style={{ background: '#0f172a', padding: '10px', borderRadius: '6px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>
            Network
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '2px', color: '#e2e8f0' }}>
            {netConfig.environment}
          </div>
        </div>

        <div style={{ background: '#0f172a', padding: '10px', borderRadius: '6px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>
            Configuration
          </div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 600,
              marginTop: '2px',
              color: configStatusText === 'VALID' ? '#4ade80' : '#f87171',
            }}
          >
            {configStatusText}
          </div>
        </div>

        <div style={{ background: '#0f172a', padding: '10px', borderRadius: '6px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>
            Wallet
          </div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 600,
              marginTop: '2px',
              color: isWalletConnected ? '#4ade80' : isWalletDetected ? '#93c5fd' : '#f87171',
            }}
          >
            {walletStatusText}
          </div>
        </div>

        <div style={{ background: '#0f172a', padding: '10px', borderRadius: '6px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>
            Connector
          </div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 600,
              marginTop: '2px',
              color: connectorStatusText === 'SUPPORTED' ? '#4ade80' : '#f87171',
            }}
          >
            {connectorStatusText}
          </div>
        </div>

        <div style={{ background: '#0f172a', padding: '10px', borderRadius: '6px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>
            Signing
          </div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 600,
              marginTop: '2px',
              color: signingStatusText === 'AVAILABLE' ? '#4ade80' : '#f87171',
            }}
          >
            {signingStatusText}
          </div>
        </div>

        <div style={{ background: '#0f172a', padding: '10px', borderRadius: '6px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>
            Submission
          </div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 600,
              marginTop: '2px',
              color: submissionStatusText === 'AVAILABLE' ? '#4ade80' : '#f87171',
            }}
          >
            {submissionStatusText}
          </div>
        </div>

        <div style={{ background: '#0f172a', padding: '10px', borderRadius: '6px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>
            Transaction readiness
          </div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 600,
              marginTop: '2px',
              color: readinessStatusText === 'READY' ? '#4ade80' : '#eab308',
            }}
          >
            {readinessStatusText}
          </div>
        </div>

        <div style={{ background: '#0f172a', padding: '10px', borderRadius: '6px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>
            Network Environment
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '2px', color: '#e2e8f0' }}>
            {netContext.networkName} ({netContext.environment})
          </div>
        </div>

        <div style={{ background: '#0f172a', padding: '10px', borderRadius: '6px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>
            Provider Adapter
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '2px', color: '#e2e8f0' }}>
            {provider.name}
          </div>
        </div>

        <div style={{ background: '#0f172a', padding: '10px', borderRadius: '6px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>
            Account Persona
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '2px', color: '#e2e8f0' }}>
            {accountContext?.identity?.displayName ?? 'No Account Connected'}
          </div>
        </div>

        <div style={{ background: '#0f172a', padding: '10px', borderRadius: '6px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>
            On-Chain Transactions
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '2px', color: '#f87171' }}>
            Unavailable in Prototype Mode
          </div>
        </div>
      </div>

      {/* Provider Capabilities Summary */}
      <div
        style={{
          background: '#0f172a',
          padding: '10px 12px',
          borderRadius: '6px',
          marginBottom: '12px',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            color: '#94a3b8',
            textTransform: 'uppercase',
            marginBottom: '8px',
            fontWeight: 600,
          }}
        >
          Provider Capabilities Matrix
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            fontSize: '11px',
          }}
        >
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '4px',
              background: caps.READ_PUBLIC_LEDGER ? '#064e3b' : '#334155',
              color: caps.READ_PUBLIC_LEDGER ? '#a7f3d0' : '#64748b',
            }}
          >
            {caps.READ_PUBLIC_LEDGER ? '✓' : '✕'} Public Ledger (Local)
          </span>

          <span
            style={{
              padding: '2px 8px',
              borderRadius: '4px',
              background: caps.CREATE_PROOF ? '#064e3b' : '#334155',
              color: caps.CREATE_PROOF ? '#a7f3d0' : '#64748b',
            }}
          >
            {caps.CREATE_PROOF ? '✓' : '✕'} Client ZK Proof
          </span>

          <span
            style={{
              padding: '2px 8px',
              borderRadius: '4px',
              background: caps.SIGN_TRANSACTION ? '#064e3b' : '#450a0a',
              color: caps.SIGN_TRANSACTION ? '#a7f3d0' : '#fca5a5',
            }}
          >
            {caps.SIGN_TRANSACTION ? '✓' : '✕'} Transaction Signing
          </span>

          <span
            style={{
              padding: '2px 8px',
              borderRadius: '4px',
              background: caps.SUBMIT_TRANSACTION ? '#064e3b' : '#450a0a',
              color: caps.SUBMIT_TRANSACTION ? '#a7f3d0' : '#fca5a5',
            }}
          >
            {caps.SUBMIT_TRANSACTION ? '✓' : '✕'} Transaction Submission
          </span>

          <span
            style={{
              padding: '2px 8px',
              borderRadius: '4px',
              background: caps.READ_BALANCE ? '#064e3b' : '#450a0a',
              color: caps.READ_BALANCE ? '#a7f3d0' : '#fca5a5',
            }}
          >
            {caps.READ_BALANCE ? '✓' : '✕'} Native Asset Balance
          </span>
        </div>
      </div>

      {/* Contract Deployment Boundary (Commit #32) */}
      <div
        style={{
          background: '#0f172a',
          padding: '12px',
          borderRadius: '6px',
          marginBottom: '12px',
          border: '1px solid #1e293b',
        }}
        data-testid="contract-deployment-section"
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
          }}
        >
          <div
            style={{
              fontSize: '11px',
              color: '#94a3b8',
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            Compact Contract Boundary (Commit #32)
          </div>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 600,
              background:
                deployment.status === 'READY'
                  ? '#064e3b'
                  : deployment.status === 'NOT_DEPLOYED' || deployment.status === 'UNCONFIGURED'
                  ? '#450a0a'
                  : '#78350f',
              color:
                deployment.status === 'READY'
                  ? '#a7f3d0'
                  : deployment.status === 'NOT_DEPLOYED' || deployment.status === 'UNCONFIGURED'
                  ? '#fca5a5'
                  : '#fde68a',
            }}
          >
            {deployment.status}
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '8px',
            fontSize: '11px',
            marginBottom: '8px',
          }}
        >
          <div>
            <span style={{ color: '#94a3b8' }}>Contract Name: </span>
            <span style={{ color: '#f8fafc', fontWeight: 500 }}>{deployment.contractName}</span>
          </div>
          <div>
            <span style={{ color: '#94a3b8' }}>Network Binding: </span>
            <span style={{ color: '#f8fafc', fontWeight: 500 }}>{deployment.networkId || 'UNBOUND'}</span>
          </div>
          <div>
            <span style={{ color: '#94a3b8' }}>Address: </span>
            <span style={{ color: '#f8fafc', fontFamily: 'monospace', fontWeight: 500 }}>
              {deployment.contractAddress
                ? `${deployment.contractAddress.slice(0, 10)}...${deployment.contractAddress.slice(-8)}`
                : 'UNCONFIGURED'}
            </span>
          </div>
          <div>
            <span style={{ color: '#94a3b8' }}>Verification: </span>
            <span
              style={{
                color: deployment.isVerified ? '#34d399' : '#fbbf24',
                fontWeight: 500,
              }}
            >
              {deployment.isVerified ? 'VERIFIED' : 'NOT VERIFIED'}
            </span>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={{ color: '#94a3b8' }}>Circuit Manifest: </span>
            <span style={{ color: '#e2e8f0' }}>
              {(deployment.circuitManifest?.length ?? deployment.circuitNames?.length ?? 6)} circuits loaded (4 lifecycle, 2 state read)
            </span>
          </div>
        </div>

        <div
          style={{
            fontSize: '10px',
            color: '#94a3b8',
            fontStyle: 'italic',
            borderTop: '1px solid #1e293b',
            paddingTop: '6px',
          }}
        >
          Configured address is a routing reference and does not guarantee on-chain existence without provider validation.
        </div>
      </div>

      {/* Contract Deployment Verification (Commit #33) */}
      <div
        style={{
          background: '#0f172a',
          padding: '12px',
          borderRadius: '6px',
          marginBottom: '12px',
          border: '1px solid #1e293b',
        }}
        data-testid="contract-verification-section"
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
          }}
        >
          <div
            style={{
              fontSize: '11px',
              color: '#94a3b8',
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            Contract Deployment Verification
          </div>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 600,
              background:
                verificationStatusText === 'Verified'
                  ? '#064e3b'
                  : verificationStatusText === 'Not Deployed' || verificationStatusText === 'Network Mismatch'
                  ? '#450a0a'
                  : verificationStatusText === 'Checking'
                  ? '#1e3a8a'
                  : '#78350f',
              color:
                verificationStatusText === 'Verified'
                  ? '#a7f3d0'
                  : verificationStatusText === 'Not Deployed' || verificationStatusText === 'Network Mismatch'
                  ? '#fca5a5'
                  : verificationStatusText === 'Checking'
                  ? '#93c5fd'
                  : '#fde68a',
            }}
          >
            {verificationStatusText}
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '8px',
            fontSize: '11px',
            marginBottom: '8px',
          }}
        >
          <div>
            <span style={{ color: '#94a3b8' }}>Contract Address: </span>
            <span style={{ color: '#f8fafc', fontFamily: 'monospace', fontWeight: 500 }}>
              {deployment.contractAddress
                ? `${deployment.contractAddress.slice(0, 10)}...${deployment.contractAddress.slice(-8)}`
                : 'Not Configured'}
            </span>
          </div>

          <div>
            <span style={{ color: '#94a3b8' }}>Deployment Configuration: </span>
            <span style={{ color: '#f8fafc', fontWeight: 500 }}>
              {deploymentConfigText}
            </span>
          </div>

          <div>
            <span style={{ color: '#94a3b8' }}>Verification Status: </span>
            <span
              style={{
                color:
                  verificationStatusText === 'Verified'
                    ? '#34d399'
                    : verificationStatusText === 'Not Deployed' || verificationStatusText === 'Network Mismatch'
                    ? '#f87171'
                    : '#fbbf24',
                fontWeight: 500,
              }}
            >
              {verificationStatusText}
            </span>
          </div>

          <div>
            <span style={{ color: '#94a3b8' }}>Expected Network: </span>
            <span style={{ color: '#f8fafc', fontWeight: 500 }}>
              {expectedNetworkText}
            </span>
          </div>

          <div>
            <span style={{ color: '#94a3b8' }}>Observed Network: </span>
            <span style={{ color: '#f8fafc', fontWeight: 500 }}>
              {observedNetworkText}
            </span>
          </div>

          <div>
            <span style={{ color: '#94a3b8' }}>Deployment Transaction ID: </span>
            <span style={{ color: '#f8fafc', fontFamily: 'monospace', fontWeight: 500 }}>
              {deploymentTxIdText}
            </span>
          </div>

          <div>
            <span style={{ color: '#94a3b8' }}>Deployment Block Height: </span>
            <span style={{ color: '#f8fafc', fontFamily: 'monospace', fontWeight: 500 }}>
              {deploymentBlockHeightText}
            </span>
          </div>

          <div>
            <span style={{ color: '#94a3b8' }}>Deployment Timestamp: </span>
            <span style={{ color: '#f8fafc', fontWeight: 500 }}>
              {deploymentTimestampText}
            </span>
          </div>
        </div>

        <div
          style={{
            fontSize: '10px',
            color: '#94a3b8',
            fontStyle: 'italic',
            borderTop: '1px solid #1e293b',
            paddingTop: '6px',
          }}
        >
          Authoritative on-chain existence verification via genuine provider/indexer response.
        </div>
      </div>

      {/* Contract State Inspection (Commit #35) */}
      <div
        style={{
          background: '#0f172a',
          padding: '10px 12px',
          borderRadius: '6px',
          marginBottom: '12px',
          border: '1px solid #1e293b',
        }}
        data-testid="contract-state-inspection-section"
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
          }}
        >
          <div
            style={{
              fontSize: '11px',
              color: '#94a3b8',
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            Contract State Inspection
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span
              style={{
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: 600,
                background: stateSnapshot.source === 'PROVIDER_VERIFIED' ? '#064e3b' : '#78350f',
                color: stateSnapshot.source === 'PROVIDER_VERIFIED' ? '#a7f3d0' : '#fde68a',
              }}
            >
              {stateSourceLabel}
            </span>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: 600,
                background:
                  stateInspectionStatusText === 'Verified' || stateInspectionStatusText === 'Available'
                    ? '#064e3b'
                    : stateInspectionStatusText === 'Not Deployed' || stateInspectionStatusText === 'Network Mismatch'
                    ? '#450a0a'
                    : stateInspectionStatusText === 'Checking'
                    ? '#1e3a8a'
                    : '#78350f',
                color:
                  stateInspectionStatusText === 'Verified' || stateInspectionStatusText === 'Available'
                    ? '#a7f3d0'
                    : stateInspectionStatusText === 'Not Deployed' || stateInspectionStatusText === 'Network Mismatch'
                    ? '#fca5a5'
                    : stateInspectionStatusText === 'Checking'
                    ? '#93c5fd'
                    : '#fde68a',
              }}
            >
              {stateInspectionStatusText}
            </span>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '8px',
            fontSize: '11px',
            marginBottom: '8px',
          }}
        >
          <div>
            <span style={{ color: '#94a3b8' }}>Contract Address: </span>
            <span style={{ color: '#f8fafc', fontFamily: 'monospace', fontWeight: 500 }}>
              {deployment.contractAddress
                ? `${deployment.contractAddress.slice(0, 10)}...${deployment.contractAddress.slice(-8)}`
                : 'Not Configured'}
            </span>
          </div>

          <div>
            <span style={{ color: '#94a3b8' }}>Target Network: </span>
            <span style={{ color: '#f8fafc', fontWeight: 500 }}>
              {expectedNetworkText}
            </span>
          </div>

          <div>
            <span style={{ color: '#94a3b8' }}>Deployment Verification: </span>
            <span style={{ color: '#f8fafc', fontWeight: 500 }}>
              {verificationStatusText}
            </span>
          </div>

          <div>
            <span style={{ color: '#94a3b8' }}>State Inspection Status: </span>
            <span
              style={{
                color:
                  stateInspectionStatusText === 'Verified' || stateInspectionStatusText === 'Available'
                    ? '#34d399'
                    : stateInspectionStatusText === 'Not Deployed' || stateInspectionStatusText === 'Network Mismatch'
                    ? '#f87171'
                    : '#fbbf24',
                fontWeight: 500,
              }}
            >
              {stateInspectionStatusText}
            </span>
          </div>

          <div>
            <span style={{ color: '#94a3b8' }}>State Source: </span>
            <span style={{ color: '#f8fafc', fontWeight: 500 }}>
              {stateSourceLabel}
            </span>
          </div>

          <div>
            <span style={{ color: '#94a3b8' }}>State Availability: </span>
            <span style={{ color: '#f8fafc', fontWeight: 500 }}>
              {stateAvailabilityText}
            </span>
          </div>

          <div>
            <span style={{ color: '#94a3b8' }}>Block Height: </span>
            <span style={{ color: '#f8fafc', fontFamily: 'monospace', fontWeight: 500 }}>
              {stateBlockHeightText}
            </span>
          </div>

          <div>
            <span style={{ color: '#94a3b8' }}>Last Inspection Time: </span>
            <span style={{ color: '#f8fafc', fontWeight: 500 }}>
              {stateInspectionTimestampText}
            </span>
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <span style={{ color: '#94a3b8' }}>Inspection Reason: </span>
            <span style={{ color: '#93c5fd', fontFamily: 'monospace', fontSize: '10px' }}>
              {stateReasonText}
            </span>
          </div>
        </div>

        <div
          style={{
            fontSize: '10px',
            color: '#94a3b8',
            fontStyle: 'italic',
            borderTop: '1px solid #1e293b',
            paddingTop: '6px',
          }}
        >
          Authoritative on-chain contract state inspection boundary. Local state is strictly separated from provider-verified state.
        </div>
      </div>

      {/* Transaction Orchestration & Dispatch Readiness (Commit #23) */}
      <div
        style={{
          background: '#0f172a',
          padding: '10px 12px',
          borderRadius: '6px',
          marginBottom: '12px',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            color: '#94a3b8',
            textTransform: 'uppercase',
            marginBottom: '8px',
            fontWeight: 600,
          }}
        >
          Lifecycle Transaction Dispatch (Commit #23)
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#a7f3d0', fontWeight: 600 }}>Supported Local Actions:</span>
            <span style={{ color: '#e2e8f0' }}>
              {supported.map((a) => (a === 'VERIFY_ELIGIBILITY' ? 'Eligibility Verification (Client ZK Proof)' : a)).join(', ')}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#fca5a5', fontWeight: 600 }}>Unsupported Network Actions:</span>
            <span style={{ color: '#94a3b8' }}>
              {unsupported.map((a) => (a === 'FUND_LOAN' ? 'Funding' : a === 'REPAY_LOAN' ? 'Repayment' : a === 'SETTLE_LOAN' ? 'Settlement' : a)).join(', ')} (Requires Live Midnight Provider)
            </span>
          </div>
          <div style={{ color: '#f87171', fontStyle: 'italic', marginTop: '2px' }}>
            Transaction submission unavailable in prototype mode.
          </div>
        </div>
      </div>

      {/* Honest Prototype Notice */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          color: '#cbd5e1',
          background: 'rgba(234, 179, 8, 0.1)',
          border: '1px solid rgba(234, 179, 8, 0.2)',
          padding: '8px 12px',
          borderRadius: '6px',
        }}
      >
        <div>
          <span style={{ color: '#facc15', fontWeight: 600 }}>Notice: </span>
          Operating with a local prototype provider. Live Midnight Network nodes and Lace Wallet signatures are not active.
        </div>
        {isConnected && onDisconnect && (
          <button
            onClick={onDisconnect}
            style={{
              background: '#334155',
              border: 'none',
              color: '#e2e8f0',
              padding: '4px 10px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              marginLeft: '12px',
              whiteSpace: 'nowrap',
            }}
          >
            Disconnect Provider
          </button>
        )}
        {!isConnected && onConnect && (
          <button
            onClick={onConnect}
            style={{
              background: '#2563eb',
              border: 'none',
              color: '#ffffff',
              padding: '4px 10px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              marginLeft: '12px',
              whiteSpace: 'nowrap',
            }}
          >
            Connect Prototype
          </button>
        )}
      </div>
    </div>
  );
};
