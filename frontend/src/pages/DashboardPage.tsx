import React, { useState } from 'react';
import { MOCK_LOANS, DEFAULT_LOAN_ID } from '../lib/mock-data.js';
import { StateBanner } from '../components/StateBanner.js';
import { Header } from '../components/Header.js';
import { LifecycleStepper } from '../components/LifecycleStepper.js';
import { LoanSummaryCard } from '../components/LoanSummaryCard.js';
import { PrivacyIndicator } from '../components/PrivacyIndicator.js';
import { LoanActionPanel } from '../components/LoanActionPanel.js';

export const DashboardPage: React.FC = () => {
  const [selectedLoanId, setSelectedLoanId] = useState<string>(DEFAULT_LOAN_ID);
  const currentLoan = MOCK_LOANS[selectedLoanId] ?? MOCK_LOANS[DEFAULT_LOAN_ID];

  return (
    <div className="dashboard-container">
      <StateBanner />
      <Header />

      <main className="dashboard-content">
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
          Confidential P2P Micro-Lending Desk &bull; Midnight Compact ZK Contracts &bull; Frontend Prototype Commit #13
        </p>
      </footer>
    </div>
  );
};
