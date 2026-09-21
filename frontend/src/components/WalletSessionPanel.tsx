import React, { useState, useEffect } from 'react';
import {
  getWalletSessionService,
  subscribeToWalletSession,
} from '../lib/wallet-session-service.ts';
import { getNetworkConfigService } from '../lib/network-config-service.ts';
import { getWalletHandshakeService } from '../lib/wallet-handshake-service.ts';
import { getContractDeploymentService } from '../lib/contract-deployment-service.ts';
import type {
  WalletSession,
  WalletSessionStatus,
} from '../types/wallet-session.ts';
import type {
  WalletDetectionStatus,
  WalletProviderKind,
  LaceConnectionState,
} from '../types/wallet-adapter.ts';
import type { WalletHandshakeState } from '../types/wallet-handshake.ts';

export interface WalletSessionPanelProps {
  onSessionChanged?: (session: WalletSession) => void;
  onProviderSwitched?: () => void;
}

/**
 * Production-ready Wallet Session Management UI Panel.
 *
 * Provides real-time visibility into the active wallet session, detection status,
 * connection state machine, public account identity, and atomic capability sets.
 *
 * HONEST DISCLOSURE INVARIANTS:
 * - Local prototype is explicitly labeled "LOCAL PROTOTYPE (SIMULATION ONLY)".
 * - Real adapter is explicitly labeled "MIDNIGHT/LACE ADAPTER".
 * - Missing extension is labeled "WALLET NOT DETECTED".
 * - Network status is labeled "LIVE NETWORK NOT AVAILABLE".
 * - Never displays fabricated transaction IDs, confirmations, or balances.
 */
