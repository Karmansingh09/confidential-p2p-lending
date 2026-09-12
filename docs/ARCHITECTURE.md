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
