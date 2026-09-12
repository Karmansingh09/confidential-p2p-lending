import React, { useState } from 'react';
import { MOCK_LOANS, DEFAULT_LOAN_ID } from '../lib/mock-data.js';
import { StateBanner } from '../components/StateBanner.js';
import { Header } from '../components/Header.js';
import { LifecycleStepper } from '../components/LifecycleStepper.js';
import { LoanSummaryCard } from '../components/LoanSummaryCard.js';
import { PrivacyIndicator } from '../components/PrivacyIndicator.js';
import { LoanActionPanel } from '../components/LoanActionPanel.js';
import type { LoanDetailsModel } from '../types/index.js';

interface DashboardPageProps {
  onNavigateToCreateLoan?: () => void;
  loansMap?: Record<string, LoanDetailsModel>;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigateToCreateLoan,
  loansMap = MOCK_LOANS,
}) => {
  const [selectedLoanId, setSelectedLoanId] = useState<string>(DEFAULT_LOAN_ID);
  const currentLoan = loansMap[selectedLoanId] ?? loansMap[DEFAULT_LOAN_ID] ?? MOCK_LOANS[DEFAULT_LOAN_ID];

  return (
    <div className="dashboard-container">
      <StateBanner />
      <Header
        currentView="dashboard"
        onNavigate={(view) => {
          if (view === 'create-loan' && onNavigateToCreateLoan) {
            onNavigateToCreateLoan();
          }
        }}
      />

      <main className="dashboard-content">
        <div className="dashboard-top-bar">
          <div>
            <h2>Lending Desk Overview</h2>
            <p className="top-bar-sub">Inspect active micro-loans across protocol lifecycle stages</p>
          </div>
          {onNavigateToCreateLoan && (
            <button
              type="button"
              className="btn-create-loan-cta"
              onClick={onNavigateToCreateLoan}
            >
              + Create Loan Request
            </button>
          )}
        </div>

        <section className="stepper-section">
          <LifecycleStepper loan={currentLoan} />
        </section>

        <section className="main-grid-section">
          <div className="left-column">
            <LoanSummaryCard loan={currentLoan} />
            <LoanActionPanel
              loan={currentLoan}
              activeLoanId={selectedLoanId}
              onSelectLoan={setSelectedLoanId}
            />
          </div>

          <div className="right-column">
            <PrivacyIndicator
              eligibilityThreshold={currentLoan.eligibilityThreshold}
              isEligibilityVerified={currentLoan.isEligibilityVerified}
            />

            <div className="architecture-notes-card">
              <h3>Protocol Invariant Safeguards</h3>
              <ul className="notes-list">
                <li>
                  <strong>Immutable Terms:</strong> Principal, interest rate, duration, and threshold are sealed upon agreement creation.
                </li>
                <li>
                  <strong>Euclidean Math in ZK:</strong> Repayment interest is mathematically validated using scalar field division proofs.
                </li>
                <li>
                  <strong>Lender Binding:</strong> Only the assigned lender or borrower can settle a repaid agreement.
                </li>
                <li>
                  <strong>Honest Asset Escrow:</strong> Real native token movements await Midnight.js token integration.
                </li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer className="dashboard-footer">
        <p>
          Confidential P2P Micro-Lending Desk &bull; Midnight Compact ZK Contracts &bull; Commit #14
        </p>
      </footer>
    </div>
  );
};