export const WalletSessionPanel: React.FC<WalletSessionPanelProps> = ({
  onSessionChanged,
  onProviderSwitched,
}) => {
  const sessionService = getWalletSessionService();
  const handshakeService = getWalletHandshakeService();
  const [session, setSession] = useState<WalletSession>(() =>
    sessionService.getSession()
  );
  const [handshake, setHandshake] = useState<WalletHandshakeState>(() =>
    handshakeService.getHandshakeState()
  );
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Subscribe to session and handshake transitions
  useEffect(() => {
    const unsubscribeSession = subscribeToWalletSession((updatedSession) => {
      setSession(updatedSession);
      setHandshake(handshakeService.getHandshakeState());
      onSessionChanged?.(updatedSession);
    });
    const unsubscribeHandshake = handshakeService.subscribe((updatedHandshake) => {
      setHandshake(updatedHandshake);
    });
    return () => {
      unsubscribeSession();
      unsubscribeHandshake();
    };
  }, [onSessionChanged]);

  const handleConnect = async () => {
    setIsProcessing(true);
    setLocalError(null);
    try {
      const result = await sessionService.connect();
      await handshakeService.refresh();
      if (!result.success && result.error) {
        setLocalError(result.error.message);
      }
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : 'Failed to connect wallet session.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDisconnect = async () => {
    setIsProcessing(true);
    setLocalError(null);
    try {
      await sessionService.disconnect();
      await handshakeService.refresh();
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : 'Failed to disconnect session.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSwitchToPrototype = () => {
    setLocalError(null);
    sessionService.switchToPrototypeProvider();
    handshakeService.refresh();
    onProviderSwitched?.();
  };

  const handleSwitchToMidnightAdapter = () => {
    setLocalError(null);
    sessionService.switchToMidnightAdapter();
    handshakeService.refresh();
    onProviderSwitched?.();
  };

  const isPrototype =
    session.providerKind === 'LOCAL_PROTOTYPE' || session.network.isPrototype;
  const isConnected = session.status === 'CONNECTED';
  const isConnecting = session.status === 'CONNECTING' || isProcessing;

  const getDetectionBadge = (detection: WalletDetectionStatus) => {
    switch (detection) {
      case 'DETECTED':
        return { text: 'CONNECTOR DETECTED', bg: '#14532d', color: '#86efac' };
      case 'NOT_DETECTED':
        return { text: 'WALLET NOT DETECTED', bg: '#7f1d1d', color: '#fca5a5' };
      case 'UNSUPPORTED':
        return { text: 'CONNECTOR UNSUPPORTED', bg: '#854d0e', color: '#fef08a' };
      default:
        return { text: 'UNKNOWN STATUS', bg: '#334155', color: '#94a3b8' };
    }
  };

  const getStatusBadge = (status: WalletSessionStatus) => {
    switch (status) {
      case 'CONNECTED':
        return { text: 'CONNECTED', bg: '#14532d', color: '#86efac' };
      case 'CONNECTING':
        return { text: 'CONNECTING...', bg: '#1e3a8a', color: '#93c5fd' };
      case 'DISCONNECTED':
        return { text: 'DISCONNECTED', bg: '#334155', color: '#94a3b8' };
      case 'UNSUPPORTED':
        return { text: 'UNSUPPORTED', bg: '#854d0e', color: '#fef08a' };
      case 'REJECTED':
        return { text: 'USER REJECTED', bg: '#7f1d1d', color: '#fca5a5' };
      case 'FAILED':
      default:
        return { text: 'FAILED', bg: '#991b1b', color: '#fecaca' };
    }
  };

  const getLaceBadge = (state?: LaceConnectionState) => {
    switch (state) {
      case 'READY':
        return { text: 'READY (CONTRACT CAPABLE)', bg: '#14532d', color: '#86efac' };
      case 'CONNECTED_NOT_TRANSACTION_CAPABLE':
        return { text: 'CONNECTED (NOT TX CAPABLE)', bg: '#854d0e', color: '#fef08a' };
      case 'CONNECTED':
        return { text: 'CONNECTED', bg: '#1e3a8a', color: '#93c5fd' };
      case 'UNSUPPORTED_NETWORK':
        return { text: 'UNSUPPORTED NETWORK', bg: '#7f1d1d', color: '#fca5a5' };
      case 'CONNECTION_REJECTED':
        return { text: 'USER REJECTED', bg: '#7f1d1d', color: '#fca5a5' };
      case 'CONNECTING':
        return { text: 'CONNECTING...', bg: '#1e3a8a', color: '#93c5fd' };
      case 'DISCONNECTED':
        return { text: 'DISCONNECTED', bg: '#334155', color: '#94a3b8' };
      case 'LACE_DETECTED':
        return { text: 'LACE DETECTED', bg: '#1e3a8a', color: '#93c5fd' };
      case 'LACE_NOT_DETECTED':
      default:
        return { text: 'LACE NOT DETECTED', bg: '#334155', color: '#94a3b8' };
    }
  };

  const detectionBadge = getDetectionBadge(session.detectionStatus);
  const statusBadge = getStatusBadge(session.status);
  const laceBadge = getLaceBadge(session.laceConnectionState);

  const accountDisplay = session.account
    ? session.account.address || session.account.publicKeyHex || 'Connected'
    : 'No account connected';

  const shortAccount =
    accountDisplay.length > 20
      ? `${accountDisplay.slice(0, 8)}...${accountDisplay.slice(-6)}`
      : accountDisplay;

  const netConfig = getNetworkConfigService().getNetworkConfig();
  const connectorDiscovery = sessionService.getConnectorDiscovery();
  const readinessState = sessionService.getConnectorReadinessState();
  const isWalletDetected = session.detectionStatus === 'DETECTED' || connectorDiscovery.detected || isPrototype;
  const isConnectorSupported = session.detectionStatus !== 'UNSUPPORTED' && connectorDiscovery.compatible;
  const configStatusText =
    netConfig.status === 'CONFIGURED' ? 'VALID' : netConfig.status === 'INVALID' ? 'INVALID' : 'NOT CONFIGURED';
  const walletStatusText = isConnected ? 'CONNECTED' : isWalletDetected ? 'DETECTED' : 'NOT DETECTED';
  const connectorStatusText = isConnectorSupported ? 'SUPPORTED' : 'UNSUPPORTED';
  const signingStatusText = session.capabilities.SIGN_TRANSACTION ? 'AVAILABLE' : 'UNAVAILABLE';
  const submissionStatusText = session.capabilities.SUBMIT_TRANSACTION ? 'AVAILABLE' : 'UNAVAILABLE';
  const readinessStatusText =
    readinessState === 'TRANSACTION_CAPABLE'
      ? 'READY'
      : isPrototype || readinessState === 'NOT_DETECTED' || readinessState === 'INCOMPATIBLE'
      ? 'UNSUPPORTED'
      : 'BLOCKED';

  const connectionStatusLabel = isConnected
    ? 'Connected'
    : handshake.isDetected
    ? 'Detected — Not Connected'
    : 'Disconnected';

  const networkCompatibilityLabel =
    handshake.networkCompatibility === 'MATCH'
      ? 'Network Match'
      : handshake.networkCompatibility === 'MISMATCH'
      ? 'Network Mismatch'
      : 'Unknown Network';

  const signingLabel = session.capabilities.SIGN_TRANSACTION ? 'Signing Available' : 'Signing Unavailable';
  const submissionLabel = session.capabilities.SUBMIT_TRANSACTION ? 'Submission Available' : 'Submission Unavailable';

  const deploymentService = getContractDeploymentService();
  const deployment = deploymentService.getDeployment();
  const isContractConfigured = deployment.status === 'READY' || deployment.status === 'CONFIGURED';

  const isTxReady =
    isConnected &&
    (isPrototype || handshake.networkCompatibility === 'MATCH') &&
    session.capabilities.SIGN_TRANSACTION &&
    session.capabilities.SUBMIT_TRANSACTION;
  const transactionReadinessLabel = isTxReady ? 'Transaction Ready' : 'Transaction Blocked';

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
      data-testid="wallet-session-panel"
    >
      {/* Header */}
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
          <span style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--accent-primary, #9FB8D8)' }} aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          </span>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>
              Wallet Session &amp; Identity Management
            </h3>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              Commit #28 • Wallet Connection Handshake &amp; Network-Aware Transaction Preparation
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.05em',
              background: isPrototype ? '#854d0e' : '#1e3a8a',
              color: isPrototype ? '#fef08a' : '#93c5fd',
            }}
          >
            {isPrototype ? 'LOCAL PROTOTYPE' : 'MIDNIGHT/LACE ADAPTER'}
          </span>
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 700,
              background: laceBadge.bg,
              color: laceBadge.color,
            }}
            data-testid="session-lace-badge"
          >
            {laceBadge.text}
          </span>
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 700,
              background: detectionBadge.bg,
              color: detectionBadge.color,
            }}
          >
            {detectionBadge.text}
          </span>
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 700,
              background: statusBadge.bg,
              color: statusBadge.color,
            }}
          >
            {statusBadge.text}
          </span>
        </div>
      </div>

      {/* Provider Switcher Selector */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          type="button"
          onClick={handleSwitchToPrototype}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: '6px',
            border: isPrototype ? '2px solid #eab308' : '1px solid #475569',
            background: isPrototype ? '#422006' : '#0f172a',
            color: isPrototype ? '#fef08a' : '#cbd5e1',
            fontWeight: 600,
            fontSize: '12px',
            cursor: 'pointer',
          }}
          data-testid="session-select-prototype-btn"
        >
          LOCAL PROTOTYPE (Simulation)
        </button>
        <button
          type="button"
          onClick={handleSwitchToMidnightAdapter}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: '6px',
            border: !isPrototype ? '2px solid #3b82f6' : '1px solid #475569',
            background: !isPrototype ? '#172554' : '#0f172a',
            color: !isPrototype ? '#93c5fd' : '#cbd5e1',
            fontWeight: 600,
            fontSize: '12px',
            cursor: 'pointer',
          }}
          data-testid="session-select-adapter-btn"
        >
          MIDNIGHT/LACE ADAPTER (Extension)
        </button>
      </div>

      {/* 4-way Operational Diagnostics (Commit #32) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '8px',
          background: '#0f172a',
          padding: '10px 12px',
          borderRadius: '6px',
          marginBottom: '16px',
          border: '1px solid #1e293b',
        }}
        data-testid="session-readiness-indicators"
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Wallet Connected</div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: isConnected ? '#4ade80' : '#f87171',
              marginTop: '2px',
            }}
          >
            {isConnected ? 'YES' : 'NO'}
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Network Matched</div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: isPrototype || handshake.networkCompatibility === 'MATCH' ? '#4ade80' : '#f87171',
              marginTop: '2px',
            }}
          >
            {isPrototype || handshake.networkCompatibility === 'MATCH' ? 'YES' : 'NO'}
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Contract Configured</div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: isContractConfigured ? '#4ade80' : '#f87171',
              marginTop: '2px',
            }}
          >
            {isContractConfigured ? 'YES' : 'NO'}
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Transaction Capable</div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: isTxReady && isContractConfigured ? '#4ade80' : '#f87171',
              marginTop: '2px',
            }}
          >
            {isTxReady && isContractConfigured ? 'YES' : 'NO'}
          </div>
        </div>
      </div>

      {/* Session State Metadata Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div style={{ background: '#0f172a', padding: '10px 12px', borderRadius: '6px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Contract Configured</div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: isContractConfigured ? '#4ade80' : '#f87171',
              marginTop: '4px',
            }}
          >
            {isContractConfigured ? 'YES' : 'NO'}
          </div>
        </div>
        <div style={{ background: '#0f172a', padding: '10px 12px', borderRadius: '6px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Network</div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc', marginTop: '4px' }}>
            {netConfig.environment}
          </div>
        </div>

        <div style={{ background: '#0f172a', padding: '10px 12px', borderRadius: '6px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Configuration</div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: configStatusText === 'VALID' ? '#4ade80' : '#f87171',
              marginTop: '4px',
            }}
          >
            {configStatusText}
          </div>
        </div>

        <div style={{ background: '#0f172a', padding: '10px 12px', borderRadius: '6px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Wallet Connector</div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: handshake.isDetected ? '#4ade80' : '#f87171',
              marginTop: '4px',
            }}
          >
            {handshake.isDetected ? 'Detected' : 'Not Detected'}
          </div>
        </div>

        <div style={{ background: '#0f172a', padding: '10px 12px', borderRadius: '6px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Connection Status</div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: isConnected ? '#4ade80' : handshake.isDetected ? '#93c5fd' : '#f87171',
              marginTop: '4px',
            }}
          >
            {connectionStatusLabel}
          </div>
        </div>

        <div style={{ background: '#0f172a', padding: '10px 12px', borderRadius: '6px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Expected Network</div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc', marginTop: '4px' }}>
            {handshake.expectedNetwork || netConfig.networkName}
          </div>
        </div>

        <div style={{ background: '#0f172a', padding: '10px 12px', borderRadius: '6px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Wallet Network</div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: handshake.walletNetwork ? '#93c5fd' : '#94a3b8',
              marginTop: '4px',
            }}
          >
            {handshake.walletNetwork ?? 'None'}
          </div>
        </div>

        <div style={{ background: '#0f172a', padding: '10px 12px', borderRadius: '6px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Network Compatibility</div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color:
                handshake.networkCompatibility === 'MATCH'
                  ? '#4ade80'
                  : handshake.networkCompatibility === 'MISMATCH'
                  ? '#f87171'
                  : '#eab308',
              marginTop: '4px',
            }}
          >
            {networkCompatibilityLabel}
          </div>
        </div>

        <div style={{ background: '#0f172a', padding: '10px 12px', borderRadius: '6px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Signing Capability</div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: session.capabilities.SIGN_TRANSACTION ? '#4ade80' : '#f87171',
              marginTop: '4px',
            }}
          >
            {signingLabel}
          </div>
        </div>

        <div style={{ background: '#0f172a', padding: '10px 12px', borderRadius: '6px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Submission Capability</div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: session.capabilities.SUBMIT_TRANSACTION ? '#4ade80' : '#f87171',
              marginTop: '4px',
            }}
          >
            {submissionLabel}
          </div>
        </div>

        <div style={{ background: '#0f172a', padding: '10px 12px', borderRadius: '6px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Transaction Readiness</div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: isTxReady ? '#4ade80' : '#eab308',
              marginTop: '4px',
            }}
          >
            {transactionReadinessLabel}
          </div>
        </div>

        <div style={{ background: '#0f172a', padding: '10px 12px', borderRadius: '6px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>CONNECTED PUBLIC IDENTITY</div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: isConnected ? '#4ade80' : '#94a3b8',
              marginTop: '4px',
              fontFamily: 'monospace',
            }}
          >
            {shortAccount}
          </div>
        </div>

        <div style={{ background: '#0f172a', padding: '10px 12px', borderRadius: '6px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>NETWORK / ENVIRONMENT</div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: '#f8fafc',
              marginTop: '4px',
            }}
          >
            {session.network.networkName}
          </div>
        </div>

        <div style={{ background: '#0f172a', padding: '10px 12px', borderRadius: '6px' }} data-testid="session-lace-state-card">
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Lace Connection State</div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: laceBadge.color,
              marginTop: '4px',
            }}
            data-testid="session-lace-connection-state"
          >
            {session.laceConnectionState ?? 'LACE_NOT_DETECTED'}
          </div>
        </div>

        <div style={{ background: '#0f172a', padding: '10px 12px', borderRadius: '6px' }} data-testid="session-network-id-card">
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Reported Network ID</div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: session.network.networkId ? '#93c5fd' : '#94a3b8',
              marginTop: '4px',
            }}
            data-testid="session-reported-network-id"
          >
            {session.network.networkId ?? 'None'}
          </div>
        </div>

        <div style={{ background: '#0f172a', padding: '10px 12px', borderRadius: '6px' }} data-testid="session-network-compatible-card">
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Network Compatible</div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: session.network.networkCompatible ? '#4ade80' : '#f87171',
              marginTop: '4px',
            }}
            data-testid="session-network-compatible"
          >
            {session.network.networkCompatible ? 'YES' : 'NO'}
          </div>
        </div>

        <div style={{ background: '#0f172a', padding: '10px 12px', borderRadius: '6px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>NETWORK SETTLEMENT STATUS</div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: '#f87171',
              marginTop: '4px',
            }}
          >
            LIVE NETWORK NOT AVAILABLE
          </div>
        </div>
      </div>

      {/* Atomic Capabilities Matrix */}
      <div
        style={{
          background: '#0f172a',
          padding: '12px 14px',
          borderRadius: '6px',
          marginBottom: '16px',
        }}
      >
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>
          ATOMIC PROVIDER CAPABILITIES
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {Object.entries(session.capabilities).map(([cap, supported]) => (
            <span
              key={cap}
              style={{
                fontSize: '12px',
                padding: '3px 8px',
                borderRadius: '4px',
                background: supported ? '#14532d' : '#7f1d1d',
                color: supported ? '#bbf7d0' : '#fecaca',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>{supported ? '✓' : '✗'}</span>
              <span>{cap}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Error or Warning Banner */}
      {(localError || session.error) && (
        <div
          style={{
            background: '#450a0a',
            border: '1px solid #b91c1c',
            borderRadius: '6px',
            padding: '10px 14px',
            marginBottom: '14px',
            color: '#fca5a5',
            fontSize: '12px',
          }}
          data-testid="session-error-banner"
        >
          <strong>Session Notice: </strong>
          {localError || session.error?.message}
        </div>
      )}

      {/* Action Controls */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        {!isConnected ? (
          <button
            type="button"
            onClick={handleConnect}
            disabled={isConnecting || (!isPrototype && !handshake.isDetected)}
            style={{
              background: (!isPrototype && !handshake.isDetected) ? '#334155' : '#2563eb',
              color: '#ffffff',
              border: 'none',
              padding: '8px 18px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: (isConnecting || (!isPrototype && !handshake.isDetected)) ? 'not-allowed' : 'pointer',
            }}
            data-testid="session-connect-btn"
          >
            {isConnecting
              ? 'Connecting...'
              : !isPrototype && !handshake.isDetected
              ? 'Wallet Not Detected'
              : !isPrototype
              ? 'Connect Wallet'
              : 'Connect Session'}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={isConnecting}
            style={{
              background: '#475569',
              color: '#f8fafc',
              border: 'none',
              padding: '8px 18px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: isConnecting ? 'not-allowed' : 'pointer',
            }}
            data-testid="session-disconnect-btn"
          >
            Disconnect Session
          </button>
        )}

        <span style={{ fontSize: '12px', color: '#94a3b8' }}>
          {isPrototype
            ? 'Simulation Only: Local Prototype Wallet (No real wallet transaction is being submitted)'
            : !handshake.isDetected
            ? 'Browser wallet connector was not detected. Please install the Lace / Midnight wallet browser extension.'
            : 'Midnight Lace Wallet integration active: extension connector bridge ready.'}
        </span>
      </div>
    </div>
  );
};
