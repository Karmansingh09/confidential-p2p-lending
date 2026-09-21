import { LoanStatus, type LoanDetailsModel } from '../types/index.ts';

const borrowerPk1 = new Uint8Array(32).fill(1);
const borrowerPk2 = new Uint8Array(32).fill(2);
const borrowerPk3 = new Uint8Array(32).fill(3);
const lenderPk1 = new Uint8Array(32).fill(10);
const lenderPk2 = new Uint8Array(32).fill(20);

function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Public mock loans demonstrating each step of the 5-phase protocol lifecycle.
 * STRICT PRIVACY ASSURANCE: Contains ONLY public discoverable terms.
 * NO confidential borrower credentials or off-chain data exist in this data model.
 */
export const MOCK_LOANS: Record<string, LoanDetailsModel> = {
  // Phase 1: Newly requested, unverified
  'loan-001': {
    borrower: bytesToHex(borrowerPk1),
    borrowerBytes: borrowerPk1,
    lender: null,
    lenderBytes: null,
    amount: 15000n,
    interestRateBasisPoints: 500n, // 5.00%
    durationBlocks: 100n,
    status: LoanStatus.requested,
    statusText: 'requested',
    eligibilityThreshold: 30000n,
    isEligibilityVerified: false,
    isConfirmedOnChain: false,
  },

  // Phase 2: ZK Eligibility verified, awaiting lender capital
  'loan-002': {
    borrower: bytesToHex(borrowerPk1),
    borrowerBytes: borrowerPk1,
    lender: null,
    lenderBytes: null,
    amount: 25000n,
    interestRateBasisPoints: 750n, // 7.50%
    durationBlocks: 250n,
    status: LoanStatus.requested,
    statusText: 'requested',
    eligibilityThreshold: 40000n,
    isEligibilityVerified: true,
    isConfirmedOnChain: false,
  },

  // Phase 3: Funded by lender, awaiting borrower repayment
  'loan-003': {
    borrower: bytesToHex(borrowerPk2),
    borrowerBytes: borrowerPk2,
    lender: bytesToHex(lenderPk1),
    lenderBytes: lenderPk1,
    amount: 50000n,
    interestRateBasisPoints: 600n, // 6.00%
    durationBlocks: 500n,
    status: LoanStatus.funded,
    statusText: 'funded',
    eligibilityThreshold: 60000n,
    isEligibilityVerified: true,
    isConfirmedOnChain: false,
  },

  // Phase 4: Repaid by borrower (principal + interest satisfied), awaiting settlement
  'loan-004': {
    borrower: bytesToHex(borrowerPk1),
    borrowerBytes: borrowerPk1,
    lender: bytesToHex(lenderPk2),
    lenderBytes: lenderPk2,
    amount: 20000n,
    interestRateBasisPoints: 800n, // 8.00%
    durationBlocks: 300n,
    status: LoanStatus.repaid,
    statusText: 'repaid',
    eligibilityThreshold: 35000n,
    isEligibilityVerified: true,
    isConfirmedOnChain: false,
  },

  // Phase 5: Concluded and settled
  'loan-005': {
    borrower: bytesToHex(borrowerPk2),
    borrowerBytes: borrowerPk2,
    lender: bytesToHex(lenderPk1),
    lenderBytes: lenderPk1,
    amount: 10000n,
    interestRateBasisPoints: 400n, // 4.00%
    durationBlocks: 150n,
    status: LoanStatus.settled,
    statusText: 'settled',
    eligibilityThreshold: 25000n,
    isEligibilityVerified: true,
    isConfirmedOnChain: false,
  },

  // Additional realistic loans for marketplace discovery and filtering:
  // Phase 1: High-value unverified loan request
  'loan-006': {
    borrower: bytesToHex(borrowerPk3),
    borrowerBytes: borrowerPk3,
    lender: null,
    lenderBytes: null,
    amount: 35000n,
    interestRateBasisPoints: 650n, // 6.50%
    durationBlocks: 180n,
    status: LoanStatus.requested,
    statusText: 'requested',
    eligibilityThreshold: 45000n,
    isEligibilityVerified: false,
    isConfirmedOnChain: false,
  },

  // Phase 2: Verified loan request ready for funding
  'loan-007': {
    borrower: bytesToHex(borrowerPk2),
    borrowerBytes: borrowerPk2,
    lender: null,
    lenderBytes: null,
    amount: 40000n,
    interestRateBasisPoints: 550n, // 5.50%
    durationBlocks: 360n,
    status: LoanStatus.requested,
    statusText: 'requested',
    eligibilityThreshold: 50000n,
    isEligibilityVerified: true,
    isConfirmedOnChain: false,
  },

  // Phase 3: Active funded loan
  'loan-008': {
    borrower: bytesToHex(borrowerPk3),
    borrowerBytes: borrowerPk3,
    lender: bytesToHex(lenderPk2),
    lenderBytes: lenderPk2,
    amount: 12000n,
    interestRateBasisPoints: 900n, // 9.00%
    durationBlocks: 120n,
    status: LoanStatus.funded,
    statusText: 'funded',
    eligibilityThreshold: 20000n,
    isEligibilityVerified: true,
    isConfirmedOnChain: false,
  },

  // Phase 4: Repaid loan awaiting settlement
  'loan-009': {
    borrower: bytesToHex(borrowerPk3),
    borrowerBytes: borrowerPk3,
    lender: bytesToHex(lenderPk1),
    lenderBytes: lenderPk1,
    amount: 28000n,
    interestRateBasisPoints: 450n, // 4.50%
    durationBlocks: 200n,
    status: LoanStatus.repaid,
    statusText: 'repaid',
    eligibilityThreshold: 35000n,
    isEligibilityVerified: true,
    isConfirmedOnChain: false,
  },

  // Phase 5: Another terminal settled agreement
  'loan-010': {
    borrower: bytesToHex(borrowerPk1),
    borrowerBytes: borrowerPk1,
    lender: bytesToHex(lenderPk2),
    lenderBytes: lenderPk2,
    amount: 60000n,
    interestRateBasisPoints: 500n, // 5.00%
    durationBlocks: 400n,
    status: LoanStatus.settled,
    statusText: 'settled',
    eligibilityThreshold: 70000n,
    isEligibilityVerified: true,
    isConfirmedOnChain: false,
  },
};

export const DEFAULT_LOAN_ID = 'loan-002';
