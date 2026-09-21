import React from 'react';
import type { LoanDetailsModel } from '../types/index.ts';
import { LoanMarketplace } from '../components/LoanMarketplace.tsx';
import type { NavigationTab } from '../types/navigation.ts';
import { AnimatedNumber } from '../components/common/AnimatedNumber.tsx';
import { getLifecycleCounts } from '../lib/marketplace.ts';

export interface MarketplacePageProps {
  loansMap: Record<string, LoanDetailsModel>;
  selectedLoanId: string;
  onSelectLoan: (loanId: string) => void;
  onNavigate: (tab: NavigationTab) => void;
}

export const MarketplacePage: React.FC<MarketplacePageProps> = ({
  loansMap,
  selectedLoanId,
  onSelectLoan,
  onNavigate,
}) => {
  const handleSelectAndInspect = (loanId: string) => {
    onSelectLoan(loanId);
    onNavigate('loan-details');
  };

  const loans = Object.values(loansMap);
  const totalCount = loans.length;
  const verifiedCount = loans.filter((l) => l.isEligibilityVerified).length;
  const totalVolume = loans.reduce((acc, l) => acc + l.amount, 0n);
  const counts = getLifecycleCounts(loansMap);

  return (
    <div className="marketplace-workspace">
      {/* 1. MARKETPLACE HERO (60% / 40%) */}
      <section className="marketplace-hero-section">
        <div className="marketplace-hero-left">
          <div className="marketplace-kicker font-mono">
            <span>MIDNIGHT NETWORK</span>
            <span className="kicker-sep">//</span>
            <span>PRIVATE CREDIT ORDER BOOK</span>
          </div>
          <h1 className="marketplace-headline">Private Lending Marketplace</h1>
          <p className="marketplace-lead">
            Discover active lending opportunities and evaluate terms without exposing private financial information.
          </p>

          <div className="marketplace-actions-row">
            <button
              type="button"
              className="btn-marketplace-primary"
              onClick={() => onNavigate('create-loan')}
            >
              + PROPOSE LOAN
            </button>
            <button
              type="button"
              className="btn-marketplace-outline"
              onClick={() => onNavigate('overview')}
            >
              DESK OVERVIEW &rarr;
            </button>
          </div>
        </div>

        <div className="marketplace-hero-right">
          <div className="marketplace-status-enclave font-mono">
            <div className="status-enclave-header">
              <span className="status-enclave-title">MARKET STATUS</span>
              <span className="status-enclave-indicator">
                <span className="status-dot-sm dot-success" />
                <span className="status-text-live">OPERATIONAL</span>
              </span>
            </div>

            <div className="status-enclave-body">
              <div className="status-enclave-row">
                <span className="status-enclave-key">OPPORTUNITIES</span>
                <span className="status-enclave-val text-accent">{totalCount} Active</span>
              </div>
              <div className="status-enclave-row">
                <span className="status-enclave-key">NETWORK</span>
                <span className="status-enclave-val">Local Prototype</span>
              </div>
              <div className="status-enclave-row">
                <span className="status-enclave-key">PRIVACY</span>
                <span className="status-enclave-val text-accent">ZK Attestation</span>
              </div>
              <div className="status-enclave-row">
                <span className="status-enclave-key">ATTESTATION</span>
                <span className="status-enclave-val">Client-Side ZK</span>
              </div>
            </div>

            <div className="status-enclave-footer">
              <span className="status-enclave-badge">ZERO FINANCIAL EXPOSURE</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. WIDE MARKETPLACE SUMMARY STRIP */}
      <section className="marketplace-summary-strip" aria-label="Marketplace Liquidity Summary">
        <div className="summary-stat-col">
          <span className="summary-stat-label">TOTAL VOLUME</span>
          <div className="summary-stat-val-row">
            <span className="summary-stat-num">
              <AnimatedNumber value={totalVolume} />
            </span>
            <span className="summary-stat-unit">UNITS</span>
          </div>
          <span className="summary-stat-sub">Active Commitments</span>
        </div>

        <div className="summary-stat-col">
          <span className="summary-stat-label">OPPORTUNITIES</span>
          <div className="summary-stat-val-row">
            <span className="summary-stat-num">{totalCount}</span>
            <span className="summary-stat-tag">ACTIVE</span>
          </div>
          <span className="summary-stat-sub">{verifiedCount} ZK Verified ({Math.round((verifiedCount / Math.max(1, totalCount)) * 100)}%)</span>
        </div>

        <div className="summary-stat-col">
          <span className="summary-stat-label">REQUESTED</span>
          <div className="summary-stat-val-row">
            <span className="summary-stat-num text-amber">{counts.requested}</span>
            <span className="summary-stat-tag tag-amber">QUEUED</span>
          </div>
          <span className="summary-stat-sub">Awaiting Funding</span>
        </div>

        <div className="summary-stat-col">
          <span className="summary-stat-label">FUNDED</span>
          <div className="summary-stat-val-row">
            <span className="summary-stat-num text-blue">{counts.funded}</span>
            <span className="summary-stat-tag tag-blue">ACCRUING</span>
          </div>
          <span className="summary-stat-sub">Active Escrow Locked</span>
        </div>

        <div className="summary-stat-col">
          <span className="summary-stat-label">REPAID</span>
          <div className="summary-stat-val-row">
            <span className="summary-stat-num text-muted">{counts.repaid}</span>
            <span className="summary-stat-tag">CLEARED</span>
          </div>
          <span className="summary-stat-sub">Obligations Cleared</span>
        </div>

        <div className="summary-stat-col">
          <span className="summary-stat-label">SETTLED</span>
          <div className="summary-stat-val-row">
            <span className="summary-stat-num text-success">{counts.settled}</span>
            <span className="summary-stat-tag tag-success">FINAL</span>
          </div>
          <span className="summary-stat-sub">Terminal State</span>
        </div>
      </section>

      {/* 3. ORDER BOOK (CENTERPIECE) */}
      <section className="marketplace-orderbook-section">
        <LoanMarketplace
          loansMap={loansMap}
          selectedLoanId={selectedLoanId}
          onSelectLoan={handleSelectAndInspect}
        />
      </section>

      {/* 4. PRIVACY ASSURANCE & PROTOCOL INTEGRITY (58% / 42%) */}
      <section className="marketplace-assurance-section">
        <div className="assurance-card-left">
          <div className="assurance-kicker font-mono">CRYPTOGRAPHIC ASSURANCE</div>
          <h3 className="assurance-heading">Market Integrity & Zero-Knowledge Underwriting</h3>
          <p className="assurance-lead">
            Every lending opportunity published to this order book evaluates counterparty eligibility through client-side zero-knowledge witnesses. Borrowers prove regulatory compliance and debt thresholds directly to the Midnight network without broadcasting private balances, identity documents, or historical counterparty links.
          </p>
          <div className="assurance-features font-mono">
            <div className="assurance-feature-item">
              <span className="feature-check">✓</span>
              <span>Client-Side ZK Proof Generation</span>
            </div>
            <div className="assurance-feature-item">
              <span className="feature-check">✓</span>
              <span>Zero Counterparty Data Leakage</span>
            </div>
            <div className="assurance-feature-item">
              <span className="feature-check">✓</span>
              <span>Deterministic Compact Ledger Escrow</span>
            </div>
          </div>
        </div>

        <div className="assurance-card-right font-mono">
          <div className="privacy-assurance-header">
            <span className="privacy-assurance-title">MARKET PRIVACY</span>
            <span className="status-enclave-indicator">
              <span className="status-dot-sm dot-success" />
              <span>SHIELDED ENCLAVE</span>
            </span>
          </div>

          <div className="privacy-assurance-body">
            <div className="privacy-assurance-row">
              <span className="privacy-key">CIRCUITS</span>
              <span className="privacy-val">6 Compact Verifiers</span>
            </div>
            <div className="privacy-assurance-row">
              <span className="privacy-key">PROOFS</span>
              <span className="privacy-val text-accent">Client ZK</span>
            </div>
            <div className="privacy-assurance-row">
              <span className="privacy-key">SETTLEMENT</span>
              <span className="privacy-val">Atomic Escrow</span>
            </div>
            <div className="privacy-assurance-row">
              <span className="privacy-key">STATE PROOFS</span>
              <span className="privacy-val text-success">Verified On-Chain</span>
            </div>
          </div>

          <div className="privacy-assurance-footer">
            <span className="privacy-badge">100% PRIVATE CREDIT INFRASTRUCTURE</span>
          </div>
        </div>
      </section>
    </div>
  );
};

export default MarketplacePage;
