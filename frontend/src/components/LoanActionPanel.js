import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { getLifecyclePhase } from '../lib/formatters.js';
export const LoanActionPanel = ({ loan, activeLoanId, onSelectLoan, }) => {
    const currentPhase = getLifecyclePhase(loan);
    const getActionButtonContent = () => {
        switch (currentPhase) {
            case 'REQUESTED':
                return {
                    title: 'Generate Confidential Eligibility Proof',
                    role: 'Borrower Action',
                    description: 'Executes local zero-knowledge prover to disclose that financial witness ≥ threshold without revealing secret values.',
                    buttonText: 'Execute ZK Proof (Off-Chain)',
                    isNextAction: true,
                };
            case 'ELIGIBILITY_VERIFIED':
                return {
                    title: 'Provide Loan Funding',
                    role: 'Lender Action',
                    description: 'Lender commits capital to the verified loan request and transitions agreement status to funded.',
                    buttonText: 'Fund Loan Agreement',
                    isNextAction: true,
                };
            case 'FUNDED':
                return {
                    title: 'Repay Principal & Interest Obligation',
                    role: 'Borrower Action',
                    description: 'Borrower satisfies total debt obligation. Contract validates Euclidean division interest calculation in ZK.',
                    buttonText: 'Repay Loan Obligation',
                    isNextAction: true,
                };
            case 'REPAID':
                return {
                    title: 'Settle Loan Agreement',
                    role: 'Borrower or Lender Action',
                    description: 'Finalizes the loan agreement into terminal closed state. Cannot be re-opened or modified.',
                    buttonText: 'Settle Loan (Close Out)',
                    isNextAction: true,
                };
            case 'SETTLED':
                return {
                    title: 'Agreement Concluded',
                    role: 'Protocol Terminal State',
                    description: 'This loan has completed its full lifecycle. All obligations were mathematically proven and finalized.',
                    buttonText: 'Loan Fully Settled',
                    isNextAction: false,
                };
        }
    };
    const action = getActionButtonContent();
    return (_jsxs("div", { className: "action-panel-card", children: [_jsxs("div", { className: "panel-header", children: [_jsxs("div", { children: [_jsx("h3", { children: "Protocol Action Dispatcher" }), _jsx("span", { className: "panel-subtitle", children: "Lifecycle Transition Controls" })] }), _jsxs("div", { className: "scenario-selector", children: [_jsx("label", { htmlFor: "scenario-select", children: "Inspect Scenario:" }), _jsxs("select", { id: "scenario-select", value: activeLoanId, onChange: (e) => onSelectLoan(e.target.value), children: [_jsx("option", { value: "loan-001", children: "Stage 1: Requested (Unverified)" }), _jsx("option", { value: "loan-002", children: "Stage 2: ZK Eligibility Verified" }), _jsx("option", { value: "loan-003", children: "Stage 3: Funded (Awaiting Repayment)" }), _jsx("option", { value: "loan-004", children: "Stage 4: Repaid (Awaiting Settlement)" }), _jsx("option", { value: "loan-005", children: "Stage 5: Settled (Terminal State)" })] })] })] }), _jsxs("div", { className: "action-body", children: [_jsxs("div", { className: "action-info", children: [_jsx("div", { className: "action-role-badge", children: action.role }), _jsx("h4", { children: action.title }), _jsx("p", { children: action.description })] }), _jsx("div", { className: "action-button-wrapper", children: _jsx("button", { type: "button", className: `action-btn ${action.isNextAction ? 'primary-action' : 'concluded-action'}`, disabled: !action.isNextAction, onClick: () => {
                                alert('Prototype Notice: The frontend is currently operating in Local Mock Mode (Commit #13). Live transaction submission and wallet connection via Midnight.js will be integrated in upcoming milestones.');
                            }, children: action.buttonText }) })] }), _jsxs("div", { className: "action-integration-notice", children: [_jsx("span", { className: "notice-dot" }), _jsxs("span", { className: "notice-text", children: [_jsx("strong", { children: "Architecture Bridge:" }), " This action panel connects to", ' ', _jsx("code", { children: "LoanDesk.can*" }), " guards and lifecycle methods from Commit #12. Full Lace Wallet signing and proof server sidecars will be attached in subsequent milestones."] })] })] }));
};
