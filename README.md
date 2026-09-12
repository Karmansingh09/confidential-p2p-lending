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
Run the automated test suite covering all 5 lifecycle transitions and client API:
```bash
npm test
```



