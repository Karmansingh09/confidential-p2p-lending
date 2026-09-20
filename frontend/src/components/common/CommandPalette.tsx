import React, { useState, useEffect, useRef } from 'react';
import type { NavigationTab } from '../../types/navigation.ts';
import type { AccountRole } from '../../types/account.ts';
import type { LoanRegistry } from '../../lib/loan-registry.ts';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: NavigationTab) => void;
  onSwitchRole?: (role: AccountRole) => void;
  loanRegistry?: LoanRegistry;
  onSelectLoan?: (loanId: string) => void;
}

interface CommandItem {
  id: string;
  category: 'Navigation' | 'Actions' | 'Persona' | 'Agreements';
  title: string;
  subtitle?: string;
  shortcut?: string;
  onSelect: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onSwitchRole,
  loanRegistry,
  onSelectLoan,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const baseItems: CommandItem[] = [
    {
      id: 'nav-overview',
      category: 'Navigation',
      title: 'Desk Overview',
      subtitle: 'Protocol metrics, capital summary, and active loan ledger',
      shortcut: 'G O',
      onSelect: () => onNavigate('overview'),
    },
    {
      id: 'nav-marketplace',
      category: 'Navigation',
      title: 'Lending Marketplace',
      subtitle: 'Inspect available loan requests and underwriting terms',
      shortcut: 'G M',
      onSelect: () => onNavigate('marketplace'),
    },
    {
      id: 'nav-my-loans',
      category: 'Navigation',
      title: 'My Loan Positions',
      subtitle: 'Borrowing commitments and funded capital allocations',
      shortcut: 'G L',
      onSelect: () => onNavigate('my-loans'),
    },
    {
      id: 'nav-create',
      category: 'Actions',
      title: 'Create Loan Request',
      subtitle: 'Propose a new confidential micro-loan agreement',
      shortcut: 'N',
      onSelect: () => onNavigate('create-loan'),
    },
    {
      id: 'nav-transactions',
      category: 'Navigation',
      title: 'Transaction Audit Console',
      subtitle: 'Deterministic lifecycle tracking, events, and reconciliation',
      shortcut: 'G T',
      onSelect: () => onNavigate('transactions'),
    },
    {
      id: 'nav-wallet',
      category: 'Navigation',
      title: 'Wallet Provider & Readiness',
      subtitle: 'Session status, keypair identity, and signing capabilities',
      shortcut: 'G W',
      onSelect: () => onNavigate('wallet'),
    },
    {
      id: 'nav-network',
      category: 'Navigation',
      title: 'Network Infrastructure',
      subtitle: 'Midnight testnet/local connection and contract deployments',
      shortcut: 'G N',
      onSelect: () => onNavigate('network'),
    },
    {
      id: 'nav-privacy',
      category: 'Navigation',
      title: 'Contract Circuits & Privacy Architecture',
      subtitle: 'Inspect the 6 Compact circuits and zero-knowledge model',
      shortcut: 'G C',
      onSelect: () => onNavigate('contract-privacy'),
    },
    {
      id: 'persona-borrower',
      category: 'Persona',
      title: 'Switch to Borrower Persona',
      subtitle: 'Prototype account authorized to request, verify, and repay loans',
      onSelect: () => onSwitchRole?.('BORROWER'),
    },
    {
      id: 'persona-lender',
      category: 'Persona',
      title: 'Switch to Lender Persona',
      subtitle: 'Prototype account authorized to evaluate, fund, and settle loans',
      onSelect: () => onSwitchRole?.('LENDER'),
    },
    {
      id: 'persona-participant',
      category: 'Persona',
      title: 'Switch to Observer / Participant',
      subtitle: 'Read-only observer role without operational signing privileges',
      onSelect: () => onSwitchRole?.('PARTICIPANT'),
    },
  ];

  // Dynamic loan items
  const loanItems: CommandItem[] = [];
  if (loanRegistry) {
    const loans = loanRegistry.getLoans();
    for (const [id, loan] of Object.entries(loans)) {
      loanItems.push({
        id: `loan-${id}`,
        category: 'Agreements',
        title: `Loan ${id.toUpperCase()}`,
        subtitle: `Principal ${loan.amount.toLocaleString()} | Status: ${(loan.statusText || 'REQUESTED').toUpperCase()} | Verified: ${loan.isEligibilityVerified ? 'Yes' : 'No'}`,
        onSelect: () => {
          onSelectLoan?.(id);
          onNavigate('loan-details');
        },
      });
    }
  }

  const allItems = [...baseItems, ...loanItems];
  const filtered = query.trim()
    ? allItems.filter((it) => {
        const text = `${it.title} ${it.subtitle || ''} ${it.category}`.toLowerCase();
        return text.includes(query.toLowerCase());
      })
    : allItems;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filtered[selectedIndex];
      if (selected) {
        selected.onSelect();
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="cmd-palette-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="cmd-palette-modal" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="cmd-palette-input-wrap">
          <svg className="cmd-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="cmd-palette-input"
            placeholder="Type a command or jump to page... (Esc to close)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
          <span className="cmd-kbd-badge">ESC</span>
        </div>

        <div className="cmd-palette-list">
          {filtered.length === 0 ? (
            <div className="cmd-palette-empty">No matching commands or agreements found.</div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  className={`cmd-palette-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    item.onSelect();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className="cmd-item-main">
                    <span className="cmd-item-category">{item.category}</span>
                    <span className="cmd-item-title">{item.title}</span>
                    {item.subtitle && <span className="cmd-item-subtitle">{item.subtitle}</span>}
                  </div>
                  {item.shortcut && <span className="cmd-item-shortcut">{item.shortcut}</span>}
                </div>
              );
            })
          )}
        </div>

        <div className="cmd-palette-footer">
          <span>&uarr;&darr; to navigate</span>
          <span>&crarr; to select</span>
          <span>esc to dismiss</span>
        </div>
      </div>
    </div>
  );
};
