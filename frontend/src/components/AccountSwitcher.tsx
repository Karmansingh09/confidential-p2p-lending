import React from 'react';
import type { AccountContext, AccountRole } from '../types/account.js';

interface AccountSwitcherProps {
  accountContext: AccountContext;
  onSwitchRole: (role: AccountRole) => void;
  onDisconnect?: () => void;
  onConnect?: (role?: AccountRole) => void;
}

export const AccountSwitcher: React.FC<AccountSwitcherProps> = ({
  accountContext,
  onSwitchRole,
  onDisconnect,
  onConnect,
}) => {
  const { identity, selectedRole, connectionStatus, networkName } = accountContext;
  const isConnected = connectionStatus === 'CONNECTED' && identity !== null;

  return (
    <div className="account-switcher-card" aria-label="Account Switcher">
      <div className="account-switcher-header">
        <div className="switcher-title-group">
          <span className="switcher-icon">👤</span>
          <div>
            <h4 className="switcher-heading">Local Prototype Account</h4>
            <span className="switcher-simulation-tag">Simulation Only &bull; Offline Mode</span>
          </div>
        </div>
        <div className="network-status-badge">
          <span className={`status-indicator-dot ${isConnected ? 'online' : 'offline'}`} />
          <span>{networkName}</span>
        </div>
      </div>

      <div className="account-role-selector" role="group" aria-label="Simulated Account Personas">
        <button
          type="button"
          className={`role-btn ${selectedRole === 'BORROWER' ? 'active-role' : ''}`}
          onClick={() => onSwitchRole('BORROWER')}
        >
          <span className="role-icon">🏷️</span>
          <span>Borrower Account</span>
        </button>

        <button
          type="button"
          className={`role-btn ${selectedRole === 'LENDER' ? 'active-role' : ''}`}
          onClick={() => onSwitchRole('LENDER')}
        >
          <span className="role-icon">💰</span>
          <span>Lender Account</span>
        </button>

        <button
          type="button"
          className={`role-btn ${selectedRole === 'PARTICIPANT' ? 'active-role' : ''}`}
          onClick={() => onSwitchRole('PARTICIPANT')}
        >
          <span className="role-icon">👥</span>
          <span>Third-Party Account</span>
        </button>

        {isConnected ? (
          <button
            type="button"
            className="role-btn btn-disconnect"
            onClick={() => {
              if (onDisconnect) {
                onDisconnect();
              } else {
                onSwitchRole('NONE');
              }
            }}
          >
            <span className="role-icon">🔌</span>
            <span>Disconnect</span>
          </button>
        ) : (
          <button
            type="button"
            className="role-btn btn-connect"
            onClick={() => {
              if (onConnect) {
                onConnect('BORROWER');
              } else {
                onSwitchRole('BORROWER');
              }
            }}
          >
            <span className="role-icon">⚡</span>
            <span>Connect Borrower</span>
          </button>
        )}
      </div>

      <div className="account-meta-grid">
        <div className="meta-item">
          <span className="meta-label">Account Status</span>
          <span className={`meta-value ${isConnected ? 'status-connected' : 'status-disconnected'}`}>
            {connectionStatus}
          </span>
        </div>

        <div className="meta-item">
          <span className="meta-label">Simulated Role</span>
          <span className="meta-value role-label">
            {selectedRole === 'BORROWER' && 'Borrower'}
            {selectedRole === 'LENDER' && 'Lender'}
            {selectedRole === 'PARTICIPANT' && 'Third-Party Observer'}
            {selectedRole === 'NONE' && 'None (Disconnected)'}
          </span>
        </div>

        <div className="meta-item">
          <span className="meta-label">Public Identity</span>
          <span className="meta-value public-key-label" title={identity?.publicKeyHex ?? 'No account'}>
            {identity?.publicKeyHex
              ? `${identity.publicKeyHex.slice(0, 10)}...${identity.publicKeyHex.slice(-8)}`
              : '0x0000... (Disconnected)'}
          </span>
        </div>

        <div className="meta-item">
          <span className="meta-label">Wallet Architecture</span>
          <span className="meta-value simulation-tag">Simulation Only</span>
        </div>
      </div>

      <div className="account-switcher-notice">
        <span className="notice-icon">🛡️</span>
        <p>
          <strong>No Real Wallet Connected:</strong> Operating in local prototype account mode.
          Public account identities are simulated deterministically. No cryptographic signing keys,
          credentials, or real network transactions are utilized.
        </p>
      </div>
    </div>
  );
};
