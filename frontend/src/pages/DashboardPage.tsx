import React, { useState, useEffect } from 'react';
import { MOCK_LOANS, DEFAULT_LOAN_ID } from '../lib/mock-data.js';
import { StateBanner } from '../components/StateBanner.js';
import { Header } from '../components/Header.js';
import { LifecycleStepper } from '../components/LifecycleStepper.js';
import { LoanSummaryCard } from '../components/LoanSummaryCard.js';
import { PrivacyIndicator } from '../components/PrivacyIndicator.js';
import { LoanActionPanel } from '../components/LoanActionPanel.js';
import { LoanMarketplace } from '../components/LoanMarketplace.js';
import { LenderEvaluationPanel } from '../components/LenderEvaluationPanel.js';
import { EligibilityVerificationPanel } from '../components/EligibilityVerificationPanel.js';
import { RepaymentPanel } from '../components/RepaymentPanel.js';
import { SettlementPanel } from '../components/SettlementPanel.js';
import { AccountSwitcher } from '../components/AccountSwitcher.js';
import { AccountStatusPanel } from '../components/AccountStatusPanel.js';
import {
  connectMockAccount,
  disconnectMockAccount,
  switchMockRole,
} from '../lib/account-service.js';
import type { LoanDetailsModel } from '../types/index.js';
import { LoanStatus } from '../types/index.js';
import type { AccountContext, AccountRole } from '../types/account.js';

