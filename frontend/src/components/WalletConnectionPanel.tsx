import React, { useState } from 'react';
import type { WalletProvider } from '../lib/wallet-provider.ts';
import {
  getWalletProvider,
  switchToPrototypeProvider,
  switchToMidnightAdapter,
  getActiveProviderKind,
} from '../lib/account-service.ts';
import type { WalletProviderKind, WalletDetectionStatus } from '../types/wallet-adapter.ts';

export interface WalletConnectionPanelProps {
  onProviderSwitched?: () => void;
}

/**
 * Wallet Connection & Integration Panel.
 *
 * Dedicated infrastructure component for inspecting wallet detection, provider kinds,
 * connection lifecycle states, and capability sets.
 *
 * HONEST DISCLOSURE GUARANTEE:
 * - When in prototype mode, explicitly displays "LOCAL PROTOTYPE WALLET ACTIVE".
 * - Clearly distinguishes between "Wallet Not Detected", "Integration Pending", and "Connected".
 * - Never claims a real Lace connection exists unless genuinely verified.
 */
export const WalletConnectionPanel: React.FC<WalletConnectionPanelProps> = ({
  onProviderSwitched,
}) => {
  const provider = getWalletProvider();
  const providerKind: WalletProviderKind = getActiveProviderKind();
  const isPrototype = provider.isPrototype;
  const detectionStatus: WalletDetectionStatus =
    provider.getDetectionStatus ? provider.getDetectionStatus() : isPrototype ? 'DETECTED' : 'NOT_DETECTED';
  const connectionStatus = provider.getConnectionStatus();
  const account = provider.getAccount();
  const networkContext = provider.getNetworkContext();
  const capabilities = provider.getCapabilities();

  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  const handleSelectPrototype = () => {
    switchToPrototypeProvider();
    setConnectionError(null);
    onProviderSwitched?.();
  };

  const handleSelectMidnightAdapter = () => {
    switchToMidnightAdapter();
    setConnectionError(null);
    onProviderSwitched?.();
  };

  const handleAttemptRealConnection = async () => {
    setIsConnecting(true);
    setConnectionError(null);
    try {
      await provider.connect();
      onProviderSwitched?.();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Wallet connection failed.';
      setConnectionError(errorMsg);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await provider.disconnect();
    setConnectionError(null);
    onProviderSwitched?.();
  };

  const getDetectionBadge = (status: WalletDetectionStatus) => {
    switch (status) {
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

  const detectionBadge = getDetectionBadge(detectionStatus);

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
      data-testid="wallet-connection-panel"
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
          <span style={{ fontSize: '18px' }}>💳</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>
              Wallet Connection & Provider Boundary
            </h3>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              Commit #24 • Real Midnight / Lace Adapter Boundary
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
              background: isPrototype ? '#854d0e' : '#1e3a8a',
              color: isPrototype ? '#fef08a' : '#93c5fd',
            }}
          >
            {isPrototype ? 'SIMULATION ONLY' : 'REAL ADAPTER BOUNDARY'}
          </span>
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 600,
              background: detectionBadge.bg,
              color: detectionBadge.color,
            }}
          >
            {detectionBadge.text}
          </span>
        </div>
      </div>

      {/* Provider Selector Switcher */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
          ACTIVE WALLET PROVIDER ADAPTER:
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={handleSelectPrototype}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              border: providerKind === 'LOCAL_PROTOTYPE' ? '2px solid #38bdf8' : '1px solid #475569',
              background: providerKind === 'LOCAL_PROTOTYPE' ? '#0f172a' : '#1e293b',
              color: providerKind === 'LOCAL_PROTOTYPE' ? '#38bdf8' : '#cbd5e1',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div>⚡ Local Prototype Provider</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400 }}>
              Deterministic in-memory accounts & zero-knowledge circuit testing
            </div>
          </button>

          <button
            type="button"
            onClick={handleSelectMidnightAdapter}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              border: providerKind === 'LACE' ? '2px solid #a855f7' : '1px solid #475569',
              background: providerKind === 'LACE' ? '#0f172a' : '#1e293b',
              color: providerKind === 'LACE' ? '#c084fc' : '#cbd5e1',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div>🌐 Midnight / Lace Wallet Adapter</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400 }}>
              Strict adapter boundary for future Lace extension & Midnight.js
            </div>
          </button>
        </div>
      </div>

      {/* Provider Details Matrix */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '10px',
          background: '#0f172a',
          padding: '12px',
          borderRadius: '6px',
          marginBottom: '12px',
          fontSize: '12px',
        }}
      >
        <div>
          <span style={{ color: '#94a3b8' }}>Adapter Name:</span>{' '}
          <span style={{ fontWeight: 600, color: '#f8fafc' }}>{provider.name}</span>
        </div>
        <div>
          <span style={{ color: '#94a3b8' }}>Provider Kind:</span>{' '}
          <span style={{ fontWeight: 600, color: '#38bdf8' }}>{providerKind}</span>
        </div>
        <div>
          <span style={{ color: '#94a3b8' }}>Network Name:</span>{' '}
          <span style={{ fontWeight: 600, color: '#f8fafc' }}>{networkContext.networkName}</span>
        </div>
        <div>
          <span style={{ color: '#94a3b8' }}>Connection Status:</span>{' '}
          <span
            style={{
              fontWeight: 600,
              color: connectionStatus === 'CONNECTED' ? '#4ade80' : '#f87171',
            }}
          >
            {connectionStatus}
          </span>
        </div>
        <div>
          <span style={{ color: '#94a3b8' }}>Account Public Key:</span>{' '}
          <span style={{ fontWeight: 600, color: '#f8fafc', fontFamily: 'monospace' }}>
            {account ? account.publicKeyHex.slice(0, 10) + '...' : 'None'}
          </span>
        </div>
        <div>
          <span style={{ color: '#94a3b8' }}>Live Network:</span>{' '}
          <span style={{ fontWeight: 600, color: networkContext.isRealNetwork ? '#c084fc' : '#facc15' }}>
            {networkContext.isRealNetwork ? 'Midnight Network Target' : 'Local Sandbox'}
          </span>
        </div>
      </div>

      {/* Capability Summary */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>
          PROVIDER CAPABILITY MATRIX:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {Object.entries(capabilities).map(([key, isSupported]) => (
            <span
              key={key}
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '4px',
                background: isSupported ? '#14532d' : '#334155',
                color: isSupported ? '#86efac' : '#94a3b8',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>{isSupported ? '✓' : '✕'}</span>
              <span>{key}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Action Buttons & Disclosures */}
      {!isPrototype && (
        <div
          style={{
            background: '#3b0764',
            border: '1px solid #7e22ce',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '12px',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#f3e8ff', marginBottom: '4px' }}>
            Real Midnight / Lace Wallet Integration Boundary
          </div>
          <div style={{ fontSize: '12px', color: '#d8b4fe', marginBottom: '10px' }}>
            {detectionStatus === 'NOT_DETECTED'
              ? 'Lace Wallet extension is not detected in this browser. To use real network features, install the Midnight Lace Wallet extension.'
              : 'Real Midnight wallet connector detected. Live on-chain transaction submission is pending official Midnight dApp connector packages.'}
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {connectionStatus !== 'CONNECTED' ? (
              <button
                type="button"
                onClick={handleAttemptRealConnection}
                disabled={isConnecting}
                style={{
                  padding: '6px 14px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  background: '#9333ea',
                  color: '#ffffff',
                  border: 'none',
                  cursor: isConnecting ? 'not-allowed' : 'pointer',
                }}
              >
                {isConnecting ? 'Detecting & Connecting...' : 'Attempt Lace Connection'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDisconnect}
                style={{
                  padding: '6px 14px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Disconnect Wallet
              </button>
            )}
            <span style={{ fontSize: '11px', color: '#c084fc' }}>
              Live wallet signing unavailable • Network submission unavailable
            </span>
          </div>

          {connectionError && (
            <div
              style={{
                marginTop: '8px',
                padding: '8px',
                background: '#450a0a',
                border: '1px solid #991b1b',
                borderRadius: '4px',
                fontSize: '11px',
                color: '#fca5a5',
              }}
            >
              ⚠ <strong>Adapter Error:</strong> {connectionError}
            </div>
          )}
        </div>
      )}

      {isPrototype && (
        <div
          style={{
            fontSize: '11px',
            color: '#cbd5e1',
            background: '#0f172a',
            padding: '8px 12px',
            borderRadius: '4px',
            borderLeft: '3px solid #38bdf8',
          }}
        >
          ℹ <strong>Local Prototype Mode:</strong> Operating with local deterministic simulation accounts. Zero real blockchain transactions or wallet connections are executed.
        </div>
      )}
    </div>
  );
};
