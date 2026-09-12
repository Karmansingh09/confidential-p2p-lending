import {
  createCircuitContext,
  createConstructorContext,
  dummyContractAddress,
  ContractState,
  ChargedState,
  type CircuitResults,
  type ProofData,
} from '@midnight-ntwrk/compact-runtime';
import {
  Contract,
  ledger,
  type Ledger,
  type Witnesses,
  LoanStatus,
} from '../managed/contract/index.js';

/**
 * Parameters for initializing a loan contract instance.
 */
export interface InitializeLoanParams {
  borrowerPk: Uint8Array;
  principalAmount: bigint;
  interestRateBasisPoints: bigint;
  durationBlocks: bigint;
  eligibilityThreshold: bigint;
  coinPublicKey?: Uint8Array;
  privateState?: any;
}

/**
 * Parameters for creating a loan request.
 */
export type CreateLoanRequestParams = InitializeLoanParams;

/**
 * Result of contract initialization or loan request creation.
 */
export interface InitializeLoanResult {
  contractState: ContractState;
  initialLedger: Ledger;
}

export type CreateLoanRequestResult = InitializeLoanResult;

/**
 * Parameters for executing the confidential eligibility proof.
 */
export interface ExecuteEligibilityProofParams {
  /** The current on-chain contract state */
  contractState: ContractState;
  /**
   * The borrower's private financial value (e.g. verified income or liquid balance).
   * This value is provided strictly off-chain to the witness provider and is NEVER
   * written to public ledger state, logged, or returned in the result.
   */
  privateFinancialValue: bigint;
  /** The borrower's public account key (must match contract borrower) */
  borrowerPk: Uint8Array;
  /** The contract address (defaults to a dummy address for local simulation) */
  contractAddress?: string;
  /** Initial private state for the circuit execution */
  privateState?: any;
}

/**
 * Public execution result of the eligibility proof.
 * Note: Contains NO private financial data.
 */
export interface EligibilityProofResult {
  /** Confirmation of successful eligibility verification */
  isVerified: boolean;
  /** Updated contract state ready for submission or further interaction */
  updatedContractState: ContractState;
  /** Public ledger view reflecting verified eligibility */
  updatedLedger: Ledger;
  /** The generated proof data from local circuit execution (without private witness secrets) */
  proofData: ProofData;
}

/**
 * Constructs a client-side witness provider that encapsulates the borrower's
 * private financial value. The value is accessed strictly during local prover
 * execution and never leaves the witness context.
 */
export function createEligibilityWitnessProvider(privateFinancialValue: bigint): Witnesses<any> {
  return {
    getPrivateFinancialValue: (context) => {
      // Return private state and the secret value to the local circuit prover.
      // This function executes entirely off-chain.
      return [context.privateState, privateFinancialValue];
    },
  };
}

/**
 * Initializes a new loan desk contract instance on the local runtime.
 */
export function initializeLoanContract(params: InitializeLoanParams): InitializeLoanResult {
  const callerPk = params.coinPublicKey ?? params.borrowerPk;
  const constructorContext = createConstructorContext(
    params.privateState ?? {},
    { bytes: callerPk }
  );

  // Use a null witness for deployment since constructor does not query witnesses
  const initContract = new Contract({
    getPrivateFinancialValue: (ctx) => [ctx.privateState, 0n],
  });

  const initResult = initContract.initialState(
    constructorContext,
    params.borrowerPk,
    params.principalAmount,
    params.interestRateBasisPoints,
    params.durationBlocks,
    params.eligibilityThreshold
  );

  const initialLedger = ledger(initResult.currentContractState.data);

  return {
    contractState: initResult.currentContractState,
    initialLedger,
  };
}

/**
 * Creates a valid loan request on the local runtime after verifying parameter constraints.
 * Enforces protocol bounds:
 * - principalAmount > 0
 * - durationBlocks > 0
 * - interestRateBasisPoints between 1 and 10000 (0.01% to 100.00%)
 * - eligibilityThreshold > 0
 */
export function createLoanRequest(params: CreateLoanRequestParams): CreateLoanRequestResult {
  if (params.principalAmount <= 0n) {
    throw new Error("Loan amount must be greater than zero");
  }
  if (params.durationBlocks <= 0n) {
    throw new Error("Loan duration must be greater than zero");
  }
  if (params.interestRateBasisPoints <= 0n || params.interestRateBasisPoints > 10000n) {
    throw new Error("Interest rate must be between 1 and 10000 basis points");
  }
  if (params.eligibilityThreshold <= 0n) {
    throw new Error("Eligibility threshold must be greater than zero");
  }
  return initializeLoanContract(params);
}

/**
 * Application-side function executing the private eligibility proof flow:
 *
 * Flow:
 *   private financial value
 *        ↓
 *   witness provider (client-side)
 *        ↓
 *   verifyEligibility() circuit invocation
 *        ↓
 *   local proof generation & constraint verification
 *        ↓
 *   sanitized proof/transaction result
 *
 * Security & Privacy Enforcements:
 * - `privateFinancialValue` is never logged or exposed.
 * - Throws an error if the private value fails the threshold or caller is unauthorized.
 * - Returns only public ledger state and transaction metadata.
 */
export function executeEligibilityProof(
  params: ExecuteEligibilityProofParams
): EligibilityProofResult {
  // 1. Configure the private witness provider off-chain
  const witnesses = createEligibilityWitnessProvider(params.privateFinancialValue);

  // 2. Instantiate the contract with the witness provider
  const contract = new Contract(witnesses);

  // 3. Create the local circuit execution context
  const targetAddress = params.contractAddress ?? dummyContractAddress();
  const circuitContext = createCircuitContext(
    targetAddress,
    { bytes: params.borrowerPk },
    params.contractState.data,
    params.privateState ?? {}
  );

  // 4. Execute the verifyEligibility circuit locally in the prover
  // This verifies `privateFinancialValue >= eligibilityThreshold` in ZK.
  const circuitResult: CircuitResults<any, []> = contract.circuits.verifyEligibility(circuitContext);

  // 5. Construct updated ContractState from execution context
  const updatedContractState = new ContractState();
  updatedContractState.data = new ChargedState(circuitResult.context.currentQueryContext.state.state);
  for (const opName of params.contractState.operations()) {
    const op = params.contractState.operation(opName);
    if (op) {
      updatedContractState.setOperation(opName, op);
    }
  }

  // 6. Query the resulting public ledger state
  const updatedLedger = ledger(circuitResult.context.currentQueryContext.state);

  // 7. Return sanitized public result
  return {
    isVerified: updatedLedger.isEligibilityVerified,
    updatedContractState,
    updatedLedger,
    proofData: circuitResult.proofData,
  };
}
