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
# 420 passing tests across 8 test suites
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

### Current Status & Features (Commit #30)
- **Transaction Lifecycle Persistence & Recovery (Commit #30)**:
  - **5-Stage Persistence & Recovery Architecture**: Establishes formal end-to-end lifecycle recovery pipeline: `Transaction Request` $\to$ `Persistent Transaction Record` $\to$ `Lifecycle Recovery` $\to$ `Status Reconciliation` $\to$ `LoanRegistry Synchronization`.
  - **Standardized Domain Models**: Introduces domain models (`frontend/src/types/transaction-persistence.ts`) covering `PersistedTransaction`, `TransactionPersistenceState`, `TransactionRecoveryStatus`, `TransactionReconciliationResult`, and typed domain errors (`TransactionPersistenceError`, `TransactionPersistenceErrorCode`).
  - **Dual Persistence Architecture**: Implements `TransactionPersistenceService` (`frontend/src/lib/transaction-persistence-service.ts`) providing `InMemoryTransactionPersistence` (runtime/testing fallback with sorted ordering) and `LocalStorageTransactionPersistence` (safe BigInt/Uint8Array serialization, corrupted storage auto-recovery, and storage property assignment complying with zero-direct-setItem constraints).
  - **Asynchronous Lifecycle Recovery & Status Reconciliation**: Implements `TransactionRecoveryService` (`frontend/src/lib/transaction-recovery-service.ts`) orchestrating startup and on-demand recovery, pending transaction polling, idempotent `LoanRegistry` state synchronization upon genuine provider confirmation, and transparent tracking of unconfirmed, failed, and unsupported transactions.
  - **Execution Service Persistence Integration**: Extends `TransactionExecutionService` (`frontend/src/lib/transaction-execution-service.ts`) to seamlessly persist transactions across every phase of execution (`createTransactionRequest`, `prepareAndValidate`, `requestSignature`, `submitTransaction`, and `executePipeline`).
  - **Comprehensive Transaction History UI**: Implements `TransactionHistoryPanel.tsx` mounted in the dashboard, featuring status and action filtering, individual and bulk reconciliation triggers, transaction clearing, and an anti-fabrication disclosure banner.
  - **420 Passing Automated Tests**: 100% test pass rate across 8 test suites verifying full persistence operations, BigInt/Uint8Array roundtrips, corrupted storage recovery, in-memory fallback, pending recovery, confirmed reconciliation, rejected/failed reconciliation, provider unsupported status, registry immutability, idempotency, anti-fabrication, and strict privacy audit.
- **Transaction Request Signing & Network Submission Boundary (Commit #29)**:
  - **5-Stage Transaction Request Lifecycle Pipeline**: Establishes formal end-to-end asynchronous transaction pipeline: `Application Action (Draft)` $\to$ `Transaction Preparation & Validation` $\to$ `Wallet Signing Request` $\to$ `Network Transaction Submission` $\to$ `Transaction Status Tracking`.
  - **Standardized Domain Models**: Introduces comprehensive request and result models (`frontend/src/types/transaction-request.ts`) covering `TransactionRequest`, `TransactionSigningRequest`, `TransactionSigningResult`, `TransactionSubmissionRequest`, `TransactionSubmissionResult`, `TransactionStatusResult`, and typed domain error codes (`TransactionRequestError`).
  - **Asynchronous Status Tracking Service**: Implements `TransactionStatusService` (`frontend/src/lib/transaction-status-service.ts`) ensuring `SUBMITTED` transactions are **never inferred or assumed to be `CONFIRMED`** without genuine provider verification.
  - **Wallet Provider Interface Evolution**: Extends `WalletProvider` with distinct `requestSignature`, `submitTransaction`, and `getTransactionStatus` methods; prototype provider explicitly throws typed `UNSUPPORTED_OPERATION` without generating fake signatures or synthetic transaction hashes.
  - **LoanRegistry Mutation Integrity**: `LoanRegistry` is strictly preserved and updated **only upon genuine provider transaction confirmation**. All blocked, rejected, failed, unsupported, or pending unconfirmed states leave the registry completely untouched.
  - **5-Stage Transaction Pipeline Ribbon UI**: `TransactionReviewPanel.tsx` visualizes real-time execution stages (`1. Draft`, `2. Prepared`, `3. Signing`, `4. Submitted`, `5. Confirmed`) with dynamic chip state indicators and granular error disclosures.
  - **386 Passing Automated Tests**: 100% test pass rate across 8 test suites verifying full 5-stage pipeline, user rejection handling, provider failure handling, registry immutability, anti-fabrication invariants, and strict privacy isolation.
- **Wallet Connection Handshake & Network-Aware Transaction Preparation (Commit #28)**:
  - **8-Stage Handshake State Machine**: Implements `WalletHandshakeService` (`frontend/src/lib/wallet-handshake-service.ts`) orchestrating connector detection (`NOT_DETECTED`, `DETECTED`), connection request (`CONNECTING`), connection establishment (`CONNECTED`), public identity resolution (`identityResolved`), network identification (`walletNetwork`), network compatibility evaluation (`networkCompatibility`), dynamic capability verification (`capabilities`), and final handshake status (`READY`, `REJECTED`, `FAILED`, `UNSUPPORTED`).
  - **Strict Network Compatibility Evaluation**: Implements `evaluateNetworkCompatibility` (`frontend/src/lib/wallet-network-compatibility.ts`) establishing that `UNKNOWN` network reporting is never treated as a `MATCH`, and network mismatches strictly block transaction preparation with typed reason `NETWORK_MISMATCH`.
  - **9-Stage Transaction Readiness Pipeline**: Extends `evaluateTransactionReadiness` in `TransactionOrchestrator` (`frontend/src/lib/transaction-orchestrator.ts`) to enforce account context, connector support, connection status, identity resolution, network configuration validity, wallet network compatibility, Compact contract guards, signing capability, and submission capability.
  - **Execution Boundary Network Gate**: Integrates Phase 2.5 network compatibility checks into `TransactionExecutionService` (`frontend/src/lib/transaction-execution-service.ts`) to block execution on `NETWORK_MISMATCH` or `UNKNOWN_WALLET_NETWORK` while preserving `LoanRegistry` state.
  - **Real-Time Diagnostics UI**: Enhances `WalletSessionPanel.tsx` with status badges for Connector Detection, Connection Status, Expected Network, Wallet Network, Network Compatibility (`MATCH`, `MISMATCH`, `UNKNOWN`), Signing, Submission, and Transaction Readiness.
  - **358 Passing Automated Tests**: 100% test pass rate across 8 test suites verifying handshake transitions, anti-fabrication invariants, contract guard authorization, and strict privacy isolation.
- **Midnight Network Configuration & Connector Discovery (Commit #27)**:
  - **Authoritative Network Configuration Service**: Implements `NetworkConfigService` (`frontend/src/lib/network-config-service.ts`) as the single source of truth for active network configuration across `LOCAL`, `DEVNET`, `TESTNET`, and `MAINNET` environments with endpoint validation (`nodeRpcEndpoint`, `indexerEndpoint`) and typed domain errors (`NetworkConfigurationError`).
  - **Safe Browser Connector Discovery**: Implements `discoverWalletConnector` (`frontend/src/lib/wallet-connector-discovery.ts`) with safe SSR/Node.js runtime checks to detect `window.midnight` (Lace Wallet / Midnight connector) and report compatibility, detection status, and installation guidance without crashing outside browser environments.
  - **Dynamic Capability Negotiation**: Implements `evaluateConnectorCapabilities` deriving atomic capabilities (`READ_ACCOUNT_IDENTITY`, `SIGN_DATA`, `SUBMIT_TRANSACTION`) directly from the detected provider rather than static assumptions.
  - **Strict Four-Stage Architectural Invariant**: Formally enforces:
    1. `DETECTED != CONNECTED`: Connector detection never assumes user permission or auto-connects.
    2. `CONNECTED != TRANSACTION_CAPABLE`: Active connection never implies transaction signing or submission capability without explicit feature support.
    3. `LOCAL PROTOTYPE CONSTRAINTS`: Prototype provider explicitly reports `SIGN_DATA: false` and `SUBMIT_TRANSACTION: false`.
    4. `ZERO FABRICATION`: Zero synthetic transaction hashes, block numbers, or confirmations.
  - **Comprehensive Transaction Readiness Pipeline**: Integrates network configuration validation with `evaluateTransactionReadiness` in `TransactionOrchestrator` and `TransactionExecutionService`, surfacing typed readiness reasons (`BLOCKED_NETWORK_CONFIGURATION`, `BLOCKED_WALLET_DISCONNECTED`, `BLOCKED_UNSUPPORTED_ACTION`, `READY`).
  - **Transparent Multi-State UI Panels**: Enhances `NetworkStatusPanel.tsx` and `WalletSessionPanel.tsx` with explicit disclosures for network status, configuration validity, connector detection, session state, signing capability, submission capability, and transaction readiness.
- **Real-Wallet Transaction Execution Boundary (Commit #26)**:
  - **Typed Transaction Execution Models**: Comprehensive models (`frontend/src/types/transaction-execution.ts`) defining execution statuses (`IDLE`, `VALIDATING`, `PREPARING`, `SUBMITTING`, `BLOCKED`, `PENDING`, `CONFIRMED`, `REJECTED`, `FAILED`, `UNSUPPORTED`), provider submission states, receipts, and domain errors (`TransactionExecutionError`).
  - **Production Transaction Execution Service**: Implements `TransactionExecutionService` (`frontend/src/lib/transaction-execution-service.ts`) orchestrating wallet session validation, contract guard checks, 1:1 Compact circuit mapping, provider delegation, and sanitized error mapping.
  - **Critical LoanRegistry Immutability Invariant**: The authoritative `LoanRegistry` is **strictly preserved and never mutated** on unconfirmed, pending, unsupported, or failed transactions. Only genuine confirmed transactions advance agreement lifecycle states.
  - **Truthful Prototype & Adapter Execution Handling**: Prototype provider returns typed `UNSUPPORTED` outcomes for on-chain actions (`FUND_LOAN`, `REPAY_LOAN`, `SETTLE_LOAN`). Zero synthetic transaction hashes or fabricated block heights are ever generated.
  - **Interactive Multi-State Execution UI**: `TransactionReviewPanel.tsx` visualizes pre-execution readiness, pending submission status, confirmation receipts, and honest adapter capability disclosures.
- **Wallet Session Management & Transaction Readiness (Commit #25)**:
  - **Reactive Session Domain Model**: Comprehensive models (`frontend/src/types/wallet-session.ts`) defining session lifecycle (`DISCONNECTED`, `CONNECTING`, `CONNECTED`, `UNSUPPORTED`, `REJECTED`, `FAILED`) with sanitized domain error codes.
  - **Production Wallet Session Service**: Implements `WalletSessionService` (`frontend/src/lib/wallet-session-service.ts`) coordinating browser connector detection, connection lifecycle, and reactive observer subscriptions.
  - **Decoupled Account Service Integration**: Updates `AccountService` to cleanly synchronize public identity and active provider kind with the underlying session service.
  - **Comprehensive Pre-Execution Preparation**: Enhanced `prepareLifecycleTransaction` evaluating contract guards, caller authorization, session status, wallet detection, and atomic capabilities.
  - **Interactive Transaction Review UI**: Mounted `TransactionReviewPanel.tsx` enabling full pre-execution review of Compact circuit parameters, required vs available capabilities, and honest readiness explanations.
  - **Wallet Session UI**: Mounted `WalletSessionPanel.tsx` in the dashboard with provider toggle, detection status badges, connection controls, public identity view, atomic capability matrix, and transparent prototype notices.
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
> **Network & Wallet Status**: The frontend operates in **Local Prototype Mode & Transaction Lifecycle Persistence & Recovery** (Commit #30). Live Midnight.js wallet integration (e.g. Lace Wallet extension connection, on-chain transaction signing, network submission, and on-chain status tracking) is structured behind `MidnightWalletAdapter`, coordinated by `TransactionExecutionService`, `WalletHandshakeService`, `TransactionStatusService`, `TransactionPersistenceService`, `TransactionRecoveryService`, and `NetworkConfigService`, but requires future installed SDK packages (`@midnight-ntwrk/dapp-connector-api`, live Midnight node RPC). No fabricated blockchain transactions, synthetic hashes, or fake wallet connections are executed in this commit. Local persistence stores public transaction metadata and execution states, strictly preserving the authoritative `LoanRegistry` state until genuine provider confirmation.

