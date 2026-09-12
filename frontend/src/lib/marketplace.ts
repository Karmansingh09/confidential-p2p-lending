import { LoanStatus, type LoanDetailsModel } from '../types/index.js';
import {
  canVerifyEligibility,
  canFundLoan,
  canRepayLoan,
  canSettleLoan,
} from 'contracts';


export type LifecycleFilter =
  | 'all'
  | 'requested'
  | 'verified'
  | 'funded'
  | 'repaid'
  | 'settled';

export type SortOption =
  | 'amount-asc'
  | 'amount-desc'
  | 'rate-asc'
  | 'rate-desc'
  | 'duration-asc'
  | 'duration-desc';

export interface MarketplaceLoanItem {
  id: string;
  loan: LoanDetailsModel;
}

/**
 * Derives whether a loan is verified without creating a fake contract enum state.
 * CANONICAL RULE: The Compact contract enum has requested, funded, repaid, settled.
 * VERIFIED is derived strictly from: status === requested && isEligibilityVerified === true.
 */
export function isVerifiedLoan(loan: LoanDetailsModel): boolean {
  return loan.status === LoanStatus.requested && loan.isEligibilityVerified === true;
}

/**
 * Derives whether a loan is in the initial unverified requested state.
 */
export function isUnverifiedRequested(loan: LoanDetailsModel): boolean {
  return loan.status === LoanStatus.requested && !loan.isEligibilityVerified;
}

/**
 * Deterministic, case-insensitive search based strictly on public loan parameters:
 * - Loan ID
 * - Borrower public key
 * - Lender public key (if assigned)
 *
 * STRICT PRIVACY: Only public identifiers are searched. No private data is ever queried.
 */
export function matchesSearch(
  id: string,
  loan: LoanDetailsModel,
  searchQuery: string
): boolean {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return true;

  if (id.toLowerCase().includes(q)) return true;
  if (loan.borrower.toLowerCase().includes(q)) return true;
  if (loan.lender && loan.lender.toLowerCase().includes(q)) return true;

  return false;
}

/**
 * Evaluates whether a loan matches the selected protocol lifecycle filter.
 */
export function matchesLifecycleFilter(
  loan: LoanDetailsModel,
  filter: LifecycleFilter
): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'requested':
      return isUnverifiedRequested(loan);
    case 'verified':
      return isVerifiedLoan(loan);
    case 'funded':
      return loan.status === LoanStatus.funded;
    case 'repaid':
      return loan.status === LoanStatus.repaid;
    case 'settled':
      return loan.status === LoanStatus.settled;
    default:
      return true;
  }
}

/**
 * Deterministic sorting using integer BigInt arithmetic.
 * Floating-point arithmetic is NEVER used.
 * Ties are broken deterministically using loan ID.
 */
export function sortLoans(
  items: MarketplaceLoanItem[],
  sortOption: SortOption
): MarketplaceLoanItem[] {
  return [...items].sort((a, b) => {
    switch (sortOption) {
      case 'amount-asc':
        if (a.loan.amount !== b.loan.amount) {
          return a.loan.amount < b.loan.amount ? -1 : 1;
        }
        return a.id.localeCompare(b.id);
      case 'amount-desc':
        if (a.loan.amount !== b.loan.amount) {
          return a.loan.amount > b.loan.amount ? -1 : 1;
        }
        return a.id.localeCompare(b.id);
      case 'rate-asc':
        if (a.loan.interestRateBasisPoints !== b.loan.interestRateBasisPoints) {
          return a.loan.interestRateBasisPoints < b.loan.interestRateBasisPoints ? -1 : 1;
        }
        return a.id.localeCompare(b.id);
      case 'rate-desc':
        if (a.loan.interestRateBasisPoints !== b.loan.interestRateBasisPoints) {
          return a.loan.interestRateBasisPoints > b.loan.interestRateBasisPoints ? -1 : 1;
        }
        return a.id.localeCompare(b.id);
      case 'duration-asc':
        if (a.loan.durationBlocks !== b.loan.durationBlocks) {
          return a.loan.durationBlocks < b.loan.durationBlocks ? -1 : 1;
        }
        return a.id.localeCompare(b.id);
      case 'duration-desc':
        if (a.loan.durationBlocks !== b.loan.durationBlocks) {
          return a.loan.durationBlocks > b.loan.durationBlocks ? -1 : 1;
        }
        return a.id.localeCompare(b.id);
      default:
        return a.id.localeCompare(b.id);
    }
  });
}

/**
 * Computes counts per lifecycle category for filter badges.
 */
