import React, { useState, useEffect } from 'react';
import { DashboardPage } from './pages/DashboardPage.js';
import { CreateLoanPage } from './pages/CreateLoanPage.js';
import {
  connectMockAccount,
  disconnectMockAccount,
  switchMockRole,
} from './lib/account-service.js';
import { subscribeToWalletSession } from './lib/wallet-session-service.ts';
import { createDefaultLoanRegistry } from './lib/application-store.js';
import { getTransactionRecoveryService } from './lib/transaction-recovery-service.ts';
import type { LoanRegistry } from './lib/loan-registry.js';
import type { LoanDetailsModel } from './types/index.js';
import type { AccountContext, AccountRole } from './types/account.js';
import './App.css';

export type AppView = 'dashboard' | 'create-loan';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>('dashboard');

  // Centralized Authoritative Loan Registry (Commit #21)
  const [registry, setRegistry] = useState<LoanRegistry>(() =>
    createDefaultLoanRegistry()
  );

  // Global Account State Abstraction (Commit #20)
  const [selectedRole, setSelectedRole] = useState<AccountRole>('BORROWER');
  const [accountContext, setAccountContext] = useState<AccountContext>(() =>
    connectMockAccount('BORROWER')
  );

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
        setAccountContext(connectMockAccount('NONE'));
      }
    });
    return unsubscribe;
  }, []);

  const handleConnect = (role: AccountRole = 'BORROWER') => {
    setSelectedRole(role);
    setAccountContext(connectMockAccount(role));
  };

  const handleDisconnect = () => {
    setSelectedRole('NONE');
    setAccountContext(disconnectMockAccount());
  };

  const handleSwitchRole = (role: AccountRole) => {
    setSelectedRole(role);
    setAccountContext(switchMockRole(role));
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
      {currentView === 'dashboard' ? (
        <DashboardPage
          onNavigateToCreateLoan={() => setCurrentView('create-loan')}
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
