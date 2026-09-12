# Confidential P2P Micro-Lending Desk

A peer-to-peer micro-lending platform built with privacy-preserving zero-knowledge smart contracts, enabling borrowers to demonstrate eligibility and access credit while keeping their sensitive financial data confidential.

## Technology Direction

- **Midnight Network**: Privacy-first zero-knowledge blockchain foundation
- **Compact**: Smart contract programming language for zero-knowledge contracts
- **React & TypeScript**: Modern frontend interface
- **Midnight.js**: Client SDK for contract interaction and proof generation
- **Lace Wallet**: Web wallet integration for identity and transaction signing

## Status

> **Note**: This repository is currently under active development. Project structure and core modules are being initialized.

## Development Setup

### Prerequisites
- **Compact Toolchain**: Installed and available in PATH (e.g. `compact 0.5.1` with compiler `0.31.1`).
- **Node.js**: Node.js v20+ and npm.

### Installation
```bash
npm install
```

### Compact Smart Contracts
The Compact contracts reside in `contracts/`.
- Compile Compact contracts to generated TypeScript and ZKIR artifacts:
  ```bash
  npm run compile:contracts
  ```
- Compile and typecheck contract bindings:
  ```bash
  npm run build:contracts
  ```

## Smart Contract Architecture (Foundational)

The initial Compact contract (`contracts/src/index.compact`) establishes the foundational state model for the lending lifecycle:

- **`LoanStatus`**:
  - `requested`: Initial state upon loan creation.
  - `funded`: Transitioned when a lender supplies capital.
  - `repaid`: Transitioned when borrower returns principal and interest.
  - `settled`: Concluding state for the loan.
- **Ledger State**:
  - `borrower`: Borrower public account key (`Bytes<32>`).
  - `lender`: Optional lender account key (`Maybe<Bytes<32>>`).
  - `amount`: Loan principal requested (`Uint<64>`).
  - `interestRateBasisPoints`: Interest rate in basis points (`Uint<16>`).
  - `durationBlocks`: Term duration in blocks (`Uint<32>`).
  - `status`: Current lifecycle state (`LoanStatus`).
- **Inspection & Transition Circuits**:
  - `verifyEligibility()`: Proves borrower income satisfies threshold in zero-knowledge without revealing secret financial values.
  - `fundLoan()`: Records lender commitment and marks loan funded.
  - `repayLoan()`: Validates exact principal + interest obligation via Euclidean field division proof.
  - `settleLoan()`: Terminal settlement callable by borrower or lender.
  - `getLoanStatus()`: Inspect current loan status.
  - `getLoanDetails()`: Retrieve structured `LoanDetails` record.

## Client Lifecycle API (`LoanDesk`)

The `@midnight-p2p/contracts` package exposes a strongly typed client API and unified facade for application frontends:

```typescript
import {
  LoanDesk,
  createLoan,
  verifyLoanEligibility,
  fundLoan,
  repayLoan,
  settleLoan,
  LoanApiError,
  LoanErrorCode,
} from '@midnight-p2p/contracts';

// 1. Borrower creates a loan request
const loan = createLoan({
  borrowerPk: borrowerPublicKey,
  principalAmount: 25000n,
  interestRateBasisPoints: 500n, // 5.00%
  durationBlocks: 100n,
  eligibilityThreshold: 30000n,
});

// 2. Borrower proves eligibility in Zero-Knowledge (private value stays local)
const verified = verifyLoanEligibility({
  contractState: loan.contractState,
  borrowerPk: borrowerPublicKey,
  privateFinancialValue: 42000n, // Secret off-chain witness
});

// 3. Lender funds the verified request
const funded = fundLoan({
  contractState: verified.contractState,
  lenderPk: lenderPublicKey,
  callerPk: lenderPublicKey,
});

// 4. Borrower repays principal + interest (25000 + 1250 = 26250)
const repaid = repayLoan({
  contractState: funded.contractState,
  borrowerPk: borrowerPublicKey,
  callerPk: borrowerPublicKey,
});

// 5. Either party settles the loan into its terminal state
const settled = settleLoan({
  contractState: repaid.contractState,
  callerPk: lenderPublicKey,
});

// Inspect safe public loan details (ZERO private data exposed)
console.log(settled.loanDetails.statusText); // 'settled'
```

