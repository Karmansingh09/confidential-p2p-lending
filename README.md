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

### Current Status & Features (Commit #17)
- **Borrower Confidential Eligibility Verification Workflow (Commit #17)**:
  - **Typed Prover Integration**: Clean client service (`frontend/src/lib/eligibility-service.ts`) invoking the authentic Midnight Compact zero-knowledge circuit off-chain.
  - **Strict Witness Boundary**: Ephemeral password-style input (`PrivateEligibilityInput.tsx`) cleared immediately upon proof initiation; zero storage in `localStorage`, `sessionStorage`, cookies, or URL queries.
  - **5-Stage Prover Visualization**: Real-time progress indicators for witness preparation, constraint generation, circuit execution, local verification, and attestation.
  - **Compact Circuit Authority**: Cryptographically rejects under-threshold inputs with sanitized errors without exposing secret amounts or internal stack traces.
  - **Success & Privacy Attestation**: Result view (`EligibilityVerificationResult.tsx`) affirming `PRIVATE VALUE ≠ PUBLIC DATA` and transitioning the agreement to `REQUESTED + VERIFIED`.
  - **Seamless Lifecycle Unlocking**: Moving an agreement to verified immediately unlocks the lender evaluation and capital funding workflow.
- **Lender Loan Evaluation & Funding Workflow (Commit #16)**:
  - Typed evaluation models operating exclusively on public `LoanDetailsModel` properties.
  - Exact BigInt arithmetic for interest earnings and expected return without floating-point drift.
  - Canonical contract-guarded readiness via `canFundLoan`.
  - Two-step prototype funding drawer and confirmation card with honest disclosure: `Asset Transfer Status: "Not executed — local prototype mode"`.
- **Public Loan Marketplace Discovery (Commit #15)**:
  - Search agreements by Loan ID, Borrower, or Lender.
  - Lifecycle filtering with verified state derivation (`status === requested && isEligibilityVerified === true`).
  - Deterministic 6-way BigInt sorting with tie-breaking.
- **Borrower Loan Request UI (Commit #14)**: Propose confidential micro-loans with basis-point precision and real-time validation.
- **Strict Privacy Separation**: Zero private financial credentials, secret witnesses, or confidential inputs accessible to the frontend or lenders.

> [!WARNING]
> **Network & Wallet Status**: The frontend operates in **Local Mock UI Mode** (Commit #17). Live Midnight.js wallet integration (e.g. Lace Wallet) and on-chain transaction signing are **not implemented yet** and will be integrated in upcoming milestones. No real blockchain transactions or wallet connections are executed in this commit.
