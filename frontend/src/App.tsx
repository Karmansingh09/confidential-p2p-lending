import React, { useState } from 'react';
import { DashboardPage } from './pages/DashboardPage.js';
import { CreateLoanPage } from './pages/CreateLoanPage.js';
import { MOCK_LOANS } from './lib/mock-data.js';
import type { LoanDetailsModel } from './types/index.js';
import './App.css';

export type AppView = 'dashboard' | 'create-loan';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [loans, setLoans] = useState<Record<string, LoanDetailsModel>>(MOCK_LOANS);

  const handleLoanCreated = (newLoan: LoanDetailsModel) => {
    const newId = `loan-${Date.now().toString().slice(-4)}`;
    setLoans((prev) => ({
      ...prev,
      [newId]: newLoan,
    }));
  };

  return (
    <div className="app-root">
      {currentView === 'dashboard' ? (
        <DashboardPage
          onNavigateToCreateLoan={() => setCurrentView('create-loan')}
          loansMap={loans}
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
