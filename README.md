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
# 180 passing tests across 8 test suites
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

### Current Status & Features (Commit #21)
- **Centralized Loan Registry & Application State Engine (Commit #21)**:
  - **Authoritative Single Source of Truth**: Introduces `LoanRegistry` (`frontend/src/lib/loan-registry.ts`) as the single central store for all public loan agreements, completely eliminating duplicate component-level state and cross-component synchronization discrepancies.
  - **Deterministic Ordering & Deduplication**: Preserves deterministic loan insertion ordering and strictly rejects duplicate loan IDs with typed domain errors (`LoanRegistryError('DUPLICATE_LOAN_ID')`).
  - **Immutable Agreement Terms Preservation**: Enforces `assertImmutableTermsPreserved` on every agreement update, guaranteeing that core financial terms (`amount`, `interestRateBasisPoints`, `durationBlocks`, `eligibilityThreshold`, `borrower`, `borrowerBytes`) cannot be mutated after creation.
  - **Canonical State Machine Transitions**: Guards every lifecycle change via `validateLifecycleTransition`, enforcing strict sequential progression (`REQUESTED (unverified) → REQUESTED (verified) → FUNDED → REPAID → SETTLED`) and rejecting invalid or out-of-order state mutations with typed errors.
  - **Clean Persistence Adapter Boundary**: Decouples storage via `LoanRegistryPersistence` (`frontend/src/lib/application-store.ts`), providing both `InMemoryLoanRegistryPersistence` (testing/runtime fallback) and `LocalStorageLoanRegistryPersistence` (browser persistence with custom BigInt/Uint8Array serialization).
  - **Account-Aware Authorization Sync**: Synchronizes seamlessly with `getAccountAuthorization` from Commit #20 so that all dynamic permissions reflect registry transitions in real-time.
- **Wallet / Account Identity Abstraction & Dynamic Authorization (Commit #20)**:
  - **Typed Account Domain Models**: Strongly typed definitions (`frontend/src/types/account.ts`) for connection status, roles (`BORROWER`, `LENDER`, `PARTICIPANT`, `NONE`), public identity models, and contextual authorization matrices.
  - **Local Prototype Account Adapter**: Clean account service (`frontend/src/lib/account-service.ts`) providing deterministic mock identities (`Mock Borrower Account`, `Mock Lender Account`, `Mock Third-Party Account`, and Disconnected) without coupling the UI to live wallet infrastructure.
  - **Contract-Guarded Authorization Engine**: Pure evaluation engine (`frontend/src/lib/account-authorization.ts`) querying canonical Compact guards (`canVerifyEligibility`, `canFundLoan`, `canRepayLoan`, `canSettleLoan`) against the active account's public key.
  - **Interactive Account Switcher**: UI component (`AccountSwitcher.tsx`) enabling evaluators to seamlessly toggle personas and test authorization boundaries with explicit `"Simulation Only"` notices.
  - **Real-Time Permissions Matrix**: Agreement-specific status panel (`AccountStatusPanel.tsx`) and dynamic action button adaptation in `LoanActionPanel.tsx`.
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
> **Network & Wallet Status**: The frontend operates in **Local Prototype Mode** (Commit #21). Live Midnight.js wallet integration (e.g. Lace Wallet) and on-chain transaction signing are **not implemented yet** and will be integrated in upcoming milestones. No real blockchain transactions or wallet connections are executed in this commit.
