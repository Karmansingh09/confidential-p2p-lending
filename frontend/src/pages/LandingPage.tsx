import React from 'react';
import type { NavigationTab } from '../types/navigation.ts';
import { PrivacyCoreCanvas } from '../components/landing/PrivacyCoreCanvas.tsx';
import '../components/landing/LandingPage.css';

export interface LandingPageProps {
  onLaunchDesk?: (tab?: NavigationTab) => void;
  onEnterDesk?: (tab?: NavigationTab) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLaunchDesk, onEnterDesk }) => {
  const handleEnter = (tab: NavigationTab = 'overview') => {
    if (onEnterDesk) {
      onEnterDesk(tab);
    } else if (onLaunchDesk) {
      onLaunchDesk(tab);
    }
  };

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="editorial-landing">
      {/* --------------------------------------------------------------------
          1. FIXED PREMIUM NAVIGATION (Section 11)
          -------------------------------------------------------------------- */}
      <nav className="landing-nav-fixed" aria-label="Main Navigation">
        <div className="landing-nav-container">
          <div
            className="landing-nav-brand"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            role="button"
            tabIndex={0}
          >
            <div className="landing-brand-mark">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L3 6V11.5C3 16.5 6.8 21.1 12 22C17.2 21.1 21 16.5 21 11.5V6L12 2Z" stroke="#9FB8D8" />
                <path d="M9 12L11 14L15 9.5" stroke="#F2F4F7" strokeWidth="2.5" />
              </svg>
            </div>
            <div className="landing-brand-titles">
              <span className="brand-wordmark">CONFIDENTIAL</span>
              <span className="brand-submark">P2P LENDING DESK</span>
            </div>
          </div>

          <div className="landing-nav-links">
            <a
              href="#how-it-works"
              className="nav-anchor-link"
              onClick={(e) => scrollToSection(e, 'how-it-works')}
            >
              How It Works
            </a>
            <a
              href="#privacy"
              className="nav-anchor-link"
              onClick={(e) => scrollToSection(e, 'privacy')}
            >
              Privacy
            </a>
            <a
              href="#borrower"
              className="nav-anchor-link"
              onClick={(e) => scrollToSection(e, 'borrower')}
            >
              For Borrowers
            </a>
            <a
              href="#lender"
              className="nav-anchor-link"
              onClick={(e) => scrollToSection(e, 'lender')}
            >
              For Lenders
            </a>
          </div>

          <div className="landing-nav-actions">
            <button
              type="button"
              className="btn-desk-enter"
              onClick={() => handleEnter('overview')}
            >
              <span>ENTER LENDING DESK</span>
              <span className="arrow-symbol">&rarr;</span>
            </button>
          </div>
        </div>
      </nav>

      {/* --------------------------------------------------------------------
          2. CINEMATIC HERO SECTION (Section 5, 6, 7, 8, 9, 10, 12, 13)
          -------------------------------------------------------------------- */}
      <section className="landing-hero" id="hero">
        <div className="hero-layout-grid">
          {/* Left Column (50%): Editorial Headline & Copy */}
          <div className="hero-editorial-col">
            <div className="hero-tech-label">PRIVATE FINANCIAL DATA</div>

            <h1 className="hero-editorial-headline">
              <span className="headline-line">PRIVATE LENDING.</span>
              <span className="headline-line">WITHOUT REVEALING</span>
              <span className="headline-line headline-highlight">PRIVATE FINANCES.</span>
            </h1>

            <p className="hero-supporting-copy">
              Prove eligibility without exposing the financial information behind the proof.
            </p>

            <div className="hero-cta-button-group">
              <button
                type="button"
                className="btn-hero-primary"
                onClick={() => handleEnter('overview')}
              >
                <span>ENTER LENDING DESK</span>
                <span className="arrow-symbol">&rarr;</span>
              </button>

              <a
                href="#privacy"
                className="btn-hero-secondary"
                onClick={(e) => scrollToSection(e, 'privacy')}
              >
                <span>EXPLORE PRIVACY</span>
                <span className="arrow-symbol">&rarr;</span>
              </a>
            </div>
          </div>

          {/* Right Column (50%): The Privacy Core Visual */}
          <div className="hero-visual-col">
            <PrivacyCoreCanvas />
          </div>
        </div>

        {/* 10. BOTTOM FEATURE STRIP */}
        <div className="hero-feature-strip">
          <div className="feature-strip-container">
            <div className="feature-strip-item">
              <div className="feature-strip-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#9FB8D8" />
                  <path d="M9 12l2 2 4-4" stroke="#F2F4F7" strokeWidth="2" />
                </svg>
              </div>
              <div className="feature-strip-content">
                <span className="feature-strip-title">PRIVACY FIRST</span>
                <span className="feature-strip-desc">Your financial data stays private.</span>
              </div>
            </div>

            <div className="feature-strip-item">
              <div className="feature-strip-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="#9FB8D8" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#9FB8D8" />
                  <circle cx="12" cy="16" r="1.5" fill="#F2F4F7" />
                </svg>
              </div>
              <div className="feature-strip-content">
                <span className="feature-strip-title">ZERO-KNOWLEDGE ELIGIBILITY</span>
                <span className="feature-strip-desc">Prove without revealing.</span>
              </div>
            </div>

            <div className="feature-strip-item">
              <div className="feature-strip-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 2 7 12 12 22 7 12 2" stroke="#9FB8D8" />
                  <polyline points="2 17 12 22 22 17" stroke="#9FB8D8" />
                  <polyline points="2 12 12 17 22 12" stroke="#9FB8D8" />
                </svg>
              </div>
              <div className="feature-strip-content">
                <span className="feature-strip-title">BUILT ON MIDNIGHT</span>
                <span className="feature-strip-desc">A privacy-preserving blockchain.</span>
              </div>
            </div>

            <div className="feature-strip-item">
              <div className="feature-strip-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 21h18M3 10h18M5 10v11M9 10v11M15 10v11M19 10v11M12 2L2 7h20L12 2z" stroke="#9FB8D8" />
                </svg>
              </div>
              <div className="feature-strip-content">
                <span className="feature-strip-title">INSTITUTIONAL GRADE</span>
                <span className="feature-strip-desc">Privacy infrastructure for lending.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------
          3. SECTION 01 — HOW IT WORKS (Section 15)
          -------------------------------------------------------------------- */}
      <section className="editorial-section" id="how-it-works">
        <div className="editorial-container">
          <div className="section-editorial-header">
            <span className="section-editorial-label">01 / HOW IT WORKS</span>
            <h2 className="section-editorial-heading">
              PRIVATE DATA.<br />
              PUBLICLY VERIFIABLE OUTCOME.
            </h2>
            <p className="section-editorial-desc">
              Borrowers can prove they satisfy the protocol's eligibility requirements without exposing the underlying financial information.
            </p>
          </div>

          <div className="how-stages-grid">
            <div className="how-stage-card">
              <div className="stage-num-mono">STAGE 01</div>
              <h3 className="stage-card-title">PRIVATE INPUT</h3>
              <p className="stage-card-body">
                "Sensitive financial information stays private."
              </p>
              <div className="stage-card-footer">
                Underwriting inputs are evaluated exclusively within the borrower's local enclave.
              </div>
            </div>

            <div className="how-stage-card">
              <div className="stage-num-mono">STAGE 02</div>
              <h3 className="stage-card-title">ZERO-KNOWLEDGE PROOF</h3>
              <p className="stage-card-body">
                "Eligibility is verified without exposing the underlying value."
              </p>
              <div className="stage-card-footer">
                A Compact zero-knowledge circuit mathematically attests that qualifications meet the required threshold.
              </div>
            </div>

            <div className="how-stage-card">
              <div className="stage-num-mono">STAGE 03</div>
              <h3 className="stage-card-title">VERIFIED OUTCOME</h3>
              <p className="stage-card-body">
                "Only the result required by the lending protocol becomes visible."
              </p>
              <div className="stage-card-footer">
                The canonical on-chain agreement reflects verified eligibility, allowing lenders to allocate capital safely.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------
          4. SECTION 02 — BORROWER (Section 16)
          -------------------------------------------------------------------- */}
      <section className="editorial-section bg-secondary" id="borrower">
        <div className="editorial-container">
          <div className="split-editorial-layout">
            {/* Left Column (42%): Sticky Editorial Pitch & Highlights */}
            <div className="split-editorial-aside">
              <span className="section-editorial-label">02 / BORROWER</span>
              <h2 className="section-editorial-heading">
                BORROW WITH<br />
                PRIVACY BUILT IN.
              </h2>
              <p className="section-editorial-desc">
                Access decentralized micro-credit without handing over raw financial statements or exposing sensitive metrics to counterparties.
              </p>

              <div className="aside-highlight-cards">
                <div className="aside-highlight-card">
                  <div className="highlight-card-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="#9FB8D8" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#9FB8D8" />
                    </svg>
                  </div>
                  <div className="highlight-card-text">
                    <strong>Zero Data Leakage</strong>
                    <span>Underwriting inputs stay strictly within your local enclave. Never sent to network nodes.</span>
                  </div>
                </div>

                <div className="aside-highlight-card">
                  <div className="highlight-card-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" stroke="#9FB8D8" />
                    </svg>
                  </div>
                  <div className="highlight-card-text">
                    <strong>Instant ZK Attestation</strong>
                    <span>Prove threshold qualification cryptographically without revealing underlying assets.</span>
                  </div>
                </div>
              </div>

              <div className="aside-action-box">
                <button
                  type="button"
                  className="btn-hero-primary"
                  onClick={() => handleEnter('create-loan')}
                >
                  <span>CREATE LOAN REQUEST</span>
                  <span className="arrow-symbol">&rarr;</span>
                </button>
              </div>
            </div>

            {/* Right Column (58%): 5 Expansive Process Cards */}
            <div className="split-process-cards">
              <div className="process-step-card">
                <div className="process-card-header">
                  <div className="process-card-idx-row">
                    <span className="process-step-idx">01</span>
                    <h3 className="process-step-title">Connect Wallet</h3>
                  </div>
                  <span className="process-tech-badge">SESSION INIT</span>
                </div>
                <p className="process-step-description">
                  Establish a cryptographic session with a Midnight-compatible wallet provider to authorize transaction requests and manage keypairs.
                </p>
              </div>

              <div className="process-step-card">
                <div className="process-card-header">
                  <div className="process-card-idx-row">
                    <span className="process-step-idx">02</span>
                    <h3 className="process-step-title">Verify Eligibility Privately</h3>
                  </div>
                  <span className="process-tech-badge badge-shielded">ZK PROOF</span>
                </div>
                <p className="process-step-description">
                  Execute client-side zero-knowledge proof generation. Your private witness confirms qualification meets the required threshold without leaving your machine.
                </p>
              </div>

              <div className="process-step-card">
                <div className="process-card-header">
                  <div className="process-card-idx-row">
                    <span className="process-step-idx">03</span>
                    <h3 className="process-step-title">Create Loan Request</h3>
                  </div>
                  <span className="process-tech-badge">PROPOSAL</span>
                </div>
                <p className="process-step-description">
                  Initialize an immutable loan proposal with requested principal, duration blocks, agreed interest, and the cryptographic attestation.
                </p>
              </div>

              <div className="process-step-card">
                <div className="process-card-header">
                  <div className="process-card-idx-row">
                    <span className="process-step-idx">04</span>
                    <h3 className="process-step-title">Receive Funding</h3>
                  </div>
                  <span className="process-tech-badge">CAPITAL LOCK</span>
                </div>
                <p className="process-step-description">
                  Lenders inspect your verified proof and allocate capital directly to your loan agreement on-chain with deterministic settlement guarantees.
                </p>
              </div>

              <div className="process-step-card">
                <div className="process-card-header">
                  <div className="process-card-idx-row">
                    <span className="process-step-idx">05</span>
                    <h3 className="process-step-title">Repay</h3>
                  </div>
                  <span className="process-tech-badge">SETTLEMENT</span>
                </div>
                <p className="process-step-description">
                  Clear the loan obligation (principal plus agreed simple interest) before the block deadline to complete the lifecycle and release claims.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------
          5. SECTION 03 — LENDER (Section 17)
          -------------------------------------------------------------------- */}
      <section className="editorial-section" id="lender">
        <div className="editorial-container">
          <div className="split-editorial-layout">
            {/* Left Column (42%): Sticky Editorial Pitch & Highlights */}
            <div className="split-editorial-aside">
              <span className="section-editorial-label">03 / LENDER</span>
              <h2 className="section-editorial-heading">
                LEND AGAINST<br />
                VERIFIED OUTCOMES.
              </h2>
              <p className="section-editorial-desc">
                Deploy capital with cryptographic certainty. Financial information remains private — evaluate mathematical validity, never raw borrower statements.
              </p>

              <div className="aside-highlight-cards">
                <div className="aside-highlight-card">
                  <div className="highlight-card-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="12 2 2 7 12 12 22 7 12 2" stroke="#9FB8D8" />
                      <polyline points="2 17 12 22 22 17" stroke="#9FB8D8" />
                      <polyline points="2 12 12 17 22 12" stroke="#9FB8D8" />
                    </svg>
                  </div>
                  <div className="highlight-card-text">
                    <strong>Cryptographic Certainty</strong>
                    <span>Fund with confidence knowing qualification satisfies protocol thresholds mathematically.</span>
                  </div>
                </div>

                <div className="aside-highlight-card">
                  <div className="highlight-card-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" stroke="#9FB8D8" />
                      <polyline points="12 6 12 12 14 14" stroke="#9FB8D8" />
                    </svg>
                  </div>
                  <div className="highlight-card-text">
                    <strong>Automated Settlement</strong>
                    <span>Smart contracts enforce immutable repayment obligations and principal return.</span>
                  </div>
                </div>
              </div>

              <div className="aside-action-box">
                <button
                  type="button"
                  className="btn-hero-primary"
                  onClick={() => handleEnter('marketplace')}
                >
                  <span>BROWSE MARKETPLACE</span>
                  <span className="arrow-symbol">&rarr;</span>
                </button>
              </div>
            </div>

            {/* Right Column (58%): 5 Expansive Process Cards */}
            <div className="split-process-cards">
              <div className="process-step-card">
                <div className="process-card-header">
                  <div className="process-card-idx-row">
                    <span className="process-step-idx">01</span>
                    <h3 className="process-step-title">Browse Loan Requests</h3>
                  </div>
                  <span className="process-tech-badge">MARKETPLACE</span>
                </div>
                <p className="process-step-description">
                  Explore available peer-to-peer micro-lending opportunities in the decentralized marketplace order book.
                </p>
              </div>

              <div className="process-step-card">
                <div className="process-card-header">
                  <div className="process-card-idx-row">
                    <span className="process-step-idx">02</span>
                    <h3 className="process-step-title">Review Public Terms</h3>
                  </div>
                  <span className="process-tech-badge">TERMS AUDIT</span>
                </div>
                <p className="process-step-description">
                  Audit agreed principal, annual interest rate basis points, repayment duration blocks, and required threshold criteria.
                </p>
              </div>

              <div className="process-step-card">
                <div className="process-card-header">
                  <div className="process-card-idx-row">
                    <span className="process-step-idx">03</span>
                    <h3 className="process-step-title">Confirm Eligibility Status</h3>
                  </div>
                  <span className="process-tech-badge badge-shielded">VERIFIED PROOF</span>
                </div>
                <p className="process-step-description">
                  Inspect the cryptographic zero-knowledge attestation. Financial information remains private; only mathematical satisfaction is surfaced.
                </p>
              </div>

              <div className="process-step-card">
                <div className="process-card-header">
                  <div className="process-card-idx-row">
                    <span className="process-step-idx">04</span>
                    <h3 className="process-step-title">Fund a Loan</h3>
                  </div>
                  <span className="process-tech-badge">ESCROW LOCK</span>
                </div>
                <p className="process-step-description">
                  Commit capital through an on-chain funding transaction. Contract rules guarantee funds are locked into verified terms.
                </p>
              </div>

              <div className="process-step-card">
                <div className="process-card-header">
                  <div className="process-card-idx-row">
                    <span className="process-step-idx">05</span>
                    <h3 className="process-step-title">Track Repayment & Settlement</h3>
                  </div>
                  <span className="process-tech-badge">SETTLEMENT</span>
                </div>
                <p className="process-step-description">
                  Monitor borrower repayment progress in real time and execute terminal settlement to reclaim principal and yield.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------
          6. SECTION 04 — PRIVACY ARCHITECTURE (Section 18)
          -------------------------------------------------------------------- */}
      <section className="editorial-section bg-secondary" id="privacy">
        <div className="editorial-container">
          <div className="section-editorial-header">
            <span className="section-editorial-label">04 / PRIVACY</span>
            <h2 className="section-editorial-heading">
              WHAT YOU NEED TO PROVE<br />
              ISN'T WHAT YOU NEED TO REVEAL.
            </h2>
            <p className="section-editorial-desc">
              A cryptographic boundary separates sensitive off-chain inputs from on-chain verifiable attestations. Information enters as a private witness and emerges exclusively as a verified result.
            </p>
          </div>

          <div className="privacy-flow-visual">
            <div className="privacy-transformation-track">
              {/* Node 1: Private Financial Value */}
              <div className="privacy-track-node">
                <span className="node-category-tag">OFF-CHAIN / CLIENT</span>
                <h3 className="node-title-main">PRIVATE FINANCIAL VALUE</h3>
                <p className="node-desc-text">
                  Sensitive qualifications held in local memory. Never sent to network nodes or smart contract storage.
                </p>
                <div className="node-status-indicator">&bull; Zero Exposure</div>
              </div>

              {/* Node 2: Private Proof */}
              <div className="privacy-track-node node-shielded">
                <span className="node-category-tag">COMPACT CIRCUIT</span>
                <h3 className="node-title-main">PRIVATE PROOF</h3>
                <p className="node-desc-text">
                  Zero-knowledge proof calculation verifying <code>witness &ge; threshold</code> off-chain.
                </p>
                <div className="node-status-indicator">&bull; Shielded Witness</div>
              </div>

              {/* Node 3: Eligibility Attestation */}
              <div className="privacy-track-node node-shielded">
                <span className="node-category-tag">CRYPTOGRAPHIC ATTESTATION</span>
                <h3 className="node-title-main">ELIGIBILITY ATTESTATION</h3>
                <p className="node-desc-text">
                  Binary proof that qualifications satisfy the threshold. The underlying value is discarded.
                </p>
                <div className="node-status-indicator">&bull; Verified Result</div>
              </div>

              {/* Node 4: Public Loan State */}
              <div className="privacy-track-node">
                <span className="node-category-tag">ON-CHAIN LEDGER</span>
                <h3 className="node-title-main">PUBLIC LOAN STATE</h3>
                <p className="node-desc-text">
                  Canonical Midnight smart contract record marked as verified. Unlocked for capital commitment.
                </p>
                <div className="node-status-indicator">&bull; Canonical State</div>
              </div>
            </div>

            <div className="privacy-guarantee-box">
              <div className="guarantee-statement">
                <strong>Zero-Knowledge Invariant:</strong> "The underlying financial information remains private. Only the eligibility result required by the lending protocol is revealed."
              </div>
              <button
                type="button"
                className="btn-desk-enter"
                onClick={() => handleEnter('contract-privacy')}
              >
                <span>INSPECT CIRCUITS</span>
                <span className="arrow-symbol">&rarr;</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------
          7. SECTION 05 — TRANSACTION LIFECYCLE (Section 19)
          -------------------------------------------------------------------- */}
      <section className="editorial-section" id="lifecycle">
        <div className="editorial-container">
          <div className="section-editorial-header">
            <span className="section-editorial-label">05 / TRANSACTION LIFECYCLE</span>
            <h2 className="section-editorial-heading">
              FROM REQUEST<br />
              TO SETTLEMENT.
            </h2>
            <p className="section-editorial-desc">
              Strict multi-phase lifecycle tracking enforces deterministic reconciliation between local client intent, wallet provider submissions, and canonical on-chain state.
            </p>
          </div>

          <div className="lifecycle-stepper-track">
            <div className="lifecycle-node-cell">
              <span className="lifecycle-idx">01</span>
              <span className="lifecycle-name">REQUEST</span>
              <span className="lifecycle-sub">Proposal Initialized</span>
            </div>

            <div className="lifecycle-node-cell">
              <span className="lifecycle-idx">02</span>
              <span className="lifecycle-name">READINESS</span>
              <span className="lifecycle-sub">Pre-flight Validation</span>
            </div>

            <div className="lifecycle-node-cell">
              <span className="lifecycle-idx">03</span>
              <span className="lifecycle-name">SIGNATURE</span>
              <span className="lifecycle-sub">Keypair Authorization</span>
            </div>

            <div className="lifecycle-node-cell">
              <span className="lifecycle-idx">04</span>
              <span className="lifecycle-name">SUBMISSION</span>
              <span className="lifecycle-sub">RPC Broadcast</span>
            </div>

            <div className="lifecycle-node-cell">
              <span className="lifecycle-idx">05</span>
              <span className="lifecycle-name">PROVIDER VERIFICATION</span>
              <span className="lifecycle-sub">Node Status Query</span>
            </div>

            <div className="lifecycle-node-cell">
              <span className="lifecycle-idx">06</span>
              <span className="lifecycle-name">CONFIRMATION</span>
              <span className="lifecycle-sub">Block Inclusion</span>
            </div>

            <div className="lifecycle-node-cell">
              <span className="lifecycle-idx">07</span>
              <span className="lifecycle-name">CANONICAL STATE</span>
              <span className="lifecycle-sub">Registry Mutation</span>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------
          8. SECTION 06 — MIDNIGHT INFRASTRUCTURE (Section 20)
          -------------------------------------------------------------------- */}
      <section className="editorial-section bg-secondary" id="infrastructure">
        <div className="editorial-container">
          <div className="section-editorial-header">
            <span className="section-editorial-label">06 / INFRASTRUCTURE</span>
            <h2 className="section-editorial-heading">
              PRIVACY-FIRST<br />
              LENDING INFRASTRUCTURE.
            </h2>
            <p className="section-editorial-desc">
              Engineered around Midnight Network and Compact smart contracts, combining native zero-knowledge proof generation with decentralized settlement guarantees.
            </p>
          </div>

          <div className="infra-cards-grid">
            <div className="infra-card">
              <div className="infra-card-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <h3 className="infra-card-title">Dual-State Privacy Model</h3>
              <p className="infra-card-desc">
                Enables private states to remain strictly on client devices while public ledger states enforce consensus and agreement settlement across the network.
              </p>
            </div>

            <div className="infra-card">
              <div className="infra-card-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
              </div>
              <h3 className="infra-card-title">Compact Smart Contracts</h3>
              <p className="infra-card-desc">
                Formally verified circuits (verifyEligibility, fundLoan, repayLoan, settleLoan) ensure zero arithmetic overflow and strict authorization boundaries.
              </p>
            </div>

            <div className="infra-card">
              <div className="infra-card-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 14 14" />
                </svg>
              </div>
              <h3 className="infra-card-title">Deterministic Reconciliation</h3>
              <p className="infra-card-desc">
                Anti-fabrication design ensures off-chain intent is reconciled against verified provider responses before any contract state transition is finalized.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------
          9. FINAL CTA & MINIMAL FOOTER (Section 21)
          -------------------------------------------------------------------- */}
      <section className="landing-cta-editorial">
        <div className="editorial-container">
          <h2 className="cta-editorial-statement">
            YOUR FINANCIAL DATA<br />
            STAYS PRIVATE.<br />
            <span className="statement-light">YOUR OUTCOME<br />CAN STILL BE VERIFIED.</span>
          </h2>

          <div className="cta-button-row">
            <button
              type="button"
              className="btn-hero-primary"
              onClick={() => handleEnter('overview')}
            >
              <span>ENTER LENDING DESK</span>
              <span className="arrow-symbol">&rarr;</span>
            </button>

            <button
              type="button"
              className="btn-hero-secondary"
              onClick={() => handleEnter('contract-privacy')}
            >
              <span>EXPLORE THE PRIVACY MODEL</span>
              <span className="arrow-symbol">&rarr;</span>
            </button>
          </div>
        </div>
      </section>

      <footer className="landing-footer-editorial">
        <div className="footer-editorial-container">
          <div className="footer-brand-label">
            CONFIDENTIAL P2P LENDING DESK
          </div>
          <div className="footer-technical-note">
            Built for Midnight Network &bull; Compact Smart Contracts &bull; Zero-Knowledge Underwriting
          </div>
          <div className="footer-env-status">
            PROTOTYPE ENVIRONMENT &bull; LOCAL MOCK MODE ACTIVE
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
