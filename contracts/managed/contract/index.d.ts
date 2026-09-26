import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export enum LoanStatus { requested = 0, funded = 1, repaid = 2, settled = 3 }

export type LoanDetails = { borrower: Uint8Array;
                            lender: { is_some: boolean, value: Uint8Array };
                            amount: bigint;
                            interestRateBasisPoints: bigint;
                            durationBlocks: bigint;
                            status: LoanStatus;
                            eligibilityThreshold: bigint;
                            isEligibilityVerified: boolean
                          };

export type Witnesses<PS> = {
  getPrivateFinancialValue(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
}

export type ImpureCircuits<PS> = {
  verifyEligibility(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  fundLoan(context: __compactRuntime.CircuitContext<PS>, lenderPk_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  repayLoan(context: __compactRuntime.CircuitContext<PS>,
            repaymentAmount_0: bigint): __compactRuntime.CircuitResults<PS, bigint>;
  settleLoan(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  getLoanStatus(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, LoanStatus>;
  getLoanDetails(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, LoanDetails>;
}

export type ProvableCircuits<PS> = {
  verifyEligibility(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  fundLoan(context: __compactRuntime.CircuitContext<PS>, lenderPk_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  repayLoan(context: __compactRuntime.CircuitContext<PS>,
            repaymentAmount_0: bigint): __compactRuntime.CircuitResults<PS, bigint>;
  settleLoan(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  getLoanStatus(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, LoanStatus>;
  getLoanDetails(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, LoanDetails>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  verifyEligibility(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  fundLoan(context: __compactRuntime.CircuitContext<PS>, lenderPk_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  repayLoan(context: __compactRuntime.CircuitContext<PS>,
            repaymentAmount_0: bigint): __compactRuntime.CircuitResults<PS, bigint>;
  settleLoan(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  getLoanStatus(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, LoanStatus>;
  getLoanDetails(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, LoanDetails>;
}

export type Ledger = {
  readonly borrower: Uint8Array;
  readonly lender: { is_some: boolean, value: Uint8Array };
  readonly amount: bigint;
  readonly interestRateBasisPoints: bigint;
  readonly durationBlocks: bigint;
  readonly status: LoanStatus;
  readonly eligibilityThreshold: bigint;
  readonly isEligibilityVerified: boolean;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>,
               borrowerPk_0: Uint8Array,
               principalAmount_0: bigint,
               interestRate_0: bigint,
               termBlocks_0: bigint,
               minThreshold_0: bigint): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
