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
