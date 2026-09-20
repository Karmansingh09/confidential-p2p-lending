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
    <div className="overview-page create-loan-page">
      {/* 1. Header */}
      <section className="overview-intro">
        <div className="overview-intro-left">
          <div className="overview-kicker font-mono">
            <span>MIDNIGHT NETWORK</span>
            <span className="kicker-sep">//</span>
            <span>ZERO-KNOWLEDGE PROPOSAL</span>
          </div>
          <h1 className="overview-headline">Propose Loan</h1>
          <p className="overview-lead">
            Initialize a peer-to-peer loan agreement. Underwriting qualifications are verified client-side using zero-knowledge proofs without exposing confidential records.
          </p>
        </div>

        <div className="overview-intro-right">
          <div className="overview-protocol-meta font-mono">
            <div className="meta-item">
              <span className="meta-label">01 PARAMETERS</span>
              <span className="meta-val text-accent">TERMS SPECIFIED</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">02 ELIGIBILITY</span>
              <span className="meta-val">CLIENT-SIDE ZK</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">03 REVIEW</span>
              <span className="meta-val">DETERMINISTIC</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">04 SUBMISSION</span>
              <span className="meta-val text-accent">ON-CHAIN ATOMIC</span>
            </div>
          </div>
          <div className="intro-actions-row">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={onNavigateToDashboard}
            >
              &larr; Back to Desk
            </button>
          </div>
        </div>
      </section>

      {/* 2. Workflow Progression Strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '24px',
        padding: '16px 0',
        marginBottom: '36px',
        borderTop: '1px solid rgba(159, 184, 216, 0.08)',
        borderBottom: '1px solid rgba(159, 184, 216, 0.08)',
      }} className="font-mono">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '10px', color: 'var(--accent-primary)', fontWeight: 600 }}>01 / STAGE</span>
          <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>PARAMETERS</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>02 / STAGE</span>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>ELIGIBILITY</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>03 / STAGE</span>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>REVIEW</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>04 / STAGE</span>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>SUBMIT</span>
        </div>
      </div>

      {createdLoan ? (
        <div style={{
          padding: '36px',
          backgroundColor: 'rgba(13, 17, 26, 0.6)',
          border: '1px solid rgba(78, 135, 112, 0.3)',
          borderRadius: '8px',
          marginBottom: '32px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <span className="badge badge-success font-mono" style={{ fontSize: '12px', padding: '6px 12px' }}>
              ✓ INITIALIZED
            </span>
            <h3 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Loan Agreement Initialized on Ledger
            </h3>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '20px',
            padding: '20px',
            backgroundColor: 'rgba(7, 10, 16, 0.8)',
            border: '1px solid rgba(159, 184, 216, 0.1)',
            borderRadius: '6px',
            marginBottom: '28px',
          }} className="font-mono">
            <div>
              <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>PRINCIPAL</span>
              <strong style={{ fontSize: '18px', color: 'var(--text-primary)' }}>{createdLoan.amount.toLocaleString()}</strong> <span className="text-xs text-muted">units</span>
            </div>
            <div>
              <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>INTEREST RATE</span>
              <strong style={{ fontSize: '18px', color: 'var(--accent-primary)' }}>{(Number(createdLoan.interestRateBasisPoints) / 100).toFixed(2)}%</strong> <span className="text-xs text-muted">({createdLoan.interestRateBasisPoints.toString()} bps)</span>
            </div>
            <div>
              <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>DURATION</span>
              <strong style={{ fontSize: '18px', color: 'var(--text-primary)' }}>{createdLoan.durationBlocks.toString()}</strong> <span className="text-xs text-muted">blocks</span>
            </div>
            <div>
              <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>ZK THRESHOLD</span>
              <strong style={{ fontSize: '18px', color: 'var(--status-success)' }}>&ge; {createdLoan.eligibilityThreshold.toLocaleString()}</strong> <span className="text-xs text-muted">units</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '14px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setCreatedLoan(null)}
            >
              Propose Another Agreement
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onNavigateToDashboard}
            >
              View in Desk Overview &rarr;
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: '48px',
          alignItems: 'start',
        }}>
          <div>
            <LoanRequestForm
              onSubmit={handleSubmit}
              onValuesChange={handleValuesChange}
              isSubmitting={isSubmitting}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{
              padding: '24px',
              backgroundColor: 'rgba(13, 17, 26, 0.4)',
              border: '1px solid rgba(159, 184, 216, 0.1)',
              borderRadius: '8px',
            }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '16px', fontFamily: 'var(--font-mono)' }}>
                Agreement Real-Time Preview
              </h3>
              <LoanPreview
                principalAmount={previewAmount}
                interestRateBasisPoints={previewBps}
                durationBlocks={previewDuration}
                eligibilityThreshold={previewThreshold}
              />
            </div>

            <div style={{
              padding: '24px',
              backgroundColor: 'rgba(13, 17, 26, 0.4)',
              border: '1px solid rgba(159, 184, 216, 0.1)',
              borderRadius: '8px',
            }}>
              <h4 style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent-primary)', marginBottom: '10px', fontFamily: 'var(--font-mono)' }}>
                Zero-Knowledge Privacy Guarantee
              </h4>
              <p style={{ fontSize: '13.5px', lineHeight: 1.65, color: 'var(--text-secondary)', margin: 0 }}>
                Your private witness metric will be verified client-side against the public threshold (<code>&ge; {previewThreshold ? previewThreshold.toLocaleString() : 'threshold'}</code>). Confidential financial metrics are never published to the Midnight Network ledger.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateLoanPage;
