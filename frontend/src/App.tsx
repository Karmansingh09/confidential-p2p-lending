import React, { useState } from 'react';
import { DashboardPage } from './pages/DashboardPage.js';
import { CreateLoanPage } from './pages/CreateLoanPage.js';
import { MOCK_LOANS } from './lib/mock-data.js';
import {
  connectMockAccount,
  disconnectMockAccount,
  switchMockRole,
} from './lib/account-service.js';
import type { LoanDetailsModel } from './types/index.js';
import type { AccountContext, AccountRole } from './types/account.js';
import './App.css';

export type AppView = 'dashboard' | 'create-loan';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [loans, setLoans] = useState<Record<string, LoanDetailsModel>>(MOCK_LOANS);

  // Global Account State Abstraction (Commit #20)
  const [selectedRole, setSelectedRole] = useState<AccountRole>('BORROWER');
  const [accountContext, setAccountContext] = useState<AccountContext>(() =>
    connectMockAccount('BORROWER')
  );

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

  const handleLoanCreated = (newLoan: LoanDetailsModel) => {
    const newId = `loan-${Date.now().toString().slice(-4)}`;
    setLoans((prev) => ({
      ...prev,
      [newId]: newLoan,
    }));
  };

  const handleLoanFunded = (loanId: string, updatedLoan: LoanDetailsModel) => {
    setLoans((prev) => ({
      ...prev,
      [loanId]: updatedLoan,
    }));
  };

  const handleLoanVerified = (loanId: string, updatedLoan: LoanDetailsModel) => {
    setLoans((prev) => ({
      ...prev,
      [loanId]: updatedLoan,
    }));
  };

  const handleLoanRepaid = (loanId: string, updatedLoan: LoanDetailsModel) => {
    setLoans((prev) => ({
      ...prev,
      [loanId]: updatedLoan,
    }));
  };

  const handleLoanSettled = (loanId: string, updatedLoan: LoanDetailsModel) => {
    setLoans((prev) => ({
      ...prev,
      [loanId]: updatedLoan,
    }));
  };

  return (
    <div className="app-root">
      {currentView === 'dashboard' ? (
        <DashboardPage
          onNavigateToCreateLoan={() => setCurrentView('create-loan')}
          loansMap={loans}
          onLoanFunded={handleLoanFunded}
          onLoanVerified={handleLoanVerified}
          onLoanRepaid={handleLoanRepaid}
          onLoanSettled={handleLoanSettled}
          accountContext={accountContext}
          selectedRole={selectedRole}
          onSwitchRole={handleSwitchRole}
          onDisconnect={handleDisconnect}
          onConnect={handleConnect}
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
