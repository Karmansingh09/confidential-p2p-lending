import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { MOCK_LOANS, DEFAULT_LOAN_ID } from '../lib/mock-data.js';
import { StateBanner } from '../components/StateBanner.js';
import { Header } from '../components/Header.js';
import { LifecycleStepper } from '../components/LifecycleStepper.js';
import { LoanSummaryCard } from '../components/LoanSummaryCard.js';
import { PrivacyIndicator } from '../components/PrivacyIndicator.js';
import { LoanActionPanel } from '../components/LoanActionPanel.js';
export const DashboardPage = () => {
    const [selectedLoanId, setSelectedLoanId] = useState(DEFAULT_LOAN_ID);
    const currentLoan = MOCK_LOANS[selectedLoanId] ?? MOCK_LOANS[DEFAULT_LOAN_ID];
    return (_jsxs("div", { className: "dashboard-container", children: [_jsx(StateBanner, {}), _jsx(Header, {}), _jsxs("main", { className: "dashboard-content", children: [_jsx("section", { className: "stepper-section", children: _jsx(LifecycleStepper, { loan: currentLoan }) }), _jsxs("section", { className: "main-grid-section", children: [_jsxs("div", { className: "left-column", children: [_jsx(LoanSummaryCard, { loan: currentLoan }), _jsx(LoanActionPanel, { loan: currentLoan, activeLoanId: selectedLoanId, onSelectLoan: setSelectedLoanId })] }), _jsxs("div", { className: "right-column", children: [_jsx(PrivacyIndicator, { eligibilityThreshold: currentLoan.eligibilityThreshold, isEligibilityVerified: currentLoan.isEligibilityVerified }), _jsxs("div", { className: "architecture-notes-card", children: [_jsx("h3", { children: "Protocol Invariant Safeguards" }), _jsxs("ul", { className: "notes-list", children: [_jsxs("li", { children: [_jsx("strong", { children: "Immutable Terms:" }), " Principal, interest rate, duration, and threshold are sealed upon agreement creation."] }), _jsxs("li", { children: [_jsx("strong", { children: "Euclidean Math in ZK:" }), " Repayment interest is mathematically validated using scalar field division proofs."] }), _jsxs("li", { children: [_jsx("strong", { children: "Lender Binding:" }), " Only the assigned lender or borrower can settle a repaid agreement."] }), _jsxs("li", { children: [_jsx("strong", { children: "Honest Asset Escrow:" }), " Real native token movements await Midnight.js token integration."] })] })] })] })] })] }), _jsx("footer", { className: "dashboard-footer", children: _jsx("p", { children: "Confidential P2P Micro-Lending Desk \u2022 Midnight Compact ZK Contracts \u2022 Frontend Prototype Commit #13" }) })] }));
};