export function getLifecycleCounts(
  loansMap: Record<string, LoanDetailsModel>
): Record<LifecycleFilter, number> {
  const counts: Record<LifecycleFilter, number> = {
    all: 0,
    requested: 0,
    verified: 0,
    funded: 0,
    repaid: 0,
    settled: 0,
  };

  for (const loan of Object.values(loansMap)) {
    counts.all += 1;
    if (isUnverifiedRequested(loan)) counts.requested += 1;
    if (isVerifiedLoan(loan)) counts.verified += 1;
    if (loan.status === LoanStatus.funded) counts.funded += 1;
    if (loan.status === LoanStatus.repaid) counts.repaid += 1;
    if (loan.status === LoanStatus.settled) counts.settled += 1;
  }

  return counts;
}

/**
 * Main query pipeline for the marketplace:
 * 1. Converts loansMap to items list
 * 2. Filters by search query
 * 3. Filters by lifecycle category
 * 4. Sorts deterministically
 */
export function queryMarketplace(
  loansMap: Record<string, LoanDetailsModel>,
  searchQuery: string,
  filter: LifecycleFilter,
  sortOption: SortOption
): MarketplaceLoanItem[] {
  const items: MarketplaceLoanItem[] = Object.entries(loansMap).map(([id, loan]) => ({
    id,
    loan,
  }));

  const filtered = items.filter(
    (item) =>
      matchesSearch(item.id, item.loan, searchQuery) &&
      matchesLifecycleFilter(item.loan, filter)
  );

  return sortLoans(filtered, sortOption);
}

export interface LifecycleActionDescriptor {
  canExecute: boolean;
  title: string;
  role: string;
  description: string;
  buttonText: string;
  actionType: 'verify' | 'fund' | 'repay' | 'settle' | 'none';
  notice: string;
}

/**
 * Derives available protocol actions using canonical contract lifecycle guards.
 * Does NOT duplicate contract state transition logic.
 *
 * NOTE: Application is in Local Mock Mode. Actions are prototype demonstrations
 * and do not claim that real blockchain transactions or wallet signatures occurred.
 */
export function getLifecycleActionDescriptor(
  loan: LoanDetailsModel
): LifecycleActionDescriptor {
  // 1. Check eligibility verification
  const verifyGuard = canVerifyEligibility(loan);
  if (verifyGuard.canExecute) {
    return {
      canExecute: true,
      role: 'Borrower Action',
      title: 'Generate Confidential Eligibility Proof',
      description:
        'Executes local zero-knowledge prover to disclose that financial witness ≥ threshold without revealing secret values.',
      buttonText: 'Execute ZK Proof (Off-Chain Prototype)',
      actionType: 'verify',
      notice:
        'Eligibility verification required before funding. The private financial value stays strictly local.',
    };
  }

  // 2. Check lender funding
  const fundGuard = canFundLoan(loan);
  if (fundGuard.canExecute) {
    return {
      canExecute: true,
      role: 'Lender Action',
      title: 'Provide Loan Funding',
      description:
        'Lender commits capital to the verified loan request and transitions agreement status to funded.',
      buttonText: 'Fund Loan (Prototype Action)',
      actionType: 'fund',
      notice:
        'Loan is verified in zero-knowledge and ready for lender capital commitment.',
    };
  }

  // 3. Check borrower repayment
  const repayGuard = canRepayLoan(loan);
  if (repayGuard.canExecute) {
    return {
      canExecute: true,
      role: 'Borrower Action',
      title: 'Repay Principal & Interest Obligation',
      description:
        'Borrower satisfies total debt obligation. Contract validates Euclidean division interest calculation in ZK.',
      buttonText: 'Repay Loan (Prototype Action)',
      actionType: 'repay',
      notice: 'Awaiting borrower repayment of principal + simple interest obligation.',
    };
  }

  // 4. Check settlement
  const settleGuard = canSettleLoan(loan);
  if (settleGuard.canExecute) {
    return {
      canExecute: true,
      role: 'Borrower or Lender Action',
      title: 'Settle Loan Agreement',
      description:
        'Finalizes the loan agreement into terminal closed state. Cannot be re-opened or modified.',
      buttonText: 'Settle Loan (Prototype Action)',
      actionType: 'settle',
      notice: 'Loan has been repaid and is ready for terminal settlement closure.',
    };
  }

  // 5. Settled terminal state
  return {
    canExecute: false,
    role: 'Protocol Terminal State',
    title: 'Agreement Concluded',
    description:
      'This loan has completed its full lifecycle. All obligations were mathematically proven and finalized.',
    buttonText: 'Loan Fully Settled',
    actionType: 'none',
    notice: 'Agreement is concluded in terminal settled state. Terms are immutable.',
  };
}
