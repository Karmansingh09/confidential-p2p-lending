# Architecture & Privacy Boundary Specification

This document defines the architectural foundations, privacy model, and confidential eligibility design of the **Confidential P2P Micro-Lending Desk** built on the Midnight Network.

---

## 1. System Overview

The platform enables peer-to-peer micro-loans using zero-knowledge smart contracts written in **Compact**. Borrowers can request capital with explicit terms, while lenders evaluate and fund matching requests based on verifiable proof of creditworthiness without exposing the borrower's private financial data.

---

## 2. Conceptual Privacy Boundary

The core design principle of this protocol is strict segregation between **public, discoverable agreement terms** and **private, confidential financial credentials**.

```
+-----------------------------------------------------------------------------------+
|                              PUBLIC LEDGER STATE                                  |
|                                                                                   |
|  - Loan Status (requested, funded, repaid, settled)                               |
|  - Principal Requested (amount)                                                   |
|  - Agreed Term Duration (durationBlocks)                                          |
|  - Agreed Interest Rate (interestRateBasisPoints)                                 |
|  - Public Eligibility Threshold (eligibilityThreshold)                            |
|  - Borrower Public Account Key (borrower)                                         |
|  - Lender Public Account Key (lender, when funded)                                |
|  - Eligibility Verification Flag (isEligibilityVerified)                          |
+-----------------------------------------------------------------------------------+
                                         ^
                                         | [Verifies statement in Zero-Knowledge]
+-----------------------------------------------------------------------------------+
|                        PRIVATE CLIENT-SIDE STATE (WITNESS)                        |
|                                                                                   |
|  - Actual borrower monthly/annual income                                          |
|  - Actual wallet / collateral balance                                             |
|  - Banking, payroll, or credit credentials                                        |
|  - Raw financial inputs & cryptographic blinding factors / salts                  |
+-----------------------------------------------------------------------------------+
```

### 2.1 Public / Discoverable State
The following fields reside on the public Midnight ledger:

1. **`status` (`LoanStatus`)**: Current lifecycle state (`requested`, `funded`, `repaid`, `settled`). Required for coordination between borrower, lender, and protocol transitions.
2. **`amount` (`Uint<64>`)**: Principal amount requested. Required for prospective lenders to know how much liquidity to supply.
3. **`interestRateBasisPoints` (`Uint<16>`)**: Interest rate expected by the borrower / offered to lenders. Required for economic evaluation.
4. **`durationBlocks` (`Uint<32>`)**: Number of ledger blocks until repayment is due. Required for maturity timeline evaluation.
5. **`eligibilityThreshold` (`Uint<64>`)**: Public qualification threshold required to underwrite the loan request.
6. **`borrower` (`Bytes<32>`)**: Public account identifier / commitment of the borrower. Required so loan funds can be disbursed to the correct recipient.
7. **`lender` (`Maybe<Bytes<32>>`)**: Optional account identifier of the lender. Set to `none` initially; recorded once funded to designate repayment destination.
8. **`isEligibilityVerified` (`Boolean`)**: On-chain boolean flag recording whether the borrower has successfully executed the off-chain zero-knowledge eligibility proof.

### 2.2 Private / Local Information
The following values are strictly maintained off-chain within the borrower's private environment (wallet and witness context) and **never written to the public ledger**:

- **Actual borrower income**: Salary, wages, or recurring revenue figures.
- **Actual account / wallet balance**: Exact asset balances held by the borrower.
- **Credit ratings and credentials**: Off-chain attestation scores or debt ratios.
- **Witness values**: Secret inputs passed into zero-knowledge circuits during proof generation.
- **Cryptographic blinding factors / salts**: Nonces and blinding factors used in commitments.

---

## 3. What Will Eventually Be Proven Using Zero-Knowledge

In subsequent development phases, a zero-knowledge circuit will verify loan eligibility predicates:

1. **Threshold Compliance**: Proves that the borrower's private financial value satisfies the required risk threshold (`privateValue >= eligibilityThreshold`) without revealing the actual value.
2. **Commitment Binding**: Proves that the private attributes belong to the requesting borrower identity (`borrower`).
3. **Ledger Attestation**: Upon verification of the ZK proof, the on-chain contract marks `isEligibilityVerified = true`. Lenders can trust this verified indicator without needing access to any confidential data.

---

## 4. Why Sensitive Financial Values Are Not Placed on the Public Ledger

1. **Privacy Preservation & Surveillance Protection**: Financial figures published on-chain are permanently public, immutable, and susceptible to automated profiling, predatory marketing, and financial discrimination.
2. **True Confidentiality vs. Pseudo-Privacy**: Simply hashing secret figures (e.g. `hash(income)`) and claiming privacy is a pseudo-privacy anti-pattern. Hash pre-images with predictable values (e.g. standard salaries or account balances) can be trivial to brute-force or dictionary-attack. True privacy requires keeping secrets off-chain and proving mathematical properties with zero-knowledge proofs.
3. **Minimal Exposure Principle**: Lenders do not need to know *how much money a borrower makes*; they only need mathematical assurance that the borrower *satisfies the underwriting criteria for the requested amount*.

---

## 5. Private Eligibility Model

The Private Eligibility Model defines the mathematical and cryptographic relationship between off-chain secrets and on-chain attestations.

### 5.1 The Core Predicate
A borrower proves in zero-knowledge that:
$$\text{privateValue} \ge \text{eligibilityThreshold}$$

Where:
- $\text{privateValue} \in \mathbb{N}$ is a private financial metric provided by the borrower (e.g., qualifying liquid balance or verified monthly cashflow).
- $\text{eligibilityThreshold} \in \mathbb{N}$ is the public minimum threshold recorded in the contract ledger state for this loan request.

### 5.2 Information Flow Summary
| Entity / Domain | What is Visible | What Remains Hidden |
| :--- | :--- | :--- |
| **Borrower** | Full knowledge of $\text{privateValue}$, $\text{eligibilityThreshold}$, witnesses, and keys. | Nothing hidden from borrower. |
| **Lender** | Loan terms, $\text{eligibilityThreshold}$, and verification result $\text{isEligibilityVerified} = \text{true}$. | Actual $\text{privateValue}$, employer, bank balances, or margin above threshold. |
| **Public Ledger** | $\text{eligibilityThreshold}$ and boolean flag $\text{isEligibilityVerified}$. | Private witness input $\text{privateValue}$ and execution traces. |

### 5.3 Concrete Numerical Example
Consider a loan request with an underwriting requirement:
- **Public Requirement (`eligibilityThreshold`)**: $30{,}000$ micro-units.
- **Borrower Private Asset (`privateValue`)**: $42{,}000$ micro-units.
- **Proof Execution**: The client-side prover computes $(42{,}000 \ge 30{,}000) \equiv \text{true}$ within a zero-knowledge circuit.
- **Result on Ledger**: The circuit outputs a valid ZK proof; the contract records $\text{isEligibilityVerified} = \text{true}$.
- **Privacy Guarantee**: The lender and third parties learn only that the borrower has $\ge 30{,}000$. They cannot distinguish whether the borrower had $30{,}000$, $42{,}000$, or $1{,}000{,}000$.

### 5.4 Connection to the Upcoming ZK Circuit Phase
In the next implementation phase, this model connects to Midnight Compact primitives:
1. **Witness Declaration**: The contract declares `witness getPrivateFinancialValue(): Uint<64>;` as the interface to the caller's private wallet data.
2. **Circuit Evaluation**: The upcoming proof circuit will invoke the witness off-chain, evaluate `privateValue >= eligibilityThreshold`, and use Midnight Compact's `disclose(...)` primitive solely on the boolean comparison output.
3. **State Transition**: The circuit will assert that the loan is in `LoanStatus.requested` state and that the caller is the borrower, setting `isEligibilityVerified = true` upon valid proof submission.

---

## 6. The `verifyEligibility` Circuit Implementation

The `verifyEligibility()` circuit implemented in `contracts/src/index.compact` realizes the private eligibility model within the Midnight ZK environment.

### 6.1 Circuit Workflow
1. **Lifecycle Check**: Asserts `status == LoanStatus.requested`. Verification cannot be performed on loans that have already transitioned to `funded`, `repaid`, or `settled`.
2. **Replay / Redundancy Prevention**: Asserts `!isEligibilityVerified`. Prevents redundant or duplicate verification calls once verified.
3. **Caller Authorization Binding**: Asserts `ownPublicKey().bytes == borrower`. Cryptographically verifies that the transacting party is the actual borrower designated for this loan agreement.
4. **Private Witness Evaluation**: Invokes `getPrivateFinancialValue()`. This executes off-chain on the borrower's client machine; the returned `privateValue` never leaves the prover.
5. **Zero-Knowledge Threshold Verification**: Computes `isEligible = privateValue >= eligibilityThreshold` and asserts `isEligible`. If the threshold is not satisfied, the circuit execution halts and no transaction state change is generated.
6. **Ledger Transition**: Upon satisfying all constraints, the contract updates `isEligibilityVerified = true` on the immutable ledger.

### 6.2 Privacy Analysis
- **What Remains Private**:
  - The actual numeric value of `privateFinancialValue` (e.g., $42{,}000$).
  - Prover execution trace, witness inputs, and intermediate calculations.
  - The margin by which the borrower exceeded the threshold.
- **What Becomes Public**:
  - The boolean attestation flag `isEligibilityVerified: true` on the public ledger.
- **What the Verifier / Lender Learns**:
  - The verifier learns only that the statement $\text{privateValue} \ge \text{eligibilityThreshold}$ is mathematically true for the borrower. The verifier learns nothing else about the borrower's asset portfolio, exact balance, or financial history.

### 6.3 Security Considerations & Anti-Manipulation
- **No Arbitrary Setting**: There is no public administrative function or circuit parameter allowing a caller to pass `isEligibilityVerified = true`. The flag is mutated strictly within `verifyEligibility()` as an atomic consequence of passing all circuit assertions.
- **Caller Binding**: Binding `ownPublicKey().bytes == borrower` ensures that third parties cannot trigger or claim eligibility on behalf of someone else's loan.
- **Atomic Failure**: If `privateValue < eligibilityThreshold`, the circuit assert triggers a contract runtime error, preventing any state modification.

### 6.4 Current Limitations
1. **Self-Reported Witness Model**: In this initial phase, the witness value is supplied by the borrower's local wallet environment. In subsequent iterations, this can be combined with zero-knowledge attestations from signed credentials (e.g. zk-SBTs or verified financial oracles).
2. **Binary Threshold Evaluation**: The model currently evaluates a single scalar threshold. Complex multi-criteria underwriting (e.g. debt-to-income and collateral ratios simultaneously) will build on this foundational pattern.

---

## 7. Client-Side Proof Execution Architecture

The TypeScript client module (`contracts/client/eligibility-client.ts`) provides the application-level interface for executing the private eligibility circuit using the official Midnight Compact runtime.

### 7.1 Pipeline Overview
```
+-------------------------------------------------------------+
|                     APPLICATION CLIENT                      |
|                                                             |
|  Private Financial Value (e.g. 42000 from env/wallet)       |
|  Borrower Identity (borrowerPk)                             |
|  Active Contract State (contractState)                      |
+-------------------------------------------------------------+
                              │
                              ▼
+-------------------------------------------------------------+
|                 PRIVATE WITNESS PROVIDER                    |
|                                                             |
|  createEligibilityWitnessProvider(privateFinancialValue)    |
|  Encapsulates secret within off-chain closure:              |
|    getPrivateFinancialValue: () => [privateState, value]    |
+-------------------------------------------------------------+
                              │
                              ▼
+-------------------------------------------------------------+
|                 LOCAL CIRCUIT PROVER EXECUTION              |
|                                                             |
|  contract.circuits.verifyEligibility(circuitContext)        |
|  Evaluates privateValue >= eligibilityThreshold             |
|  Generates ProofData & asserts constraints locally          |
+-------------------------------------------------------------+
                              │
                              ▼
+-------------------------------------------------------------+
|                 SANITIZED PUBLIC RESULT                     |
|                                                             |
|  EligibilityProofResult:                                    |
|    isVerified: true                                         |
|    updatedContractState (committed on-chain)                |
|    updatedLedger (isEligibilityVerified = true)             |
|    proofData (public transcript, zero secrets)              |
+-------------------------------------------------------------+
```

### 7.2 Strict Secret Hygiene Guarantees
The client module enforces cryptographic hygiene invariants:
1. **Zero Exposure**: `privateFinancialValue` is never stored on the ledger, never logged to stdout/stderr, and never included in `EligibilityProofResult`.
2. **Runtime Configuration**: Sensitive inputs can be injected via runtime environment variables (e.g. `process.env.BORROWER_PRIVATE_FINANCIAL_VALUE`) or directly from local wallet storage, avoiding hardcoded source secrets.
3. **Fail-Fast Integrity**: If the private value is below `eligibilityThreshold` or if the caller is not the registered borrower, the function halts with an assertion error without mutating contract state.

### 7.3 Local Proving & Network Environment
When running outside of a connected testnet/devnet (i.e. when a remote proof server or node is not running), the client module leverages the local execution engine in `@midnight-ntwrk/compact-runtime`. This evaluates the compiled ZKIR circuits against authentic prover contexts, producing valid `ProofData` and ledger mutations identically to on-chain execution.

---

## 8. Loan Request Lifecycle

The loan request workflow marks the first operational lending transaction on the micro-lending desk. A borrower initiates a loan request by deploying/instantiating a contract with economic terms and underwriting requirements.

### 8.1 Data Submission & Privacy Boundary
During loan-request creation:
- **What the Borrower Submits**:
  - `borrowerPk` (`Bytes<32>`): Borrower account public key.
  - `principalAmount` (`Uint<64>`): Principal sum requested.
  - `interestRate` (`Uint<16>`): Proposed interest rate in basis points (1 bps = 0.01%).
  - `termBlocks` (`Uint<32>`): Loan duration in network blocks.
  - `minThreshold` (`Uint<64>`): Public underwriting threshold the borrower commits to meeting.
- **What Becomes Public**:
  - All submitted terms are disclosed and committed to public ledger storage (`borrower`, `amount`, `interestRateBasisPoints`, `durationBlocks`, `eligibilityThreshold`).
  - Lenders discover and evaluate these terms on-chain via inspection circuits (`getLoanDetails()`, `getLoanStatus()`).
- **What Remains Private**:
  - The borrower's sensitive financial data (e.g. liquid net worth, income, bank balances) is **never** provided in the constructor or initial state.
  - No pseudo-anonymous hashes or predictable commitments are published to the ledger.
  - Financial data is evaluated exclusively off-chain during the subsequent ZK proof step.

### 8.2 Initial State Guarantees
Every newly created loan request guarantees:
- `status = LoanStatus.requested`: A loan cannot be initialized in `funded`, `repaid`, or `settled`.
- `isEligibilityVerified = false`: Eligibility cannot be pre-set or assumed; it requires a valid ZK circuit execution.
- `lender = none<Bytes<32>>()`: No lender can be assigned at request time.

### 8.3 Validation Rules
Parameters are strictly enforced via on-chain Compact `assert()` statements and client-side pre-validation:
1. **Principal Amount**: `principalAmount > 0` (prevents empty or zero-value loans).
2. **Duration**: `durationBlocks > 0` (enforces positive loan maturity terms).
3. **Interest Rate Range**: `interestRate > 0 && interestRate <= 10000` (ensures interest rates fall within a protocol-governed sensible micro-lending band of 0.01% to 100.00% APR).
4. **Eligibility Threshold**: `minThreshold > 0` (guarantees a meaningful non-zero underwriting bar).

### 8.4 Connection to Eligibility Verification
```
+─────────────────────────────────────────+
|         1. CREATE LOAN REQUEST          |
|                                         |
|  - Validates principal, rate, duration  |
|  - Sets status = requested              |
|  - Sets isEligibilityVerified = false   |
|  - Commits eligibilityThreshold         |
+─────────────────────────────────────────+
                     │
                     ▼
+─────────────────────────────────────────+
|         2. ZK PROOF EXECUTION           |
|                                         |
|  - Borrower calls verifyEligibility()   |
|  - Circuit checks status == requested   |
|  - Circuit checks !isEligibilityVerified|
|  - Proves privateValue >= threshold     |
+─────────────────────────────────────────+
                     │
                     ▼
+─────────────────────────────────────────+
|     3. ELIGIBLE REQUEST FOR LENDERS     |
|                                         |
|  - status remains requested             |
|  - isEligibilityVerified = true         |
|  - Discoverable by marketplace lenders  |
+─────────────────────────────────────────+
```
A newly created request is immediately compatible with the `verifyEligibility()` circuit. Once verified, the request is cryptographically stamped as eligible without disclosing the borrower's private financial value, paving the way for confidential lender funding in subsequent protocol phases.

---

## 9. Lender Funding Lifecycle

The lender funding flow transitions an eligible, requested loan into an active debt obligation (`funded`) held between the borrower and an identified lender.

```
+─────────────────────────────────────────+
|      1. DISCOVERY & INSPECTION          |
|                                         |
|  Lender queries getLoanDetails():       |
|  - terms: amount, rate, duration        |
|  - check: status == requested           |
|  - check: isEligibilityVerified == true |
|  - check: lender == none                |
+─────────────────────────────────────────+
                     │
                     ▼
+─────────────────────────────────────────+
|        2. FUNDING CIRCUIT CALL          |
|                                         |
|  Lender calls fundLoan(lenderPk):       |
|  - asserts caller == lenderPk           |
|  - asserts lenderPk != borrower         |
|  - asserts lenderPk != empty            |
|  - asserts status == requested          |
|  - asserts isEligibilityVerified == true|
+─────────────────────────────────────────+
                     │
                     ▼
+─────────────────────────────────────────+
|        3. FUNDED LEDGER STATE           |
|                                         |
|  - status = LoanStatus.funded           |
|  - lender = some(lenderPk)              |
|  - zero leakage of borrower secrets     |
+─────────────────────────────────────────+
```

### 9.1 What the Lender Evaluates
Prospective lenders have full discoverability of public underwriting terms without learning private financial details:
- **Disclosed Terms**: Principal amount (`amount`), return rate (`interestRateBasisPoints`), term length (`durationBlocks`), and threshold commitment (`eligibilityThreshold`).
- **Eligibility Proof Attestation**: `isEligibilityVerified == true` certifies that the borrower proved `privateFinancialValue >= eligibilityThreshold` in zero knowledge.
- **Participant Identity**: The borrower's public account key (`borrower`).

### 9.2 Eligibility Prerequisite & Strict Validation
The `fundLoan(lenderPk: Bytes<32>)` circuit enforces atomic preconditions:
1. **Verified Underwriting Required**: `assert(isEligibilityVerified, "Loan eligibility has not been verified")`. Lenders cannot fund unverified loans.
2. **Lifecycle State Integrity**: `assert(status == LoanStatus.requested, "Loan is not in requested state")`. Already-funded, repaid, or settled loans cannot be funded.
3. **Cryptographic Caller Binding**: `assert(ownPublicKey().bytes == lenderPk, "Caller is not the designated lender")`. The transaction signer must prove ownership of `lenderPk`, preventing front-running and unauthorized assignment.
4. **No Self-Funding**: `assert(lenderPk != borrower, "Borrower cannot fund their own loan")`. Enforces authentic two-party lending.
5. **Non-Empty Identity**: `assert(lenderPk != pad(32, ""), "Lender public key cannot be empty")`.

### 9.3 State Transition & Lender Assignment
Upon circuit verification:
- `lender` is updated from `none<Bytes<32>>()` to `some<Bytes<32>>(disclose(lenderPk))`.
- `status` transitions from `LoanStatus.requested` to `LoanStatus.funded`.

