import React, { useState } from 'react';
import { MOCK_LOANS, DEFAULT_LOAN_ID } from '../lib/mock-data.js';
import { StateBanner } from '../components/StateBanner.js';
import { Header } from '../components/Header.js';
import { LifecycleStepper } from '../components/LifecycleStepper.js';
import { LoanSummaryCard } from '../components/LoanSummaryCard.js';
import { PrivacyIndicator } from '../components/PrivacyIndicator.js';
import { LoanActionPanel } from '../components/LoanActionPanel.js';
import { LoanMarketplace } from '../components/LoanMarketplace.js';
import type { LoanDetailsModel } from '../types/index.js';

interface DashboardPageProps {
  onNavigateToCreateLoan?: () => void;
  loansMap?: Record<string, LoanDetailsModel>;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigateToCreateLoan,
  loansMap = MOCK_LOANS,
}) => {
  const availableKeys = Object.keys(loansMap);
  const [selectedLoanId, setSelectedLoanId] = useState<string>(DEFAULT_LOAN_ID);

  const isUnknownLoan = availableKeys.length > 0 && !loansMap[selectedLoanId];
  const effectiveLoanId = loansMap[selectedLoanId]
    ? selectedLoanId
    : availableKeys[0] ?? DEFAULT_LOAN_ID;
  const currentLoan = loansMap[effectiveLoanId];

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

        {/* Warning if an invalid/unknown loan was selected */}
        {isUnknownLoan && (
          <div className="selection-warning-banner" role="alert">
            <span className="warning-icon">⚠️</span>
            <span>
              Requested agreement <code>{selectedLoanId}</code> was not found. Defaulting to active agreement <code>{effectiveLoanId}</code>.
            </span>
          </div>
        )}

        {/* Empty state if entire registry has 0 loans */}
        {availableKeys.length === 0 ? (
          <section className="dashboard-empty-registry">
            <div className="empty-icon">📭</div>
            <h3>No Loan Agreements in Registry</h3>
            <p>The lending desk currently has no recorded loan requests or agreements.</p>
            {onNavigateToCreateLoan && (
              <button
                type="button"
                className="btn-create-loan-cta"
                onClick={onNavigateToCreateLoan}
              >
                + Propose First Loan Request
              </button>
            )}
          </section>
        ) : (
          <>
            <section className="stepper-section">
              <LifecycleStepper loan={currentLoan} />
            </section>

            <section className="main-grid-section">
              <div className="left-column">
                <LoanSummaryCard loan={currentLoan} loanId={effectiveLoanId} />
                <LoanActionPanel
                  loan={currentLoan}
                  activeLoanId={effectiveLoanId}
                  onSelectLoan={setSelectedLoanId}
                  loansMap={loansMap}
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

            {/* Public Loan Marketplace Section */}
            <LoanMarketplace
              loansMap={loansMap}
              selectedLoanId={effectiveLoanId}
              onSelectLoan={setSelectedLoanId}
            />
          </>
        )}
      </main>

      <footer className="dashboard-footer">
        <p>
          Confidential P2P Micro-Lending Desk &bull; Midnight Compact ZK Contracts &bull; Commit #15
        </p>
      </footer>
    </div>
  );
};

