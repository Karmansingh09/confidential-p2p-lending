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




