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
  formatBasisPoints,
  formatDuration,
} from '../lib/formatters.ts';

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
    <div className="orderbook-container" aria-label="Private Credit Order Book">
      {/* 1. ORDER BOOK HEADER & FILTER TABS */}
      <div className="orderbook-header">
        <div className="orderbook-title-group">
          <h2 className="orderbook-title">ORDER BOOK</h2>
          <span className="orderbook-count-badge font-mono">{items.length} OPPORTUNITIES</span>
        </div>

        <div className="orderbook-filter-tabs font-mono" role="tablist" aria-label="Order Book Lifecycle Filters">
          {filterOptions.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`orderbook-tab-btn ${filter === opt.key ? 'active' : ''}`}
              onClick={() => setFilter(opt.key)}
              role="tab"
              aria-selected={filter === opt.key}
            >
              {opt.label.toUpperCase()} ({counts[opt.key]})
            </button>
          ))}
        </div>
      </div>

      {/* 2. SEARCH & SORT TOOLBAR */}
      <div className="orderbook-toolbar">
        <div className="orderbook-search-wrap">
          <svg className="orderbook-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="orderbook-search-input font-mono"
            placeholder="Search by Loan ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search loans by ID"
          />
          {searchQuery && (
            <button
              type="button"
              className="orderbook-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              &times;
            </button>
          )}
        </div>

        <div className="orderbook-sort-wrap">
          <label htmlFor="orderbook-sort-select" className="orderbook-sort-label font-mono">SORT:</label>
          <div className="orderbook-select-wrapper">
            <select
              id="orderbook-sort-select"
              className="orderbook-sort-select font-mono"
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              aria-label="Sort order book items"
            >
              <option value="amount-asc">Principal: Low → High</option>
              <option value="amount-desc">Principal: High → Low</option>
              <option value="rate-asc">Interest: Low → High</option>
              <option value="rate-desc">Interest: High → Low</option>
              <option value="duration-asc">Duration: Short → Long</option>
              <option value="duration-desc">Duration: Long → Short</option>
            </select>
            <span className="orderbook-select-arrow" aria-hidden="true">▾</span>
          </div>
        </div>
      </div>

      {/* 3. ORDER BOOK TABLE */}
      {items.length === 0 ? (
        <div className="orderbook-empty-state">
          <div className="empty-icon-wrap">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <h3 className="empty-title">NO MATCHING OPPORTUNITIES</h3>
          <p className="empty-desc">
            No active loan opportunities match your filter or search criteria. Try adjusting your search query or reset the filter.
          </p>
          {(searchQuery || filter !== 'all') && (
            <button
              type="button"
              className="btn-empty-reset font-mono"
              onClick={() => {
                setSearchQuery('');
                setFilter('all');
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="orderbook-table-container">
          <table className="orderbook-table">
            <thead>
              <tr>
                <th style={{ width: '14%' }}>LOAN ID</th>
                <th style={{ width: '15%' }}>PRINCIPAL</th>
                <th style={{ width: '15%' }}>INTEREST RATE</th>
                <th style={{ width: '14%' }}>DURATION</th>
                <th style={{ width: '16%' }}>STATUS</th>
                <th style={{ width: '18%' }}>PRIVACY / ZK ATTESTATION</th>
                <th style={{ width: '8%', textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {items.map(({ id, loan }) => {
                const isSelected = id === selectedLoanId;
                const verified = isVerifiedLoan(loan);

                return (
                  <tr
                    key={id}
                    className={`orderbook-row ${isSelected ? 'row-selected' : ''}`}
                    onClick={() => onSelectLoan(id)}
                  >
                    <td>
                      <span className="orderbook-loan-id font-mono">{id}</span>
                    </td>
                    <td>
                      <span className="orderbook-principal-val">{loan.amount.toLocaleString()}</span>
                      <span className="orderbook-unit-tag font-mono">UNITS</span>
                    </td>
                    <td>
                      <span className="orderbook-rate-val font-mono">{formatBasisPoints(loan.interestRateBasisPoints)}</span>{' '}
                      <span className="orderbook-bps-sub font-mono">({loan.interestRateBasisPoints.toString()} bps)</span>
                    </td>
                    <td>
                      <span className="orderbook-duration-val font-mono">{formatDuration(loan.durationBlocks)}</span>
                    </td>
                    <td>
                      <span className={`orderbook-status-pill status-${loan.statusText.toLowerCase()}`}>
                        <span className={`orderbook-status-dot dot-${loan.statusText.toLowerCase()}`} />
                        <span>{loan.statusText}</span>
                      </span>
                    </td>
                    <td>
                      <span className={`orderbook-zk-badge font-mono ${verified ? 'zk-proven' : 'zk-pending'}`}>
                        {verified ? (
                          <>
                            <span className="zk-icon-proven">✓</span> ZK PROVEN
                          </>
                        ) : (
                          <>
                            <span className="zk-icon-pending">—</span> PROOF PENDING
                          </>
                        )}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="orderbook-action-btn font-mono">
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
