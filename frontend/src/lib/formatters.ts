import { LoanStatus, type LoanDetailsModel, type ProtocolPhase } from '../types/index.ts';

/**
 * Formats a raw bigint amount with comma grouping.
 */
export function formatAmount(amount: bigint, unit = 'MICRO-UNITS'): string {
  return `${amount.toLocaleString()} ${unit}`;
}

/**
 * Converts basis points to a formatted percentage string.
 * Example: 500n -> "5.00%"
 */
export function formatBasisPoints(bps: bigint): string {
  const percent = Number(bps) / 100;
  return `${percent.toFixed(2)}%`;
}

/**
 * Formats duration in blocks.
 */
export function formatDuration(blocks: bigint): string {
  return `${blocks.toLocaleString()} blocks`;
}

/**
 * Shortens a 66-character hex public key for clean UI presentation.
 * Example: 0x010101...0101 -> 0x0101...0101
 */
export function shortenAddress(hex: string | null): string {
  if (!hex) return 'Unassigned (Awaiting Lender)';
  if (hex.length <= 14) return hex;
  return `${hex.substring(0, 8)}...${hex.substring(hex.length - 6)}`;
}

/**
 * Maps on-chain loan state to the 5-phase protocol lifecycle.
 */
export function getLifecyclePhase(loan: LoanDetailsModel): ProtocolPhase {
  if (loan.status === LoanStatus.settled) {
    return 'SETTLED';
  }
  if (loan.status === LoanStatus.repaid) {
    return 'REPAID';
  }
  if (loan.status === LoanStatus.funded) {
    return 'FUNDED';
  }
  if (loan.isEligibilityVerified) {
    return 'ELIGIBILITY_VERIFIED';
  }
  return 'REQUESTED';
}
