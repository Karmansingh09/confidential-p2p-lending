import React, { useState, useEffect } from 'react';
import type { NavigationTab } from '../types/navigation.ts';
import type { AccountContext, AccountRole } from '../types/account.ts';
import type { LoanRegistry } from '../lib/loan-registry.ts';
import { getWalletProvider } from '../lib/account-service.ts';
import { getNetworkConfigService } from '../lib/network-config-service.ts';
import { CommandPalette } from './common/CommandPalette.tsx';
import { ToastProvider, useToast } from './common/Toast.tsx';

export interface AppShellProps {
  currentTab: NavigationTab;
  onNavigate: (tab: NavigationTab) => void;
  accountContext: AccountContext;
  onSwitchRole?: (role: AccountRole) => void;
  onDisconnect?: () => void;
  onConnect?: (role?: AccountRole) => void;
  loanRegistry?: LoanRegistry;
  onSelectLoan?: (loanId: string) => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = (props) => {
  return (
    <ToastProvider>
      <AppShellInner {...props} />
    </ToastProvider>
  );
};

const AppShellInner: React.FC<AppShellProps> = ({
  currentTab,
  onNavigate,
  accountContext,
  onSwitchRole,
  onDisconnect,
  onConnect,
  loanRegistry,
  onSelectLoan,
  children,
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState<boolean>(false);
  const [personaDropdownOpen, setPersonaDropdownOpen] = useState<boolean>(false);

  const provider = getWalletProvider();
  const netConfig = getNetworkConfigService().getNetworkConfig();
  const totalLoans = loanRegistry ? loanRegistry.getOrderedLoanIds().length : 0;
  const isConnected = accountContext.connectionStatus === 'CONNECTED';
  const role = accountContext.selectedRole || accountContext.identity?.role || 'BORROWER';

  const pkHex = accountContext.identity?.publicKeyHex || '';
  const truncatedPk = pkHex
    ? `${pkHex.slice(0, 6)}...${pkHex.slice(-4)}`
    : 'No Account Key';

  const canvasRef = React.useRef<HTMLElement>(null);

  // Scroll reset to top on tab transition and initial mount
  useEffect(() => {
    window.scrollTo(0, 0);
    if (canvasRef.current) {
      canvasRef.current.scrollTop = 0;
    }
  }, [currentTab]);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (canvasRef.current) {
      canvasRef.current.scrollTop = 0;
    }
  }, []);

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handlePersonaSelect = (newRole: AccountRole) => {
    if (onSwitchRole) {
      onSwitchRole(newRole);
    }
    setPersonaDropdownOpen(false);
  };

  const navProduct: { id: NavigationTab; label: string; badge?: number; icon: JSX.Element }[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: (
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="12" width="7" height="9" rx="1" />
          <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
      ),
    },
    {
      id: 'marketplace',
      label: 'Marketplace',
      badge: totalLoans > 0 ? totalLoans : undefined,
      icon: (
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      ),
    },
    {
      id: 'my-loans',
      label: 'My Loans',
      icon: (
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
    },
    {
      id: 'create-loan',
      label: 'Create Loan',
      icon: (
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      ),
    },
  ];

  const navOperations: { id: NavigationTab; label: string; icon: JSX.Element }[] = [
    {
      id: 'transactions',
      label: 'Transactions',
      icon: (
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      ),
    },
    {
      id: 'wallet',
      label: 'Wallet',
      icon: (
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      ),
    },
    {
      id: 'network',
      label: 'Network',
      icon: (
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      ),
    },
    {
      id: 'contract-privacy',
      label: 'Contract & Privacy',
      icon: (
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2L3 6V11.5C3 16.5 6.8 21.1 12 22C17.2 21.1 21 16.5 21 11.5V6L12 2Z" />
          <path d="M9 12L11 14L15 9.5" />
        </svg>
      ),
    },
  ];

  const getBreadcrumbLabel = (tab: NavigationTab): string => {
    switch (tab) {
      case 'landing': return 'PROTOCOL ARCHITECTURE';
      case 'overview': return 'OVERVIEW';
      case 'marketplace': return 'MARKETPLACE';
      case 'my-loans': return 'MY POSITIONS';
      case 'loan-details': return 'LOAN AGREEMENT';
      case 'create-loan': return 'NEW REQUEST';
      case 'transactions': return 'TRANSACTIONS';
      case 'wallet': return 'WALLET READINESS';
      case 'network': return 'NETWORK';
      case 'contract-privacy': return 'CONTRACT & PRIVACY';
      default: return 'OVERVIEW';
    }
  };

