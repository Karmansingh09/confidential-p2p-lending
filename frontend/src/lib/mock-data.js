import { LoanStatus } from '../types/index.js';
const borrowerPk1 = new Uint8Array(32).fill(1);
const borrowerPk2 = new Uint8Array(32).fill(2);
const lenderPk1 = new Uint8Array(32).fill(10);
const lenderPk2 = new Uint8Array(32).fill(20);
function bytesToHex(bytes) {
    return '0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}
/**
 * Public mock loans demonstrating each step of the 5-phase protocol lifecycle.
 * STRICT PRIVACY ASSURANCE: Contains ONLY public discoverable terms.
 * NO confidential borrower credentials or off-chain data exist in this data model.
 */
export const MOCK_LOANS = {
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
    },
};
export const DEFAULT_LOAN_ID = 'loan-002';