### 9.4 Asset Transfer Status & Infrastructure Boundaries
- **Current Scope**: The smart contract and client library execute the authentic ZK circuit state transition (`funded`) and assign the lender.
- **No Faked Asset Transfers**: Real token movement and escrow require Midnight Network shielded coin infrastructure (`zswap` / Native Tokens) and wallet integration (Lace / Midnight.js provider). Because no live Midnight node, token contract, or wallet provider is currently connected to this offline environment, asset movement is explicitly reported as unexecuted (`isAssetTransferExecuted: false`).
- **Client Extensibility**: The `FundLoanParams` interface provides a `paymentTransferDetails` placeholder to seamlessly incorporate native shielded coin escrows once network token infrastructure is provisioned in future milestones.

### 9.5 Privacy & Secret Hygiene Guarantees
- The funding transaction does not query or invoke the private witness `getPrivateFinancialValue()`.
- Borrower private financial values, account balances, and witness execution transcripts remain strictly local to the borrower's proving environment.
- Lenders make funding decisions solely based on zero-knowledge public attestations.

---

## 10. Borrower Repayment Lifecycle

The repayment workflow allows the borrower to satisfy their debt obligation on an active, funded loan, transitioning the contract state from `funded` to `repaid`.

```
+──────────────────────────────────────────+
|          1. REPAYMENT INVOCATION         |
|                                          |
|  Borrower calls repayLoan(amount):       |
|  - checks status == funded               |
|  - checks caller == borrower             |
|  - checks repayment >= principal         |
+──────────────────────────────────────────+
                      │
                      ▼
+──────────────────────────────────────────+
|     2. SAFE ARITHMETIC VERIFICATION      |
|                                          |
|  Evaluates in Field (BLS12-381, 254-bit):|
|  - product = principal * rate            |
|  - interestProduct = interest * 10000    |
|  - remainder = product - interestProduct |
|  - asserts remainder < 10000 (as Uint64) |
+──────────────────────────────────────────+
                      │
                      ▼
+──────────────────────────────────────────+
|         3. REPAID LEDGER STATE           |
|                                          |
|  - status = LoanStatus.repaid            |
|  - obligation mathematically fulfilled   |
|  - zero leakage of borrower secrets      |
+──────────────────────────────────────────+
```

### 10.1 Repayment Calculation & Simple Interest Model
The required repayment obligation is derived directly from the immutable loan terms stored on the ledger:
$$\text{Obligation} = \text{Principal} + \left\lfloor \frac{\text{Principal} \times \text{interestRateBasisPoints}}{10000} \right\rfloor$$

- **Absence of Timing Primitives in Compact**: Compact 0.31.1 does not expose a reliable on-chain block/clock/slot primitive. Consequently, the MVP specifies a deterministic simple-interest obligation based on the agreed basis points, rather than continuous time-accrued interest.
- **Client Helper**: `calculateRepaymentObligation(principal, interestRateBasisPoints)` computes the exact expected total in TypeScript, allowing automated parameter deduction.

### 10.2 Mathematical Non-Trusting Validation & Safe Field Arithmetic
Because Compact circuits operate over algebraic zero-knowledge constraint systems, the language does not provide a native integer division `/` operator. Rather than blindly trusting an untrusted caller-supplied `repaymentAmount`, the contract proves Euclidean division in zero knowledge:
1. **Field Promotion**: Intermediate values (`amount as Field`, `interestRateBasisPoints as Field`) are promoted to native `Field` (BLS12-381 scalar field elements). This eliminates intermediate integer overflow, since $2^{64} \times 10000 \ll 2^{254}$.
2. **Euclidean Division Proof**:
   $$\text{productField} = \text{interestField} \times 10000 + \text{remainderField}$$
3. **Bounded Remainder Assertion**: Casting `remainderField as Uint<64>` asserts both non-negativity (rejecting overpayment) and bounds the remainder strictly to $[0, 9999]$ (rejecting underpayment).
4. **Uniqueness**: By the Euclidean Division Theorem, exactly one integer value satisfies this constraint system, mathematically guaranteeing that the borrower repays the exact required interest.

### 10.3 Caller Authorization & Lifecycle Constraints
- **Borrower Binding**: `assert(ownPublicKey().bytes == borrower, "Caller is not the borrower")` prevents lenders or third parties from executing repayment on behalf of the borrower.
- **Status Safeguards**: `assert(status == LoanStatus.funded, "Loan is not in funded state")` prevents repayments on un-funded requests (`requested`), already repaid contracts (`repaid`), or settled loans (`settled`).

### 10.4 Asset Movement Status
- In this milestone, the verified state machine transition (`repaid`) and cryptographic arithmetic proofs are executed locally.
- Real token payments and native coin returns require Midnight shielded token ledger deployment (`zswap` / Native Tokens) and an active wallet connector, and are therefore explicitly reported as unexecuted (`isAssetTransferExecuted: false`).

---

## 11. Loan Settlement Lifecycle

Settlement represents the final lifecycle state transition of a loan agreement on the Confidential P2P Micro-Lending Desk, confirming that a fully repaid loan has reached its immutable terminal state.

```
+───────────────────────────────────────────────────────────+
|               COMPLETE 5-STAGE PROTOCOL LIFECYCLE         |
|                                                           |
|  1. REQUESTED:    Borrower creates loan request           |
|         │         - Principal, rate, duration, threshold  |
|         ▼                                                 |
|  2. VERIFIED:     Borrower proves financial eligibility   |
|         │         - Zero-knowledge proof (witness >= min) |
|         ▼                                                 |
|  3. FUNDED:       Lender deposits funds & accepts terms   |
|         │         - Lender assigned, status = funded      |
|         ▼                                                 |
|  4. REPAID:       Borrower satisfies full debt obligation |
|         │         - Principal + interest verified in ZK   |
|         ▼                                                 |
|  5. SETTLED:      Terminal agreement finalization         |
|                   - Callable by borrower or lender        |
|                   - status = settled (closed out)         |
+───────────────────────────────────────────────────────────+
```

### 11.1 Terminal State Guarantees
- **Immutable Closure**: Once `status = LoanStatus.settled`, the loan has completed its entire economic and legal lifecycle.
- **Circuit Guardrails**: A settled loan cannot be re-funded, cannot be re-repaid, and cannot be re-settled. All subsequent circuit calls attempting state mutation are rejected.

### 11.2 Authorization Model & Anti-Deadlock Design
The `settleLoan()` circuit enforces:
$$\text{caller} = \text{borrower} \quad \lor \quad \text{caller} = \text{lender}$$

```compact
const caller = ownPublicKey().bytes;
assert(caller == borrower || (lender.is_some && caller == lender.value), "Caller is not authorized to settle this loan");
```

