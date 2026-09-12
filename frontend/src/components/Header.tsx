import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="app-header">
      <div className="header-left">
        <div className="header-logo">
          <span className="logo-icon">&#128274;</span>
          <div className="logo-text">
            <h1>Confidential P2P Lending</h1>
            <p className="subtitle">Zero-Knowledge Micro-Lending Desk on Midnight</p>
          </div>
        </div>
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
