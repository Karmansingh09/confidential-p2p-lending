import React, { useState } from 'react';
import { LoanRequestForm } from '../components/LoanRequestForm.tsx';
import { LoanPreview } from '../components/LoanPreview.tsx';
import { createLocalLoanRequest } from '../lib/loan-service.ts';
import type { ValidatedLoanRequestData } from '../lib/validation.ts';
import type { LoanDetailsModel } from '../types/index.ts';

interface CreateLoanPageProps {
  onNavigateToDashboard: () => void;
  onLoanCreated?: (loan: LoanDetailsModel) => void;
}

export const CreateLoanPage: React.FC<CreateLoanPageProps> = ({
  onNavigateToDashboard,
  onLoanCreated,
}) => {
  const [previewAmount, setPreviewAmount] = useState<bigint | null>(25000n);
  const [previewBps, setPreviewBps] = useState<bigint | null>(500n);
  const [previewDuration, setPreviewDuration] = useState<bigint | null>(100n);
  const [previewThreshold, setPreviewThreshold] = useState<bigint | null>(30000n);

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
    <div className="create-loan-workspace">
      {/* 1. WORKSPACE HEADER & TELEMETRY STATUS (60% / 40%) */}
      <section className="create-loan-hero-section">
        <div className="create-loan-hero-left">
          <button
            type="button"
            className="create-loan-top-back-btn font-mono"
            onClick={onNavigateToDashboard}
            aria-label="Back to Lending Desk"
          >
            <span className="back-arrow">&larr;</span>
            <span>BACK TO LENDING DESK</span>
          </button>
          <div className="create-loan-kicker font-mono">
            <span>MIDNIGHT NETWORK</span>
            <span className="kicker-sep">//</span>
            <span>ZERO-KNOWLEDGE PROPOSAL</span>
          </div>
          <h1 className="create-loan-headline">Propose a Loan</h1>
          <p className="create-loan-lead">
            Create a peer-to-peer loan agreement with privacy-preserving eligibility verification. Define the terms, review the public representation, and submit when ready.
          </p>
        </div>

        <div className="create-loan-hero-right">
          <div className="create-loan-status-enclave font-mono">
            <div className="status-enclave-header">
              <span className="status-enclave-title">PROPOSAL STATE</span>
              <span className="status-enclave-indicator">
                <span className="status-dot-sm dot-warning" />
                <span className="status-text-live text-amber">DRAFT</span>
              </span>
            </div>

            <div className="status-enclave-body">
              <div className="status-enclave-row">
                <span className="status-enclave-key">EXECUTION MODE</span>
                <span className="status-enclave-val">Local Simulation</span>
              </div>
              <div className="status-enclave-row">
                <span className="status-enclave-key">PRIVACY POLICY</span>
                <span className="status-enclave-val text-accent">Private by Default</span>
              </div>
              <div className="status-enclave-row">
                <span className="status-enclave-key">ELIGIBILITY PROOF</span>
                <span className="status-enclave-val">Client ZK Witness</span>
              </div>
            </div>

            <div className="status-enclave-footer">
              <button
                type="button"
                className="btn-back-desk font-mono"
                onClick={onNavigateToDashboard}
              >
                &larr; Back to Lending Desk
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. WORKFLOW STEPPER */}
      <section className="create-loan-stepper-section" aria-label="Proposal Workflow Progression">
        <div className="stepper-track font-mono">
          <div className="stepper-stage active">
            <div className="stage-header">
              <span className="stage-num">01</span>
              <span className="stage-badge">CURRENT STEP</span>
            </div>
            <span className="stage-label">PARAMETERS</span>
            <span className="stage-sub">Loan terms &amp; rate</span>
          </div>

          <div className="stepper-line" aria-hidden="true" />

          <div className="stepper-stage">
            <div className="stage-header">
              <span className="stage-num">02</span>
              <span className="stage-badge badge-pending">PENDING</span>
            </div>
            <span className="stage-label">ELIGIBILITY</span>
            <span className="stage-sub">Client-side ZK proof</span>
          </div>

          <div className="stepper-line" aria-hidden="true" />

          <div className="stepper-stage">
            <div className="stage-header">
              <span className="stage-num">03</span>
              <span className="stage-badge badge-pending">PENDING</span>
            </div>
            <span className="stage-label">REVIEW</span>
            <span className="stage-sub">Public ledger record</span>
          </div>

          <div className="stepper-line" aria-hidden="true" />

          <div className="stepper-stage">
            <div className="stage-header">
              <span className="stage-num">04</span>
              <span className="stage-badge badge-pending">PENDING</span>
            </div>
            <span className="stage-label">SUBMIT</span>
            <span className="stage-sub">Atomic contract commit</span>
          </div>
        </div>
      </section>

      {/* 3. MAIN WORKSPACE / SUCCESS STATE */}
      {createdLoan ? (
        <section className="create-loan-success-panel">
          <div className="success-header">
            <div className="success-badge-wrap font-mono">
              <span className="success-check-icon">✓</span>
              <span>INITIALIZED ON CANONICAL REGISTRY</span>
            </div>
            <h2 className="success-title">Loan Agreement Successfully Initialized</h2>
            <p className="success-sub">
              Your loan request has been recorded into the canonical registry with status <strong>REQUESTED</strong>. Prospective lenders can now inspect the public terms and fund the agreement once zero-knowledge eligibility is attested.
            </p>
          </div>

          <div className="success-metrics-grid font-mono">
            <div className="success-metric-card">
              <span className="metric-card-label">STATUS</span>
              <span className="metric-card-val text-amber">{createdLoan.statusText.toUpperCase()}</span>
              <span className="metric-card-sub">Registry State</span>
            </div>
            <div className="success-metric-card">
              <span className="metric-card-label">PRINCIPAL</span>
              <span className="metric-card-val">{createdLoan.amount.toLocaleString()}</span>
              <span className="metric-card-sub">MICRO-UNITS</span>
            </div>
            <div className="success-metric-card">
              <span className="metric-card-label">INTEREST RATE</span>
              <span className="metric-card-val text-amber">
                {(Number(createdLoan.interestRateBasisPoints) / 100).toFixed(2)}%
              </span>
              <span className="metric-card-sub">{createdLoan.interestRateBasisPoints.toString()} bps</span>
            </div>
            <div className="success-metric-card">
              <span className="metric-card-label">DURATION</span>
              <span className="metric-card-val">{createdLoan.durationBlocks.toString()}</span>
              <span className="metric-card-sub">Ledger Blocks</span>
            </div>
            <div className="success-metric-card">
              <span className="metric-card-label">ZK THRESHOLD</span>
              <span className="metric-card-val text-success">
                &ge; {createdLoan.eligibilityThreshold.toLocaleString()}
              </span>
              <span className="metric-card-sub">Private Min Benchmark</span>
            </div>
          </div>

          <div className="success-actions-row font-mono">
            <button
              type="button"
              className="btn-success-outline"
              onClick={() => setCreatedLoan(null)}
            >
              + Propose Another Agreement
            </button>
            <button
              type="button"
              className="btn-success-primary"
              onClick={onNavigateToDashboard}
            >
              View in Desk Overview &rarr;
            </button>
          </div>
        </section>
      ) : (
        <section className="create-loan-main-grid">
          {/* Left Column: Loan Agreement Parameters Form (54%) */}
          <div className="create-loan-form-column">
            <LoanRequestForm
              onSubmit={handleSubmit}
              onValuesChange={handleValuesChange}
              onBack={onNavigateToDashboard}
              isSubmitting={isSubmitting}
            />
          </div>

          {/* Right Column: Live Agreement Preview & Privacy Flow (46%) */}
          <div className="create-loan-preview-column">
            <LoanPreview
              principalAmount={previewAmount}
              interestRateBasisPoints={previewBps}
              durationBlocks={previewDuration}
              eligibilityThreshold={previewThreshold}
            />
          </div>
        </section>
      )}
    </div>
  );
};

export default CreateLoanPage;