interface DashboardPageProps {
  onNavigateToCreateLoan?: () => void;
  loansMap?: Record<string, LoanDetailsModel>;
  onLoanFunded?: (loanId: string, updatedLoan: LoanDetailsModel) => void;
  onLoanVerified?: (loanId: string, updatedLoan: LoanDetailsModel) => void;
  onLoanRepaid?: (loanId: string, updatedLoan: LoanDetailsModel) => void;
  onLoanSettled?: (loanId: string, updatedLoan: LoanDetailsModel) => void;
  accountContext?: AccountContext;
  selectedRole?: AccountRole;
  onSwitchRole?: (role: AccountRole) => void;
  onDisconnect?: () => void;
  onConnect?: (role?: AccountRole) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigateToCreateLoan,
  loansMap = MOCK_LOANS,
  onLoanFunded,
  onLoanVerified,
  onLoanRepaid,
  onLoanSettled,
  accountContext: propAccountContext,
  onSwitchRole: propSwitchRole,
  onDisconnect: propDisconnect,
  onConnect: propConnect,
}) => {
  const [internalLoans, setInternalLoans] = useState<Record<string, LoanDetailsModel>>(loansMap);
  const [selectedLoanId, setSelectedLoanId] = useState<string>(DEFAULT_LOAN_ID);
  const [isVerifyingEligibility, setIsVerifyingEligibility] = useState<boolean>(false);
  const [isRepayingLoan, setIsRepayingLoan] = useState<boolean>(false);
  const [isSettlingLoan, setIsSettlingLoan] = useState<boolean>(false);

  // Local fallback account context if not provided via props
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

  useEffect(() => {
    setInternalLoans(loansMap);
  }, [loansMap]);

  // Reset interactive panels if selected loan changes
  useEffect(() => {
    setIsVerifyingEligibility(false);
    setIsRepayingLoan(false);
    setIsSettlingLoan(false);
  }, [selectedLoanId]);

  const activeLoans = internalLoans;
  const availableKeys = Object.keys(activeLoans);

  const isUnknownLoan = availableKeys.length > 0 && !activeLoans[selectedLoanId];
  const effectiveLoanId = activeLoans[selectedLoanId]
    ? selectedLoanId
    : availableKeys[0] ?? DEFAULT_LOAN_ID;
  const currentLoan = activeLoans[effectiveLoanId];

  const handleFundingSuccess = (fundedLoanId: string, updatedLoan: LoanDetailsModel) => {
    setInternalLoans((prev) => ({
      ...prev,
      [fundedLoanId]: updatedLoan,
    }));
    if (onLoanFunded) {
      onLoanFunded(fundedLoanId, updatedLoan);
    }
  };

  const handleVerificationSuccess = (verifiedLoanId: string, updatedLoan: LoanDetailsModel) => {
    setInternalLoans((prev) => ({
      ...prev,
      [verifiedLoanId]: updatedLoan,
    }));
    if (onLoanVerified) {
      onLoanVerified(verifiedLoanId, updatedLoan);
    }
  };

  const handleRepaymentSuccess = (repaidLoanId: string, updatedLoan: LoanDetailsModel) => {
    setInternalLoans((prev) => ({
      ...prev,
      [repaidLoanId]: updatedLoan,
    }));
    if (onLoanRepaid) {
      onLoanRepaid(repaidLoanId, updatedLoan);
    }
  };

  const handleSettlementSuccess = (settledLoanId: string, updatedLoan: LoanDetailsModel) => {
    setInternalLoans((prev) => ({
      ...prev,
      [settledLoanId]: updatedLoan,
    }));
    setIsSettlingLoan(false);
    if (onLoanSettled) {
      onLoanSettled(settledLoanId, updatedLoan);
    }
  };

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

        {/* Prototype Account Switcher (Commit #20) */}
        <section className="account-switcher-section">
          <AccountSwitcher
            accountContext={effectiveAccountContext}
            onSwitchRole={handleSwitchRole}
            onDisconnect={handleDisconnect}
            onConnect={handleConnect}
          />
        </section>

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
                {/* Active Account Status & Permissions Panel (Commit #20) */}
                <AccountStatusPanel
                  loan={currentLoan}
                  loanId={effectiveLoanId}
                  accountContext={effectiveAccountContext}
                  onSwitchRole={handleSwitchRole}
                />

                <LoanSummaryCard loan={currentLoan} loanId={effectiveLoanId} />

                {/* Borrower Confidential Verification CTA for unverified requests */}
                {currentLoan.status === LoanStatus.requested && !currentLoan.isEligibilityVerified && !isVerifyingEligibility && (
                  <div className="borrower-verification-cta-card">
                    <div className="cta-header">
                      <span className="cta-icon">🛡️</span>
                      <div className="cta-text">
                        <h4>Borrower Verification Required</h4>
                        <p>
                          This loan request requires off-chain zero-knowledge qualification before lenders can evaluate and fund it.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-start-verification"
                      onClick={() => setIsVerifyingEligibility(true)}
                    >
                      Generate Confidential Eligibility Proof
                    </button>
                  </div>
                )}

                {/* Active Borrower Verification Panel */}
                {isVerifyingEligibility && currentLoan.status === LoanStatus.requested && (
                  <EligibilityVerificationPanel
                    loan={currentLoan}
                    loanId={effectiveLoanId}
                    onLoanVerified={handleVerificationSuccess}
                    onClose={() => setIsVerifyingEligibility(false)}
                  />
                )}

                {/* Verified Confirmation Banner for verified requests */}
                {currentLoan.status === LoanStatus.requested && currentLoan.isEligibilityVerified && (
                  <div className="verified-attestation-banner">
                    <span className="banner-icon">✓</span>
                    <div className="banner-content">
                      <strong>Eligibility Verified</strong>
                      <p>
                        Borrower qualification has been proven in Zero-Knowledge. This loan is open for lender evaluation and capital commitment.
                      </p>
                    </div>
                  </div>
                )}

                {/* Borrower Repayment CTA for funded loans */}
                {currentLoan.status === LoanStatus.funded && !isRepayingLoan && (
                  <div className="borrower-repayment-cta-card">
                    <div className="cta-header">
                      <span className="cta-icon">💳</span>
                      <div className="cta-text">
                        <h4>Active Loan Awaiting Repayment</h4>
                        <p>
                          This loan has been funded by a lender. You may review and execute your principal + simple interest repayment obligation.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-start-repayment"
                      onClick={() => setIsRepayingLoan(true)}
                    >
                      Repay Principal &amp; Interest Obligation
                    </button>
                  </div>
                )}

                {/* Active Borrower Repayment Panel */}
                {isRepayingLoan && currentLoan.status === LoanStatus.funded && (
                  <RepaymentPanel
                    loan={currentLoan}
                    loanId={effectiveLoanId}
                    onLoanRepaid={handleRepaymentSuccess}
                    onClose={() => setIsRepayingLoan(false)}
                  />
                )}

                {/* Repaid Confirmation Banner */}
                {currentLoan.status === LoanStatus.repaid && (
                  <div className="repaid-attestation-banner">
                    <span className="banner-icon">✓</span>
                    <div className="banner-content">
                      <strong>Loan Repaid Successfully</strong>
                      <p>
                        Principal and interest obligation have been cleared. This agreement is awaiting terminal settlement closure.
                      </p>
                    </div>
                  </div>
                )}

                {/* Borrower/Lender Settlement CTA for repaid loans */}
                {currentLoan.status === LoanStatus.repaid && !isSettlingLoan && (
                  <div className="borrower-settlement-cta-card">
                    <div className="cta-header">
                      <span className="cta-icon">🏁</span>
                      <div className="cta-text">
                        <h4>Repaid Agreement Awaiting Settlement</h4>
                        <p>
                          The loan obligation has been cleared. The borrower or designated lender may now settle and conclude this agreement.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-start-settlement"
                      onClick={() => setIsSettlingLoan(true)}
                    >
                      Settle Loan Agreement
                    </button>
                  </div>
                )}

                {/* Active Terminal Settlement Panel */}
                {isSettlingLoan && currentLoan.status === LoanStatus.repaid && (
                  <SettlementPanel
                    loan={currentLoan}
                    loanId={effectiveLoanId}
                    onLoanSettled={handleSettlementSuccess}
                    onClose={() => setIsSettlingLoan(false)}
                  />
                )}

                {/* Terminal Settled Confirmation Banner */}
                {currentLoan.status === LoanStatus.settled && (
                  <div className="settled-attestation-banner">
                    <span className="banner-icon">🔒</span>
                    <div className="banner-content">
                      <strong>Agreement Concluded &amp; Settled</strong>
                      <p>
                        This loan agreement has reached its terminal lifecycle state. All obligations have been cleared and the contract is permanently closed.
                      </p>
                    </div>
                  </div>
                )}

                <LoanActionPanel
                  loan={currentLoan}
                  activeLoanId={effectiveLoanId}
                  onSelectLoan={setSelectedLoanId}
                  loansMap={activeLoans}
                  onStartVerification={() => setIsVerifyingEligibility(true)}
                  onStartRepayment={() => setIsRepayingLoan(true)}
                  onStartSettlement={() => setIsSettlingLoan(true)}
                  accountContext={effectiveAccountContext}
                  onConnectAccount={handleConnect}
                />
              </div>

              <div className="right-column">
                <LenderEvaluationPanel
                  loan={currentLoan}
                  loanId={effectiveLoanId}
                  onFundLoan={handleFundingSuccess}
                />

                <PrivacyIndicator
                  eligibilityThreshold={currentLoan.eligibilityThreshold}
                  isEligibilityVerified={currentLoan.isEligibilityVerified}
                />

                <div className="architecture-notes-card">
                  <h3>Protocol Invariant Safeguards</h3>
                  <ul className="notes-list">
                    <li>
                      <strong>Account Abstraction:</strong> Strongly typed participant personas (Borrower, Lender, Third-Party) without coupling to live wallets.
                    </li>
                    <li>
                      <strong>Immutable Terms:</strong> Principal, interest rate, duration, and threshold are sealed upon agreement creation.
                    </li>
                    <li>
                      <strong>Euclidean Math in ZK:</strong> Repayment interest is mathematically validated using scalar field division proofs.
                    </li>
                    <li>
                      <strong>Contract Authority:</strong> Actions are guarded by canonical Compact circuits (`canVerifyEligibility`, `canFundLoan`, `canRepayLoan`, `canSettleLoan`).
                    </li>
                    <li>
                      <strong>Honest Simulation:</strong> Local prototype mode explicitly declares offline simulation with zero real network claims.
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Public Loan Marketplace Section */}
            <LoanMarketplace
              loansMap={activeLoans}
              selectedLoanId={effectiveLoanId}
              onSelectLoan={setSelectedLoanId}
            />
          </>
        )}
      </main>

      <footer className="dashboard-footer">
        <p>
          Confidential P2P Micro-Lending Desk &bull; Midnight Compact ZK Contracts &bull; Commit #20
        </p>
      </footer>
    </div>
  );
};