### Running Tests
Run the automated test suite covering all 5 lifecycle transitions, client API, and frontend:
```bash
npm test
# 255 passing tests across 8 test suites
```

## React + TypeScript Frontend Foundation (`frontend/`)

A modern, privacy-respecting dashboard UI visualizing the protocol lifecycle for borrowers and lenders.

### Starting the Frontend
```bash
# Start local Vite development server
npm run dev:frontend

# Typecheck frontend TypeScript
npm run typecheck:frontend

# Build production distribution bundle
npm run build:frontend
```

### Current Status & Features (Commit #24)
- **Real Midnight / Lace Wallet Adapter Integration Boundary (Commit #24)**:
  - **Verified Midnight Integration Surface**: Rigorous audit separating verified installed dependencies (`@midnight-ntwrk/compact-runtime` v0.16.0, `@midnight-ntwrk/onchain-runtime-v3` v3.1.1, Compact smart contract, client ZK prover, `LoanDesk`) from required future SDKs (`@midnight-ntwrk/dapp-connector-api`, `@midnight-ntwrk/midnight-js-*`, live Lace extension enclave, and live network RPC).
  - **Production-Ready Wallet Adapter**: Implements `MidnightWalletAdapter` (`frontend/src/lib/midnight-wallet-adapter.ts`) backed by safe browser connector detection (`window.midnight`), honest capability negotiation, and connection lifecycle management (`NOT_DETECTED`, `UNSUPPORTED`, `DISCONNECTED`, `CONNECTING`, `CONNECTED`).
  - **Anti-Fabrication Transaction Boundary**: Rejects unsupported transaction submissions with typed `WalletAdapterError('UNSUPPORTED_OPERATION')` without generating fake transaction hashes, block numbers, or confirmations.
  - **Critical LoanRegistry State Preservation**: Enforces that unsupported or rejected adapter operations never mutate the central `LoanRegistry`.
  - **Dual-Provider Runtime Switching**: Seamlessly toggle between `LocalPrototypeWalletProvider` (for instant multi-role testing) and `MidnightWalletAdapter` (for browser connector integration).
  - **Interactive Wallet Connection UI**: Mounted `WalletConnectionPanel.tsx` in the dashboard with provider toggle, detection status badges, connection controls, public identity view, atomic capability matrix, and transparent prototype notices.
- **Transaction Orchestration & Lifecycle Dispatch (Commit #23)**:
  - **Deterministic Two-Phase Pipeline**: Introduces `prepareLifecycleTransaction` and `executeLifecycleTransaction` (`frontend/src/lib/transaction-orchestrator.ts`) to cleanly partition contract guard validation and capability evaluation from execution.
  - **Canonical 1:1 Circuit Dispatch Mapping**: Standardizes mapping between high-level actions (`VERIFY_ELIGIBILITY`, `FUND_LOAN`, `REPAY_LOAN`, `SETTLE_LOAN`) and underlying Midnight Compact circuits (`verifyEligibility`, `fundLoan`, `repayLoan`, `settleLoan`).
  - **Provider Capability Requirement Engine**: Enforces atomic capability matrix checks per action, identifying supported off-chain operations (`VERIFY_ELIGIBILITY` via local ZK prover) versus actions requiring live on-chain capabilities (`FUND_LOAN`, `REPAY_LOAN`, `SETTLE_LOAN` requiring wallet signing & submission).
  - **Strict Anti-Fabrication & Ledger Invariants**: In prototype mode, on-chain actions return typed `UNSUPPORTED` outcomes with transparent error classifications. Zero fake transaction hashes, block numbers, or confirmations are ever generated.
  - **Critical LoanRegistry State Preservation**: Guarantees that unsupported or rejected transaction attempts **never mutate the central `LoanRegistry`**. Unconfirmed actions leave agreement status, assigned lenders, and timestamps untouched.
  - **Lifecycle Transaction Dispatch UI**: Integrates interactive dispatch monitor in `NetworkStatusPanel.tsx` clearly segregating supported local actions from unsupported network actions.
- **Midnight Network & Wallet Provider Abstraction (Commit #22)**:
  - **Strongly Typed Infrastructure Models**: Comprehensive typing (`frontend/src/types/network.ts`, `frontend/src/types/transaction.ts`) defining network environments (`LOCAL`, `TESTNET`, `MAINNET`), connection states, provider capability matrices, network account representations, and typed domain errors (`ProviderError`).
  - **Modular Wallet Provider Interface**: `WalletProvider` boundary (`frontend/src/lib/wallet-provider.ts`) abstracting connection lifecycle, public key resolution, network context, capability queries, and transaction submission.
  - **Local Prototype Provider Implementation**: `LocalPrototypeWalletProvider` (`frontend/src/lib/midnight-provider.ts`) implementing the provider interface for local simulation, exposing deterministic public identities (`BORROWER`, `LENDER`, `THIRD_PARTY`, `NONE`) with explicit offline markers (`isPrototype: true`, `isRealNetwork: false`, `environment: 'LOCAL'`).
  - **Decoupled Account Service**: Refactored `frontend/src/lib/account-service.ts` to consume the active `WalletProvider` adapter rather than hardcoding identity behaviors, allowing future Midnight.js/Lace providers to be plugged in seamlessly.
  - **Truthful Atomic Capability Matrix**: Transparently exposes what is genuinely supported locally (`READ_PUBLIC_LEDGER: true`, `CREATE_PROOF: true`) versus network operations that require future live infrastructure (`SIGN_TRANSACTION: false`, `SUBMIT_TRANSACTION: false`, `READ_TRANSACTION_STATUS: false`, `READ_BALANCE: false`).
  - **Anti-Fabrication Transaction Boundary**: Transaction submission via prototype provider throws typed `ProviderError('UNSUPPORTED_OPERATION')` with sanitized user-facing messages. Zero fake transaction hashes or simulated confirmations are fabricated.
  - **Network & Provider Status UI**: Interactive status panel (`NetworkStatusPanel.tsx`) in the dashboard providing full visibility into active environment, provider adapter, connection state, and live capability matrices with honest prototype disclosures.
- **Centralized Loan Registry & Application State Engine (Commit #21)**:
  - **Authoritative Single Source of Truth**: Introduces `LoanRegistry` (`frontend/src/lib/loan-registry.ts`) as the single central store for all public loan agreements, completely eliminating duplicate component-level state and cross-component synchronization discrepancies.
  - **Deterministic Ordering & Deduplication**: Preserves deterministic loan insertion ordering and strictly rejects duplicate loan IDs with typed domain errors (`LoanRegistryError('DUPLICATE_LOAN_ID')`).
  - **Immutable Agreement Terms Preservation**: Enforces `assertImmutableTermsPreserved` on every agreement update, guaranteeing that core financial terms (`amount`, `interestRateBasisPoints`, `durationBlocks`, `eligibilityThreshold`, `borrower`, `borrowerBytes`) cannot be mutated after creation.
  - **Canonical State Machine Transitions**: Guards every lifecycle change via `validateLifecycleTransition`, enforcing strict sequential progression (`REQUESTED (unverified) → REQUESTED (verified) → FUNDED → REPAID → SETTLED`) and rejecting invalid or out-of-order state mutations with typed errors.
  - **Clean Persistence Adapter Boundary**: Decouples storage via `LoanRegistryPersistence` (`frontend/src/lib/application-store.ts`), providing both `InMemoryLoanRegistryPersistence` (testing/runtime fallback) and `LocalStorageLoanRegistryPersistence` (browser persistence with custom BigInt/Uint8Array serialization).
  - **Account-Aware Authorization Sync**: Synchronizes seamlessly with `getAccountAuthorization` from Commit #20 so that all dynamic permissions reflect registry transitions in real-time.
- **Wallet / Account Identity Abstraction & Dynamic Authorization (Commit #20)**:
  - **Typed Account Domain Models**: Strongly typed definitions (`frontend/src/types/account.ts`) for connection status, roles (`BORROWER`, `LENDER`, `PARTICIPANT`, `NONE`), public identity models, and contextual authorization matrices.
  - **Contract-Guarded Authorization Engine**: Pure evaluation engine (`frontend/src/lib/account-authorization.ts`) querying canonical Compact guards (`canVerifyEligibility`, `canFundLoan`, `canRepayLoan`, `canSettleLoan`) against the active account's public key.
  - **Interactive Account Switcher**: UI component (`AccountSwitcher.tsx`) enabling evaluators to seamlessly toggle personas and test authorization boundaries with explicit `"Simulation Only"` notices.
- **Settlement Frontend Workflow & Protocol Finality (Commit #19)**:
  - **Typed Settlement Domain Models**: Comprehensive typing (`frontend/src/types/settlement.ts`) defining settlement readiness states, multi-party authorization models, audit records, and settlement results.
  - **Symmetrical Participant Authorization**: Governed by canonical contract rules (`settleLoan`), authorizing either the verified borrower (`loan.borrowerBytes`) or the assigned lender (`loan.lenderBytes`) to trigger protocol closure while rejecting unauthorized third parties (`UNAUTHORIZED_PARTICIPANT`).
  - **Contract-Guarded Readiness**: Enforces canonical lifecycle validation via `canSettleLoan` from `contracts/client/loan-api.ts`, returning typed readiness codes (`READY_TO_SETTLE`, `LOAN_NOT_REPAID`, `ALREADY_SETTLED`, `UNAUTHORIZED_PARTICIPANT`, `LOAN_NOT_AVAILABLE`).
  - **Interactive Role Switcher & Review Drawer**: `SettlementPanel.tsx` offers seamless switching between borrower and lender perspectives, an agreement details breakdown, and an expandable review drawer.
  - **Terminal Protocol Finality & 5-Phase Stepper**: `SettlementConfirmation.tsx` renders the terminal `SETTLED` state with complete extinguishment of debt obligations and an updated 5-phase visual stepper (`REQUESTED → VERIFIED → FUNDED → REPAID → [SETTLED]`).
- **Borrower Repayment Workflow & Contract-Guarded Repayment UI (Commit #18)**:
  - **Typed Repayment Domain Models**: Comprehensive typing (`frontend/src/types/repayment.ts`) defining lifecycle readiness states, calculation models, and attestations.
  - **Exact BigInt Parity**: Obligation calculations in `frontend/src/lib/repayment-service.ts` directly delegate to `calculateRepaymentObligation` from the contract workspace with exact integer basis points math.
  - **Contract-Guarded Readiness**: Derives readiness strictly from canonical `canRepayLoan` (`READY_TO_REPAY`, `LOAN_NOT_FUNDED`, `ALREADY_REPAID`, `AGREEMENT_CONCLUDED`, `UNAUTHORIZED_BORROWER`, `LOAN_NOT_AVAILABLE`).
  - **Two-Step Review Breakdown**: `RepaymentPanel.tsx` displays principal, agreed interest, and total obligation before requiring explicit user confirmation.
- **Borrower Confidential Eligibility Verification Workflow (Commit #17)**:
  - **Typed Prover Integration**: Clean client service (`frontend/src/lib/eligibility-service.ts`) invoking the authentic Midnight Compact zero-knowledge circuit off-chain.
  - **Strict Witness Boundary**: Ephemeral password-style input (`PrivateEligibilityInput.tsx`) cleared immediately upon proof initiation; zero storage in `localStorage`, `sessionStorage`, cookies, or URL queries.
  - **5-Stage Prover Visualization**: Real-time progress indicators for witness preparation, constraint generation, circuit execution, local verification, and attestation.
- **Lender Loan Evaluation & Funding Workflow (Commit #16)**:
  - Typed evaluation models operating exclusively on public `LoanDetailsModel` properties.
  - Exact BigInt arithmetic for interest earnings and expected return without floating-point drift.
  - Canonical contract-guarded readiness via `canFundLoan`.
- **Public Loan Marketplace Discovery (Commit #15)**:
  - Search agreements by Loan ID, Borrower, or Lender.
  - Lifecycle filtering with verified state derivation (`status === requested && isEligibilityVerified === true`).
  - Deterministic 6-way BigInt sorting with tie-breaking.
- **Borrower Loan Request UI (Commit #14)**: Propose confidential micro-loans with basis-point precision and real-time validation.
- **Strict Privacy Separation**: Zero private financial credentials, secret witnesses, or confidential inputs accessible to the frontend or lenders.

> [!WARNING]
> **Network & Wallet Status**: The frontend operates in **Local Prototype Mode & Adapter Boundary** (Commit #24). Live Midnight.js wallet integration (e.g. Lace Wallet extension connection and on-chain transaction signing) is structured behind `MidnightWalletAdapter` but requires future installed SDK packages (`@midnight-ntwrk/dapp-connector-api`, live Midnight node RPC). No fabricated blockchain transactions, synthetic hashes, or mock wallet connections are executed in this commit.
