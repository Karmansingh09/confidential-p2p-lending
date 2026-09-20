import type { LoanDetailsModel, LoanStatus, LoanStatusText } from './index.ts';

export type FundingReadinessStatus =
  | 'READY_TO_FUND'
  | 'ELIGIBILITY_NOT_VERIFIED'
  | 'LOAN_ALREADY_FUNDED'
  | 'LOAN_NOT_AVAILABLE'
  | 'BORROWER_CANNOT_FUND_OWN_LOAN'
  | 'AGREEMENT_CONCLUDED';

export interface PublicAgreementTerms {
  loanId: string;
  borrower: string;
  lender: string | null;
  amount: bigint;
  interestRateBasisPoints: bigint;
  durationBlocks: bigint;
  eligibilityThreshold: bigint;
  isEligibilityVerified: boolean;
  status: LoanStatus;
  statusText: LoanStatusText;
  totalRepaymentObligation: bigint;
  expectedInterest: bigint;
}

export type LenderDecisionState =
  | 'INSPECTING'
  | 'REVIEWING'
  | 'CONFIRMING'
  | 'FUNDED';

export interface FundingReadiness {
  status: FundingReadinessStatus;
  canFund: boolean;
  title: string;
  description: string;
  badgeType: 'success' | 'warning' | 'error' | 'info';
}

export interface EvaluationWarning {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface PrivacyAttestation {
  isVerifiedWithoutPrivateDisclosure: boolean;
  statement: string;
  notice: string;
}

export interface LenderLoanEvaluation {
  loanId: string;
  terms: PublicAgreementTerms;
  readiness: FundingReadiness;
  warnings: EvaluationWarning[];
  expectedInterest: bigint;
  expectedTotalReturn: bigint;
  privacyAttestation: PrivacyAttestation;
}

export interface FundingExecutionResult {
  success: boolean;
  loanId: string;
  previousStatus: string;
  newStatus: string;
  lender: string;
  amount: bigint;
  expectedRepayment: bigint;
  expectedInterest: bigint;
  assetTransferStatus: string;
  disclaimer: string;
  timestamp: number;
}
