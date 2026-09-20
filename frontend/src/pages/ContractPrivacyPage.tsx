import React from 'react';
import type { NavigationTab } from '../types/navigation.ts';

export interface ContractPrivacyPageProps {
  onNavigate: (tab: NavigationTab) => void;
}

export const ContractPrivacyPage: React.FC<ContractPrivacyPageProps> = ({ onNavigate }) => {
  const circuits = [
    {
      name: 'verifyEligibility',
      classification: 'LOCAL_PROOF',
      mode: 'Read / Off-Chain',
      walletRequired: true,
      proofRequired: true,
      signatureRequired: false,
      submissionRequired: false,
      description: 'Generates client-side zero-knowledge proof that qualificationMetric >= threshold without disclosing private financial witness.',
    },
    {
      name: 'fundLoan',
      classification: 'TRANSACTION_EXECUTION',
      mode: 'Write / On-Chain',
      walletRequired: true,
      proofRequired: false,
      signatureRequired: true,
      submissionRequired: true,
      description: 'Binds lender commitment to verified loan, transitions status to FUNDED, and locks loan parameters on-chain.',
    },
    {
      name: 'repayLoan',
      classification: 'TRANSACTION_EXECUTION',
      mode: 'Write / On-Chain',
      walletRequired: true,
      proofRequired: false,
      signatureRequired: true,
      submissionRequired: true,
      description: 'Validates borrower repayment of principal plus simple interest, transitioning agreement to REPAID.',
    },
    {
      name: 'settleLoan',
      classification: 'TRANSACTION_EXECUTION',
      mode: 'Write / On-Chain',
      walletRequired: true,
      proofRequired: false,
      signatureRequired: true,
      submissionRequired: true,
      description: 'Concludes agreement lifecycle into terminal SETTLED state; unlocks collateral and closes positions.',
    },
    {
      name: 'getLoanStatus',
      classification: 'STATE_READ',
      mode: 'Read / Public',
      walletRequired: false,
      proofRequired: false,
      signatureRequired: false,
      submissionRequired: false,
      description: 'Queries current lifecycle state enum (REQUESTED, FUNDED, REPAID, SETTLED) directly from Midnight ledger state.',
    },
    {
      name: 'getLoanDetails',
      classification: 'STATE_READ',
      mode: 'Read / Public',
      walletRequired: false,
      proofRequired: false,
      signatureRequired: false,
      submissionRequired: false,
      description: 'Retrieves public loan terms (amount, interest rate, duration blocks, threshold, borrower, lender) from ledger.',
    },
  ];

  return (
    <div className="overview-page contract-privacy-page">
      {/* 1. Header */}
      <section className="overview-intro">
        <div className="overview-intro-left">
          <div className="overview-kicker font-mono">
            <span>MIDNIGHT NETWORK</span>
            <span className="kicker-sep">//</span>
            <span>ZERO-KNOWLEDGE PROOF SYSTEM</span>
          </div>
          <h1 className="overview-headline">Contract &amp; Privacy</h1>
          <p className="overview-lead">
            Canonical 6-circuit Midnight Compact smart contract architecture and client-side zero-knowledge privacy boundaries.
          </p>
        </div>

        <div className="overview-intro-right">
          <div className="overview-protocol-meta font-mono">
            <div className="meta-item">
              <span className="meta-label">CIRCUITS</span>
              <span className="meta-val text-accent">6 CANONICAL</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">LANGUAGE</span>
              <span className="meta-val">COMPACT v0.2</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">PROOF ENGINE</span>
              <span className="meta-val text-accent">ZK-SNARK / OFF-CHAIN</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">LEDGER STATE</span>
              <span className="meta-val">ON-CHAIN ENFORCED</span>
            </div>
          </div>
          <div className="intro-actions-row">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => onNavigate('overview')}
            >
              Desk Overview &rarr;
            </button>
          </div>
        </div>
      </section>

      {/* 2. Cryptographic Execution Model Strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '28px',
        padding: '24px 0',
        marginBottom: '40px',
        borderTop: '1px solid rgba(159, 184, 216, 0.08)',
        borderBottom: '1px solid rgba(159, 184, 216, 0.08)',
      }} className="font-mono">
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', letterSpacing: '0.06em' }}>01 / CLIENT-SIDE WITNESS</div>
          <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Off-Chain ZK Prover</strong>
          <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Mathematical proofs generated locally on client device &bull; <span className="text-success">Zero Financial Leakage</span>
          </p>
        </div>

        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', letterSpacing: '0.06em' }}>02 / DUAL STATE ARCHITECTURE</div>
          <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Midnight Ledger Consensus</strong>
          <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Off-chain private state strictly separated from on-chain public state &bull; <span className="text-accent">Isolated Domains</span>
          </p>
        </div>

        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', letterSpacing: '0.06em' }}>03 / CANONICAL COMPACT CONTRACT</div>
          <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>index.compact</strong>
          <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Self-enforcing lending lifecycle guards &bull; <span className="text-accent">Deterministic Verification</span>
          </p>
        </div>
      </div>

      {/* 3. Canonical Compact Circuits Table */}
      <section className="overview-agreements" style={{ marginBottom: '48px' }}>
        <div className="overview-section-header">
          <div>
            <span className="section-kicker font-mono">SPECIFICATION // COMPACT CIRCUITS</span>
            <h2 className="section-title">Compact Smart Contract Circuits</h2>
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }} className="font-mono">
            6 of 6 CIRCUITS VERIFIED
          </div>
        </div>

        <div className="table-responsive">
          <table className="editorial-agreements-table">
            <thead>
              <tr>
                <th style={{ width: '22%' }}>Circuit Identifier</th>
                <th style={{ width: '18%' }}>Classification</th>
                <th style={{ width: '15%' }}>Execution Mode</th>
                <th style={{ width: '11%', textAlign: 'center' }}>Wallet</th>
                <th style={{ width: '11%', textAlign: 'center' }}>ZK Proof</th>
                <th style={{ width: '11%', textAlign: 'center' }}>Signature</th>
                <th style={{ width: '12%', textAlign: 'center' }}>Submission</th>
              </tr>
            </thead>
            <tbody>
              {circuits.map((c) => (
                <tr key={c.name} className="editorial-agreement-row" style={{ height: '64px' }}>
                  <td>
                    <code style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--accent-primary)' }}>
                      {c.name}()
                    </code>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.3 }}>
                      {c.description}
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-neutral font-mono" style={{ fontSize: '10px', letterSpacing: '0.04em' }}>
                      {c.classification}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${c.mode.includes('Write') ? 'badge-warning' : 'badge-info'} font-mono`} style={{ fontSize: '10px' }}>
                      {c.mode}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`font-mono ${c.walletRequired ? 'text-accent' : 'text-muted'}`} style={{ fontSize: '11.5px', fontWeight: 600 }}>
                      {c.walletRequired ? 'YES' : '—'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`font-mono ${c.proofRequired ? 'text-success' : 'text-muted'}`} style={{ fontSize: '11.5px', fontWeight: 600 }}>
                      {c.proofRequired ? 'REQUIRED' : '—'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`font-mono ${c.signatureRequired ? 'text-accent' : 'text-muted'}`} style={{ fontSize: '11.5px', fontWeight: 600 }}>
                      {c.signatureRequired ? 'REQUIRED' : '—'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`font-mono ${c.submissionRequired ? 'text-warning' : 'text-muted'}`} style={{ fontSize: '11.5px', fontWeight: 600 }}>
                      {c.submissionRequired ? 'ON-CHAIN' : 'OFF-CHAIN'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. Privacy Boundary Architecture Module */}
      <section style={{
        paddingTop: '32px',
        borderTop: '1px solid rgba(159, 184, 216, 0.08)',
        marginBottom: '48px',
      }}>
        <div className="overview-section-header" style={{ marginBottom: '24px' }}>
          <div>
            <span className="section-kicker font-mono">CRYPTOGRAPHIC PRIVACY // BOUNDARY ARCHITECTURE</span>
            <h2 className="section-title">Privacy Model &amp; Financial Data Protection</h2>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '24px',
        }}>
          {/* Column 1: Strictly Protected */}
          <div style={{
            padding: '24px',
            background: 'rgba(159, 184, 216, 0.02)',
            border: '1px solid rgba(159, 184, 216, 0.08)',
            borderRadius: '4px',
          }}>
            <div className="font-mono" style={{ fontSize: '10.5px', color: 'var(--status-success)', letterSpacing: '0.08em', marginBottom: '12px' }}>
              ● STRICTLY PROTECTED (CLIENT OFF-CHAIN)
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>
              Sensitive underlying financial information is never collected, stored, or revealed to the ledger or counterparty:
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '12px', lineHeight: 2, color: 'var(--text-primary)' }} className="font-mono">
              <li>&bull; Confidential Financial Records</li>
              <li>&bull; Private Qualification Witness</li>
              <li>&bull; Off-Chain Financial State</li>
              <li>&bull; Private Collateral Assets</li>
              <li>&bull; Cryptographic Secrets &amp; Salts</li>
              <li>&bull; Personal Identity Metadata</li>
            </ul>
          </div>

          {/* Column 2: Zero Knowledge Attestation */}
          <div style={{
            padding: '24px',
            background: 'rgba(159, 184, 216, 0.02)',
            border: '1px solid rgba(159, 184, 216, 0.08)',
            borderRadius: '4px',
          }}>
            <div className="font-mono" style={{ fontSize: '10.5px', color: 'var(--accent-primary)', letterSpacing: '0.08em', marginBottom: '12px' }}>
              ● ZERO-KNOWLEDGE PROOF ATTESTATION
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>
              The borrower executes a local prover circuit that verifies mathematical compliance without disclosing values:
            </p>
            <div style={{
              padding: '12px',
              background: 'rgba(7, 10, 16, 0.6)',
              border: '1px solid rgba(159, 184, 216, 0.1)',
              borderRadius: '3px',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent-primary)',
              marginBottom: '16px',
            }}>
              qualificationMetric &ge; threshold
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Lenders commit capital based on cryptographic proof validity accepted by the Midnight consensus engine.
            </p>
          </div>

          {/* Column 3: Public Ledger State */}
          <div style={{
            padding: '24px',
            background: 'rgba(159, 184, 216, 0.02)',
            border: '1px solid rgba(159, 184, 216, 0.08)',
            borderRadius: '4px',
          }}>
            <div className="font-mono" style={{ fontSize: '10.5px', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '12px' }}>
              ● PUBLIC LEDGER STATE (ON-CHAIN)
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>
              Only non-sensitive contract parameters are recorded transparently on the Midnight Network:
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '12px', lineHeight: 2, color: 'var(--text-primary)' }} className="font-mono">
              <li>&bull; Agreement Identifier (e.g. loan-001)</li>
              <li>&bull; Principal Amount &amp; Currency</li>
              <li>&bull; Simple Interest Rate (Basis Points)</li>
              <li>&bull; Consensus Duration (Blocks)</li>
              <li>&bull; Public Eligibility Threshold Mark</li>
              <li>&bull; Lifecycle Status Enum</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
};
