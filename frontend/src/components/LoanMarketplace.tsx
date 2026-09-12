import React, { useState } from 'react';
import type { LoanDetailsModel } from '../types/index.js';
import {
  type LifecycleFilter,
  type SortOption,
  queryMarketplace,
  getLifecycleCounts,
  isVerifiedLoan,
} from '../lib/marketplace.js';
import {
  formatAmount,
  formatBasisPoints,
  formatDuration,
  shortenAddress,
} from '../lib/formatters.js';
import { LoanStatusBadge } from './LoanStatusBadge.js';

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

  const handleResetFilters = () => {
    setSearchQuery('');
    setFilter('all');
  };

  return (
    <section className="marketplace-section" aria-label="Loan Marketplace">
      <div className="marketplace-header">
        <div>
          <h3>Public Loan Marketplace</h3>
          <p className="marketplace-sub">
            Discover, filter, and inspect confidential micro-lending agreements using transparent on-chain terms.
          </p>
        </div>
        <div className="marketplace-stats-badge">
          <span>{items.length} of {Object.keys(loansMap).length} Agreements</span>
        </div>
      </div>

      <div className="marketplace-controls">
        <div className="search-box">
          <input
            type="text"
            className="search-input"
            placeholder="Search by Loan ID, Borrower, or Lender key..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search loans"
          />
          {searchQuery && (
            <button
              type="button"
              className="btn-clear-search"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              &times;
            </button>
          )}
        </div>

        <div className="sort-box">
          <label htmlFor="sort-select" className="sort-label">
            Sort by:
          </label>
          <select
            id="sort-select"
            className="sort-select"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SortOption)}
          >
            <option value="amount-asc">Principal: Low → High</option>
            <option value="amount-desc">Principal: High → Low</option>
            <option value="rate-asc">Interest Rate: Low → High</option>
            <option value="rate-desc">Interest Rate: High → Low</option>
            <option value="duration-asc">Duration: Short → Long</option>
            <option value="duration-desc">Duration: Long → Short</option>
          </select>
        </div>
      </div>

      <div className="lifecycle-filters-bar" role="tablist" aria-label="Filter by lifecycle status">
        {filterOptions.map((opt) => (
          <button
            key={opt.key}
            type="button"
            className={`filter-tab ${filter === opt.key ? 'active' : ''}`}
            onClick={() => setFilter(opt.key)}
            role="tab"
            aria-selected={filter === opt.key}
          >
            <span className="tab-label">{opt.label}</span>
            <span className="tab-count">{counts[opt.key]}</span>
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="marketplace-empty-state">
          <div className="empty-icon">🔍</div>
          <h4>No Loan Agreements Match Criteria</h4>
          <p>
            {searchQuery
              ? `No agreements found matching "${searchQuery}" in ${filter === 'all' ? 'any category' : filter + ' category'}.`
              : `No agreements found in the "${filter}" lifecycle stage.`}
          </p>
          <button
            type="button"
            className="btn-reset-filters"
            onClick={handleResetFilters}
          >
            Reset Search & Filters
          </button>
        </div>
      ) : (
        <div className="marketplace-table-wrapper">
          <table className="marketplace-table">
            <thead>
              <tr>
                <th>Loan ID</th>
                <th>Principal</th>
                <th>Interest Rate</th>
                <th>Duration</th>
                <th>Borrower</th>
                <th>Lender</th>
                <th>Status / Attestation</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map(({ id, loan }) => {
                const isSelected = id === selectedLoanId;
                const verified = isVerifiedLoan(loan);

                return (
                  <tr
                    key={id}
                    className={`marketplace-row ${isSelected ? 'row-selected' : ''}`}
                    onClick={() => onSelectLoan(id)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectLoan(id);
                      }
                    }}
                  >
                    <td className="cell-id">
                      <span className="id-code">{id}</span>
                    </td>
                    <td className="cell-amount">
                      <strong>{formatAmount(loan.amount)}</strong>
                    </td>
                    <td className="cell-rate">
                      <span>{formatBasisPoints(loan.interestRateBasisPoints)}</span>
                      <small className="bps-subtext">({loan.interestRateBasisPoints.toString()} bps)</small>
                    </td>
                    <td className="cell-duration">
                      {formatDuration(loan.durationBlocks)}
                    </td>
                    <td className="cell-address">
                      <code title={loan.borrower}>{shortenAddress(loan.borrower)}</code>
                    </td>
                    <td className="cell-address">
                      <code title={loan.lender ?? undefined}>{shortenAddress(loan.lender)}</code>
                    </td>
                    <td className="cell-status">
                      <div className="status-cell-wrapper">
                        <LoanStatusBadge statusText={loan.statusText} />
                        {verified && (
                          <span className="badge-verified-attestation" title="Zero-knowledge eligibility verified on-chain">
                            ZK Verified
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="cell-actions">
                      <button
                        type="button"
                        className={`btn-select-loan ${isSelected ? 'selected' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectLoan(id);
                        }}
                      >
                        {isSelected ? 'Active' : 'Inspect'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
