import React, { useState, useEffect } from 'react';
import { MOCK_LOANS, DEFAULT_LOAN_ID } from '../lib/mock-data.ts';
import { createDefaultLoanRegistry } from '../lib/application-store.ts';
import { AppShell } from '../components/AppShell.tsx';
import { OverviewPage } from './OverviewPage.tsx';
import { MarketplacePage } from './MarketplacePage.tsx';
import { MyLoansPage } from './MyLoansPage.tsx';
import { LoanDetailsPage } from './LoanDetailsPage.tsx';
import { TransactionsPage } from './TransactionsPage.tsx';
import { WalletPage } from './WalletPage.tsx';
import { NetworkPage } from './NetworkPage.tsx';
import { ContractPrivacyPage } from './ContractPrivacyPage.tsx';
import { CreateLoanPage } from './CreateLoanPage.tsx';
import { LandingPage } from './LandingPage.tsx';
import type { NavigationTab } from '../types/navigation.ts';
import type { LoanRegistry } from '../lib/loan-registry.ts';
import type { LoanDetailsModel } from '../types/index.ts';
import type { AccountContext, AccountRole } from '../types/account.ts';
import {
  connectMockAccount,
  disconnectMockAccount,
  switchMockRole,
} from '../lib/account-service.ts';

interface DashboardPageProps {
  onNavigateToCreateLoan?: () => void;
  onNavigateToLanding?: () => void;
  loansMap?: Record<string, LoanDetailsModel>;
  selectedLoanId?: string;
  onSelectLoan?: (loanId: string) => void;
  onLoanFunded?: (loanId: string, updatedLoan: LoanDetailsModel) => void;
  onLoanVerified?: (loanId: string, updatedLoan: LoanDetailsModel) => void;
  onLoanRepaid?: (loanId: string, updatedLoan: LoanDetailsModel) => void;
  onLoanSettled?: (loanId: string, updatedLoan: LoanDetailsModel) => void;
  accountContext?: AccountContext;
  selectedRole?: AccountRole;
  onSwitchRole?: (role: AccountRole) => void;
  onDisconnect?: () => void;
  onConnect?: (role?: AccountRole) => void;
  loanRegistry?: LoanRegistry;
  onRegistryUpdated?: (registry: LoanRegistry) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigateToCreateLoan,
  onNavigateToLanding,
  loansMap: propLoansMap,
  selectedLoanId: propSelectedLoanId,
  onSelectLoan: propSelectLoan,
  onLoanFunded,
  onLoanVerified,
  onLoanRepaid,
  onLoanSettled,
  accountContext: propAccountContext,
  onSwitchRole: propSwitchRole,
  onDisconnect: propDisconnect,
  onConnect: propConnect,
  loanRegistry: propLoanRegistry,
  onRegistryUpdated,
}) => {
  // Navigation State
  const [activeTab, setActiveTab] = useState<NavigationTab>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') as NavigationTab;
      if (tabParam) return tabParam;
    }
    return 'overview';
  });

  // Authoritative Loan Registry
  const [localRegistry, setLocalRegistry] = useState<LoanRegistry>(() =>
    propLoanRegistry ?? createDefaultLoanRegistry()
  );

  useEffect(() => {
    if (propLoanRegistry) {
      setLocalRegistry(propLoanRegistry);
    }
  }, [propLoanRegistry]);

  const effectiveRegistry = propLoanRegistry ?? localRegistry;

  // Selected Loan ID
  const [localSelectedLoanId, setLocalSelectedLoanId] = useState<string>(
    propSelectedLoanId ?? effectiveRegistry.getSelectedLoanId() ?? DEFAULT_LOAN_ID
  );

  useEffect(() => {
    if (propSelectedLoanId) {
      setLocalSelectedLoanId(propSelectedLoanId);
    }
  }, [propSelectedLoanId]);

  const effectiveSelectedLoanId = propSelectedLoanId ?? localSelectedLoanId;

  // Account Context
  const [localAccountContext, setLocalAccountContext] = useState<AccountContext>(() =>
    propAccountContext ?? connectMockAccount('BORROWER')
  );

  useEffect(() => {
    if (propAccountContext) {
      setLocalAccountContext(propAccountContext);
    }
  }, [propAccountContext]);

  const effectiveAccountContext = propAccountContext ?? localAccountContext;

  const handleSwitchRole = (role: AccountRole) => {
    if (propSwitchRole) {
      propSwitchRole(role);
    } else {
      setLocalAccountContext(switchMockRole(role));
    }
  };

  const handleDisconnect = () => {
    if (propDisconnect) {
      propDisconnect();
    } else {
      setLocalAccountContext(disconnectMockAccount());
    }
  };

  const handleConnect = (role: AccountRole = 'BORROWER') => {
    if (propConnect) {
      propConnect(role);
    } else {
      setLocalAccountContext(connectMockAccount(role));
    }
  };

  const handleSelectLoan = (loanId: string) => {
    if (propSelectLoan) {
      propSelectLoan(loanId);
    }
    setLocalSelectedLoanId(loanId);
  };

  const handleUpdateRegistry = (updated: LoanRegistry) => {
    setLocalRegistry(updated);
    if (onRegistryUpdated) {
      onRegistryUpdated(updated);
    }
  };

  const handleLoanFunded = (loanId: string, updatedLoan: LoanDetailsModel) => {
    const updated = effectiveRegistry.replaceLoan(loanId, updatedLoan);
    handleUpdateRegistry(updated);
    if (onLoanFunded) onLoanFunded(loanId, updatedLoan);
  };

  const handleLoanVerified = (loanId: string, updatedLoan: LoanDetailsModel) => {
    const updated = effectiveRegistry.replaceLoan(loanId, updatedLoan);
    handleUpdateRegistry(updated);
    if (onLoanVerified) onLoanVerified(loanId, updatedLoan);
  };

  const handleLoanRepaid = (loanId: string, updatedLoan: LoanDetailsModel) => {
    const updated = effectiveRegistry.replaceLoan(loanId, updatedLoan);
    handleUpdateRegistry(updated);
    if (onLoanRepaid) onLoanRepaid(loanId, updatedLoan);
  };

  const handleLoanSettled = (loanId: string, updatedLoan: LoanDetailsModel) => {
    const updated = effectiveRegistry.replaceLoan(loanId, updatedLoan);
    handleUpdateRegistry(updated);
    if (onLoanSettled) onLoanSettled(loanId, updatedLoan);
  };

  const handleLoanCreated = (newLoan: LoanDetailsModel) => {
    const existingCount = effectiveRegistry.getOrderedLoanIds().length;
    const newId = `loan-${String(existingCount + 1).padStart(3, '0')}`;
    const updated = effectiveRegistry.addLoan(newId, newLoan);
    handleUpdateRegistry(updated);
    handleSelectLoan(newId);
    setActiveTab('loan-details');
  };

  const handleNavigate = (tab: NavigationTab) => {
    if (tab === 'create-loan' && onNavigateToCreateLoan) {
      onNavigateToCreateLoan();
    } else if (tab === 'landing' && onNavigateToLanding) {
      onNavigateToLanding();
    } else {
      setActiveTab(tab);
    }
  };

  return (
    <AppShell
      currentTab={activeTab}
      onNavigate={handleNavigate}
      accountContext={effectiveAccountContext}
      onSwitchRole={handleSwitchRole}
      onDisconnect={handleDisconnect}
      onConnect={handleConnect}
      loanRegistry={effectiveRegistry}
      onSelectLoan={handleSelectLoan}
    >
      {activeTab === 'landing' && (
        <LandingPage
          onLaunchDesk={(tab) => handleNavigate(tab || 'overview')}
          onEnterDesk={(tab) => handleNavigate(tab || 'overview')}
        />
      )}

      {activeTab === 'overview' && (
        <OverviewPage
          loanRegistry={effectiveRegistry}
          accountContext={effectiveAccountContext}
          onSelectLoan={handleSelectLoan}
          onNavigate={handleNavigate}
        />
      )}

      {activeTab === 'marketplace' && (
        <MarketplacePage
          loansMap={effectiveRegistry.getLoans()}
          selectedLoanId={effectiveSelectedLoanId}
          onSelectLoan={handleSelectLoan}
          onNavigate={handleNavigate}
        />
      )}

      {activeTab === 'my-loans' && (
        <MyLoansPage
          loanRegistry={effectiveRegistry}
          accountContext={effectiveAccountContext}
          onSelectLoan={handleSelectLoan}
          onNavigate={handleNavigate}
          onStartVerification={(loanId) => {
            handleSelectLoan(loanId);
            setActiveTab('loan-details');
          }}
          onStartRepayment={(loanId) => {
            handleSelectLoan(loanId);
            setActiveTab('loan-details');
          }}
          onStartSettlement={(loanId) => {
            handleSelectLoan(loanId);
            setActiveTab('loan-details');
          }}
        />
      )}

      {activeTab === 'loan-details' && (
        <LoanDetailsPage
          loanRegistry={effectiveRegistry}
          selectedLoanId={effectiveSelectedLoanId}
          accountContext={effectiveAccountContext}
          onSelectLoan={handleSelectLoan}
          onLoanFunded={handleLoanFunded}
          onLoanVerified={handleLoanVerified}
          onLoanRepaid={handleLoanRepaid}
          onLoanSettled={handleLoanSettled}
          onSwitchRole={handleSwitchRole}
          onConnectAccount={handleConnect}
          onNavigate={handleNavigate}
        />
      )}

      {activeTab === 'transactions' && (
        <TransactionsPage
          loanRegistry={effectiveRegistry}
          onRegistryUpdated={handleUpdateRegistry}
          onNavigate={handleNavigate}
        />
      )}

      {activeTab === 'wallet' && (
        <WalletPage
          accountContext={effectiveAccountContext}
          onSwitchRole={handleSwitchRole}
          onDisconnect={handleDisconnect}
          onConnect={handleConnect}
          onNavigate={handleNavigate}
        />
      )}

      {activeTab === 'network' && (
        <NetworkPage
          accountContext={effectiveAccountContext}
          onDisconnect={handleDisconnect}
          onConnect={handleConnect}
          onNavigate={handleNavigate}
        />
      )}

      {activeTab === 'contract-privacy' && (
        <ContractPrivacyPage onNavigate={handleNavigate} />
      )}

      {activeTab === 'create-loan' && (
        <CreateLoanPage
          onNavigateToDashboard={() => setActiveTab('overview')}
          onLoanCreated={handleLoanCreated}
        />
      )}
    </AppShell>
  );
};

export default DashboardPage;
