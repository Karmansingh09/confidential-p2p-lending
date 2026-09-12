import React, { useState } from 'react';
import { StateBanner } from '../components/StateBanner.js';
import { Header } from '../components/Header.js';
import { LoanRequestForm } from '../components/LoanRequestForm.js';
import { LoanPreview } from '../components/LoanPreview.js';
import { createLocalLoanRequest } from '../lib/loan-service.js';
import type { ValidatedLoanRequestData } from '../lib/validation.js';
import type { LoanDetailsModel } from '../types/index.js';

interface CreateLoanPageProps {
  onNavigateToDashboard: () => void;
  onLoanCreated?: (loan: LoanDetailsModel) => void;
}

export const CreateLoanPage: React.FC<CreateLoanPageProps> = ({
  onNavigateToDashboard,
  onLoanCreated,
}) => {
  // Live preview values
  const [previewAmount, setPreviewAmount] = useState<bigint | null>(25000n);
  const [previewBps, setPreviewBps] = useState<bigint | null>(500n);
  const [previewDuration, setPreviewDuration] = useState<bigint | null>(100n);
  const [previewThreshold, setPreviewThreshold] = useState<bigint | null>(30000n);

  // Submission state
  const [createdLoan, setCreatedLoan] = useState<LoanDetailsModel | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleValuesChange = (
    amount: bigint | null,
    bps: bigint | null,
    duration: bigint | null,
    threshold: bigint | null
  ) => {
    setPreviewAmount(amount);
    setPreviewBps(bps);
    setPreviewDuration(duration);
    setPreviewThreshold(threshold);
  };

  const handleSubmit = (data: ValidatedLoanRequestData) => {
    setIsSubmitting(true);

    // Simulate clean local preparation of loan request model
    setTimeout(() => {
      const newLoan = createLocalLoanRequest(data);
      setCreatedLoan(newLoan);
      setIsSubmitting(false);
      if (onLoanCreated) {
        onLoanCreated(newLoan);
      }
    }, 250);
  };

  return (
    <div className="create-loan-page-container">
      <StateBanner />
      <Header />

      <main className="create-loan-content">
        <div className="page-nav-bar">
          <button
            type="button"
            className="back-link-btn"
            onClick={onNavigateToDashboard}
          >
            &larr; Back to Lending Desk Dashboard
          </button>
          <div className="page-breadcrumb">
            <span>Borrower Workspace</span> &rsaquo; <strong>New Loan Request</strong>
          </div>
        </div>

        <div className="create-page-header">
          <h2>Propose a Confidential Micro-Loan</h2>
          <p className="page-intro">
            Define your borrowing terms. Lenders evaluate requests based on zero-knowledge
            eligibility verification without ever inspecting confidential financial metrics
            or undisclosed credentials.
          </p>
        </div>

        {createdLoan ? (
          <div className="creation-success-card" role="region" aria-label="Loan Created Success">
            <div className="success-header">
              <span className="success-badge-icon">✓</span>
              <div>
                <h3>Loan Request Initialized (Local Simulation)</h3>
                <p className="success-subtitle">
                  The agreement state has been prepared in accordance with Midnight Compact protocols.
                </p>
              </div>
            </div>

            <div className="success-details-box">
              <div className="success-detail-row">
                <span>Agreement Status:</span>
                <strong className="status-tag-requested">REQUESTED</strong>
              </div>
              <div className="success-detail-row">
                <span>Eligibility Verification:</span>
                <strong className="eligibility-tag-unverified">NOT VERIFIED (Proof Required)</strong>
              </div>
              <div className="success-detail-row">
                <span>Principal Amount:</span>
                <strong>{createdLoan.amount.toLocaleString()} MICRO-UNITS</strong>
              </div>
              <div className="success-detail-row">
                <span>Agreed Interest:</span>
                <strong>
                  {(Number(createdLoan.interestRateBasisPoints) / 100).toFixed(2)}% ({createdLoan.interestRateBasisPoints.toString()} bps)
                </strong>
              </div>
              <div className="success-detail-row">
                <span>Required Underwriting Threshold:</span>
                <strong>{createdLoan.eligibilityThreshold.toLocaleString()} MICRO-UNITS</strong>
              </div>
            </div>

            <div className="success-disclaimer">
              <span className="disclaimer-dot"></span>
              <span>
                <strong>Prototype Notice:</strong> Created in Local Mock Mode (Commit #14). Real Midnight Network deployment and Lace Wallet signing will be enabled in upcoming milestones.
              </span>
            </div>

            <div className="success-actions-bar">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setCreatedLoan(null)}
              >
                Create Another Request
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={onNavigateToDashboard}
              >
                View in Lending Desk Dashboard &rarr;
              </button>
            </div>
          </div>
        ) : (
          <div className="create-loan-grid">
            <div className="form-column">
              <LoanRequestForm
                onSubmit={handleSubmit}
                onValuesChange={handleValuesChange}
                isSubmitting={isSubmitting}
              />
            </div>

            <div className="preview-column">
              <LoanPreview
                principalAmount={previewAmount}
                interestRateBasisPoints={previewBps}
                durationBlocks={previewDuration}
                eligibilityThreshold={previewThreshold}
              />

              <div className="eligibility-explainer-box">
                <h4>Next Step: Zero-Knowledge Verification</h4>
                <p>
                  After initializing your loan request, you will generate an off-chain zero-knowledge
                  proof using the <code>verifyEligibility()</code> circuit. This proves to lenders that:
                </p>
                <div className="formula-callout">
                  <code>privateValue &ge; {previewThreshold ? previewThreshold.toLocaleString() : 'threshold'}</code>
                </div>
                <p className="explainer-footer">
                  Your actual income and balance remain secret. Lenders only see that eligibility is verified.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="dashboard-footer">
        <p>
          Confidential P2P Micro-Lending Desk &bull; Borrower Loan Request UI &bull; Commit #14
        </p>
      </footer>
    </div>
  );
};
