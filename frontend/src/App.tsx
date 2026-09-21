import React, { useState, useEffect } from 'react';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { CreateLoanPage } from './pages/CreateLoanPage.tsx';
import { LandingPage } from './pages/LandingPage.tsx';
import {
  connectMockAccount,
  disconnectMockAccount,
  switchMockRole,
  getWalletProvider,
} from './lib/account-service.ts';
import { subscribeToWalletSession, getWalletSessionService } from './lib/wallet-session-service.ts';
import { createDefaultLoanRegistry } from './lib/application-store.ts';
import { getTransactionRecoveryService } from './lib/transaction-recovery-service.ts';
import type { LoanRegistry } from './lib/loan-registry.ts';
import type { LoanDetailsModel } from './types/index.ts';
import type { AccountContext, AccountRole } from './types/account.ts';
import './App.css';

export type AppView = 'landing' | 'dashboard' | 'create-loan';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view');
      if (viewParam === 'dashboard' || window.location.hash.includes('dashboard')) return 'dashboard';
      if (viewParam === 'create-loan' || window.location.hash.includes('create-loan')) return 'create-loan';
    }
    return 'landing';
  });

  // Centralized Authoritative Loan Registry (Commit #21)
  const [registry, setRegistry] = useState<LoanRegistry>(() =>
    createDefaultLoanRegistry()
  );

  // Global Account State Abstraction - Honest Initial State
  const initialProvider = getWalletProvider();
  const initialRole: AccountRole = initialProvider.isPrototype ? 'BORROWER' : 'NONE';
  const [selectedRole, setSelectedRole] = useState<AccountRole>(initialRole);
  const [accountContext, setAccountContext] = useState<AccountContext>(() =>
    connectMockAccount(initialRole)
  );

  // Reset scroll to top on any view transition
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [currentView]);

  // Startup Transaction Lifecycle Recovery (Commit #30)
  useEffect(() => {
    const recoveryService = getTransactionRecoveryService();
    recoveryService.reconcileAll(registry).then((results) => {
      const lastUpdated = results.filter((r) => r.updatedRegistry).pop();
      if (lastUpdated?.updatedRegistry) {
        setRegistry(lastUpdated.updatedRegistry);
      }
    }).catch(() => {
      // Graceful non-blocking startup reconciliation
    });
  }, []);

  // Synchronize global account context when wallet session transitions
  useEffect(() => {
    const unsubscribe = subscribeToWalletSession((session) => {
      if (session.status === 'DISCONNECTED') {
        setSelectedRole('NONE');
        setAccountContext(disconnectMockAccount());
      } else if (session.status === 'CONNECTED' && session.account) {
        const effectiveRole = selectedRole !== 'NONE' ? selectedRole : (session.account.role ?? 'BORROWER');
        setSelectedRole(effectiveRole);
        if (session.providerKind === 'LOCAL_PROTOTYPE') {
          setAccountContext(connectMockAccount(effectiveRole));
        } else {
          const rawAcc = session.account;
          const addr = rawAcc.address || rawAcc.publicKeyHex || '';
          const shortAddr = addr.length > 14 ? `${addr.slice(0, 8)}...${addr.slice(-4)}` : addr;
          setAccountContext({
            identity: {
              publicKey: rawAcc.publicKey,
              publicKeyHex: rawAcc.publicKeyHex || addr,
              connectionStatus: 'CONNECTED',
              displayName: rawAcc.displayName ?? 'Midnight Lace Wallet Account',
              shortLabel: `Lace (${shortAddr || 'Shielded'})`,
              role: effectiveRole,
              isPrototype: false,
              address: addr,
            },
            selectedRole: effectiveRole,
            availableRoles: ['BORROWER', 'LENDER', 'PARTICIPANT', 'NONE'],
            connectionStatus: 'CONNECTED',
            networkName: session.network.networkName || `Midnight Network (${session.network.networkId || 'preprod'})`,
            isRealNetwork: true,
            isPrototype: false,
          });
        }
      }
    });
    return unsubscribe;
  }, [selectedRole]);

  const handleConnect = (role: AccountRole = 'BORROWER') => {
    setSelectedRole(role);
    const provider = getWalletProvider();
    if (provider.isPrototype) {
      setAccountContext(connectMockAccount(role));
    } else {
      const session = getWalletSessionService().getSession();
      if (session.status === 'CONNECTED' && session.account) {
        const rawAcc = session.account;
        const addr = rawAcc.address || rawAcc.publicKeyHex || '';
        const shortAddr = addr.length > 14 ? `${addr.slice(0, 8)}...${addr.slice(-4)}` : addr;
        setAccountContext({
          identity: {
            publicKey: rawAcc.publicKey,
            publicKeyHex: rawAcc.publicKeyHex || addr,
            connectionStatus: 'CONNECTED',
            displayName: rawAcc.displayName ?? 'Midnight Lace Wallet Account',
            shortLabel: `Lace (${shortAddr || 'Shielded'})`,
            role,
            isPrototype: false,
            address: addr,
          },
          selectedRole: role,
          availableRoles: ['BORROWER', 'LENDER', 'PARTICIPANT', 'NONE'],
          connectionStatus: 'CONNECTED',
          networkName: session.network.networkName || `Midnight Network (${session.network.networkId || 'preprod'})`,
          isRealNetwork: true,
          isPrototype: false,
        });
      } else {
        setAccountContext(connectMockAccount(role));
      }
    }
  };

  const handleDisconnect = () => {
    setSelectedRole('NONE');
    setAccountContext(disconnectMockAccount());
  };

  const handleSwitchRole = (role: AccountRole) => {
    setSelectedRole(role);
    const provider = getWalletProvider();
    if (provider.isPrototype) {
      setAccountContext(switchMockRole(role));
    } else {
      const session = getWalletSessionService().getSession();
      if (session.status === 'CONNECTED' && session.account) {
        const rawAcc = session.account;
        const addr = rawAcc.address || rawAcc.publicKeyHex || '';
        const shortAddr = addr.length > 14 ? `${addr.slice(0, 8)}...${addr.slice(-4)}` : addr;
        setAccountContext({
          identity: {
            publicKey: rawAcc.publicKey,
            publicKeyHex: rawAcc.publicKeyHex || addr,
            connectionStatus: 'CONNECTED',
            displayName: rawAcc.displayName ?? 'Midnight Lace Wallet Account',
            shortLabel: `Lace (${shortAddr || 'Shielded'})`,
            role,
            isPrototype: false,
            address: addr,
          },
          selectedRole: role,
          availableRoles: ['BORROWER', 'LENDER', 'PARTICIPANT', 'NONE'],
          connectionStatus: 'CONNECTED',
          networkName: session.network.networkName || `Midnight Network (${session.network.networkId || 'preprod'})`,
          isRealNetwork: true,
          isPrototype: false,
        });
      } else {
        setAccountContext(switchMockRole(role));
      }
    }
  };

  const handleSelectLoan = (loanId: string) => {
    setRegistry((prev) => prev.selectLoan(loanId));
  };

  const handleLoanCreated = (newLoan: LoanDetailsModel) => {
    const existingCount = registry.getOrderedLoanIds().length;
    const newId = `loan-${String(existingCount + 1).padStart(3, '0')}`;
    setRegistry((prev) => prev.addLoan(newId, newLoan));
    setCurrentView('dashboard');
  };

  const handleLoanFunded = (loanId: string, updatedLoan: LoanDetailsModel) => {
    setRegistry((prev) => prev.replaceLoan(loanId, updatedLoan));
  };

  const handleLoanVerified = (loanId: string, updatedLoan: LoanDetailsModel) => {
    setRegistry((prev) => prev.replaceLoan(loanId, updatedLoan));
  };

  const handleLoanRepaid = (loanId: string, updatedLoan: LoanDetailsModel) => {
    setRegistry((prev) => prev.replaceLoan(loanId, updatedLoan));
  };

  const handleLoanSettled = (loanId: string, updatedLoan: LoanDetailsModel) => {
    setRegistry((prev) => prev.replaceLoan(loanId, updatedLoan));
  };

  return (
    <div className="app-root">
      {currentView === 'landing' ? (
        <LandingPage
          onEnterDesk={() => setCurrentView('dashboard')}
          onLaunchDesk={() => setCurrentView('dashboard')}
        />
      ) : currentView === 'dashboard' ? (
        <DashboardPage
          onNavigateToCreateLoan={() => setCurrentView('create-loan')}
          onNavigateToLanding={() => setCurrentView('landing')}
          loansMap={registry.getLoans()}
          selectedLoanId={registry.getSelectedLoanId()}
          onSelectLoan={handleSelectLoan}
          onLoanFunded={handleLoanFunded}
          onLoanVerified={handleLoanVerified}
          onLoanRepaid={handleLoanRepaid}
          onLoanSettled={handleLoanSettled}
          accountContext={accountContext}
          selectedRole={selectedRole}
          onSwitchRole={handleSwitchRole}
          onDisconnect={handleDisconnect}
          onConnect={handleConnect}
          loanRegistry={registry}
          onRegistryUpdated={(updated) => setRegistry(updated)}
        />
      ) : (
        <CreateLoanPage
          onNavigateToDashboard={() => setCurrentView('dashboard')}
          onLoanCreated={handleLoanCreated}
        />
      )}
    </div>
  );
};

export default App;
