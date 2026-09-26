import React, { useState } from 'react';
import type { AccountContext, AccountRole } from '../types/account.ts';

export interface AccountSwitcherProps {
  accountContext: AccountContext;
  onSwitchRole: (role: AccountRole) => void;
  onDisconnect?: () => void;
  onConnect?: (role?: AccountRole) => void;
}

/**
 * Account Identity & Persona Section.
 *
 * Full-width institutional identity console.
 *
 * Invariant strings required by Test 105:
 * - 'Local Prototype Account'
 * - 'Simulation Only'
 * - 'No Real Wallet Connected'
 */
export const AccountSwitcher: React.FC<AccountSwitcherProps> = ({
  accountContext,
  onSwitchRole,
  onDisconnect,
  onConnect,
}) => {
  const { identity, selectedRole, connectionStatus } = accountContext;
  const isConnected = connectionStatus === 'CONNECTED';
  const [copied, setCopied] = useState(false);

  const roleDescriptions: Record<AccountRole, string> = {
    BORROWER: 'Generate zero-knowledge eligibility proofs, propose loan terms, and manage repayment obligations.',
    LENDER: 'Inspect verified borrower requests, allocate liquidity, and finalize capital settlements.',
    PARTICIPANT: 'Audit agreement state, evaluate circuit proofs, and verify privacy guarantees as an observer.',
    NONE: 'No active persona selected. Connect an account to interact with the lending protocol.',
  };

  const roleDisplayNames: Record<AccountRole, string> = {
    BORROWER: 'Borrower',
    LENDER: 'Lender',
    PARTICIPANT: 'Observer',
    NONE: 'Disconnected',
  };

  const rolePermissions: Record<AccountRole, Array<{ name: string; status: 'permitted' | 'restricted' | 'active' }>> = {
    BORROWER: [
      { name: 'Propose Loan Terms', status: 'permitted' },
      { name: 'Generate ZK Proofs', status: 'active' },
      { name: 'Obligation Repayment', status: 'permitted' },
      { name: 'Capital Allocation', status: 'restricted' },
    ],
    LENDER: [
      { name: 'Inspect Verified Requests', status: 'active' },
      { name: 'Commit Escrow Capital', status: 'permitted' },
      { name: 'Finalize Settlement', status: 'permitted' },
      { name: 'Propose Loan Terms', status: 'restricted' },
    ],
    PARTICIPANT: [
      { name: 'Inspect Public Ledger', status: 'active' },
      { name: 'Verify Zero-Knowledge Proofs', status: 'permitted' },
      { name: 'Commit Escrow Capital', status: 'restricted' },
      { name: 'Propose Loan Terms', status: 'restricted' },
    ],
    NONE: [
      { name: 'Inspect Public Ledger', status: 'restricted' },
      { name: 'Generate ZK Proofs', status: 'restricted' },
      { name: 'Commit Escrow Capital', status: 'restricted' },
      { name: 'Propose Loan Terms', status: 'restricted' },
    ],
  };

  const handleCopy = () => {
    if (identity?.publicKeyHex) {
      navigator.clipboard?.writeText(identity.publicKeyHex);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isProto = accountContext.isPrototype ?? true;

  return (
    <div className="wallet-identity-console" data-testid="account-identity-section">
      {/* 1. Primary Status Header Card */}
      <div className="identity-status-card">
        <div className="status-primary-block">
          <div className="status-indicator-group">
            <span className={`status-dot-lg ${isConnected ? 'dot-connected' : 'dot-disconnected'}`} />
            <span className="status-text-lg">{isConnected ? 'Connected' : 'Disconnected'}</span>
            <span className="status-role-badge font-mono">{roleDisplayNames[selectedRole]}</span>
          </div>
          <span className="identity-provider-name">
            {isProto
              ? 'Local Prototype Account • Simulation Only'
              : isConnected
              ? 'Midnight Lace Wallet • Connected'
              : 'Midnight Lace Wallet • Disconnected'}
          </span>
        </div>

        <div className="identity-actions">
          {isConnected ? (
            <button
              type="button"
              className="btn-action-disconnect"
              onClick={() => {
                if (onDisconnect) {
                  onDisconnect();
                } else {
                  onSwitchRole('NONE');
                }
              }}
            >
              Disconnect
            </button>
          ) : isProto ? (
            <button
              type="button"
              className="btn-action-connect"
              onClick={() => {
                if (onConnect) {
                  onConnect('BORROWER');
                } else {
                  onSwitchRole('BORROWER');
                }
              }}
            >
              Connect Account
            </button>
          ) : (
            <span className="text-muted font-mono" style={{ fontSize: '12px' }}>
              Awaiting Wallet Connection
            </span>
          )}
        </div>
      </div>

      {/* 2. Public Identity & Network Metadata Strip */}
      <div className="identity-meta-grid">
        <div className="meta-cell">
          <span className="meta-label">PUBLIC IDENTITY</span>
          <div className="meta-value-row">
            <span className="meta-value font-mono" title={identity?.publicKeyHex ?? identity?.address ?? 'Unavailable'}>
              {identity?.address
                ? (identity.address.length > 16 ? `${identity.address.slice(0, 10)}...${identity.address.slice(-8)}` : identity.address)
                : identity?.publicKeyHex
                ? `${identity.publicKeyHex.slice(0, 10)}...${identity.publicKeyHex.slice(-8)}`
                : 'Unavailable'}
            </span>
            {(identity?.publicKeyHex || identity?.address) && (
              <button
                type="button"
                className="btn-copy-address font-mono"
                onClick={handleCopy}
                title="Copy full public key"
              >
                {copied ? 'COPIED' : 'COPY'}
              </button>
            )}
          </div>
        </div>

        <div className="meta-cell">
          <span className="meta-label">NETWORK</span>
          <span className="meta-value">{isProto ? 'Local Prototype' : 'MIDNIGHT PREPROD'}</span>
        </div>

        <div className="meta-cell">
          <span className="meta-label">ENVIRONMENT</span>
          <span className="meta-value">{isProto ? 'Local Sandbox' : 'Midnight Preprod'}</span>
        </div>

        <div className="meta-cell">
          <span className="meta-label">KEYRING</span>
          <span className="meta-value">{isProto ? 'Ephemeral In-Memory' : 'Lace Shielded Keyring'}</span>
        </div>
      </div>

      {/* 3. Persona Selector & Permission Matrix */}
      <div className="persona-selector-card">
        <div className="persona-selector-header">
          <div>
            <span className="card-kicker font-mono">{isProto ? 'ACCOUNT PERSONA' : 'DESK PERSPECTIVE'}</span>
            <h3 className="card-title">{isProto ? 'Active Persona & Permissions' : 'Active Desk Persona (Evaluation Lens)'}</h3>
          </div>
          <div className="persona-segmented-control" role="group" aria-label="Account personas">
            <button
              type="button"
              className={`persona-tab ${selectedRole === 'BORROWER' ? 'is-active' : ''}`}
              onClick={() => onSwitchRole('BORROWER')}
            >
              Borrower
            </button>
            <button
              type="button"
              className={`persona-tab ${selectedRole === 'LENDER' ? 'is-active' : ''}`}
              onClick={() => onSwitchRole('LENDER')}
            >
              Lender
            </button>
            <button
              type="button"
              className={`persona-tab ${selectedRole === 'PARTICIPANT' ? 'is-active' : ''}`}
              onClick={() => onSwitchRole('PARTICIPANT')}
            >
              Observer
            </button>
          </div>
        </div>

        <div className="persona-detail-body">
          <div className="persona-role-banner">
            <div className="role-heading">
              <span className="role-title">{roleDisplayNames[selectedRole]}</span>
              <span className="role-badge font-mono">{isProto ? 'SIMULATION PERSONA' : 'DESK EVALUATION LENS'}</span>
            </div>
            <p className="role-desc">
              {roleDescriptions[selectedRole]}
              {!isProto && ' (Evaluation perspective only; does not alter underlying Lace wallet keys.)'}
            </p>
          </div>

          <div className="persona-permissions-grid">
            {rolePermissions[selectedRole]?.map((perm) => (
              <div key={perm.name} className="permission-item">
                <span className={`permission-indicator perm-${perm.status}`} />
                <span className="permission-name">{perm.name}</span>
                <span className={`permission-tag font-mono perm-tag-${perm.status}`}>
                  {perm.status.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Required Test 105 Simulation Warning Strip & Authentic Real Wallet Banner */}
        {isProto ? (
          <div className="identity-warning-strip font-mono">
            <span className="warning-kicker">LOCAL PROTOTYPE</span>
            <span className="warning-sep">//</span>
            <span className="warning-text">
              No Real Wallet Connected &mdash; Account identities are simulated deterministically for interface validation.
            </span>
          </div>
        ) : (
          <div className="identity-warning-strip font-mono" style={{ borderColor: 'rgba(159, 184, 216, 0.3)', background: 'rgba(15, 23, 42, 0.7)' }}>
            <span className="warning-kicker text-accent">AUTHENTICATED WALLET</span>
            <span className="warning-sep">//</span>
            <span className="warning-text">
              Midnight Lace Wallet Connected &mdash; Operating on {accountContext.networkName || 'Midnight Network'} with client-side Zero-Knowledge proof privacy.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountSwitcher;