  return (
    <div className={`institutional-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="sidebar-mobile-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`shell-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        {/* Brand Header */}
        <div className="sidebar-brand-header">
          <div
            className="sidebar-brand-link"
            onClick={() => onNavigate('landing')}
            role="button"
            tabIndex={0}
            title="Return to Protocol Overview"
          >
            <div className="sidebar-brand-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L3 6V11.5C3 16.5 6.8 21.1 12 22C17.2 21.1 21 16.5 21 11.5V6L12 2Z" stroke="var(--accent-primary)" />
                <path d="M9 12L11 14L15 9.5" stroke="var(--status-success)" />
              </svg>
            </div>
            {!sidebarCollapsed && (
              <div className="sidebar-brand-text">
                <span className="brand-title">CONFIDENTIAL</span>
                <span className="brand-sub">P2P LENDING DESK</span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="sidebar-scroll-content">
          {/* Section: Desk */}
          <div className="sidebar-nav-group">
            {!sidebarCollapsed && <div className="nav-group-title">DESK</div>}
            <nav className="nav-group-links">
              {navProduct.map((item) => {
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      onNavigate(item.id);
                      setMobileMenuOpen(false);
                    }}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <span className="nav-item-icon">{item.icon}</span>
                    {!sidebarCollapsed && <span className="nav-item-label">{item.label}</span>}
                    {!sidebarCollapsed && item.badge !== undefined && (
                      <span className="nav-item-badge">{item.badge}</span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Section: Operations */}
          <div className="sidebar-nav-group">
            {!sidebarCollapsed && <div className="nav-group-title">OPERATIONS</div>}
            <nav className="nav-group-links">
              {navOperations.map((item) => {
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      onNavigate(item.id);
                      setMobileMenuOpen(false);
                    }}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <span className="nav-item-icon">{item.icon}</span>
                    {!sidebarCollapsed && <span className="nav-item-label">{item.label}</span>}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Section: System */}
          <div className="sidebar-nav-group">
            {!sidebarCollapsed && <div className="nav-group-title">SYSTEM</div>}
            <nav className="nav-group-links">
              <button
                type="button"
                className={`sidebar-nav-item ${currentTab === 'landing' ? 'active' : ''}`}
                onClick={() => {
                  onNavigate('landing');
                  setMobileMenuOpen(false);
                }}
                title={sidebarCollapsed ? 'Protocol Architecture' : undefined}
              >
                <span className="nav-item-icon">
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </span>
                {!sidebarCollapsed && <span className="nav-item-label">Protocol Architecture</span>}
              </button>
            </nav>
          </div>

          {/* Section: Shielded Enclave Telemetry Card */}
          {!sidebarCollapsed && (
            <div className="sidebar-enclave-card font-mono">
              <div className="enclave-card-header">
                <span className="enclave-card-title">SHIELDED ENCLAVE</span>
                <span className="status-dot-sm dot-success" />
              </div>
              <div className="enclave-card-body">
                <div className="enclave-card-row">
                  <span className="enclave-key">NETWORK</span>
                  <span className="enclave-val text-accent">{netConfig.environment || 'LOCAL'}</span>
                </div>
                <div className="enclave-card-row">
                  <span className="enclave-key">CIRCUITS</span>
                  <span className="enclave-val">6 Compact</span>
                </div>
                <div className="enclave-card-row">
                  <span className="enclave-key">PROOFS</span>
                  <span className="enclave-val">Client ZK</span>
                </div>
                <div className="enclave-card-row">
                  <span className="enclave-key">ROLE</span>
                  <span className="enclave-val text-muted">{role}</span>
                </div>
              </div>
              <div className="enclave-card-footer">
                <span className="enclave-badge">ZERO DATA LEAKAGE</span>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          {/* Network pill */}
          <div
            className="sidebar-status-pill"
            onClick={() => onNavigate('network')}
            title="Inspect Network Infrastructure"
          >
            <span className={`status-dot-sm ${netConfig.status === 'CONFIGURED' ? 'dot-success' : 'dot-warning'}`} />
            {!sidebarCollapsed && (
              <span className="sidebar-status-text font-mono">
                Midnight Node
              </span>
            )}
          </div>

          {/* Collapse Toggle */}
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            aria-label={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {sidebarCollapsed ? (
                <polyline points="9 18 15 12 9 6" />
              ) : (
                <polyline points="15 18 9 12 15 6" />
              )}
            </svg>
          </button>
        </div>
      </aside>

      {/* Main Content Area with Topbar */}
      <div className="shell-main-wrapper">
        {/* Topbar */}
        <header className="shell-topbar">
          <div className="topbar-left-zone">
            {/* Mobile hamburger */}
            <button
              type="button"
              className="topbar-mobile-hamburger"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            {/* Breadcrumb */}
            <div className="topbar-breadcrumb">
              <span className="breadcrumb-root">DESK</span>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-active">{getBreadcrumbLabel(currentTab)}</span>
            </div>
          </div>

          {/* Center: Command Palette Trigger Button */}
          <div className="topbar-center-zone">
            <button
              type="button"
              className="topbar-cmd-search-btn"
              onClick={() => setCmdPaletteOpen(true)}
              aria-label="Open Command Palette"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span className="search-placeholder">Search agreements, commands, or routes...</span>
              <span className="kbd-shortcut font-mono">⌘K</span>
            </button>
          </div>

          {/* Right: Persona & Network & New Request */}
          <div className="topbar-right-zone">
            {/* Network indicator pill */}
            <div
              className="topbar-network-badge"
              onClick={() => onNavigate('network')}
              title="Inspect Network State"
            >
              <span className={`net-dot ${netConfig.status === 'CONFIGURED' ? 'net-dot-active' : 'net-dot-warn'}`} />
              <span className="net-label font-mono">{netConfig.environment || 'MOCK'}</span>
            </div>

            {/* Persona Switcher Dropdown */}
            <div className="persona-menu-container">
              <button
                type="button"
                className={`topbar-persona-btn ${isConnected ? 'connected' : 'disconnected'}`}
                onClick={() => setPersonaDropdownOpen(!personaDropdownOpen)}
                aria-haspopup="true"
                aria-expanded={personaDropdownOpen}
              >
                <span className="persona-role-tag">{role}</span>
                <span className="persona-pk-mono font-mono">{truncatedPk}</span>
                <span className="persona-arrow">&#9662;</span>
              </button>

              {personaDropdownOpen && (
                <div className="persona-dropdown-menu">
                  <div className="persona-dropdown-header">
                    <span className="font-mono text-xs text-muted">Active Identity ({provider.name})</span>
                  </div>
                  <button
                    type="button"
                    className={`persona-dropdown-item ${role === 'BORROWER' ? 'active' : ''}`}
                    onClick={() => handlePersonaSelect('BORROWER')}
                  >
                    <div className="persona-item-info">
                      <strong>Borrower Persona</strong>
                      <span>Request & repay confidential micro-loans</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`persona-dropdown-item ${role === 'LENDER' ? 'active' : ''}`}
                    onClick={() => handlePersonaSelect('LENDER')}
                  >
                    <div className="persona-item-info">
                      <strong>Lender Persona</strong>
                      <span>Inspect ZK attestations & allocate capital</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`persona-dropdown-item ${role === 'PARTICIPANT' ? 'active' : ''}`}
                    onClick={() => handlePersonaSelect('PARTICIPANT')}
                  >
                    <div className="persona-item-info">
                      <strong>Observer Persona</strong>
                      <span>Read-only protocol observation</span>
                    </div>
                  </button>

                  <div className="persona-dropdown-divider" />

                  {isConnected ? (
                    <button
                      type="button"
                      className="persona-dropdown-item text-danger"
                      onClick={() => {
                        if (onDisconnect) onDisconnect();
                        setPersonaDropdownOpen(false);
                      }}
                    >
                      Disconnect Identity
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="persona-dropdown-item text-accent"
                      onClick={() => {
                        if (onConnect) onConnect();
                        setPersonaDropdownOpen(false);
                      }}
                    >
                      Connect Identity
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Quick Action: New Request */}
            <button
              type="button"
              className="btn btn-primary btn-sm topbar-cta-btn"
              onClick={() => onNavigate('create-loan')}
            >
              + New Request
            </button>
          </div>
        </header>

        {/* Main Content Area with Page Transition animation */}
        <main ref={canvasRef} className="shell-main-canvas">
          <div className="page-transition-wrap">
            {children}
          </div>
        </main>
      </div>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={cmdPaletteOpen}
        onClose={() => setCmdPaletteOpen(false)}
        onNavigate={onNavigate}
        onSwitchRole={onSwitchRole}
        loanRegistry={loanRegistry}
        onSelectLoan={onSelectLoan}
      />
    </div>
  );
};

export default AppShell;
