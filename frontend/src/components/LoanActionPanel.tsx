import React from 'react';
import { LoanStatus, type LoanDetailsModel } from '../types/index.js';
import { getLifecyclePhase } from '../lib/formatters.js';

interface LoanActionPanelProps {
  loan: LoanDetailsModel;
  activeLoanId: string;
  onSelectLoan: (loanId: string) => void;
}

export const LoanActionPanel: React.FC<LoanActionPanelProps> = ({
  loan,
  activeLoanId,
  onSelectLoan,
}) => {
  const currentPhase = getLifecyclePhase(loan);

  const getActionButtonContent = () => {
    switch (currentPhase) {
      case 'REQUESTED':
        return {
          title: 'Generate Confidential Eligibility Proof',
          role: 'Borrower Action',
          description:
            'Executes local zero-knowledge prover to disclose that financial witness ≥ threshold without revealing secret values.',
          buttonText: 'Execute ZK Proof (Off-Chain)',
          isNextAction: true,
        };
      case 'ELIGIBILITY_VERIFIED':
        return {
          title: 'Provide Loan Funding',
          role: 'Lender Action',
          description:
            'Lender commits capital to the verified loan request and transitions agreement status to funded.',
          buttonText: 'Fund Loan Agreement',
          isNextAction: true,
        };
      case 'FUNDED':
        return {
          title: 'Repay Principal & Interest Obligation',
          role: 'Borrower Action',
          description:
            'Borrower satisfies total debt obligation. Contract validates Euclidean division interest calculation in ZK.',
          buttonText: 'Repay Loan Obligation',
          isNextAction: true,
        };
      case 'REPAID':
        return {
          title: 'Settle Loan Agreement',
          role: 'Borrower or Lender Action',
          description:
            'Finalizes the loan agreement into terminal closed state. Cannot be re-opened or modified.',
          buttonText: 'Settle Loan (Close Out)',
          isNextAction: true,
        };
      case 'SETTLED':
        return {
          title: 'Agreement Concluded',
          role: 'Protocol Terminal State',
          description:
            'This loan has completed its full lifecycle. All obligations were mathematically proven and finalized.',
          buttonText: 'Loan Fully Settled',
          isNextAction: false,
        };
    }
  };

  const action = getActionButtonContent();

  return (
    <div className="action-panel-card">
      <div className="panel-header">
        <div>
          <h3>Protocol Action Dispatcher</h3>
          <span className="panel-subtitle">Lifecycle Transition Controls</span>
        </div>
        <div className="scenario-selector">
          <label htmlFor="scenario-select">Inspect Scenario:</label>
          <select
            id="scenario-select"
            value={activeLoanId}
            onChange={(e) => onSelectLoan(e.target.value)}
          >
            <option value="loan-001">Stage 1: Requested (Unverified)</option>
            <option value="loan-002">Stage 2: ZK Eligibility Verified</option>
            <option value="loan-003">Stage 3: Funded (Awaiting Repayment)</option>
            <option value="loan-004">Stage 4: Repaid (Awaiting Settlement)</option>
            <option value="loan-005">Stage 5: Settled (Terminal State)</option>
          </select>
        </div>
      </div>

      <div className="action-body">
        <div className="action-info">
          <div className="action-role-badge">{action.role}</div>
          <h4>{action.title}</h4>
          <p>{action.description}</p>
        </div>

        <div className="action-button-wrapper">
          <button
            type="button"
            className={`action-btn ${action.isNextAction ? 'primary-action' : 'concluded-action'}`}
            disabled={!action.isNextAction}
            onClick={() => {
              alert(
                'Prototype Notice: The frontend is currently operating in Local Mock Mode (Commit #13). Live transaction submission and wallet connection via Midnight.js will be integrated in upcoming milestones.'
              );
            }}
          >
            {action.buttonText}
          </button>
        </div>
      </div>

      <div className="action-integration-notice">
        <span className="notice-dot"></span>
        <span className="notice-text">
          <strong>Architecture Bridge:</strong> This action panel connects to{' '}
          <code>LoanDesk.can*</code> guards and lifecycle methods from Commit #12. Full Lace Wallet signing and proof server sidecars will be attached in subsequent milestones.
        </span>
      </div>
    </div>
  );
};
