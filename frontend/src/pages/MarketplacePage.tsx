import React from 'react';
import type { LoanDetailsModel } from '../types/index.ts';
import { LoanMarketplace } from '../components/LoanMarketplace.tsx';
import type { NavigationTab } from '../types/navigation.ts';
import { AnimatedNumber } from '../components/common/AnimatedNumber.tsx';

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
  const avgBps = totalCount > 0
    ? Math.round(Number(loans.reduce((acc, l) => acc + l.interestRateBasisPoints, 0n)) / totalCount)
    : 0;

  return (
    <div className="overview-page marketplace-page">
      {/* 1. Marketplace Introduction */}
      <section className="overview-intro">
        <div className="overview-intro-left">
          <div className="overview-kicker font-mono">
            <span>MIDNIGHT NETWORK</span>
            <span className="kicker-sep">//</span>
            <span>CAPITAL ALLOCATION ORDER BOOK</span>
          </div>
          <h1 className="overview-headline">Lending Marketplace</h1>
          <p className="overview-lead">
            Auditable micro-lending order book. Evaluate borrower zero-knowledge eligibility attestations and deploy capital with deterministic settlement guarantees.
          </p>
        </div>

        <div className="overview-intro-right">
          <div className="overview-protocol-meta font-mono">
            <div className="meta-item">
              <span className="meta-label">ORDER BOOK</span>
              <span className="meta-val text-accent">ACTIVE</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">ATTESTATION</span>
              <span className="meta-val">ZK PROOFS</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">CONFIDENTIALITY</span>
              <span className="meta-val text-accent">100% SHIELDED</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">SETTLEMENT</span>
              <span className="meta-val">COMPACT LEDGER</span>
            </div>
          </div>
          <div className="intro-actions-row">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onNavigate('create-loan')}
            >
              + Propose Loan
            </button>
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

      {/* 2. Dominant Market Volume & Protocol State */}
      <section className="overview-state-section">
        <div className="primary-desk-state">
          <div className="primary-number-wrap">
            <span className="primary-number">
              <AnimatedNumber value={totalVolume} />
            </span>
            <span className="primary-number-label font-mono">
              ACTIVE MARKETPLACE VOLUME (MICRO-UNITS)
            </span>
          </div>

          <div className="portfolio-breakdown font-mono">
            <span><strong>{totalCount}</strong> opportunities</span>
            <span className="breakdown-sep">/</span>
            <span><strong>{verifiedCount}</strong> ZK verified ({Math.round((verifiedCount / Math.max(1, totalCount)) * 100)}%)</span>
            <span className="breakdown-sep">/</span>
            <span><strong>{avgBps}</strong> bps avg rate ({(avgBps / 100).toFixed(2)}% APR)</span>
            <span className="breakdown-sep">/</span>
            <span><strong>100%</strong> shielded records</span>
          </div>
        </div>

        <div className="protocol-state-module font-mono">
          <div className="proto-module-header">
            <span>MARKET STATE</span>
            <span className="proto-status-indicator">
              <span className="status-dot-sm dot-success" />
              <span>ACTIVE BOOK</span>
            </span>
          </div>
          <div className="proto-module-body">
            <div className="proto-row">
              <span className="proto-label">LIQUIDITY</span>
              <span className="proto-val">PEER-TO-PEER</span>
            </div>
            <div className="proto-row">
              <span className="proto-label">UNDERWRITING</span>
              <span className="proto-val text-accent">ZERO-KNOWLEDGE</span>
            </div>
            <div className="proto-row">
              <span className="proto-label">SETTLEMENT</span>
              <span className="proto-val">ON-CHAIN ATOMIC</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Marketplace Order Book */}
      <div className="marketplace-content-wrapper">
        <LoanMarketplace
          loansMap={loansMap}
          selectedLoanId={selectedLoanId}
          onSelectLoan={handleSelectAndInspect}
        />
      </div>
    </div>
  );
};

export default MarketplacePage;
