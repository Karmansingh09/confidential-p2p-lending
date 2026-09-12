import React from 'react';

interface HeaderProps {
  currentView?: 'dashboard' | 'create-loan';
  onNavigate?: (view: 'dashboard' | 'create-loan') => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView, onNavigate }) => {
  return (
    <header className="app-header">
      <div className="header-left">
        <div
          className="header-logo"
          onClick={() => onNavigate && onNavigate('dashboard')}
          style={{ cursor: onNavigate ? 'pointer' : 'default' }}
        >
          <span className="logo-icon">&#128274;</span>
          <div className="logo-text">
            <h1>Confidential P2P Lending</h1>
            <p className="subtitle">Zero-Knowledge Micro-Lending Desk on Midnight</p>
          </div>
        </div>

        {onNavigate && (
          <nav className="header-nav" aria-label="Main Navigation">
            <button
              type="button"
              className={`nav-btn ${currentView === 'dashboard' ? 'active' : ''}`}
              onClick={() => onNavigate('dashboard')}
            >
              Dashboard
            </button>
            <button
              type="button"
              className={`nav-btn ${currentView === 'create-loan' ? 'active' : ''}`}
              onClick={() => onNavigate('create-loan')}
            >
              + Create Loan Request
            </button>
          </nav>
        )}
      </div>

      <div className="header-right">
        <div className="network-pill disconnected">
          <span className="network-dot"></span>
          <span>Midnight Network (Offline/Mock)</span>
        </div>
      </div>
    </header>
  );
};