- **Exclusion of Third Parties**: Unrelated addresses who are neither the borrower nor the lender cannot trigger settlement.
- **Anti-Deadlock Rationale**: Because full repayment (principal + interest) is already mathematically proven and verified on-chain upon entering `LoanStatus.repaid`, requiring both parties to sign simultaneously or restricting settlement to only the lender would introduce griefing/deadlock risk (e.g. an unresponsive lender stranding the borrower's agreement in `repaid`). Allowing either legitimate agreement participant to close out the loan ensures protocol liveness while preserving access control.

### 11.3 Asset Transfer Status
- The settlement transaction marks the verified terminal state transition on the smart contract.
- Similar to earlier phases, physical coin unlock and escrow release require active Midnight Network token infrastructure (`zswap` / Native Tokens), which is reported honestly as unexecuted (`isAssetTransferExecuted: false`).

---

## 12. Typed Client Lifecycle API

The Typed Client Lifecycle API (`contracts/client/loan-api.ts`) provides an ergonomic, strongly typed developer layer designed to bridge the low-level Compact runtime circuits with upcoming React frontend components and Midnight.js wallet infrastructure.

```
+───────────────────────────────────────────────────────────────────────────+
|                        UPCOMING REACT UI / MIDNIGHT.JS                    |
|                (State Management, Wallet Connectors, UX Views)            |
+───────────────────────────────────────────────────────────────────────────+
                                      │
                                      ▼
+───────────────────────────────────────────────────────────────────────────+
|                       TYPED CLIENT LIFECYCLE API                          |
|                       (contracts/client/loan-api.ts)                      |
|                                                                           |
|  - LoanDesk Facade & Canonical Methods (createLoan, fundLoan, etc.)       |
|  - Typed Models: LoanDetailsModel, LoanStatusText, Hex Address Formats    |
|  - Error Model: LoanErrorCode & LoanApiError with Forensics               |
|  - Defensive UX Guards: canVerifyEligibility, canFundLoan, etc.           |
+───────────────────────────────────────────────────────────────────────────+
                                      │
                                      ▼
+───────────────────────────────────────────────────────────────────────────+
|                   LOW-LEVEL CLIENT / RUNTIME EXECUTOR                     |
|                 (contracts/client/eligibility-client.ts)                  |
|                                                                           |
|  - Private Witness Injection (createEligibilityWitnessProvider)          |
|  - Circuit Context Assembly (createCircuitContext, dummyContractAddress)  |
|  - Compact Runtime ChargedState & Ledger Query Management                 |
+───────────────────────────────────────────────────────────────────────────+
                                      │
                                      ▼
+───────────────────────────────────────────────────────────────────────────+
|                     AUTHORITATIVE COMPACT CIRCUITS                        |
|                      (contracts/src/index.compact)                        |
|                                                                           |
|  - Zero-Knowledge Prover & Verifier Primitives (BLS12-381 Scalar Field)   |
|  - On-Chain Invariant Assertions & State Mutations                        |
+───────────────────────────────────────────────────────────────────────────+
```

### 12.1 Why the Abstraction Exists
1. **Separation of Concerns**: UI components and DApp frontends should not need to manipulate raw `Uint8Array` public key buffers, unpack low-level Compact `ChargedState` objects, or understand internal runtime circuit context creation.
2. **Ergonomic Safety**: BigInts, byte conversions, basis points, and status mappings are standardized into high-level TypeScript interfaces (`LoanDetailsModel`).
3. **Defensive UX Feedback**: Frontend buttons and tooltips can evaluate `LifecycleGuardResult` to offer immediate user feedback before triggering proof generation or signing transactions.

### 12.2 Contract Layer vs. Client Layer Boundaries
| Dimension | Compact Contract Layer (`contracts/src/index.compact`) | Client API Layer (`contracts/client/loan-api.ts`) |
| :--- | :--- | :--- |
| **Role** | Authoritative cryptographic security boundary & state transition engine | Ergonomic application gateway & UI consumer interface |
| **Security Authority** | Absolute. Cryptographically asserts all invariants on-chain | Non-authoritative UX helper. Pre-validates to improve user experience |
| **Witness Access** | Receives witness input inside ZK circuit prover; values never leave prover | Injects witness via provider; never surfaces secrets in return models |
| **Error Handling** | Compact assertions halt circuit execution with descriptive error strings | Traps runtime assertions and maps them to typed `LoanApiError` instances |

### 12.3 Public Loan Model (`LoanDetailsModel`)
The client API projects on-chain ledger state into `LoanDetailsModel`:

```typescript
export interface LoanDetailsModel {
  borrower: string;                     // Hex-encoded ("0x...")
  borrowerBytes: Uint8Array;            // Raw 32-byte public key
  lender: string | null;                // Hex-encoded ("0x...") or null
  lenderBytes: Uint8Array | null;       // Raw 32-byte public key or null
  amount: bigint;                       // Principal in micro-units
  interestRateBasisPoints: bigint;      // 100 bps = 1.00%
  durationBlocks: bigint;               // Duration in ledger blocks
  status: LoanStatus;                   // Compact enum (0..3)
  statusText: LoanStatusText;           // 'requested' | 'funded' | 'repaid' | 'settled'
  eligibilityThreshold: bigint;         // Required qualification threshold
  isEligibilityVerified: boolean;       // ZK verification attestation
}
```

#### Zero-Leakage Guarantee
- `LoanDetailsModel` **strictly omits** any borrower private financial values, account balances, or secret keys.
- Even when `verifyLoanEligibility()` executes the confidential ZK proof, the returned result structure contains only `{ success, isVerified, contractState, loanDetails, proofData }`. The borrower's private witness input remains strictly encapsulated in the local off-chain prover context.

### 12.4 Lifecycle Methods & Unified `LoanDesk` Facade
The client provides canonical lifecycle methods alongside the unified `LoanDesk` facade:

- **`createLoan(params)`**: Validates loan terms and deploys an initial loan request.
- **`verifyLoanEligibility(params)`**: Executes the private ZK proof against the borrower's local witness.
- **`fundLoan(params)`**: Records lender commitment and transitions the loan to `funded`.
- **`repayLoan(params)`**: Calculates and validates repayment amount, transitioning the loan to `repaid`.
- **`settleLoan(params)`**: Terminal closure callable by borrower or lender, transitioning to `settled`.
- **`getLoanStatus(contractState)`**: Reads the current `LoanStatus` enum from state.
- **`getLoanDetails(contractState)`**: Reads and maps full `LoanDetailsModel` from state.
- **`calculateRepaymentObligation(principal, rateBps)`**: Computes principal + simple interest.

### 12.5 Structured Error Model (`LoanErrorCode` & `LoanApiError`)
All canonical methods map runtime errors into typed `LoanApiError` instances containing structured enum codes:

```typescript
export enum LoanErrorCode {
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',
  ELIGIBILITY_VERIFICATION_FAILED = 'ELIGIBILITY_VERIFICATION_FAILED',
  UNAUTHORIZED_CALLER = 'UNAUTHORIZED_CALLER',
  INVALID_STATE = 'INVALID_STATE',
  ALREADY_FUNDED = 'ALREADY_FUNDED',
  ALREADY_VERIFIED = 'ALREADY_VERIFIED',
  REPAYMENT_AMOUNT_INVALID = 'REPAYMENT_AMOUNT_INVALID',
  SETTLEMENT_UNAUTHORIZED = 'SETTLEMENT_UNAUTHORIZED',
  EXECUTION_FAILED = 'EXECUTION_FAILED',
}
```

The error mapper preserves the original underlying exception (`originalError`) for forensic debugging while providing clean, actionable codes for UI error boundaries and alert banners.

### 12.6 Client-Side Lifecycle UX Helpers
To avoid unnecessary user friction, the client provides defensive guard functions:
- `canVerifyEligibility(loan, callerPk)`
- `canFundLoan(loan, callerPk)`
- `canRepayLoan(loan, callerPk)`
- `canSettleLoan(loan, callerPk)`

Each helper returns a `LifecycleGuardResult` (`{ canExecute: boolean, reason?: string }`), enabling frontend buttons to be disabled with explanatory tooltips (e.g. *"Loan eligibility has not been verified"* or *"Borrower cannot fund their own loan"*).

### 12.7 Local Execution & Asset Movement Transparency
- All operations currently execute within the local Compact runtime environment.
- Any property representing live token movement (`isAssetTransferExecuted`) evaluates to `false`, guaranteeing transparent and honest reporting until Midnight Network native token infrastructure (`zswap` / Native Tokens) is integrated.

### 12.8 Future Midnight.js & React UI Integration
This client API is structured as an immediate drop-in dependency for the upcoming React frontend:
1. **Wallet Hooks**: React hooks can invoke `LoanDesk.createLoan(...)` and pass wallet public keys obtained from Lace Wallet.
2. **Prover Sidecar Integration**: The witness provider passed to `verifyLoanEligibility` can seamlessly delegate to a local Midnight proof server sidecar or in-browser WASM prover.
3. **State Observability**: Polling or subscription to on-chain ledger events can pipe contract states directly into `LoanDesk.getLoanDetails(state)` to trigger UI reactivity.

---

## 13. Frontend Architecture & Privacy Boundaries

The frontend application (`frontend/`) provides an interactive React + TypeScript user interface designed to present the Confidential P2P Micro-Lending Desk lifecycle to borrowers and lenders.

```
+───────────────────────────────────────────────────────────────────────────+
|                           REACT FRONTEND LAYER                            |
|                     (frontend/src/pages/DashboardPage.tsx)                |
|                                                                           |
|  - Renders 5-phase lifecycle: REQUESTED -> VERIFIED -> FUNDED -> REPAID   |
|                               -> SETTLED                                  |
|  - Consumes ONLY public LoanDetailsModel (amount, rate, duration, status) |
|  - Displays defensive LifecycleStepper & PrivacyIndicator                 |
|  - Operates in Local Mock Mode (no fake transactions or wallet claims)    |
+───────────────────────────────────────────────────────────────────────────+
                                      │
                                      ▼ [Consumes Public Data Models Only]
+───────────────────────────────────────────────────────────────────────────+
|                         CLIENT LIFECYCLE API LAYER                        |
|                       (contracts/client/loan-api.ts)                      |
|                                                                           |
|  - Unified LoanDesk facade & canonical lifecycle dispatchers              |
|  - Evaluates LifecycleGuardResult (canFundLoan, canRepayLoan, etc.)       |
|  - Maps contract execution errors to typed LoanApiError instances         |
+───────────────────────────────────────────────────────────────────────────+
                                      │
                                      ▼ [Witness injected ONLY off-chain]
+───────────────────────────────────────────────────────────────────────────+
|                     COMPACT ZERO-KNOWLEDGE CONTRACT                       |
|                      (contracts/src/index.compact)                        |
|                                                                           |
|  - Sole cryptographic authority for state transitions                     |
|  - Proves privateValue >= eligibilityThreshold in Zero Knowledge          |
|  - Discloses ONLY the boolean verification attestation to the ledger      |
+───────────────────────────────────────────────────────────────────────────+
```

### 13.1 Layer Responsibilities
1. **Frontend Responsibility (`frontend/src/`)**:
   - Visualizes agreement status and lifecycle progression across all 5 states.
   - Formats public numbers (amounts, basis points, durations) and shortens public keys.
   - Guides user actions with defensive UI prompts and disabled action buttons.
   - Clearly flags prototype/mock operation mode to prevent misleading users.
2. **Client API Responsibility (`contracts/client/loan-api.ts`)**:
   - Encapsulates low-level Compact runtime state queries and proof context creation.
   - Enforces parameter preconditions before dispatching transactions.
   - Standardizes error classification (`LoanErrorCode`).
3. **Compact Contract Responsibility (`contracts/src/index.compact`)**:
   - Sole cryptographic authority. Enforces all invariant checks, caller bindings, and state transitions.

### 13.2 Privacy Boundary: Why Private Financial Values Never Enter React State
A central architectural pillar of this protocol is that **sensitive borrower financial credentials never enter the React application tree**:

- **No Private State in UI Components**: React components receive only `LoanDetailsModel`, which contains exclusively public ledger fields (`amount`, `interestRateBasisPoints`, `durationBlocks`, `status`, `eligibilityThreshold`, `isEligibilityVerified`, `borrower`, `lender`).
- **No Witness Leaks in Forms or State**: The React state holds only selected agreement identifiers and UI viewing flags.
- **Local Prover Isolation**: When the ZK eligibility circuit executes, the borrower's private financial value is supplied directly to the witness provider in a local off-chain process or proof-server sidecar. The witness value never traverses React props, context, Redux/Zustand stores, or DOM attributes.
- **Zero-Leakage Assurance**: Automated tests strictly scan all frontend source files to enforce that neither `getPrivateFinancialValue` nor private witness identifiers can be imported into UI components.

### 13.3 Honest Local/Mock Mode State
In Commit #13:
- The frontend operates strictly in **Local Mock UI Mode**.
- Network banners explicitly indicate disconnection from Midnight Network.
- No wallet transactions or blockchain settlements are faked or simulated as real.
- The UI exposes an interactive scenario selector (`loan-001` through `loan-005`) enabling reviewers and developers to inspect all 5 lifecycle states in complete safety.

---

## 14. Borrower Loan Request UI

### 14.1 Architecture & Information Flow
The Borrower Loan Request UI (`frontend/src/pages/CreateLoanPage.tsx` and `frontend/src/components/LoanRequestForm.tsx`) allows a prospective borrower to draft, validate, and preview public loan terms before publishing them to the Midnight ledger.

```
+───────────────────────────────────────────────────────────────────────────+
|                         BORROWER LOAN REQUEST UI                          |
|                 (frontend/src/components/LoanRequestForm.tsx)             |
|                                                                           |
|  Inputs (Public Terms ONLY):                                              |
|    - Principal Amount (e.g. 25,000 units)                                 |
|    - Annual Interest Rate (e.g. 5.00% -> 500 bps)                        |
|    - Duration (e.g. 100 blocks)                                           |
|    - Eligibility Threshold (e.g. 30,000 units)                            |
|                                                                           |
|  Live UX Validation & Safe Basis Points Math                              |
|    (frontend/src/lib/validation.ts)                                       |
+───────────────────────────────────────────────────────────────────────────+
                                      │
                                      ▼ [Public Terms Preview]
+───────────────────────────────────────────────────────────────────────────+
|                           LIVE LOAN PREVIEW                               |
|                    (frontend/src/components/LoanPreview.tsx)              |
|                                                                           |
|  - Estimated simple interest & total repayment obligation                 |
|  - Initial status: REQUESTED                                              |
|  - Initial attestation: NOT VERIFIED                                      |
|  - Privacy Notice: Zero private credentials collected                     |
+───────────────────────────────────────────────────────────────────────────+
                                      │
                                      ▼ [Local Simulation in Prototype Mode]
+───────────────────────────────────────────────────────────────────────────+
|                       LOCAL LOAN SERVICE / CLIENT API                     |
|                      (frontend/src/lib/loan-service.ts)                   |
|                                                                           |
|  - Produces typed LoanDetailsModel                                        |
|  - Updates App state to reflect the new loan in Dashboard                 |
|  - Prepares payload for upcoming Midnight.js contract deployment          |
+───────────────────────────────────────────────────────────────────────────+
```

### 14.2 Public Terms vs. Private Financial Data
The loan request form strictly separates public agreement parameters from private borrower data:

1. **What Information the Borrower Enters (Public Terms Only)**:
   - **Principal Amount**: The requested loan capital in micro-units (`amount > 0`).
   - **Interest Rate**: Entered as an intuitive percentage (e.g. `5.00%`, max 2 decimal places), automatically converted into exact integer basis points (`500 bps`, where `10000 bps = 100.00%`).
   - **Duration**: The loan term in consensus blocks (`durationBlocks > 0`).
   - **Eligibility Threshold**: The public qualification benchmark specified by the protocol or underwriter (`threshold > 0`).

2. **What Becomes Public Ledger State**:
   - Once submitted to the Midnight contract, the agreement terms become transparently verifiable to potential lenders on the Midnight ledger:
     - `amount`
     - `interestRateBasisPoints`
     - `durationBlocks`
     - `eligibilityThreshold`
     - `status = REQUESTED`
     - `isEligibilityVerified = false`
     - `borrower = <PublicKey>`

3. **What Remains Strictly Private**:
   - **Private Financial Credentials**: Income, bank account balances, tax records, net worth, and proof witnesses are **never** entered, requested, stored, or transmitted by this form.
   - **Private Keys / Wallet Secrets**: Signing keys remain isolated in wallet enclaves (or local mock identity stores in development) and are never exposed to the application form.

### 14.3 Frontend Validation vs. Compact Contract Validation
Validation is applied at two distinct layers with complementary roles:

- **Frontend Validation (`frontend/src/lib/validation.ts`) — UX Ergonomics**:
  - Catches typing errors, illegal characters, negative amounts, out-of-range rates, and zero durations in real time.
  - Converts decimal percentages to exact integer basis points using string-based integer arithmetic (`whole * 100n + frac`) to avoid IEEE-754 floating point precision errors.
  - Provides instantaneous field-level error messages and disables submission until all inputs are valid.
  - *Frontend validation is purely advisory and exists to prevent bad user input.*

- **Compact Contract Validation (`contracts/src/index.compact`) — Cryptographic Authority**:
  - The Compact smart contract is the ultimate, immutable source of truth.
  - Independently enforces invariant assertions (`amount > 0`, `duration > 0`, `threshold > 0`, `caller == borrower`).
  - Ensures that even if a malicious client bypasses frontend validation, invalid parameters or unauthorized state transitions are rejected deterministically by the consensus engine.

### 14.4 Separation of Loan Request and Zero-Knowledge Eligibility Verification
Why is eligibility verification not executed simultaneously inside the loan creation form?
1. **Architectural Separation of Concerns**:
   - Creating a loan request establishes the public terms of the agreement on the public ledger.
   - Proving eligibility requires generating a zero-knowledge proof off-chain using the borrower's private witness (`privateFinancialValue >= eligibilityThreshold`).
2. **User Privacy & Sovereign Control**:
   - The borrower retains complete control over when and how their private witness is injected.
   - Drafting and inspecting the public terms should never require exposing or processing secret credentials.
3. **Proof Generation Overhead**:
   - Zero-knowledge proof generation in Midnight takes compute resources and proof-server coordination. Decoupling the steps prevents UI freezing, allows async proof generation, and facilitates clear error handling if proof criteria are not met.
4. **Lifecycle State Integrity**:
   - A loan request in state `REQUESTED` and `isEligibilityVerified = false` provides a clear signal to lenders that terms have been proposed but credit qualification is pending.

---

## 15. Public Loan Marketplace Discovery, Filtering, Sorting & Lifecycle-Aware Dashboard

### 15.1 Architecture & Public Information Model
The Public Loan Marketplace (`frontend/src/components/LoanMarketplace.tsx` and `frontend/src/lib/marketplace.ts`) provides a comprehensive discovery and inspection engine for confidential micro-loans across the entire protocol lifecycle.

```
+───────────────────────────────────────────────────────────────────────────+
|                          LOAN MARKETPLACE ENGINE                          |
|                       (frontend/src/lib/marketplace.ts)                   |
|                                                                           |
|  - Ingests public Record<string, LoanDetailsModel>                        |
|  - Deterministic Search (ID, Borrower, Lender)                            |
|  - Lifecycle Filtering (All, Requested, Verified, Funded, Repaid, Settled)|
|  - Exact BigInt Sorting (Principal, Rate, Duration)                       |
|  - Lifecycle Action Derivation via canonical contract guards              |
+───────────────────────────────────────────────────────────────────────────+
                                      │
               ┌──────────────────────┴──────────────────────┐
               ▼                                             ▼
+─────────────────────────────+               +─────────────────────────────+
|     DISCOVERY TABLE UI      |               |     ENHANCED DETAILS &      |
| (LoanMarketplace.tsx)       |               |     LIFECYCLE ACTION PANEL  |
|                             |               | (LoanSummaryCard & Action)  |
| - Filter tabs with counts   |               |                             |
| - Case-insensitive search   |               | - Canonical guards dispatch |
| - Active row selection      |               | - Strict Public vs Private  |
| - Empty state handling      |               |   boundary disclosure       |
+─────────────────────────────+               +─────────────────────────────+
```

### 15.2 Public-Data-Only Filtering and Deterministic Search
All discovery and querying operations execute strictly against public ledger fields:
1. **Search Query Evaluation (`matchesSearch`)**:
   - Matches against `loanId`, `loan.borrower` (hex public key), and `loan.lender` (hex public key if assigned).
   - Case-insensitive, trims whitespace, deterministic, and type-safe.
   - Completely isolated from any confidential financial data.
2. **Lifecycle Filtering (`matchesLifecycleFilter`)**:
   - Partitions agreements into mutually exclusive categories:
     - `all`: All recorded agreements.
     - `requested`: Newly requested agreements pending ZK verification (`status === requested && !isEligibilityVerified`).
     - `verified`: Formally verified requests awaiting lender funding (`status === requested && isEligibilityVerified === true`).
     - `funded`: Active agreements awaiting borrower repayment (`status === funded`).
     - `repaid`: Repaid agreements awaiting settlement (`status === repaid`).
     - `settled`: Concluded terminal agreements (`status === settled`).

### 15.3 Verified-State Derivation: Preserving the Canonical State Machine
A fundamental invariant of the protocol is that **the underlying Compact smart contract enum must remain unchanged**:
- **Compact Contract Enum**:
  ```compact
  enum LoanStatus { requested, funded, repaid, settled }
  ```
- **Attestation Flag**:
  `isEligibilityVerified: Boolean` is a separate on-chain public attestation updated only by the `verifyEligibility` circuit.
- **Frontend Derivation Rule**:
  The frontend **never** invents a fake contract state enum called `verified`. Instead, `VERIFIED` is derived strictly from:
  ```ts
  loan.status === LoanStatus.requested && loan.isEligibilityVerified === true
  ```
  This guarantees complete fidelity between the user interface and the underlying Midnight consensus layer.

### 15.4 Deterministic Integer Sorting
Sorting is executed using exact BigInt comparisons:
- Options: `Principal: Low → High`, `Principal: High → Low`, `Interest Rate: Low → High`, `Interest Rate: High → Low`, `Duration: Short → Long`, `Duration: Long → Short`.
- **Zero Floating-Point Drift**: Arithmetic on basis points and principal units strictly avoids IEEE-754 floating-point operations.
- **Deterministic Tie-Breaking**: When metrics are equal between agreements, ties are broken deterministically using `a.id.localeCompare(b.id)`.

### 15.5 Lifecycle-Aware UI Actions via Canonical Contract Guards
The UI actions panel does not replicate or re-implement contract state machine rules. Instead, it directly connects to the canonical client lifecycle guards (`contracts/client/loan-api.ts`):
- `canVerifyEligibility(loan)`: Enables off-chain ZK verification action for unverified requested loans.
- `canFundLoan(loan)`: Enables capital commitment action for verified requested loans.
- `canRepayLoan(loan)`: Enables simple-interest repayment action for funded loans.
- `canSettleLoan(loan)`: Enables terminal settlement closure for repaid loans.

### 15.6 Strict Privacy Boundary & Details Panel Separation
The Loan Details Panel (`LoanSummaryCard.tsx`) prominently partitions displayed data into two distinct architectural categories:
1. **PUBLIC AGREEMENT INFORMATION**:
   Transparent on-chain parameters published to the Midnight ledger (Principal, Interest Rate, Obligation, Duration, Threshold, Attestation Status, Borrower and Lender public keys).
2. **PRIVATE BORROWER INFORMATION**:
   Explicitly designated as **Intentionally Unavailable & Excluded**. Confidential underwriting data, bank statements, income, and secret witnesses are never received by or stored within the frontend application tree.


---

## 16. Lender Loan Evaluation & Funding UX (Commit #16)

Commit #16 introduces the typed lender loan evaluation service and funding confirmation workflow, allowing prospective liquidity providers to inspect, assess, and simulate funding of public loan agreements without compromising borrower privacy.

### 16.1 Architecture & Component Hierarchy

```
frontend/src/
├── types/
│   └── lender.ts                 # Strongly typed lender evaluation and funding contracts
├── lib/
│   └── lender-evaluation.ts       # Deterministic evaluation engine & BigInt return calculations
├── components/
│   ├── LenderEvaluationPanel.tsx  # Assessment dashboard, metrics, warnings & review drawer
│   └── FundingConfirmation.tsx    # Post-funding confirmation card with explicit prototype disclosure
└── pages/
    └── DashboardPage.tsx          # Orchestrates marketplace selection with lender evaluation
```

### 16.2 Strict Information Separation During Evaluation

When a prospective lender inspects an agreement on the marketplace, the evaluation engine (`frontend/src/lib/lender-evaluation.ts`) consumes **strictly public data** defined by the `LoanDetailsModel` interface:

* **Public Terms Evaluated**:
  - Principal Amount (`amount`: `bigint`)
  - Interest Rate (`interestRateBasisPoints`: `number`)
  - Agreed Duration (`durationBlocks`: `bigint`)
  - Public Qualification Threshold (`eligibilityThreshold`: `bigint`)
  - Borrower Public Account Key (`borrower`: `Uint8Array`)
  - Current Lifecycle Status (`status`: `LoanStatus`)
  - Public Attestation (`isEligibilityVerified`: `boolean`)
* **Strictly Excluded & Omitted**:
  - Off-chain witness credentials and secret salts
  - Borrower income, liquid balances, or personal identifiers
  - Financial records or proprietary underwriting inputs

### 16.3 Exact BigInt Financial Arithmetic

All projected lender earnings and expected returns are computed using exact integer basis-point arithmetic matching the canonical Midnight Compact smart contract rules:

$$\text{Interest Earnings} = \frac{\text{Principal} \times \text{RateBasisPoints}}{10000}$$
$$\text{Expected Return} = \text{Principal} + \text{Interest Earnings}$$

- **Zero Floating-Point Representation**: IEEE-754 numbers are strictly forbidden for currency and interest calculations to eliminate rounding drift across execution environments.
- **Canonical Parity**: Expected return delegates to the canonical `calculateRepaymentObligation` function, guaranteeing identical calculations across client, contract, and UI.

### 16.4 Contract-Guarded Funding Readiness Derivation

The evaluation panel derives the funding action state deterministically using canonical contract lifecycle rules from `canFundLoan`:

| Readiness Status | Condition | Lender UI Behavior |
| :--- | :--- | :--- |
| `READY_TO_FUND` | `status == requested && isEligibilityVerified && lender != borrower` | Funding review button enabled with green readiness badge |
| `ELIGIBILITY_NOT_VERIFIED` | `status == requested && !isEligibilityVerified` | Disabled; displays zero-knowledge attestation warning |
| `BORROWER_CANNOT_FUND_OWN_LOAN` | `lenderAccount == loan.borrower` | Disabled; warns that self-funding is prohibited |
| `LOAN_ALREADY_FUNDED` | `status == funded` | Disabled; displays active loan status notice |
| `AGREEMENT_CONCLUDED` | `status == repaid \|\| status == settled` | Disabled; displays terminal agreement notice |
| `LOAN_NOT_AVAILABLE` | Invalid status or undefined agreement | Action disabled |

### 16.5 Zero-Knowledge Underwriting Attestation

The evaluation interface provides prospective lenders with cryptographic confidence through a **Zero-Knowledge Underwriting Attestation**:
- Proves that the borrower's private financial metrics satisfied `eligibilityThreshold >= amount` inside an off-chain ZK circuit.
- Affirms to the lender that creditworthiness has been verified by the Midnight consensus layer without exposing any underlying financial records.

### 16.6 Step-by-Step Prototype Funding Workflow

1. **Loan Selection**: Lender selects any public loan request from the marketplace.
2. **Deterministic Evaluation**: UI calculates exact return metrics, interest earnings, and displays relevant risk warnings.
3. **Account Selection**: Lender selects their simulated public funding key.
4. **Interactive Review**: Lender clicks "Review & Prepare Funding" to open the confirmation drawer, displaying full commitment terms and legal disclosures.
5. **Simulated State Transition**: Lender commits funding, transitioning agreement state from `REQUESTED` to `FUNDED` and assigning the lender's public account key.
6. **Honest Post-Execution Confirmation**: The `FundingConfirmation` card renders with an explicit disclosure:
   - Lifecycle Status: `REQUESTED → FUNDED`
   - Lender Account Key: Hex commitment
   - Asset Transfer Status: **`"Not executed — local prototype mode"`**
   - Zero fabricated network transactions or simulated cryptographic hashes

---

## 17. Borrower Confidential Eligibility Verification (Commit #17)

Commit #17 completes the borrower-side confidential eligibility verification workflow, connecting the user interface directly to the Compact zero-knowledge prover architecture established in Commit #6 and Commit #7.

### 17.1 Workflow Architecture & Component Hierarchy

```
frontend/src/
├── types/
│   └── eligibility.ts                  # Strongly typed state machine, requests & results
├── lib/
│   └── eligibility-service.ts          # ZK circuit invocation, error sanitization & attestations
├── components/
│   ├── PrivateEligibilityInput.tsx      # Ephemeral password-style witness input with warnings
│   ├── EligibilityVerificationResult.tsx# Success/failure views with explicit privacy badges
│   └── EligibilityVerificationPanel.tsx # 5-step prover progression & summary terms
└── pages/
    └── DashboardPage.tsx               # Orchestrates borrower CTA, panel toggle & marketplace updates
```

### 17.2 The Strict Witness / Prover Boundary

The core security invariant of the borrower verification flow is that **confidential underwriting metrics never leave the local prover context**:

```
+-----------------------------------------------------------------------------------+
|                        BORROWER LOCAL ENVIRONMENT                                 |
|                                                                                   |
|  1. Ephemeral Input (PrivateEligibilityInput):                                    |
|     - Masked password input, never persisted, cleared immediately on submit       |
|                                                                                   |
|  2. Off-Chain Witness Provider (contracts/client/eligibility-client.ts):          |
|     - createEligibilityWitnessProvider(witnessAmount)                             |
|                                                                                   |
|  3. Local Circuit Prover Execution:                                               |
|     - Contract.circuits.verifyEligibility(circuitContext)                         |
|     - Verifies: witnessAmount >= eligibilityThreshold                             |
+-----------------------------------------------------------------------------------+
                                         |
                                         | [Outputs ZK Proof + Public Flag]
                                         v
+-----------------------------------------------------------------------------------+
|                            PUBLIC LEDGER STATE                                    |
|                                                                                   |
|  - status: LoanStatus.requested                                                   |
|  - isEligibilityVerified: true                                                    |
|  - Zero confidential witness data or underwriting metrics written to consensus    |
+-----------------------------------------------------------------------------------+
```

### 17.3 Transient Input Handling & Zero Persistence

To ensure borrower privacy is inviolable across the frontend stack:
1. **Password-Style Masking**: Input values are rendered with `type="password"`, `autoComplete="off"`, and `spellCheck={false}`.
2. **Immediate Erasure**: Upon clicking "Generate Confidential Proof", the input value is immediately cleared from React component state.
3. **Zero Browser Persistence**: Values are strictly forbidden from being stored in `localStorage`, `sessionStorage`, cookies, query parameters, or URL fragments.
4. **Zero Console Logging**: Neither the frontend UI nor the client service logs confidential values or witness structures.
5. **Sanitized Results**: `EligibilityVerificationResult` contains exclusively public metadata (`loanId`, `isVerified`, `updatedStatus`, `privacyAttestation`). The private input is omitted from the return payload.

### 17.4 Five-Phase Prover Execution Pipeline

When the borrower initiates verification, the UI visualizes the deterministic 5-stage cryptographic progression:
1. **Preparing private witness**: Binding off-chain confidential input to the local prover context.
2. **Generating zero-knowledge proof**: Constructing arithmetic constraints and blinding factors.
3. **Executing eligibility circuit**: Running the Compact `verifyEligibility` circuit to prove threshold satisfaction.
4. **Verifying result**: Checking proof validity locally before updating ledger state.
5. **Eligibility attested**: Updating the public `isEligibilityVerified` flag to `true`.

### 17.5 Compact Circuit Authority & Rejection Handling

The Compact smart contract circuit (`contracts/src/index.compact`) is the sole arbiter of eligibility. The frontend does not use JavaScript comparisons (`amount >= threshold`) as a substitute for cryptographic proofs:
- **Under-Threshold Rejection**: If the witness fails `witnessAmount >= eligibilityThreshold`, the Compact circuit throws an assertion error, which the service sanitizes to `"Eligibility requirement not satisfied."`.
- **Pre-Verified Prevention**: Re-verification attempts on already-verified agreements are rejected with `"Eligibility has already been verified for this agreement."`.
- **Invalid State Prevention**: Non-requested loans are blocked via canonical lifecycle guards with `"Eligibility verification is unavailable in the current loan state."`.
- **Unauthorized Borrower**: Callers who do not match the loan borrower key are rejected with `"Caller is not authorized to verify this loan request."`.

### 17.6 Local Prototype Limitations & Future Live Network Integration

- **Current Prototype Mode**: Proof generation executes locally in the browser/Node runtime via the `@midnight-ntwrk/compact-runtime` prover and updates local application state.
- **Honest Prototype Notice**: The UI explicitly informs users: `"Local prototype proof execution — state updated locally, no live network transaction."`
- **Future Milestone**: Live Midnight Network integration will submit the generated `proofData` to a Midnight validator node via Midnight.js and Lace Wallet transaction submission.

---

## 18. Borrower Repayment Frontend Workflow & Contract-Guarded UI (Commit #18)

Commit #18 implements the complete borrower repayment workflow across the client and React frontend layers, enabling borrowers of funded loans to review their immutable obligation and execute the state transition from `FUNDED` to `REPAID`.

### 18.1 Workflow Architecture & Component Structure

```
frontend/src/
├── types/
│   └── repayment.ts               # Domain types for repayment calculations, readiness, and results
├── lib/
│   └── repayment-service.ts       # Service delegating to canonical contract arithmetic and guards
├── components/
│   ├── RepaymentPanel.tsx         # Interactive repayment panel with review drawer & formula breakdown
│   ├── RepaymentConfirmation.tsx  # Confirmation card with lifecycle stepper & asset transfer disclaimers
│   └── LoanActionPanel.tsx        # Action panel wired to launch repayment panel for funded loans
├── pages/
│   └── DashboardPage.tsx          # Renders repayment CTA card, panel drawer, and repaid attestation banner
└── App.tsx                        # Global state management updating active loan registry upon repayment
```

### 18.2 Exact BigInt Arithmetic & Mathematical Parity

To ensure 100% mathematical parity with the underlying Midnight Compact circuit (`repayLoan`), the repayment workflow strictly avoids JavaScript floating-point calculations:
- **Basis Points Scale**: Interest rates are represented in basis points ($100\text{ bps} = 1.00\%$, $10000\text{ bps} = 100.00\%$).
- **Euclidean Integer Truncation**: Simple interest is computed as:
  $$\text{interestAmount} = \frac{\text{principal} \times \text{rateBasisPoints}}{10000\text{n}}$$
- **Canonical Obligation Invocation**: The total obligation calculation calls `calculateRepaymentObligation(principal, rateBasisPoints)` directly from the compiled contract workspace (`contracts/dist/index.js`), guaranteeing mathematical identity with on-chain consensus logic:
  $$\text{totalObligation} = \text{principal} + \text{interestAmount}$$

### 18.3 Contract-Guarded Repayment Readiness

Repayment execution is guarded by canonical lifecycle checks via `getRepaymentReadiness()`:
- **`READY_TO_REPAY`**: Loan status is `LoanStatus.funded` ($1$) and caller matches `loan.borrowerBytes`.
- **`LOAN_NOT_FUNDED`**: Rejected if loan status is `requested` ($0$).
- **`ALREADY_REPAID`**: Rejected if loan status is already `repaid` ($2$).
- **`AGREEMENT_CONCLUDED`**: Rejected if loan status is terminal `settled` ($3$).
- **`UNAUTHORIZED_BORROWER`**: Rejected if caller public key does not match borrower public key.
- **`LOAN_NOT_AVAILABLE`**: Handled gracefully if agreement data is missing or undefined.

### 18.4 Repayment User Experience & Two-Step Confirmation

1. **Active Loan Discovery**: When viewing a funded loan, the dashboard presents a prominent "Active Loan Awaiting Repayment" CTA banner.
2. **Review Drawer**: Clicking "Review Repayment" opens an obligation review drawer that clearly displays the mathematical breakdown:
   $$\text{Principal} + \text{Agreed Simple Interest} = \text{Total Repayment Obligation}$$
3. **Execution & Stepper Confirmation**: Confirming repayment triggers `executeRepaymentPrototype`, transitioning agreement status to `REPAID`, rendering the `RepaymentConfirmation` card with an updated lifecycle stepper (`REQUESTED → VERIFIED → FUNDED → REPAID → SETTLED`).

### 18.5 Privacy Guarantees & Zero Leakage

Unlike the initial eligibility verification phase (which executes an ephemeral zero-knowledge proof over confidential underwriting inputs), the repayment phase is **entirely public and deterministic**:
- Obligation is derived strictly from public immutable terms (`amount`, `interestRateBasisPoints`).
- No private witnesses, secrets, or off-chain credentials are required or accepted.
- A strict privacy audit ensures zero sensitive terminology or credential leakage throughout all repayment modules.

### 18.6 Honest Asset Transfer Disclosure

In local prototype mode, token escrow and cross-party asset transfers are not simulated or faked:
- The UI explicitly renders: `"Asset transfer is not executed in local prototype mode. State machine transition only."`
- The `assetTransferStatus` property explicitly reads `"Not executed — local prototype mode"`.
- Live token settlement will be integrated in upcoming milestones via Midnight Native Tokens and Lace Wallet signing.

---

## 19. Loan Settlement Frontend Workflow & Protocol Finality (Commit #19)

Commit #19 implements the final lifecycle state transition workflow (`REPAID → SETTLED`) across the client and React frontend layers, enabling either authorized participant (the borrower or the lender) to conclude a successfully repaid micro-loan agreement and transition it to the terminal `SETTLED` state.

### 19.1 Workflow Architecture & Component Structure

```
contracts/client/
├── loan-api.ts                    # Exports settleLoanAgreement and canonical lifecycle guard canSettleLoan
frontend/src/
├── types/
│   └── settlement.ts              # Domain types for settlement readiness, evaluations, requests, and results
├── lib/
│   └── settlement-service.ts      # Service layer wrapping canSettleLoan and executing prototype settlement
├── components/
│   ├── SettlementPanel.tsx        # Interactive settlement panel with role switcher, readiness badge & drawer
│   ├── SettlementConfirmation.tsx # Terminal confirmation card with complete 5-phase stepper and protocol disclaimers
│   └── LoanActionPanel.tsx        # Action panel with contextual "Proceed to Settlement" trigger
├── pages/
│   └── DashboardPage.tsx          # Renders settlement CTA banner, drawer toggle, and terminal attestation card
└── App.tsx                        # Global agreement registry state handler onLoanSettled
```

### 19.2 Symmetrical Participant Authorization Model

In adherence to the core Compact smart contract logic (`settleLoan` circuit), settlement does not mandate a single unilateral party. Instead, it enforces **symmetrical authorization**:
- **Borrower Authorization**: The borrower whose public key matches `loan.borrowerBytes` may execute protocol settlement.
- **Lender Authorization**: The lender whose public key matches `loan.lenderBytes` may execute protocol settlement.
- **Third-Party Rejection**: Any caller whose public key matches neither participant is unconditionally rejected with the code `UNAUTHORIZED_PARTICIPANT`.
- **Interactive Role Switcher**: In `SettlementPanel.tsx`, the prototype UI offers a participant switcher allowing evaluators to execute settlement from either the borrower's or the lender's perspective.

### 19.3 Contract-Guarded Settlement Readiness

Settlement execution is governed strictly by the canonical lifecycle rules defined in `canSettleLoan(agreement, caller)`:
- **`READY_TO_SETTLE`**: Agreement status is `LoanStatus.repaid` ($2$), lender is assigned, and caller matches borrower or lender.
- **`LOAN_NOT_REPAID`**: Rejected if loan status is `requested` ($0$) or `funded` ($1$).
- **`ALREADY_SETTLED`**: Rejected if loan status is already in the terminal `settled` ($3$) state.
- **`UNAUTHORIZED_PARTICIPANT`**: Rejected if the caller is neither the designated borrower nor the lender.
- **`LOAN_NOT_AVAILABLE`**: Handled gracefully if agreement data is missing or corrupted.

### 19.4 Lifecycle Stepper & Protocol Finality

1. **Repayment Complete Discovery**: When viewing an agreement with status `REPAID`, the dashboard displays a prominent "Repayment Received — Agreement Ready for Final Settlement" banner.
2. **Review & Authorization**: The user reviews the public agreement parameters (principal, agreed interest, total settled obligation, borrower and lender keys) and selects their participant identity.
3. **Execution & Finality**: Confirming settlement triggers `executeSettlementPrototype`, transitioning agreement status to `SETTLED`. The UI renders `SettlementConfirmation.tsx` displaying:
   - The complete 5-phase protocol lifecycle stepper:
     $$\text{REQUESTED} \longrightarrow \text{VERIFIED} \longrightarrow \text{FUNDED} \longrightarrow \text{REPAID} \longrightarrow \mathbf{SETTLED}$$
   - Highlighted terminal protocol finality badge: all debt obligations extinguished, loan agreement locked against any subsequent transitions.
   - Comprehensive audit details: transaction ID, settled obligation amount, final timestamp, and participant identities.

### 19.5 Strict Privacy Guarantees & Zero Leakage

Like the funding and repayment workflows, settlement is entirely public and deterministic:
- Derived solely from public agreement identifiers and authorized public keys.
- Operates with zero knowledge of private borrower financial inputs, bank statements, or off-chain credentials.
- All code in `frontend/src/` passes automated privacy audits forbidding sensitive or secret terms.

### 19.6 Honest Prototype Disclosures

In accordance with protocol design standards, no real blockchain transactions or wallet signatures are fabricated:
- The UI explicitly renders: `"Asset transfer is not executed in local prototype mode. State machine transition only."`
- Settlement results record `assetTransferStatus: "Not executed — local prototype mode"`.
- Live on-chain settlement will be integrated in subsequent milestones via Midnight.js and Lace Wallet signing.

---

## 20. Wallet / Account Identity Abstraction & Authorization (Commit #20)

Commit #20 introduces a strongly typed, modular account and identity abstraction layer in the frontend and client layers. This architecture enables the application to reason cleanly about the active participant (Borrower, Lender, Third-Party, or Disconnected) and enforce dynamic authorization rules without prematurely coupling UI components to Lace Wallet or Midnight Network infrastructure.

### 20.1 Account Identity Model & Architecture Boundary

The account layer establishes an explicit architectural boundary separating user interface components from the underlying wallet and cryptographic provider.

```
React UI Components (Dashboard, Panels, Forms)
                    │
                    ▼
Account Abstraction Layer (AccountContext, AccountIdentity, Authorization)
                    │
                    ▼
       ┌────────────────────────┐
       │ Future Integration     │
       │ Midnight / Lace Wallet │
       └────────────────────────┘
                    │
                    ▼
       Midnight Blockchain Node
```

In Commit #20, this boundary is backed by a local prototype adapter (`frontend/src/lib/account-service.ts`) providing deterministic public account identities.

### 20.2 Prototype Account Personas

The service models 4 distinct account states:

| Persona | Public Key (Hex) | Role | Purpose |
| :--- | :--- | :--- | :--- |
| **Mock Borrower Account** | `0x0101...01` | `BORROWER` | Simulates the loan originator requesting and repaying micro-loans |
| **Mock Lender Account** | `0x0a0a...0a` | `LENDER` | Simulates a liquidity provider inspecting, evaluating, and funding loans |
| **Mock Third-Party Account** | `0x6363...63` | `PARTICIPANT` | Simulates an arbitrary observer account with zero participant rights |
| **Disconnected State** | `null` | `NONE` | Simulates an unauthenticated session prompting account connection |

All prototype identities explicitly declare `isPrototype: true`, `isRealNetwork: false`, and `networkName: 'Local Prototype'`.

### 20.3 Contract-Guarded Authorization Engine

Action permissions are evaluated dynamically via `getAccountAuthorization(loan, account)` in `frontend/src/lib/account-authorization.ts`. Rather than duplicating lifecycle logic, the authorization engine directly queries canonical lifecycle guards from `@contracts`:

- **Borrower Permissions**:
  - `canVerifyEligibility`: Permitted only if the active account matches `loan.borrowerBytes`, the agreement is in `requested` state, and eligibility is unverified (`canVerifyEligibility`).
  - `canRepayLoan`: Permitted only if the active account matches `loan.borrowerBytes` and the loan is `funded` (`canRepayLoan`).
  - `canSettleLoan`: Permitted if the active account matches `loan.borrowerBytes` and the loan is `repaid` (`canSettleLoan`).
- **Lender Permissions**:
  - `canFundLoan`: Permitted only if the active account is in `LENDER` persona, does not match borrower, and the loan is verified + requested (`canFundLoan`).
  - `canSettleLoan`: Permitted if the active account matches `loan.lenderBytes` and the loan is `repaid` (`canSettleLoan`).
- **Third-Party Restrictions**:
  - Accounts with `PARTICIPANT` persona or keys matching neither participant are unconditionally barred from all state-changing actions (`canVerifyEligibility = false`, `canFundLoan = false`, `canRepayLoan = false`, `canSettleLoan = false`).
- **Terminal Settled State**:
  - Agreements with status `settled` disable all participant actions universally.

### 20.4 UI Presentation & Authorization Awareness

1. **`AccountSwitcher.tsx`**: Renders an interactive persona switcher in the dashboard, enabling evaluators to seamlessly toggle between Borrower, Lender, Third-Party, and Disconnected states.
2. **`AccountStatusPanel.tsx`**: Renders an agreement-specific status panel displaying the active public key, persona role, and a live permission matrix (`✓` / `✕`) with human-readable rationale.
3. **`LoanActionPanel.tsx`**: Dynamically adapts the primary action button based on the combined authorization matrix:
   - Unverified Requested + Borrower: `"Execute ZK Proof (Off-Chain Prototype)"`
   - Verified Requested + Lender: `"Provide Loan Funding"`
   - Funded + Borrower: `"Repay Loan (Prototype Action)"`
   - Repaid + (Borrower / Lender): `"Settle Loan (Prototype Action)"`
   - Third Party: `"No Participant Action Available"` (disabled)
   - Disconnected: `"Connect Prototype Account"`
   - Settled: `"Loan Fully Settled"` (disabled)

### 20.5 Public Identity vs Cryptographic Secrets

The account abstraction strictly observes the protocol privacy invariant:
- Only public 32-byte account keys (`Uint8Array`) and hexadecimal strings are exposed to frontend components.
- Private signing keys, seed phrases, and confidential underwriting credentials are intentionally absent from all models, state, DOM, logs, and storage.
- Comprehensive automated regex audits scan all 31+ frontend source files to guarantee zero credential leakage.

### 20.6 Honest Prototype Disclosures

The application transparently communicates that no real wallet connection or network transaction is taking place:
- Badges explicitly declare `"Simulation Only • Offline Mode"` and `"Local Prototype"`.
- Warning banners state: `"No Real Wallet Connected: Operating in local prototype account mode. Public account identities are simulated deterministically."`

---

## 21. Persistent Local Loan Registry & Application State (Commit #21)

Commit #21 establishes an authoritative centralized loan registry layer (`LoanRegistry`, `application-store`) that serves as the single source of truth for all public loan agreements across the application. This architectural milestone eliminates fragmented and duplicated component-level states, guarantees immutable loan terms, enforces canonical protocol lifecycle transitions, integrates clean prototype persistence, and coordinates with account authorization.

### 21.1 Architecture & Single Source of Truth

Prior to Commit #21, agreement state was split between `App.tsx` and internal component state in `DashboardPage.tsx`, creating synchronization risks and allowing potential term mutations. Commit #21 introduces `LoanRegistry`, an immutable-update registry class:

```
App.tsx (Root Owner of registry: LoanRegistry)
  │
  ├── DashboardPage.tsx (Consumes loansMap, selectedLoan, onSelect, onAction)
  │     ├── LoanMarketplace.tsx (Filtered loans, counts from registry.getFilterCounts())
  │     ├── LoanSummaryCard.tsx (Public loan details)
  │     ├── AccountStatusPanel.tsx (Account authorization derived against registry loan)
  │     ├── LoanActionPanel.tsx (Action triggers bound to registry lifecycle methods)
  │     └── Workflow Panels (EligibilityVerificationPanel, LenderEvaluationPanel, RepaymentPanel, SettlementPanel)
  │
  └── CreateLoanPage.tsx (Inserts new agreement via registry.addLoan())
```

- **Deterministic Ordering**: Agreements preserve deterministic insertion order via `orderedIds` and `getAllLoans()`.
- **Unique Identifier Enforcement**: Adding duplicate loan IDs throws `LoanRegistryError('DUPLICATE_LOAN_ID')`.
- **Immutable Updates**: State modifications return a new `LoanRegistry` instance via functional immutable cloning, preventing accidental in-place mutations.

### 21.2 Immutability Guarantees & Term Preservation

In micro-lending protocols, financial agreement terms must remain strictly immutable once created. `LoanRegistry` enforces this via `assertImmutableTermsPreserved(existing, updated)` on every update:
- `amount` (Principal) cannot be modified.
- `interestRateBasisPoints` (Interest rate) cannot be modified.
- `durationBlocks` (Loan term) cannot be modified.
- `eligibilityThreshold` (ZK underwriting threshold) cannot be modified.
- `borrower` and `borrowerBytes` cannot be modified.
- If any of these fields diverge, `LoanRegistryError('IMMUTABLE_TERM_MUTATION')` is thrown immediately.

### 21.3 Canonical State Machine Enforcement

All state transitions are validated by `validateLifecycleTransition(fromStatus, toStatus, isVerified)` against the protocol state machine:

$$\text{REQUESTED (unverified)} \longrightarrow \text{REQUESTED (verified)} \longrightarrow \text{FUNDED} \longrightarrow \text{REPAID} \longrightarrow \mathbf{SETTLED}$$

| Current State | Target State | Permitted? | Condition / Method |
| :--- | :--- | :--- | :--- |
| `REQUESTED` (unverified) | `REQUESTED` (verified) | **Yes** | `registry.verifyLoanEligibility()` (caller must match borrower) |
| `REQUESTED` (verified) | `FUNDED` | **Yes** | `registry.fundLoan()` (caller must be lender, recorded in agreement) |
| `FUNDED` | `REPAID` | **Yes** | `registry.repayLoan()` (caller must match borrower) |
| `REPAID` | `SETTLED` | **Yes** | `registry.settleLoan()` (caller must match borrower or lender) |
| `SETTLED` | *Any* | **No** | Terminal state; throws `ALREADY_SETTLED` |
| `REQUESTED` | `REPAID` | **No** | Skipped funding; throws `INVALID_TRANSITION` |
| `REQUESTED` | `SETTLED` | **No** | Skipped funding & repayment; throws `INVALID_TRANSITION` |
| `FUNDED` | `VERIFIED` | **No** | Backward transition; throws `INVALID_TRANSITION` |
| `REPAID` | `FUNDED` | **No** | Backward transition; throws `INVALID_TRANSITION` |

### 21.4 Clean Persistence Adapter Boundary

The registry abstracts persistence through the `LoanRegistryPersistence` interface:
```typescript
export interface LoanRegistryPersistence {
  load(): Record<string, LoanDetailsModel> | null;
  save(loans: Record<string, LoanDetailsModel>): void;
  clear(): void;
}
```

Two concrete implementations are provided in `application-store.ts`:
1. **`InMemoryLoanRegistryPersistence`**: Default adapter for automated testing, server environments, and non-persistent sessions.
2. **`LocalStorageLoanRegistryPersistence`**: Browser-compatible adapter enabling prototype state to persist across browser reloads. It handles `BigInt` and `Uint8Array` serialization transparently and safely falls back to in-memory storage if storage is unavailable.

### 21.5 Strict Privacy Guarantees

The registry and persistence layers operate exclusively on public ledger data:
- `LoanDetailsModel` records contain only public metadata (`borrower`, `lender`, `amount`, `interestRateBasisPoints`, `durationBlocks`, `status`, `eligibilityThreshold`, `isEligibilityVerified`).
- No ephemeral witnesses, private financial inputs, bank statements, seed phrases, or private keys are ever accepted, stored, or serialized.
- Storage writes persist only sanitized public agreement records.
- Verified by automated privacy audits spanning all 34+ frontend source files.

### 21.6 Honest Prototype Disclosures

The application clearly discloses the nature of local storage and simulated state:
- The footer and UI badges explicitly declare: `"Commit #21 Prototype • In-Memory / Local Storage State Engine • Zero simulated blockchain transactions"`.
- All operations are acknowledged as local prototype state transitions without live Midnight Network consensus or token movements.

---

## 22. Midnight Network & Wallet Provider Abstraction (Commit #22)

Commit #22 establishes a clean, production-oriented architectural boundary between the frontend application and actual Midnight Network / wallet infrastructure. Rather than coupling business logic directly to mock identities, the application introduces a strongly typed provider abstraction layer (`WalletProvider`, `midnight-provider`), separating application-level account management from cryptographic and network providers.

### 22.1 Architectural Boundary & Layer Separation

```
React UI (Dashboard, Panels, Forms)
    │
    ▼
Application State & Registry (LoanRegistry, ApplicationStore)
    │
    ▼
Account Service Layer (AccountContext, AccountAuthorization)
    │
    ▼
Wallet Provider Interface (WalletProvider)
    │
    ├────────────────────────────────────────┐
    ▼                                        ▼
Local Prototype Provider             [FUTURE INTEGRATION]
(LocalPrototypeWalletProvider)       Midnight.js / Lace Wallet Adapter
    │                                        │
    ▼                                        ▼
Local In-Memory Simulation           Midnight Blockchain Node
```

This multi-tiered architecture ensures:
1. **Clean Separation of Concerns**: The React UI and loan registry interact only with the `AccountService` and `WalletProvider` interfaces.
2. **Pluggable Providers**: Future wallet integrations (e.g. Lace Wallet via Midnight.js) can be plugged in by implementing `WalletProvider` without altering component logic or lifecycle state machines.
3. **Honest Environment Reporting**: When running offline or in prototype mode, the provider explicitly declares `isPrototype: true`, `isRealNetwork: false`, and `environment: 'LOCAL'`, preventing false claims of live blockchain connectivity.

### 22.2 Strongly Typed Network & Provider Models

Domain types in `frontend/src/types/network.ts` and `frontend/src/types/transaction.ts` establish formal infrastructure models:

- **`NetworkEnvironment`**: `'LOCAL' | 'TESTNET' | 'MAINNET'`
- **`NetworkConnectionStatus` / `WalletConnectionStatus`**: `'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR'`
- **`NetworkContext`**: Captures active environment, network name, connection status, and prototype flags.
- **`NetworkAccount`**: Public identity containing 32-byte public key, hex string, public address, and role.
- **`ProviderError`**: Typed domain error hierarchy with codes (`PROVIDER_UNAVAILABLE`, `WALLET_NOT_CONNECTED`, `UNSUPPORTED_OPERATION`, `NETWORK_UNAVAILABLE`, `USER_REJECTED`, `INVALID_PROVIDER_STATE`).

### 22.3 Provider Capability Matrix

To cleanly demarcate what operations are genuinely available versus what requires future network infrastructure, the provider exposes an atomic capability matrix:

```typescript
export type ProviderCapability =
  | 'READ_PUBLIC_LEDGER'
  | 'CREATE_PROOF'
  | 'SIGN_TRANSACTION'
  | 'SUBMIT_TRANSACTION'
  | 'READ_TRANSACTION_STATUS'
  | 'READ_BALANCE';
```

In `LocalPrototypeWalletProvider`, capabilities are reported truthfully:

| Capability | Supported in Prototype? | Technical Basis |
| :--- | :--- | :--- |
| `READ_PUBLIC_LEDGER` | **Yes (true)** | Public agreement metadata queried from local authoritative `LoanRegistry` |
| `CREATE_PROOF` | **Yes (true)** | Supported via client-side Compact zero-knowledge prover workflow |
| `SIGN_TRANSACTION` | **No (false)** | Unavailable; no simulated or fake cryptographic signatures are created |
| `SUBMIT_TRANSACTION` | **No (false)** | Unavailable; zero fake on-chain transactions or simulated block confirmations |
| `READ_TRANSACTION_STATUS` | **No (false)** | Unavailable; no simulated transaction pool or block explorer queries |
| `READ_BALANCE` | **No (false)** | Unavailable; zero simulated native token balances |

### 22.4 Transaction Boundary & Anti-Fabrication Invariant

The `TransactionRequest` and `TransactionResult` models establish the future interface for on-chain state mutations. However, in accordance with protocol integrity rules:
- Attempting to submit a transaction via `LocalPrototypeWalletProvider.submitTransaction(request)` throws a typed `ProviderError('UNSUPPORTED_OPERATION')`.
- The user is informed: `"Live wallet transactions are unavailable in prototype mode."`
- **Zero fake transaction hashes, confirmations, or blocks are ever generated.**

### 22.5 ZK Witness Privacy Boundary

The zero-knowledge eligibility verification workflow remains strictly partitioned:
$$\text{Private Financial Witness} \longrightarrow \text{Local Compact Prover} \longrightarrow \text{ZK Proof} \longrightarrow \text{Wallet / Network Provider}$$
- The private financial value and off-chain underwriting witness **never cross the provider boundary**.
- `WalletProvider` methods accept and expose only public keys, public addresses, and public agreement IDs.
- Automated static analysis guarantees zero occurrences of confidential underwriting terms across all provider modules.

### 22.6 Network Status UI Component & Disclosures

`NetworkStatusPanel.tsx` renders a dedicated infrastructure card in the dashboard:
- **Environment**: `"Local Prototype (LOCAL)"`
- **Provider**: `"Local Prototype Provider"`
- **Status**: `"PROTOTYPE ACCOUNT ACTIVE"` or `"PROVIDER NOT CONNECTED"`
- **Capabilities**: Live badges for each capability in the matrix (Green `✓` for available local features, Red `✕` for unavailable network operations).
- **Honest Disclosure**: `"Notice: Operating with a local prototype provider. Live Midnight Network nodes and Lace Wallet signatures are not active."`

---

## 23. Transaction Orchestration & Provider Execution Boundary

Commit #23 establishes a dedicated **Transaction Orchestration Layer** (`frontend/src/lib/transaction-orchestrator.ts` and `frontend/src/types/transaction-orchestration.ts`) bridging the application's domain workflows with the underlying `WalletProvider` abstraction. This layer strictly separates pre-execution transaction validation from network execution while upholding all zero-knowledge privacy and anti-fabrication invariants.

### 23.1 Orchestration Pipeline: Preparation vs. Execution

The transaction lifecycle is partitioned into two distinct, deterministic phases:

```
[User Action in UI]
        │
        ▼
1. Transaction Preparation: prepareLifecycleTransaction()
   ├── Validate Public Agreement Parameters (status != INVALID)
   ├── Enforce Contract Authorization Guards (canVerify, canFund, canRepay, canSettle)
   ├── Evaluate Provider Capability Matrix (missingCapabilities check)
   └── Produce Read-Only Preparation Descriptor: TransactionPreparation
        │
        ├────────────────────────────────┬───────────────────────────────┐
        ▼                                ▼                               ▼
[BLOCKED / INVALID]             [UNSUPPORTED]                         [READY]
(Contract Guard Failed)         (Lacks Provider Capability)           (All Requirements Satisfied)
- Return reason to UI           - Return typed UNSUPPORTED            - Proceed to execution
- Do NOT proceed                - Do NOT mutate LoanRegistry          - Off-chain proof or submit
                                                                         │
                                                                         ▼
                                2. Transaction Execution: executeLifecycleTransaction()
                                   ├── Local ZK Proof Generation (off-chain)
                                   └── Delegate to WalletProvider.submitTransaction()
```

1. **Transaction Preparation (`prepareLifecycleTransaction`)**:
   - Evaluates caller role and contract invariants using canonical guards (`canVerifyEligibility`, `canFundLoan`, `canRepayLoan`, `canSettleLoan`).
   - Assesses active provider capabilities against the action's operational requirements.
   - **Guaranteed Read-Only & Idempotent**: Preparation produces a structured `TransactionPreparation` descriptor without mutating registry state, storing state, or dispatching calls.

2. **Transaction Execution (`executeLifecycleTransaction`)**:
   - Executes authorized, supported lifecycle actions through the active provider adapter.
   - In local prototype mode, on-chain actions return a typed `UNSUPPORTED` outcome with honest technical disclosures.
   - **Critical State Preservation Invariant**: An unsupported or failed transaction attempt **never mutates the central `LoanRegistry`**. Unconfirmed transactions do not alter status, lender bindings, or timestamps.

### 23.2 Canonical Circuit Dispatch Mapping

Every high-level protocol action maps 1:1 to its exact Midnight Compact contract circuit:

```typescript
export const ACTION_TO_CIRCUIT_MAP: Record<LifecycleTransactionAction, string> = {
  VERIFY_ELIGIBILITY: 'verifyEligibility',
  FUND_LOAN: 'fundLoan',
  REPAY_LOAN: 'repayLoan',
  SETTLE_LOAN: 'settleLoan',
};
```

This guarantees architectural consistency across documentation, client logging, and future on-chain RPC dispatches.

### 23.3 Required Provider Capabilities Matrix

Each lifecycle action declares its minimal required provider capabilities:

| Lifecycle Action | Canonical Circuit | Required Provider Capabilities | Prototype Provider Availability |
| :--- | :--- | :--- | :--- |
| `VERIFY_ELIGIBILITY` | `verifyEligibility` | `CREATE_PROOF` | **Supported (Local off-chain ZK prover)** |
| `FUND_LOAN` | `fundLoan` | `SIGN_TRANSACTION`, `SUBMIT_TRANSACTION` | **Unsupported (Typed 'UNSUPPORTED' result)** |
| `REPAY_LOAN` | `repayLoan` | `SIGN_TRANSACTION`, `SUBMIT_TRANSACTION` | **Unsupported (Typed 'UNSUPPORTED' result)** |
| `SETTLE_LOAN` | `settleLoan` | `SIGN_TRANSACTION`, `SUBMIT_TRANSACTION` | **Unsupported (Typed 'UNSUPPORTED' result)** |

### 23.4 Anti-Fabrication & Ledger Safety Invariants

1. **Zero Fake Blockchain Primitives**:
   - When executing unsupported actions in prototype mode, `executeLifecycleTransaction` returns:
     ```typescript
     {
       success: false,
       status: 'UNSUPPORTED',
       action: 'FUND_LOAN',
       circuitName: 'fundLoan',
       message: 'Live wallet transaction execution is unavailable in prototype mode.',
       unsupportedReason: 'Missing required provider capabilities: SIGN_TRANSACTION, SUBMIT_TRANSACTION',
       transactionId: undefined, // NEVER fabricated
       blockHeight: undefined,   // NEVER fabricated
     }
     ```
   - No synthetic transaction hashes, faux gas fees, or mock block confirmations are generated.

2. **Strict LoanRegistry Immutability**:
   - Automated test `Test 165` verifies that attempting an unsupported transaction execution leaves the `LoanRegistry` completely untouched.
   - Status remains `requested`, lender remains unbound (`null`), and lifecycle integrity is preserved.

### 23.5 Zero-Knowledge Privacy Isolation

- The transaction orchestrator accepts only public agreement data (`LoanDetailsModel`), public participant keys, and circuit names.
- Private underwriting witnesses, financial metrics, and credentials are strictly excluded from all orchestration parameters, return types, and error structures.
- Static privacy tests scan all frontend source files (41+ files) to enforce zero occurrences of private financial terms across the orchestration layer.

### 23.6 UI Integration: Lifecycle Dispatch Panel

`NetworkStatusPanel.tsx` incorporates an interactive **Lifecycle Transaction Dispatch** monitor:
- **Supported Local Actions**: Clearly displays `VERIFY_ELIGIBILITY` as available off-chain via the client ZK prover.
- **Unsupported Network Actions**: Clearly identifies `FUND_LOAN`, `REPAY_LOAN`, and `SETTLE_LOAN` as unavailable until live Midnight network connection is active.

---

## 24. Midnight / Lace Wallet Adapter Integration Boundary

### 24.1 Verified Midnight Integration Surface

An exhaustive audit of the repository dependencies confirms the exact boundaries of installed Midnight packages versus components requiring future SDK and wallet integration:

| Layer / Component | Package / Source | Status in Commit #24 | Operational Scope |
| :--- | :--- | :--- | :--- |
| **Compact Smart Contract** | `contracts/src/index.compact` | **AVAILABLE NOW** | Foundational ledger state, 5-phase lifecycle circuits (`verifyEligibility`, `fundLoan`, `repayLoan`, `settleLoan`), and state inspection. |
| **Compact Runtime** | `@midnight-ntwrk/compact-runtime` (v0.16.0) | **AVAILABLE NOW** | Low-level Compact execution engine and runtime primitives. |
| **Onchain Runtime** | `@midnight-ntwrk/onchain-runtime-v3` (v3.1.1) | **AVAILABLE NOW** | On-chain ledger state machine and cryptographic constraint evaluation. |
| **Client Lifecycle API** | `@midnight-p2p/contracts` (`loan-api.ts`, `LoanDesk`) | **AVAILABLE NOW** | Typed lifecycle facade, canonical contract guards, BigInt repayment math, and error mapping. |
| **Client Off-chain ZK Prover** | `contracts/client/witness.ts` | **AVAILABLE NOW** | Off-chain zero-knowledge eligibility proof generation against Compact circuit constraints. |
| **Local Prototype Provider** | `LocalPrototypeWalletProvider` (`frontend/src/lib/midnight-provider.ts`) | **AVAILABLE NOW** | Offline simulated identity provider supporting role switching (`BORROWER`, `LENDER`, `THIRD_PARTY`). |
| **Central Loan Registry** | `LoanRegistry` (`frontend/src/lib/loan-registry.ts`) | **AVAILABLE NOW** | Single source of truth for public loan agreements with immutable term enforcement. |
| **Transaction Orchestrator** | `TransactionOrchestrator` (`frontend/src/lib/transaction-orchestrator.ts`) | **AVAILABLE NOW** | Two-phase lifecycle preparation and capability validation pipeline. |
| **Midnight / Lace Wallet Adapter** | `MidnightWalletAdapter` (`frontend/src/lib/midnight-wallet-adapter.ts`) | **AVAILABLE NOW** | Production-ready browser connector boundary, detection state machine, capability disclosure, and anti-fabrication rejections. |
| **DApp Connector SDK** | `@midnight-ntwrk/dapp-connector-api` | **REQUIRES FUTURE SDK / WALLET** | Browser wallet injection standard (`window.midnight`) and CIP-30 style wallet session handshake. |
| **Midnight.js Client SDK** | `@midnight-ntwrk/midnight-js-*` | **REQUIRES FUTURE SDK / WALLET** | High-level ledger client for contract deployment, proof server orchestration, and balance queries. |
| **Lace Wallet Web Extension** | Midnight-enabled Lace Wallet | **REQUIRES FUTURE SDK / WALLET** | Secure cryptographic key enclave for live transaction signing and identity attestation. |
| **Live Network RPC & Consensus** | Midnight Testnet / Mainnet | **REQUIRES FUTURE SDK / WALLET** | Decentralized consensus, transaction inclusion, block confirmation, and live asset settlement. |

> [!IMPORTANT]
> **Anti-Fabrication Guarantee**: Commit #24 establishes the honest structural adapter boundary without installing speculative npm packages or inventing unverified mock APIs. Uninstalled SDK capabilities are reported truthfully as unavailable.

### 24.2 Architecture & Adapter State Machine

The `MidnightWalletAdapter` implements the canonical `WalletProvider` interface and coordinates browser connector detection, connection lifecycle, and capability negotiation:

```
+───────────────────────────────────────────────────────────────────────────+
|                         MIDNIGHT WALLET ADAPTER                           |
|                 (frontend/src/lib/midnight-wallet-adapter.ts)             |
|                                                                           |
|  1. Detection Engine (getDetectionStatus()):                              |
|     ├── Non-browser Node / SSR environment       ──► UNSUPPORTED          |
|     ├── Browser window.midnight undefined        ──► NOT_DETECTED         |
|     └── Browser window.midnight present          ──► DETECTED             |
|                                                                           |
|  2. Connection State Machine (connect() / disconnect()):                  |
|     ├── NOT_DETECTED / UNSUPPORTED               ──► Throws typed error   |
|     ├── User rejects extension authorization     ──► USER_REJECTED        |
|     ├── User approves extension authorization    ──► CONNECTED (public PK)|
|     └── disconnect()                             ──► DISCONNECTED         |
|                                                                           |
|  3. Capability Negotiation (getCapabilities()):                           |
|     ├── Disconnected: SIGN=false, SUBMIT=false, QUERY=false, PROOF=false  |
|     └── Connected:    SIGN=true,  SUBMIT=true,  QUERY=false, PROOF=false  |
|                                                                           |
|  4. Anti-Fabrication Transaction Boundary (submitTransaction()):          |
|     └── Always throws WalletAdapterError('UNSUPPORTED_OPERATION')         |
+───────────────────────────────────────────────────────────────────────────+
```

### 24.3 Typed Error Taxonomy

All adapter operations return structured domain errors via `WalletAdapterError`:

```typescript
export type WalletAdapterErrorCode =
  | 'WALLET_NOT_DETECTED'
  | 'USER_REJECTED'
  | 'CONNECTION_FAILED'
  | 'UNSUPPORTED_OPERATION'
  | 'NOT_CONNECTED'
  | 'NETWORK_MISMATCH';
```

- **`WALLET_NOT_DETECTED`**: Thrown when `connect()` is invoked without the Midnight / Lace browser extension installed.
- **`USER_REJECTED`**: Thrown when the user cancels or denies the wallet connection prompt.
- **`UNSUPPORTED_OPERATION`**: Thrown on non-browser environments or when attempting transaction submission before live Midnight SDK integration.
- **`NOT_CONNECTED`**: Thrown when transaction operations are attempted while the adapter is disconnected.

### 24.4 Dual-Provider Architecture & Runtime Switching

The application cleanly supports two concurrent provider adapters through `AccountService`:

1. **`LocalPrototypeWalletProvider` (`LOCAL_PROTOTYPE`)**:
   - Default provider for offline prototyping, development, and test suites.
   - Allows instant persona switching (`Borrower`, `Lender`, `Third Party`) without requiring browser extensions.
   - Executes local off-chain ZK eligibility verification.

2. **`MidnightWalletAdapter` (`MIDNIGHT_LACE`)**:
   - Live integration boundary for genuine browser wallet connectors (`window.midnight`).
   - Discloses honest detection status and rejects unsupported operations without fabrication.
   - Can be activated at runtime via `accountService.switchToMidnightAdapter()` and restored via `accountService.switchToPrototypeProvider()`.

### 24.5 Strict Anti-Fabrication & Registry Preservation Invariants

1. **Zero Synthetic Blockchain Primitives**:
   - `submitTransaction` never returns mock transaction hashes (`0x...`), synthetic block heights, or fabricated confirmations.
   - In prototype mode and in the current adapter boundary, unexecutable network transactions fail cleanly with typed errors.

2. **Registry Immutability on Unsupported Operations**:
   - Attempted lifecycle transactions that are rejected by the adapter (e.g. `fundLoan`, `repayLoan`, `settleLoan`) **never mutate the central `LoanRegistry`**.
   - Verified by automated tests `Test 194` and `Test 195`: agreement status remains unchanged, lender accounts remain unbound, and state transitions remain strictly protected by contract invariants.

3. **Strict Zero-Knowledge Privacy Isolation**:
   - Static analysis verifies that across all 43+ files in `frontend/src/`, zero private underwriting credentials, private keys, or financial secrets exist.
   - The wallet adapter only ever handles public account addresses and public agreement terms.

### 24.6 UI Integration: Wallet Connection Panel

The `WalletConnectionPanel` component is mounted directly on the dashboard above the `NetworkStatusPanel`:
- **Provider Selector**: Allows evaluators to switch between `Local Prototype Provider` and `Midnight / Lace Wallet Adapter`.
- **Status Indicators**: Real-time badges for detection status (`DETECTED`, `NOT_DETECTED`, `UNSUPPORTED`) and connection status (`CONNECTED`, `DISCONNECTED`, `CONNECTING`).
- **Public Identity Display**: Displays public account identifier when connected.
- **Atomic Capabilities Matrix**: Real-time inspection of active provider capabilities.
- **Honest Disclosures**: Clear callouts explaining that live transaction submission requires future Midnight SDK and Lace extension integration.

---

## 25. Wallet Session Management & Transaction Readiness Boundary

### 25.1 Architecture & Session Lifecycle
The `WalletSessionService` (`frontend/src/lib/wallet-session-service.ts`) and domain types (`frontend/src/types/wallet-session.ts`) introduce a dedicated, reactive session management layer.

```
+───────────────────────────────────────────────────────────────────────────+
|                         WALLET SESSION SERVICE                            |
|                  (frontend/src/lib/wallet-session-service.ts)             |
|                                                                           |
|  1. Session Lifecycle State Machine:                                      |
|     ├── DISCONNECTED  ──(connect())──► CONNECTING                         |
|     ├── CONNECTING    ──(approved)──►  CONNECTED (with public PK/address) |
|     ├── CONNECTING    ──(denied)──►    REJECTED (USER_REJECTED error)     |
|     ├── CONNECTING    ──(missing)──►   UNSUPPORTED (WALLET_NOT_DETECTED)  |
|     └── CONNECTED     ──(disconnect)─► DISCONNECTED                       |
|                                                                           |
|  2. Reactive Observer Subscription:                                       |
|     └── subscribe(listener: (session: WalletSession) => void): () => void |
|                                                                           |
|  3. Dual-Provider Coordination:                                           |
|     ├── switchToPrototypeProvider() ──► Offline simulation session        |
|     └── switchToMidnightAdapter()   ──► Browser connector session         |
+───────────────────────────────────────────────────────────────────────────+
```

### 25.2 Integration With AccountService
The `accountService` (`frontend/src/lib/account-service.ts`) delegates directly to the wallet session singleton:
- **Zero Identity Duplication**: Public account addresses, public key bytes, and connection status are derived directly from the underlying provider session.
- **Explicit Simulation Marking**: Prototype identities are clearly tagged with `isPrototype: true`, while genuine adapter identities carry `isPrototype: false`.
- **Honest Disconnection Handling**: When disconnected, account identity resolves to null with role `NONE` and connection status `DISCONNECTED`.

### 25.3 Comprehensive Pre-Execution Transaction Preparation
The `prepareLifecycleTransaction` pipeline (`frontend/src/lib/transaction-orchestrator.ts`) evaluates all preconditions before transaction dispatch:

1. **Agreement Validation**: Missing or corrupted agreement records return `status: 'INVALID'`.
2. **Session / Account Connection Guard**: Disconnected sessions or missing caller accounts return `status: 'BLOCKED'`.
3. **Wallet Detection Check**: Real adapters where browser connectors are missing (`NOT_DETECTED` or `UNSUPPORTED`) return `status: 'UNSUPPORTED'`.
4. **Contract Circuit & Authorization Guards**: Canonical Compact contract assertions (`canVerifyEligibility`, `canFundLoan`, `canRepayLoan`, `canSettleLoan`) evaluate caller rights. Unauthorized callers return `status: 'BLOCKED'`.
5. **Atomic Capabilities Check**: Verifies active provider capabilities against action requirements:
   - `VERIFY_ELIGIBILITY`: requires `CREATE_PROOF` (Available locally via client ZK prover ──► `READY`).
   - `FUND_LOAN`, `REPAY_LOAN`, `SETTLE_LOAN`: require `SIGN_TRANSACTION` and `SUBMIT_TRANSACTION` (Missing in prototype mode ──► `UNSUPPORTED`).

### 25.4 Canonical Circuit Mapping (1:1 Invariant)
Every lifecycle action maps deterministically 1:1 to its corresponding Midnight Compact circuit:
- `VERIFY_ELIGIBILITY` ↔ `verifyEligibility`
- `FUND_LOAN` ↔ `fundLoan`
- `REPAY_LOAN` ↔ `repayLoan`
- `SETTLE_LOAN` ↔ `settleLoan`

### 25.5 Pre-Execution Transaction Review UI
The `TransactionReviewPanel` (`frontend/src/components/TransactionReviewPanel.tsx`) renders the preparation evaluation to the user:
- Displays agreement ID, lifecycle action, mapped Compact circuit, caller role, and sanitized public identity.
- Renders atomic capability comparison (required vs available).
- Exposes real-time readiness status badges: `READY`, `BLOCKED`, `UNSUPPORTED`, `INVALID`.
- For local ZK verification: clearly explains that proof generation occurs locally off-chain without disclosing secret underwriting parameters.
- For unsupported on-chain actions: explicitly states "Live transaction signing/submission is unavailable in the current environment."
- Prevents execution dispatch if preparation status is not `READY`.

### 25.6 Interactive Wallet Session UI
The `WalletSessionPanel` (`frontend/src/components/WalletSessionPanel.tsx`) displays:
- Provider switcher toggle (`LOCAL PROTOTYPE` vs `MIDNIGHT/LACE ADAPTER`).
- Real-time detection badge (`CONNECTOR DETECTED`, `WALLET NOT DETECTED`, `CONNECTOR UNSUPPORTED`).
- Session status indicator (`DISCONNECTED`, `CONNECTING`, `CONNECTED`, `UNSUPPORTED`, `REJECTED`, `FAILED`).
- Connected public account identity.
- Network status badge (`LIVE NETWORK NOT AVAILABLE`).
- Atomic capabilities matrix.
- Interactive connection and role management controls.

### 25.7 Anti-Fabrication & Strict Privacy Invariants
1. **Zero Fake Blockchain Primitives**:
   - No mock transaction hashes (`0x...`), synthetic block heights, or fabricated confirmations are generated.
2. **LoanRegistry State Preservation**:
   - Unsupported or failed transaction attempts **never mutate the central `LoanRegistry`**. Unconfirmed actions leave status and lender assignments untouched.
3. **Zero-Knowledge Privacy Isolation**:
   - Comprehensive static analysis across all 46+ frontend source files verifies that zero private financial terms exist in frontend state, DOM, or storage.

---

## 26. Transaction Execution & Confirmation Boundary (Commit #26)

Commit #26 implements the **Real-Wallet Transaction Execution Boundary** (`frontend/src/lib/transaction-execution-service.ts` and `frontend/src/types/transaction-execution.ts`) on top of the established `WalletProvider`, `MidnightWalletAdapter`, `WalletSessionService`, `TransactionOrchestrator`, and `LoanRegistry`.

```
+───────────────────────────────────────────────────────────────────────────+
|                  TRANSACTION EXECUTION PIPELINE ARCHITECTURE              |
+───────────────────────────────────────────────────────────────────────────+
|                                                                           |
|   1. PREPARE (Read-Only)                                                  |
|      ├── Contract Guards: canVerifyEligibility / canFund / canRepay / ... |
|      ├── Session Check: session.status === 'CONNECTED'                    |
|      └── Capability Matrix: checks required vs available provider caps    |
|                                                                           |
|   2. REVIEW (User Transparency)                                           |
|      ├── Displays mapped Compact circuit name                             |
|      ├── Exposes caller authorization and public identity                 |
|      └── Discloses honest prototype & adapter limitations                 |
|                                                                           |
|   3. EXECUTE & SUBMIT (Provider Boundary Delegation)                      |
|      ├── VERIFY_ELIGIBILITY: Local client ZK proof execution              |
|      └── FUND / REPAY / SETTLE: Delegated to activeProvider.submitTx()    |
|                                                                           |
|   4. SUBMISSION OUTCOMES                                                  |
|      ├── REJECTED: User denied wallet signature (REJECTED_SIGNATURE)      |
|      ├── UNSUPPORTED: Mode lacks on-chain submission capabilities         |
|      ├── FAILED: Provider RPC or assertion failure                        |
|      ├── PENDING: Transaction broadcast, awaiting network confirmation    |
|      └── CONFIRMED: Verified on-chain receipt from network provider       |
|                                                                           |
|   5. REGISTRY MUTATION INVARIANT                                          |
|      ├── CONFIRMED ONLY: Mutates LoanRegistry into next lifecycle phase   |
|      └── PENDING / UNSUPPORTED / FAILED: LoanRegistry PRESERVED           |
+───────────────────────────────────────────────────────────────────────────+
```

### 26.1 Separation of Preparation, Review, Execution, and Confirmation
A fundamental architectural guarantee is the strict chronological and functional separation of transaction stages:

1. **PREPARE (`prepareLifecycleTransaction`)**:
   - Strictly read-only and idempotent.
   - Evaluates caller rights and agreement parameters without modifying ledger or application state.
2. **REVIEW (`TransactionReviewPanel`)**:
   - Renders honest technical notices, Compact circuit bindings, and capability matrices.
   - Discloses whether the action is ready, blocked by contract assertions, or unsupported in the current environment.
3. **EXECUTE (`TransactionExecutionService.executeTransaction`)**:
   - Resolves the active session and provider.
   - Packages a sanitized public request containing only agreement terms and public caller keys.
   - Delegates network communication and transaction signing to the provider abstraction.
4. **CONFIRMATION & REGISTRY MUTATION**:
   - The central `LoanRegistry` is **only mutated upon genuine confirmation**.
   - If a transaction is `PENDING`, agreement state is preserved as `UNCONFIRMED_PRESERVED` without advancing the protocol lifecycle.

### 26.2 Canonical 1:1 Circuit Mapping
Every lifecycle action maps deterministically 1:1 to its underlying Midnight Compact smart contract circuit:
- `VERIFY_ELIGIBILITY` $\longleftrightarrow$ `verifyEligibility`
- `FUND_LOAN` $\longleftrightarrow$ `fundLoan`
- `REPAY_LOAN` $\longleftrightarrow$ `repayLoan`
- `SETTLE_LOAN` $\longleftrightarrow$ `settleLoan`

### 26.3 Prototype Mode vs Real Adapter Boundary
- **Local Prototype Mode (`LocalPrototypeWalletProvider`)**:
  - `VERIFY_ELIGIBILITY`: Successfully generates and validates proofs locally off-chain using the client zero-knowledge prover.
  - `FUND_LOAN`, `REPAY_LOAN`, `SETTLE_LOAN`: Returns typed `status: 'UNSUPPORTED'` with domain code `UNSUPPORTED_CAPABILITY`. Clearly informs the user: *"Live transaction submission is unavailable in prototype mode."*
- **Real Adapter Boundary (`MidnightWalletAdapter`)**:
  - Browser detection evaluates `window.midnight`.
  - When browser connector SDK is not yet installed, transaction attempts throw `WalletAdapterError('UNSUPPORTED_OPERATION')`.
  - Handles user signature denial with `USER_REJECTED` $\to$ `REJECTED_SIGNATURE`.
  - Displays genuine transaction receipts (`transactionId`, `blockHeight`) only when authentically returned by the provider.

### 26.4 Anti-Fabrication Guarantees
- **Zero Mock Identifiers**: Never fabricates synthetic transaction hashes (`0x...`), mock block numbers, or artificial network confirmations.
- **State Preservation on Pending/Unconfirmed**: If confirmation status is unknown or pending, the agreement status remains unchanged on the client.

### 26.5 Zero-Knowledge Privacy Boundary
- **No Secret Witnesses across Provider Boundary**: Neither borrower financial witnesses nor secret underwriting criteria are passed to `submitTransaction`.
- **Public Parameters Only**: The provider boundary receives only public identifiers: `loanId`, `action`, `callerPublicKey`.
- **Static Verification**: Automated tests continuously audit all 51+ frontend files to verify 0 occurrences of prohibited financial terms.

---

## 27. Midnight Network Configuration & Connector Discovery (Commit #27)

Commit #27 implements an authoritative configuration and wallet connector discovery layer for the Midnight Network environment, establishing strict boundaries between local prototype operation and real Midnight wallet integration.

```
+───────────────────────────────────────────────────────────────────────────────────+
|               MIDNIGHT NETWORK CONFIGURATION & CONNECTOR DISCOVERY                |
|                                                                                   |
|  [NetworkConfigService]               [WalletConnectorDiscovery]                  |
|    - Active Network Config              - Browser Runtime Check                   |
|    - Environment Validation             - window.midnight Detection               |
|    - Node RPC & Indexer Endpoints       - Capability Negotiation                  |
|    - Local / Devnet / Testnet / Mainnet - Connector Readiness State Machine       |
|            │                                      │                               |
|            ▼                                      ▼                               |
|  ┌─────────────────────────────────────────────────────────────────────────────┐  |
|  │                        FOUR CRITICAL INVARIANT STAGES                       │  |
|  │                                                                             │  |
|  │  1. CONNECTOR DETECTED != CONNECTED                                         │  |
|  │     - Presence of window.midnight does NOT imply user has granted access   │  |
|  │                                                                             │  |
|  │  2. CONNECTOR CONNECTED != TRANSACTION CAPABLE                              │  |
|  │     - Active connection does NOT guarantee signing/submission capabilities  │  |
|  │                                                                             │  |
|  │  3. LOCAL PROTOTYPE PROVIDER:                                               │  |
|  │     - Signing Capability: FALSE                                             │  |
|  │     - Submission Capability: FALSE                                          │  |
|  │     - Zero synthetic confirmations or fake block heights                   │  |
|  │                                                                             │  |
|  │  4. TRANSACTION READINESS GATE:                                             │  |
|  │     - Evaluates: Network Config Valid + Wallet Connected + Capabilities     │  |
|  │     - Readiness Reasons: BLOCKED_NETWORK_CONFIGURATION,                     │  |
|  │       BLOCKED_WALLET_DISCONNECTED, BLOCKED_UNSUPPORTED_ACTION, READY        │  |
|  └─────────────────────────────────────────────────────────────────────────────┘  |
|            │                                                                      |
|            ▼                                                                      |
|  [TransactionExecutionService] & [TransactionOrchestrator]                        |
|    - Pre-execution validation verifies network configuration and capabilities     |
|    - Disallows live submission on local prototype with explicit technical reasons |
|    - Preserves LoanRegistry state when transaction is unsupported or pending     |
+───────────────────────────────────────────────────────────────────────────────────+
```

### 27.1 Network Configuration Model & Environments
Network configuration is governed by `NetworkConfigService` as the single authoritative source of truth:
- **`LOCAL`**: Development and prototype environment. Local mock network does not require external RPC/indexer endpoints.
- **`DEVNET` / `TESTNET` / `MAINNET`**: Real Midnight distributed network environments. Requires valid HTTPS/WSS URLs for `nodeRpcEndpoint` and `indexerEndpoint`.
- **Validation**: Attempting to set an invalid environment or missing required endpoints raises a typed `NetworkConfigurationError` with domain code `INVALID_ENDPOINTS` or `UNKNOWN_NETWORK`.

### 27.2 Wallet Connector Discovery & Capabilities
The connector discovery subsystem safely probes the browser runtime without throwing errors during Node.js/SSR execution:
- **`discoverWalletConnector()`**: Safely checks `window.midnight` for Lace / Midnight wallet compatibility.
- **`evaluateConnectorCapabilities()`**: Dynamically inspects the connector and provider for:
  - `READ_ACCOUNT_IDENTITY`: Ability to read public addresses.
  - `SIGN_DATA`: Cryptographic payload signing.
  - `SUBMIT_TRANSACTION`: Network transaction broadcasting.
- **Connector Readiness State**: Transitions across `NOT_DETECTED`, `DETECTED`, `INCOMPATIBLE`, `CONNECTING`, `CONNECTED`, `TRANSACTION_CAPABLE`, and `FAILED`.

### 27.3 The Three Core Architectural Invariants
1. **`DETECTED != CONNECTED`**: A detected browser extension connector does not grant permission or assume user consent until explicit wallet connection is established.
2. **`CONNECTED != TRANSACTION_CAPABLE`**: A connected wallet without signing or submission capabilities cannot broadcast transactions.
3. **`LOCAL PROTOTYPE CAPABILITY CONSTRAINTS`**: The `LocalPrototypeWalletProvider` explicitly reports `SIGN_DATA: false` and `SUBMIT_TRANSACTION: false`. It never fabricates transaction signatures, blockchain transactions, or network heights.

### 27.4 Transaction Readiness Evaluation
`evaluateTransactionReadiness` in `TransactionOrchestrator` computes fine-grained readiness for any lifecycle action:
- Returns `ready: true, readinessReason: 'READY'` only when:
  1. Active network configuration is valid for the environment.
  2. Wallet session is active and connected.
  3. Provider supports all capabilities required by the action (`SIGN_DATA`, `SUBMIT_TRANSACTION`).
- If any prerequisite is missing, readiness is `false` with a descriptive reason (`BLOCKED_NETWORK_CONFIGURATION`, `BLOCKED_WALLET_DISCONNECTED`, `BLOCKED_UNSUPPORTED_ACTION`).

### 27.5 Anti-Fabrication & Privacy Guarantees
- **No Synthetic Network Data**: Network status honestly reports whether connected to a real node or local prototype. No fake chain IDs, block hashes, or block heights are generated.
- **No Secrets in Discovery or Configuration**: Connector discovery and network configuration models contain only public endpoints, network names, and capability flags.
- **Strict Separation of Witness and Network Data**: Witness generation remains strictly local and off-chain; network configuration only affects public transaction routing.

---

## 28. Real Wallet Connection Handshake & Network-Aware Transaction Readiness (Commit #28)

Commit #28 implements an authoritative wallet connection handshake boundary and a multi-stage network-aware transaction preparation pipeline. It formally distinguishes connector presence, user consent, public identity resolution, network compatibility, dynamic capabilities, and contract-level transaction readiness without fabricating blockchain primitives.

```
+───────────────────────────────────────────────────────────────────────────────────────────+
|               WALLET CONNECTION HANDSHAKE & TRANSACTION READINESS PIPELINE               |
|                                                                                           |
|  [Browser Connector]               [NetworkConfigService]          [Contract Guards]      |
|    - window.midnight Detection       - Expected Environment          - canVerifyEligibility |
|    - Mock Test Boundary              - Expected Network ID           - canFundLoan          |
|    - DORMANT ──► DETECTING           - RPC & Indexer Endpoints       - canRepayLoan         |
|            │                                 │                       - canSettleLoan        |
|            ▼                                 │                              │             |
|  ┌────────────────────────────────────────┐  │                              │             |
|  │      8-STAGE HANDSHAKE LIFECYCLE       │  │                              │             |
|  │                                        │  │                              │             |
|  │  1. NOT_DETECTED / DETECTED            │  │                              │             |
|  │     - Invariant: DETECTED != CONNECTED │  │                              │             |
|  │  2. CONNECTING                         │  │                              │             |
|  │     - Enclave prompt pending           │  │                              │             |
|  │  3. CONNECTED                          │  │                              │             |
|  │     - Session established              │  │                              │             |
|  │  4. IDENTITY RESOLVED                  │  │                              │             |
|  │     - Public address & public key hex  │  │                              │             |
|  │  5. WALLET NETWORK IDENTIFIED          │  │                              │             |
|  │     - Query reportedNetworkId          │  │                              │             |
|  │  6. NETWORK COMPATIBILITY EVALUATION   │◄─┘                              │             |
|  │     - MATCH / MISMATCH / UNKNOWN       │                                 │             |
|  │     - Invariant: UNKNOWN != MATCH      │                                 │             |
|  │  7. CAPABILITY NEGOTIATION             │                                 │             |
|  │     - canSign & canSubmit verification │                                 │             |
|  │     - Invariant: CONNECTED != CAPABLE  │                                 │             |
|  │  8. HANDSHAKE STATUS RESOLUTION        │                                 │             |
|  │     - READY / REJECTED / FAILED        │                                 │             |
|  └────────────────────────────────────────┘                                 │             |
|            │                                                                │             |
|            ▼                                                                ▼             |
|  ┌─────────────────────────────────────────────────────────────────────────────────────┐  |
|  │                 9-STAGE PRE-TRANSACTION PREPARATION PIPELINE                        │  |
|  │                                                                                     │  |
|  │  Stage 1: Account Context Check     ──► Missing?         ──► WALLET_NOT_CONNECTED   │  |
|  │  Stage 2: Connector Discovery Check  ──► Unsupported?     ──► UNSUPPORTED_CONNECTOR  │  |
|  │  Stage 3: Provider Connection Check ──► Disconnected?    ──► WALLET_NOT_CONNECTED   │  |
|  │  Stage 4: Identity Resolution Check ──► Unresolved?      ──► WALLET_NOT_CONNECTED   │  |
|  │  Stage 5: Network Config Validity   ──► Bad Endpoints?   ──► BLOCKED_NETWORK_CONFIG │  |
|  │  Stage 6: Wallet Network Match Check──► MISMATCH?        ──► NETWORK_MISMATCH       │  |
|  │                                     ──► UNKNOWN?         ──► UNKNOWN_WALLET_NETWORK │  |
|  │  Stage 7: Compact Contract Guards   ──► Guard Rejection? ──► GUARD_VALIDATION_FAILED│  |
|  │  Stage 8: Provider Signing Check    ──► No Signing?      ──► SIGNING_UNAVAILABLE    │  |
|  │  Stage 9: Provider Submission Check ──► No Submission?   ──► SUBMISSION_UNAVAILABLE │  |
|  │                                                                                     │  |
|  │  Result: Technical Readiness Evaluated (isReady: true/false, reason, message)       │  |
|  └─────────────────────────────────────────────────────────────────────────────────────┘  |
|            │                                                                              |
|            ▼                                                                              |
|  [TransactionExecutionService] (Phase 2.5)                                                |
|    - Enforces Network Compatibility gate before execution dispatch                        |
|    - Rejects MISMATCH and UNKNOWN before transaction submission                           |
|    - Preserves LoanRegistry state on unexecutable or blocked transactions                 |
+───────────────────────────────────────────────────────────────────────────────────────────+
```

### 28.1 The Eight-Stage Connection Handshake State Machine

The `WalletHandshakeService` (`frontend/src/lib/wallet-handshake-service.ts`) orchestrates the complete lifecycle:

1. **`NOT_DETECTED`**: No compatible browser wallet connector is installed in the runtime environment.
2. **`DETECTED`**: A browser wallet connector (e.g. Lace on `window.midnight`) is present, but no permission or connection has been granted.
3. **`CONNECTING`**: Connection request is actively in progress awaiting user permission or enclave approval.
4. **`CONNECTED`**: Connection session established through the provider boundary.
5. **`IDENTITY_RESOLVED`**: Public account key bytes (`publicKey`), hex representation (`publicKeyHex`), and address (`address`) are resolved without exposing any private credentials.
6. **`WALLET_NETWORK_IDENTIFIED`**: The connected wallet's active network identifier is queried through `provider.getReportedNetworkId()`.
7. **`NETWORK_COMPATIBILITY_EVALUATION`**: Evaluates whether the reported network matches the application's configured environment.
8. **`CAPABILITY_VERIFICATION`**: Verifies dynamic atomic capabilities (`READ_PUBLIC_LEDGER`, `CREATE_PROOF`, `READ_ACCOUNT_IDENTITY`, `SIGN_TRANSACTION`, `SUBMIT_TRANSACTION`). If fully compatible and capable, status transitions to `READY`. If user rejects, status becomes `REJECTED`. If unsupported or unexpected failure occurs, status becomes `FAILED`.

### 28.2 Network Compatibility Evaluation Rules

Implemented in `frontend/src/lib/wallet-network-compatibility.ts`:

- **`MATCH`**: Reported network is identical or canonically equivalent to expected configuration (e.g. `midnight-testnet-01` matching `midnight-testnet-01`).
- **`MISMATCH`**: Reported network does not match expected configuration (e.g. wallet on `midnight-devnet-02` while app expects `midnight-testnet-01`). Blocks transaction preparation with typed reason `NETWORK_MISMATCH`.
- **`UNKNOWN`**: Wallet does not report a network identifier (or reports empty/null). **Critical Invariant**: `UNKNOWN` is never treated as a `MATCH`. It blocks transaction preparation with typed reason `UNKNOWN_WALLET_NETWORK`.
- **Local Prototype Compatibility**: In local prototype mode, matching local identifiers evaluates to `MATCH`, and remote network endpoints are not required.

### 28.3 The Nine-Stage Transaction Readiness Pipeline

Implemented in `evaluateTransactionReadiness` (`frontend/src/lib/transaction-orchestrator.ts`):

1. **Stage 1 (Account Context Check)**: Verifies active account exists. (Reason: `WALLET_NOT_CONNECTED`)
2. **Stage 2 (Connector Detection Check)**: Verifies real adapter is supported. (Reason: `UNSUPPORTED_CONNECTOR`)
3. **Stage 3 (Provider Connection Check)**: Verifies provider is connected. (Reason: `WALLET_NOT_CONNECTED`)
4. **Stage 4 (Identity Resolution Check)**: Verifies public keys are non-null. (Reason: `WALLET_NOT_CONNECTED`)
5. **Stage 5 (Network Configuration Validity Check)**: Verifies valid endpoints for non-local environments. (Reason: `BLOCKED_NETWORK_CONFIGURATION`)
6. **Stage 6 (Wallet Network Compatibility Check)**: Evaluates `evaluateNetworkCompatibility`. If `MISMATCH`, returns `NETWORK_MISMATCH`. If `UNKNOWN`, returns `UNKNOWN_WALLET_NETWORK`.
7. **Stage 7 (Canonical Contract Guard Check)**: Evaluates `canVerifyEligibility`, `canFundLoan`, `canRepayLoan`, or `canSettleLoan`. If rejected, returns `GUARD_VALIDATION_FAILED`.
8. **Stage 8 (Provider Signing Capability Check)**: Verifies `SIGN_TRANSACTION`. If missing, returns `SIGNING_UNAVAILABLE`.
9. **Stage 9 (Provider Submission Capability Check)**: Verifies `SUBMIT_TRANSACTION`. If missing, returns `SUBMISSION_UNAVAILABLE`.

### 28.4 Transaction Execution Boundary Integration

`TransactionExecutionService` (`frontend/src/lib/transaction-execution-service.ts`) enforces network compatibility in **Phase 2.5**:
- Pre-execution gate prevents transaction dispatch if network compatibility is `MISMATCH` or `UNKNOWN`.
- Returns typed result `status: 'BLOCKED'`, `registryUpdated: false`.
- Central `LoanRegistry` is never mutated on blocked, unexecutable, or unsupported operations.

### 28.5 User Interface: Enhanced WalletSessionPanel

The `WalletSessionPanel` component renders real-time handshake and network diagnostic indicators:
- **Connector Detection**: `DETECTED` vs `NOT_DETECTED`.
- **Connection Status**: `CONNECTED`, `CONNECTING`, `DISCONNECTED`.
- **Expected Network**: Displays application configured network ID.
- **Wallet Network**: Displays actual reported wallet network or *"Unreported"*.
- **Network Compatibility**: `MATCH` (green), `MISMATCH` (red), `UNKNOWN` (yellow).
- **Atomic Capabilities**: Individual badges for Signing and Submission capabilities.
- **Transaction Readiness**: Real-time readiness status badge (`READY` vs reason).
- **Honest Disclosures**: In prototype mode, explicitly displays: *"Simulation Only: Local Prototype Wallet operates in-memory without real network submission or signing."*

### 28.6 Anti-Fabrication & Strict Privacy Guarantees

1. **Zero Synthetic Blockchain Data**: Never generates fake transaction hashes, mock block heights, synthetic confirmations, or fabricated signatures.
2. **Read-Only Preparation**: `prepareLifecycleTransaction` and `evaluateTransactionReadiness` are strictly idempotent and read-only.
3. **LoanRegistry Immutability**: Unsupported or blocked transactions never alter on-chain agreement state in `LoanRegistry`.
4. **Contract Immutability**: `contracts/src/index.compact` remains 100% untouched and authoritative.
5. **Strict Zero-Knowledge Isolation**: All 68+ frontend source files pass automated static analysis verifying zero occurrences of prohibited underwriting credentials or private financial terms.

---

## 29. Transaction Request Signing & Network Submission Boundary

Commit #29 implements the production-grade, asynchronous **Transaction Request Signing and Submission Boundary** (`frontend/src/types/transaction-request.ts`, `frontend/src/lib/transaction-status-service.ts`, `frontend/src/lib/transaction-execution-service.ts`, `frontend/src/lib/wallet-provider.ts`, `frontend/src/lib/midnight-provider.ts`, `frontend/src/lib/midnight-wallet-adapter.ts`).

This milestone establishes a formal, multi-stage transaction execution pipeline that cleanly decouples preparation, cryptographic signing, node submission, and post-submission lifecycle tracking, eliminating any single-step "execute" shortcuts or synthetic confirmations.

```
+───────────────────────────────────────────────────────────────────────────────────────────+
|                 5-STAGE TRANSACTION REQUEST LIFECYCLE PIPELINE                             |
+───────────────────────────────────────────────────────────────────────────────────────────+
|                                                                                           |
|  [ User Lifecycle Intent ] (e.g. Fund Loan / Repay / Settle)                              |
|            │                                                                              |
|            ▼                                                                              |
|  ┌────────────────────────────────────────┐                                               |
|  │  STAGE 1: TRANSACTION CREATION (DRAFT) │                                               |
|  │  - createTransactionRequest()          │                                               |
|  │  - Action to circuit mapping (1:1)     │                                               |
|  │  - Caller public identity binding      │                                               |
|  └────────────────────────────────────────┘                                               |
|            │                                                                              |
|            ▼                                                                              |
|  ┌────────────────────────────────────────┐                                               |
|  │  STAGE 2: PREPARATION & VALIDATION     │                                               |
|  │  - prepareAndValidate()                │                                               |
|  │  - Read-only guard & capability check  │                                               |
|  │  - Network compatibility verification  │                                               |
|  └───────────────────┬────────────────────┘                                               |
|                      │                                                                    |
|           ┌──────────┴──────────┐                                                         |
|           ▼                     ▼                                                         |
|     [BLOCKED / FAILED]     [PREPARED / READY]                                             |
|     (Registry untouched)        │                                                         |
|                                 ▼                                                         |
|  ┌────────────────────────────────────────┐                                               |
|  │  STAGE 3: WALLET SIGNING REQUEST       │                                               |
|  │  - requestSignature() via provider     │                                               |
|  │  - User enclave approval / rejection   │                                               |
|  └───────────────────┬────────────────────┘                                               |
|                      │                                                                    |
|           ┌──────────┴──────────┐                                                         |
|           ▼                     ▼                                                         |
|     [REJECTED / FAILED]    [SIGNED]                                                       |
|     (Registry untouched)        │                                                         |
|                                 ▼                                                         |
|  ┌────────────────────────────────────────┐                                               |
|  │  STAGE 4: TRANSACTION SUBMISSION       │                                               |
|  │  - submitTransaction() via provider    │                                               |
|  │  - Relay to node RPC endpoint          │                                               |
|  └───────────────────┬────────────────────┘                                               |
|                      │                                                                    |
|           ┌──────────┴──────────┐                                                         |
|           ▼                     ▼                                                         |
|     [REJECTED / FAILED]    [SUBMITTED]                                                    |
|     (Registry untouched)        │                                                         |
|                                 ▼                                                         |
|  ┌────────────────────────────────────────┐                                               |
|  │  STAGE 5: STATUS TRACKING & CONFIRM    │                                               |
|  │  - TransactionStatusService            │                                               |
|  │  - Invariant: SUBMITTED != CONFIRMED   │                                               |
|  │  - LoanRegistry MUTATED ONLY ON        │                                               |
|  │    GENUINE PROVIDER CONFIRMATION       │                                               |
|  └────────────────────────────────────────┘                                               |
+───────────────────────────────────────────────────────────────────────────────────────────+
```

### 29.1 The Five-Stage Pipeline Architecture

1. **Stage 1: Application Action to Transaction Request (`DRAFT`)**:
   - The user selects a lifecycle action in the UI.
   - `createTransactionRequest(loan, account, action, loanId)` creates an un-executed, standardized `TransactionRequest` object in `DRAFT` status with public parameters and caller public identity.
2. **Stage 2: Read-Only Transaction Preparation (`PREPARED` / `BLOCKED`)**:
   - `prepareAndValidate(request, loan, account)` evaluates Compact contract guards (`canFundLoan`, `canRepayLoan`, `canSettleLoan`), wallet network compatibility (`MATCH`), and capability prerequisites without modifying state.
   - If guards or capabilities fail, transitions to `BLOCKED` with typed error code (`GUARD_VALIDATION_FAILED`, `NETWORK_MISMATCH`, `NOT_CONNECTED`, `UNKNOWN_NETWORK`).
3. **Stage 3: Wallet Signing Request (`SIGNING` $\to$ `SIGNED` / `REJECTED` / `FAILED`)**:
   - `requestSignature(request)` delegates to the active `WalletProvider.requestSignature()`.
   - In real wallet mode (Lace/Midnight), the wallet connector prompts the user to cryptographically sign the transaction.
   - If user cancels in wallet UI, returns typed `USER_REJECTED_SIGNATURE` (`status: 'REJECTED'`).
   - In prototype mode, throws typed `ProviderError('UNSUPPORTED_OPERATION')` without generating synthetic signatures.
4. **Stage 4: Network Transaction Submission (`SUBMITTING` $\to$ `SUBMITTED` / `FAILED`)**:
   - `submitTransaction(request, signingResult)` dispatches the signed payload to the provider for network broadcast.
   - If user rejects at submission prompt, returns typed `USER_REJECTED_SUBMISSION` (`status: 'REJECTED'`).
   - If provider network submission fails, returns `status: 'FAILED'`.
   - On successful broadcast, transitions to `status: 'SUBMITTED'`.
5. **Stage 5: Transaction Status Tracking & State Mutation (`CONFIRMED`)**:
   - Managed via `TransactionStatusService` (`frontend/src/lib/transaction-status-service.ts`).
   - **Crucial Anti-Fabrication Invariant**: A transaction in `SUBMITTED` status is **never inferred or assumed to be `CONFIRMED`**.
   - The central `LoanRegistry` is mutated **only and strictly when the provider returns genuine confirmation** (`status: 'CONFIRMED'`).
   - Blocked, rejected, failed, unsupported, or unconfirmed pending transactions leave the central `LoanRegistry` completely untouched.

### 29.2 Standardized Transaction Request Domain Models

Implemented in `frontend/src/types/transaction-request.ts`:

- `TransactionRequestStatus`: `'DRAFT' | 'PREPARING' | 'PREPARED' | 'SIGNING' | 'SIGNED' | 'SUBMITTING' | 'SUBMITTED' | 'CONFIRMED' | 'REJECTED' | 'FAILED' | 'BLOCKED' | 'UNSUPPORTED'`
- `TransactionSigningStatus`: `'UNSIGNED' | 'PENDING' | 'SIGNED' | 'REJECTED' | 'FAILED' | 'UNSUPPORTED'`
- `TransactionSubmissionStatus`: `'NOT_SUBMITTED' | 'SUBMITTING' | 'SUBMITTED' | 'CONFIRMED' | 'REJECTED' | 'FAILED' | 'UNSUPPORTED'`
- `TrackedTransactionStatus`: `'PENDING' | 'SUBMITTED' | 'CONFIRMED' | 'FAILED' | 'REJECTED'`
- `TransactionRequestErrorCode`: Typed error identifiers for all edge cases (`WALLET_NOT_CONNECTED`, `NETWORK_MISMATCH`, `UNKNOWN_NETWORK`, `SIGNING_UNAVAILABLE`, `SUBMISSION_UNAVAILABLE`, `USER_REJECTED_SIGNATURE`, `USER_REJECTED_SUBMISSION`, `SIGNING_FAILED`, `SUBMISSION_FAILED`, `GUARD_VALIDATION_FAILED`, `CONTRACT_ERROR`, `UNSUPPORTED_OPERATION`).
- `TransactionSigningRequest`, `TransactionSigningResult`: Standardized types encapsulating signing payloads and public signatures.
- `TransactionSubmissionRequest`, `TransactionSubmissionResult`: Encapsulating network broadcast payloads and tracking references.
- `TransactionStatusResult`: Status tracking outcome with optional genuine block height.
- `TransactionRequestResult`: End-to-end outcome including pipeline status, receipt, and updated registry.

### 29.3 Wallet Provider Interface Evolution

The core `WalletProvider` interface (`frontend/src/lib/wallet-provider.ts`) was extended to support distinct signing, submission, and status polling:

```typescript
export interface WalletProvider {
  // ... existing connection, identity, network methods ...
  requestSignature?(request: TransactionSigningRequest): Promise<TransactionSigningResult>;
  submitTransaction?(
    request: TransactionSubmissionRequest | LegacyTransactionSubmission
  ): Promise<TransactionSubmissionResult | LegacyTransactionResult>;
  getTransactionStatus?(transactionId: string): Promise<TransactionStatusResult>;
}
```

- **`LocalPrototypeWalletProvider`**:
  Explicitly rejects signing, submission, and status queries with typed `ProviderError('UNSUPPORTED_OPERATION')`, maintaining absolute prototype honesty and preventing mock blockchain hallucination.
- **`MidnightWalletAdapter`**:
  Implements `requestSignature`, `submitTransaction`, and `getTransactionStatus` with dual-mode support: delegates to genuine connector methods when available, and provides complete backward compatibility with mock testing connectors.

### 29.4 Anti-Fabrication & Ledger Safety Invariants

1. **Zero Synthetic Hashes**: No fake transaction hashes (`0x...` or UUID hashes) are generated in prototype mode.
2. **Distinct Submission vs. Confirmation**: Submission to the network does not imply confirmation. Status remains `SUBMITTED` until genuine network proof or block inclusion is confirmed.
3. **No Fake Block Heights**: Block heights are never fabricated in prototype or mock failure paths.
4. **No Fake Signatures**: Rejection or failure at the signing stage results in `signatureBytes: undefined` and `signatureHex: undefined`.
5. **LoanRegistry Immutability**: `LoanRegistry` is never mutated if any stage in the pipeline is blocked, rejected, failed, unsupported, or pending unconfirmed.

### 29.5 User Interface: 5-Stage Transaction Pipeline Ribbon

The `TransactionReviewPanel` (`frontend/src/components/TransactionReviewPanel.tsx`) renders the real-time 5-stage pipeline ribbon with dedicated test-id `transaction-pipeline-ribbon`:

- **Stage Chips**:
  1. `1. Draft`
  2. `2. Prepared`
  3. `3. Signing`
  4. `4. Submitted`
  5. `5. Confirmed`
- **Dynamic State Indicators**:
  Active stage is highlighted in primary blue/indigo; completed stages display green checks; rejected or blocked stages display high-visibility badges with detailed technical disclosures.
- **Action Readiness Integration**:
  The review panel surfaces precise blocking reasons (such as `NETWORK_MISMATCH` or `USER_REJECTED_SIGNATURE`) directly in the confirmation card.

### 29.6 Zero-Knowledge Privacy Invariants

All transaction request parameters, signing payloads, and status tracking descriptors operate strictly on public loan parameters (`amount`, `interestRateBasisPoints`, `durationBlocks`, public keys, agreement IDs). Automated static analysis verifies that across all 56+ frontend modules, zero occurrences of forbidden underwriting terms, witness variables, or private financial credentials exist.

---

## 30. Transaction Lifecycle Persistence & Recovery Architecture (Commit #30)

Commit #30 establishes the transaction lifecycle persistence and crash recovery architecture (`frontend/src/lib/transaction-persistence-service.ts`, `frontend/src/lib/transaction-recovery-service.ts`, `frontend/src/types/transaction-persistence.ts`, and `frontend/src/components/TransactionHistoryPanel.tsx`). It ensures that transaction requests, off-chain preparation states, provider signatures, and network submission metadata are reliably stored across browser reloads, network disruptions, or application restarts, while strictly upholding the anti-fabrication invariant that **local persistence does NOT imply blockchain confirmation**.

### 30.1 Architectural Flow: Persistence, Recovery & Reconciliation

```
+───────────────────────────────────────────────────────────────────────────────────────────+
|               TRANSACTION LIFECYCLE PERSISTENCE & RECOVERY PIPELINE                       |
+───────────────────────────────────────────────────────────────────────────────────────────+
|                                                                                           |
|  ┌────────────────────────────────────────┐                                               |
|  │  STAGE 1: TRANSACTION REQUEST CREATION │                                               |
|  │  - createTransactionRequest() (DRAFT)  │                                               |
|  │  - Persisted to storage immediately    │                                               |
|  └───────────────────┬────────────────────┘                                               |
|                      │                                                                    |
|                      ▼                                                                    |
|  ┌────────────────────────────────────────┐                                               |
|  │  STAGE 2: PREPARATION & SIGNING        │                                               |
|  │  - prepareAndValidate()                │                                               |
|  │  - requestSignature() via provider     │                                               |
|  │  - Storage updated at each transition  │                                               |
|  └───────────────────┬────────────────────┘                                               |
|                      │                                                                    |
|                      ▼                                                                    |
|  ┌────────────────────────────────────────┐                                               |
|  │  STAGE 3: SUBMISSION & NETWORK REF     │                                               |
|  │  - submitTransaction() via provider    │                                               |
|  │  - providerTransactionId recorded      │                                               |
|  │  - status: SUBMITTED, recovery: PENDING│                                               |
|  └───────────────────┬────────────────────┘                                               |
|                      │                                                                    |
|                      ▼                                                                    |
|  ┌────────────────────────────────────────┐                                               |
|  │  STAGE 4: LIFECYCLE RECOVERY & QUERY   │                                               |
|  │  - On app startup or user action       │                                               |
|  │  - recoverPendingTransactions()        │                                               |
|  │  - Query provider.getTransactionStatus │                                               |
|  └───────────────────┬────────────────────┘                                               |
|                      │                                                                    |
|           ┌──────────┴──────────┐                                                         |
|           ▼                     ▼                                                         |
|     [PENDING / REJECTED]   [CONFIRMED]                                                    |
|     - Mapped safely to     - Verified block height                                        |
|       PENDING/REJECTED/    - Idempotent LoanRegistry                                      |
|       UNSUPPORTED/STALE      synchronization:                                             |
|     - Registry UNTOUCHED     FUND_LOAN   -> LoanStatus.funded                             |
|                              REPAY_LOAN  -> LoanStatus.repaid                             |
|                              SETTLE_LOAN -> LoanStatus.settled                            |
|                                                                                           |
+───────────────────────────────────────────────────────────────────────────────────────────+
```

### 30.2 Fundamental Architectural Principle: Local Persistence != Confirmation

A critical architectural invariant enforced in Commit #30 is:
$$\text{LOCAL PERSISTENCE} \neq \text{BLOCKCHAIN CONFIRMATION}$$

1. **Locally Persisted State**: Records execution requests, user intentions, caller public identities, and off-chain lifecycle progress in local storage.
2. **On-Chain Confirmation**: Originates exclusively from the active `WalletProvider` through `provider.getTransactionStatus(id)`.
3. **Registry Mutation Gateway**: The centralized `LoanRegistry` is **never mutated** on persisted records alone. Only when `provider.getTransactionStatus()` explicitly returns `status: 'CONFIRMED'` with genuine block verification does the recovery service advance the canonical agreement status.
4. **Offline Prototype Honesty**: When operating with `LocalPrototypeWalletProvider`, status queries throw `UNSUPPORTED_OPERATION`. The recovery service catches this, marks the transaction `recoveryStatus: 'UNSUPPORTED'`, and preserves the registry without synthetic confirmation.

### 30.3 Domain Models & Error Types

Implemented in `frontend/src/types/transaction-persistence.ts`:

- **`PersistedTransaction`**: Standardized domain record containing public agreement terms (`amount`, `interestRateBps`, `durationBlocks`), public caller keys (`callerPublicKeyHex`, `callerPublicKey`), network identifier, provider kind, request status, recovery status, genuine provider transaction ID, and genuine block height.
- **`TransactionRecoveryStatus`**: `'PENDING' | 'CONFIRMED' | 'FAILED' | 'REJECTED' | 'UNSUPPORTED' | 'STALE' | 'NOT_FOUND' | 'RECOVERABLE'`
- **`TransactionPersistenceState`**: Versioned persistence snapshot schema (`version: '1.0'`, `lastSavedAt: number`, `transactions: Record<string, PersistedTransaction>`).
- **`TransactionReconciliationResult`**: Complete reconciliation outcome including `success`, `previousStatus`, `reconciledStatus`, `recoveryStatus`, `providerTransactionId`, `blockHeight`, `registryUpdated`, `updatedRegistry`, and detailed explanatory message.
- **`TransactionPersistenceError`**: Strongly typed domain error hierarchy with codes (`STORAGE_UNAVAILABLE`, `STORAGE_QUOTA_EXCEEDED`, `CORRUPTED_DATA`, `SERIALIZATION_ERROR`, `TRANSACTION_NOT_FOUND`, `INVALID_TRANSACTION_STATE`).

### 30.4 Persistence Adapters & Safe Serialization

The architecture provides two persistence adapters via `TransactionPersistence` interface:

1. **`InMemoryTransactionPersistence`**: Ephemeral in-memory store for server-side environments, unit tests, and non-persistent client sessions. Sorts transactions by `createdAt` descending.
2. **`LocalStorageTransactionPersistence`**: Browser-backed storage under key `midnight_confidential_p2p_transactions_v1`.
   - **BigInt Serialization**: Transparently converts `bigint` primitives to numeric strings during serialization and reconstructs genuine `bigint` values upon deserialization for `amount`, `interestRateBps`, `durationBlocks`, and `blockHeight`.
   - **Uint8Array Serialization**: Serializes 32-byte public keys to numeric byte arrays and reconstructs genuine `Uint8Array` instances.
   - **Corrupted Storage Auto-Recovery**: If storage contains invalid JSON or truncated data, it logs a warning, falls back gracefully, and initializes a clean state without throwing or crashing the UI.
   - **Fallback Mechanism**: Automatically delegates to in-memory storage if `localStorage` is unavailable or throws quota exceptions.

### 30.5 Transaction Recovery & Reconciliation Service

The `TransactionRecoveryService` (`frontend/src/lib/transaction-recovery-service.ts`) orchestrates recovery and provider synchronization:

- **`recoverPendingTransactions()`**: Discovers all interrupted or unresolved transactions (`SUBMITTED`, `SUBMITTING`, `SIGNATURE_REQUESTED`, `PREPARING`, `PENDING`).
- **`getRecoverableTransactions()`**: Discovers transactions ready for on-chain status verification.
- **`reconcileTransaction(txId, provider, loanRegistry)`**:
  - Queries `provider.getTransactionStatus(providerTxId)`.
  - Maps `CONFIRMED` $\to$ updates record, extracts block height, and applies idempotent `LoanRegistry` state transitions.
  - Maps `PENDING` / `SUBMITTED` $\to$ leaves registry untouched, preserves `PENDING` status.
  - Maps `REJECTED` $\to$ records user/network rejection, leaves registry untouched.
  - Maps `FAILED` $\to$ records execution failure, leaves registry untouched.
  - Maps unrecognized statuses $\to$ safely tags as `STALE`, leaves registry untouched.
  - Handles disconnected provider or unsupported operations $\to$ safely tags as `UNSUPPORTED`.
- **`reconcileAll(provider, loanRegistry)`**: Iteratively reconciles all recoverable transactions and chains registry updates.
- **Idempotency Safeguard**: If `loan.status` already matches the target state (e.g. loan is already funded), reconciliation succeeds without throwing `INVALID_TRANSITION`, returning `registryUpdated: false`.

### 30.6 User Interface: Transaction History Panel

`TransactionHistoryPanel.tsx` (`frontend/src/components/TransactionHistoryPanel.tsx`) renders the transaction history and recovery management UI:

- **Metadata Inspection**: Displays action type, loan ID, Compact circuit name, network ID, provider kind, created time, provider transaction ID, and verified block height.
- **Dynamic Status Badges**: Visual indicators for pipeline status (`CONFIRMED`, `SUBMITTED`, `REJECTED`, `FAILED`, `UNSUPPORTED`) and recovery state.
- **Filtering Controls**: Filter by transaction status (`ALL`, `PENDING`, `CONFIRMED`, `FAILED`, `REJECTED`, `UNSUPPORTED`) and action type.
- **Reconciliation Actions**: Individual "Reconcile Status" button per recoverable transaction and top-level "Reconcile All" button for bulk recovery.
- **Honest Disclosures**: Prominently displays: `"LOCAL PERSISTENCE != BLOCKCHAIN CONFIRMATION: This panel records locally persisted lifecycle metadata and off-chain execution requests. Canonical loan registry status is updated strictly when the active wallet provider verifies on-chain confirmation."`

### 30.7 Zero-Knowledge Privacy & Anti-Fabrication Invariants

1. **Zero Secret Persistence**: Persisted transactions store strictly public parameters and public identity keys. No private keys, wallet secrets, seed phrases, ZK witness contexts, or confidential borrower financial data are ever accepted or serialized.
2. **Anti-Fabrication**: In local prototype mode, `LocalPrototypeWalletProvider` explicitly rejects status queries with `UNSUPPORTED_OPERATION`. No synthetic transaction IDs, confirmations, or block heights are generated.
3. **Automated Verification**: Verified by 420 unit and integration tests, including automated static analysis confirming zero occurrences of forbidden underwriting terms across all 74+ frontend modules.

---

## 31. Commit #31 — Transaction Reconciliation & Lifecycle Event Tracking

### 31.1 Architectural Overview & Core Invariant

Commit #31 elevates transaction lifecycle visibility, auditability, and determinism by establishing a formal reconciliation layer and an append-only lifecycle event tracking engine. The core operational principle of the architecture is the strict triadic separation:

$$\text{LOCAL TRANSACTION RECORD} \neq \text{PROVIDER-VERIFIED TRANSACTION STATUS} \neq \text{CANONICAL LOAN REGISTRY STATE}$$

```
+───────────────────────────────────────────────────────────────────────────────────────────+
|                                    COMMIT #31 ARCHITECTURE                                |
|                                                                                           |
|  ┌───────────────────────┐         ┌───────────────────────┐        ┌──────────────────┐  |
|  │ LOCAL TRANSACTION     │         │ PROVIDER-VERIFIED     │        │ CANONICAL        │  |
|  │ RECORD                │  =/=    │ TRANSACTION STATUS    │  =/=   │ LOAN REGISTRY    │  |
|  │ (Local Persistence)   │         │ (Wallet Provider RPC) │        │ (Source of Truth)│  |
|  └──────────┬────────────┘         └───────────┬───────────┘        └─────────▲────────┘  |
|             │                                  │                              │           |
|             ▼                                  ▼                              │           |
|     ┌─────────────────────────────────────────────────────────┐               │           |
|     │           TransactionReconciliationService              │               │           |
|     │                                                         │               │           |
|     │  - Network Matching Evaluation                          │               │           |
|     │  - Provider Capabilities Check                          │               │           |
|     │  - Genuine Provider Status Query                        │               │           |
|     │  - Deterministic Reason Code Resolution                 │               │           |
|     │  - Safe Idempotent Transition Application               │───────────────┘           |
|     └──────────────────────────┬──────────────────────────────┘      (Only on CONFIRMED   |
|                                │                                      with genuine block) |
|                                ▼                                                          |
|     ┌─────────────────────────────────────────────────────────┐                           |
|     │              TransactionEventService                    │                           |
|     │             (Append-Only Event Store)                   │                           |
|     │                                                         │                           |
|     │  - 17 Standardized Lifecycle Event Types                │                           |
|     │  - 6 Component Event Sources                            │                           |
|     │  - Monotonic Deterministic Sequence Counters            │                           |
|     │  - Immutable Snapshot Freezing (Object.freeze)          │                           |
|     └──────────────────────────┬──────────────────────────────┘                           |
|                                │                                                          |
|                                ▼                                                          |
|     ┌─────────────────────────────────────────────────────────┐                           |
|     │             TransactionHistoryPanel UI                  │                           |
|     │                                                         │                           |
|     │  - Compact Lifecycle Timeline                           │                           |
|     │  - Technical Diagnostic Section:                        │                           |
|     │    LOCAL | PROVIDER | RECONCILIATION | REGISTRY         │                           |
|     │  - Recorded Events Count Badge                          │                           |
|     └─────────────────────────────────────────────────────────┘                           |
+───────────────────────────────────────────────────────────────────────────────────────────+
```

1. **Local Transaction Record**: Represents client-side intention, submission attempts, and persistent off-chain metadata. It never serves as authoritative proof of blockchain finality.
2. **Provider-Verified Transaction Status**: Genuine blockchain status queried directly from the active `WalletProvider` via `getTransactionStatus(providerTxId)`.
3. **Canonical Loan Registry State**: The application's authoritative state. Mutated **only** when genuine provider confirmation is verified, with callers authorized under Compact smart contract rules.

### 31.2 Lifecycle Events Domain Model

Implemented in `frontend/src/types/transaction-events.ts`:

- **`TransactionLifecycleEventType`** (17 distinct lifecycle states):
  - Initialization: `CREATED`, `PREPARED`
  - Signing Phase: `SIGNING_STARTED`, `SIGNED`
  - Submission Phase: `SUBMISSION_STARTED`, `SUBMITTED`
  - Verification & Status: `CONFIRMATION_CHECK_STARTED`, `CONFIRMED`
  - Failure & Blocking: `REJECTED`, `FAILED`, `BLOCKED`, `UNSUPPORTED`
  - Recovery Workflow: `RECOVERY_STARTED`, `RECOVERY_COMPLETED`
  - Reconciliation Workflow: `RECONCILIATION_STARTED`, `RECONCILIATION_COMPLETED`, `RECONCILIATION_FAILED`

- **`TransactionEventSource`** (6 architectural components):
  `'EXECUTION_SERVICE' | 'STATUS_SERVICE' | 'RECOVERY_SERVICE' | 'RECONCILIATION_SERVICE' | 'WALLET_PROVIDER' | 'USER_ACTION'`

- **`TransactionLifecycleEvent`**: Immutable event record containing `id`, `sequenceNumber`, `transactionId`, `agreementId`, `action`, `eventType`, `source`, `timestamp`, `networkId`, `providerKind`, `status`, optional `blockHeight`, `message`, `errorCode`, and `details`.

### 31.3 Append-Only Event Store (`TransactionEventService`)

The `TransactionEventService` (`frontend/src/lib/transaction-event-service.ts`) provides a deterministic, thread-safe (in-memory) event audit trail:

- **Strict Monotonic Sequencing**: Each event is assigned a globally incremental sequence number starting at 1.
- **Deduplication Safeguards**: Drops duplicate events if an event with the same ID already exists.
- **Deep Immutability**: Emits frozen records via `Object.freeze()` so consumers and UI components cannot tamper with historical audit records.
- **Filtering & Audit Methods**: `getEventsForTransaction(txId)`, `getEventsForAgreement(agreementId)`, `getLatestEvent(txId)`, `getAllEvents()`, and `clearEvents()`.

### 31.4 Deterministic Transaction Reconciliation (`TransactionReconciliationService`)

The `TransactionReconciliationService` (`frontend/src/lib/transaction-reconciliation-service.ts`) implements deterministic state machine reconciliation:

```
Missing Tx Record ────────────────────────► NOT_REQUIRED (TRANSACTION_NOT_FOUND)
Disconnected Provider ────────────────────► UNSUPPORTED (STATUS_UNAVAILABLE)
Network Mismatch ─────────────────────────► FAILED (NETWORK_MISMATCH)
Provider Lacks Status Support ────────────► UNSUPPORTED (PROVIDER_UNSUPPORTED)
Missing Provider Tx ID ───────────────────► FAILED (LOCAL_RECORD_ONLY)
Provider Query Exception ─────────────────► FAILED (STATUS_UNAVAILABLE)
Provider returns PENDING / SUBMITTED ─────► PENDING (PROVIDER_PENDING) -> Registry UNCHANGED
Provider returns REJECTED ────────────────► FAILED (PROVIDER_REJECTED) -> Registry UNCHANGED
Provider returns FAILED ──────────────────► FAILED (PROVIDER_FAILED)   -> Registry UNCHANGED
Provider returns Unknown Status ──────────► DISCREPANCY (UNKNOWN_PROVIDER_STATE) -> Registry UNCHANGED
Provider returns CONFIRMED ───────────────► RECONCILED (PROVIDER_CONFIRMED) -> Registry Mutated (Idempotent)
```

- **`ReconciliationStatus`**: `'NOT_REQUIRED' | 'RECONCILED' | 'PENDING' | 'FAILED' | 'DISCREPANCY' | 'UNSUPPORTED'`
- **`ReconciliationReason`**: Standardized explanatory reason codes (`'TRANSACTION_NOT_FOUND'`, `'LOCAL_RECORD_ONLY'`, `'PROVIDER_PENDING'`, `'PROVIDER_CONFIRMED'`, `'PROVIDER_REJECTED'`, `'PROVIDER_FAILED'`, `'PROVIDER_UNSUPPORTED'`, `'NETWORK_MISMATCH'`, `'STATUS_UNAVAILABLE'`, `'UNKNOWN_PROVIDER_STATE'`, `'ALREADY_SETTLED'`).
- **`TransactionReconciliationResult`**: Complete reconciliation response containing `reconciliationStatus`, `reason`, `registryMutationAllowed: boolean`, `registryUpdated: boolean`, `updatedRegistry?: LoanRegistry`, verified `blockHeight`, timestamps, and detailed human-readable message.

### 31.5 Registry Mutation Protection Rules

The canonical `LoanRegistry` is protected by strict gating rules:

1. **Confirmation Authorization**: Registry updates are permitted **if and only if** `statusResult.status === 'CONFIRMED'`.
2. **Pending & Intermediate Protection**: `PENDING`, `SUBMITTING`, `SUBMITTED`, `SIGNING_STARTED` never authorize registry updates (`registryMutationAllowed = false`).
3. **Failure Isolation**: `REJECTED`, `FAILED`, and network errors leave `LoanRegistry` completely unchanged.
4. **Idempotency**: Repeated reconciliation of an already-reconciled confirmed transaction detects the matching loan status (e.g. `loan.status === LoanStatus.funded`) and returns `registryUpdated: false` without error.

### 31.6 Cross-Service Lifecycle Event Integration

- **`TransactionExecutionService`**: Records `CREATED` and `PREPARED` events during transaction initialization; records `SIGNING_STARTED` and `SIGNED` during wallet signature handling; records `SUBMISSION_STARTED` and `SUBMITTED` upon relay to the provider.
- **`TransactionStatusService`**: Emits lifecycle events as status transitions occur during ongoing tracking.
- **`TransactionRecoveryService`**: Emits `RECOVERY_STARTED` when scanning for unconfirmed transactions and `RECOVERY_COMPLETED` upon successful reconciliation, delegating core verification logic to `TransactionReconciliationService`.

### 31.7 User Interface: Lifecycle Timeline & Technical Diagnostics

The `TransactionHistoryPanel` (`frontend/src/components/TransactionHistoryPanel.tsx`) features comprehensive diagnostic surfaces:

- **Lifecycle Timeline**: Displays recorded events in chronological order with visual indicators, sequence indices, source tags, and timestamps.
- **Technical Diagnostic Section**: An explicit audit row displaying:
  `LOCAL: <status> | PROVIDER: <providerStatus> | RECONCILIATION: <reconciliationStatus> | REGISTRY: <UNCHANGED | UPDATED>`
- **Event Counter**: Highlights the total number of verified lifecycle events captured for each transaction.

### 31.8 Zero-Knowledge Privacy & Anti-Fabrication Invariants

1. **Zero Secret Exposure**: None of the 14 forbidden underwriting or financial credential terms exist in any frontend source file.
2. **Anti-Fabrication**: In local prototype mode, no synthetic transaction hashes, block numbers, or confirmations are forged. Status queries honestly report `UNSUPPORTED_OPERATION`.
3. **Automated Test Coverage**: Verified by 453 automated tests across contracts and frontend test suites.



