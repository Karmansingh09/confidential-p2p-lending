import React, { useState } from 'react';
import type { NavigationTab } from '../types/navigation.ts';

export interface ContractPrivacyPageProps {
  onNavigate: (tab: NavigationTab) => void;
}

interface CircuitItem {
  name: string;
  classification: string;
  mode: string;
  walletRequired: boolean;
  proofRequired: boolean;
  signatureRequired: boolean;
  submissionRequired: boolean;
  purpose: string;
  description: string;
}

export const ContractPrivacyPage: React.FC<ContractPrivacyPageProps> = ({ onNavigate }) => {
  const [expandedCircuit, setExpandedCircuit] = useState<string | null>('verifyEligibility');

  const circuits: CircuitItem[] = [
    {
      name: 'verifyEligibility',
      classification: 'LOCAL_PROOF',
      mode: 'Read / Off-Chain',
      walletRequired: true,
      proofRequired: true,
      signatureRequired: false,
      submissionRequired: false,
      purpose: 'Proves qualificationMetric >= threshold without disclosing private financial witness data.',
      description: 'Executes client-side zero-knowledge proof generation on the user device. The private financial value never leaves the client boundary.',
    },
    {
      name: 'fundLoan',
      classification: 'TRANSACTION_EXECUTION',
      mode: 'Write / On-Chain',
      walletRequired: true,
      proofRequired: false,
      signatureRequired: true,
      submissionRequired: true,
      purpose: 'Binds lender commitment to verified loan, transitions status to FUNDED, and locks parameters on-chain.',
      description: 'Atomic on-chain state transition requiring verified qualification status and authorized lender signature before escrow commitment.',
    },
    {
      name: 'repayLoan',
      classification: 'TRANSACTION_EXECUTION',
      mode: 'Write / On-Chain',
      walletRequired: true,
      proofRequired: false,
      signatureRequired: true,
      submissionRequired: true,
      purpose: 'Validates borrower repayment of principal plus simple interest, transitioning agreement to REPAID.',
      description: 'Enforces exact mathematical repayment calculation on-chain, preventing underpayment or overpayment before block deadline.',
    },
    {
      name: 'settleLoan',
      classification: 'TRANSACTION_EXECUTION',
      mode: 'Write / On-Chain',
      walletRequired: true,
      proofRequired: false,
      signatureRequired: true,
      submissionRequired: true,
      purpose: 'Concludes agreement lifecycle into terminal SETTLED state; unlocks collateral and closes positions.',
      description: 'Terminal lifecycle state transition. Either party can trigger final settlement once full obligation has been confirmed.',
    },
    {
      name: 'getLoanStatus',
      classification: 'STATE_READ',
      mode: 'Read / Public',
      walletRequired: false,
      proofRequired: false,
      signatureRequired: false,
      submissionRequired: false,
      purpose: 'Queries current lifecycle state enum (REQUESTED, FUNDED, REPAID, SETTLED) directly from ledger.',
      description: 'Public read-only inspection circuit. Queries on-chain consensus state without requiring wallet connection or cryptographic proofs.',
    },
    {
      name: 'getLoanDetails',
      classification: 'STATE_READ',
      mode: 'Read / Public',
      walletRequired: false,
      proofRequired: false,
      signatureRequired: false,
      submissionRequired: false,
      purpose: 'Retrieves public loan terms (amount, interest rate, duration blocks, threshold, borrower, lender).',
      description: 'Inspects immutable agreement terms agreed upon by borrower and lender, stored publicly in Midnight ledger consensus.',
    },
  ];

  const toggleCircuit = (name: string) => {
    setExpandedCircuit((prev) => (prev === name ? null : name));
  };

  return (
    <div className="privacy-workspace" data-testid="contract-privacy-page">
      {/* 1. EDITORIAL HERO SECTION (58% / 42%) */}
      <section className="privacy-hero-section">
        <div className="privacy-hero-left">
          <span className="privacy-hero-eyebrow font-mono">MIDNIGHT NETWORK / ZERO-KNOWLEDGE</span>
          <h1 className="privacy-hero-title">Contract &amp; Privacy</h1>
          <p className="privacy-hero-lead">
            Verify lending eligibility without exposing the financial information behind the proof.
          </p>
          <div className="privacy-hero-actions">
            <button
              type="button"
              className="btn-privacy-nav font-mono"
              onClick={() => onNavigate('overview')}
            >
              Desk Overview &rarr;
            </button>
            <button
              type="button"
              className="btn-privacy-secondary font-mono"
              onClick={() => onNavigate('create-loan')}
            >
              Propose Loan &rarr;
            </button>
          </div>
        </div>

        {/* 2. RIGHT HERO: AMBIENT PRIVACY VISUAL */}
        <div className="privacy-hero-right">
          <div className="privacy-visual-card">
            <div className="visual-header">
              <span className="visual-tag font-mono">CRYPTOGRAPHIC PROOF PIPELINE</span>
              <span className="visual-status-pill font-mono">SHIELDED</span>
            </div>

            <div className="privacy-flow-graphic">
              {/* Private Input Block */}
              <div className="graphic-block private-block">
                <span className="block-label font-mono">PRIVATE INPUT</span>
                <div className="masked-data-display font-mono">
                  <span className="mask-dot">&bull;</span>
                  <span className="mask-dot">&bull;</span>
                  <span className="mask-dot">&bull;</span>
                  <span className="mask-dot">&bull;</span>
                </div>
                <span className="block-sub font-mono">Client Off-Chain</span>
              </div>

              {/* Animated Proof Path */}
              <div className="graphic-proof-path" aria-hidden="true">
                <div className="proof-wave-pulse" />
                <span className="proof-path-label font-mono">ZK PROOF</span>
                <div className="proof-path-line" />
              </div>

              {/* Public Result Block */}
              <div className="graphic-block public-block">
                <span className="block-label font-mono">PUBLIC OUTCOME</span>
                <div className="verified-badge-display font-mono">
                  <span className="badge-check">&bull;</span>
                  <span>ELIGIBILITY VERIFIED</span>
                </div>
                <span className="block-sub font-mono">On-Chain Consensus</span>
              </div>
            </div>

            <div className="visual-footer">
              <span className="visual-caption font-mono">
                Mathematical certainty with zero exposure of underlying financial parameters.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. HOW PRIVACY WORKS (3 LARGE STEPS) */}
      <section className="privacy-section how-privacy-works-section" aria-label="How privacy works">
        <div className="section-header-clean">
          <span className="section-eyebrow font-mono">ARCHITECTURE</span>
          <h2 className="section-heading">How privacy works</h2>
        </div>

        <div className="privacy-steps-flow">
          {/* Step 1 */}
          <div className="privacy-step-item">
            <span className="step-num font-mono">01</span>
            <div className="step-content">
              <h3 className="step-title">Private Input</h3>
              <p className="step-desc">
                Your financial value stays private on your local client device. It is never transmitted across the network, stored on servers, or revealed to counterparties.
              </p>
            </div>
          </div>

          <div className="step-connector" aria-hidden="true" />

          {/* Step 2 */}
          <div className="privacy-step-item">
            <span className="step-num font-mono">02</span>
            <div className="step-content">
              <h3 className="step-title">Zero-Knowledge Proof</h3>
              <p className="step-desc">
                Eligibility is proven mathematically without revealing the underlying value. The prover verifies that your qualification metric meets or exceeds the required threshold.
              </p>
            </div>
          </div>

          <div className="step-connector" aria-hidden="true" />

          {/* Step 3 */}
          <div className="privacy-step-item">
            <span className="step-num font-mono">03</span>
            <div className="step-content">
              <h3 className="step-title">Public Outcome</h3>
              <p className="step-desc">
                Only the verification result becomes available to the lending workflow. Lenders commit capital based on verified cryptographic truth enforced by the smart contract.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. PRIVACY BOUNDARY (VISUAL SPLIT) */}
      <section className="privacy-section privacy-boundary-section" aria-label="Privacy boundary">
        <div className="section-header-clean">
          <span className="section-eyebrow font-mono">DATA DOMAINS</span>
          <h2 className="section-heading">Privacy boundary</h2>
        </div>

        <div className="privacy-boundary-card">
          {/* Left Domain: Private Off-Chain */}
          <div className="boundary-domain domain-private">
            <div className="domain-header">
              <span className="domain-kicker font-mono text-success">CLIENT OFF-CHAIN</span>
              <h3 className="domain-title">Private Domain</h3>
            </div>
            <p className="domain-intro">
              Never collected, broadcast, or exposed to counterparties:
            </p>
            <ul className="domain-list font-mono">
              <li>&bull; Financial value</li>
              <li>&bull; Private witness</li>
              <li>&bull; Eligibility inputs</li>
              <li>&bull; Personal financial information</li>
            </ul>
          </div>

          {/* Central Proof Divider */}
          <div className="boundary-divider-col">
            <div className="divider-line-vert" />
            <div className="divider-shield-badge font-mono">
              <span>ZERO-KNOWLEDGE PROOF</span>
            </div>
            <div className="divider-line-vert" />
          </div>

          {/* Right Domain: Public On-Chain */}
          <div className="boundary-domain domain-public">
            <div className="domain-header">
              <span className="domain-kicker font-mono text-accent">LEDGER ON-CHAIN</span>
              <h3 className="domain-title">Public Domain</h3>
            </div>
            <p className="domain-intro">
              Recorded transparently in Midnight ledger consensus:
            </p>
            <ul className="domain-list font-mono">
              <li>&bull; Eligibility result</li>
              <li>&bull; Loan lifecycle state</li>
              <li>&bull; Settlement state</li>
              <li>&bull; Public threshold mark</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 5. CONTRACT ARCHITECTURE FLOW */}
      <section className="privacy-section contract-arch-section" aria-label="Contract architecture">
        <div className="section-header-clean">
          <span className="section-eyebrow font-mono">LIFECYCLE PIPELINE</span>
          <h2 className="section-heading">Contract architecture</h2>
        </div>

        <div className="architecture-flow-container">
          <div className="arch-flow-track font-mono">
            <div className="arch-node">
              <span className="arch-node-step">01</span>
              <span className="arch-node-label">Borrower</span>
              <span className="arch-node-sub">Intent Created</span>
            </div>

            <div className="arch-connector">&rarr;</div>

            <div className="arch-node">
              <span className="arch-node-step">02</span>
              <span className="arch-node-label">Private Proof</span>
              <span className="arch-node-sub">Client Prover</span>
            </div>

            <div className="arch-connector">&rarr;</div>

            <div className="arch-node node-highlight">
              <span className="arch-node-step">03</span>
              <span className="arch-node-label">verifyEligibility()</span>
              <span className="arch-node-sub">ZK Gatekeeper</span>
            </div>

            <div className="arch-connector">&rarr;</div>

            <div className="arch-node">
              <span className="arch-node-step">04</span>
              <span className="arch-node-label">Loan Lifecycle</span>
              <span className="arch-node-sub">Status: REQUESTED</span>
            </div>

            <div className="arch-connector">&rarr;</div>

            <div className="arch-node">
              <span className="arch-node-step">05</span>
              <span className="arch-node-label">fundLoan()</span>
              <span className="arch-node-sub">Status: FUNDED</span>
            </div>

            <div className="arch-connector">&rarr;</div>

            <div className="arch-node">
              <span className="arch-node-step">06</span>
              <span className="arch-node-label">repayLoan()</span>
              <span className="arch-node-sub">Status: REPAID</span>
            </div>

            <div className="arch-connector">&rarr;</div>

            <div className="arch-node">
              <span className="arch-node-step">07</span>
              <span className="arch-node-label">settleLoan()</span>
              <span className="arch-node-sub">Status: SETTLED</span>
            </div>
          </div>
        </div>
      </section>

      {/* 6. COMPACT CIRCUITS (EXPANDABLE TECHNICAL ACCORDION) */}
      <section className="privacy-section compact-circuits-section" aria-label="Compact circuits">
        <div className="section-header-clean">
          <div>
            <span className="section-eyebrow font-mono">SPECIFICATION</span>
            <h2 className="section-heading">Compact circuits</h2>
          </div>
          <span className="section-meta-pill font-mono">6 CANONICAL CIRCUITS</span>
        </div>

        <div className="circuits-accordion">
          {circuits.map((circuit) => {
            const isExpanded = expandedCircuit === circuit.name;
            return (
              <div
                key={circuit.name}
                className={`circuit-accordion-item ${isExpanded ? 'is-expanded' : ''}`}
              >
                <button
                  type="button"
                  className="circuit-summary-btn"
                  onClick={() => toggleCircuit(circuit.name)}
                  aria-expanded={isExpanded}
                >
                  <div className="summary-left">
                    <span className="circuit-name font-mono">{circuit.name}()</span>
                    <span className="circuit-purpose">{circuit.purpose}</span>
                  </div>

                  <div className="summary-right">
                    <span className="circuit-mode-pill font-mono">{circuit.mode}</span>
                    <span className={`circuit-proof-tag font-mono ${circuit.proofRequired ? 'tag-proof-required' : ''}`}>
                      {circuit.proofRequired ? 'ZK PROOF' : 'READ'}
                    </span>
                    <span className="accordion-toggle-icon font-mono">{isExpanded ? '−' : '+'}</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="circuit-expanded-details">
                    <p className="circuit-full-desc">{circuit.description}</p>
                    <div className="circuit-metadata-grid font-mono">
                      <div className="meta-field">
                        <span className="field-label">CLASSIFICATION</span>
                        <span className="field-val text-accent">{circuit.classification}</span>
                      </div>
                      <div className="meta-field">
                        <span className="field-label">EXECUTION MODE</span>
                        <span className="field-val">{circuit.mode}</span>
                      </div>
                      <div className="meta-field">
                        <span className="field-label">WALLET REQUIRED</span>
                        <span className={`field-val ${circuit.walletRequired ? 'text-accent' : 'text-muted'}`}>
                          {circuit.walletRequired ? 'YES' : 'NO'}
                        </span>
                      </div>
                      <div className="meta-field">
                        <span className="field-label">ZK PROOF</span>
                        <span className={`field-val ${circuit.proofRequired ? 'text-success' : 'text-muted'}`}>
                          {circuit.proofRequired ? 'REQUIRED' : 'NONE'}
                        </span>
                      </div>
                      <div className="meta-field">
                        <span className="field-label">SIGNATURE</span>
                        <span className={`field-val ${circuit.signatureRequired ? 'text-accent' : 'text-muted'}`}>
                          {circuit.signatureRequired ? 'REQUIRED' : 'NONE'}
                        </span>
                      </div>
                      <div className="meta-field">
                        <span className="field-label">SUBMISSION</span>
                        <span className={`field-val ${circuit.submissionRequired ? 'text-warning' : 'text-muted'}`}>
                          {circuit.submissionRequired ? 'ON-CHAIN' : 'OFF-CHAIN'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 7. WHAT STAYS PRIVATE? (ON-CHAIN VS OFF-CHAIN COMPARISON) */}
      <section className="privacy-section what-stays-private-section" aria-label="What stays private?">
        <div className="section-header-clean">
          <span className="section-eyebrow font-mono">TRANSPARENCY AUDIT</span>
          <h2 className="section-heading">What stays private?</h2>
        </div>

        <div className="comparison-table-card">
          <div className="comparison-col col-private">
            <div className="comparison-col-header">
              <span className="col-status-dot dot-success" />
              <h3 className="col-title font-mono">PRIVATE / OFF-CHAIN</h3>
            </div>
            <div className="comparison-rows font-mono">
              <div className="comparison-row">
                <span className="item-name">Financial value</span>
                <span className="item-desc">Stored exclusively on user client device</span>
              </div>
              <div className="comparison-row">
                <span className="item-name">Private witness</span>
                <span className="item-desc">Never revealed to ledger or counterparty</span>
              </div>
              <div className="comparison-row">
                <span className="item-name">Eligibility inputs</span>
                <span className="item-desc">Inputs used in local qualification calculation</span>
              </div>
            </div>
          </div>

          <div className="comparison-col col-public">
            <div className="comparison-col-header">
              <span className="col-status-dot dot-accent" />
              <h3 className="col-title font-mono">PUBLIC / ON-CHAIN</h3>
            </div>
            <div className="comparison-rows font-mono">
              <div className="comparison-row">
                <span className="item-name">Eligibility result</span>
                <span className="item-desc">Boolean attestation from ZK verification</span>
              </div>
              <div className="comparison-row">
                <span className="item-name">Loan state</span>
                <span className="item-desc">Lifecycle status (Requested, Funded, Repaid)</span>
              </div>
              <div className="comparison-row">
                <span className="item-name">Settlement state</span>
                <span className="item-desc">On-chain atomic settlement finalization</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. CONTRACT STATUS (CLEAN 4-ITEM METRIC BAR) */}
      <section className="privacy-section contract-status-section" aria-label="Contract status">
        <div className="section-header-clean">
          <span className="section-eyebrow font-mono">RUNTIME PROFILE</span>
          <h2 className="section-heading">Contract status</h2>
        </div>

        <div className="contract-status-bar font-mono">
          <div className="status-bar-item">
            <span className="status-item-label">CIRCUIT COUNT</span>
            <span className="status-item-val text-accent">6 Canonical</span>
          </div>
          <div className="status-bar-item">
            <span className="status-item-label">LANGUAGE</span>
            <span className="status-item-val">Compact v0.2</span>
          </div>
          <div className="status-bar-item">
            <span className="status-item-label">PROOF SYSTEM</span>
            <span className="status-item-val text-accent">ZK-SNARK / Off-Chain</span>
          </div>
          <div className="status-bar-item">
            <span className="status-item-label">STATE ENFORCED</span>
            <span className="status-item-val">On-Chain Ledger</span>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ContractPrivacyPage;
