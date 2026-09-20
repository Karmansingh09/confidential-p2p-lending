import React, { useState } from 'react';
import type { LoanDetailsModel } from '../types/index.ts';
import {
  type LifecycleFilter,
  type SortOption,
  queryMarketplace,
  getLifecycleCounts,
  isVerifiedLoan,
} from '../lib/marketplace.ts';
import {
  formatAmount,
  formatBasisPoints,
  formatDuration,
} from '../lib/formatters.ts';
import { LoanStatusBadge } from './LoanStatusBadge.tsx';

interface LoanMarketplaceProps {
  loansMap: Record<string, LoanDetailsModel>;
  selectedLoanId: string;
  onSelectLoan: (loanId: string) => void;
}

export const LoanMarketplace: React.FC<LoanMarketplaceProps> = ({
  loansMap,
  selectedLoanId,
  onSelectLoan,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<LifecycleFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('amount-asc');

  const counts = getLifecycleCounts(loansMap);
  const items = queryMarketplace(loansMap, searchQuery, filter, sortOption);

  const filterOptions: { key: LifecycleFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'requested', label: 'Requested' },
    { key: 'verified', label: 'Verified' },
    { key: 'funded', label: 'Funded' },
    { key: 'repaid', label: 'Repaid' },
    { key: 'settled', label: 'Settled' },
  ];

  return (
    <div className="active-lending-workspace" aria-label="Loan Marketplace">
      <div className="active-lending-header">
        <div className="active-lending-title-group">
          <h2>ORDER BOOK</h2>
          <span className="active-lending-count font-mono">{items.length} OPPORTUNITIES</span>
        </div>

        <div className="editorial-text-tabs" role="tablist">
          {filterOptions.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`editorial-tab-btn font-mono ${filter === opt.key ? 'active' : ''}`}
              onClick={() => setFilter(opt.key)}
              role="tab"
            >
              {opt.label.toUpperCase()} ({counts[opt.key]})
            </button>
          ))}
        </div>
      </div>

      <div className="marketplace-controls" style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center' }}>
        <div className="search-box" style={{ flex: 1, maxWidth: '400px' }}>
          <input
            type="text"
            className="search-input"
            placeholder="Search by Loan ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search loans"
            style={{
              width: '100%',
              height: '38px',
              backgroundColor: 'rgba(13, 17, 26, 0.5)',
              border: '1px solid rgba(159, 184, 216, 0.12)',
              borderRadius: '4px',
              padding: '0 14px',
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontFamily: 'var(--font-mono)',
            }}
          />
        </div>

        <div className="sort-box" style={{ width: '240px' }}>
          <select
            className="sort-select"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SortOption)}
            style={{
              width: '100%',
              height: '38px',
              backgroundColor: 'rgba(13, 17, 26, 0.5)',
              border: '1px solid rgba(159, 184, 216, 0.12)',
              borderRadius: '4px',
              padding: '0 12px',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <option value="amount-asc">Principal: Low → High</option>
            <option value="amount-desc">Principal: High → Low</option>
            <option value="rate-asc">Interest: Low → High</option>
            <option value="rate-desc">Interest: High → Low</option>
            <option value="duration-asc">Duration: Short → Long</option>
            <option value="duration-desc">Duration: Long → Short</option>
          </select>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="table-empty">
          <p>No loan opportunities match the selected criteria.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="editorial-agreements-table">
            <thead>
              <tr>
                <th>Loan ID</th>
                <th>Principal</th>
                <th>Interest Rate</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Privacy / ZK Attestation</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map(({ id, loan }) => {
                const isSelected = id === selectedLoanId;
                const verified = isVerifiedLoan(loan);

                return (
                  <tr
                    key={id}
                    className={`editorial-agreement-row ${isSelected ? 'row-selected' : ''}`}
                    onClick={() => onSelectLoan(id)}
                  >
                    <td>
                      <span className="agreement-id">{id}</span>
                    </td>
                    <td>
                      <span className="agreement-principal">{loan.amount.toLocaleString()}</span>
                      <span className="agreement-unit">UNITS</span>
                    </td>
                    <td>
                      <span className="font-mono text-accent font-semibold">{formatBasisPoints(loan.interestRateBasisPoints)}</span>{' '}
                      <span className="text-muted text-xs font-mono">({loan.interestRateBasisPoints.toString()} bps)</span>
                    </td>
                    <td>
                      <span className="font-mono text-sm">{formatDuration(loan.durationBlocks)}</span>
                    </td>
                    <td>
                      <LoanStatusBadge statusText={loan.statusText} />
                    </td>
                    <td>
                      <span className={`underwriting-attestation-tag font-mono ${verified ? 'attested' : 'unverified'}`}>
                        {verified ? (
                          <>
                            <span className="attest-mark">✓</span> ZK PROVEN
                          </>
                        ) : (
                          <>
                            <span className="unverified-mark">—</span> PROOF PENDING
                          </>
                        )}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="action-link font-mono">
                        {isSelected ? 'Selected' : 'Inspect →'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LoanMarketplace;
