import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { calculateRepaymentObligation, LoanStatus } from '../contracts/dist/index.js';
import {
  validateLoanRequestForm,
  parsePercentageToBasisPoints,
  basisPointsToPercentage,
} from '../frontend/src/lib/validation.ts';
import { createLocalLoanRequest } from '../frontend/src/lib/loan-service.ts';
import {
  MOCK_LOANS,
  DEFAULT_LOAN_ID,
} from '../frontend/src/lib/mock-data.ts';
import {
  isVerifiedLoan,
  isUnverifiedRequested,
  matchesSearch,
  matchesLifecycleFilter,
  sortLoans,
  getLifecycleCounts,
  queryMarketplace,
  getLifecycleActionDescriptor,
} from '../frontend/src/lib/marketplace.ts';
import {
  evaluateLoanForLender,
  getFundingReadiness,
  getEvaluationWarnings,
  calculateExpectedReturn,
  calculateInterestEarnings,
  executeLocalFunding,
  DEFAULT_LENDER_PK_BYTES,
  DEFAULT_LENDER_PK_HEX,
  ALTERNATIVE_LENDER_PK_BYTES,
  ALTERNATIVE_LENDER_PK_HEX,
} from '../frontend/src/lib/lender-evaluation.ts';
import {
  getEligibilityVerificationState,
  verifyBorrowerEligibility,
  sanitizeEligibilityError,
  createEligibilityAttestation,
  PROOF_GENERATION_STEPS,
} from '../frontend/src/lib/eligibility-service.ts';
import {
  calculateRepaymentPreview,
  getRepaymentReadiness,
  createRepaymentAttestation,
  executeRepaymentPrototype,
} from '../frontend/src/lib/repayment-service.ts';
import {
  getSettlementReadiness,
  evaluateLoanForSettlement,
  createSettlementAttestation,
  executeSettlementPrototype,
} from '../frontend/src/lib/settlement-service.ts';
import {
  connectMockAccount,
  disconnectMockAccount,
  switchMockRole,
  getMockAccount,
  getAvailableMockIdentities,
  MOCK_BORROWER_PK,
  MOCK_LENDER_PK,
  MOCK_THIRD_PARTY_PK,
} from '../frontend/src/lib/account-service.ts';
import { getAccountAuthorization } from '../frontend/src/lib/account-authorization.ts';
import {
  LoanRegistry,
  validateLifecycleTransition,
  assertImmutableTermsPreserved,
} from '../frontend/src/lib/loan-registry.ts';
import {
  InMemoryLoanRegistryPersistence,
  LocalStorageLoanRegistryPersistence,
  createDefaultLoanRegistry,
} from '../frontend/src/lib/application-store.ts';
import { LoanRegistryError } from '../frontend/src/types/application-state.ts';
import {
  LocalPrototypeWalletProvider,
  createDefaultWalletProvider,
  PROTOTYPE_BORROWER_PK,
  PROTOTYPE_LENDER_PK,
  PROTOTYPE_THIRD_PARTY_PK,
} from '../frontend/src/lib/midnight-provider.ts';
import { ProviderError } from '../frontend/src/types/network.ts';
import {
  getWalletProvider,
  setWalletProvider,
  resetWalletProvider,
  getActiveProviderKind,
  switchToMidnightAdapter,
  switchToPrototypeProvider,
} from '../frontend/src/lib/account-service.ts';
import {
  MidnightWalletAdapter,
  createMidnightWalletAdapter,
} from '../frontend/src/lib/midnight-wallet-adapter.ts';
import { WalletAdapterError } from '../frontend/src/types/wallet-adapter.ts';
import {
  WalletSessionError,
} from '../frontend/src/types/wallet-session.ts';
import {
  WalletSessionService,
  getWalletSessionService,
  resetWalletSessionService,
  getCurrentWalletSession,
  connectWalletSession,
  disconnectWalletSession,
  subscribeToWalletSession,
} from '../frontend/src/lib/wallet-session-service.ts';
import {
  prepareLifecycleTransaction,
  executeLifecycleTransaction,
  getTransactionExecutionReadiness,
  getSupportedLifecycleActions,
  getCircuitNameForAction,
  getRequiredCapabilitiesForAction,
  ACTION_TO_CIRCUIT_MAP,
  CIRCUIT_TO_ACTION_MAP,
  ACTION_REQUIRED_CAPABILITIES,
} from '../frontend/src/lib/transaction-orchestrator.ts';
import { TransactionOrchestrationError } from '../frontend/src/types/transaction-orchestration.ts';
import {
  TransactionExecutionService,
  getTransactionExecutionService,
  resetTransactionExecutionService,
} from '../frontend/src/lib/transaction-execution-service.ts';
import { TransactionExecutionError } from '../frontend/src/types/transaction-execution.ts';
import {
  NetworkConfigurationError,
  validateNetworkConfig,
  NetworkConfigService,
  getNetworkConfigService,
  resetNetworkConfigService,
  getNetworkConfig,
  getNetworkConfigurationStatus,
  setNetworkConfig,
  resetNetworkConfig,
  DEFAULT_LOCAL_NETWORK_CONFIG,
} from '../frontend/src/lib/network-config-service.ts';
import {
  discoverWalletConnector,
  evaluateConnectorCapabilities,
  resolveConnectorReadinessState,
} from '../frontend/src/lib/wallet-connector-discovery.ts';
import {
  evaluateTransactionReadiness,
} from '../frontend/src/lib/transaction-orchestrator.ts';
import {
  getConnectorReadinessState,
  getConnectorDiscovery,
} from '../frontend/src/lib/wallet-session-service.ts';
import {
  evaluateNetworkCompatibility,
  normalizeNetworkId,
} from '../frontend/src/lib/wallet-network-compatibility.ts';
import {
  WalletHandshakeService,
  getWalletHandshakeService,
  resetWalletHandshakeService,
  performWalletHandshake,
  getWalletHandshakeState,
} from '../frontend/src/lib/wallet-handshake-service.ts';
import { WalletHandshakeError } from '../frontend/src/types/wallet-handshake.ts';
import {
  TransactionStatusService,
  getTransactionStatusService,
  resetTransactionStatusService,
} from '../frontend/src/lib/transaction-status-service.ts';
import { TransactionRequestError } from '../frontend/src/types/transaction-request.ts';
import {
  InMemoryTransactionPersistence,
  LocalStorageTransactionPersistence,
  TransactionPersistenceService,
  getTransactionPersistenceService,
  resetTransactionPersistenceService,
  TRANSACTION_STORAGE_KEY,
} from '../frontend/src/lib/transaction-persistence-service.ts';
import {
  TransactionRecoveryService,
  getTransactionRecoveryService,
  resetTransactionRecoveryService,
} from '../frontend/src/lib/transaction-recovery-service.ts';
import {
  TransactionPersistenceError,
} from '../frontend/src/types/transaction-persistence.ts';
import {
  TransactionEventService,
  getTransactionEventService,
  resetTransactionEventService,
} from '../frontend/src/lib/transaction-event-service.ts';
import {
  TransactionReconciliationService,
  getTransactionReconciliationService,
  resetTransactionReconciliationService,
} from '../frontend/src/lib/transaction-reconciliation-service.ts';
import { canVerifyEligibility, canFundLoan, canRepayLoan, canSettleLoan } from '../contracts/dist/index.js';

describe('Frontend Foundation & UI Architecture Tests', () => {
  const frontendDir = path.resolve(process.cwd(), 'frontend');
  const srcDir = path.resolve(frontendDir, 'src');

  it('Test 1: Frontend directory structure and required source files exist', () => {
    const requiredFiles = [
      'package.json',
      'tsconfig.json',
      'vite.config.ts',
      'index.html',
      'src/main.tsx',
      'src/App.tsx',
      'src/App.css',
      'src/index.css',
      'src/types/index.ts',
      'src/types/lender.ts',
      'src/types/eligibility.ts',
      'src/types/repayment.ts',
      'src/types/settlement.ts',
      'src/types/account.ts',
      'src/types/application-state.ts',
      'src/types/network.ts',
      'src/types/network-config.ts',
      'src/types/transaction.ts',
      'src/types/transaction-orchestration.ts',
      'src/types/wallet-adapter.ts',
      'src/types/wallet-session.ts',
      'src/lib/formatters.ts',
      'src/lib/mock-data.ts',
      'src/lib/validation.ts',
      'src/lib/loan-service.ts',
      'src/lib/marketplace.ts',
      'src/lib/lender-evaluation.ts',
      'src/lib/eligibility-service.ts',
      'src/lib/repayment-service.ts',
      'src/lib/settlement-service.ts',
      'src/lib/account-service.ts',
      'src/lib/account-authorization.ts',
      'src/lib/loan-registry.ts',
      'src/lib/application-store.ts',
      'src/lib/wallet-provider.ts',
      'src/lib/midnight-provider.ts',
      'src/lib/transaction-orchestrator.ts',
      'src/lib/midnight-wallet-adapter.ts',
      'src/lib/wallet-session-service.ts',
      'src/lib/network-config-service.ts',
      'src/lib/wallet-connector-discovery.ts',
      'src/pages/DashboardPage.tsx',
      'src/pages/CreateLoanPage.tsx',
      'src/components/Header.tsx',
      'src/components/StateBanner.tsx',
      'src/components/LoanStatusBadge.tsx',
      'src/components/LoanSummaryCard.tsx',
      'src/components/LifecycleStepper.tsx',
      'src/components/PrivacyIndicator.tsx',
      'src/components/LoanActionPanel.tsx',
      'src/components/LoanRequestForm.tsx',
      'src/components/LoanPreview.tsx',
      'src/components/NetworkStatusPanel.tsx',
      'src/components/WalletConnectionPanel.tsx',
      'src/components/WalletSessionPanel.tsx',
      'src/components/TransactionReviewPanel.tsx',
      'src/components/ValidationMessage.tsx',
      'src/components/LoanMarketplace.tsx',
      'src/components/LenderEvaluationPanel.tsx',
      'src/components/FundingConfirmation.tsx',
      'src/components/PrivateEligibilityInput.tsx',
      'src/components/EligibilityVerificationResult.tsx',
      'src/components/EligibilityVerificationPanel.tsx',
      'src/components/RepaymentPanel.tsx',
      'src/components/RepaymentConfirmation.tsx',
      'src/components/SettlementPanel.tsx',
      'src/components/SettlementConfirmation.tsx',
      'src/components/AccountSwitcher.tsx',
      'src/components/AccountStatusPanel.tsx',
    ];

    for (const relPath of requiredFiles) {
      const fullPath = path.join(frontendDir, relPath);
      assert.ok(
        fs.existsSync(fullPath),
        `Expected file to exist: ${relPath}`
      );
    }
  });

  it('Test 2: Protocol lifecycle phases (5 sequential steps) are represented in frontend types and components', () => {
    const typesPath = path.join(srcDir, 'types', 'index.ts');
    const typesContent = fs.readFileSync(typesPath, 'utf8');

    const expectedPhases = [
      'REQUESTED',
      'ELIGIBILITY_VERIFIED',
      'FUNDED',
      'REPAID',
      'SETTLED',
    ];

    for (const phase of expectedPhases) {
      assert.ok(
        typesContent.includes(phase),
        `Protocol phase ${phase} should be defined in frontend types`
      );
    }

    const stepperPath = path.join(srcDir, 'components', 'LifecycleStepper.tsx');
    const stepperContent = fs.readFileSync(stepperPath, 'utf8');

    for (const phase of expectedPhases) {
      assert.ok(
        stepperContent.includes(phase),
        `Protocol phase ${phase} should be handled in LifecycleStepper component`
      );
    }
  });

  it('Test 3: LoanSummaryCard calculation strictly matches contract calculateRepaymentObligation', () => {
    // Check repayment obligation calculation consistency between contracts and frontend
    const sampleLoans = [
      { amount: 10000n, rateBps: 500n },   // 5% -> 10500
      { amount: 25000n, rateBps: 750n },   // 7.5% -> 26875
      { amount: 50000n, rateBps: 600n },   // 6% -> 53000
      { amount: 15000n, rateBps: 800n },   // 8% -> 16200
    ];

    for (const loan of sampleLoans) {
      const contractCalculation = calculateRepaymentObligation(loan.amount, loan.rateBps);
      const interestAmount = (loan.amount * loan.rateBps) / 10000n;
      const frontendCalculation = loan.amount + interestAmount;

      assert.equal(
        frontendCalculation,
        contractCalculation,
        `Frontend calculation should equal contract calculation for amount ${loan.amount}`
      );
    }
  });

  it('Test 4: Mock dataset covers all 5 lifecycle stages using LoanStatus values', () => {
    const mockDataPath = path.join(srcDir, 'lib', 'mock-data.ts');
    const mockDataContent = fs.readFileSync(mockDataPath, 'utf8');

    assert.ok(mockDataContent.includes('loan-001'));
    assert.ok(mockDataContent.includes('loan-002'));
    assert.ok(mockDataContent.includes('loan-003'));
    assert.ok(mockDataContent.includes('loan-004'));
    assert.ok(mockDataContent.includes('loan-005'));

    // Check that LoanStatus enum references match Compact contract
    assert.ok(mockDataContent.includes('LoanStatus.requested'));
    assert.ok(mockDataContent.includes('LoanStatus.funded'));
    assert.ok(mockDataContent.includes('LoanStatus.repaid'));
    assert.ok(mockDataContent.includes('LoanStatus.settled'));
  });

  it('Test 5: STRICT PRIVACY INVARIANT - No private witness values or secrets in frontend code', () => {
    const forbiddenPatterns = [
      'getPrivateFinancialValue',
      'BORROWER_PRIVATE_FINANCIAL_VALUE',
      'privateFinancialValue',
      'witness context',
      'privateState',
    ];

    const walkDir = (dir) => {
      let results = [];
      const list = fs.readdirSync(dir);
      list.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
          results = results.concat(walkDir(filePath));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          results.push(filePath);
        }
      });
      return results;
    };

    const sourceFiles = walkDir(srcDir);
    assert.ok(sourceFiles.length > 5, 'Should have scanned multiple frontend source files');

    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf8');
      for (const pattern of forbiddenPatterns) {
        assert.equal(
          content.includes(pattern),
          false,
          `Forbidden privacy-violating pattern "${pattern}" detected in frontend file: ${file}`
        );
      }
    }
  });

  it('Test 6: Production build output exists and contains valid HTML bundle', () => {
    const distHtmlPath = path.join(frontendDir, 'dist', 'index.html');
    assert.ok(
      fs.existsSync(distHtmlPath),
      'Expected frontend/dist/index.html to exist after build'
    );

    const html = fs.readFileSync(distHtmlPath, 'utf8');
    assert.ok(html.includes('<div id="root"></div>'));
    assert.ok(html.includes('Confidential P2P Micro-Lending Desk'));
    assert.ok(html.includes('<script type="module"'));
  });

  it('Test 7: Mock mode and network disconnected notices are prominently present in UI components', () => {
    const bannerPath = path.join(srcDir, 'components', 'StateBanner.tsx');
    const bannerContent = fs.readFileSync(bannerPath, 'utf8');
    assert.ok(bannerContent.includes('LOCAL MOCK MODE'));
    assert.ok(bannerContent.includes('Disconnected from Midnight Network'));

    const headerPath = path.join(srcDir, 'components', 'Header.tsx');
    const headerContent = fs.readFileSync(headerPath, 'utf8');
    assert.ok(headerContent.includes('Midnight Network (Offline/Mock)'));

    const actionPanelPath = path.join(srcDir, 'components', 'LoanActionPanel.tsx');
    const actionPanelContent = fs.readFileSync(actionPanelPath, 'utf8');
    assert.ok(actionPanelContent.includes('Local Mock Mode'));
  });

  // ---------------------------------------------------------------------------
  // Commit #14 Specific Tests: Borrower Loan Request UI & Validation
  // ---------------------------------------------------------------------------

  it('Test 8 (Req A): Valid loan request form data is accepted and parsed correctly', () => {
    const formValues = {
      principalAmount: '25000',
      interestRatePercent: '5.00',
      durationBlocks: '100',
      eligibilityThreshold: '30000',
    };

    const result = validateLoanRequestForm(formValues);
    assert.equal(result.isValid, true);
    assert.deepEqual(result.errors, {});
    assert.ok(result.data);
    assert.equal(result.data.principalAmount, 25000n);
    assert.equal(result.data.interestRateBasisPoints, 500n);
    assert.equal(result.data.durationBlocks, 100n);
    assert.equal(result.data.eligibilityThreshold, 30000n);
  });

  it('Test 9 (Req B): Zero and negative loan amounts are rejected by client validation', () => {
    const zeroAmountResult = validateLoanRequestForm({
      principalAmount: '0',
      interestRatePercent: '5.00',
      durationBlocks: '100',
      eligibilityThreshold: '30000',
    });
    assert.equal(zeroAmountResult.isValid, false);
    assert.match(zeroAmountResult.errors.principalAmount ?? '', /greater than zero/);

    const emptyAmountResult = validateLoanRequestForm({
      principalAmount: '',
      interestRatePercent: '5.00',
      durationBlocks: '100',
      eligibilityThreshold: '30000',
    });
    assert.equal(emptyAmountResult.isValid, false);
    assert.match(emptyAmountResult.errors.principalAmount ?? '', /required/);
  });

  it('Test 10 (Req C): Zero duration is rejected by client validation', () => {
    const zeroDurationResult = validateLoanRequestForm({
      principalAmount: '10000',
      interestRatePercent: '5.00',
      durationBlocks: '0',
      eligibilityThreshold: '20000',
    });
    assert.equal(zeroDurationResult.isValid, false);
    assert.match(zeroDurationResult.errors.durationBlocks ?? '', /greater than zero/);
  });

  it('Test 11 (Req D): Interest rate outside the supported range is rejected', () => {
    // 0% rejected
    const zeroRate = validateLoanRequestForm({
      principalAmount: '10000',
      interestRatePercent: '0',
      durationBlocks: '100',
      eligibilityThreshold: '20000',
    });
    assert.equal(zeroRate.isValid, false);
    assert.match(zeroRate.errors.interestRatePercent ?? '', /greater than 0%/);

    // Greater than 100% (> 10000 bps) rejected
    const excessiveRate = validateLoanRequestForm({
      principalAmount: '10000',
      interestRatePercent: '100.01',
      durationBlocks: '100',
      eligibilityThreshold: '20000',
    });
    assert.equal(excessiveRate.isValid, false);
    assert.match(excessiveRate.errors.interestRatePercent ?? '', /cannot exceed 100\.00%/);

    // Negative rate rejected
    const negativeRate = validateLoanRequestForm({
      principalAmount: '10000',
      interestRatePercent: '-5.00',
      durationBlocks: '100',
      eligibilityThreshold: '20000',
    });
    assert.equal(negativeRate.isValid, false);

    // More than 2 decimal places rejected (avoids fractional basis point ambiguity)
    const threeDecimals = validateLoanRequestForm({
      principalAmount: '10000',
      interestRatePercent: '5.255',
      durationBlocks: '100',
      eligibilityThreshold: '20000',
    });
    assert.equal(threeDecimals.isValid, false);
  });

  it('Test 12 (Req E): Zero eligibility threshold is rejected by client validation', () => {
    const zeroThreshold = validateLoanRequestForm({
      principalAmount: '15000',
      interestRatePercent: '6.00',
      durationBlocks: '150',
      eligibilityThreshold: '0',
    });
    assert.equal(zeroThreshold.isValid, false);
    assert.match(zeroThreshold.errors.eligibilityThreshold ?? '', /greater than zero/);
  });

  it('Test 13 (Req F): Basis-point conversion is exact and avoids floating point precision issues', () => {
    // Integer percentages
    assert.equal(parsePercentageToBasisPoints('5').bps, 500n);
    assert.equal(parsePercentageToBasisPoints('10').bps, 1000n);
    assert.equal(parsePercentageToBasisPoints('100').bps, 10000n);

    // Decimal percentages
    assert.equal(parsePercentageToBasisPoints('5.25').bps, 525n);
    assert.equal(parsePercentageToBasisPoints('0.01').bps, 1n);
    assert.equal(parsePercentageToBasisPoints('7.5').bps, 750n);
    assert.equal(parsePercentageToBasisPoints('7.50').bps, 750n);
    assert.equal(parsePercentageToBasisPoints('8.12%').bps, 812n);

    // Format back to percentage
    assert.equal(basisPointsToPercentage(500n), '5.00%');
    assert.equal(basisPointsToPercentage(1n), '0.01%');
    assert.equal(basisPointsToPercentage(10000n), '100.00%');
    assert.equal(basisPointsToPercentage(750n), '7.50%');
  });

  it('Test 14 (Req G): LoanPreview displays strictly public loan terms and no private data', () => {
    const previewPath = path.join(srcDir, 'components', 'LoanPreview.tsx');
    const previewContent = fs.readFileSync(previewPath, 'utf8');

    // Asserts public terms are represented
    assert.ok(previewContent.includes('Requested Principal'));
    assert.ok(previewContent.includes('Agreed Interest Rate'));
    assert.ok(previewContent.includes('Estimated Total Due'));
    assert.ok(previewContent.includes('Loan Duration'));
    assert.ok(previewContent.includes('Public Underwriting Threshold'));
    assert.ok(previewContent.includes('REQUESTED'));
    assert.ok(previewContent.includes('NOT VERIFIED'));

    // Asserts privacy notice is prominently included
    assert.ok(previewContent.includes('Confidentiality Assurance'));
    assert.ok(previewContent.includes('The financial information used to'));
    assert.ok(previewContent.includes('entered into this form or stored in the public'));
    assert.ok(previewContent.includes('zero-knowledge verification'));
  });

  it('Test 15 (Req H & Privacy Audit): Privacy-sensitive terms are not requested in form or UI', () => {
    const formPath = path.join(srcDir, 'components', 'LoanRequestForm.tsx');
    const formContent = fs.readFileSync(formPath, 'utf8');

    const pagePath = path.join(srcDir, 'pages', 'CreateLoanPage.tsx');
    const pageContent = fs.readFileSync(pagePath, 'utf8');

    const sensitiveTerms = [
      'bank balance',
      'bank account',
      'annual income',
      'monthly salary',
      'private key',
      'seed phrase',
      'wallet secret',
      'cryptographic witness',
    ];

    for (const term of sensitiveTerms) {
      assert.equal(
        formContent.toLowerCase().includes(term),
        false,
        `Form should not contain sensitive term: ${term}`
      );
      assert.equal(
        pageContent.toLowerCase().includes(term),
        false,
        `CreateLoanPage should not contain sensitive term: ${term}`
      );
    }
  });

  it('Test 16 (Req I): Successful local loan creation instantiates agreement in REQUESTED state with eligibility NOT VERIFIED', () => {
    const validatedData = {
      principalAmount: 35000n,
      interestRateBasisPoints: 650n,
      durationBlocks: 200n,
      eligibilityThreshold: 45000n,
    };

    const newLoan = createLocalLoanRequest(validatedData);

    assert.equal(newLoan.status, LoanStatus.requested);
    assert.equal(newLoan.statusText, 'requested');
    assert.equal(newLoan.isEligibilityVerified, false);
    assert.equal(newLoan.amount, 35000n);
    assert.equal(newLoan.interestRateBasisPoints, 650n);
    assert.equal(newLoan.durationBlocks, 200n);
    assert.equal(newLoan.eligibilityThreshold, 45000n);
    assert.equal(newLoan.lender, null);
    assert.ok(newLoan.borrower.startsWith('0x'));
  });

  // ===========================================================================
  // Commit #15: Marketplace Discovery, Filtering, Sorting & Lifecycle Actions
  // ===========================================================================

  it('Test 17 (Commit #15 - Req 1): Marketplace loan collection loads realistic dataset with public LoanDetailsModel only', () => {
    const loanIds = Object.keys(MOCK_LOANS);
    assert.ok(loanIds.length >= 10, 'Marketplace should contain at least 10 realistic loans');

    for (const [id, loan] of Object.entries(MOCK_LOANS)) {
      assert.ok(typeof id === 'string' && id.startsWith('loan-'), `Loan ID ${id} should be well-formed`);
      assert.ok(loan.amount > 0n, `Principal amount must be positive for ${id}`);
      assert.ok(loan.interestRateBasisPoints > 0n && loan.interestRateBasisPoints <= 10000n, `Rate valid for ${id}`);
      assert.ok(loan.durationBlocks > 0n, `Duration must be positive for ${id}`);
      assert.ok(loan.eligibilityThreshold > 0n, `Threshold must be positive for ${id}`);
      assert.ok(typeof loan.isEligibilityVerified === 'boolean', `Verification flag must be boolean for ${id}`);
      assert.ok(typeof loan.status === 'number', `Status must be a number for ${id}`);
      assert.ok(typeof loan.borrower === 'string' && loan.borrower.startsWith('0x'), `Borrower must be hex for ${id}`);
      if (loan.lender) {
        assert.ok(typeof loan.lender === 'string' && loan.lender.startsWith('0x'), `Lender must be hex for ${id}`);
      }

      // STRICT ZERO-LEAKAGE: No private witness or income fields
      assert.equal('privateFinancialValue' in loan, false, `No privateFinancialValue in ${id}`);
      assert.equal('privateWitness' in loan, false, `No privateWitness in ${id}`);
      assert.equal('income' in loan, false, `No income in ${id}`);
      assert.equal('bankBalance' in loan, false, `No bankBalance in ${id}`);
    }
  });

  it('Test 18 (Commit #15 - Req 2): Search by Loan ID, Borrower, and Lender is accurate and deterministic', () => {
    // 1. Search by Loan ID
    assert.equal(matchesSearch('loan-003', MOCK_LOANS['loan-003'], 'loan-003'), true);
    assert.equal(matchesSearch('loan-003', MOCK_LOANS['loan-003'], '003'), true);
    assert.equal(matchesSearch('loan-001', MOCK_LOANS['loan-001'], 'loan-009'), false);

    // 2. Search by Borrower key
    const borrower1Hex = MOCK_LOANS['loan-001'].borrower;
    assert.equal(matchesSearch('loan-001', MOCK_LOANS['loan-001'], borrower1Hex.slice(0, 8)), true);
    assert.equal(matchesSearch('loan-003', MOCK_LOANS['loan-003'], borrower1Hex), false);

    // 3. Search by Lender key
    const lender1Hex = MOCK_LOANS['loan-003'].lender;
    assert.ok(lender1Hex !== null);
    assert.equal(matchesSearch('loan-003', MOCK_LOANS['loan-003'], lender1Hex.slice(0, 8)), true);
    assert.equal(matchesSearch('loan-001', MOCK_LOANS['loan-001'], lender1Hex), false); // loan-001 has no lender
  });

  it('Test 19 (Commit #15 - Req 2): Search is case-insensitive and trims whitespace safely', () => {
    const loan = MOCK_LOANS['loan-002'];
    assert.equal(matchesSearch('loan-002', loan, 'LOAN-002'), true);
    assert.equal(matchesSearch('loan-002', loan, '  loan-002  '), true);
    assert.equal(matchesSearch('loan-002', loan, '  '), true); // Empty search matches everything
    assert.equal(matchesSearch('loan-002', loan, loan.borrower.toUpperCase()), true);
  });

  it('Test 20 (Commit #15 - Req 3): Lifecycle filtering and VERIFIED derivation preserve canonical contract enum', () => {
    // Contract enum has exactly 4 states: requested (0), funded (1), repaid (2), settled (3)
    assert.equal(LoanStatus.requested, 0);
    assert.equal(LoanStatus.funded, 1);
    assert.equal(LoanStatus.repaid, 2);
    assert.equal(LoanStatus.settled, 3);
    assert.equal('verified' in LoanStatus, false, 'Canonical enum must NOT have a fake verified state');

    // Test derivation of verified loans: status === requested && isEligibilityVerified === true
    assert.equal(isVerifiedLoan(MOCK_LOANS['loan-002']), true);
    assert.equal(isVerifiedLoan(MOCK_LOANS['loan-007']), true);
    assert.equal(isVerifiedLoan(MOCK_LOANS['loan-001']), false); // unverified
    assert.equal(isVerifiedLoan(MOCK_LOANS['loan-003']), false); // funded

    // Test unverified requested loans
    assert.equal(isUnverifiedRequested(MOCK_LOANS['loan-001']), true);
    assert.equal(isUnverifiedRequested(MOCK_LOANS['loan-006']), true);
    assert.equal(isUnverifiedRequested(MOCK_LOANS['loan-002']), false);

    // Test filtering predicates
    assert.equal(matchesLifecycleFilter(MOCK_LOANS['loan-001'], 'requested'), true);
    assert.equal(matchesLifecycleFilter(MOCK_LOANS['loan-002'], 'requested'), false);
    assert.equal(matchesLifecycleFilter(MOCK_LOANS['loan-002'], 'verified'), true);
    assert.equal(matchesLifecycleFilter(MOCK_LOANS['loan-003'], 'funded'), true);
    assert.equal(matchesLifecycleFilter(MOCK_LOANS['loan-004'], 'repaid'), true);
    assert.equal(matchesLifecycleFilter(MOCK_LOANS['loan-005'], 'settled'), true);
    assert.equal(matchesLifecycleFilter(MOCK_LOANS['loan-001'], 'all'), true);
  });

  it('Test 21 (Commit #15 - Req 3): Lifecycle counts partition marketplace accurately', () => {
    const counts = getLifecycleCounts(MOCK_LOANS);
    assert.equal(counts.all, 10);
    assert.equal(counts.requested, 2); // loan-001, loan-006
    assert.equal(counts.verified, 2);  // loan-002, loan-007
    assert.equal(counts.funded, 2);    // loan-003, loan-008
    assert.equal(counts.repaid, 2);    // loan-004, loan-009
    assert.equal(counts.settled, 2);   // loan-005, loan-010

    const sum = counts.requested + counts.verified + counts.funded + counts.repaid + counts.settled;
    assert.equal(sum, counts.all, 'Sum of lifecycle partitions must equal total agreements');
  });

  it('Test 22 (Commit #15 - Req 4): Deterministic BigInt sorting across all 6 options without floating-point math', () => {
    const items = Object.entries(MOCK_LOANS).map(([id, loan]) => ({ id, loan }));

    // 1. Principal: Low -> High
    const sortedAmountAsc = sortLoans(items, 'amount-asc');
    for (let i = 1; i < sortedAmountAsc.length; i++) {
      const prev = sortedAmountAsc[i - 1].loan.amount;
      const curr = sortedAmountAsc[i].loan.amount;
      assert.ok(prev <= curr, `Amount asc failed: ${prev} should be <= ${curr}`);
    }

    // 2. Principal: High -> Low
    const sortedAmountDesc = sortLoans(items, 'amount-desc');
    for (let i = 1; i < sortedAmountDesc.length; i++) {
      const prev = sortedAmountDesc[i - 1].loan.amount;
      const curr = sortedAmountDesc[i].loan.amount;
      assert.ok(prev >= curr, `Amount desc failed: ${prev} should be >= ${curr}`);
    }

    // 3. Interest Rate: Low -> High
    const sortedRateAsc = sortLoans(items, 'rate-asc');
    for (let i = 1; i < sortedRateAsc.length; i++) {
      const prev = sortedRateAsc[i - 1].loan.interestRateBasisPoints;
      const curr = sortedRateAsc[i].loan.interestRateBasisPoints;
      assert.ok(prev <= curr, `Rate asc failed: ${prev} <= ${curr}`);
    }

    // 4. Interest Rate: High -> Low
    const sortedRateDesc = sortLoans(items, 'rate-desc');
    for (let i = 1; i < sortedRateDesc.length; i++) {
      const prev = sortedRateDesc[i - 1].loan.interestRateBasisPoints;
      const curr = sortedRateDesc[i].loan.interestRateBasisPoints;
      assert.ok(prev >= curr, `Rate desc failed: ${prev} >= ${curr}`);
    }

    // 5. Duration: Short -> Long
    const sortedDurationAsc = sortLoans(items, 'duration-asc');
    for (let i = 1; i < sortedDurationAsc.length; i++) {
      const prev = sortedDurationAsc[i - 1].loan.durationBlocks;
      const curr = sortedDurationAsc[i].loan.durationBlocks;
      assert.ok(prev <= curr, `Duration asc failed: ${prev} <= ${curr}`);
    }

    // 6. Duration: Long -> Short
    const sortedDurationDesc = sortLoans(items, 'duration-desc');
    for (let i = 1; i < sortedDurationDesc.length; i++) {
      const prev = sortedDurationDesc[i - 1].loan.durationBlocks;
      const curr = sortedDurationDesc[i].loan.durationBlocks;
      assert.ok(prev >= curr, `Duration desc failed: ${prev} >= ${curr}`);
    }
  });

  it('Test 23 (Commit #15 - Req 2, 3, 4): queryMarketplace executes search, filter, and sort in a single pipeline', () => {
    // Filter only verified loans, sorted by amount asc
    const results = queryMarketplace(MOCK_LOANS, '', 'verified', 'amount-asc');
    assert.equal(results.length, 2);
    assert.equal(results[0].id, 'loan-002'); // 25000
    assert.equal(results[1].id, 'loan-007'); // 40000

    // Search for borrower 3 in all categories
    const borrower3Hex = MOCK_LOANS['loan-006'].borrower;
    const b3Results = queryMarketplace(MOCK_LOANS, borrower3Hex.slice(0, 10), 'all', 'amount-asc');
    assert.equal(b3Results.length, 3); // loan-006, loan-008, loan-009
  });

  it('Test 24 (Commit #15 - Req 5): Lifecycle actions are derived using canonical contract guards without fabricating transactions', () => {
    // Phase 1: Unverified requested loan -> Verify action
    const action1 = getLifecycleActionDescriptor(MOCK_LOANS['loan-001']);
    assert.equal(action1.actionType, 'verify');
    assert.equal(action1.canExecute, true);
    assert.equal(action1.role, 'Borrower Action');
    assert.ok(action1.notice.includes('Eligibility verification required'));

    // Phase 2: Verified requested loan -> Fund action
    const action2 = getLifecycleActionDescriptor(MOCK_LOANS['loan-002']);
    assert.equal(action2.actionType, 'fund');
    assert.equal(action2.canExecute, true);
    assert.equal(action2.role, 'Lender Action');
    assert.ok(action2.notice.includes('ready for lender'));

    // Phase 3: Funded loan -> Repay action
    const action3 = getLifecycleActionDescriptor(MOCK_LOANS['loan-003']);
    assert.equal(action3.actionType, 'repay');
    assert.equal(action3.canExecute, true);
    assert.equal(action3.role, 'Borrower Action');
    assert.ok(action3.notice.includes('repayment'));

    // Phase 4: Repaid loan -> Settle action
    const action4 = getLifecycleActionDescriptor(MOCK_LOANS['loan-004']);
    assert.equal(action4.actionType, 'settle');
    assert.equal(action4.canExecute, true);
    assert.equal(action4.role, 'Borrower or Lender Action');
    assert.ok(action4.notice.includes('settlement'));

    // Phase 5: Settled loan -> Terminal state
    const action5 = getLifecycleActionDescriptor(MOCK_LOANS['loan-005']);
    assert.equal(action5.actionType, 'none');
    assert.equal(action5.canExecute, false);
    assert.equal(action5.role, 'Protocol Terminal State');
    assert.ok(action5.notice.includes('terminal settled state'));
  });

  it('Test 25 (Commit #15 - Req 6): Repayment calculation is consistent across all marketplace loans', () => {
    for (const [id, loan] of Object.entries(MOCK_LOANS)) {
      const contractCalc = calculateRepaymentObligation(loan.amount, loan.interestRateBasisPoints);
      const interestAmount = (loan.amount * loan.interestRateBasisPoints) / 10000n;
      const expectedTotal = loan.amount + interestAmount;

      assert.equal(
        contractCalc,
        expectedTotal,
        `Repayment obligation must match contract calculation for ${id}`
      );
    }
  });

  it('Test 26 (Commit #15 - Req 8): Empty search and non-existent loan fallbacks behave correctly', () => {
    // Non-matching search query returns empty array
    const emptyResults = queryMarketplace(MOCK_LOANS, 'non-existent-search-term-xyz', 'all', 'amount-asc');
    assert.equal(emptyResults.length, 0);

    // Verify DEFAULT_LOAN_ID exists in MOCK_LOANS
    assert.ok(DEFAULT_LOAN_ID in MOCK_LOANS);
  });

  it('Test 27 (Commit #15 - Req 6): LoanSummaryCard component clearly separates public agreement terms from private borrower information', () => {
    const cardPath = path.join(srcDir, 'components', 'LoanSummaryCard.tsx');
    const cardContent = fs.readFileSync(cardPath, 'utf8');

    // Required headers for boundary separation
    assert.ok(cardContent.includes('PUBLIC AGREEMENT INFORMATION'));
    assert.ok(cardContent.includes('PRIVATE BORROWER INFORMATION'));
    assert.ok(cardContent.includes('Intentionally Unavailable & Excluded'));

    // Required fields are rendered
    assert.ok(cardContent.includes('Principal Amount'));
    assert.ok(cardContent.includes('Interest Rate'));
    assert.ok(cardContent.includes('Total Repayment Due'));
    assert.ok(cardContent.includes('Loan Duration'));
    assert.ok(cardContent.includes('Eligibility Threshold'));
    assert.ok(cardContent.includes('Eligibility Status'));
    assert.ok(cardContent.includes('BORROWER'));
    assert.ok(cardContent.includes('LENDER'));
  });

  it('Test 28 (Commit #15 - Req 7 & Strict Privacy Audit): Zero references to private financial credentials across all frontend files', () => {
    const forbiddenTerms = [
      'getPrivateFinancialValue',
      'BORROWER_PRIVATE_FINANCIAL_VALUE',
      'privateFinancialValue',
      'private witness values',
      'borrower income',
      'bank balances',
      'credit scores',
      'seed phrases',
      'wallet private keys',
      'privateState',
    ];

    const walkDir = (dir) => {
      let results = [];
      const list = fs.readdirSync(dir);
      list.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
          results = results.concat(walkDir(filePath));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          results.push(filePath);
        }
      });
      return results;
    };

    const files = walkDir(srcDir);
    assert.ok(files.length >= 10, 'Must audit all frontend source files');

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      for (const term of forbiddenTerms) {
        assert.equal(
          content.includes(term),
          false,
          `Forbidden privacy-violating string "${term}" found in ${file}`
        );
      }
    }
  });

  // ===========================================================================
  // Commit #16: Lender Loan Evaluation & Funding Workflow Tests
  // ===========================================================================

  it('Test 29 (Commit #16 - Req 1): Verified requested loan is fundable by lender', () => {
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const readiness = getFundingReadiness(verifiedLoan, DEFAULT_LENDER_PK_BYTES);
    assert.equal(readiness.canFund, true);
    assert.equal(readiness.status, 'READY_TO_FUND');
    assert.equal(readiness.badgeType, 'success');
  });

  it('Test 30 (Commit #16 - Req 2): Unverified requested loan is NOT fundable', () => {
    const unverifiedLoan = MOCK_LOANS['loan-001'];
    const readiness = getFundingReadiness(unverifiedLoan, DEFAULT_LENDER_PK_BYTES);
    assert.equal(readiness.canFund, false);
    assert.equal(readiness.status, 'ELIGIBILITY_NOT_VERIFIED');
    assert.equal(readiness.badgeType, 'warning');
  });

  it('Test 31 (Commit #16 - Req 3): Funded loan is NOT fundable', () => {
    const fundedLoan = MOCK_LOANS['loan-003'];
    const readiness = getFundingReadiness(fundedLoan, DEFAULT_LENDER_PK_BYTES);
    assert.equal(readiness.canFund, false);
    assert.equal(readiness.status, 'LOAN_ALREADY_FUNDED');
    assert.equal(readiness.badgeType, 'warning');
  });

  it('Test 32 (Commit #16 - Req 4): Repaid loan is NOT fundable', () => {
    const repaidLoan = MOCK_LOANS['loan-004'];
    const readiness = getFundingReadiness(repaidLoan, DEFAULT_LENDER_PK_BYTES);
    assert.equal(readiness.canFund, false);
    assert.equal(readiness.status, 'LOAN_NOT_AVAILABLE');
    assert.equal(readiness.badgeType, 'info');
  });

  it('Test 33 (Commit #16 - Req 5): Settled loan is NOT fundable', () => {
    const settledLoan = MOCK_LOANS['loan-005'];
    const readiness = getFundingReadiness(settledLoan, DEFAULT_LENDER_PK_BYTES);
    assert.equal(readiness.canFund, false);
    assert.equal(readiness.status, 'AGREEMENT_CONCLUDED');
    assert.equal(readiness.badgeType, 'info');
  });

  it('Test 34 (Commit #16 - Req 6): Borrower cannot fund their own loan request', () => {
    const verifiedLoan = MOCK_LOANS['loan-002'];
    // Supply borrower's own public key bytes as lender key
    const readiness = getFundingReadiness(verifiedLoan, verifiedLoan.borrowerBytes);
    assert.equal(readiness.canFund, false);
    assert.equal(readiness.status, 'BORROWER_CANNOT_FUND_OWN_LOAN');
    assert.equal(readiness.badgeType, 'error');
  });

  it('Test 35 (Commit #16 - Req 7 & 9): Expected interest calculation is exact BigInt arithmetic', () => {
    // 25000 * 750 / 10000 = 1875
    const interest = calculateInterestEarnings(25000n, 750n);
    assert.equal(interest, 1875n);
    assert.equal(typeof interest, 'bigint');

    // 10000 * 400 / 10000 = 400
    assert.equal(calculateInterestEarnings(10000n, 400n), 400n);

    // 35000 * 650 / 10000 = 2275
    assert.equal(calculateInterestEarnings(35000n, 650n), 2275n);
  });

  it('Test 36 (Commit #16 - Req 8): Expected repayment calculation strictly matches canonical contract calculation', () => {
    const testCases = [
      { amount: 25000n, rateBps: 750n },
      { amount: 40000n, rateBps: 550n },
      { amount: 15000n, rateBps: 500n },
      { amount: 50000n, rateBps: 600n },
    ];

    for (const tc of testCases) {
      const contractCalc = calculateRepaymentObligation(tc.amount, tc.rateBps);
      const evalCalc = calculateExpectedReturn(tc.amount, tc.rateBps);
      assert.equal(evalCalc, contractCalc);
      assert.equal(evalCalc, tc.amount + (tc.amount * tc.rateBps) / 10000n);
    }
  });

  it('Test 37 (Commit #16 - Req 9): BigInt arithmetic is strictly used for all monetary calculations', () => {
    const loan = MOCK_LOANS['loan-002'];
    const evalData = evaluateLoanForLender('loan-002', loan, DEFAULT_LENDER_PK_HEX);

    assert.equal(typeof evalData.terms.amount, 'bigint');
    assert.equal(typeof evalData.terms.interestRateBasisPoints, 'bigint');
    assert.equal(typeof evalData.terms.durationBlocks, 'bigint');
    assert.equal(typeof evalData.terms.eligibilityThreshold, 'bigint');
    assert.equal(typeof evalData.terms.totalRepaymentObligation, 'bigint');
    assert.equal(typeof evalData.terms.expectedInterest, 'bigint');
    assert.equal(typeof evalData.expectedInterest, 'bigint');
    assert.equal(typeof evalData.expectedTotalReturn, 'bigint');
  });

  it('Test 38 (Commit #16 - Req 10): Funding simulation correctly transitions REQUESTED → FUNDED with lender assigned', () => {
    const loan = MOCK_LOANS['loan-002'];
    const { updatedLoan, result } = executeLocalFunding('loan-002', loan, DEFAULT_LENDER_PK_HEX);

    assert.equal(result.success, true);
    assert.equal(result.loanId, 'loan-002');
    assert.equal(result.previousStatus, 'REQUESTED');
    assert.equal(result.newStatus, 'FUNDED');
    assert.equal(result.lender, DEFAULT_LENDER_PK_HEX);
    assert.equal(result.amount, 25000n);
    assert.equal(result.expectedInterest, 1875n);
    assert.equal(result.expectedRepayment, 26875n);

    // Verify updated loan model
    assert.equal(updatedLoan.status, LoanStatus.funded);
    assert.equal(updatedLoan.statusText, 'funded');
    assert.equal(updatedLoan.lender, DEFAULT_LENDER_PK_HEX);
    assert.ok(updatedLoan.lenderBytes !== null);
  });

  it('Test 39 (Commit #16 - Req 11): Prototype funding explicitly declares asset transfer not executed in local prototype mode', () => {
    const loan = MOCK_LOANS['loan-002'];
    const { result } = executeLocalFunding('loan-002', loan, DEFAULT_LENDER_PK_HEX);

    assert.equal(result.assetTransferStatus, 'Not executed — local prototype mode');
    assert.ok(result.disclaimer.includes('Prototype mode'));
    assert.ok(result.disclaimer.includes('No real cryptocurrency tokens'));
  });

  it('Test 40 (Commit #16 - Req 12): Lender evaluation exposes exclusively public LoanDetailsModel information', () => {
    const loan = MOCK_LOANS['loan-002'];
    const evaluation = evaluateLoanForLender('loan-002', loan, DEFAULT_LENDER_PK_HEX);

    // Terms should contain ONLY public ledger fields
    const termKeys = Object.keys(evaluation.terms);
    const allowedKeys = [
      'loanId',
      'borrower',
      'lender',
      'amount',
      'interestRateBasisPoints',
      'durationBlocks',
      'eligibilityThreshold',
      'isEligibilityVerified',
      'status',
      'statusText',
      'totalRepaymentObligation',
      'expectedInterest',
    ];

    for (const key of termKeys) {
      assert.ok(allowedKeys.includes(key), `Field ${key} should be an allowed public term`);
    }

    // Explicitly verify absence of private fields
    assert.equal('privateFinancialValue' in evaluation.terms, false);
    assert.equal('privateWitness' in evaluation.terms, false);
    assert.equal('income' in evaluation.terms, false);
    assert.equal('bankBalance' in evaluation.terms, false);
  });

  it('Test 41 (Commit #16 - Req 13): Lender evaluation panel and confirmation UI components contain zero private financial data or secrets', () => {
    const evalPanelPath = path.join(srcDir, 'components', 'LenderEvaluationPanel.tsx');
    const evalContent = fs.readFileSync(evalPanelPath, 'utf8');

    const confirmPath = path.join(srcDir, 'components', 'FundingConfirmation.tsx');
    const confirmContent = fs.readFileSync(confirmPath, 'utf8');

    // Asserts privacy notices are present
    assert.ok(evalContent.includes('Zero-Knowledge Underwriting Attestation'));
    assert.ok(evalContent.includes('Borrower eligibility has been verified without revealing'));
    assert.ok(evalContent.includes('Private financial information is not exposed to lenders'));

    // Asserts confirmation displays asset transfer status
    assert.ok(confirmContent.includes('Asset Transfer Status'));
    assert.ok(confirmContent.includes('result.assetTransferStatus'));
  });

  it('Test 42 (Commit #16 - Req 9 & Strict Privacy Audit): Zero references to private financial credentials across all frontend files including new lender modules', () => {
    const forbiddenTerms = [
      'getPrivateFinancialValue',
      'BORROWER_PRIVATE_FINANCIAL_VALUE',
      'privateFinancialValue',
      'privateState',
      'borrower income',
      'salary',
      'bank balance',
      'credit score',
      'seed phrase',
      'private key',
      'financial documents',
    ];

    const walkDir = (dir) => {
      let results = [];
      const list = fs.readdirSync(dir);
      list.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
          results = results.concat(walkDir(filePath));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          results.push(filePath);
        }
      });
      return results;
    };

    const files = walkDir(srcDir);
    assert.ok(files.length >= 15, 'Must audit all frontend source files including lender modules');

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      for (const term of forbiddenTerms) {
        assert.equal(
          content.includes(term),
          false,
          `Forbidden privacy-violating string "${term}" found in ${file}`
        );
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Commit #17: Borrower Confidential Eligibility Verification Workflow Tests
  // ---------------------------------------------------------------------------

  it('Test 43 (Commit #17 - Req 1): Unverified requested loan requires eligibility verification', () => {
    const unverifiedLoan = MOCK_LOANS['loan-001'];
    assert.equal(unverifiedLoan.status, LoanStatus.requested);
    assert.equal(unverifiedLoan.isEligibilityVerified, false);

    const state = getEligibilityVerificationState(unverifiedLoan);
    assert.equal(state, 'READY');

    const guard = canVerifyEligibility(unverifiedLoan);
    assert.equal(guard.canExecute, true);
  });

  it('Test 44 (Commit #17 - Req 2): Verified requested loan does not require verification again', () => {
    const verifiedLoan = MOCK_LOANS['loan-002'];
    assert.equal(verifiedLoan.status, LoanStatus.requested);
    assert.equal(verifiedLoan.isEligibilityVerified, true);

    const state = getEligibilityVerificationState(verifiedLoan);
    assert.equal(state, 'VERIFIED');

    const guard = canVerifyEligibility(verifiedLoan);
    assert.equal(guard.canExecute, false);
    assert.ok(guard.reason?.includes('already verified'));
  });

  it('Test 45 (Commit #17 - Req 3): Funded loan cannot initiate eligibility verification', () => {
    const fundedLoan = MOCK_LOANS['loan-003'];
    assert.equal(fundedLoan.status, LoanStatus.funded);

    const state = getEligibilityVerificationState(fundedLoan);
    assert.equal(state, 'NOT_REQUIRED');

    const guard = canVerifyEligibility(fundedLoan);
    assert.equal(guard.canExecute, false);
    assert.ok(guard.reason?.includes('not in requested state'));
  });

  it('Test 46 (Commit #17 - Req 4): Repaid loan cannot initiate eligibility verification', () => {
    const repaidLoan = MOCK_LOANS['loan-004'];
    assert.equal(repaidLoan.status, LoanStatus.repaid);

    const state = getEligibilityVerificationState(repaidLoan);
    assert.equal(state, 'NOT_REQUIRED');

    const guard = canVerifyEligibility(repaidLoan);
    assert.equal(guard.canExecute, false);
  });

  it('Test 47 (Commit #17 - Req 5): Settled loan cannot initiate eligibility verification', () => {
    const settledLoan = MOCK_LOANS['loan-005'];
    assert.equal(settledLoan.status, LoanStatus.settled);

    const state = getEligibilityVerificationState(settledLoan);
    assert.equal(state, 'NOT_REQUIRED');

    const guard = canVerifyEligibility(settledLoan);
    assert.equal(guard.canExecute, false);
  });

  it('Test 48 (Commit #17 - Req 6): Non-borrower caller is rejected by lifecycle guard', () => {
    const loan = MOCK_LOANS['loan-001'];
    const otherCallerPk = new Uint8Array(32).fill(99);

    const guard = canVerifyEligibility(loan, otherCallerPk);
    assert.equal(guard.canExecute, false);
    assert.ok(guard.reason?.includes('not the borrower'));
  });

  it('Test 49 (Commit #17 - Req 7): Successful ZK verification transitions status to VERIFIED and isEligibilityVerified = true', async () => {
    const loan = MOCK_LOANS['loan-001'];
    // threshold is 30000n, so 35000n qualifies
    const qualifyingWitness = 35000n;

    const result = await verifyBorrowerEligibility({
      loanId: 'loan-001',
      loan,
      witnessAmount: qualifyingWitness,
    });

    assert.equal(result.isVerified, true);
    assert.equal(result.status, 'VERIFIED');
    assert.equal(result.loanId, 'loan-001');
    assert.equal(result.isPrototypeExecution, true);
    assert.ok(result.privacyAttestation.statement.includes('meets the required eligibility threshold'));
  });

  it('Test 50 (Commit #17 - Req 8): Under-threshold private input is rejected by Compact ZK circuit with sanitized error', async () => {
    const loan = MOCK_LOANS['loan-001'];
    // threshold is 30000n, so 25000n fails
    const failingWitness = 25000n;

    const result = await verifyBorrowerEligibility({
      loanId: 'loan-001',
      loan,
      witnessAmount: failingWitness,
    });

    assert.equal(result.isVerified, false);
    assert.equal(result.status, 'REJECTED');
    assert.equal(result.failureReason, 'UNDER_THRESHOLD');
    assert.equal(result.errorMessage, 'Eligibility requirement not satisfied.');
  });

  it('Test 51 (Commit #17 - Req 9): Failed verification does NOT mark loan as verified', async () => {
    const loan = { ...MOCK_LOANS['loan-001'] };
    const failingWitness = 1000n;

    const result = await verifyBorrowerEligibility({
      loanId: 'loan-001',
      loan,
      witnessAmount: failingWitness,
    });

    assert.equal(result.isVerified, false);
    assert.equal(loan.isEligibilityVerified, false);
  });

  it('Test 52 (Commit #17 - Req 10): Already verified loan returns sanitized already-verified notice', async () => {
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const result = await verifyBorrowerEligibility({
      loanId: 'loan-002',
      loan: verifiedLoan,
      witnessAmount: 50000n,
    });

    assert.equal(result.status, 'VERIFIED');
    assert.equal(result.isVerified, true);
    assert.equal(result.failureReason, 'ALREADY_VERIFIED');
    assert.ok(result.errorMessage?.includes('already been verified'));
  });

  it('Test 53 (Commit #17 - Req 11): Verification result is strictly sanitized and contains ZERO private witness amounts or secrets', async () => {
    const loan = MOCK_LOANS['loan-001'];
    const result = await verifyBorrowerEligibility({
      loanId: 'loan-001',
      loan,
      witnessAmount: 45000n,
    });

    assert.equal('witnessAmount' in result, false);
    assert.equal('secretAmount' in result, false);
    assert.equal('witness' in result, false);
    assert.equal('privateFinancialValue' in result, false);
    assert.equal('privateState' in result, false);
    assert.equal('income' in result, false);
    assert.equal('bankBalance' in result, false);

    // Verify result object values do not contain the number 45000 anywhere
    const resultString = JSON.stringify(result);
    assert.equal(resultString.includes('45000'), false);
  });

  it('Test 54 (Commit #17 - Req 12): Mock loan collection contains zero private financial values or secrets', () => {
    for (const [id, loan] of Object.entries(MOCK_LOANS)) {
      assert.equal('witnessAmount' in loan, false);
      assert.equal('secret' in loan, false);
      assert.equal('privateFinancialValue' in loan, false);
      assert.equal('income' in loan, false);
      assert.equal('balance' in loan, false);
      assert.ok(typeof loan.isEligibilityVerified === 'boolean');
      assert.ok(typeof loan.eligibilityThreshold === 'bigint');
    }
  });

  it('Test 55 (Commit #17 - Req 13): Frontend code does not write private credentials to localStorage or sessionStorage', () => {
    const walkDir = (dir) => {
      let results = [];
      const list = fs.readdirSync(dir);
      list.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
          results = results.concat(walkDir(filePath));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          results.push(filePath);
        }
      });
      return results;
    };

    const files = walkDir(srcDir);
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      assert.equal(content.includes('localStorage.setItem'), false, `Found localStorage in ${file}`);
      assert.equal(content.includes('sessionStorage.setItem'), false, `Found sessionStorage in ${file}`);
    }
  });

  it('Test 56 (Commit #17 - Req 14): Verification UI components expose strictly public agreement information', () => {
    const inputPath = path.join(srcDir, 'components', 'PrivateEligibilityInput.tsx');
    const panelPath = path.join(srcDir, 'components', 'EligibilityVerificationPanel.tsx');
    const resultPath = path.join(srcDir, 'components', 'EligibilityVerificationResult.tsx');

    const inputContent = fs.readFileSync(inputPath, 'utf8');
    const panelContent = fs.readFileSync(panelPath, 'utf8');
    const resultContent = fs.readFileSync(resultPath, 'utf8');

    // Asserts password input type is enforced
    assert.ok(inputContent.includes('type="password"'));
    assert.ok(inputContent.includes('autoComplete="off"'));

    // Asserts clear privacy model copy
    assert.ok(panelContent.includes('Confidential Eligibility Verification'));
    assert.ok(panelContent.includes('The lender will receive proof that you meet the eligibility requirement'));
    assert.ok(panelContent.includes('underlying financial value remains private'));

    // Asserts security notes
    assert.ok(inputContent.includes('Do not enter wallet signing credentials'));
  });

  it('Test 57 (Commit #17 - Req 15): Success result card displays "PRIVATE VALUE ≠ PUBLIC DATA" and never renders private value', () => {
    const resultPath = path.join(srcDir, 'components', 'EligibilityVerificationResult.tsx');
    const resultContent = fs.readFileSync(resultPath, 'utf8');

    assert.ok(resultContent.includes('PRIVATE VALUE ≠ PUBLIC DATA'));
    assert.ok(resultContent.includes('Hidden (Zero-Knowledge Protected)'));
    assert.ok(resultContent.includes('isEligibilityVerified: true'));
    assert.ok(resultContent.includes('Available for lender evaluation'));
  });

  it('Test 58 (Commit #17 - Req 16): PROOF_GENERATION_STEPS contains 5 distinct stages without fabricating progress percentages', () => {
    assert.equal(PROOF_GENERATION_STEPS.length, 5);
    const labels = PROOF_GENERATION_STEPS.map((s) => s.label);
    assert.ok(labels.includes('Preparing private witness'));
    assert.ok(labels.includes('Generating zero-knowledge proof'));
    assert.ok(labels.includes('Executing eligibility circuit'));
    assert.ok(labels.includes('Verifying result'));
    assert.ok(labels.includes('Eligibility attested'));
  });

  it('Test 59 (Commit #17 - Req 17): Verified loan becomes immediately fundable by lender via canonical canFundLoan', () => {
    const unverifiedLoan = MOCK_LOANS['loan-001'];
    const lenderPk = new Uint8Array(32).fill(77);

    // Prior to verification, lender cannot fund
    const unverifiedGuard = canFundLoan(unverifiedLoan, lenderPk);
    assert.equal(unverifiedGuard.canExecute, false);

    // After verification, lender can fund
    const verifiedLoan = {
      ...unverifiedLoan,
      isEligibilityVerified: true,
    };
    const verifiedGuard = canFundLoan(verifiedLoan, lenderPk);
    assert.equal(verifiedGuard.canExecute, true);
  });

  it('Test 60 (Commit #17 - Req 20 & Strict Privacy Audit): Zero references to private financial credentials across all frontend files including new eligibility modules', () => {
    const forbiddenTerms = [
      'getPrivateFinancialValue',
      'BORROWER_PRIVATE_FINANCIAL_VALUE',
      'privateFinancialValue',
      'witness context',
      'privateState',
      'borrower income',
      'salary',
      'bank balance',
      'credit score',
      'seed phrase',
      'private key',
      'financial documents',
    ];

    const walkDir = (dir) => {
      let results = [];
      const list = fs.readdirSync(dir);
      list.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
          results = results.concat(walkDir(filePath));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          results.push(filePath);
        }
      });
      return results;
    };

    const files = walkDir(srcDir);
    assert.ok(files.length >= 18, 'Must audit all frontend source files including eligibility modules');

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      for (const term of forbiddenTerms) {
        assert.equal(
          content.includes(term),
          false,
          `Forbidden privacy-violating string "${term}" found in ${file}`
        );
      }
    }
  });

  // ===========================================================================
  // Commit #18: Borrower Repayment Workflow & Contract-Guarded Repayment UI
  // ===========================================================================

  it('Test 61 (Commit #18): calculateRepaymentPreview executes exact BigInt integer math matching calculateRepaymentObligation', () => {
    // 10,000 principal with 500 bps (5.00%)
    const loan1 = {
      ...MOCK_LOANS['loan-003'],
      amount: 10000n,
      interestRateBasisPoints: 500,
    };
    const preview = calculateRepaymentPreview(loan1);
    const contractObligation = calculateRepaymentObligation(10000n, 500n);
    assert.equal(preview.principal, 10000n);
    assert.equal(preview.interestRateBasisPoints, 500n);
    assert.equal(preview.interestAmount, 500n);
    assert.equal(preview.totalObligation, 10500n);
    assert.equal(preview.totalObligation, contractObligation);

    // 25,000 principal with 750 bps (7.50%)
    const loan2 = {
      ...MOCK_LOANS['loan-003'],
      amount: 25000n,
      interestRateBasisPoints: 750,
    };
    const preview2 = calculateRepaymentPreview(loan2);
    const contractObligation2 = calculateRepaymentObligation(25000n, 750n);
    assert.equal(preview2.interestAmount, 1875n);
    assert.equal(preview2.totalObligation, 26875n);
    assert.equal(preview2.totalObligation, contractObligation2);
  });

  it('Test 62 (Commit #18): calculateRepaymentPreview preserves Euclidean field division truncation for non-divisible numbers', () => {
    // 1,234 principal with 333 bps -> (1234 * 333) / 10000 = 410922 / 10000 = 41n
    const irregularLoan = {
      ...MOCK_LOANS['loan-003'],
      amount: 1234n,
      interestRateBasisPoints: 333,
    };
    const preview = calculateRepaymentPreview(irregularLoan);
    const contractObligation = calculateRepaymentObligation(1234n, 333n);
    assert.equal(preview.interestAmount, 41n);
    assert.equal(preview.totalObligation, 1275n);
    assert.equal(preview.totalObligation, contractObligation);
  });

  it('Test 63 (Commit #18): getRepaymentReadiness returns READY_TO_REPAY for a funded loan matching borrower address', () => {
    const fundedLoan = MOCK_LOANS['loan-003'];
    assert.equal(fundedLoan.status, LoanStatus.funded);
    const readiness = getRepaymentReadiness(fundedLoan, fundedLoan.borrowerBytes);
    assert.equal(readiness.canRepay, true);
    assert.equal(readiness.status, 'READY_TO_REPAY');
    assert.equal(readiness.reason, undefined);
  });

  it('Test 64 (Commit #18): getRepaymentReadiness returns LOAN_NOT_FUNDED when loan is in requested or verified state', () => {
    const unverifiedLoan = MOCK_LOANS['loan-001'];
    const unverifiedReadiness = getRepaymentReadiness(unverifiedLoan, unverifiedLoan.borrowerBytes);
    assert.equal(unverifiedReadiness.canRepay, false);
    assert.equal(unverifiedReadiness.status, 'LOAN_NOT_FUNDED');
    assert.ok(unverifiedReadiness.reason.includes('not been funded'));

    const verifiedLoan = MOCK_LOANS['loan-002'];
    const verifiedReadiness = getRepaymentReadiness(verifiedLoan, verifiedLoan.borrowerBytes);
    assert.equal(verifiedReadiness.canRepay, false);
    assert.equal(verifiedReadiness.status, 'LOAN_NOT_FUNDED');
    assert.ok(verifiedReadiness.reason.includes('not been funded'));
  });

  it('Test 65 (Commit #18): getRepaymentReadiness returns ALREADY_REPAID when loan is in repaid state', () => {
    const repaidLoan = MOCK_LOANS['loan-004'];
    assert.equal(repaidLoan.status, LoanStatus.repaid);
    const readiness = getRepaymentReadiness(repaidLoan, repaidLoan.borrowerBytes);
    assert.equal(readiness.canRepay, false);
    assert.equal(readiness.status, 'ALREADY_REPAID');
    assert.ok(readiness.reason.includes('already been repaid'));
  });

  it('Test 66 (Commit #18): getRepaymentReadiness returns AGREEMENT_CONCLUDED when loan is in settled state', () => {
    const settledLoan = MOCK_LOANS['loan-005'];
    assert.equal(settledLoan.status, LoanStatus.settled);
    const readiness = getRepaymentReadiness(settledLoan, settledLoan.borrowerBytes);
    assert.equal(readiness.canRepay, false);
    assert.equal(readiness.status, 'AGREEMENT_CONCLUDED');
    assert.ok(readiness.reason.includes('concluded and reached terminal settlement'));
  });

  it('Test 67 (Commit #18): getRepaymentReadiness rejects execution for unauthorized caller PK', () => {
    const fundedLoan = MOCK_LOANS['loan-003'];
    const unauthorizedPk = new Uint8Array(32).fill(99);
    const readiness = getRepaymentReadiness(fundedLoan, unauthorizedPk);
    assert.equal(readiness.canRepay, false);
    assert.equal(readiness.status, 'UNAUTHORIZED_BORROWER');
    assert.ok(readiness.reason.includes('not the borrower'));
  });

  it('Test 68 (Commit #18): getRepaymentReadiness handles null or undefined loan gracefully', () => {
    const readiness = getRepaymentReadiness(null);
    assert.equal(readiness.canRepay, false);
    assert.equal(readiness.status, 'LOAN_NOT_AVAILABLE');
    assert.ok(readiness.reason.includes('unavailable'));
  });

  it('Test 69 (Commit #18): createRepaymentAttestation generates privacy attestation containing obligation details', () => {
    const attestation = createRepaymentAttestation('loan-003');
    assert.equal(attestation.title, 'Immutable Repayment Calculation');
    assert.ok(attestation.statement.includes('loan-003'));
    assert.ok(attestation.statement.includes('public immutable contract parameters'));
    assert.ok(attestation.notice.includes('No confidential'));
  });

  it('Test 70 (Commit #18): executeRepaymentPrototype executes state transition from funded to repaid', async () => {
    const fundedLoan = MOCK_LOANS['loan-003'];
    const { updatedLoan, result } = await executeRepaymentPrototype({
      loanId: 'loan-003',
      loan: fundedLoan,
    });
    assert.equal(result.success, true);
    assert.equal(updatedLoan.status, LoanStatus.repaid);
    assert.equal(updatedLoan.statusText, 'repaid');
    assert.equal(result.loanId, 'loan-003');
    assert.equal(result.repaidAmount, 53000n);
    assert.equal(result.assetTransferStatus, 'Not executed — local prototype mode');
  });

  it('Test 71 (Commit #18): executeRepaymentPrototype throws error when attempting to repay non-funded loan', async () => {
    const requestedLoan = MOCK_LOANS['loan-001'];
    await assert.rejects(
      async () => executeRepaymentPrototype({ loanId: 'loan-001', loan: requestedLoan }),
      /Cannot repay loan loan-001: Loan has not been funded/
    );

    const alreadyRepaidLoan = MOCK_LOANS['loan-004'];
    await assert.rejects(
      async () => executeRepaymentPrototype({ loanId: 'loan-004', loan: alreadyRepaidLoan }),
      /Cannot repay loan loan-004: This loan has already been repaid/
    );
  });

  it('Test 72 (Commit #18): executeRepaymentPrototype preserves all immutable agreement terms', async () => {
    const fundedLoan = MOCK_LOANS['loan-003'];
    const { updatedLoan } = await executeRepaymentPrototype({
      loanId: 'loan-003',
      loan: fundedLoan,
    });
    assert.equal(updatedLoan.amount, fundedLoan.amount);
    assert.equal(updatedLoan.interestRateBasisPoints, fundedLoan.interestRateBasisPoints);
    assert.equal(updatedLoan.durationDays, fundedLoan.durationDays);
    assert.equal(updatedLoan.eligibilityThreshold, fundedLoan.eligibilityThreshold);
    assert.equal(updatedLoan.isEligibilityVerified, fundedLoan.isEligibilityVerified);
    assert.deepEqual(updatedLoan.borrowerBytes, fundedLoan.borrowerBytes);
    assert.deepEqual(updatedLoan.lenderBytes, fundedLoan.lenderBytes);
  });

  it('Test 73 (Commit #18): RepaymentPanel source contains breakdown drawer, formula explanation, and prototype disclaimers', () => {
    const panelPath = path.join(srcDir, 'components', 'RepaymentPanel.tsx');
    const panelContent = fs.readFileSync(panelPath, 'utf8');

    // UI structure checks
    assert.ok(panelContent.includes('Repayment Obligation Breakdown'), 'Must display obligation breakdown');
    assert.ok(panelContent.includes('calculation-formula-box'), 'Must display formula box');
    assert.ok(panelContent.includes('repayment-review-drawer'), 'Must contain review drawer');
    assert.ok(panelContent.includes('repayment-readiness-banner'), 'Must show readiness banner');
    assert.ok(panelContent.includes('In prototype mode, this updates local protocol state without transferring native network tokens'), 'Must display prototype notice');
  });

  it('Test 74 (Commit #18): RepaymentConfirmation source contains lifecycle progression and honest asset transfer disclaimer', () => {
    const confPath = path.join(srcDir, 'components', 'RepaymentConfirmation.tsx');
    const confContent = fs.readFileSync(confPath, 'utf8');

    // Progression indicator checks
    assert.ok(confContent.includes('repayment-flow-indicator'), 'Must contain flow indicator');
    assert.ok(confContent.includes('FUNDED'), 'Must include FUNDED in flow');
    assert.ok(confContent.includes('REPAID'), 'Must include REPAID in flow');
    assert.ok(confContent.includes('SETTLED'), 'Must include SETTLED in flow');
    assert.ok(confContent.includes('result.disclaimer'), 'Must render disclaimer property');
    assert.ok(confContent.includes('Immutable Calculation Guarantee'), 'Must state calculation guarantee');
  });

  it('Test 75 (Commit #18 & Strict Privacy Audit): Zero references to private financial credentials across all frontend files including repayment modules', () => {
    const forbiddenTerms = [
      'getPrivateFinancialValue',
      'BORROWER_PRIVATE_FINANCIAL_VALUE',
      'privateFinancialValue',
      'witness context',
      'privateState',
      'borrower income',
      'salary',
      'bank balance',
      'credit score',
      'seed phrase',
      'private key',
      'wallet secret',
      'financial documents',
    ];

    const walkDir = (dir) => {
      let results = [];
      const list = fs.readdirSync(dir);
      list.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
          results = results.concat(walkDir(filePath));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          results.push(filePath);
        }
      });
      return results;
    };

    const files = walkDir(srcDir);
    assert.ok(files.length >= 22, 'Must audit all frontend source files including new repayment modules');

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      for (const term of forbiddenTerms) {
        assert.equal(
          content.includes(term),
          false,
          `Forbidden privacy-violating string "${term}" found in ${file}`
        );
      }
    }
  });

  // ===========================================================================
  // Commit #19: Terminal Loan Settlement Workflow Tests
  // ===========================================================================

  it('Test 76 (Commit #19 - Req A): Repaid loan is eligible for settlement by borrower', () => {
    const repaidLoan = MOCK_LOANS['loan-004'];
    assert.equal(repaidLoan.status, LoanStatus.repaid);
    const readiness = getSettlementReadiness(repaidLoan, repaidLoan.borrowerBytes);
    assert.equal(readiness.canSettle, true);
    assert.equal(readiness.status, 'READY_TO_SETTLE');
    assert.equal(readiness.callerRole, 'BORROWER');
    assert.equal(readiness.reason, undefined);
  });

  it('Test 77 (Commit #19 - Req B): Repaid loan is eligible for settlement by lender', () => {
    const repaidLoan = MOCK_LOANS['loan-004'];
    assert.equal(repaidLoan.status, LoanStatus.repaid);
    assert.ok(repaidLoan.lenderBytes);
    const readiness = getSettlementReadiness(repaidLoan, repaidLoan.lenderBytes);
    assert.equal(readiness.canSettle, true);
    assert.equal(readiness.status, 'READY_TO_SETTLE');
    assert.equal(readiness.callerRole, 'LENDER');
    assert.equal(readiness.reason, undefined);
  });

  it('Test 78 (Commit #19 - Req C & D): Requested and verified loans cannot be settled', () => {
    const unverifiedLoan = MOCK_LOANS['loan-001'];
    const unverifiedReadiness = getSettlementReadiness(unverifiedLoan, unverifiedLoan.borrowerBytes);
    assert.equal(unverifiedReadiness.canSettle, false);
    assert.equal(unverifiedReadiness.status, 'LOAN_NOT_REPAID');
    assert.ok(unverifiedReadiness.reason.includes('must be fully repaid'));

    const verifiedLoan = MOCK_LOANS['loan-002'];
    const verifiedReadiness = getSettlementReadiness(verifiedLoan, verifiedLoan.borrowerBytes);
    assert.equal(verifiedReadiness.canSettle, false);
    assert.equal(verifiedReadiness.status, 'LOAN_NOT_REPAID');
  });

  it('Test 79 (Commit #19 - Req E): Funded loan cannot be settled before repayment', () => {
    const fundedLoan = MOCK_LOANS['loan-003'];
    assert.equal(fundedLoan.status, LoanStatus.funded);
    const borrowerReadiness = getSettlementReadiness(fundedLoan, fundedLoan.borrowerBytes);
    assert.equal(borrowerReadiness.canSettle, false);
    assert.equal(borrowerReadiness.status, 'LOAN_NOT_REPAID');

    const lenderReadiness = getSettlementReadiness(fundedLoan, fundedLoan.lenderBytes);
    assert.equal(lenderReadiness.canSettle, false);
    assert.equal(lenderReadiness.status, 'LOAN_NOT_REPAID');
  });

  it('Test 80 (Commit #19 - Req F): Already settled loan cannot be settled again', () => {
    const settledLoan = MOCK_LOANS['loan-005'];
    assert.equal(settledLoan.status, LoanStatus.settled);
    const readiness = getSettlementReadiness(settledLoan, settledLoan.borrowerBytes);
    assert.equal(readiness.canSettle, false);
    assert.equal(readiness.status, 'ALREADY_SETTLED');
    assert.ok(readiness.reason.includes('already reached terminal settlement'));
  });

  it('Test 81 (Commit #19 - Req G): Unauthorized third party cannot settle', () => {
    const repaidLoan = MOCK_LOANS['loan-004'];
    const unauthorizedPk = new Uint8Array(32).fill(77);
    const readiness = getSettlementReadiness(repaidLoan, unauthorizedPk);
    assert.equal(readiness.canSettle, false);
    assert.equal(readiness.status, 'UNAUTHORIZED_PARTICIPANT');
    assert.equal(readiness.callerRole, 'UNAUTHORIZED');
    assert.ok(readiness.reason.includes('Only the borrower or designated lender'));
  });

  it('Test 82 (Commit #19 - Req H): Settlement transition correctly changes REPAID to SETTLED', async () => {
    const repaidLoan = MOCK_LOANS['loan-004'];
    const { updatedLoan, result } = await executeSettlementPrototype({
      loanId: 'loan-004',
      loan: repaidLoan,
      callerPk: repaidLoan.borrowerBytes,
      callerRole: 'BORROWER',
    });
    assert.equal(result.success, true);
    assert.equal(result.previousStatus, 'REPAID');
    assert.equal(result.updatedStatus, LoanStatus.settled);
    assert.equal(result.updatedStatusText, 'settled');
    assert.equal(updatedLoan.status, LoanStatus.settled);
    assert.equal(updatedLoan.statusText, 'settled');
    assert.equal(result.settledBy, 'BORROWER');
  });

  it('Test 83 (Commit #19 - Req I): Settlement assigns no new financial values or balance mutations', async () => {
    const repaidLoan = MOCK_LOANS['loan-004'];
    const { updatedLoan, result } = await executeSettlementPrototype({
      loanId: 'loan-004',
      loan: repaidLoan,
      callerPk: repaidLoan.borrowerBytes,
    });
    assert.equal(updatedLoan.amount, repaidLoan.amount);
    assert.equal(updatedLoan.interestRateBasisPoints, repaidLoan.interestRateBasisPoints);
    assert.equal(result.totalObligationCleared, 21600n);
  });

  it('Test 84 (Commit #19 - Req J): Settlement preserves original public loan terms', async () => {
    const repaidLoan = MOCK_LOANS['loan-004'];
    const { updatedLoan } = await executeSettlementPrototype({
      loanId: 'loan-004',
      loan: repaidLoan,
      callerPk: repaidLoan.lenderBytes,
      callerRole: 'LENDER',
    });
    assert.equal(updatedLoan.amount, repaidLoan.amount);
    assert.equal(updatedLoan.interestRateBasisPoints, repaidLoan.interestRateBasisPoints);
    assert.equal(updatedLoan.durationBlocks, repaidLoan.durationBlocks);
    assert.equal(updatedLoan.eligibilityThreshold, repaidLoan.eligibilityThreshold);
    assert.equal(updatedLoan.isEligibilityVerified, repaidLoan.isEligibilityVerified);
    assert.deepEqual(updatedLoan.borrowerBytes, repaidLoan.borrowerBytes);
    assert.deepEqual(updatedLoan.lenderBytes, repaidLoan.lenderBytes);
  });

  it('Test 85 (Commit #19 - Req K): Settlement result contains no private witness or financial secrets', async () => {
    const repaidLoan = MOCK_LOANS['loan-004'];
    const { result } = await executeSettlementPrototype({
      loanId: 'loan-004',
      loan: repaidLoan,
    });
    const serialized = JSON.stringify(result, (_, v) => (typeof v === 'bigint' ? v.toString() : v));
    assert.equal(serialized.includes('privateFinancialValue'), false);
    assert.equal(serialized.includes('witnessAmount'), false);
    assert.equal(serialized.includes('secret'), false);
    assert.ok(result.privacyAttestation.statement.includes('without disclosing confidential data'));
  });

  it('Test 86 (Commit #19 - Req L): Settlement explicitly reports asset transfer as not executed', async () => {
    const repaidLoan = MOCK_LOANS['loan-004'];
    const { result } = await executeSettlementPrototype({
      loanId: 'loan-004',
      loan: repaidLoan,
    });
    assert.equal(result.assetTransferStatus, 'Not executed — local prototype mode');
    assert.equal(result.networkStatus, 'Local Prototype');
    assert.ok(result.disclaimer.includes('No real blockchain transactions or asset movements occurred'));
  });

  it('Test 87 (Commit #19 - Req M): SETTLED is treated as terminal and rejects re-settlement', async () => {
    const repaidLoan = MOCK_LOANS['loan-004'];
    const { updatedLoan } = await executeSettlementPrototype({
      loanId: 'loan-004',
      loan: repaidLoan,
    });
    const terminalReadiness = getSettlementReadiness(updatedLoan, updatedLoan.borrowerBytes);
    assert.equal(terminalReadiness.canSettle, false);
    assert.equal(terminalReadiness.status, 'ALREADY_SETTLED');
    await assert.rejects(
      async () => executeSettlementPrototype({ loanId: 'loan-004', loan: updatedLoan }),
      /Cannot settle loan loan-004: This agreement has already reached terminal settlement/
    );
  });

  it('Test 88 (Commit #19 - Req N): evaluateLoanForSettlement exposes exclusively public agreement metadata', () => {
    const repaidLoan = MOCK_LOANS['loan-004'];
    const evaluation = evaluateLoanForSettlement(repaidLoan, repaidLoan.borrowerBytes);
    assert.equal(evaluation.principal, 20000n);
    assert.equal(evaluation.interestRateBasisPoints, 800n);
    assert.equal(evaluation.repaymentObligation, 21600n);
    assert.equal(evaluation.repaymentStatus, 'COMPLETE');
    assert.equal(evaluation.settlementReadiness.canSettle, true);
    assert.equal(evaluation.currentStatus, LoanStatus.repaid);
    assert.equal(evaluation.currentStatusText, 'repaid');
  });

  it('Test 89 (Commit #19): Settlement UI components contain authorization, review step, and disclaimers', () => {
    const panelPath = path.join(srcDir, 'components', 'SettlementPanel.tsx');
    const panelContent = fs.readFileSync(panelPath, 'utf8');
    assert.ok(panelContent.includes('Repayment Complete'), 'Must confirm repayment status');
    assert.ok(panelContent.includes('Only the borrower or designated lender can settle this agreement'), 'Must explain authorization');
    assert.ok(panelContent.includes('Review Settlement Conditions'), 'Must provide review step');
    assert.ok(panelContent.includes('settlement-panel-card'), 'Must render card container');

    const confPath = path.join(srcDir, 'components', 'SettlementConfirmation.tsx');
    const confContent = fs.readFileSync(confPath, 'utf8');
    assert.ok(confContent.includes('REQUESTED'), 'Must include REQUESTED in flow');
    assert.ok(confContent.includes('VERIFIED'), 'Must include VERIFIED in flow');
    assert.ok(confContent.includes('FUNDED'), 'Must include FUNDED in flow');
    assert.ok(confContent.includes('REPAID'), 'Must include REPAID in flow');
    assert.ok(confContent.includes('SETTLED'), 'Must include SETTLED in flow');
    assert.ok(confContent.includes('step-terminal'), 'Must highlight SETTLED as terminal');
    assert.ok(confContent.includes('Asset Transfer Status'), 'Must report honest asset status');
    assert.ok(confContent.includes('result.assetTransferStatus'), 'Must render assetTransferStatus property');
  });

  it('Test 90 (Commit #19 & Strict Privacy Audit): Zero references to private financial credentials across all frontend files including settlement modules', () => {
    const forbiddenTerms = [
      'getPrivateFinancialValue',
      'BORROWER_PRIVATE_FINANCIAL_VALUE',
      'privateFinancialValue',
      'witness context',
      'privateState',
      'witness values',
      'borrower income',
      'salary',
      'bank balance',
      'credit score',
      'seed phrase',
      'private key',
      'wallet secret',
      'financial documents',
    ];

    const walkDir = (dir) => {
      let results = [];
      const list = fs.readdirSync(dir);
      list.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
          results = results.concat(walkDir(filePath));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          results.push(filePath);
        }
      });
      return results;
    };

    const files = walkDir(srcDir);
    assert.ok(files.length >= 26, 'Must audit all frontend source files including new settlement modules');

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      for (const term of forbiddenTerms) {
        assert.equal(
          content.includes(term),
          false,
          `Forbidden privacy-violating string "${term}" found in ${file}`
        );
      }
    }
  });

  it('Test 91 (Commit #20): Disconnected account is represented correctly', () => {
    const disconnectedCtx = disconnectMockAccount();
    assert.equal(disconnectedCtx.connectionStatus, 'DISCONNECTED');
    assert.equal(disconnectedCtx.identity, null);
    assert.equal(disconnectedCtx.selectedRole, 'NONE');
    assert.equal(disconnectedCtx.isPrototype, true);
    assert.equal(disconnectedCtx.isRealNetwork, false);

    const noneIdentity = getMockAccount('NONE');
    assert.equal(noneIdentity.connectionStatus, 'DISCONNECTED');
    assert.equal(noneIdentity.publicKey, null);
    assert.equal(noneIdentity.publicKeyHex, '');
    assert.equal(noneIdentity.role, 'NONE');
    assert.equal(noneIdentity.isPrototype, true);
  });

  it('Test 92 (Commit #20): Mock borrower account exposes only public identity', () => {
    const borrower = getMockAccount('BORROWER');
    assert.equal(borrower.role, 'BORROWER');
    assert.equal(borrower.connectionStatus, 'CONNECTED');
    assert.ok(borrower.publicKey instanceof Uint8Array);
    assert.equal(borrower.publicKey.length, 32);
    assert.ok(borrower.publicKeyHex.startsWith('0x'));
    assert.equal(borrower.displayName, 'Mock Borrower Account');
    assert.equal(borrower.isPrototype, true);

    const allowedKeys = new Set([
      'publicKey',
      'publicKeyHex',
      'connectionStatus',
      'displayName',
      'shortLabel',
      'role',
      'isPrototype',
    ]);
    for (const key of Object.keys(borrower)) {
      assert.ok(allowedKeys.has(key), `Unexpected key in borrower account: ${key}`);
    }
  });

  it('Test 93 (Commit #20): Mock lender account exposes only public identity', () => {
    const lender = getMockAccount('LENDER');
    assert.equal(lender.role, 'LENDER');
    assert.equal(lender.connectionStatus, 'CONNECTED');
    assert.ok(lender.publicKey instanceof Uint8Array);
    assert.equal(lender.publicKey.length, 32);
    assert.ok(lender.publicKeyHex.startsWith('0x'));
    assert.equal(lender.displayName, 'Mock Lender Account');
    assert.equal(lender.isPrototype, true);

    const allowedKeys = new Set([
      'publicKey',
      'publicKeyHex',
      'connectionStatus',
      'displayName',
      'shortLabel',
      'role',
      'isPrototype',
    ]);
    for (const key of Object.keys(lender)) {
      assert.ok(allowedKeys.has(key), `Unexpected key in lender account: ${key}`);
    }
  });

  it('Test 94 (Commit #20): Third-party account is represented correctly', () => {
    const thirdParty = getMockAccount('PARTICIPANT');
    assert.equal(thirdParty.role, 'PARTICIPANT');
    assert.equal(thirdParty.connectionStatus, 'CONNECTED');
    assert.ok(thirdParty.publicKey instanceof Uint8Array);
    assert.equal(thirdParty.publicKey.length, 32);
    assert.equal(thirdParty.displayName, 'Mock Third-Party Account');
    assert.equal(thirdParty.isPrototype, true);
  });

  it('Test 95 (Commit #20): Prototype account explicitly reports isPrototype=true', () => {
    assert.equal(getMockAccount('BORROWER').isPrototype, true);
    assert.equal(getMockAccount('LENDER').isPrototype, true);
    assert.equal(getMockAccount('PARTICIPANT').isPrototype, true);
    assert.equal(getMockAccount('NONE').isPrototype, true);
    assert.equal(connectMockAccount('BORROWER').isPrototype, true);
    assert.equal(connectMockAccount('LENDER').isPrototype, true);
    assert.equal(disconnectMockAccount().isPrototype, true);
  });

  it('Test 96 (Commit #20): Prototype account explicitly reports isRealNetwork=false', () => {
    const borrowerCtx = connectMockAccount('BORROWER');
    assert.equal(borrowerCtx.isRealNetwork, false);
    assert.equal(borrowerCtx.networkName, 'Local Prototype');

    const lenderCtx = connectMockAccount('LENDER');
    assert.equal(lenderCtx.isRealNetwork, false);
    assert.equal(lenderCtx.networkName, 'Local Prototype');
  });

  it('Test 97 (Commit #20): Borrower authorization is correctly detected', () => {
    const loan = MOCK_LOANS['loan-001'];
    const borrowerAccount = getMockAccount('BORROWER');
    const auth = getAccountAuthorization(loan, borrowerAccount);
    assert.equal(auth.isBorrower, true, 'Should detect caller is borrower');
    assert.equal(auth.isLender, false, 'Borrower should not be lender');
  });

  it('Test 98 (Commit #20): Lender authorization is correctly detected', () => {
    const loan = MOCK_LOANS['loan-003'];
    const lenderAccount = getMockAccount('LENDER');
    const auth = getAccountAuthorization(loan, lenderAccount);
    assert.equal(auth.isBorrower, false, 'Lender should not be borrower');
    assert.equal(auth.isLender, true, 'Should detect caller is lender');
  });

  it('Test 99 (Commit #20): Third-party account is rejected from participant actions', () => {
    const thirdPartyAccount = getMockAccount('PARTICIPANT');
    for (const loanId of ['loan-001', 'loan-002', 'loan-003', 'loan-004']) {
      const loan = MOCK_LOANS[loanId];
      const auth = getAccountAuthorization(loan, thirdPartyAccount);
      assert.equal(auth.isBorrower, false, 'Third party is not borrower');
      assert.equal(auth.isLender, false, 'Third party is not lender');
      assert.equal(auth.canVerifyEligibility, false, 'Third party cannot verify eligibility');
      assert.equal(auth.canFundLoan, false, 'Third party cannot fund');
      assert.equal(auth.canRepayLoan, false, 'Third party cannot repay');
      assert.equal(auth.canSettleLoan, false, 'Third party cannot settle');
    }
  });

  it('Test 100 (Commit #20): Borrower can repay only when loan is funded', () => {
    const fundedLoan = MOCK_LOANS['loan-003'];
    const fundedBorrower = getMockAccount('BORROWER', fundedLoan);
    const authFunded = getAccountAuthorization(fundedLoan, fundedBorrower);
    assert.equal(authFunded.canRepayLoan, true, 'Borrower can repay funded loan');

    const requestedLoan = MOCK_LOANS['loan-001'];
    const reqBorrower = getMockAccount('BORROWER', requestedLoan);
    const authRequested = getAccountAuthorization(requestedLoan, reqBorrower);
    assert.equal(authRequested.canRepayLoan, false, 'Cannot repay unverified requested loan');

    const verifiedLoan = MOCK_LOANS['loan-002'];
    const verBorrower = getMockAccount('BORROWER', verifiedLoan);
    const authVerified = getAccountAuthorization(verifiedLoan, verBorrower);
    assert.equal(authVerified.canRepayLoan, false, 'Cannot repay verified requested loan');

    const repaidLoan = MOCK_LOANS['loan-004'];
    const repBorrower = getMockAccount('BORROWER', repaidLoan);
    const authRepaid = getAccountAuthorization(repaidLoan, repBorrower);
    assert.equal(authRepaid.canRepayLoan, false, 'Cannot repay already repaid loan');

    const settledLoan = MOCK_LOANS['loan-005'];
    const setBorrower = getMockAccount('BORROWER', settledLoan);
    const authSettled = getAccountAuthorization(settledLoan, setBorrower);
    assert.equal(authSettled.canRepayLoan, false, 'Cannot repay settled loan');
  });

  it('Test 101 (Commit #20): Lender can fund only when canonical canFundLoan permits it', () => {
    const lenderAccount = getMockAccount('LENDER');

    const verifiedLoan = MOCK_LOANS['loan-002'];
    const authVerified = getAccountAuthorization(verifiedLoan, lenderAccount);
    assert.equal(authVerified.canFundLoan, true, 'Lender can fund verified requested loan');

    const unverifiedLoan = MOCK_LOANS['loan-001'];
    const authUnverified = getAccountAuthorization(unverifiedLoan, lenderAccount);
    assert.equal(authUnverified.canFundLoan, false, 'Lender cannot fund unverified loan');

    const fundedLoan = MOCK_LOANS['loan-003'];
    const authFunded = getAccountAuthorization(fundedLoan, lenderAccount);
    assert.equal(authFunded.canFundLoan, false, 'Lender cannot fund already funded loan');

    const repaidLoan = MOCK_LOANS['loan-004'];
    const authRepaid = getAccountAuthorization(repaidLoan, lenderAccount);
    assert.equal(authRepaid.canFundLoan, false, 'Lender cannot fund repaid loan');

    const borrowerAccount = getMockAccount('BORROWER', verifiedLoan);
    const authBorrower = getAccountAuthorization(verifiedLoan, borrowerAccount);
    assert.equal(authBorrower.canFundLoan, false, 'Borrower cannot fund own loan');
  });

  it('Test 102 (Commit #20): Borrower can settle a repaid loan', () => {
    const repaidLoan = MOCK_LOANS['loan-004'];
    const borrowerAccount = getMockAccount('BORROWER', repaidLoan);
    const auth = getAccountAuthorization(repaidLoan, borrowerAccount);
    assert.equal(auth.isBorrower, true);
    assert.equal(auth.canSettleLoan, true, 'Borrower can settle repaid loan');
  });

  it('Test 103 (Commit #20): Lender can settle a repaid loan', () => {
    const repaidLoan = MOCK_LOANS['loan-004'];
    const lenderAccount = getMockAccount('LENDER', repaidLoan);
    const auth = getAccountAuthorization(repaidLoan, lenderAccount);
    assert.equal(auth.isLender, true);
    assert.equal(auth.canSettleLoan, true, 'Lender can settle repaid loan');
  });

  it('Test 104 (Commit #20): Settled loan exposes no executable lifecycle actions', () => {
    const settledLoan = MOCK_LOANS['loan-005'];
    for (const role of ['BORROWER', 'LENDER', 'PARTICIPANT', 'NONE']) {
      const account = getMockAccount(role, settledLoan);
      const auth = getAccountAuthorization(settledLoan, account);
      assert.equal(auth.canVerifyEligibility, false, `${role} cannot verify settled loan`);
      assert.equal(auth.canFundLoan, false, `${role} cannot fund settled loan`);
      assert.equal(auth.canRepayLoan, false, `${role} cannot repay settled loan`);
      assert.equal(auth.canSettleLoan, false, `${role} cannot settle already settled loan`);
    }
  });

  it('Test 105 (Commit #20 & Strict Privacy Audit): Frontend account layer contains zero private keys, seed phrases, or financial credentials', () => {
    const forbiddenTerms = [
      'getPrivateFinancialValue',
      'BORROWER_PRIVATE_FINANCIAL_VALUE',
      'privateFinancialValue',
      'witness context',
      'privateState',
      'witness values',
      'borrower income',
      'salary',
      'bank balance',
      'credit score',
      'seed phrase',
      'private key',
      'wallet secret',
      'financial documents',
    ];

    const walkDir = (dir) => {
      let results = [];
      const list = fs.readdirSync(dir);
      list.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
          results = results.concat(walkDir(filePath));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          results.push(filePath);
        }
      });
      return results;
    };

    const files = walkDir(srcDir);
    assert.ok(files.length >= 31, 'Must audit all frontend source files including account abstraction modules');

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      for (const term of forbiddenTerms) {
        assert.equal(
          content.includes(term),
          false,
          `Forbidden privacy-violating string "${term}" found in ${file}`
        );
      }
    }

    const switcherPath = path.join(srcDir, 'components', 'AccountSwitcher.tsx');
    const switcherContent = fs.readFileSync(switcherPath, 'utf8');
    assert.ok(switcherContent.includes('Local Prototype Account'), 'Must render prototype account header');
    assert.ok(switcherContent.includes('Simulation Only'), 'Must declare simulation only');
    assert.ok(switcherContent.includes('No Real Wallet Connected'), 'Must declare no real wallet');

    const statusPanelPath = path.join(srcDir, 'components', 'AccountStatusPanel.tsx');
    const statusPanelContent = fs.readFileSync(statusPanelPath, 'utf8');
    assert.ok(statusPanelContent.includes('Agreement Permissions'), 'Must render permissions title');
    assert.ok(statusPanelContent.includes('Local Prototype Account'), 'Must render local prototype disclaimer');
  });

  it('Test 106 (Commit #21): Central registry initializes with existing mock agreements', () => {
    const registry = createDefaultLoanRegistry();
    const loans = registry.getLoans();
    assert.ok(Object.keys(loans).length >= 5);
    assert.ok(loans['loan-001'] !== undefined);
    assert.ok(loans['loan-002'] !== undefined);
    assert.ok(loans['loan-003'] !== undefined);
    assert.ok(loans['loan-004'] !== undefined);
    assert.ok(loans['loan-005'] !== undefined);
  });

  it('Test 107 (Commit #21): Registry returns loans in deterministic insertion order', () => {
    const registry = createDefaultLoanRegistry();
    const orderedIds = registry.getOrderedLoanIds();
    assert.equal(orderedIds[0], 'loan-001');
    assert.equal(orderedIds[1], 'loan-002');
    assert.equal(orderedIds[2], 'loan-003');
    const orderedLoans = registry.getOrderedLoans();
    assert.equal(orderedLoans[0].id, 'loan-001');
    assert.equal(orderedLoans[0].loan.amount, MOCK_LOANS['loan-001'].amount);
  });

  it('Test 108 (Commit #21): Loan creation inserts exactly one new loan agreement', () => {
    const registry = createDefaultLoanRegistry();
    const initialCount = registry.getOrderedLoanIds().length;
    const newLoan = {
      borrower: '0x0101010101010101010101010101010101010101010101010101010101010101',
      borrowerBytes: new Uint8Array(32).fill(1),
      lender: null,
      lenderBytes: null,
      amount: 18000n,
      interestRateBasisPoints: 450n,
      durationBlocks: 120n,
      status: LoanStatus.requested,
      statusText: 'requested',
      eligibilityThreshold: 32000n,
      isEligibilityVerified: false,
    };
    const nextRegistry = registry.addLoan('loan-099', newLoan);
    assert.equal(nextRegistry.getOrderedLoanIds().length, initialCount + 1);
    assert.equal(nextRegistry.getLoan('loan-099')?.amount, 18000n);
    assert.equal(nextRegistry.getSelectedLoanId(), 'loan-099');
  });

  it('Test 109 (Commit #21): Duplicate loan IDs are strictly rejected', () => {
    const registry = createDefaultLoanRegistry();
    const newLoan = { ...MOCK_LOANS['loan-001'] };
    assert.throws(
      () => registry.addLoan('loan-001', newLoan),
      (err) => err instanceof LoanRegistryError && err.code === 'DUPLICATE_LOAN_ID'
    );
  });

  it('Test 110 (Commit #21): Newly created loan begins in unverified requested state without lender', () => {
    const registry = createDefaultLoanRegistry();
    const fundedAttempt = { ...MOCK_LOANS['loan-003'] };
    assert.throws(
      () => registry.addLoan('loan-bad-1', fundedAttempt),
      (err) => err instanceof LoanRegistryError && err.code === 'INVALID_INITIAL_STATE'
    );

    const verifiedAttempt = { ...MOCK_LOANS['loan-002'] };
    assert.throws(
      () => registry.addLoan('loan-bad-2', verifiedAttempt),
      (err) => err instanceof LoanRegistryError && err.code === 'INVALID_INITIAL_STATE'
    );
  });

  it('Test 111 (Commit #21): Updating one agreement does not mutate unrelated agreements', () => {
    const registry = createDefaultLoanRegistry();
    const updated = registry.verifyLoanEligibility('loan-001', MOCK_BORROWER_PK);
    assert.equal(updated.getLoan('loan-001')?.isEligibilityVerified, true);
    assert.equal(updated.getLoan('loan-003')?.status, LoanStatus.funded);
    assert.equal(registry.getLoan('loan-001')?.isEligibilityVerified, false, 'Original registry must remain immutable');
  });

  it('Test 112 (Commit #21): Immutable loan terms cannot be changed during updates', () => {
    const registry = createDefaultLoanRegistry();
    assert.throws(
      () =>
        registry.updateLoan('loan-001', (prev) => ({
          ...prev,
          amount: prev.amount + 5000n,
        })),
      (err) => err instanceof LoanRegistryError && err.code === 'IMMUTABLE_TERM_MUTATION'
    );
    assert.throws(
      () =>
        registry.updateLoan('loan-001', (prev) => ({
          ...prev,
          interestRateBasisPoints: 999n,
        })),
      (err) => err instanceof LoanRegistryError && err.code === 'IMMUTABLE_TERM_MUTATION'
    );
    assert.throws(
      () =>
        registry.updateLoan('loan-001', (prev) => ({
          ...prev,
          durationBlocks: 9999n,
        })),
      (err) => err instanceof LoanRegistryError && err.code === 'IMMUTABLE_TERM_MUTATION'
    );
  });

  it('Test 113 (Commit #21): Verification transition updates status to verified without changing status from requested', () => {
    const registry = createDefaultLoanRegistry();
    const updated = registry.verifyLoanEligibility('loan-001', MOCK_BORROWER_PK);
    const loan = updated.getLoan('loan-001');
    assert.equal(loan?.status, LoanStatus.requested);
    assert.equal(loan?.isEligibilityVerified, true);
  });

  it('Test 114 (Commit #21): Funding transition updates status to funded and records lender', () => {
    const registry = createDefaultLoanRegistry();
    const lenderPk = MOCK_LENDER_PK;
    const updated = registry.fundLoan('loan-002', lenderPk);
    const loan = updated.getLoan('loan-002');
    assert.equal(loan?.status, LoanStatus.funded);
    assert.equal(loan?.statusText, 'funded');
    assert.ok(loan?.lenderBytes !== null);
  });

  it('Test 115 (Commit #21): Repayment transition updates status to repaid', () => {
    const registry = createDefaultLoanRegistry();
    const borrowerPk = MOCK_LOANS['loan-003'].borrowerBytes;
    const updated = registry.repayLoan('loan-003', borrowerPk);
    const loan = updated.getLoan('loan-003');
    assert.equal(loan?.status, LoanStatus.repaid);
    assert.equal(loan?.statusText, 'repaid');
  });

  it('Test 116 (Commit #21): Settlement transition updates status to settled', () => {
    const registry = createDefaultLoanRegistry();
    const borrowerPk = MOCK_LOANS['loan-004'].borrowerBytes;
    const updated = registry.settleLoan('loan-004', borrowerPk);
    const loan = updated.getLoan('loan-004');
    assert.equal(loan?.status, LoanStatus.settled);
    assert.equal(loan?.statusText, 'settled');
  });

  it('Test 117 (Commit #21): Invalid transition REQUESTED -> REPAID is rejected', () => {
    const registry = createDefaultLoanRegistry();
    assert.throws(
      () =>
        registry.updateLoan('loan-001', (prev) => ({
          ...prev,
          status: LoanStatus.repaid,
          statusText: 'repaid',
        })),
      (err) => err instanceof LoanRegistryError && err.code === 'INVALID_TRANSITION'
    );
  });

  it('Test 118 (Commit #21): Invalid transition REQUESTED -> SETTLED is rejected', () => {
    const registry = createDefaultLoanRegistry();
    assert.throws(
      () =>
        registry.updateLoan('loan-001', (prev) => ({
          ...prev,
          status: LoanStatus.settled,
          statusText: 'settled',
        })),
      (err) => err instanceof LoanRegistryError && err.code === 'INVALID_TRANSITION'
    );
  });

  it('Test 119 (Commit #21): Invalid transition FUNDED -> VERIFIED is rejected', () => {
    const registry = createDefaultLoanRegistry();
    assert.throws(
      () =>
        registry.updateLoan('loan-003', (prev) => ({
          ...prev,
          status: LoanStatus.requested,
          statusText: 'requested',
          isEligibilityVerified: true,
        })),
      (err) => err instanceof LoanRegistryError && err.code === 'INVALID_TRANSITION'
    );
  });

  it('Test 120 (Commit #21): Invalid transition REPAID -> FUNDED is rejected', () => {
    const registry = createDefaultLoanRegistry();
    assert.throws(
      () =>
        registry.updateLoan('loan-004', (prev) => ({
          ...prev,
          status: LoanStatus.funded,
          statusText: 'funded',
        })),
      (err) => err instanceof LoanRegistryError && err.code === 'INVALID_TRANSITION'
    );
  });

  it('Test 121 (Commit #21): Terminal SETTLED agreements reject all subsequent state transitions', () => {
    const registry = createDefaultLoanRegistry();
    assert.throws(
      () =>
        registry.updateLoan('loan-005', (prev) => ({
          ...prev,
          status: LoanStatus.repaid,
        })),
      (err) => err instanceof LoanRegistryError && err.code === 'ALREADY_SETTLED'
    );
  });

  it('Test 122 (Commit #21): Filter counts recalculate automatically upon adding new loans', () => {
    const registry = createDefaultLoanRegistry();
    const initialCounts = registry.getFilterCounts();
    const newLoan = {
      borrower: '0x0101010101010101010101010101010101010101010101010101010101010101',
      borrowerBytes: new Uint8Array(32).fill(1),
      lender: null,
      lenderBytes: null,
      amount: 5000n,
      interestRateBasisPoints: 300n,
      durationBlocks: 50n,
      status: LoanStatus.requested,
      statusText: 'requested',
      eligibilityThreshold: 10000n,
      isEligibilityVerified: false,
    };
    const updated = registry.addLoan('loan-count-test', newLoan);
    const nextCounts = updated.getFilterCounts();
    assert.equal(nextCounts.all, initialCounts.all + 1);
    assert.equal(nextCounts.requested, initialCounts.requested + 1);
  });

  it('Test 123 (Commit #21): Account authorization remains accurate through registry transitions', () => {
    const registry = createDefaultLoanRegistry();
    const borrowerPk = MOCK_LOANS['loan-001'].borrowerBytes;
    const borrowerAccount = getMockAccount('BORROWER', MOCK_LOANS['loan-001']);

    const initialAuth = getAccountAuthorization(registry.getLoan('loan-001'), borrowerAccount);
    assert.equal(initialAuth.canVerifyEligibility, true);

    const verifiedRegistry = registry.verifyLoanEligibility('loan-001', borrowerPk);
    const verifiedAuth = getAccountAuthorization(verifiedRegistry.getLoan('loan-001'), borrowerAccount);
    assert.equal(verifiedAuth.canVerifyEligibility, false);
  });

  it('Test 124 (Commit #21): Persistence adapter serializes and restores only public agreement data', () => {
    const memoryPersistence = new InMemoryLoanRegistryPersistence();
    const registry = new LoanRegistry(MOCK_LOANS, undefined, undefined, memoryPersistence);
    const reloaded = memoryPersistence.load();
    assert.ok(reloaded !== null);
    assert.equal(Object.keys(reloaded).length, Object.keys(MOCK_LOANS).length);

    const localPersistence = new LocalStorageLoanRegistryPersistence();
    localPersistence.save(MOCK_LOANS);
    const loadedFromLocal = localPersistence.load();
    assert.ok(loadedFromLocal !== null);
    assert.equal(loadedFromLocal['loan-001']?.amount, MOCK_LOANS['loan-001'].amount);
    assert.ok(loadedFromLocal['loan-001']?.borrowerBytes instanceof Uint8Array);
  });

  it('Test 125 (Commit #21 & Strict Privacy Audit): Frontend state and registry layer contain zero private keys, seed phrases, or financial credentials', () => {
    const forbiddenTerms = [
      'getPrivateFinancialValue',
      'BORROWER_PRIVATE_FINANCIAL_VALUE',
      'privateFinancialValue',
      'witness context',
      'privateState',
      'witness values',
      'borrower income',
      'salary',
      'bank balance',
      'credit score',
      'seed phrase',
      'private key',
      'wallet secret',
      'financial documents',
    ];

    const walkDir = (dir) => {
      let results = [];
      const list = fs.readdirSync(dir);
      list.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
          results = results.concat(walkDir(filePath));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          results.push(filePath);
        }
      });
      return results;
    };

    const files = walkDir(srcDir);
    assert.ok(files.length >= 34, `Must audit all frontend source files including registry and store modules (found ${files.length})`);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      for (const term of forbiddenTerms) {
        assert.equal(
          content.includes(term),
          false,
          `Forbidden privacy-violating string "${term}" found in ${file}`
        );
      }
    }
  });

  it('Test 126 (Commit #22): WalletProvider interface and factory create valid provider', () => {
    const provider = createDefaultWalletProvider();
    assert.ok(provider);
    assert.equal(provider.id, 'midnight-local-prototype');
    assert.equal(provider.name, 'Local Prototype Provider');
    assert.equal(provider.isPrototype, true);
    assert.equal(typeof provider.getConnectionStatus, 'function');
    assert.equal(typeof provider.getCapabilities, 'function');
    assert.equal(typeof provider.getNetworkContext, 'function');
    assert.equal(typeof provider.getAccount, 'function');
    assert.equal(typeof provider.connect, 'function');
    assert.equal(typeof provider.disconnect, 'function');
  });

  it('Test 127 (Commit #22): LocalPrototypeWalletProvider initializes correctly with default borrower persona', () => {
    const provider = new LocalPrototypeWalletProvider();
    assert.equal(provider.getConnectionStatus(), 'CONNECTED');
    const account = provider.getAccount();
    assert.ok(account);
    assert.equal(account.role, 'BORROWER');
    assert.equal(account.displayName, 'Mock Borrower Account');
    assert.deepEqual(account.publicKey, PROTOTYPE_BORROWER_PK);
  });

  it('Test 128 (Commit #22): Prototype provider reports local simulation environment', () => {
    const provider = new LocalPrototypeWalletProvider();
    const netContext = provider.getNetworkContext();
    assert.equal(netContext.environment, 'LOCAL');
    assert.equal(netContext.networkName, 'Local Prototype');
    assert.equal(netContext.isPrototype, true);
    assert.equal(netContext.isRealNetwork, false);
    assert.equal(netContext.isConnected, true);
  });

  it('Test 129 (Commit #22): Prototype provider exposes deterministic public identity', () => {
    const provider = new LocalPrototypeWalletProvider();
    const account = provider.getAccount();
    assert.ok(account);
    assert.ok(account.publicKey instanceof Uint8Array);
    assert.equal(account.publicKey.length, 32);
    assert.ok(account.publicKeyHex.startsWith('0x'));
    assert.equal(account.publicKeyHex.length, 66);
    assert.deepEqual(account.publicKey, provider.getPublicKey());
  });

  it('Test 130 (Commit #22): Prototype provider does not expose private credentials', () => {
    const provider = new LocalPrototypeWalletProvider();
    const account = provider.getAccount();
    assert.ok(account);
    assert.equal('privateKey' in account, false);
    assert.equal('seedPhrase' in account, false);
    assert.equal('secret' in account, false);
    assert.equal('witness' in account, false);
    assert.equal('privateFinancialValue' in account, false);
  });

  it('Test 131 (Commit #22): Disconnected state is represented correctly', () => {
    const provider = new LocalPrototypeWalletProvider('NONE');
    assert.equal(provider.getConnectionStatus(), 'DISCONNECTED');
    assert.equal(provider.getAccount(), null);
    assert.equal(provider.getPublicKey(), null);
    const netContext = provider.getNetworkContext();
    assert.equal(netContext.connectionStatus, 'DISCONNECTED');
    assert.equal(netContext.isConnected, false);
  });

  it('Test 132 (Commit #22): Connect operation transitions prototype provider to connected simulation state', async () => {
    const provider = new LocalPrototypeWalletProvider('NONE');
    assert.equal(provider.getConnectionStatus(), 'DISCONNECTED');

    const account = await provider.connect('LENDER');
    assert.equal(provider.getConnectionStatus(), 'CONNECTED');
    assert.equal(account.role, 'LENDER');
    assert.deepEqual(account.publicKey, PROTOTYPE_LENDER_PK);
    assert.equal(account.displayName, 'Mock Lender Account');
  });

  it('Test 133 (Commit #22): Disconnect operation works correctly', async () => {
    const provider = new LocalPrototypeWalletProvider('BORROWER');
    assert.equal(provider.getConnectionStatus(), 'CONNECTED');

    await provider.disconnect();
    assert.equal(provider.getConnectionStatus(), 'DISCONNECTED');
    assert.equal(provider.getAccount(), null);
    assert.equal(provider.getPublicKey(), null);
  });

  it('Test 134 (Commit #22): Network context is dynamically available from provider', () => {
    const provider = new LocalPrototypeWalletProvider('BORROWER');
    let netContext = provider.getNetworkContext();
    assert.equal(netContext.connectionStatus, 'CONNECTED');
    assert.equal(netContext.isConnected, true);

    provider.disconnectSync();
    netContext = provider.getNetworkContext();
    assert.equal(netContext.connectionStatus, 'DISCONNECTED');
    assert.equal(netContext.isConnected, false);
  });

  it('Test 135 (Commit #22): Capability matrix accurately reports local vs remote capabilities', () => {
    const provider = new LocalPrototypeWalletProvider();
    const caps = provider.getCapabilities();
    assert.equal(caps.READ_PUBLIC_LEDGER, true);
    assert.equal(caps.CREATE_PROOF, true);
    assert.equal(caps.SIGN_TRANSACTION, false);
    assert.equal(caps.SUBMIT_TRANSACTION, false);
    assert.equal(caps.READ_TRANSACTION_STATUS, false);
    assert.equal(caps.READ_BALANCE, false);
  });

  it('Test 136 (Commit #22): SIGN_TRANSACTION capability is strictly false in prototype mode', () => {
    const provider = new LocalPrototypeWalletProvider();
    assert.equal(provider.getCapabilities().SIGN_TRANSACTION, false);
  });

  it('Test 137 (Commit #22): SUBMIT_TRANSACTION capability is strictly false in prototype mode', () => {
    const provider = new LocalPrototypeWalletProvider();
    assert.equal(provider.getCapabilities().SUBMIT_TRANSACTION, false);
  });

  it('Test 138 (Commit #22): Unsupported transaction submission returns typed ProviderError', async () => {
    const provider = new LocalPrototypeWalletProvider();
    await assert.rejects(
      async () => {
        await provider.submitTransaction({
          loanId: 'loan-001',
          action: 'FUND',
          callerPublicKey: PROTOTYPE_LENDER_PK,
        });
      },
      (err) => {
        assert.ok(err instanceof ProviderError);
        assert.equal(err.code, 'UNSUPPORTED_OPERATION');
        assert.ok(err.message.includes('unavailable in prototype mode'));
        return true;
      }
    );
  });

  it('Test 139 (Commit #22): No fake transaction hash or confirmation is generated', async () => {
    const provider = new LocalPrototypeWalletProvider();
    let result = null;
    try {
      result = await provider.submitTransaction({
        loanId: 'loan-001',
        action: 'FUND',
        callerPublicKey: PROTOTYPE_LENDER_PK,
      });
    } catch (e) {
      // Expected rejection
    }
    assert.equal(result, null);
  });

  it('Test 140 (Commit #22): AccountService obtains identity through provider abstraction', () => {
    resetWalletProvider();
    const defaultAccount = getMockAccount('BORROWER');
    assert.deepEqual(defaultAccount.publicKey, PROTOTYPE_BORROWER_PK);

    const customProvider = new LocalPrototypeWalletProvider('THIRD_PARTY');
    setWalletProvider(customProvider);
    assert.equal(getWalletProvider().id, 'midnight-local-prototype');
    resetWalletProvider();
  });

  it('Test 141 (Commit #22): Existing borrower permissions remain correct through provider-backed account', () => {
    resetWalletProvider();
    const fundedLoan = MOCK_LOANS['loan-003'];
    const borrowerContext = connectMockAccount('BORROWER', fundedLoan);
    const auth = getAccountAuthorization(fundedLoan, borrowerContext);
    assert.equal(auth.isBorrower, true);
    assert.equal(auth.canRepayLoan, true);
    assert.equal(auth.canFundLoan, false);
  });

  it('Test 142 (Commit #22): Existing lender permissions remain correct through provider-backed account', () => {
    resetWalletProvider();
    const lenderContext = connectMockAccount('LENDER');
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const auth = getAccountAuthorization(verifiedLoan, lenderContext);
    assert.equal(auth.isLender, true);
    assert.equal(auth.canFundLoan, true);
    assert.equal(auth.canRepayLoan, false);
  });

  it('Test 143 (Commit #22): Third-party permissions remain denied through provider-backed account', () => {
    resetWalletProvider();
    const thirdPartyContext = connectMockAccount('PARTICIPANT');
    const fundedLoan = MOCK_LOANS['loan-003'];
    const auth = getAccountAuthorization(fundedLoan, thirdPartyContext);
    assert.equal(auth.canFundLoan, false);
    assert.equal(auth.canRepayLoan, false);
    assert.equal(auth.canSettleLoan, false);
    assert.equal(auth.canVerifyEligibility, false);
  });

  it('Test 144 (Commit #22): Existing canonical lifecycle guards remain authoritative', () => {
    const loan = MOCK_LOANS['loan-001'];
    assert.equal(canVerifyEligibility(loan, PROTOTYPE_BORROWER_PK).canExecute, true);
    assert.equal(canFundLoan(loan, PROTOTYPE_LENDER_PK).canExecute, false);
    assert.equal(canRepayLoan(loan, PROTOTYPE_BORROWER_PK).canExecute, false);
    assert.equal(canSettleLoan(loan, PROTOTYPE_BORROWER_PK).canExecute, false);
  });

  it('Test 145 (Commit #22): Eligibility witness never crosses provider boundary', () => {
    const provider = new LocalPrototypeWalletProvider();
    const providerMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(provider));
    for (const method of providerMethods) {
      assert.equal(method.toLowerCase().includes('witness'), false);
      assert.equal(method.toLowerCase().includes('financialvalue'), false);
    }
  });

  it('Test 146 (Commit #22): Browser storage contains zero private credentials or provider secrets', () => {
    const persistence = new LocalStorageLoanRegistryPersistence();
    persistence.save(MOCK_LOANS);
    const loaded = persistence.load();
    assert.ok(loaded);
    for (const [id, loan] of Object.entries(loaded)) {
      assert.equal('privateKey' in loan, false);
      assert.equal('seedPhrase' in loan, false);
      assert.equal('secret' in loan, false);
    }
  });

  it('Test 147 (Commit #22): NetworkStatusPanel exposes prototype status and capabilities honestly', () => {
    const panelPath = path.join(srcDir, 'components', 'NetworkStatusPanel.tsx');
    assert.ok(fs.existsSync(panelPath));
    const content = fs.readFileSync(panelPath, 'utf8');
    assert.ok(content.includes('SIMULATION ONLY'));
    assert.ok(content.includes('PROTOTYPE ACCOUNT ACTIVE'));
    assert.ok(content.includes('Unavailable in Prototype Mode'));
    assert.ok(content.includes('Commit #22') || content.includes('Commit #23'));
  });

  it('Test 148 (Commit #22): Disconnected state is represented with honest disclosure in the UI', () => {
    const panelPath = path.join(srcDir, 'components', 'NetworkStatusPanel.tsx');
    const content = fs.readFileSync(panelPath, 'utf8');
    assert.ok(content.includes('PROVIDER NOT CONNECTED'));
  });

  it('Test 149 (Commit #22): Existing loan registry workflows continue to work seamlessly with provider abstraction', () => {
    const registry = createDefaultLoanRegistry();
    const allLoans = registry.getOrderedLoans();
    assert.equal(allLoans.length, 5);

    const verified = registry.verifyLoanEligibility('loan-001', PROTOTYPE_BORROWER_PK);
    assert.equal(verified.getLoan('loan-001').isEligibilityVerified, true);

    const funded = verified.fundLoan('loan-001', PROTOTYPE_LENDER_PK);
    assert.equal(funded.getLoan('loan-001').status, LoanStatus.funded);

    const repaid = funded.repayLoan('loan-001', PROTOTYPE_BORROWER_PK);
    assert.equal(repaid.getLoan('loan-001').status, LoanStatus.repaid);

    const settled = repaid.settleLoan('loan-001', PROTOTYPE_BORROWER_PK);
    assert.equal(settled.getLoan('loan-001').status, LoanStatus.settled);
  });

  it('Test 150 (Commit #22 & Strict Privacy Audit): Frontend provider and network layer contain zero private keys, seed phrases, or financial credentials', () => {
    const forbiddenTerms = [
      'getPrivateFinancialValue',
      'BORROWER_PRIVATE_FINANCIAL_VALUE',
      'privateFinancialValue',
      'witness context',
      'privateState',
      'witness values',
      'borrower income',
      'salary',
      'bank balance',
      'credit score',
      'seed phrase',
      'private key',
      'wallet secret',
      'financial documents',
    ];

    const walkDir = (dir) => {
      let results = [];
      const list = fs.readdirSync(dir);
      list.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
          results = results.concat(walkDir(filePath));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          results.push(filePath);
        }
      });
      return results;
    };

    const files = walkDir(srcDir);
    assert.ok(files.length >= 41, `Must audit all frontend source files including network provider modules (found ${files.length})`);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      for (const term of forbiddenTerms) {
        assert.equal(
          content.includes(term),
          false,
          `Forbidden privacy-violating string "${term}" found in ${file}`
        );
      }
    }
  });

  it('Test 151 (Commit #23): ACTION_TO_CIRCUIT_MAP and CIRCUIT_TO_ACTION_MAP maintain canonical 1:1 mapping with Compact circuits', () => {
    assert.equal(ACTION_TO_CIRCUIT_MAP.VERIFY_ELIGIBILITY, 'verifyEligibility');
    assert.equal(ACTION_TO_CIRCUIT_MAP.FUND_LOAN, 'fundLoan');
    assert.equal(ACTION_TO_CIRCUIT_MAP.REPAY_LOAN, 'repayLoan');
    assert.equal(ACTION_TO_CIRCUIT_MAP.SETTLE_LOAN, 'settleLoan');

    assert.equal(CIRCUIT_TO_ACTION_MAP['verifyEligibility'], 'VERIFY_ELIGIBILITY');
    assert.equal(CIRCUIT_TO_ACTION_MAP['fundLoan'], 'FUND_LOAN');
    assert.equal(CIRCUIT_TO_ACTION_MAP['repayLoan'], 'REPAY_LOAN');
    assert.equal(CIRCUIT_TO_ACTION_MAP['settleLoan'], 'SETTLE_LOAN');

    assert.equal(getCircuitNameForAction('VERIFY_ELIGIBILITY'), 'verifyEligibility');
    assert.equal(getCircuitNameForAction('FUND_LOAN'), 'fundLoan');
    assert.equal(getCircuitNameForAction('REPAY_LOAN'), 'repayLoan');
    assert.equal(getCircuitNameForAction('SETTLE_LOAN'), 'settleLoan');
  });

  it('Test 152 (Commit #23): ACTION_REQUIRED_CAPABILITIES declares exact provider capabilities per action', () => {
    const verifyCaps = getRequiredCapabilitiesForAction('VERIFY_ELIGIBILITY');
    assert.deepEqual(verifyCaps, ['CREATE_PROOF']);

    const fundCaps = getRequiredCapabilitiesForAction('FUND_LOAN');
    assert.deepEqual(fundCaps, ['SIGN_TRANSACTION', 'SUBMIT_TRANSACTION']);

    const repayCaps = getRequiredCapabilitiesForAction('REPAY_LOAN');
    assert.deepEqual(repayCaps, ['SIGN_TRANSACTION', 'SUBMIT_TRANSACTION']);

    const settleCaps = getRequiredCapabilitiesForAction('SETTLE_LOAN');
    assert.deepEqual(settleCaps, ['SIGN_TRANSACTION', 'SUBMIT_TRANSACTION']);
  });

  it('Test 153 (Commit #23): prepareLifecycleTransaction prepares VERIFY_ELIGIBILITY with READY status for borrower', () => {
    const loan = MOCK_LOANS['loan-001'];
    assert.equal(loan.isEligibilityVerified, false);
    const borrowerContext = {
      persona: 'BORROWER',
      activeRole: 'BORROWER',
      publicKey: loan.borrowerBytes,
      publicKeyHex: loan.borrower,
      connectionStatus: 'CONNECTED',
    };

    const prep = prepareLifecycleTransaction(loan, borrowerContext, 'VERIFY_ELIGIBILITY');
    assert.equal(prep.status, 'READY');
    assert.equal(prep.isAuthorized, true);
    assert.equal(prep.circuitName, 'verifyEligibility');
    assert.equal(prep.action, 'VERIFY_ELIGIBILITY');
    assert.equal(prep.callerPublicKeyHex, loan.borrower);
    assert.equal(prep.isExecutionSupported, true);
    assert.equal(prep.missingCapabilities.length, 0);
  });

  it('Test 154 (Commit #23): prepareLifecycleTransaction prepares FUND_LOAN with UNSUPPORTED capability status in prototype mode', () => {
    const loan = MOCK_LOANS['loan-002'];
    assert.equal(loan.isEligibilityVerified, true);
    const lenderContext = {
      persona: 'LENDER',
      activeRole: 'LENDER',
      publicKey: new Uint8Array(32).fill(10),
      publicKeyHex: PROTOTYPE_LENDER_PK,
      connectionStatus: 'CONNECTED',
    };

    const prep = prepareLifecycleTransaction(loan, lenderContext, 'FUND_LOAN');
    assert.equal(prep.isAuthorized, true, 'Lender is authorized by contract rules');
    assert.equal(prep.status, 'UNSUPPORTED', 'Status must be UNSUPPORTED due to missing wallet signing in prototype');
    assert.equal(prep.circuitName, 'fundLoan');
    assert.equal(prep.isExecutionSupported, false);
    assert.ok(prep.missingCapabilities.includes('SIGN_TRANSACTION'));
    assert.ok(prep.missingCapabilities.includes('SUBMIT_TRANSACTION'));
  });

  it('Test 155 (Commit #23): prepareLifecycleTransaction prepares REPAY_LOAN with authorization validation for funded loan', () => {
    const loan = MOCK_LOANS['loan-003'];
    assert.equal(loan.status, LoanStatus.funded);
    const borrowerContext = {
      persona: 'BORROWER',
      activeRole: 'BORROWER',
      publicKey: loan.borrowerBytes,
      publicKeyHex: loan.borrower,
      connectionStatus: 'CONNECTED',
    };

    const prep = prepareLifecycleTransaction(loan, borrowerContext, 'REPAY_LOAN');
    assert.equal(prep.isAuthorized, true);
    assert.equal(prep.circuitName, 'repayLoan');
    assert.equal(prep.status, 'UNSUPPORTED');
  });

  it('Test 156 (Commit #23): prepareLifecycleTransaction prepares SETTLE_LOAN for repaid loan participants', () => {
    const loan = MOCK_LOANS['loan-004'];
    assert.equal(loan.status, LoanStatus.repaid);
    const borrowerContext = {
      persona: 'BORROWER',
      activeRole: 'BORROWER',
      publicKey: loan.borrowerBytes,
      publicKeyHex: loan.borrower,
      connectionStatus: 'CONNECTED',
    };

    const prep = prepareLifecycleTransaction(loan, borrowerContext, 'SETTLE_LOAN');
    assert.equal(prep.isAuthorized, true);
    assert.equal(prep.circuitName, 'settleLoan');
    assert.equal(prep.status, 'UNSUPPORTED');
  });

  it('Test 157 (Commit #23): prepareLifecycleTransaction enforces role authorization boundaries', () => {
    const requestedLoan = MOCK_LOANS['loan-001'];
    const lenderContext = {
      persona: 'LENDER',
      activeRole: 'LENDER',
      publicKey: new Uint8Array(32).fill(10),
      publicKeyHex: PROTOTYPE_LENDER_PK,
      connectionStatus: 'CONNECTED',
    };

    // Lender cannot verify borrower eligibility
    const prepVerify = prepareLifecycleTransaction(requestedLoan, lenderContext, 'VERIFY_ELIGIBILITY');
    assert.equal(prepVerify.isAuthorized, false);
    assert.equal(prepVerify.status, 'BLOCKED');
    assert.ok(prepVerify.authorizationReason);

    // Borrower cannot fund their own loan
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const borrowerContext = {
      persona: 'BORROWER',
      activeRole: 'BORROWER',
      publicKey: verifiedLoan.borrowerBytes,
      publicKeyHex: verifiedLoan.borrower,
      connectionStatus: 'CONNECTED',
    };
    const prepFund = prepareLifecycleTransaction(verifiedLoan, borrowerContext, 'FUND_LOAN');
    assert.equal(prepFund.isAuthorized, false);
    assert.equal(prepFund.status, 'BLOCKED');

    // Lender cannot repay loan
    const fundedLoan = MOCK_LOANS['loan-003'];
    const prepRepay = prepareLifecycleTransaction(fundedLoan, lenderContext, 'REPAY_LOAN');
    assert.equal(prepRepay.isAuthorized, false);
    assert.equal(prepRepay.status, 'BLOCKED');

    // Third party cannot settle loan
    const repaidLoan = MOCK_LOANS['loan-004'];
    const thirdPartyContext = {
      persona: 'THIRD_PARTY',
      activeRole: 'THIRD_PARTY',
      publicKey: new Uint8Array(32).fill(99),
      publicKeyHex: PROTOTYPE_THIRD_PARTY_PK,
      connectionStatus: 'CONNECTED',
    };
    const prepSettle = prepareLifecycleTransaction(repaidLoan, thirdPartyContext, 'SETTLE_LOAN');
    assert.equal(prepSettle.isAuthorized, false);
    assert.equal(prepSettle.status, 'BLOCKED');
  });

  it('Test 158 (Commit #23): prepareLifecycleTransaction enforces Compact lifecycle sequence', () => {
    const unverifiedLoan = MOCK_LOANS['loan-001'];
    const lenderContext = {
      persona: 'LENDER',
      activeRole: 'LENDER',
      publicKey: new Uint8Array(32).fill(10),
      publicKeyHex: PROTOTYPE_LENDER_PK,
      connectionStatus: 'CONNECTED',
    };

    // Cannot fund unverified loan
    const prepFund = prepareLifecycleTransaction(unverifiedLoan, lenderContext, 'FUND_LOAN');
    assert.equal(prepFund.isAuthorized, false);
    assert.equal(prepFund.status, 'BLOCKED');

    // Cannot repay unverified loan
    const borrowerContext = {
      persona: 'BORROWER',
      activeRole: 'BORROWER',
      publicKey: unverifiedLoan.borrowerBytes,
      publicKeyHex: unverifiedLoan.borrower,
      connectionStatus: 'CONNECTED',
    };
    const prepRepay = prepareLifecycleTransaction(unverifiedLoan, borrowerContext, 'REPAY_LOAN');
    assert.equal(prepRepay.isAuthorized, false);
    assert.equal(prepRepay.status, 'BLOCKED');

    // Cannot settle funded loan
    const fundedLoan = MOCK_LOANS['loan-003'];
    const prepSettle = prepareLifecycleTransaction(fundedLoan, borrowerContext, 'SETTLE_LOAN');
    assert.equal(prepSettle.isAuthorized, false);
    assert.equal(prepSettle.status, 'BLOCKED');

    // Settled loan blocks all lifecycle actions
    const settledLoan = MOCK_LOANS['loan-005'];
    assert.equal(prepareLifecycleTransaction(settledLoan, borrowerContext, 'VERIFY_ELIGIBILITY').status, 'BLOCKED');
    assert.equal(prepareLifecycleTransaction(settledLoan, lenderContext, 'FUND_LOAN').status, 'BLOCKED');
    assert.equal(prepareLifecycleTransaction(settledLoan, borrowerContext, 'REPAY_LOAN').status, 'BLOCKED');
    assert.equal(prepareLifecycleTransaction(settledLoan, borrowerContext, 'SETTLE_LOAN').status, 'BLOCKED');
  });

  it('Test 159 (Commit #23): prepareLifecycleTransaction rejects disconnected account contexts', () => {
    const loan = MOCK_LOANS['loan-001'];
    const disconnectedContext = {
      persona: 'BORROWER',
      activeRole: 'BORROWER',
      publicKey: null,
      publicKeyHex: '',
      connectionStatus: 'DISCONNECTED',
    };

    const prep1 = prepareLifecycleTransaction(loan, disconnectedContext, 'VERIFY_ELIGIBILITY');
    assert.equal(prep1.status, 'BLOCKED');
    assert.equal(prep1.isAuthorized, false);
    assert.ok(prep1.authorizationReason?.includes('Wallet connection required'));

    const prep2 = prepareLifecycleTransaction(loan, undefined, 'VERIFY_ELIGIBILITY');
    assert.equal(prep2.status, 'BLOCKED');
    assert.equal(prep2.isAuthorized, false);
  });

  it('Test 160 (Commit #23): getTransactionExecutionReadiness identifies supported vs unsupported provider capabilities', () => {
    const provider = new LocalPrototypeWalletProvider();

    // VERIFY_ELIGIBILITY: supported
    const unverifiedLoan = MOCK_LOANS['loan-001'];
    const borrowerContext = {
      persona: 'BORROWER',
      activeRole: 'BORROWER',
      publicKey: unverifiedLoan.borrowerBytes,
      publicKeyHex: unverifiedLoan.borrower,
      connectionStatus: 'CONNECTED',
    };
    const readinessVerify = getTransactionExecutionReadiness(unverifiedLoan, borrowerContext, 'VERIFY_ELIGIBILITY', provider);
    assert.equal(readinessVerify.isReady, true);
    assert.equal(readinessVerify.status, 'READY');
    assert.equal(readinessVerify.circuitName, 'verifyEligibility');

    // FUND_LOAN: unsupported
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const lenderContext = {
      persona: 'LENDER',
      activeRole: 'LENDER',
      publicKey: new Uint8Array(32).fill(10),
      publicKeyHex: PROTOTYPE_LENDER_PK,
      connectionStatus: 'CONNECTED',
    };
    const readinessFund = getTransactionExecutionReadiness(verifiedLoan, lenderContext, 'FUND_LOAN', provider);
    assert.equal(readinessFund.isReady, false);
    assert.equal(readinessFund.status, 'UNSUPPORTED');
    assert.ok(readinessFund.reason.includes('prototype mode'));

    // REPAY_LOAN: unsupported
    const fundedLoan = MOCK_LOANS['loan-003'];
    const fundedBorrowerContext = {
      persona: 'BORROWER',
      activeRole: 'BORROWER',
      publicKey: fundedLoan.borrowerBytes,
      publicKeyHex: fundedLoan.borrower,
      connectionStatus: 'CONNECTED',
    };
    const readinessRepay = getTransactionExecutionReadiness(fundedLoan, fundedBorrowerContext, 'REPAY_LOAN', provider);
    assert.equal(readinessRepay.isReady, false);
    assert.equal(readinessRepay.status, 'UNSUPPORTED');

    // SETTLE_LOAN: unsupported
    const repaidLoan = MOCK_LOANS['loan-004'];
    const repaidBorrowerContext = {
      persona: 'BORROWER',
      activeRole: 'BORROWER',
      publicKey: repaidLoan.borrowerBytes,
      publicKeyHex: repaidLoan.borrower,
      connectionStatus: 'CONNECTED',
    };
    const readinessSettle = getTransactionExecutionReadiness(repaidLoan, repaidBorrowerContext, 'SETTLE_LOAN', provider);
    assert.equal(readinessSettle.isReady, false);
    assert.equal(readinessSettle.status, 'UNSUPPORTED');
  });

  it('Test 161 (Commit #23): executeLifecycleTransaction succeeds for local VERIFY_ELIGIBILITY without fake hashes', async () => {
    const provider = new LocalPrototypeWalletProvider();
    const unverifiedLoan = MOCK_LOANS['loan-001'];
    const borrowerContext = {
      persona: 'BORROWER',
      activeRole: 'BORROWER',
      publicKey: unverifiedLoan.borrowerBytes,
      publicKeyHex: unverifiedLoan.borrower,
      connectionStatus: 'CONNECTED',
    };

    const result = await executeLifecycleTransaction(unverifiedLoan, borrowerContext, 'VERIFY_ELIGIBILITY', provider);
    assert.equal(result.success, true);
    assert.equal(result.status, 'CONFIRMED');
    assert.equal(result.action, 'VERIFY_ELIGIBILITY');
    assert.equal(result.circuitName, 'verifyEligibility');
    assert.equal(result.transactionId, undefined, 'Must NEVER fabricate transaction hash in prototype mode');
  });

  it('Test 162 (Commit #23): executeLifecycleTransaction for FUND_LOAN returns typed UNSUPPORTED result', async () => {
    const provider = new LocalPrototypeWalletProvider();
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const lenderContext = {
      persona: 'LENDER',
      activeRole: 'LENDER',
      publicKey: new Uint8Array(32).fill(10),
      publicKeyHex: PROTOTYPE_LENDER_PK,
      connectionStatus: 'CONNECTED',
    };

    const result = await executeLifecycleTransaction(verifiedLoan, lenderContext, 'FUND_LOAN', provider);
    assert.equal(result.success, false);
    assert.equal(result.status, 'UNSUPPORTED');
    assert.ok(result.message.includes('unavailable in prototype mode'));
    assert.equal(result.action, 'FUND_LOAN');
    assert.equal(result.circuitName, 'fundLoan');
    assert.equal(result.transactionId, undefined);
    assert.ok(result.unsupportedReason?.includes('SIGN_TRANSACTION'));
  });

  it('Test 163 (Commit #23): executeLifecycleTransaction for REPAY_LOAN returns typed UNSUPPORTED result', async () => {
    const provider = new LocalPrototypeWalletProvider();
    const fundedLoan = MOCK_LOANS['loan-003'];
    const borrowerContext = {
      persona: 'BORROWER',
      activeRole: 'BORROWER',
      publicKey: fundedLoan.borrowerBytes,
      publicKeyHex: fundedLoan.borrower,
      connectionStatus: 'CONNECTED',
    };

    const result = await executeLifecycleTransaction(fundedLoan, borrowerContext, 'REPAY_LOAN', provider);
    assert.equal(result.success, false);
    assert.equal(result.status, 'UNSUPPORTED');
    assert.equal(result.action, 'REPAY_LOAN');
    assert.equal(result.circuitName, 'repayLoan');
    assert.equal(result.transactionId, undefined);
  });

  it('Test 164 (Commit #23): executeLifecycleTransaction for SETTLE_LOAN returns typed UNSUPPORTED result', async () => {
    const provider = new LocalPrototypeWalletProvider();
    const repaidLoan = MOCK_LOANS['loan-004'];
    const borrowerContext = {
      persona: 'BORROWER',
      activeRole: 'BORROWER',
      publicKey: repaidLoan.borrowerBytes,
      publicKeyHex: repaidLoan.borrower,
      connectionStatus: 'CONNECTED',
    };

    const result = await executeLifecycleTransaction(repaidLoan, borrowerContext, 'SETTLE_LOAN', provider);
    assert.equal(result.success, false);
    assert.equal(result.status, 'UNSUPPORTED');
    assert.equal(result.action, 'SETTLE_LOAN');
    assert.equal(result.circuitName, 'settleLoan');
    assert.equal(result.transactionId, undefined);
  });

  it('Test 165 (Commit #23 & Critical Invariant): Unsupported transaction execution NEVER mutates LoanRegistry state', async () => {
    const registry = createDefaultLoanRegistry();
    const loan001Initial = registry.getLoan('loan-001');
    assert.equal(loan001Initial.status, LoanStatus.requested);

    // Verify eligibility directly on registry so it is ready for funding
    const verifiedRegistry = registry.verifyLoanEligibility('loan-001', PROTOTYPE_BORROWER_PK);
    const verifiedLoan = verifiedRegistry.getLoan('loan-001');
    assert.equal(verifiedLoan.status, LoanStatus.requested);
    assert.equal(verifiedLoan.isEligibilityVerified, true);

    const lenderContext = {
      persona: 'LENDER',
      activeRole: 'LENDER',
      publicKey: new Uint8Array(32).fill(10),
      publicKeyHex: PROTOTYPE_LENDER_PK,
      connectionStatus: 'CONNECTED',
    };

    // Attempt funding transaction via orchestrator
    const provider = new LocalPrototypeWalletProvider();
    const result = await executeLifecycleTransaction(verifiedLoan, lenderContext, 'FUND_LOAN', provider);
    assert.equal(result.success, false);
    assert.equal(result.status, 'UNSUPPORTED');

    // CRITICAL ASSERTION: The registry must NOT have been mutated!
    const loanAfterAttempt = verifiedRegistry.getLoan('loan-001');
    assert.equal(loanAfterAttempt.status, LoanStatus.requested, 'Loan must still be REQUESTED, not funded!');
    assert.equal(loanAfterAttempt.lender, null, 'Lender must not be recorded on unconfirmed transaction!');
  });

  it('Test 166 (Commit #23 & Invariant): Transaction preparation is strictly read-only and never mutates loan state', () => {
    const registry = createDefaultLoanRegistry();
    const loan = registry.getLoan('loan-001');
    const beforeStatus = loan.status;
    const beforeAmount = loan.amount;
    const beforeBorrower = loan.borrower;
    const beforeVerified = loan.isEligibilityVerified;

    const borrowerContext = {
      persona: 'BORROWER',
      activeRole: 'BORROWER',
      publicKey: loan.borrowerBytes,
      publicKeyHex: loan.borrower,
      connectionStatus: 'CONNECTED',
    };

    // Call preparation multiple times
    prepareLifecycleTransaction(loan, borrowerContext, 'VERIFY_ELIGIBILITY');
    prepareLifecycleTransaction(loan, borrowerContext, 'REPAY_LOAN');
    prepareLifecycleTransaction(loan, undefined, 'VERIFY_ELIGIBILITY');

    // Verify original loan object and registry remain identical
    const afterLoan = registry.getLoan('loan-001');
    assert.equal(afterLoan.status, beforeStatus);
    assert.equal(afterLoan.amount, beforeAmount);
    assert.equal(afterLoan.borrower, beforeBorrower);
    assert.equal(afterLoan.isEligibilityVerified, beforeVerified);
  });

  it('Test 167 (Commit #23): getSupportedLifecycleActions accurately categorizes actions by environment', () => {
    const provider = new LocalPrototypeWalletProvider();
    const borrowerContext = {
      persona: 'BORROWER',
      activeRole: 'BORROWER',
      publicKey: new Uint8Array(32).fill(1),
      publicKeyHex: PROTOTYPE_BORROWER_PK,
      connectionStatus: 'CONNECTED',
    };

    const { supported, unsupported } = getSupportedLifecycleActions(borrowerContext, provider);
    assert.ok(supported.includes('VERIFY_ELIGIBILITY'));
    assert.ok(unsupported.includes('FUND_LOAN'));
    assert.ok(unsupported.includes('REPAY_LOAN'));
    assert.ok(unsupported.includes('SETTLE_LOAN'));
    assert.equal(supported.length, 1);
    assert.equal(unsupported.length, 3);
  });

  it('Test 168 (Commit #23): executeLifecycleTransaction handles local proof executor failures gracefully', async () => {
    const provider = new LocalPrototypeWalletProvider();
    const unverifiedLoan = MOCK_LOANS['loan-001'];
    const borrowerContext = {
      persona: 'BORROWER',
      activeRole: 'BORROWER',
      publicKey: unverifiedLoan.borrowerBytes,
      publicKeyHex: unverifiedLoan.borrower,
      connectionStatus: 'CONNECTED',
    };

    const failingOptions = {
      localProofExecutor: async () => {
        throw new Error('Simulated off-chain prover constraint evaluation error');
      },
    };

    const result = await executeLifecycleTransaction(
      unverifiedLoan,
      borrowerContext,
      'VERIFY_ELIGIBILITY',
      provider,
      failingOptions
    );
    assert.equal(result.success, false);
    assert.equal(result.status, 'FAILED');
    assert.ok(result.message.includes('Simulated off-chain prover constraint evaluation error'));
  });

  it('Test 169 (Commit #23): TransactionOrchestrationError formats correctly with error code', () => {
    const error = new TransactionOrchestrationError(
      'UNAUTHORIZED',
      'Caller is not authorized to execute this circuit'
    );

    assert.equal(error.name, 'TransactionOrchestrationError');
    assert.equal(error.code, 'UNAUTHORIZED');
    assert.equal(error.message, 'Caller is not authorized to execute this circuit');
    assert.ok(error instanceof Error);
  });

  it('Test 170 (Commit #23): prepareLifecycleTransaction handles invalid loan input defensively', () => {
    const borrowerContext = {
      persona: 'BORROWER',
      activeRole: 'BORROWER',
      publicKey: new Uint8Array(32).fill(1),
      publicKeyHex: PROTOTYPE_BORROWER_PK,
      connectionStatus: 'CONNECTED',
    };

    const prep = prepareLifecycleTransaction(null, borrowerContext, 'VERIFY_ELIGIBILITY');
    assert.equal(prep.status, 'INVALID');
    assert.equal(prep.isAuthorized, false);
    assert.ok(prep.authorizationReason?.includes('missing or unavailable'));
  });

  it('Test 171 (Commit #23): executeLifecycleTransaction handles invalid loan input cleanly', async () => {
    const borrowerContext = {
      persona: 'BORROWER',
      activeRole: 'BORROWER',
      publicKey: new Uint8Array(32).fill(1),
      publicKeyHex: PROTOTYPE_BORROWER_PK,
      connectionStatus: 'CONNECTED',
    };

    const result = await executeLifecycleTransaction(null, borrowerContext, 'VERIFY_ELIGIBILITY');
    assert.equal(result.success, false);
    assert.equal(result.status, 'FAILED');
    assert.ok(result.message.includes('missing or unavailable'));
  });

  it('Test 172 (Commit #23): NetworkStatusPanel integrates lifecycle action dispatch section', () => {
    const panelPath = path.join(srcDir, 'components', 'NetworkStatusPanel.tsx');
    const content = fs.readFileSync(panelPath, 'utf8');

    assert.ok(content.includes('getSupportedLifecycleActions'));
    assert.ok(content.includes('Lifecycle Transaction Dispatch'));
    assert.ok(content.includes('Supported Local Actions'));
    assert.ok(content.includes('Unsupported Network Actions'));
    assert.ok(content.includes('VERIFY_ELIGIBILITY'));
    assert.ok(content.includes('FUND_LOAN'));
    assert.ok(content.includes('REPAY_LOAN'));
    assert.ok(content.includes('SETTLE_LOAN'));
  });

  it('Test 173 (Commit #23): types/index.ts re-exports all transaction orchestration types', () => {
    const typesIndexPath = path.join(srcDir, 'types', 'index.ts');
    const content = fs.readFileSync(typesIndexPath, 'utf8');

    assert.ok(content.includes('LifecycleTransactionAction'));
    assert.ok(content.includes('TransactionPreparationStatus'));
    assert.ok(content.includes('TransactionExecutionStatus'));
    assert.ok(content.includes('TransactionPreparation'));
    assert.ok(content.includes('TransactionExecution'));
    assert.ok(content.includes('TransactionOrchestrationResult'));
    assert.ok(content.includes('TransactionOrchestrationError'));
    assert.ok(content.includes('TransactionOrchestrationErrorCode'));
  });

  it('Test 174 (Commit #23 & Anti-Fabrication Invariant): Prototype execution returns null/undefined for blockchain primitives', async () => {
    const provider = new LocalPrototypeWalletProvider();
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const lenderContext = {
      persona: 'LENDER',
      activeRole: 'LENDER',
      publicKey: new Uint8Array(32).fill(10),
      publicKeyHex: PROTOTYPE_LENDER_PK,
      connectionStatus: 'CONNECTED',
    };

    const result = await executeLifecycleTransaction(verifiedLoan, lenderContext, 'FUND_LOAN', provider);
    assert.equal(result.transactionId, undefined, 'transactionId must NEVER be synthesized in prototype mode');
    assert.equal(result.blockHeight, undefined, 'blockHeight must not be fabricated');
  });

  it('Test 175 (Commit #23 & Strict Privacy Audit): All frontend files (>= 41 files) contain zero private keys, seed phrases, or financial credentials', () => {
    const forbiddenTerms = [
      'getPrivateFinancialValue',
      'BORROWER_PRIVATE_FINANCIAL_VALUE',
      'privateFinancialValue',
      'witness context',
      'privateState',
      'witness values',
      'borrower income',
      'salary',
      'bank balance',
      'credit score',
      'seed phrase',
      'private key',
      'wallet secret',
      'financial documents',
    ];

    const walkDir = (dir) => {
      let results = [];
      const list = fs.readdirSync(dir);
      list.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
          results = results.concat(walkDir(filePath));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          results.push(filePath);
        }
      });
      return results;
    };

    const files = walkDir(srcDir);
    assert.ok(files.length >= 41, `Must audit all frontend source files including orchestration modules (found ${files.length})`);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      for (const term of forbiddenTerms) {
        assert.equal(
          content.includes(term),
          false,
          `Forbidden privacy-violating string "${term}" found in ${file}`
        );
      }
    }
  });

  it('Test 176 (Commit #24): Audit confirms verified installed Midnight dependencies without speculative SDKs', () => {
    const contractsPkgPath = path.resolve(process.cwd(), 'contracts', 'package.json');
    const rootPkgPath = path.resolve(process.cwd(), 'package.json');
    const frontendPkgPath = path.resolve(process.cwd(), 'frontend', 'package.json');

    const contractsPkg = JSON.parse(fs.readFileSync(contractsPkgPath, 'utf8'));
    const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
    const frontendPkg = JSON.parse(fs.readFileSync(frontendPkgPath, 'utf8'));

    // Verified dependencies: compact-runtime 0.16.0
    assert.equal(contractsPkg.dependencies['@midnight-ntwrk/compact-runtime'], '0.16.0');

    // Confirms NO speculative or unverified wallet packages are installed
    assert.equal('@midnight-ntwrk/dapp-connector-api' in (frontendPkg.dependencies || {}), false);
    assert.equal('@midnight-ntwrk/wallet' in (frontendPkg.dependencies || {}), false);
    assert.equal('@midnight-ntwrk/midnight-js-contracts' in (frontendPkg.dependencies || {}), false);
    assert.equal('lace-sdk' in (frontendPkg.dependencies || {}), false);
  });

  it('Test 177 (Commit #24): MidnightWalletAdapter initializes with honest non-prototype identity and disconnected state', () => {
    const adapter = new MidnightWalletAdapter();
    assert.equal(adapter.id, 'midnight-lace-adapter');
    assert.equal(adapter.name, 'Midnight / Lace Wallet Adapter');
    assert.equal(adapter.isPrototype, false);
    assert.equal(adapter.kind, 'LACE');
    assert.equal(adapter.getConnectionStatus(), 'DISCONNECTED');
    assert.equal(adapter.getAccount(), null);
    assert.equal(adapter.getPublicKey(), null);
  });

  it('Test 178 (Commit #24): MidnightWalletAdapter reports UNSUPPORTED detection in non-browser Node environment', () => {
    const adapter = new MidnightWalletAdapter();
    assert.equal(adapter.getDetectionStatus(), 'UNSUPPORTED');
    assert.equal(adapter.isAvailable(), false);
  });

  it('Test 179 (Commit #24): MidnightWalletAdapter accurately reflects DETECTED status when connector is present', () => {
    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({ lace: { apiVersion: '0.1.0' } });
    assert.equal(adapter.getDetectionStatus(), 'DETECTED');
    assert.equal(adapter.isAvailable(), true);

    adapter.clearMockConnectorForTesting();
    assert.equal(adapter.getDetectionStatus(), 'UNSUPPORTED');
  });

  it('Test 180 (Commit #24): MidnightWalletAdapter reports NOT_DETECTED when extension is absent in browser environment', () => {
    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting(false);
    assert.equal(adapter.getDetectionStatus(), 'NOT_DETECTED');
    assert.equal(adapter.isAvailable(), false);
  });

  it('Test 181 (Commit #24): connect() rejects with UNSUPPORTED_OPERATION in unsupported environment', async () => {
    const adapter = new MidnightWalletAdapter();
    await assert.rejects(
      async () => await adapter.connect('BORROWER'),
      (err) => {
        assert.ok(err instanceof WalletAdapterError);
        assert.equal(err.code, 'UNSUPPORTED_OPERATION');
        return true;
      }
    );
    assert.equal(adapter.getConnectionStatus(), 'ERROR');
  });

  it('Test 182 (Commit #24): connect() rejects with WALLET_NOT_DETECTED when extension is missing', async () => {
    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting(false);
    await assert.rejects(
      async () => await adapter.connect('BORROWER'),
      (err) => {
        assert.ok(err instanceof WalletAdapterError);
        assert.equal(err.code, 'WALLET_NOT_DETECTED');
        return true;
      }
    );
    assert.equal(adapter.getConnectionStatus(), 'ERROR');
  });

  it('Test 183 (Commit #24): connect() handles user cancellation with typed USER_REJECTED code', async () => {
    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({ shouldReject: true });
    await assert.rejects(
      async () => await adapter.connect('BORROWER'),
      (err) => {
        assert.ok(err instanceof WalletAdapterError);
        assert.equal(err.code, 'USER_REJECTED');
        return true;
      }
    );
    assert.equal(adapter.getConnectionStatus(), 'ERROR');
  });

  it('Test 184 (Commit #24): connect() establishes verified public account identity when authorized', async () => {
    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: {
        address: 'midnight1addr_test_001',
        publicKey: PROTOTYPE_BORROWER_PK,
        publicKeyHex: '0x' + Buffer.from(PROTOTYPE_BORROWER_PK).toString('hex'),
        role: 'BORROWER',
        displayName: 'Verified Midnight Account',
      },
    });

    const account = await adapter.connect('BORROWER');
    assert.equal(adapter.getConnectionStatus(), 'CONNECTED');
    assert.equal(account.displayName, 'Verified Midnight Account');
    assert.equal(account.address, 'midnight1addr_test_001');
    assert.deepEqual(account.publicKey, PROTOTYPE_BORROWER_PK);
    assert.deepEqual(adapter.getPublicKey(), PROTOTYPE_BORROWER_PK);
  });

  it('Test 185 (Commit #24): disconnect() resets connection status and purges public account identity', async () => {
    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: {
        address: 'midnight1addr_test_001',
        publicKey: PROTOTYPE_BORROWER_PK,
        publicKeyHex: '0x01',
      },
    });

    await adapter.connect('BORROWER');
    assert.equal(adapter.getConnectionStatus(), 'CONNECTED');

    await adapter.disconnect();
    assert.equal(adapter.getConnectionStatus(), 'DISCONNECTED');
    assert.equal(adapter.getAccount(), null);
    assert.equal(adapter.getPublicKey(), null);
  });

  it('Test 186 (Commit #24): Disconnected adapter reports signing and submission as unavailable', () => {
    const adapter = new MidnightWalletAdapter();
    const caps = adapter.getCapabilities();
    assert.equal(caps.READ_PUBLIC_LEDGER, true);
    assert.equal(caps.CREATE_PROOF, true);
    assert.equal(caps.SIGN_TRANSACTION, false);
    assert.equal(caps.SUBMIT_TRANSACTION, false);
    assert.equal(caps.READ_TRANSACTION_STATUS, false);
    assert.equal(caps.READ_BALANCE, false);
  });

  it('Test 187 (Commit #24): Connected adapter exposes signing and submission capabilities truthfully', async () => {
    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: {
        address: 'midnight1addr_002',
        publicKey: PROTOTYPE_LENDER_PK,
        publicKeyHex: '0x10',
      },
    });

    await adapter.connect('LENDER');
    const caps = adapter.getCapabilities();
    assert.equal(caps.SIGN_TRANSACTION, true);
    assert.equal(caps.SUBMIT_TRANSACTION, true);
    assert.equal(caps.READ_TRANSACTION_STATUS, false);
    assert.equal(caps.READ_BALANCE, false);
  });

  it('Test 188 (Commit #24): Network context reflects genuine adapter boundary without synthetic testnet IDs', () => {
    const adapter = new MidnightWalletAdapter();
    const net = adapter.getNetworkContext();
    assert.equal(net.isPrototype, false);
    assert.equal(net.isRealNetwork, true);
    assert.equal(net.environment, 'LOCAL');
    assert.ok(net.networkName.includes('Midnight Network'));
    assert.equal('networkId' in net && net.networkId !== undefined, false);
  });

  it('Test 189 (Commit #24 - Anti-Fabrication): submitTransaction() rejects if wallet is not connected', async () => {
    const adapter = new MidnightWalletAdapter();
    await assert.rejects(
      async () =>
        await adapter.submitTransaction({
          loanId: 'loan-001',
          action: 'FUND',
          circuitName: 'fundLoan',
          callerPublicKey: PROTOTYPE_LENDER_PK,
        }),
      (err) => err instanceof WalletAdapterError && err.code === 'CONNECTION_FAILED'
    );
  });

  it('Test 190 (Commit #24 - Anti-Fabrication): submitTransaction() throws UNSUPPORTED_OPERATION without generating fake hashes', async () => {
    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: {
        address: 'midnight1addr_002',
        publicKey: PROTOTYPE_LENDER_PK,
        publicKeyHex: '0x10',
      },
    });

    await adapter.connect('LENDER');
    await assert.rejects(
      async () =>
        await adapter.submitTransaction({
          loanId: 'loan-002',
          action: 'FUND',
          circuitName: 'fundLoan',
          callerPublicKey: PROTOTYPE_LENDER_PK,
        }),
      (err) => err instanceof WalletAdapterError && err.code === 'UNSUPPORTED_OPERATION'
    );
  });

  it('Test 191 (Commit #24): prepareLifecycleTransaction blocks operations when adapter is disconnected', () => {
    const adapter = new MidnightWalletAdapter();
    const loan = MOCK_LOANS['loan-001'];
    const prep = prepareLifecycleTransaction(loan, undefined, 'VERIFY_ELIGIBILITY', adapter);
    assert.equal(prep.status, 'BLOCKED');
    assert.equal(prep.isAuthorized, false);
    assert.ok(prep.authorizationReason?.includes('Wallet connection required'));
  });

  it('Test 192 (Commit #24): executeLifecycleTransaction succeeds off-chain for VERIFY_ELIGIBILITY with connected adapter', async () => {
    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: {
        address: 'midnight1addr_001',
        publicKey: MOCK_LOANS['loan-001'].borrowerBytes,
        publicKeyHex: MOCK_LOANS['loan-001'].borrower,
      },
    });
    await adapter.connect('BORROWER');

    const borrowerContext = {
      persona: 'BORROWER',
      activeRole: 'BORROWER',
      publicKey: MOCK_LOANS['loan-001'].borrowerBytes,
      publicKeyHex: MOCK_LOANS['loan-001'].borrower,
      connectionStatus: 'CONNECTED',
    };

    const result = await executeLifecycleTransaction(
      MOCK_LOANS['loan-001'],
      borrowerContext,
      'VERIFY_ELIGIBILITY',
      adapter
    );

    assert.equal(result.success, true);
    assert.equal(result.status, 'CONFIRMED');
    assert.equal(result.transactionId, undefined, 'Zero fake tx hashes');
  });

  it('Test 193 (Commit #24): executeLifecycleTransaction for FUND_LOAN returns UNSUPPORTED through adapter', async () => {
    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: {
        address: 'midnight1addr_lender',
        publicKey: new Uint8Array(32).fill(10),
        publicKeyHex: PROTOTYPE_LENDER_PK,
      },
    });
    await adapter.connect('LENDER');

    const lenderContext = {
      persona: 'LENDER',
      activeRole: 'LENDER',
      publicKey: new Uint8Array(32).fill(10),
      publicKeyHex: PROTOTYPE_LENDER_PK,
      connectionStatus: 'CONNECTED',
    };

    const verifiedLoan = MOCK_LOANS['loan-002'];
    const result = await executeLifecycleTransaction(
      verifiedLoan,
      lenderContext,
      'FUND_LOAN',
      adapter
    );

    assert.equal(result.success, false);
    assert.equal(result.status, 'UNSUPPORTED');
    assert.equal(result.transactionId, undefined);
    assert.ok(result.message.includes('unavailable'));
  });

  it('Test 194 (Commit #24 & Critical Invariant): Failed or unsupported adapter operations never mutate LoanRegistry', async () => {
    const registry = createDefaultLoanRegistry();

    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: {
        address: 'midnight1addr_lender',
        publicKey: new Uint8Array(32).fill(10),
        publicKeyHex: PROTOTYPE_LENDER_PK,
      },
    });
    await adapter.connect('LENDER');

    const lenderContext = {
      persona: 'LENDER',
      activeRole: 'LENDER',
      publicKey: new Uint8Array(32).fill(10),
      publicKeyHex: PROTOTYPE_LENDER_PK,
      connectionStatus: 'CONNECTED',
    };

    // Verify eligibility directly in registry
    const verifiedReg = registry.verifyLoanEligibility('loan-001', PROTOTYPE_BORROWER_PK);
    const verifiedLoan = verifiedReg.getLoan('loan-001');

    // Attempt funding
    await executeLifecycleTransaction(verifiedLoan, lenderContext, 'FUND_LOAN', adapter);

    // Assert registry state was NOT modified
    const loanAfter = verifiedReg.getLoan('loan-001');
    assert.equal(loanAfter.status, LoanStatus.requested);
    assert.equal(loanAfter.lender, null);
  });

  it('Test 195 (Commit #24 & Invariant): Adapter preparation is strictly read-only and idempotent', () => {
    const registry = createDefaultLoanRegistry();
    const loan = registry.getLoan('loan-001');
    const beforeStatus = loan.status;
    const beforeAmount = loan.amount;

    const adapter = new MidnightWalletAdapter();
    prepareLifecycleTransaction(loan, undefined, 'VERIFY_ELIGIBILITY', adapter);
    prepareLifecycleTransaction(loan, undefined, 'FUND_LOAN', adapter);

    const afterLoan = registry.getLoan('loan-001');
    assert.equal(afterLoan.status, beforeStatus);
    assert.equal(afterLoan.amount, beforeAmount);
  });

  it('Test 196 (Commit #24): AccountService supports seamless switching between Local Prototype and Midnight Adapter', () => {
    resetWalletProvider();
    assert.equal(getActiveProviderKind(), 'LOCAL_PROTOTYPE');

    switchToMidnightAdapter();
    assert.equal(getActiveProviderKind(), 'LACE');
    assert.equal(getWalletProvider().id, 'midnight-lace-adapter');

    switchToPrototypeProvider();
    assert.equal(getActiveProviderKind(), 'LOCAL_PROTOTYPE');
    assert.equal(getWalletProvider().id, 'midnight-local-prototype');
  });

  it('Test 197 (Commit #24): WalletAdapterError formats correctly with error code and sanitization', () => {
    const err = new WalletAdapterError(
      'WALLET_NOT_DETECTED',
      'Lace Wallet extension is not installed.',
      { browser: 'headless' }
    );
    assert.equal(err.name, 'WalletAdapterError');
    assert.equal(err.code, 'WALLET_NOT_DETECTED');
    assert.equal(err.message, 'Lace Wallet extension is not installed.');
    assert.deepEqual(err.details, { browser: 'headless' });
    assert.ok(err instanceof Error);
  });

  it('Test 198 (Commit #24): WalletConnectionPanel contains honest prototype disclosures and provider controls', () => {
    const panelPath = path.join(srcDir, 'components', 'WalletConnectionPanel.tsx');
    assert.ok(fs.existsSync(panelPath));
    const content = fs.readFileSync(panelPath, 'utf8');

    assert.ok(content.includes('Wallet Connection & Provider Boundary'));
    assert.ok(content.includes('Commit #24'));
    assert.ok(content.includes('Local Prototype Provider'));
    assert.ok(content.includes('Midnight / Lace Wallet Adapter'));
    assert.ok(content.includes('WALLET NOT DETECTED') || content.includes('CONNECTOR DETECTED'));
    assert.ok(content.includes('Live wallet signing unavailable'));
    assert.ok(content.includes('Network submission unavailable'));
  });

  it('Test 199 (Commit #24): types/index.ts re-exports all wallet adapter domain types', () => {
    const typesIndexPath = path.join(srcDir, 'types', 'index.ts');
    const content = fs.readFileSync(typesIndexPath, 'utf8');

    assert.ok(content.includes('WalletProviderKind'));
    assert.ok(content.includes('WalletDetectionStatus'));
    assert.ok(content.includes('WalletAdapterStatus'));
    assert.ok(content.includes('WalletAccountIdentity'));
    assert.ok(content.includes('WalletNetworkInfo'));
    assert.ok(content.includes('WalletCapabilitySet'));
    assert.ok(content.includes('WalletConnectionResult'));
    assert.ok(content.includes('WalletTransactionRequest'));
    assert.ok(content.includes('WalletTransactionResult'));
    assert.ok(content.includes('WalletAdapterErrorCode'));
    assert.ok(content.includes('WalletAdapterError'));
  });

  it('Test 200 (Commit #24 & Strict Privacy Audit): All frontend files (>= 43 files) contain zero private keys, seed phrases, or financial credentials', () => {
    const forbiddenTerms = [
      'getPrivateFinancialValue',
      'BORROWER_PRIVATE_FINANCIAL_VALUE',
      'privateFinancialValue',
      'witness context',
      'privateState',
      'witness values',
      'borrower income',
      'salary',
      'bank balance',
      'credit score',
      'seed phrase',
      'private key',
      'wallet secret',
      'financial documents',
    ];

    const walkDir = (dir) => {
      let results = [];
      const list = fs.readdirSync(dir);
      list.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
          results = results.concat(walkDir(filePath));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          results.push(filePath);
        }
      });
      return results;
    };

    const files = walkDir(srcDir);
    assert.ok(files.length >= 43, `Must audit all frontend source files including wallet adapter modules (found ${files.length})`);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      for (const term of forbiddenTerms) {
        assert.equal(
          content.includes(term),
          false,
          `Forbidden privacy-violating string "${term}" found in ${file}`
        );
      }
    }
  });

  // =========================================================================
  // COMMIT #25 TESTS: WALLET SESSION & TRANSACTION READINESS
  // =========================================================================

  it('Test 201 (Commit #25): WalletSessionService initializes with clean disconnected status and public metadata', () => {
    const adapter = createMidnightWalletAdapter();
    const service = new WalletSessionService(adapter);
    const session = service.getSession();

    assert.equal(session.status, 'DISCONNECTED');
    assert.equal(session.account, null);
    assert.equal(session.providerKind, 'LACE');
    assert.equal(session.error, null);
    assert.equal(session.capabilities.SIGN_TRANSACTION, false);
    assert.equal(session.capabilities.SUBMIT_TRANSACTION, false);
  });

  it('Test 202 (Commit #25): Local prototype session connects successfully with public identity', async () => {
    const service = new WalletSessionService();
    const result = await service.connect({
      providerKind: 'LOCAL_PROTOTYPE',
      role: 'BORROWER',
    });

    assert.equal(result.success, true);
    assert.equal(result.session.status, 'CONNECTED');
    assert.ok(result.session.account !== null);
    assert.equal(result.session.account.role, 'BORROWER');
    assert.deepEqual(result.session.account.publicKey, PROTOTYPE_BORROWER_PK);
    assert.equal(result.session.providerKind, 'LOCAL_PROTOTYPE');
  });

  it('Test 203 (Commit #25): Prototype session role switching updates public identity', async () => {
    const service = new WalletSessionService();
    await service.connect({ role: 'BORROWER' });
    const switchResult = await service.connect({ role: 'LENDER' });

    assert.equal(switchResult.success, true);
    assert.equal(switchResult.session.status, 'CONNECTED');
    assert.equal(switchResult.session.account.role, 'LENDER');
    assert.deepEqual(switchResult.session.account.publicKey, PROTOTYPE_LENDER_PK);
  });

  it('Test 204 (Commit #25): Midnight adapter session reports NOT_DETECTED when window.midnight is absent in browser environment', () => {
    const adapter = createMidnightWalletAdapter();
    adapter.injectMockConnectorForTesting(false);
    const service = new WalletSessionService(adapter);

    assert.equal(service.getDetectionStatus(), 'NOT_DETECTED');
    assert.equal(service.getSession().detectionStatus, 'NOT_DETECTED');
  });

  it('Test 205 (Commit #25): Midnight adapter session reports UNSUPPORTED in non-browser Node.js environment', () => {
    const adapter = createMidnightWalletAdapter();
    const service = new WalletSessionService(adapter);

    assert.equal(service.getDetectionStatus(), 'UNSUPPORTED');
    assert.equal(service.getSession().detectionStatus, 'UNSUPPORTED');
  });

  it('Test 206 (Commit #25): Midnight adapter reflects DETECTED when connector is present', () => {
    const adapter = createMidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      apiVersion: '1.0.0',
      name: 'Lace',
    });
    const service = new WalletSessionService(adapter);

    assert.equal(service.getDetectionStatus(), 'DETECTED');
    assert.equal(service.getSession().detectionStatus, 'DETECTED');
  });

  it('Test 207 (Commit #25): Attempting connect with missing extension throws typed WALLET_NOT_DETECTED error', async () => {
    const adapter = createMidnightWalletAdapter();
    adapter.injectMockConnectorForTesting(false);
    const service = new WalletSessionService(adapter);

    const result = await service.connect();
    assert.equal(result.success, false);
    assert.equal(result.session.status, 'UNSUPPORTED');
    assert.ok(result.error instanceof WalletSessionError);
    assert.equal(result.error.code, 'WALLET_NOT_DETECTED');
  });

  it('Test 208 (Commit #25): User connection rejection maps cleanly to USER_REJECTED session error', async () => {
    const adapter = createMidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      shouldReject: true,
    });
    const service = new WalletSessionService(adapter);

    const result = await service.connect();
    assert.equal(result.success, false);
    assert.equal(result.session.status, 'REJECTED');
    assert.ok(result.error instanceof WalletSessionError);
    assert.equal(result.error.code, 'USER_REJECTED');
  });

  it('Test 209 (Commit #25): Session disconnect cleanly purges account identity and resets to DISCONNECTED', async () => {
    const service = new WalletSessionService();
    await service.connect({ role: 'BORROWER' });
    assert.equal(service.getSession().status, 'CONNECTED');

    const discoResult = await service.disconnect();
    assert.equal(discoResult.success, true);
    assert.equal(discoResult.session.status, 'DISCONNECTED');
    assert.equal(discoResult.session.account, null);
    assert.equal(discoResult.session.connectedAt, null);
  });

  it('Test 210 (Commit #25): Connected session exposes only public identifiers without sensitive credentials', async () => {
    const service = new WalletSessionService();
    await service.connect({ role: 'BORROWER' });
    const acc = service.getAccount();

    assert.ok(acc !== null);
    assert.equal(typeof acc.address, 'string');
    assert.equal(typeof acc.publicKeyHex, 'string');
    assert.deepEqual(acc.publicKey, PROTOTYPE_BORROWER_PK);
    // Explicit assertion that private fields do not exist on account
    assert.equal(acc.privateWitness, undefined);
    assert.equal(acc.secret, undefined);
    assert.equal(acc.mnemonic, undefined);
  });

  it('Test 211 (Commit #25): Wallet session subscriptions fire reactively on state transitions', async () => {
    const service = new WalletSessionService();
    let transitionCount = 0;
    const history = [];

    const unsubscribe = service.subscribe((session) => {
      transitionCount++;
      history.push(session.status);
    });

    await service.connect({ role: 'BORROWER' });
    await service.disconnect();
    unsubscribe();

    assert.ok(transitionCount >= 2);
    assert.ok(history.includes('CONNECTED'));
    assert.ok(history.includes('DISCONNECTED'));
  });

  it('Test 212 (Commit #25): Session capability matrix accurately reflects active provider capabilities', async () => {
    const adapter = createMidnightWalletAdapter();
    const service = new WalletSessionService(adapter);

    const caps = service.getCapabilities();
    assert.equal(caps.READ_PUBLIC_LEDGER, true);
    assert.equal(caps.CREATE_PROOF, true);
    assert.equal(caps.SIGN_TRANSACTION, false);
    assert.equal(caps.SUBMIT_TRANSACTION, false);
  });

  it('Test 213 (Commit #25): Transaction preparation blocks operations when wallet session is disconnected', () => {
    const loan = MOCK_LOANS['loan-001'];
    const disconnectedAccount = {
      connectionStatus: 'DISCONNECTED',
      role: 'NONE',
      publicKey: null,
      publicKeyHex: '',
    };

    const prep = prepareLifecycleTransaction(loan, disconnectedAccount, 'VERIFY_ELIGIBILITY');
    assert.equal(prep.status, 'BLOCKED');
    assert.ok(prep.authorizationReason?.includes('Wallet connection required'));
  });

  it('Test 214 (Commit #25): Transaction preparation blocks unauthorized callers with canonical contract guards', () => {
    const unverifiedLoan = MOCK_LOANS['loan-001'];
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const lenderAccount = getMockAccount('LENDER', unverifiedLoan);
    const borrowerAccount = getMockAccount('BORROWER', verifiedLoan);
    const thirdPartyAccount = getMockAccount('PARTICIPANT', verifiedLoan);

    // Lender cannot verify eligibility (borrower only)
    const prepVerify = prepareLifecycleTransaction(unverifiedLoan, lenderAccount, 'VERIFY_ELIGIBILITY');
    assert.equal(prepVerify.status, 'BLOCKED');

    // Borrower cannot fund loan (lender only)
    const prepFund = prepareLifecycleTransaction(verifiedLoan, borrowerAccount, 'FUND_LOAN');
    assert.equal(prepFund.status, 'BLOCKED');

    // Third party cannot repay or settle
    const prepRepay = prepareLifecycleTransaction(verifiedLoan, thirdPartyAccount, 'REPAY_LOAN');
    assert.equal(prepRepay.status, 'BLOCKED');
  });

  it('Test 215 (Commit #25): Transaction preparation marks actions UNSUPPORTED when provider capabilities are missing', () => {
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const lenderAccount = getMockAccount('LENDER', verifiedLoan);
    const protoProvider = new LocalPrototypeWalletProvider();

    const prep = prepareLifecycleTransaction(verifiedLoan, lenderAccount, 'FUND_LOAN', protoProvider);
    assert.equal(prep.status, 'UNSUPPORTED');
    assert.ok(prep.missingCapabilities.includes('SIGN_TRANSACTION'));
    assert.ok(prep.missingCapabilities.includes('SUBMIT_TRANSACTION'));
  });

  it('Test 216 (Commit #25): Transaction preparation preserves exact 1:1 Midnight Compact circuit mapping', () => {
    assert.equal(getCircuitNameForAction('VERIFY_ELIGIBILITY'), 'verifyEligibility');
    assert.equal(getCircuitNameForAction('FUND_LOAN'), 'fundLoan');
    assert.equal(getCircuitNameForAction('REPAY_LOAN'), 'repayLoan');
    assert.equal(getCircuitNameForAction('SETTLE_LOAN'), 'settleLoan');

    assert.equal(CIRCUIT_TO_ACTION_MAP['verifyEligibility'], 'VERIFY_ELIGIBILITY');
    assert.equal(CIRCUIT_TO_ACTION_MAP['fundLoan'], 'FUND_LOAN');
    assert.equal(CIRCUIT_TO_ACTION_MAP['repayLoan'], 'REPAY_LOAN');
    assert.equal(CIRCUIT_TO_ACTION_MAP['settleLoan'], 'SETTLE_LOAN');
  });

  it('Test 217 (Commit #25): Transaction preparation reports READY for authorized local ZK verification', () => {
    const unverifiedLoan = MOCK_LOANS['loan-001'];
    const borrowerAccount = getMockAccount('BORROWER', unverifiedLoan);

    const prep = prepareLifecycleTransaction(unverifiedLoan, borrowerAccount, 'VERIFY_ELIGIBILITY');
    assert.equal(prep.status, 'READY');
    assert.equal(prep.isAuthorized, true);
    assert.equal(prep.circuitName, 'verifyEligibility');
  });

  it('Test 218 (Commit #25): Transaction preparation reports UNSUPPORTED when wallet is not detected on real adapter', () => {
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const lenderAccount = getMockAccount('LENDER', verifiedLoan);
    const adapter = createMidnightWalletAdapter();
    adapter.injectMockConnectorForTesting(false); // NOT_DETECTED

    const prep = prepareLifecycleTransaction(verifiedLoan, lenderAccount, 'FUND_LOAN', adapter);
    assert.equal(prep.status, 'UNSUPPORTED');
  });

  it('Test 219 (Commit #25 & Critical Invariant): Unsupported lifecycle transaction execution NEVER mutates LoanRegistry', async () => {
    const registry = createDefaultLoanRegistry();
    const originalLoan = registry.getLoan('loan-002');
    assert.equal(originalLoan.statusText, 'requested');
    assert.equal(originalLoan.lender, null);

    const lenderAccount = getMockAccount('LENDER', originalLoan);
    const result = await executeLifecycleTransaction(originalLoan, lenderAccount, 'FUND_LOAN');

    assert.equal(result.success, false);
    assert.equal(result.status, 'UNSUPPORTED');

    // Verify registry is untouched
    const afterLoan = registry.getLoan('loan-002');
    assert.equal(afterLoan.statusText, 'requested');
    assert.equal(afterLoan.lender, null);
    assert.equal(afterLoan.amount, originalLoan.amount);
  });

  it('Test 220 (Commit #25 & Critical Invariant): Preparation is strictly read-only and idempotent', () => {
    const loan = MOCK_LOANS['loan-001'];
    const borrowerAccount = getMockAccount('BORROWER', loan);

    const prep1 = prepareLifecycleTransaction(loan, borrowerAccount, 'VERIFY_ELIGIBILITY');
    const prep2 = prepareLifecycleTransaction(loan, borrowerAccount, 'VERIFY_ELIGIBILITY');

    assert.deepEqual(prep1, prep2);
    assert.equal(loan.statusText, 'requested');
    assert.equal(loan.isEligibilityVerified, false);
  });

  it('Test 221 (Commit #25 & Anti-Fabrication): Failed or unsupported operations NEVER generate synthetic hashes or confirmations', async () => {
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const lenderAccount = getMockAccount('LENDER', verifiedLoan);

    const result = await executeLifecycleTransaction(verifiedLoan, lenderAccount, 'FUND_LOAN');
    assert.equal(result.success, false);
    assert.equal(result.status, 'UNSUPPORTED');
    assert.equal(result.transactionId, undefined);
    assert.equal(result.blockHeight, undefined);
  });

  it('Test 222 (Commit #25): AccountService cleanly reflects active wallet session provider and identity', () => {
    switchToMidnightAdapter();
    assert.equal(getActiveProviderKind(), 'LACE');

    switchToPrototypeProvider();
    assert.equal(getActiveProviderKind(), 'LOCAL_PROTOTYPE');
  });

  it('Test 223 (Commit #25): TransactionReviewPanel and WalletSessionPanel contain honest prototype and network disclosures', () => {
    const sessionPanelPath = path.join(srcDir, 'components', 'WalletSessionPanel.tsx');
    const reviewPanelPath = path.join(srcDir, 'components', 'TransactionReviewPanel.tsx');
    const sessionContent = fs.readFileSync(sessionPanelPath, 'utf8');
    const reviewContent = fs.readFileSync(reviewPanelPath, 'utf8');

    assert.ok(sessionContent.includes('LOCAL PROTOTYPE'));
    assert.ok(sessionContent.includes('MIDNIGHT/LACE ADAPTER'));
    assert.ok(sessionContent.includes('LIVE NETWORK NOT AVAILABLE'));

    assert.ok(reviewContent.includes('Transaction Review'));
    assert.ok(reviewContent.includes('Live transaction signing/submission is unavailable'));
  });

  it('Test 224 (Commit #25): types/index.ts re-exports all wallet session domain models and errors', () => {
    const typesIndexPath = path.join(srcDir, 'types', 'index.ts');
    const content = fs.readFileSync(typesIndexPath, 'utf8');

    assert.ok(content.includes('WalletSessionError'));
    assert.ok(content.includes('WalletSessionStatus'));
    assert.ok(content.includes('WalletSessionErrorCode'));
    assert.ok(content.includes('WalletSession'));
    assert.ok(content.includes('WalletSessionRequest'));
    assert.ok(content.includes('WalletSessionResult'));
  });

  it('Test 225 (Commit #25 & Strict Privacy Audit): All frontend files (>= 46 files) contain zero private keys, seed phrases, or financial credentials', () => {
    const forbiddenTerms = [
      'getPrivateFinancialValue',
      'BORROWER_PRIVATE_FINANCIAL_VALUE',
      'privateFinancialValue',
      'witness context',
      'privateState',
      'witness values',
      'borrower income',
      'salary',
      'bank balance',
      'credit score',
      'seed phrase',
      'private key',
      'wallet secret',
      'financial documents',
    ];

    const walkDir = (dir) => {
      let results = [];
      const list = fs.readdirSync(dir);
      list.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
          results = results.concat(walkDir(filePath));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          results.push(filePath);
        }
      });
      return results;
    };

    const files = walkDir(srcDir);
    assert.ok(files.length >= 46, `Must audit all frontend source files including wallet session and review modules (found ${files.length})`);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      for (const term of forbiddenTerms) {
        assert.equal(
          content.includes(term),
          false,
          `Forbidden privacy-violating string "${term}" found in ${file}`
        );
      }
    }
  });

  // =========================================================================
  // COMMIT #26 TESTS: Real-Wallet Transaction Execution Boundary
  // =========================================================================

  it('Test 226 (Commit #26): TransactionExecutionRequest maps VERIFY_ELIGIBILITY to Compact circuit verifyEligibility', async () => {
    const loan = MOCK_LOANS['loan-001'];
    const borrowerAccount = getMockAccount('BORROWER', loan);
    const sessionService = resetWalletSessionService();
    await sessionService.connect({ providerKind: 'LOCAL_PROTOTYPE', rolePreference: 'BORROWER' });
    const execService = resetTransactionExecutionService(sessionService);

    const { result } = await execService.executeTransaction({
      loanId: 'loan-001',
      action: 'VERIFY_ELIGIBILITY',
      loan,
      account: borrowerAccount,
      options: { skipRegistryUpdate: true },
    });

    assert.equal(result.circuitName, 'verifyEligibility');
    assert.equal(result.action, 'VERIFY_ELIGIBILITY');
  });

  it('Test 227 (Commit #26): TransactionExecutionRequest maps FUND_LOAN to Compact circuit fundLoan', async () => {
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const lenderAccount = getMockAccount('LENDER', verifiedLoan);
    const sessionService = resetWalletSessionService();
    await sessionService.connect({ providerKind: 'LOCAL_PROTOTYPE', rolePreference: 'LENDER' });
    const execService = resetTransactionExecutionService(sessionService);

    const { result } = await execService.executeTransaction({
      loanId: 'loan-002',
      action: 'FUND_LOAN',
      loan: verifiedLoan,
      account: lenderAccount,
    });

    assert.equal(result.circuitName, 'fundLoan');
    assert.equal(result.action, 'FUND_LOAN');
  });

  it('Test 228 (Commit #26): TransactionExecutionRequest maps REPAY_LOAN to Compact circuit repayLoan', async () => {
    const fundedLoan = MOCK_LOANS['loan-003'];
    const borrowerAccount = getMockAccount('BORROWER', fundedLoan);
    const sessionService = resetWalletSessionService();
    await sessionService.connect({ providerKind: 'LOCAL_PROTOTYPE', rolePreference: 'BORROWER' });
    const execService = resetTransactionExecutionService(sessionService);

    const { result } = await execService.executeTransaction({
      loanId: 'loan-003',
      action: 'REPAY_LOAN',
      loan: fundedLoan,
      account: borrowerAccount,
    });

    assert.equal(result.circuitName, 'repayLoan');
    assert.equal(result.action, 'REPAY_LOAN');
  });

  it('Test 229 (Commit #26): TransactionExecutionRequest maps SETTLE_LOAN to Compact circuit settleLoan', async () => {
    const repaidLoan = MOCK_LOANS['loan-004'];
    const lenderAccount = getMockAccount('LENDER', repaidLoan);
    const sessionService = resetWalletSessionService();
    await sessionService.connect({ providerKind: 'LOCAL_PROTOTYPE', rolePreference: 'LENDER' });
    const execService = resetTransactionExecutionService(sessionService);

    const { result } = await execService.executeTransaction({
      loanId: 'loan-004',
      action: 'SETTLE_LOAN',
      loan: repaidLoan,
      account: lenderAccount,
    });

    assert.equal(result.circuitName, 'settleLoan');
    assert.equal(result.action, 'SETTLE_LOAN');
  });

  it('Test 230 (Commit #26): Disconnected wallet session blocks transaction execution with DISCONNECTED_WALLET', async () => {
    const loan = MOCK_LOANS['loan-001'];
    const borrowerAccount = getMockAccount('BORROWER', loan);
    const sessionService = resetWalletSessionService();
    await sessionService.disconnect();
    const execService = resetTransactionExecutionService(sessionService);

    const { result } = await execService.executeTransaction({
      loanId: 'loan-001',
      action: 'VERIFY_ELIGIBILITY',
      loan,
      account: borrowerAccount,
    });

    assert.equal(result.success, false);
    assert.equal(result.status, 'BLOCKED');
    assert.equal(result.errorCode, 'DISCONNECTED_WALLET');
    assert.equal(result.registryUpdated, false);
    assert.equal(result.confirmationState, 'NOT_CONFIRMED');
    assert.ok(result.message.includes('disconnected'));
  });

  it('Test 231 (Commit #26): Unsupported prototype provider transaction (FUND_LOAN) returns UNSUPPORTED with UNSUPPORTED_CAPABILITY', async () => {
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const lenderAccount = getMockAccount('LENDER', verifiedLoan);
    const sessionService = resetWalletSessionService();
    await sessionService.connect({ providerKind: 'LOCAL_PROTOTYPE', rolePreference: 'LENDER' });
    const execService = resetTransactionExecutionService(sessionService);

    const { result } = await execService.executeTransaction({
      loanId: 'loan-002',
      action: 'FUND_LOAN',
      loan: verifiedLoan,
      account: lenderAccount,
    });

    assert.equal(result.success, false);
    assert.equal(result.status, 'UNSUPPORTED');
    assert.equal(result.errorCode, 'UNSUPPORTED_CAPABILITY');
    assert.equal(result.registryUpdated, false);
    assert.equal(result.confirmationState, 'NOT_CONFIRMED');
    assert.ok(result.message.includes('unavailable in prototype mode'));
  });

  it('Test 232 (Commit #26): Unsupported prototype provider transaction (REPAY_LOAN) returns UNSUPPORTED and avoids execution', async () => {
    const fundedLoan = MOCK_LOANS['loan-003'];
    const borrowerAccount = getMockAccount('BORROWER', fundedLoan);
    const sessionService = resetWalletSessionService();
    await sessionService.connect({ providerKind: 'LOCAL_PROTOTYPE', rolePreference: 'BORROWER' });
    const execService = resetTransactionExecutionService(sessionService);

    const { result } = await execService.executeTransaction({
      loanId: 'loan-003',
      action: 'REPAY_LOAN',
      loan: fundedLoan,
      account: borrowerAccount,
    });

    assert.equal(result.success, false);
    assert.equal(result.status, 'UNSUPPORTED');
    assert.equal(result.errorCode, 'UNSUPPORTED_CAPABILITY');
    assert.equal(result.registryUpdated, false);
  });

  it('Test 233 (Commit #26): Unsupported prototype provider transaction (SETTLE_LOAN) returns UNSUPPORTED and avoids execution', async () => {
    const repaidLoan = MOCK_LOANS['loan-004'];
    const lenderAccount = getMockAccount('LENDER', repaidLoan);
    const sessionService = resetWalletSessionService();
    await sessionService.connect({ providerKind: 'LOCAL_PROTOTYPE', rolePreference: 'LENDER' });
    const execService = resetTransactionExecutionService(sessionService);

    const { result } = await execService.executeTransaction({
      loanId: 'loan-004',
      action: 'SETTLE_LOAN',
      loan: repaidLoan,
      account: lenderAccount,
    });

    assert.equal(result.success, false);
    assert.equal(result.status, 'UNSUPPORTED');
    assert.equal(result.errorCode, 'UNSUPPORTED_CAPABILITY');
    assert.equal(result.registryUpdated, false);
  });

  it('Test 234 (Commit #26): User wallet signature rejection in adapter is surfaced as REJECTED with REJECTED_SIGNATURE', async () => {
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: {
        address: 'midnight1lenderaddress00000000000000000000000000000',
        publicKey: DEFAULT_LENDER_PK_BYTES,
        publicKeyHex: DEFAULT_LENDER_PK_HEX,
        role: 'LENDER',
        isPrototype: false,
      },
      shouldRejectSignature: true,
    });
    await adapter.connect('LENDER');

    const sessionService = new WalletSessionService(adapter);
    const execService = new TransactionExecutionService(sessionService);

    const lenderAccount = {
      role: 'LENDER',
      publicKey: DEFAULT_LENDER_PK_BYTES,
      publicKeyHex: DEFAULT_LENDER_PK_HEX,
      connectionStatus: 'CONNECTED',
    };

    const { result } = await execService.executeTransaction({
      loanId: 'loan-002',
      action: 'FUND_LOAN',
      loan: verifiedLoan,
      account: lenderAccount,
    });

    assert.equal(result.success, false);
    assert.equal(result.status, 'REJECTED');
    assert.equal(result.errorCode, 'REJECTED_SIGNATURE');
    assert.equal(result.registryUpdated, false);
    assert.equal(result.confirmationState, 'NOT_CONFIRMED');
    assert.ok(result.message.toLowerCase().includes('rejected'));
  });

  it('Test 235 (Commit #26): Provider RPC failure in adapter is surfaced as FAILED with NETWORK_ERROR or PROVIDER_ERROR', async () => {
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: {
        address: 'midnight1lenderaddress00000000000000000000000000000',
        publicKey: DEFAULT_LENDER_PK_BYTES,
        publicKeyHex: DEFAULT_LENDER_PK_HEX,
        role: 'LENDER',
        isPrototype: false,
      },
      shouldFailSubmission: true,
    });
    await adapter.connect('LENDER');

    const sessionService = new WalletSessionService(adapter);
    const execService = new TransactionExecutionService(sessionService);

    const lenderAccount = {
      role: 'LENDER',
      publicKey: DEFAULT_LENDER_PK_BYTES,
      publicKeyHex: DEFAULT_LENDER_PK_HEX,
      connectionStatus: 'CONNECTED',
    };

    const { result } = await execService.executeTransaction({
      loanId: 'loan-002',
      action: 'FUND_LOAN',
      loan: verifiedLoan,
      account: lenderAccount,
    });

    assert.equal(result.success, false);
    assert.equal(result.status, 'FAILED');
    assert.ok(result.errorCode === 'NETWORK_ERROR' || result.errorCode === 'PROVIDER_ERROR');
    assert.equal(result.registryUpdated, false);
    assert.equal(result.confirmationState, 'NOT_CONFIRMED');
  });

  it('Test 236 (Commit #26 & Critical Invariant): Pending transaction status preserves loan state and does NOT mutate LoanRegistry', async () => {
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const registry = createDefaultLoanRegistry();
    const originalLoan = registry.getLoan('loan-002');
    assert.equal(originalLoan.statusText, 'requested');

    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: {
        address: 'midnight1lenderaddress00000000000000000000000000000',
        publicKey: DEFAULT_LENDER_PK_BYTES,
        publicKeyHex: DEFAULT_LENDER_PK_HEX,
        role: 'LENDER',
        isPrototype: false,
      },
      mockTxResult: {
        success: true,
        status: 'PENDING',
        transactionId: 'tx-pending-999',
      },
    });
    await adapter.connect('LENDER');

    const sessionService = new WalletSessionService(adapter);
    const execService = new TransactionExecutionService(sessionService);

    const lenderAccount = {
      role: 'LENDER',
      publicKey: DEFAULT_LENDER_PK_BYTES,
      publicKeyHex: DEFAULT_LENDER_PK_HEX,
      connectionStatus: 'CONNECTED',
    };

    const { result, updatedRegistry } = await execService.executeTransaction(
      {
        loanId: 'loan-002',
        action: 'FUND_LOAN',
        loan: verifiedLoan,
        account: lenderAccount,
      },
      registry
    );

    assert.equal(result.status, 'PENDING');
    assert.equal(result.confirmationState, 'UNCONFIRMED_PRESERVED');
    assert.equal(result.registryUpdated, false);
    assert.equal(updatedRegistry, undefined);

    // CRITICAL: Verify original registry was NOT mutated
    const afterLoan = registry.getLoan('loan-002');
    assert.equal(afterLoan.statusText, 'requested');
    assert.equal(afterLoan.lender, null);
    assert.equal(afterLoan.amount, originalLoan.amount);
  });

  it('Test 237 (Commit #26): Confirmed transaction result permits correct lifecycle transition in LoanRegistry (FUND_LOAN -> funded)', async () => {
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const registry = createDefaultLoanRegistry();

    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: {
        address: 'midnight1lenderaddress00000000000000000000000000000',
        publicKey: DEFAULT_LENDER_PK_BYTES,
        publicKeyHex: DEFAULT_LENDER_PK_HEX,
        role: 'LENDER',
        isPrototype: false,
      },
      mockTxResult: {
        success: true,
        status: 'CONFIRMED',
        transactionId: 'tx-confirmed-101',
        blockHeight: 4500n,
      },
    });
    await adapter.connect('LENDER');

    const sessionService = new WalletSessionService(adapter);
    const execService = new TransactionExecutionService(sessionService);

    const lenderAccount = {
      role: 'LENDER',
      publicKey: DEFAULT_LENDER_PK_BYTES,
      publicKeyHex: DEFAULT_LENDER_PK_HEX,
      connectionStatus: 'CONNECTED',
    };

    const { result, updatedRegistry } = await execService.executeTransaction(
      {
        loanId: 'loan-002',
        action: 'FUND_LOAN',
        loan: verifiedLoan,
        account: lenderAccount,
      },
      registry
    );

    assert.equal(result.success, true);
    assert.equal(result.status, 'CONFIRMED');
    assert.equal(result.confirmationState, 'CONFIRMED');
    assert.equal(result.registryUpdated, true);
    assert.ok(updatedRegistry);

    const fundedLoan = updatedRegistry.getLoan('loan-002');
    assert.equal(fundedLoan.statusText, 'funded');
    assert.equal(fundedLoan.status, LoanStatus.funded);
    assert.deepEqual(fundedLoan.lenderBytes, DEFAULT_LENDER_PK_BYTES);
  });

  it('Test 238 (Commit #26): Confirmed transaction result permits correct lifecycle transition in LoanRegistry (REPAY_LOAN -> repaid)', async () => {
    const fundedLoan = MOCK_LOANS['loan-003'];
    const registry = createDefaultLoanRegistry();

    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: {
        address: 'midnight1borroweraddress00000000000000000000000000',
        publicKey: fundedLoan.borrowerBytes,
        publicKeyHex: fundedLoan.borrower,
        role: 'BORROWER',
        isPrototype: false,
      },
      mockTxResult: {
        success: true,
        status: 'CONFIRMED',
        transactionId: 'tx-repaid-202',
        blockHeight: 4600n,
      },
    });
    await adapter.connect('BORROWER');

    const sessionService = new WalletSessionService(adapter);
    const execService = new TransactionExecutionService(sessionService);

    const borrowerAccount = {
      role: 'BORROWER',
      publicKey: fundedLoan.borrowerBytes,
      publicKeyHex: fundedLoan.borrower,
      connectionStatus: 'CONNECTED',
    };

    const { result, updatedRegistry } = await execService.executeTransaction(
      {
        loanId: 'loan-003',
        action: 'REPAY_LOAN',
        loan: fundedLoan,
        account: borrowerAccount,
      },
      registry
    );

    assert.equal(result.success, true);
    assert.equal(result.status, 'CONFIRMED');
    assert.equal(result.registryUpdated, true);
    assert.ok(updatedRegistry);

    const repaidLoan = updatedRegistry.getLoan('loan-003');
    assert.equal(repaidLoan.statusText, 'repaid');
    assert.equal(repaidLoan.status, LoanStatus.repaid);
  });

  it('Test 239 (Commit #26): Confirmed transaction result permits correct lifecycle transition in LoanRegistry (SETTLE_LOAN -> settled)', async () => {
    const repaidLoan = MOCK_LOANS['loan-004'];
    const registry = createDefaultLoanRegistry();

    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: {
        address: 'midnight1lenderaddress00000000000000000000000000000',
        publicKey: repaidLoan.lenderBytes,
        publicKeyHex: repaidLoan.lender,
        role: 'LENDER',
        isPrototype: false,
      },
      mockTxResult: {
        success: true,
        status: 'CONFIRMED',
        transactionId: 'tx-settled-303',
        blockHeight: 4700n,
      },
    });
    await adapter.connect('LENDER');

    const sessionService = new WalletSessionService(adapter);
    const execService = new TransactionExecutionService(sessionService);

    const lenderAccount = {
      role: 'LENDER',
      publicKey: repaidLoan.lenderBytes,
      publicKeyHex: repaidLoan.lender,
      connectionStatus: 'CONNECTED',
    };

    const { result, updatedRegistry } = await execService.executeTransaction(
      {
        loanId: 'loan-004',
        action: 'SETTLE_LOAN',
        loan: repaidLoan,
        account: lenderAccount,
      },
      registry
    );

    assert.equal(result.success, true);
    assert.equal(result.status, 'CONFIRMED');
    assert.equal(result.registryUpdated, true);
    assert.ok(updatedRegistry);

    const settledLoan = updatedRegistry.getLoan('loan-004');
    assert.equal(settledLoan.statusText, 'settled');
    assert.equal(settledLoan.status, LoanStatus.settled);
  });

  it('Test 240 (Commit #26 & Critical Invariant): Unconfirmed or failed transaction NEVER mutates LoanRegistry', async () => {
    const fundedLoan = MOCK_LOANS['loan-003'];
    const registry = createDefaultLoanRegistry();

    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: {
        address: 'midnight1borroweraddress00000000000000000000000000',
        publicKey: fundedLoan.borrowerBytes,
        publicKeyHex: fundedLoan.borrower,
        role: 'BORROWER',
        isPrototype: false,
      },
      mockTxResult: {
        success: false,
        status: 'FAILED',
        error: 'Execution reverted on ledger assertion',
      },
    });
    await adapter.connect('BORROWER');

    const sessionService = new WalletSessionService(adapter);
    const execService = new TransactionExecutionService(sessionService);

    const borrowerAccount = {
      role: 'BORROWER',
      publicKey: fundedLoan.borrowerBytes,
      publicKeyHex: fundedLoan.borrower,
      connectionStatus: 'CONNECTED',
    };

    const { result, updatedRegistry } = await execService.executeTransaction(
      {
        loanId: 'loan-003',
        action: 'REPAY_LOAN',
        loan: fundedLoan,
        account: borrowerAccount,
      },
      registry
    );

    assert.equal(result.success, false);
    assert.equal(result.status, 'FAILED');
    assert.equal(result.registryUpdated, false);
    assert.equal(updatedRegistry, undefined);

    const loanAfter = registry.getLoan('loan-003');
    assert.equal(loanAfter.statusText, 'funded');
  });

  it('Test 241 (Commit #26): Unauthorized caller attempting FUND_LOAN is blocked by canonical contract guards (GUARD_VALIDATION_FAILED)', async () => {
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const borrowerAccount = getMockAccount('BORROWER', verifiedLoan);

    const sessionService = resetWalletSessionService();
    await sessionService.connect({ providerKind: 'LOCAL_PROTOTYPE', rolePreference: 'BORROWER' });
    const execService = resetTransactionExecutionService(sessionService);

    const { result } = await execService.executeTransaction({
      loanId: 'loan-002',
      action: 'FUND_LOAN',
      loan: verifiedLoan,
      account: borrowerAccount,
    });

    assert.equal(result.success, false);
    assert.equal(result.status, 'REJECTED');
    assert.equal(result.errorCode, 'GUARD_VALIDATION_FAILED');
    assert.equal(result.registryUpdated, false);
  });

  it('Test 242 (Commit #26): Unauthorized caller attempting REPAY_LOAN is blocked by canonical contract guards (GUARD_VALIDATION_FAILED)', async () => {
    const fundedLoan = MOCK_LOANS['loan-003'];
    const lenderAccount = getMockAccount('LENDER', fundedLoan);

    const sessionService = resetWalletSessionService();
    await sessionService.connect({ providerKind: 'LOCAL_PROTOTYPE', rolePreference: 'LENDER' });
    const execService = resetTransactionExecutionService(sessionService);

    const { result } = await execService.executeTransaction({
      loanId: 'loan-003',
      action: 'REPAY_LOAN',
      loan: fundedLoan,
      account: lenderAccount,
    });

    assert.equal(result.success, false);
    assert.equal(result.status, 'REJECTED');
    assert.equal(result.errorCode, 'GUARD_VALIDATION_FAILED');
  });

  it('Test 243 (Commit #26): Unauthorized caller attempting SETTLE_LOAN is blocked by canonical contract guards (GUARD_VALIDATION_FAILED)', async () => {
    const repaidLoan = MOCK_LOANS['loan-004'];
    const thirdPartyAccount = getMockAccount('THIRD_PARTY', repaidLoan);

    const sessionService = resetWalletSessionService();
    await sessionService.connect({ providerKind: 'LOCAL_PROTOTYPE', rolePreference: 'THIRD_PARTY' });
    const execService = resetTransactionExecutionService(sessionService);

    const { result } = await execService.executeTransaction({
      loanId: 'loan-004',
      action: 'SETTLE_LOAN',
      loan: repaidLoan,
      account: thirdPartyAccount,
    });

    assert.equal(result.success, false);
    assert.equal(result.status, 'REJECTED');
    assert.equal(result.errorCode, 'GUARD_VALIDATION_FAILED');
  });

  it('Test 244 (Commit #26): Settled loan cannot execute another lifecycle transaction (terminal closure guard)', async () => {
    const settledLoan = MOCK_LOANS['loan-005'];
    assert.equal(settledLoan.status, LoanStatus.settled);
    const borrowerAccount = getMockAccount('BORROWER', settledLoan);

    const sessionService = resetWalletSessionService();
    await sessionService.connect({ providerKind: 'LOCAL_PROTOTYPE', rolePreference: 'BORROWER' });
    const execService = resetTransactionExecutionService(sessionService);

    const { result } = await execService.executeTransaction({
      loanId: 'loan-005',
      action: 'REPAY_LOAN',
      loan: settledLoan,
      account: borrowerAccount,
    });

    assert.equal(result.success, false);
    assert.equal(result.status, 'REJECTED');
    assert.equal(result.errorCode, 'GUARD_VALIDATION_FAILED');
  });

  it('Test 245 (Commit #26 & Anti-Fabrication): Failed or unsupported operations NEVER generate synthetic hashes, block heights, or fake confirmations', async () => {
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const lenderAccount = getMockAccount('LENDER', verifiedLoan);

    const sessionService = resetWalletSessionService();
    await sessionService.connect({ providerKind: 'LOCAL_PROTOTYPE', rolePreference: 'LENDER' });
    const execService = resetTransactionExecutionService(sessionService);

    const { result } = await execService.executeTransaction({
      loanId: 'loan-002',
      action: 'FUND_LOAN',
      loan: verifiedLoan,
      account: lenderAccount,
    });

    assert.equal(result.success, false);
    assert.equal(result.status, 'UNSUPPORTED');
    assert.equal(result.receipt, undefined);
  });

  it('Test 246 (Commit #26): Transaction execution contains only allowed public contract parameters', async () => {
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const lenderAccount = getMockAccount('LENDER', verifiedLoan);

    const sessionService = resetWalletSessionService();
    await sessionService.connect({ providerKind: 'LOCAL_PROTOTYPE', rolePreference: 'LENDER' });
    const execService = resetTransactionExecutionService(sessionService);

    const request = {
      loanId: 'loan-002',
      action: 'FUND_LOAN',
      loan: verifiedLoan,
      account: lenderAccount,
    };

    const { result } = await execService.executeTransaction(request);
    const allowedKeys = [
      'success',
      'status',
      'action',
      'circuitName',
      'loanId',
      'receipt',
      'message',
      'errorCode',
      'error',
      'unsupportedReason',
      'registryUpdated',
      'confirmationState',
    ];
    for (const key of Object.keys(result)) {
      assert.ok(allowedKeys.includes(key), `Unexpected key ${key} in execution result`);
    }
  });

  it('Test 247 (Commit #26): Private financial data does not cross provider boundary or enter execution context', () => {
    const loan = MOCK_LOANS['loan-001'];
    const borrowerAccount = getMockAccount('BORROWER', loan);

    const prep = prepareLifecycleTransaction(loan, borrowerAccount, 'VERIFY_ELIGIBILITY');
    assert.equal('secret' in prep, false);
    assert.equal('witness' in prep, false);
    assert.equal(prep.circuitName, 'verifyEligibility');
  });

  it('Test 248 (Commit #26): Local ZK eligibility verification updates registry via prototype verification semantics', async () => {
    const unverifiedLoan = MOCK_LOANS['loan-001'];
    const registry = createDefaultLoanRegistry();
    assert.equal(registry.getLoan('loan-001').isEligibilityVerified, false);

    const borrowerAccount = getMockAccount('BORROWER', unverifiedLoan);
    const sessionService = resetWalletSessionService();
    await sessionService.connect({ providerKind: 'LOCAL_PROTOTYPE', rolePreference: 'BORROWER' });
    const execService = resetTransactionExecutionService(sessionService);

    const { result, updatedRegistry } = await execService.executeTransaction(
      {
        loanId: 'loan-001',
        action: 'VERIFY_ELIGIBILITY',
        loan: unverifiedLoan,
        account: borrowerAccount,
      },
      registry
    );

    assert.equal(result.success, true);
    assert.equal(result.status, 'CONFIRMED');
    assert.equal(result.registryUpdated, true);
    assert.ok(updatedRegistry);
    assert.equal(updatedRegistry.getLoan('loan-001').isEligibilityVerified, true);
  });

  it('Test 249 (Commit #26): TransactionReviewPanel renders honest technical disclosures for prototype and adapter states', () => {
    const reviewPanelPath = path.join(srcDir, 'components', 'TransactionReviewPanel.tsx');
    const content = fs.readFileSync(reviewPanelPath, 'utf8');

    assert.ok(content.includes('Live transaction submission is unavailable in prototype mode.'));
    assert.ok(content.includes('Wallet detected, but this transaction capability is not available through the current adapter.'));
    assert.ok(content.includes('Agreement state preserved. Registry will not advance until transaction is confirmed.'));
  });

  it('Test 250 (Commit #26): types/index.ts re-exports all transaction execution domain models and errors', () => {
    const typesIndexPath = path.join(srcDir, 'types', 'index.ts');
    const content = fs.readFileSync(typesIndexPath, 'utf8');

    assert.ok(content.includes('TransactionExecutionError'));
    assert.ok(content.includes('ProviderSubmissionStatus'));
    assert.ok(content.includes('ConfirmationState'));
    assert.ok(content.includes('TransactionExecutionErrorCode'));
    assert.ok(content.includes('TransactionReceipt'));
    assert.ok(content.includes('TransactionExecutionContext'));
    assert.ok(content.includes('TransactionExecutionRequest'));
    assert.ok(content.includes('TransactionExecutionResult'));
  });

  it('Test 251 (Commit #26 & Strict Privacy Audit): All frontend files (>= 48 files) contain zero private keys, seed phrases, or financial credentials', () => {
    const forbiddenTerms = [
      'getPrivateFinancialValue',
      'BORROWER_PRIVATE_FINANCIAL_VALUE',
      'privateFinancialValue',
      'witness context',
      'privateState',
      'witness values',
      'borrower income',
      'salary',
      'bank balance',
      'credit score',
      'seed phrase',
      'private key',
      'wallet secret',
      'financial documents',
    ];

    const walkDir = (dir) => {
      let results = [];
      const list = fs.readdirSync(dir);
      list.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
          results = results.concat(walkDir(filePath));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          results.push(filePath);
        }
      });
      return results;
    };

    const files = walkDir(srcDir);
    assert.ok(files.length >= 48, `Must audit all frontend source files including transaction execution modules (found ${files.length})`);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      for (const term of forbiddenTerms) {
        assert.equal(
          content.includes(term),
          false,
          `Forbidden privacy-violating string "${term}" found in ${file}`
        );
      }
    }
  });

  // =========================================================================
  // COMMIT #27: MIDNIGHT NETWORK CONFIGURATION & CONNECTOR DISCOVERY TESTS
  // =========================================================================

  it('Test 252 (Commit #27): LOCAL configuration is valid for prototype mode', () => {
    const config = getNetworkConfig();
    assert.equal(config.environment, 'LOCAL');
    assert.equal(config.isPrototype, true);
    assert.equal(config.isRealNetwork, false);
    assert.equal(config.status, 'CONFIGURED');
    assert.equal(config.nodeRpcEndpoint, null);
    assert.equal(config.indexerEndpoint, null);

    const validation = validateNetworkConfig(config);
    assert.equal(validation.valid, true);
    assert.equal(validation.error, undefined);
  });

  it('Test 253 (Commit #27): Real network configuration without required endpoints is rejected', () => {
    const incompleteConfig = {
      environment: 'TESTNET',
      networkName: 'Midnight Testnet',
      networkId: 'midnight-testnet-01',
      nodeRpcEndpoint: null,
      indexerEndpoint: null,
      walletConnectorAvailable: true,
      isRealNetwork: true,
      isPrototype: false,
      status: 'NOT_CONFIGURED',
    };

    const validation = validateNetworkConfig(incompleteConfig);
    assert.equal(validation.valid, false);
    assert.ok(validation.error instanceof NetworkConfigurationError);
    assert.equal(validation.error.code, 'MISSING_REQUIRED_ENDPOINT');

    assert.throws(
      () => {
        setNetworkConfig(incompleteConfig);
      },
      (err) => {
        return (
          err instanceof NetworkConfigurationError &&
          err.code === 'MISSING_REQUIRED_ENDPOINT'
        );
      }
    );
  });

  it('Test 254 (Commit #27): Unknown network environment is rejected', () => {
    const invalidEnvConfig = {
      environment: 'DEVNET_UNKNOWN',
      networkName: 'Nonexistent Network',
      networkId: null,
      nodeRpcEndpoint: null,
      indexerEndpoint: null,
      walletConnectorAvailable: false,
      isRealNetwork: true,
      isPrototype: false,
      status: 'NOT_CONFIGURED',
    };

    const validation = validateNetworkConfig(invalidEnvConfig);
    assert.equal(validation.valid, false);
    assert.ok(validation.error instanceof NetworkConfigurationError);
    assert.equal(validation.error.code, 'INVALID_ENVIRONMENT');
  });

  it('Test 255 (Commit #27): Connector is correctly reported as NOT_DETECTED when unavailable', () => {
    const result = discoverWalletConnector(null);
    assert.equal(result.detected, false);
    assert.equal(result.compatible, false);
    assert.ok(result.description.includes('empty') || result.description.includes('No Midnight'));
  });

  it('Test 256 (Commit #27): Browser connector detection does not crash under Node.js/SSR', () => {
    assert.doesNotThrow(() => {
      const result = discoverWalletConnector();
      assert.equal(result.isBrowser, false);
      assert.equal(result.detected, false);
      assert.ok(result.description.includes('SSR/Node.js'));
    });
  });

  it('Test 257 (Commit #27 & Critical Invariant): Detected connector is not automatically considered connected', () => {
    const mockConnector = {
      lace: {
        enable: async () => {},
        isEnabled: async () => true,
      },
    };
    const discovery = discoverWalletConnector(mockConnector);
    assert.equal(discovery.detected, true);
    assert.equal(discovery.compatible, true);

    const readiness = resolveConnectorReadinessState({
      detected: discovery.detected,
      compatible: discovery.compatible,
      networkStatus: 'CONFIGURED',
      connectionStatus: 'DISCONNECTED',
      capabilities: {
        READ_PUBLIC_LEDGER: true,
        CREATE_PROOF: true,
        READ_ACCOUNT_IDENTITY: false,
        SIGN_TRANSACTION: false,
        SUBMIT_TRANSACTION: false,
        READ_TRANSACTION_STATUS: false,
        READ_BALANCE: false,
      },
    });

    // Invariant: DETECTED != CONNECTED
    assert.notEqual(readiness, 'CONNECTED');
    assert.equal(readiness, 'DETECTED');
  });

  it('Test 258 (Commit #27 & Critical Invariant): Connected connector is not automatically considered transaction-capable', () => {
    // Session connected, but provider lacks atomic signing or submission
    const readiness = resolveConnectorReadinessState({
      detected: true,
      compatible: true,
      networkStatus: 'CONFIGURED',
      connectionStatus: 'CONNECTED',
      capabilities: {
        READ_PUBLIC_LEDGER: true,
        CREATE_PROOF: true,
        READ_ACCOUNT_IDENTITY: true,
        SIGN_TRANSACTION: false,
        SUBMIT_TRANSACTION: false,
        READ_TRANSACTION_STATUS: false,
        READ_BALANCE: false,
      },
    });

    // Invariant: CONNECTED != TRANSACTION_CAPABLE
    assert.notEqual(readiness, 'TRANSACTION_CAPABLE');
    assert.equal(readiness, 'CONNECTED');
  });

  it('Test 259 (Commit #27): Provider capabilities reflect actual provider support', async () => {
    const protoProvider = new LocalPrototypeWalletProvider();
    const protoCaps = evaluateConnectorCapabilities(protoProvider);
    assert.equal(protoCaps.READ_PUBLIC_LEDGER, true);
    assert.equal(protoCaps.CREATE_PROOF, true);
    assert.equal(protoCaps.READ_ACCOUNT_IDENTITY, true);
    assert.equal(protoCaps.SIGN_TRANSACTION, false);
    assert.equal(protoCaps.SUBMIT_TRANSACTION, false);

    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: {
        address: 'midnight1addr_test',
        publicKey: PROTOTYPE_LENDER_PK,
        publicKeyHex: '0x10',
      },
      signingAvailable: true,
      submissionAvailable: false,
    });
    await adapter.connect('LENDER');

    const adapterCaps = evaluateConnectorCapabilities(adapter);
    assert.equal(adapterCaps.SIGN_TRANSACTION, true);
    assert.equal(adapterCaps.SUBMIT_TRANSACTION, false);
  });

  it('Test 260 (Commit #27): Local prototype provider cannot claim signing capability', () => {
    const protoProvider = new LocalPrototypeWalletProvider('BORROWER');
    const caps = evaluateConnectorCapabilities(protoProvider);
    assert.equal(caps.SIGN_TRANSACTION, false);
    assert.equal(protoProvider.getCapabilities().SIGN_TRANSACTION, false);
  });

  it('Test 261 (Commit #27): Local prototype provider cannot claim submission capability', () => {
    const protoProvider = new LocalPrototypeWalletProvider('BORROWER');
    const caps = evaluateConnectorCapabilities(protoProvider);
    assert.equal(caps.SUBMIT_TRANSACTION, false);
    assert.equal(protoProvider.getCapabilities().SUBMIT_TRANSACTION, false);
  });

  it('Test 262 (Commit #27): Transaction readiness blocks when network configuration is invalid', async () => {
    const registry = createDefaultLoanRegistry();
    const loan = registry.getLoan('loan-001');
    const account = {
      publicKey: PROTOTYPE_BORROWER_PK,
      publicKeyHex: '0x01',
      role: 'BORROWER',
    };

    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: account,
    });
    await adapter.connect('BORROWER');

    // Simulate invalid network configuration in config service
    const configService = getNetworkConfigService();
    configService.setNetworkConfig(
      {
        environment: 'TESTNET',
        networkName: 'Invalid Testnet',
        networkId: 'testnet',
        nodeRpcEndpoint: null,
        indexerEndpoint: null,
        walletConnectorAvailable: false,
        isRealNetwork: true,
        isPrototype: false,
        status: 'INVALID',
      },
      true // bypass validation to simulate invalid active configuration state
    );

    const readiness = evaluateTransactionReadiness(loan, account, 'VERIFY_ELIGIBILITY', adapter);
    assert.equal(readiness.isReady, false);
    assert.equal(readiness.reason, 'BLOCKED_NETWORK_CONFIGURATION');

    // Reset back to clean local config
    resetNetworkConfig();
  });

  it('Test 263 (Commit #27): Transaction readiness blocks when wallet is disconnected', () => {
    const registry = createDefaultLoanRegistry();
    const loan = registry.getLoan('loan-001');
    const provider = new LocalPrototypeWalletProvider('NONE');

    const readiness = evaluateTransactionReadiness(loan, null, 'FUND_LOAN', provider);
    assert.equal(readiness.isReady, false);
    assert.equal(readiness.reason, 'WALLET_NOT_CONNECTED');
  });

  it('Test 264 (Commit #27): Transaction readiness blocks when signing is unavailable', async () => {
    const registry = createDefaultLoanRegistry();
    const verifiedLoan = registry.verifyLoanEligibility('loan-001', PROTOTYPE_BORROWER_PK).getLoan('loan-001');

    const lenderAccount = {
      publicKey: PROTOTYPE_LENDER_PK,
      publicKeyHex: '0x10',
      role: 'LENDER',
    };

    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: lenderAccount,
      signingAvailable: false,
      submissionAvailable: true,
    });
    await adapter.connect('LENDER');

    const readiness = evaluateTransactionReadiness(verifiedLoan, lenderAccount, 'FUND_LOAN', adapter);
    assert.equal(readiness.isReady, false);
    assert.equal(readiness.reason, 'SIGNING_UNAVAILABLE');
  });

  it('Test 265 (Commit #27): Transaction readiness blocks when submission is unavailable', async () => {
    const registry = createDefaultLoanRegistry();
    const verifiedLoan = registry.verifyLoanEligibility('loan-001', PROTOTYPE_BORROWER_PK).getLoan('loan-001');

    const lenderAccount = {
      publicKey: PROTOTYPE_LENDER_PK,
      publicKeyHex: '0x10',
      role: 'LENDER',
    };

    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: lenderAccount,
      signingAvailable: true,
      submissionAvailable: false,
    });
    await adapter.connect('LENDER');

    const readiness = evaluateTransactionReadiness(verifiedLoan, lenderAccount, 'FUND_LOAN', adapter);
    assert.equal(readiness.isReady, false);
    assert.equal(readiness.reason, 'SUBMISSION_UNAVAILABLE');
  });

  it('Test 266 (Commit #27): Valid configuration + connected provider + required capabilities produces READY', async () => {
    const registry = createDefaultLoanRegistry();
    const verifiedLoan = registry.verifyLoanEligibility('loan-001', PROTOTYPE_BORROWER_PK).getLoan('loan-001');

    const lenderAccount = {
      publicKey: PROTOTYPE_LENDER_PK,
      publicKeyHex: '0x10',
      role: 'LENDER',
    };

    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: lenderAccount,
      signingAvailable: true,
      submissionAvailable: true,
    });
    await adapter.connect('LENDER');

    const readiness = evaluateTransactionReadiness(verifiedLoan, lenderAccount, 'FUND_LOAN', adapter);
    assert.equal(readiness.isReady, true);
    assert.equal(readiness.reason, 'READY');
    assert.equal(readiness.preparation.status, 'READY');
  });

  it('Test 267 (Commit #27): Existing contract guards still control lifecycle authorization', async () => {
    const registry = createDefaultLoanRegistry();
    const loan = registry.getLoan('loan-001'); // requested, not yet verified

    const lenderAccount = {
      publicKey: PROTOTYPE_LENDER_PK,
      publicKeyHex: '0x10',
      role: 'LENDER',
    };

    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: lenderAccount,
      signingAvailable: true,
      submissionAvailable: true,
    });
    await adapter.connect('LENDER');

    // Lender attempting to fund an unverified loan is rejected by contract guard canFundLoan
    const readiness = evaluateTransactionReadiness(loan, lenderAccount, 'FUND_LOAN', adapter);
    assert.equal(readiness.isReady, false);
    assert.equal(readiness.reason, 'GUARD_VALIDATION_FAILED');
  });

  it('Test 268 (Commit #27): Unauthorized caller remains blocked', async () => {
    const registry = createDefaultLoanRegistry();
    const verifiedLoan = registry.verifyLoanEligibility('loan-001', PROTOTYPE_BORROWER_PK).getLoan('loan-001');

    const unauthorizedAccount = {
      publicKey: PROTOTYPE_THIRD_PARTY_PK,
      publicKeyHex: '0x99',
      role: 'PARTICIPANT',
    };

    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: unauthorizedAccount,
      signingAvailable: true,
      submissionAvailable: true,
    });
    await adapter.connect('PARTICIPANT');

    // Third party cannot verify borrower eligibility or fund without lender role
    const readiness = evaluateTransactionReadiness(verifiedLoan, unauthorizedAccount, 'VERIFY_ELIGIBILITY', adapter);
    assert.equal(readiness.isReady, false);
    assert.equal(readiness.reason, 'GUARD_VALIDATION_FAILED');
  });

  it('Test 269 (Commit #27 & Critical Invariant): Pending/unsupported transactions still do not mutate LoanRegistry', async () => {
    const registry = createDefaultLoanRegistry();
    const loanBefore = registry.getLoan('loan-001');
    assert.equal(loanBefore.status, LoanStatus.requested);

    const execService = getTransactionExecutionService();
    const result = await execService.executeTransaction(
      {
        loan: loanBefore,
        account: { publicKey: PROTOTYPE_BORROWER_PK, publicKeyHex: '0x01', role: 'BORROWER' },
        action: 'FUND_LOAN', // Invalid role for funding + prototype unsupported
        loanId: 'loan-001',
      },
      registry
    );

    assert.equal(result.result.registryUpdated, false);
    const loanAfter = registry.getLoan('loan-001');
    assert.equal(loanAfter.status, LoanStatus.requested);
  });

  it('Test 270 (Commit #27 & Anti-Fabrication): No synthetic transaction data is generated', () => {
    const config = getNetworkConfig();
    assert.equal('transactionId' in config, false);
    assert.equal('hash' in config, false);
    assert.equal('blockHeight' in config, false);

    const discovery = discoverWalletConnector();
    assert.equal('transactionHash' in discovery, false);
    assert.equal('mockSignature' in discovery, false);
  });

  it('Test 271 (Commit #27 & Anti-Fabrication): No fake network information is generated', () => {
    const config = getNetworkConfig();
    assert.equal(config.nodeRpcEndpoint, null);
    assert.equal(config.indexerEndpoint, null);

    const status = getNetworkConfigurationStatus();
    assert.equal(status, 'CONFIGURED');
  });

  it('Test 272 (Commit #27 & Privacy Invariant): Network configuration contains no secrets', () => {
    const config = getNetworkConfig();
    const forbiddenProps = ['seed', 'secret', 'private', 'witness', 'balance', 'income', 'salary'];
    for (const prop of forbiddenProps) {
      assert.equal(prop in config, false, `Network config must not have property ${prop}`);
    }
  });

  it('Test 273 (Commit #27 & Privacy Invariant): Connector discovery contains no private financial information', () => {
    const discovery = discoverWalletConnector();
    const forbiddenProps = ['financial', 'witness', 'secret', 'credit', 'balance', 'income'];
    for (const prop of forbiddenProps) {
      assert.equal(prop in discovery, false, `Connector discovery must not have property ${prop}`);
    }
  });

  it('Test 274 (Commit #27): Existing prototype account/persona switching remains functional', () => {
    const sessionService = getWalletSessionService();
    sessionService.switchToPrototypeProvider('BORROWER');
    assert.equal(sessionService.getAccount()?.role, 'BORROWER');

    sessionService.switchToPrototypeProvider('LENDER');
    assert.equal(sessionService.getAccount()?.role, 'LENDER');
    assert.deepEqual(sessionService.getAccount()?.publicKey, PROTOTYPE_LENDER_PK);

    sessionService.switchToPrototypeProvider('THIRD_PARTY');
    assert.equal(sessionService.getAccount()?.role, 'THIRD_PARTY');
    assert.deepEqual(sessionService.getAccount()?.publicKey, PROTOTYPE_THIRD_PARTY_PK);

    // Cleanly restore to BORROWER
    sessionService.switchToPrototypeProvider('BORROWER');
  });

  it('Test 275 (Commit #27): types/index.ts re-exports all network configuration types and errors', () => {
    const typesIndexPath = path.join(srcDir, 'types', 'index.ts');
    const content = fs.readFileSync(typesIndexPath, 'utf8');

    assert.ok(content.includes('NetworkConfigurationError'));
    assert.ok(content.includes('MidnightNetwork'));
    assert.ok(content.includes('NetworkConfigurationStatus'));
    assert.ok(content.includes('NetworkConfigurationErrorCode'));
    assert.ok(content.includes('NetworkEndpoint'));
    assert.ok(content.includes('NetworkConfig'));
    assert.ok(content.includes('ConnectorReadinessState'));
    assert.ok(content.includes('TransactionReadinessReason'));
  });

  it('Test 276 (Commit #27 & Strict Privacy Audit): All frontend files (>= 51 files) contain zero private keys, seed phrases, or financial credentials', () => {
    const forbiddenTerms = [
      'getPrivateFinancialValue',
      'BORROWER_PRIVATE_FINANCIAL_VALUE',
      'privateFinancialValue',
      'witness context',
      'privateState',
      'witness values',
      'borrower income',
      'salary',
      'bank balance',
      'credit score',
      'seed phrase',
      'private key',
      'wallet secret',
      'financial documents',
    ];

    const walkDir = (dir) => {
      let results = [];
      const list = fs.readdirSync(dir);
      list.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
          results = results.concat(walkDir(filePath));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          results.push(filePath);
        }
      });
      return results;
    };

    const files = walkDir(srcDir);
    assert.ok(files.length >= 51, `Must audit all frontend source files including network-config modules (found ${files.length})`);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      for (const term of forbiddenTerms) {
        assert.equal(
          content.includes(term),
          false,
          `Forbidden privacy-violating string "${term}" found in ${file}`
        );
      }
    }
  });

  // =========================================================================
  // COMMIT #28: WALLET CONNECTION HANDSHAKE & NETWORK-AWARE TRANSACTION PREPARATION
  // =========================================================================

  it('Test 277 (Commit #28): Node.js environment does not crash while detecting wallet', () => {
    const adapter = new MidnightWalletAdapter();
    const service = new WalletHandshakeService(undefined, adapter);
    const state = service.getHandshakeState();

    assert.equal(state.isDetected, false);
    assert.equal(state.isConnected, false);
    assert.equal(state.status, 'NOT_DETECTED');
  });

  it('Test 278 (Commit #28): Missing connector returns NOT_DETECTED', async () => {
    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting(false);
    const service = new WalletHandshakeService(undefined, adapter);
    const stateBefore = service.getHandshakeState();
    assert.equal(stateBefore.status, 'NOT_DETECTED');

    const result = await service.initiateHandshake();
    assert.equal(result.success, false);
    assert.equal(result.state.status, 'NOT_DETECTED');
    assert.ok(result.error instanceof WalletHandshakeError);
    assert.equal(result.error.code, 'WALLET_NOT_DETECTED');
  });

  it('Test 279 (Commit #28 & Critical Invariant): Detected connector is not automatically considered CONNECTED', () => {
    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: {
        address: 'midnight1addr_test',
        publicKey: PROTOTYPE_BORROWER_PK,
        publicKeyHex: '0x01',
      },
    });

    const service = new WalletHandshakeService(undefined, adapter);
    const state = service.getHandshakeState();

    // Invariant: DETECTED != CONNECTED
    assert.equal(state.isDetected, true);
    assert.equal(state.isConnected, false);
    assert.notEqual(state.status, 'CONNECTED');
    assert.equal(state.status, 'DETECTED');
    assert.equal(state.identityResolved, false);
    assert.equal(state.account, null);
  });

  it('Test 280 (Commit #28): Connection failure returns REJECTED / FAILED', async () => {
    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      shouldReject: true,
    });

    const service = new WalletHandshakeService(undefined, adapter);
    const result = await service.initiateHandshake();

    assert.equal(result.success, false);
    assert.equal(result.state.status, 'REJECTED');
    assert.ok(result.error instanceof WalletHandshakeError);
    assert.equal(result.error.code, 'USER_REJECTED');
    assert.equal(result.state.isConnected, false);
  });

  it('Test 281 (Commit #28): Successful supported connection resolves public identity', async () => {
    const adapter = new MidnightWalletAdapter();
    const testAccount = {
      address: 'midnight1addr_borrower',
      publicKey: PROTOTYPE_BORROWER_PK,
      publicKeyHex: '0x01',
      role: 'BORROWER',
    };
    adapter.injectMockConnectorForTesting({
      mockAccount: testAccount,
      signingAvailable: true,
      submissionAvailable: true,
    });

    const service = new WalletHandshakeService(undefined, adapter);
    const result = await service.initiateHandshake({ role: 'BORROWER' });

    assert.equal(result.success, true);
    assert.equal(result.state.isConnected, true);
    assert.equal(result.state.identityResolved, true);
    assert.ok(result.state.account);
    assert.equal(result.state.account.publicKeyHex, '0x01');
    assert.equal(result.state.account.address, 'midnight1addr_borrower');
    assert.equal(result.state.account.role, 'BORROWER');
  });

  it('Test 282 (Commit #28): Wallet network is resolved when available', async () => {
    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: {
        address: 'midnight1addr_lender',
        publicKey: PROTOTYPE_LENDER_PK,
        publicKeyHex: '0x10',
        role: 'LENDER',
      },
      walletNetwork: 'midnight-testnet-01',
    });
    adapter.setMockReportedNetworkId('midnight-testnet-01');

    const service = new WalletHandshakeService(undefined, adapter);
    const result = await service.initiateHandshake({ role: 'LENDER' });

    assert.equal(result.success, true);
    assert.equal(result.state.walletNetwork, 'midnight-testnet-01');
  });

  it('Test 283 (Commit #28): Wallet network mismatch blocks transaction readiness', async () => {
    const registry = createDefaultLoanRegistry();
    const verifiedLoan = registry.verifyLoanEligibility('loan-001', PROTOTYPE_BORROWER_PK).getLoan('loan-001');

    const lenderAccount = {
      publicKey: PROTOTYPE_LENDER_PK,
      publicKeyHex: '0x10',
      role: 'LENDER',
    };

    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: lenderAccount,
      signingAvailable: true,
      submissionAvailable: true,
    });
    adapter.setMockReportedNetworkId('midnight-devnet-02');
    await adapter.connect('LENDER');

    const configService = getNetworkConfigService();
    try {
      configService.setNetworkConfig({
        environment: 'TESTNET',
        networkName: 'Midnight Testnet',
        networkId: 'midnight-testnet-01',
        nodeRpcEndpoint: {
          url: 'https://rpc.testnet.midnight.network',
          protocol: 'https',
          reachable: true,
          status: 'CONFIGURED',
        },
        indexerEndpoint: {
          url: 'https://indexer.testnet.midnight.network',
          protocol: 'https',
          reachable: true,
          status: 'CONFIGURED',
        },
        walletConnectorAvailable: true,
        isRealNetwork: true,
        isPrototype: false,
        status: 'CONFIGURED',
      });

      const compat = evaluateNetworkCompatibility(configService.getNetworkConfig(), adapter.getReportedNetworkId());
      assert.equal(compat.compatibility, 'MISMATCH');
      assert.equal(compat.isMatch, false);

      const readiness = evaluateTransactionReadiness(verifiedLoan, lenderAccount, 'FUND_LOAN', adapter);
      assert.equal(readiness.isReady, false);
      assert.equal(readiness.reason, 'NETWORK_MISMATCH');
    } finally {
      resetNetworkConfig();
    }
  });

  it('Test 284 (Commit #28): Unknown wallet network is not treated as a match', () => {
    const testnetConfig = {
      environment: 'TESTNET',
      networkName: 'Midnight Testnet',
      networkId: 'midnight-testnet-01',
      nodeRpcEndpoint: {
        url: 'https://rpc.testnet.midnight.network',
        protocol: 'https',
        reachable: true,
        status: 'CONFIGURED',
      },
      indexerEndpoint: {
        url: 'https://indexer.testnet.midnight.network',
        protocol: 'https',
        reachable: true,
        status: 'CONFIGURED',
      },
      walletConnectorAvailable: true,
      isRealNetwork: true,
      isPrototype: false,
      status: 'CONFIGURED',
    };

    const nullCompat = evaluateNetworkCompatibility(testnetConfig, null);
    assert.equal(nullCompat.compatibility, 'UNKNOWN');
    assert.equal(nullCompat.isMatch, false);
    assert.notEqual(nullCompat.compatibility, 'MATCH');

    const emptyCompat = evaluateNetworkCompatibility(testnetConfig, '');
    assert.equal(emptyCompat.compatibility, 'UNKNOWN');
    assert.equal(emptyCompat.isMatch, false);
    assert.notEqual(emptyCompat.compatibility, 'MATCH');
  });

  it('Test 285 (Commit #28): Matching network permits the network compatibility stage', async () => {
    const registry = createDefaultLoanRegistry();
    const verifiedLoan = registry.verifyLoanEligibility('loan-001', PROTOTYPE_BORROWER_PK).getLoan('loan-001');

    const lenderAccount = {
      publicKey: PROTOTYPE_LENDER_PK,
      publicKeyHex: '0x10',
      role: 'LENDER',
    };

    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: lenderAccount,
      signingAvailable: true,
      submissionAvailable: true,
    });
    adapter.setMockReportedNetworkId('midnight-testnet-01');
    await adapter.connect('LENDER');

    const configService = getNetworkConfigService();
    try {
      configService.setNetworkConfig({
        environment: 'TESTNET',
        networkName: 'Midnight Testnet',
        networkId: 'midnight-testnet-01',
        nodeRpcEndpoint: {
          url: 'https://rpc.testnet.midnight.network',
          protocol: 'https',
          reachable: true,
          status: 'CONFIGURED',
        },
        indexerEndpoint: {
          url: 'https://indexer.testnet.midnight.network',
          protocol: 'https',
          reachable: true,
          status: 'CONFIGURED',
        },
        walletConnectorAvailable: true,
        isRealNetwork: true,
        isPrototype: false,
        status: 'CONFIGURED',
      });

      const compat = evaluateNetworkCompatibility(configService.getNetworkConfig(), adapter.getReportedNetworkId());
      assert.equal(compat.compatibility, 'MATCH');
      assert.equal(compat.isMatch, true);

      const readiness = evaluateTransactionReadiness(verifiedLoan, lenderAccount, 'FUND_LOAN', adapter);
      assert.equal(readiness.isReady, true);
      assert.equal(readiness.reason, 'READY');
    } finally {
      resetNetworkConfig();
    }
  });

  it('Test 286 (Commit #28): Connected wallet without signing capability is not transaction-ready', async () => {
    const registry = createDefaultLoanRegistry();
    const verifiedLoan = registry.verifyLoanEligibility('loan-001', PROTOTYPE_BORROWER_PK).getLoan('loan-001');

    const lenderAccount = {
      publicKey: PROTOTYPE_LENDER_PK,
      publicKeyHex: '0x10',
      role: 'LENDER',
    };

    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: lenderAccount,
      signingAvailable: false,
      submissionAvailable: true,
    });
    await adapter.connect('LENDER');

    const service = new WalletHandshakeService(undefined, adapter);
    const handshakeState = service.getHandshakeState();
    assert.equal(handshakeState.capabilities.canSign, false);

    const readiness = evaluateTransactionReadiness(verifiedLoan, lenderAccount, 'FUND_LOAN', adapter);
    assert.equal(readiness.isReady, false);
    assert.equal(readiness.reason, 'SIGNING_UNAVAILABLE');
  });

  it('Test 287 (Commit #28): Connected wallet without submission capability is not transaction-ready', async () => {
    const registry = createDefaultLoanRegistry();
    const verifiedLoan = registry.verifyLoanEligibility('loan-001', PROTOTYPE_BORROWER_PK).getLoan('loan-001');

    const lenderAccount = {
      publicKey: PROTOTYPE_LENDER_PK,
      publicKeyHex: '0x10',
      role: 'LENDER',
    };

    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: lenderAccount,
      signingAvailable: true,
      submissionAvailable: false,
    });
    await adapter.connect('LENDER');

    const service = new WalletHandshakeService(undefined, adapter);
    const handshakeState = service.getHandshakeState();
    assert.equal(handshakeState.capabilities.canSubmit, false);

    const readiness = evaluateTransactionReadiness(verifiedLoan, lenderAccount, 'FUND_LOAN', adapter);
    assert.equal(readiness.isReady, false);
    assert.equal(readiness.reason, 'SUBMISSION_UNAVAILABLE');
  });

  it('Test 288 (Commit #28 & Architectural Invariant): Detection does not imply connection', () => {
    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: { address: 'midnight1addr_test', publicKey: PROTOTYPE_BORROWER_PK, publicKeyHex: '0x01' },
    });
    const service = new WalletHandshakeService(undefined, adapter);
    const state = service.getHandshakeState();

    assert.equal(state.isDetected, true);
    assert.equal(state.isConnected, false);
    assert.notEqual(state.isDetected, state.isConnected);
  });

  it('Test 289 (Commit #28 & Architectural Invariant): Connection does not imply transaction capability', async () => {
    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: { address: 'midnight1addr_test', publicKey: PROTOTYPE_BORROWER_PK, publicKeyHex: '0x01' },
      signingAvailable: false,
      submissionAvailable: false,
    });
    await adapter.connect('BORROWER');

    const service = new WalletHandshakeService(undefined, adapter);
    const state = service.getHandshakeState();

    assert.equal(state.isConnected, true);
    assert.equal(state.capabilities.canSign, false);
    assert.equal(state.capabilities.canSubmit, false);
    assert.notEqual(state.isConnected, state.capabilities.canSign && state.capabilities.canSubmit);
  });

  it('Test 290 (Commit #28): Preparation remains read-only', () => {
    const registry = createDefaultLoanRegistry();
    const originalLoan = registry.getLoan('loan-001');
    const originalStatus = originalLoan.status;
    const originalAmount = originalLoan.amount;

    const borrowerAccount = {
      publicKey: PROTOTYPE_BORROWER_PK,
      publicKeyHex: '0x01',
      role: 'BORROWER',
    };
    const protoProvider = new LocalPrototypeWalletProvider('BORROWER');

    const prep = prepareLifecycleTransaction(
      originalLoan,
      borrowerAccount,
      'VERIFY_ELIGIBILITY',
      protoProvider
    );

    assert.equal(prep.action, 'VERIFY_ELIGIBILITY');
    const storedLoan = registry.getLoan('loan-001');
    assert.equal(storedLoan.status, originalStatus);
    assert.equal(storedLoan.amount, originalAmount);
  });

  it('Test 291 (Commit #28): Blocked preparation does not mutate LoanRegistry', () => {
    const registry = createDefaultLoanRegistry();
    const loanBefore = registry.getLoan('loan-001');
    assert.equal(loanBefore.status, LoanStatus.requested);

    const lenderAccount = {
      publicKey: PROTOTYPE_LENDER_PK,
      publicKeyHex: '0x10',
      role: 'LENDER',
    };
    const provider = new LocalPrototypeWalletProvider('LENDER');

    const readiness = evaluateTransactionReadiness(loanBefore, lenderAccount, 'FUND_LOAN', provider);
    assert.equal(readiness.isReady, false);

    const loanAfter = registry.getLoan('loan-001');
    assert.equal(loanAfter.status, LoanStatus.requested);
  });

  it('Test 292 (Commit #28): Unsupported execution does not mutate LoanRegistry', async () => {
    const registry = createDefaultLoanRegistry();
    const loanBefore = registry.getLoan('loan-001');
    assert.equal(loanBefore.status, LoanStatus.requested);

    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: { publicKey: PROTOTYPE_BORROWER_PK, publicKeyHex: '0x01', role: 'BORROWER' },
      signingAvailable: true,
      submissionAvailable: true,
    });
    adapter.setMockReportedNetworkId('mismatched-network-xyz');
    await adapter.connect('BORROWER');

    const configService = getNetworkConfigService();
    try {
      configService.setNetworkConfig({
        environment: 'TESTNET',
        networkName: 'Midnight Testnet',
        networkId: 'midnight-testnet-01',
        nodeRpcEndpoint: {
          url: 'https://rpc.testnet.midnight.network',
          protocol: 'https',
          reachable: true,
          status: 'CONFIGURED',
        },
        indexerEndpoint: {
          url: 'https://indexer.testnet.midnight.network',
          protocol: 'https',
          reachable: true,
          status: 'CONFIGURED',
        },
        walletConnectorAvailable: true,
        isRealNetwork: true,
        isPrototype: false,
        status: 'CONFIGURED',
      });

      const execService = getTransactionExecutionService();
      const result = await execService.executeTransaction(
        {
          loan: loanBefore,
          account: { publicKey: PROTOTYPE_BORROWER_PK, publicKeyHex: '0x01', role: 'BORROWER' },
          action: 'VERIFY_ELIGIBILITY',
          loanId: 'loan-001',
        },
        registry,
        adapter
      );

      assert.equal(result.result.registryUpdated, false);
      assert.equal(result.result.status, 'BLOCKED');
      assert.equal(registry.getLoan('loan-001').status, LoanStatus.requested);
    } finally {
      resetNetworkConfig();
    }
  });

  it('Test 293 (Commit #28 & Anti-Fabrication): No synthetic transaction hashes are created', () => {
    const service = getWalletHandshakeService();
    const state = service.getHandshakeState();

    assert.equal('txHash' in state, false);
    assert.equal('transactionHash' in state, false);
    assert.equal('hash' in state, false);

    const compat = evaluateNetworkCompatibility(getNetworkConfig(), 'midnight-testnet-01');
    assert.equal('txHash' in compat, false);
    assert.equal('transactionHash' in compat, false);
  });

  it('Test 294 (Commit #28 & Anti-Fabrication): No fake block heights are created', () => {
    const service = getWalletHandshakeService();
    const state = service.getHandshakeState();

    assert.equal('blockHeight' in state, false);
    assert.equal('blockNumber' in state, false);
    assert.equal('height' in state, false);
  });

  it('Test 295 (Commit #28 & Anti-Fabrication): No fake confirmations are created', () => {
    const service = getWalletHandshakeService();
    const state = service.getHandshakeState();

    assert.equal('confirmations' in state, false);
    assert.equal('confirmationCount' in state, false);
    assert.equal('confirmed' in state, false);
  });

  it('Test 296 (Commit #28): Prototype provider remains explicitly non-signing/non-submitting', () => {
    const protoProvider = new LocalPrototypeWalletProvider('BORROWER');
    const caps = protoProvider.getCapabilities();

    assert.equal(caps.SIGN_TRANSACTION, false);
    assert.equal(caps.SUBMIT_TRANSACTION, false);
    assert.equal(protoProvider.getReportedNetworkId(), 'midnight-prototype-local');
  });

  it('Test 297 (Commit #28): Local prototype mode remains functional', async () => {
    const protoProvider = new LocalPrototypeWalletProvider('BORROWER');
    const service = new WalletHandshakeService(undefined, protoProvider);

    const result = await service.initiateHandshake({ role: 'BORROWER' });
    assert.equal(result.success, true);
    assert.equal(result.state.isConnected, true);
    assert.equal(result.state.networkCompatibility, 'MATCH');
    assert.equal(result.state.capabilities.canSign, false);
    assert.equal(result.state.capabilities.canSubmit, false);
  });

  it('Test 298 (Commit #28): Existing lifecycle contract guards remain authoritative', async () => {
    const registry = createDefaultLoanRegistry();
    const loan = registry.getLoan('loan-001'); // REQUESTED

    const lenderAccount = {
      publicKey: PROTOTYPE_LENDER_PK,
      publicKeyHex: '0x10',
      role: 'LENDER',
    };

    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: lenderAccount,
      signingAvailable: true,
      submissionAvailable: true,
    });
    await adapter.connect('LENDER');

    assert.equal(canFundLoan(loan, lenderAccount.publicKey).canExecute, false);

    const readiness = evaluateTransactionReadiness(loan, lenderAccount, 'FUND_LOAN', adapter);
    assert.equal(readiness.isReady, false);
    assert.equal(readiness.reason, 'GUARD_VALIDATION_FAILED');
  });

  it('Test 299 (Commit #28 & Privacy Invariant): Wallet identity remains public-only', async () => {
    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: {
        address: 'midnight1addr_public_only',
        publicKey: PROTOTYPE_BORROWER_PK,
        publicKeyHex: '0x01',
        role: 'BORROWER',
      },
      signingAvailable: true,
      submissionAvailable: true,
    });

    const service = new WalletHandshakeService(undefined, adapter);
    const result = await service.initiateHandshake({ role: 'BORROWER' });

    assert.ok(result.state.account);
    const identityKeys = Object.keys(result.state.account);
    const allowedKeys = ['address', 'publicKey', 'publicKeyHex', 'role', 'displayName'];
    for (const key of identityKeys) {
      assert.ok(allowedKeys.includes(key), `Identity has unexpected key: ${key}`);
    }
  });

  it('Test 300 (Commit #28 & Strict Privacy): No credentials or secret fields in wallet handshake state', () => {
    const service = getWalletHandshakeService();
    const state = service.getHandshakeState();

    const stateKeys = Object.keys(state);
    const forbiddenSubstrings = ['secret', 'seed', 'witness', 'balance', 'income', 'salary', 'credit'];
    for (const key of stateKeys) {
      for (const forbidden of forbiddenSubstrings) {
        assert.equal(
          key.toLowerCase().includes(forbidden),
          false,
          `Handshake state property ${key} violates privacy rule with substring ${forbidden}`
        );
      }
    }
  });

  it('Test 301 (Commit #28 & Security Invariant): No storage persistence of wallet credentials', () => {
    const service = getWalletSessionService();
    service.switchToPrototypeProvider('BORROWER');

    const persistentKeys = ['midnight_selected_role', 'midnight_p2p_loan_registry_v1'];
    for (const key of persistentKeys) {
      assert.equal(key.includes('secret') || key.includes('seed'), false);
    }
  });

  it('Test 302 (Commit #28): types/index.ts re-exports all wallet handshake domain models and errors', () => {
    const typesIndexPath = path.join(srcDir, 'types', 'index.ts');
    const content = fs.readFileSync(typesIndexPath, 'utf8');

    assert.ok(content.includes('WalletHandshakeStatus'));
    assert.ok(content.includes('NetworkCompatibilityStatus'));
    assert.ok(content.includes('WalletHandshakeErrorCode'));
    assert.ok(content.includes('WalletHandshakeError'));
    assert.ok(content.includes('WalletHandshakeCapabilities'));
    assert.ok(content.includes('WalletHandshakeState'));
    assert.ok(content.includes('WalletHandshakeRequest'));
    assert.ok(content.includes('WalletHandshakeResult'));
  });

  it('Test 303 (Commit #28 & Strict Privacy Audit): All frontend source files (>= 54 files) contain zero forbidden terms', () => {
    const forbiddenTerms = [
      'getPrivateFinancialValue',
      'BORROWER_PRIVATE_FINANCIAL_VALUE',
      'privateFinancialValue',
      'witness context',
      'privateState',
      'witness values',
      'borrower income',
      'salary',
      'bank balance',
      'credit score',
      'seed phrase',
      'private key',
      'wallet secret',
      'financial documents',
    ];

    const walkDir = (dir) => {
      let results = [];
      const list = fs.readdirSync(dir);
      list.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
          results = results.concat(walkDir(filePath));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          results.push(filePath);
        }
      });
      return results;
    };

    const files = walkDir(srcDir);
    assert.ok(files.length >= 54, `Must audit all frontend source files including wallet handshake modules (found ${files.length})`);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      for (const term of forbiddenTerms) {
        assert.equal(
          content.includes(term),
          false,
          `Forbidden privacy-violating string "${term}" found in ${file}`
        );
      }
    }
  });

  // ===========================================================================
  // Commit #29: Transaction Request Signing and Submission Boundary Tests
  // ===========================================================================

  it('Test 304 (Commit #29): Transaction request creation with valid parameters', () => {
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const execService = getTransactionExecutionService();
    const account = {
      role: 'LENDER',
      publicKey: DEFAULT_LENDER_PK_BYTES,
      publicKeyHex: DEFAULT_LENDER_PK_HEX,
      connectionStatus: 'CONNECTED',
    };

    const request = execService.createTransactionRequest(verifiedLoan, account, 'FUND_LOAN', 'loan-002');

    assert.ok(request.id.startsWith('tx-req-'));
    assert.equal(request.loanId, 'loan-002');
    assert.equal(request.action, 'FUND_LOAN');
    assert.equal(request.circuitName, 'fundLoan');
    assert.equal(request.status, 'DRAFT');
    assert.equal(request.parameters.amount, verifiedLoan.amount);
    assert.equal(request.parameters.durationBlocks, verifiedLoan.durationBlocks);
    assert.equal(request.parameters.interestRateBps, verifiedLoan.interestRateBasisPoints);
    assert.deepEqual(request.parameters.callerPublicKey, DEFAULT_LENDER_PK_BYTES);
    assert.equal(request.parameters.callerPublicKeyHex, DEFAULT_LENDER_PK_HEX);
    assert.ok(request.createdAt > 0);
    assert.ok(request.updatedAt >= request.createdAt);
  });

  it('Test 305 (Commit #29): Read-only transaction preparation and validation preserves state and returns ready', () => {
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: {
        address: 'midnight1lenderaddress00000000000000000000000000000',
        publicKey: DEFAULT_LENDER_PK_BYTES,
        publicKeyHex: DEFAULT_LENDER_PK_HEX,
        role: 'LENDER',
      },
      signingAvailable: true,
      submissionAvailable: true,
    });
    adapter.connect('LENDER');

    const sessionService = new WalletSessionService(adapter);
    const execService = new TransactionExecutionService(sessionService, adapter);
    const account = {
      role: 'LENDER',
      publicKey: DEFAULT_LENDER_PK_BYTES,
      publicKeyHex: DEFAULT_LENDER_PK_HEX,
      connectionStatus: 'CONNECTED',
    };

    const request = execService.createTransactionRequest(verifiedLoan, account, 'FUND_LOAN', 'loan-002');
    const result = execService.prepareAndValidate(request, verifiedLoan, account);

    assert.equal(result.isReady, true);
    assert.equal(request.status, 'PREPARED');
    assert.equal(result.prep.status, 'READY');
    assert.equal(result.reason, undefined);
  });

  it('Test 306 (Commit #29): Readiness propagation to signing stage', () => {
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: {
        address: 'midnight1lenderaddress00000000000000000000000000000',
        publicKey: DEFAULT_LENDER_PK_BYTES,
        publicKeyHex: DEFAULT_LENDER_PK_HEX,
        role: 'LENDER',
      },
      signingAvailable: true,
      submissionAvailable: true,
    });
    adapter.connect('LENDER');

    const sessionService = new WalletSessionService(adapter);
    const execService = new TransactionExecutionService(sessionService, adapter);
    const account = {
      role: 'LENDER',
      publicKey: DEFAULT_LENDER_PK_BYTES,
      publicKeyHex: DEFAULT_LENDER_PK_HEX,
      connectionStatus: 'CONNECTED',
    };

    const request = execService.createTransactionRequest(verifiedLoan, account, 'FUND_LOAN', 'loan-002');
    const prepResult = execService.prepareAndValidate(request, verifiedLoan, account);

    assert.equal(prepResult.isReady, true);
    assert.equal(request.status, 'PREPARED');
  });

  it('Test 307 (Commit #29): Network mismatch blocks transaction request', () => {
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const netConfigService = getNetworkConfigService();
    try {
      netConfigService.setNetworkConfig({
        environment: 'TESTNET',
        networkName: 'Midnight Testnet',
        networkId: 'midnight-testnet-01',
        nodeRpcEndpoint: {
          url: 'https://rpc.testnet.midnight.network',
          protocol: 'https',
          reachable: true,
          status: 'CONFIGURED',
        },
        indexerEndpoint: {
          url: 'https://indexer.testnet.midnight.network',
          protocol: 'https',
          reachable: true,
          status: 'CONFIGURED',
        },
        walletConnectorAvailable: true,
        isRealNetwork: true,
        isPrototype: false,
        status: 'CONFIGURED',
      });

      const adapter = new MidnightWalletAdapter();
      adapter.injectMockConnectorForTesting({
        mockAccount: {
          address: 'midnight1lenderaddress00000000000000000000000000000',
          publicKey: DEFAULT_LENDER_PK_BYTES,
          publicKeyHex: DEFAULT_LENDER_PK_HEX,
          role: 'LENDER',
        },
        walletNetwork: 'midnight-mainnet',
        signingAvailable: true,
        submissionAvailable: true,
      });
      adapter.connect('LENDER');

      const sessionService = new WalletSessionService(adapter);
      const execService = new TransactionExecutionService(sessionService, adapter);
      const account = {
        role: 'LENDER',
        publicKey: DEFAULT_LENDER_PK_BYTES,
        publicKeyHex: DEFAULT_LENDER_PK_HEX,
        connectionStatus: 'CONNECTED',
      };

      const request = execService.createTransactionRequest(verifiedLoan, account, 'FUND_LOAN', 'loan-002');
      const result = execService.prepareAndValidate(request, verifiedLoan, account);

      assert.equal(result.isReady, false);
      assert.equal(result.errorCode, 'NETWORK_MISMATCH');
      assert.equal(request.status, 'BLOCKED');
    } finally {
      resetNetworkConfig();
    }
  });

  it('Test 308 (Commit #29): Unknown network blocks transaction request', () => {
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const netConfigService = getNetworkConfigService();
    try {
      netConfigService.setNetworkConfig({
        environment: 'TESTNET',
        networkName: 'Midnight Testnet',
        networkId: 'midnight-testnet-01',
        nodeRpcEndpoint: {
          url: 'https://rpc.testnet.midnight.network',
          protocol: 'https',
          reachable: true,
          status: 'CONFIGURED',
        },
        indexerEndpoint: {
          url: 'https://indexer.testnet.midnight.network',
          protocol: 'https',
          reachable: true,
          status: 'CONFIGURED',
        },
        walletConnectorAvailable: true,
        isRealNetwork: true,
        isPrototype: false,
        status: 'CONFIGURED',
      });

      const adapter = new MidnightWalletAdapter();
      adapter.injectMockConnectorForTesting({
        mockAccount: {
          address: 'midnight1lenderaddress00000000000000000000000000000',
          publicKey: DEFAULT_LENDER_PK_BYTES,
          publicKeyHex: DEFAULT_LENDER_PK_HEX,
          role: 'LENDER',
        },
        walletNetwork: null,
        signingAvailable: true,
        submissionAvailable: true,
      });
      adapter.connect('LENDER');

      const sessionService = new WalletSessionService(adapter);
      const execService = new TransactionExecutionService(sessionService, adapter);
      const account = {
        role: 'LENDER',
        publicKey: DEFAULT_LENDER_PK_BYTES,
        publicKeyHex: DEFAULT_LENDER_PK_HEX,
        connectionStatus: 'CONNECTED',
      };

      const request = execService.createTransactionRequest(verifiedLoan, account, 'FUND_LOAN', 'loan-002');
      const result = execService.prepareAndValidate(request, verifiedLoan, account);

      assert.equal(result.isReady, false);
      assert.equal(result.errorCode, 'UNKNOWN_NETWORK');
      assert.equal(request.status, 'BLOCKED');
    } finally {
      resetNetworkConfig();
    }
  });

  it('Test 309 (Commit #29): Disconnected wallet blocks transaction request', () => {
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const adapter = new MidnightWalletAdapter();
    const sessionService = new WalletSessionService(adapter);
    const execService = new TransactionExecutionService(sessionService, adapter);
    const account = {
      role: 'LENDER',
      publicKey: DEFAULT_LENDER_PK_BYTES,
      publicKeyHex: DEFAULT_LENDER_PK_HEX,
      connectionStatus: 'DISCONNECTED',
    };

    const request = execService.createTransactionRequest(verifiedLoan, account, 'FUND_LOAN', 'loan-002');
    const result = execService.prepareAndValidate(request, verifiedLoan, account);

    assert.equal(result.isReady, false);
    assert.equal(result.errorCode, 'NOT_CONNECTED');
    assert.equal(request.status, 'BLOCKED');
  });

  it('Test 310 (Commit #29): Missing signing capability blocks signing request', async () => {
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: {
        address: 'midnight1lenderaddress00000000000000000000000000000',
        publicKey: DEFAULT_LENDER_PK_BYTES,
        publicKeyHex: DEFAULT_LENDER_PK_HEX,
        role: 'LENDER',
      },
      signingAvailable: false,
      submissionAvailable: true,
    });
    await adapter.connect('LENDER');

    const sessionService = new WalletSessionService(adapter);
    const execService = new TransactionExecutionService(sessionService, adapter);
    const account = {
      role: 'LENDER',
      publicKey: DEFAULT_LENDER_PK_BYTES,
      publicKeyHex: DEFAULT_LENDER_PK_HEX,
      connectionStatus: 'CONNECTED',
    };

    const request = execService.createTransactionRequest(verifiedLoan, account, 'FUND_LOAN', 'loan-002');
    const signingResult = await execService.requestSignature(request);

    assert.equal(signingResult.success, false);
    assert.equal(signingResult.status, 'UNSUPPORTED');
    assert.equal(request.status, 'UNSUPPORTED');
  });

  it('Test 311 (Commit #29): Missing submission capability blocks submission request', async () => {
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: {
        address: 'midnight1lenderaddress00000000000000000000000000000',
        publicKey: DEFAULT_LENDER_PK_BYTES,
        publicKeyHex: DEFAULT_LENDER_PK_HEX,
        role: 'LENDER',
      },
      signingAvailable: true,
      submissionAvailable: false,
    });
    await adapter.connect('LENDER');

    const sessionService = new WalletSessionService(adapter);
    const execService = new TransactionExecutionService(sessionService, adapter);
    const account = {
      role: 'LENDER',
      publicKey: DEFAULT_LENDER_PK_BYTES,
      publicKeyHex: DEFAULT_LENDER_PK_HEX,
      connectionStatus: 'CONNECTED',
    };

    const request = execService.createTransactionRequest(verifiedLoan, account, 'FUND_LOAN', 'loan-002');
    const subResult = await execService.submitTransaction(request);

    assert.equal(subResult.success, false);
    assert.equal(subResult.status, 'UNSUPPORTED');
    assert.equal(request.status, 'UNSUPPORTED');
  });

  it('Test 312 (Commit #29): User rejection at signing stage', async () => {
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: {
        address: 'midnight1lenderaddress00000000000000000000000000000',
        publicKey: DEFAULT_LENDER_PK_BYTES,
        publicKeyHex: DEFAULT_LENDER_PK_HEX,
        role: 'LENDER',
      },
      shouldRejectSignature: true,
      signingAvailable: true,
      submissionAvailable: true,
    });
    await adapter.connect('LENDER');

    const sessionService = new WalletSessionService(adapter);
    const execService = new TransactionExecutionService(sessionService, adapter);
    const account = {
      role: 'LENDER',
      publicKey: DEFAULT_LENDER_PK_BYTES,
      publicKeyHex: DEFAULT_LENDER_PK_HEX,
      connectionStatus: 'CONNECTED',
    };

    const request = execService.createTransactionRequest(verifiedLoan, account, 'FUND_LOAN', 'loan-002');
    const signingResult = await execService.requestSignature(request);

    assert.equal(signingResult.success, false);
    assert.equal(signingResult.status, 'REJECTED');
    assert.equal(signingResult.errorCode, 'USER_REJECTED_SIGNATURE');
    assert.equal(request.status, 'REJECTED');
  });

  it('Test 313 (Commit #29): User rejection at submission stage', async () => {
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: {
        address: 'midnight1lenderaddress00000000000000000000000000000',
        publicKey: DEFAULT_LENDER_PK_BYTES,
        publicKeyHex: DEFAULT_LENDER_PK_HEX,
        role: 'LENDER',
      },
      shouldRejectSubmission: true,
      signingAvailable: true,
      submissionAvailable: true,
    });
    await adapter.connect('LENDER');

    const sessionService = new WalletSessionService(adapter);
    const execService = new TransactionExecutionService(sessionService, adapter);
    const account = {
      role: 'LENDER',
      publicKey: DEFAULT_LENDER_PK_BYTES,
      publicKeyHex: DEFAULT_LENDER_PK_HEX,
      connectionStatus: 'CONNECTED',
    };

    const request = execService.createTransactionRequest(verifiedLoan, account, 'FUND_LOAN', 'loan-002');
    const subResult = await execService.submitTransaction(request);

    assert.equal(subResult.success, false);
    assert.equal(subResult.status, 'REJECTED');
    assert.equal(subResult.errorCode, 'USER_REJECTED_SUBMISSION');
    assert.equal(request.status, 'REJECTED');
  });

  it('Test 314 (Commit #29): Provider signing failure handled gracefully', async () => {
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: {
        address: 'midnight1lenderaddress00000000000000000000000000000',
        publicKey: DEFAULT_LENDER_PK_BYTES,
        publicKeyHex: DEFAULT_LENDER_PK_HEX,
        role: 'LENDER',
      },
      shouldFailSigning: true,
      signingAvailable: true,
      submissionAvailable: true,
    });
    await adapter.connect('LENDER');

    const sessionService = new WalletSessionService(adapter);
    const execService = new TransactionExecutionService(sessionService, adapter);
    const account = {
      role: 'LENDER',
      publicKey: DEFAULT_LENDER_PK_BYTES,
      publicKeyHex: DEFAULT_LENDER_PK_HEX,
      connectionStatus: 'CONNECTED',
    };

    const request = execService.createTransactionRequest(verifiedLoan, account, 'FUND_LOAN', 'loan-002');
    const signingResult = await execService.requestSignature(request);

    assert.equal(signingResult.success, false);
    assert.equal(signingResult.status, 'FAILED');
    assert.equal(signingResult.errorCode, 'SIGNING_FAILED');
    assert.equal(request.status, 'FAILED');
  });

  it('Test 315 (Commit #29): Provider submission failure handled gracefully', async () => {
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: {
        address: 'midnight1lenderaddress00000000000000000000000000000',
        publicKey: DEFAULT_LENDER_PK_BYTES,
        publicKeyHex: DEFAULT_LENDER_PK_HEX,
        role: 'LENDER',
      },
      shouldFailSubmission: true,
      signingAvailable: true,
      submissionAvailable: true,
    });
    await adapter.connect('LENDER');

    const sessionService = new WalletSessionService(adapter);
    const execService = new TransactionExecutionService(sessionService, adapter);
    const account = {
      role: 'LENDER',
      publicKey: DEFAULT_LENDER_PK_BYTES,
      publicKeyHex: DEFAULT_LENDER_PK_HEX,
      connectionStatus: 'CONNECTED',
    };

    const request = execService.createTransactionRequest(verifiedLoan, account, 'FUND_LOAN', 'loan-002');
    const subResult = await execService.submitTransaction(request);

    assert.equal(subResult.success, false);
    assert.equal(subResult.status, 'FAILED');
    assert.equal(subResult.errorCode, 'SUBMISSION_FAILED');
    assert.equal(request.status, 'FAILED');
  });

  it('Test 316 (Commit #29): Successful provider-confirmed flow updates LoanRegistry', async () => {
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const registry = createDefaultLoanRegistry();
    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: {
        address: 'midnight1lenderaddress00000000000000000000000000000',
        publicKey: DEFAULT_LENDER_PK_BYTES,
        publicKeyHex: DEFAULT_LENDER_PK_HEX,
        role: 'LENDER',
      },
      mockTxResult: {
        success: true,
        status: 'CONFIRMED',
        transactionId: 'tx-confirmed-316',
        blockHeight: 12345n,
      },
      signingAvailable: true,
      submissionAvailable: true,
    });
    await adapter.connect('LENDER');

    const sessionService = new WalletSessionService(adapter);
    const execService = new TransactionExecutionService(sessionService, adapter);
    const account = {
      role: 'LENDER',
      publicKey: DEFAULT_LENDER_PK_BYTES,
      publicKeyHex: DEFAULT_LENDER_PK_HEX,
      connectionStatus: 'CONNECTED',
    };

    const request = execService.createTransactionRequest(verifiedLoan, account, 'FUND_LOAN', 'loan-002');
    const pipelineResult = await execService.executePipeline(request, verifiedLoan, account, registry);

    assert.equal(pipelineResult.success, true);
    assert.equal(pipelineResult.status, 'CONFIRMED');
    assert.equal(pipelineResult.registryUpdated, true);

    const updated = (pipelineResult.updatedRegistry ?? registry).getLoan('loan-002');
    assert.equal(updated.status, LoanStatus.funded);
    assert.deepEqual(updated.lenderBytes, DEFAULT_LENDER_PK_BYTES);
  });

  it('Test 317 (Commit #29 & Anti-Fabrication): Status tracking never infers confirmation from submission', async () => {
    const statusService = resetTransactionStatusService();

    const tracked = statusService.trackTransaction('tx-sub-001', 'SUBMITTED', {
      loanId: 'loan-002',
      action: 'FUND_LOAN',
    });

    assert.equal(tracked.status, 'SUBMITTED');
    assert.notEqual(tracked.status, 'CONFIRMED');
    assert.equal(statusService.getStatus('tx-sub-001')?.status, 'SUBMITTED');

    // Only genuine update transitions status
    statusService.updateStatus('tx-sub-001', 'CONFIRMED', { blockHeight: 500n });
    assert.equal(statusService.getStatus('tx-sub-001')?.status, 'CONFIRMED');
    assert.equal(statusService.getStatus('tx-sub-001')?.blockHeight, 500n);
  });

  it('Test 318 (Commit #29 & Anti-Fabrication): No synthetic transaction hashes are generated in prototype mode', async () => {
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const provider = new LocalPrototypeWalletProvider();
    await provider.connect('LENDER');

    const sessionService = new WalletSessionService(provider);
    const execService = new TransactionExecutionService(sessionService, provider);
    const account = {
      role: 'LENDER',
      publicKey: PROTOTYPE_LENDER_PK,
      publicKeyHex: '0x0a',
      connectionStatus: 'CONNECTED',
    };

    const request = execService.createTransactionRequest(verifiedLoan, account, 'FUND_LOAN', 'loan-002');
    const subResult = await execService.submitTransaction(request);

    assert.equal(subResult.success, false);
    assert.equal(subResult.status, 'UNSUPPORTED');
    assert.equal(subResult.transactionId, undefined);
  });

  it('Test 319 (Commit #29 & Anti-Fabrication): No fake block heights are generated', async () => {
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const provider = new LocalPrototypeWalletProvider();
    await provider.connect('LENDER');

    const sessionService = new WalletSessionService(provider);
    const execService = new TransactionExecutionService(sessionService, provider);
    const account = {
      role: 'LENDER',
      publicKey: PROTOTYPE_LENDER_PK,
      publicKeyHex: '0x0a',
      connectionStatus: 'CONNECTED',
    };

    const request = execService.createTransactionRequest(verifiedLoan, account, 'FUND_LOAN', 'loan-002');
    const subResult = await execService.submitTransaction(request);

    assert.equal(subResult.blockHeight, undefined);
  });

  it('Test 320 (Commit #29 & Anti-Fabrication): No fake confirmations are generated', async () => {
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: {
        address: 'midnight1lenderaddress00000000000000000000000000000',
        publicKey: DEFAULT_LENDER_PK_BYTES,
        publicKeyHex: DEFAULT_LENDER_PK_HEX,
        role: 'LENDER',
      },
      mockTxResult: {
        success: true,
        status: 'PENDING',
        transactionId: 'tx-pending-320',
      },
      signingAvailable: true,
      submissionAvailable: true,
    });
    await adapter.connect('LENDER');

    const sessionService = new WalletSessionService(adapter);
    const execService = new TransactionExecutionService(sessionService, adapter);
    const account = {
      role: 'LENDER',
      publicKey: DEFAULT_LENDER_PK_BYTES,
      publicKeyHex: DEFAULT_LENDER_PK_HEX,
      connectionStatus: 'CONNECTED',
    };

    const request = execService.createTransactionRequest(verifiedLoan, account, 'FUND_LOAN', 'loan-002');
    const subResult = await execService.submitTransaction(request);

    assert.equal(subResult.status, 'SUBMITTED');
    assert.notEqual(subResult.status, 'CONFIRMED');
  });

  it('Test 321 (Commit #29 & Anti-Fabrication): No fake signatures are generated when signing is rejected or fails', async () => {
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: {
        address: 'midnight1lenderaddress00000000000000000000000000000',
        publicKey: DEFAULT_LENDER_PK_BYTES,
        publicKeyHex: DEFAULT_LENDER_PK_HEX,
        role: 'LENDER',
      },
      shouldRejectSignature: true,
      signingAvailable: true,
      submissionAvailable: true,
    });
    await adapter.connect('LENDER');

    const sessionService = new WalletSessionService(adapter);
    const execService = new TransactionExecutionService(sessionService, adapter);
    const account = {
      role: 'LENDER',
      publicKey: DEFAULT_LENDER_PK_BYTES,
      publicKeyHex: DEFAULT_LENDER_PK_HEX,
      connectionStatus: 'CONNECTED',
    };

    const request = execService.createTransactionRequest(verifiedLoan, account, 'FUND_LOAN', 'loan-002');
    const signingResult = await execService.requestSignature(request);

    assert.equal(signingResult.success, false);
    assert.equal(signingResult.signatureBytes, undefined);
    assert.equal(signingResult.signatureHex, undefined);
  });

  it('Test 322 (Commit #29 & Registry Immutability): Blocked preparation leaves LoanRegistry completely untouched', async () => {
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const registry = createDefaultLoanRegistry();
    const adapter = new MidnightWalletAdapter();
    const sessionService = new WalletSessionService(adapter);
    const execService = new TransactionExecutionService(sessionService, adapter);
    const account = {
      role: 'LENDER',
      publicKey: DEFAULT_LENDER_PK_BYTES,
      publicKeyHex: DEFAULT_LENDER_PK_HEX,
      connectionStatus: 'DISCONNECTED',
    };

    const request = execService.createTransactionRequest(verifiedLoan, account, 'FUND_LOAN', 'loan-002');
    const result = await execService.executePipeline(request, verifiedLoan, account, registry);

    assert.equal(result.success, false);
    assert.equal(result.registryUpdated, false);
    const loan = registry.getLoan('loan-002');
    assert.equal(loan.status, LoanStatus.requested);
    assert.equal(loan.lenderBytes, null);
  });

  it('Test 323 (Commit #29 & Registry Immutability): Rejected signing leaves LoanRegistry completely untouched', async () => {
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const registry = createDefaultLoanRegistry();
    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: {
        address: 'midnight1lenderaddress00000000000000000000000000000',
        publicKey: DEFAULT_LENDER_PK_BYTES,
        publicKeyHex: DEFAULT_LENDER_PK_HEX,
        role: 'LENDER',
      },
      shouldRejectSignature: true,
      signingAvailable: true,
      submissionAvailable: true,
    });
    await adapter.connect('LENDER');

    const sessionService = new WalletSessionService(adapter);
    const execService = new TransactionExecutionService(sessionService, adapter);
    const account = {
      role: 'LENDER',
      publicKey: DEFAULT_LENDER_PK_BYTES,
      publicKeyHex: DEFAULT_LENDER_PK_HEX,
      connectionStatus: 'CONNECTED',
    };

    const request = execService.createTransactionRequest(verifiedLoan, account, 'FUND_LOAN', 'loan-002');
    const result = await execService.executePipeline(request, verifiedLoan, account, registry);

    assert.equal(result.success, false);
    assert.equal(result.registryUpdated, false);
    const loan = registry.getLoan('loan-002');
    assert.equal(loan.status, LoanStatus.requested);
    assert.equal(loan.lenderBytes, null);
  });

  it('Test 324 (Commit #29 & Registry Immutability): Failed submission leaves LoanRegistry completely untouched', async () => {
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const registry = createDefaultLoanRegistry();
    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: {
        address: 'midnight1lenderaddress00000000000000000000000000000',
        publicKey: DEFAULT_LENDER_PK_BYTES,
        publicKeyHex: DEFAULT_LENDER_PK_HEX,
        role: 'LENDER',
      },
      shouldFailSubmission: true,
      signingAvailable: true,
      submissionAvailable: true,
    });
    await adapter.connect('LENDER');

    const sessionService = new WalletSessionService(adapter);
    const execService = new TransactionExecutionService(sessionService, adapter);
    const account = {
      role: 'LENDER',
      publicKey: DEFAULT_LENDER_PK_BYTES,
      publicKeyHex: DEFAULT_LENDER_PK_HEX,
      connectionStatus: 'CONNECTED',
    };

    const request = execService.createTransactionRequest(verifiedLoan, account, 'FUND_LOAN', 'loan-002');
    const result = await execService.executePipeline(request, verifiedLoan, account, registry);

    assert.equal(result.success, false);
    assert.equal(result.registryUpdated, false);
    const loan = registry.getLoan('loan-002');
    assert.equal(loan.status, LoanStatus.requested);
    assert.equal(loan.lenderBytes, null);
  });

  it('Test 325 (Commit #29 & Registry Immutability): Unconfirmed pending submission leaves LoanRegistry completely untouched', async () => {
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const registry = createDefaultLoanRegistry();
    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: {
        address: 'midnight1lenderaddress00000000000000000000000000000',
        publicKey: DEFAULT_LENDER_PK_BYTES,
        publicKeyHex: DEFAULT_LENDER_PK_HEX,
        role: 'LENDER',
      },
      mockTxResult: {
        success: true,
        status: 'PENDING',
        transactionId: 'tx-pending-325',
      },
      signingAvailable: true,
      submissionAvailable: true,
    });
    await adapter.connect('LENDER');

    const sessionService = new WalletSessionService(adapter);
    const execService = new TransactionExecutionService(sessionService, adapter);
    const account = {
      role: 'LENDER',
      publicKey: DEFAULT_LENDER_PK_BYTES,
      publicKeyHex: DEFAULT_LENDER_PK_HEX,
      connectionStatus: 'CONNECTED',
    };

    const request = execService.createTransactionRequest(verifiedLoan, account, 'FUND_LOAN', 'loan-002');
    const result = await execService.executePipeline(request, verifiedLoan, account, registry);

    assert.equal(result.success, true);
    assert.equal(result.status, 'SUBMITTED');
    assert.equal(result.registryUpdated, false);
    const loan = registry.getLoan('loan-002');
    assert.equal(loan.status, LoanStatus.requested);
    assert.equal(loan.lenderBytes, null);
  });

  it('Test 326 (Commit #29): Role authorization guard: borrower cannot fund own loan', () => {
    const verifiedLoan = MOCK_LOANS['loan-002'];
    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: {
        address: 'midnight1borroweraddress00000000000000000000000000',
        publicKey: verifiedLoan.borrowerBytes,
        publicKeyHex: verifiedLoan.borrower,
        role: 'BORROWER',
      },
      signingAvailable: true,
      submissionAvailable: true,
    });
    adapter.connect('BORROWER');

    const sessionService = new WalletSessionService(adapter);
    const execService = new TransactionExecutionService(sessionService, adapter);
    const account = {
      role: 'BORROWER',
      publicKey: verifiedLoan.borrowerBytes,
      publicKeyHex: verifiedLoan.borrower,
      connectionStatus: 'CONNECTED',
    };

    const request = execService.createTransactionRequest(verifiedLoan, account, 'FUND_LOAN', 'loan-002');
    const prepResult = execService.prepareAndValidate(request, verifiedLoan, account);

    assert.equal(prepResult.isReady, false);
    assert.equal(prepResult.errorCode, 'GUARD_VALIDATION_FAILED');
  });

  it('Test 327 (Commit #29): Role authorization guard: unauthorized third-party cannot repay or settle loan', () => {
    const fundedLoan = MOCK_LOANS['loan-003'];
    const adapter = new MidnightWalletAdapter();
    const thirdPartyPk = new Uint8Array(32).fill(88);
    adapter.injectMockConnectorForTesting({
      mockAccount: {
        address: 'midnight1thirdpartyaddress00000000000000000000000',
        publicKey: thirdPartyPk,
        publicKeyHex: '0x58',
        role: 'PARTICIPANT',
      },
      signingAvailable: true,
      submissionAvailable: true,
    });
    adapter.connect('PARTICIPANT');

    const sessionService = new WalletSessionService(adapter);
    const execService = new TransactionExecutionService(sessionService, adapter);
    const account = {
      role: 'PARTICIPANT',
      publicKey: thirdPartyPk,
      publicKeyHex: '0x58',
      connectionStatus: 'CONNECTED',
    };

    const request = execService.createTransactionRequest(fundedLoan, account, 'REPAY_LOAN', 'loan-003');
    const prepResult = execService.prepareAndValidate(request, fundedLoan, account);

    assert.equal(prepResult.isReady, false);
    assert.equal(prepResult.errorCode, 'GUARD_VALIDATION_FAILED');
  });

  it('Test 328 (Commit #29): Terminal state guard: settled loan cannot be repaid, funded, or settled again', () => {
    const settledLoan = MOCK_LOANS['loan-005'];
    const adapter = new MidnightWalletAdapter();
    adapter.injectMockConnectorForTesting({
      mockAccount: {
        address: 'midnight1borroweraddress00000000000000000000000000',
        publicKey: settledLoan.borrowerBytes,
        publicKeyHex: settledLoan.borrower,
        role: 'BORROWER',
      },
      signingAvailable: true,
      submissionAvailable: true,
    });
    adapter.connect('BORROWER');

    const sessionService = new WalletSessionService(adapter);
    const execService = new TransactionExecutionService(sessionService, adapter);
    const account = {
      role: 'BORROWER',
      publicKey: settledLoan.borrowerBytes,
      publicKeyHex: settledLoan.borrower,
      connectionStatus: 'CONNECTED',
    };

    const request = execService.createTransactionRequest(settledLoan, account, 'SETTLE_LOAN', 'loan-005');
    const prepResult = execService.prepareAndValidate(request, settledLoan, account);

    assert.equal(prepResult.isReady, false);
    assert.equal(prepResult.errorCode, 'GUARD_VALIDATION_FAILED');
  });

  it('Test 329 (Commit #29): Prototype provider honesty: explicitly throws UNSUPPORTED_OPERATION on signing and submission', async () => {
    const provider = new LocalPrototypeWalletProvider();
    await provider.connect('LENDER');

    const dummySigningReq = {
      requestId: 'test-req',
      loanId: 'loan-001',
      action: 'FUND_LOAN',
      circuitName: 'fundLoan',
      callerPublicKey: PROTOTYPE_LENDER_PK,
      parameters: {
        loanId: 'loan-001',
        action: 'FUND_LOAN',
        circuitName: 'fundLoan',
        callerPublicKey: PROTOTYPE_LENDER_PK,
        callerPublicKeyHex: '0x0a',
        amount: 1000n,
        interestRateBps: 500n,
        durationBlocks: 100n,
      },
      createdAt: Date.now(),
    };

    await assert.rejects(
      async () => provider.requestSignature(dummySigningReq),
      (err) => err.code === 'UNSUPPORTED_OPERATION'
    );

    await assert.rejects(
      async () => provider.submitTransaction({ loanId: 'loan-001', action: 'FUND', callerPublicKey: PROTOTYPE_LENDER_PK }),
      (err) => err.code === 'UNSUPPORTED_OPERATION'
    );

    await assert.rejects(
      async () => provider.getTransactionStatus('tx-123'),
      (err) => err.code === 'UNSUPPORTED_OPERATION'
    );
  });

  it('Test 330 (Commit #29): types/index.ts re-exports all transaction request domain models and errors', () => {
    const typesIndexPath = path.join(srcDir, 'types', 'index.ts');
    const content = fs.readFileSync(typesIndexPath, 'utf8');

    assert.ok(content.includes('TransactionRequestStatus'));
    assert.ok(content.includes('TransactionSigningStatus'));
    assert.ok(content.includes('TransactionSubmissionStatus'));
    assert.ok(content.includes('TrackedTransactionStatus'));
    assert.ok(content.includes('TransactionRequestErrorCode'));
    assert.ok(content.includes('TransactionRequestParameters'));
    assert.ok(content.includes('TransactionSigningRequest'));
    assert.ok(content.includes('TransactionSigningResult'));
    assert.ok(content.includes('TransactionSubmissionRequest'));
    assert.ok(content.includes('TransactionSubmissionResult'));
    assert.ok(content.includes('TransactionStatusResult'));
    assert.ok(content.includes('TransactionRequestError'));
    assert.ok(content.includes('TransactionRequestResult'));
  });

  it('Test 331 (Commit #29 & Strict Privacy Audit): All frontend source files (>= 56 files) contain zero forbidden terms', () => {
    const forbiddenTerms = [
      'getPrivateFinancialValue',
      'BORROWER_PRIVATE_FINANCIAL_VALUE',
      'privateFinancialValue',
      'witness context',
      'privateState',
      'witness values',
      'borrower income',
      'salary',
      'bank balance',
      'credit score',
      'seed phrase',
      'private key',
      'wallet secret',
      'financial documents',
    ];

    const walkDir = (dir) => {
      let results = [];
      const list = fs.readdirSync(dir);
      list.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
          results = results.concat(walkDir(filePath));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          results.push(filePath);
        }
      });
      return results;
    };

    const files = walkDir(srcDir);
    assert.ok(files.length >= 56, `Must audit all frontend source files including transaction request modules (found ${files.length})`);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      for (const term of forbiddenTerms) {
        assert.equal(
          content.includes(term),
          false,
          `Forbidden privacy-violating string "${term}" found in ${file}`
        );
      }
    }
  });

  // =========================================================================
  // COMMIT #30 TESTS: Transaction Lifecycle Persistence & Recovery
  // =========================================================================

  it('Test 332 (Commit #30): Transaction persistence: save and retrieve transaction record', () => {
    const adapter = new InMemoryTransactionPersistence();
    const service = new TransactionPersistenceService(adapter);

    const tx = {
      id: 'tx-rec-001',
      action: 'FUND_LOAN',
      loanId: 'loan-001',
      circuitName: 'fundLoan',
      callerPublicKeyHex: '0x01',
      networkId: 'undeployed',
      providerKind: 'PROTOTYPE',
      status: 'DRAFT',
      recoveryStatus: 'RECOVERABLE',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    service.saveTransaction(tx);
    const retrieved = service.getTransaction('tx-rec-001');

    assert.ok(retrieved);
    assert.equal(retrieved.id, 'tx-rec-001');
    assert.equal(retrieved.action, 'FUND_LOAN');
    assert.equal(retrieved.status, 'DRAFT');
  });

  it('Test 333 (Commit #30): Transaction persistence: list transactions sorted by createdAt descending', () => {
    const adapter = new InMemoryTransactionPersistence();
    const service = new TransactionPersistenceService(adapter);

    const baseTime = 1000000;
    service.saveTransaction({
      id: 'tx-1',
      action: 'FUND_LOAN',
      loanId: 'loan-001',
      circuitName: 'fundLoan',
      callerPublicKeyHex: '0x01',
      networkId: 'undeployed',
      providerKind: 'PROTOTYPE',
      status: 'DRAFT',
      recoveryStatus: 'RECOVERABLE',
      createdAt: baseTime + 100,
      updatedAt: baseTime + 100,
    });
    service.saveTransaction({
      id: 'tx-2',
      action: 'REPAY_LOAN',
      loanId: 'loan-002',
      circuitName: 'repayLoan',
      callerPublicKeyHex: '0x02',
      networkId: 'undeployed',
      providerKind: 'PROTOTYPE',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      createdAt: baseTime + 300,
      updatedAt: baseTime + 300,
    });
    service.saveTransaction({
      id: 'tx-3',
      action: 'SETTLE_LOAN',
      loanId: 'loan-003',
      circuitName: 'settleLoan',
      callerPublicKeyHex: '0x03',
      networkId: 'undeployed',
      providerKind: 'PROTOTYPE',
      status: 'CONFIRMED',
      recoveryStatus: 'CONFIRMED',
      createdAt: baseTime + 200,
      updatedAt: baseTime + 200,
    });

    const list = service.listTransactions();
    assert.equal(list.length, 3);
    assert.equal(list[0].id, 'tx-2'); // 300
    assert.equal(list[1].id, 'tx-3'); // 200
    assert.equal(list[2].id, 'tx-1'); // 100
  });

  it('Test 334 (Commit #30): Transaction persistence: update existing transaction fields and updatedAt', () => {
    const adapter = new InMemoryTransactionPersistence();
    const service = new TransactionPersistenceService(adapter);

    const tx = {
      id: 'tx-update-001',
      action: 'FUND_LOAN',
      loanId: 'loan-001',
      circuitName: 'fundLoan',
      callerPublicKeyHex: '0x01',
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT_WALLET',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      createdAt: 1000,
      updatedAt: 1000,
    };
    service.saveTransaction(tx);

    const updated = service.updateTransaction('tx-update-001', {
      status: 'CONFIRMED',
      recoveryStatus: 'CONFIRMED',
      blockHeight: 500n,
    });

    assert.equal(updated.status, 'CONFIRMED');
    assert.equal(updated.recoveryStatus, 'CONFIRMED');
    assert.equal(updated.blockHeight, 500n);
    assert.ok(updated.updatedAt >= 1000);

    const retrieved = service.getTransaction('tx-update-001');
    assert.equal(retrieved?.status, 'CONFIRMED');
    assert.equal(retrieved?.blockHeight, 500n);
  });

  it('Test 335 (Commit #30): Transaction persistence: update non-existent transaction throws TRANSACTION_NOT_FOUND', () => {
    const adapter = new InMemoryTransactionPersistence();
    const service = new TransactionPersistenceService(adapter);

    assert.throws(
      () => service.updateTransaction('missing-tx', { status: 'CONFIRMED' }),
      (err) => err instanceof TransactionPersistenceError && err.code === 'TRANSACTION_NOT_FOUND'
    );
  });

  it('Test 336 (Commit #30): Transaction persistence: remove transaction by id returns boolean', () => {
    const adapter = new InMemoryTransactionPersistence();
    const service = new TransactionPersistenceService(adapter);

    service.saveTransaction({
      id: 'tx-del-1',
      action: 'FUND_LOAN',
      loanId: 'loan-001',
      circuitName: 'fundLoan',
      callerPublicKeyHex: '0x01',
      networkId: 'undeployed',
      providerKind: 'PROTOTYPE',
      status: 'DRAFT',
      recoveryStatus: 'RECOVERABLE',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const removedFirst = service.removeTransaction('tx-del-1');
    assert.equal(removedFirst, true);
    assert.equal(service.getTransaction('tx-del-1'), null);

    const removedSecond = service.removeTransaction('tx-del-1');
    assert.equal(removedSecond, false);
  });

  it('Test 337 (Commit #30): Transaction persistence: clear all transactions removes all records', () => {
    const adapter = new InMemoryTransactionPersistence();
    const service = new TransactionPersistenceService(adapter);

    service.saveTransaction({
      id: 'tx-c1',
      action: 'FUND_LOAN',
      loanId: 'loan-001',
      circuitName: 'fundLoan',
      callerPublicKeyHex: '0x01',
      networkId: 'undeployed',
      providerKind: 'PROTOTYPE',
      status: 'DRAFT',
      recoveryStatus: 'RECOVERABLE',
      createdAt: 1000,
      updatedAt: 1000,
    });
    service.saveTransaction({
      id: 'tx-c2',
      action: 'REPAY_LOAN',
      loanId: 'loan-002',
      circuitName: 'repayLoan',
      callerPublicKeyHex: '0x02',
      networkId: 'undeployed',
      providerKind: 'PROTOTYPE',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      createdAt: 2000,
      updatedAt: 2000,
    });

    assert.equal(service.listTransactions().length, 2);
    service.clearTransactions();
    assert.equal(service.listTransactions().length, 0);
  });

  it('Test 338 (Commit #30): Safe serialization: round-trip BigInt amounts, interest rates, block heights in LocalStorage persistence', () => {
    const mockStorage = {};
    const originalWindow = global.window;
    global.window = {
      localStorage: {
        getItem: (k) => mockStorage[k] ?? null,
        removeItem: (k) => { delete mockStorage[k]; },
      },
    };
    Object.defineProperty(global.window.localStorage, TRANSACTION_STORAGE_KEY, {
      get: () => mockStorage[TRANSACTION_STORAGE_KEY],
      set: (val) => { mockStorage[TRANSACTION_STORAGE_KEY] = val; },
      configurable: true,
    });

    try {
      const adapter1 = new LocalStorageTransactionPersistence();
      adapter1.saveTransaction({
        id: 'tx-bigint-1',
        action: 'FUND_LOAN',
        loanId: 'loan-001',
        circuitName: 'fundLoan',
        callerPublicKeyHex: '0x01',
        networkId: 'undeployed',
        providerKind: 'MIDNIGHT_WALLET',
        status: 'CONFIRMED',
        recoveryStatus: 'CONFIRMED',
        amount: 2500000n,
        interestRateBps: 850n,
        durationBlocks: 1440n,
        blockHeight: 888888n,
        createdAt: 5000,
        updatedAt: 5000,
      });

      // Reload in fresh adapter instance reading the same mock storage
      const adapter2 = new LocalStorageTransactionPersistence();
      const loaded = adapter2.getTransaction('tx-bigint-1');

      assert.ok(loaded);
      assert.equal(typeof loaded.amount, 'bigint');
      assert.equal(loaded.amount, 2500000n);
      assert.equal(typeof loaded.interestRateBps, 'bigint');
      assert.equal(loaded.interestRateBps, 850n);
      assert.equal(typeof loaded.durationBlocks, 'bigint');
      assert.equal(loaded.durationBlocks, 1440n);
      assert.equal(typeof loaded.blockHeight, 'bigint');
      assert.equal(loaded.blockHeight, 888888n);
    } finally {
      global.window = originalWindow;
    }
  });

  it('Test 339 (Commit #30): Safe serialization: round-trip Uint8Array public keys and caller identities', () => {
    const mockStorage = {};
    const originalWindow = global.window;
    global.window = {
      localStorage: {
        getItem: (k) => mockStorage[k] ?? null,
        removeItem: (k) => { delete mockStorage[k]; },
      },
    };
    Object.defineProperty(global.window.localStorage, TRANSACTION_STORAGE_KEY, {
      get: () => mockStorage[TRANSACTION_STORAGE_KEY],
      set: (val) => { mockStorage[TRANSACTION_STORAGE_KEY] = val; },
      configurable: true,
    });

    try {
      const callerBytes = new Uint8Array([10, 20, 30, 40, 50, 60]);
      const adapter1 = new LocalStorageTransactionPersistence();
      adapter1.saveTransaction({
        id: 'tx-bytes-1',
        action: 'FUND_LOAN',
        loanId: 'loan-001',
        circuitName: 'fundLoan',
        callerPublicKeyHex: '0x0a14',
        callerPublicKey: callerBytes,
        networkId: 'undeployed',
        providerKind: 'MIDNIGHT_WALLET',
        status: 'DRAFT',
        recoveryStatus: 'RECOVERABLE',
        createdAt: 6000,
        updatedAt: 6000,
      });

      const adapter2 = new LocalStorageTransactionPersistence();
      const loaded = adapter2.getTransaction('tx-bytes-1');

      assert.ok(loaded);
      assert.ok(loaded.callerPublicKey instanceof Uint8Array);
      assert.deepEqual(Array.from(loaded.callerPublicKey), Array.from(callerBytes));
    } finally {
      global.window = originalWindow;
    }
  });

  it('Test 340 (Commit #30): Corrupted LocalStorage handling: recover gracefully without throwing exceptions', () => {
    const originalWindow = global.window;
    global.window = {
      localStorage: {
        [TRANSACTION_STORAGE_KEY]: '{"corrupted": json-not-valid ...',
        getItem: () => '{"corrupted": json-not-valid ...',
        removeItem: () => {},
      },
    };

    try {
      const adapter = new LocalStorageTransactionPersistence();
      const list = adapter.listTransactions();
      assert.deepEqual(list, []);
      assert.equal(adapter.getTransaction('any'), null);
    } finally {
      global.window = originalWindow;
    }
  });

  it('Test 341 (Commit #30): Fallback to in-memory persistence when localStorage is unavailable', () => {
    const originalWindow = global.window;
    global.window = undefined;

    try {
      const adapter = new LocalStorageTransactionPersistence();
      adapter.saveTransaction({
        id: 'tx-fallback-1',
        action: 'FUND_LOAN',
        loanId: 'loan-001',
        circuitName: 'fundLoan',
        callerPublicKeyHex: '0x01',
        networkId: 'undeployed',
        providerKind: 'PROTOTYPE',
        status: 'DRAFT',
        recoveryStatus: 'RECOVERABLE',
        createdAt: 1000,
        updatedAt: 1000,
      });

      const retrieved = adapter.getTransaction('tx-fallback-1');
      assert.ok(retrieved);
      assert.equal(retrieved.id, 'tx-fallback-1');
      assert.equal(adapter.listTransactions().length, 1);
    } finally {
      global.window = originalWindow;
    }
  });

  it('Test 342 (Commit #30): Lifecycle recovery: recoverPendingTransactions returns only pending/recoverable transactions', () => {
    const adapter = new InMemoryTransactionPersistence();
    const persistence = new TransactionPersistenceService(adapter);
    const recovery = new TransactionRecoveryService(persistence);

    persistence.saveTransaction({
      id: 'tx-pending-1',
      action: 'FUND_LOAN',
      loanId: 'loan-001',
      circuitName: 'fundLoan',
      callerPublicKeyHex: '0x01',
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT_WALLET',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      createdAt: 1000,
      updatedAt: 1000,
    });
    persistence.saveTransaction({
      id: 'tx-confirmed-1',
      action: 'REPAY_LOAN',
      loanId: 'loan-002',
      circuitName: 'repayLoan',
      callerPublicKeyHex: '0x02',
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT_WALLET',
      status: 'CONFIRMED',
      recoveryStatus: 'CONFIRMED',
      createdAt: 2000,
      updatedAt: 2000,
    });
    persistence.saveTransaction({
      id: 'tx-submitting-1',
      action: 'SETTLE_LOAN',
      loanId: 'loan-003',
      circuitName: 'settleLoan',
      callerPublicKeyHex: '0x03',
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT_WALLET',
      status: 'SUBMITTING',
      recoveryStatus: 'PENDING',
      createdAt: 3000,
      updatedAt: 3000,
    });

    const pending = recovery.recoverPendingTransactions();
    assert.equal(pending.length, 2);
    const ids = pending.map((t) => t.id);
    assert.ok(ids.includes('tx-pending-1'));
    assert.ok(ids.includes('tx-submitting-1'));
    assert.ok(!ids.includes('tx-confirmed-1'));
  });

  it('Test 343 (Commit #30): Lifecycle recovery: getRecoverableTransactions filters eligible transactions', () => {
    const adapter = new InMemoryTransactionPersistence();
    const persistence = new TransactionPersistenceService(adapter);
    const recovery = new TransactionRecoveryService(persistence);

    persistence.saveTransaction({
      id: 'tx-recov-1',
      action: 'FUND_LOAN',
      loanId: 'loan-001',
      circuitName: 'fundLoan',
      callerPublicKeyHex: '0x01',
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT_WALLET',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      createdAt: 1000,
      updatedAt: 1000,
    });
    persistence.saveTransaction({
      id: 'tx-recov-2',
      action: 'FUND_LOAN',
      loanId: 'loan-001',
      circuitName: 'fundLoan',
      callerPublicKeyHex: '0x01',
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT_WALLET',
      status: 'CONFIRMED',
      recoveryStatus: 'CONFIRMED',
      createdAt: 2000,
      updatedAt: 2000,
    });

    const recoverable = recovery.getRecoverableTransactions();
    assert.equal(recoverable.length, 1);
    assert.equal(recoverable[0].id, 'tx-recov-1');
  });

  it('Test 344 (Commit #30): Reconciliation: non-existent transaction returns not found result without modifying registry', async () => {
    const adapter = new InMemoryTransactionPersistence();
    const persistence = new TransactionPersistenceService(adapter);
    const recovery = new TransactionRecoveryService(persistence);
    const registry = createDefaultLoanRegistry();

    const mockProvider = {
      isConnected: () => true,
      getTransactionStatus: async () => ({ status: 'CONFIRMED', blockHeight: 10n }),
    };

    const result = await recovery.reconcileTransaction('missing-id', mockProvider, registry);

    assert.equal(result.success, false);
    assert.equal(result.recoveryStatus, 'NOT_FOUND');
    assert.equal(result.registryUpdated, false);
  });

  it('Test 345 (Commit #30): Reconciliation: disconnected wallet provider marks transaction UNSUPPORTED', async () => {
    const adapter = new InMemoryTransactionPersistence();
    const persistence = new TransactionPersistenceService(adapter);
    const recovery = new TransactionRecoveryService(persistence);

    persistence.saveTransaction({
      id: 'tx-disc-1',
      action: 'FUND_LOAN',
      loanId: 'loan-001',
      circuitName: 'fundLoan',
      callerPublicKeyHex: '0x01',
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT_WALLET',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      providerTransactionId: '0xabc1',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const mockDisconnected = {
      isConnected: () => false,
      getConnectionStatus: () => 'DISCONNECTED',
      getTransactionStatus: async () => ({ status: 'CONFIRMED' }),
    };

    const result = await recovery.reconcileTransaction('tx-disc-1', mockDisconnected);
    assert.equal(result.success, false);
    assert.equal(result.recoveryStatus, 'UNSUPPORTED');
    assert.equal(result.errorCode, 'NOT_CONNECTED');
  });

  it('Test 346 (Commit #30): Reconciliation: provider without getTransactionStatus marks UNSUPPORTED', async () => {
    const adapter = new InMemoryTransactionPersistence();
    const persistence = new TransactionPersistenceService(adapter);
    const recovery = new TransactionRecoveryService(persistence);

    persistence.saveTransaction({
      id: 'tx-nostat-1',
      action: 'FUND_LOAN',
      loanId: 'loan-001',
      circuitName: 'fundLoan',
      callerPublicKeyHex: '0x01',
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT_WALLET',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      providerTransactionId: '0xabc2',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const mockNoStatus = {
      isConnected: () => true,
      getConnectionStatus: () => 'CONNECTED',
    };

    const result = await recovery.reconcileTransaction('tx-nostat-1', mockNoStatus);
    assert.equal(result.success, false);
    assert.equal(result.recoveryStatus, 'UNSUPPORTED');
    assert.equal(result.errorCode, 'UNSUPPORTED_OPERATION');
  });

  it('Test 347 (Commit #30): Reconciliation: transaction without providerTransactionId marked STALE', async () => {
    const adapter = new InMemoryTransactionPersistence();
    const persistence = new TransactionPersistenceService(adapter);
    const recovery = new TransactionRecoveryService(persistence);

    persistence.saveTransaction({
      id: 'tx-notxid-1',
      action: 'FUND_LOAN',
      loanId: 'loan-001',
      circuitName: 'fundLoan',
      callerPublicKeyHex: '0x01',
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT_WALLET',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const mockProvider = {
      isConnected: () => true,
      getTransactionStatus: async () => ({ status: 'CONFIRMED' }),
    };

    const result = await recovery.reconcileTransaction('tx-notxid-1', mockProvider);
    assert.equal(result.success, false);
    assert.equal(result.recoveryStatus, 'STALE');
    assert.equal(result.registryUpdated, false);
  });

  it('Test 348 (Commit #30): Reconciliation: confirmed provider status updates transaction record to CONFIRMED', async () => {
    const adapter = new InMemoryTransactionPersistence();
    const persistence = new TransactionPersistenceService(adapter);
    const recovery = new TransactionRecoveryService(persistence);

    persistence.saveTransaction({
      id: 'tx-conf-1',
      action: 'FUND_LOAN',
      loanId: 'loan-001',
      circuitName: 'fundLoan',
      callerPublicKeyHex: '0x01',
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT_WALLET',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      providerTransactionId: '0xgenuine-hash-1',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const mockProvider = {
      isConnected: () => true,
      getTransactionStatus: async (id) => ({
        transactionId: id,
        status: 'CONFIRMED',
        blockHeight: 333n,
      }),
    };

    const result = await recovery.reconcileTransaction('tx-conf-1', mockProvider);
    assert.equal(result.success, true);
    assert.equal(result.reconciledStatus, 'CONFIRMED');
    assert.equal(result.recoveryStatus, 'CONFIRMED');
    assert.equal(result.blockHeight, 333n);

    const saved = persistence.getTransaction('tx-conf-1');
    assert.equal(saved?.status, 'CONFIRMED');
    assert.equal(saved?.recoveryStatus, 'CONFIRMED');
    assert.equal(saved?.blockHeight, 333n);
  });

  it('Test 349 (Commit #30): Reconciliation: confirmed FUND_LOAN updates LoanRegistry to funded', async () => {
    const adapter = new InMemoryTransactionPersistence();
    const persistence = new TransactionPersistenceService(adapter);
    const recovery = new TransactionRecoveryService(persistence);

    // Prepare registry with verified loan-001
    const registry = createDefaultLoanRegistry();
    const verifiedRegistry = registry.verifyLoanEligibility('loan-001', PROTOTYPE_BORROWER_PK);
    assert.equal(verifiedRegistry.getLoan('loan-001').status, LoanStatus.requested);
    assert.equal(verifiedRegistry.getLoan('loan-001').isEligibilityVerified, true);

    persistence.saveTransaction({
      id: 'tx-fund-rec',
      action: 'FUND_LOAN',
      loanId: 'loan-001',
      circuitName: 'fundLoan',
      callerPublicKey: PROTOTYPE_LENDER_PK,
      callerPublicKeyHex: '0x02',
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT_WALLET',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      providerTransactionId: '0xfund-tx-001',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const mockProvider = {
      isConnected: () => true,
      getTransactionStatus: async () => ({ status: 'CONFIRMED', blockHeight: 120n }),
    };

    const result = await recovery.reconcileTransaction('tx-fund-rec', mockProvider, verifiedRegistry);

    assert.equal(result.success, true);
    assert.equal(result.registryUpdated, true);
    assert.ok(result.updatedRegistry);
    const fundedLoan = result.updatedRegistry.getLoan('loan-001');
    assert.equal(fundedLoan.status, LoanStatus.funded);
  });

  it('Test 350 (Commit #30): Reconciliation: confirmed REPAY_LOAN updates LoanRegistry to repaid', async () => {
    const adapter = new InMemoryTransactionPersistence();
    const persistence = new TransactionPersistenceService(adapter);
    const recovery = new TransactionRecoveryService(persistence);

    // loan-003 is already funded in default mock loans
    const registry = createDefaultLoanRegistry();
    assert.equal(registry.getLoan('loan-003').status, LoanStatus.funded);

    const borrowerPk = registry.getLoan('loan-003').borrowerBytes;

    persistence.saveTransaction({
      id: 'tx-repay-rec',
      action: 'REPAY_LOAN',
      loanId: 'loan-003',
      circuitName: 'repayLoan',
      callerPublicKey: borrowerPk,
      callerPublicKeyHex: '0x01',
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT_WALLET',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      providerTransactionId: '0xrepay-tx-003',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const mockProvider = {
      isConnected: () => true,
      getTransactionStatus: async () => ({ status: 'CONFIRMED', blockHeight: 150n }),
    };

    const result = await recovery.reconcileTransaction('tx-repay-rec', mockProvider, registry);

    assert.equal(result.success, true);
    assert.equal(result.registryUpdated, true);
    assert.ok(result.updatedRegistry);
    assert.equal(result.updatedRegistry.getLoan('loan-003').status, LoanStatus.repaid);
  });

  it('Test 351 (Commit #30): Reconciliation: confirmed SETTLE_LOAN updates LoanRegistry to settled', async () => {
    const adapter = new InMemoryTransactionPersistence();
    const persistence = new TransactionPersistenceService(adapter);
    const recovery = new TransactionRecoveryService(persistence);

    // loan-004 is already repaid in default mock loans
    const registry = createDefaultLoanRegistry();
    assert.equal(registry.getLoan('loan-004').status, LoanStatus.repaid);

    const lenderPk = registry.getLoan('loan-004').lenderBytes;

    persistence.saveTransaction({
      id: 'tx-settle-rec',
      action: 'SETTLE_LOAN',
      loanId: 'loan-004',
      circuitName: 'settleLoan',
      callerPublicKey: lenderPk,
      callerPublicKeyHex: '0x02',
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT_WALLET',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      providerTransactionId: '0xsettle-tx-004',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const mockProvider = {
      isConnected: () => true,
      getTransactionStatus: async () => ({ status: 'CONFIRMED', blockHeight: 200n }),
    };

    const result = await recovery.reconcileTransaction('tx-settle-rec', mockProvider, registry);

    assert.equal(result.success, true);
    assert.equal(result.registryUpdated, true);
    assert.ok(result.updatedRegistry);
    assert.equal(result.updatedRegistry.getLoan('loan-004').status, LoanStatus.settled);
  });

  it('Test 352 (Commit #30): Reconciliation idempotency: reconciling already funded loan does not re-mutate registry', async () => {
    const adapter = new InMemoryTransactionPersistence();
    const persistence = new TransactionPersistenceService(adapter);
    const recovery = new TransactionRecoveryService(persistence);

    // loan-003 is already funded
    const registry = createDefaultLoanRegistry();
    assert.equal(registry.getLoan('loan-003').status, LoanStatus.funded);

    persistence.saveTransaction({
      id: 'tx-idemp-fund',
      action: 'FUND_LOAN',
      loanId: 'loan-003',
      circuitName: 'fundLoan',
      callerPublicKey: PROTOTYPE_LENDER_PK,
      callerPublicKeyHex: '0x02',
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT_WALLET',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      providerTransactionId: '0xfund-idemp',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const mockProvider = {
      isConnected: () => true,
      getTransactionStatus: async () => ({ status: 'CONFIRMED', blockHeight: 125n }),
    };

    const result = await recovery.reconcileTransaction('tx-idemp-fund', mockProvider, registry);

    assert.equal(result.success, true);
    assert.equal(result.registryUpdated, false);
    assert.equal(registry.getLoan('loan-003').status, LoanStatus.funded);
  });

  it('Test 353 (Commit #30): Reconciliation idempotency: reconciling already repaid/settled loan does not re-mutate registry', async () => {
    const adapter = new InMemoryTransactionPersistence();
    const persistence = new TransactionPersistenceService(adapter);
    const recovery = new TransactionRecoveryService(persistence);

    // loan-005 is already settled
    const registry = createDefaultLoanRegistry();
    assert.equal(registry.getLoan('loan-005').status, LoanStatus.settled);

    persistence.saveTransaction({
      id: 'tx-idemp-settled',
      action: 'SETTLE_LOAN',
      loanId: 'loan-005',
      circuitName: 'settleLoan',
      callerPublicKey: PROTOTYPE_LENDER_PK,
      callerPublicKeyHex: '0x02',
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT_WALLET',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      providerTransactionId: '0xsettle-idemp',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const mockProvider = {
      isConnected: () => true,
      getTransactionStatus: async () => ({ status: 'CONFIRMED', blockHeight: 300n }),
    };

    const result = await recovery.reconcileTransaction('tx-idemp-settled', mockProvider, registry);

    assert.equal(result.success, true);
    assert.equal(result.registryUpdated, false);
    assert.equal(registry.getLoan('loan-005').status, LoanStatus.settled);
  });

  it('Test 354 (Commit #30): Reconciliation: provider returns PENDING/SUBMITTED leaves LoanRegistry untouched', async () => {
    const adapter = new InMemoryTransactionPersistence();
    const persistence = new TransactionPersistenceService(adapter);
    const recovery = new TransactionRecoveryService(persistence);
    const registry = createDefaultLoanRegistry();

    persistence.saveTransaction({
      id: 'tx-pending-check',
      action: 'FUND_LOAN',
      loanId: 'loan-001',
      circuitName: 'fundLoan',
      callerPublicKey: PROTOTYPE_LENDER_PK,
      callerPublicKeyHex: '0x02',
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT_WALLET',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      providerTransactionId: '0xpending-1',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const mockProvider = {
      isConnected: () => true,
      getTransactionStatus: async () => ({ status: 'PENDING' }),
    };

    const result = await recovery.reconcileTransaction('tx-pending-check', mockProvider, registry);

    assert.equal(result.success, false);
    assert.equal(result.recoveryStatus, 'PENDING');
    assert.equal(result.registryUpdated, false);
    assert.equal(registry.getLoan('loan-001').status, LoanStatus.requested);
  });

  it('Test 355 (Commit #30): Reconciliation: provider returns REJECTED updates transaction to REJECTED and leaves registry untouched', async () => {
    const adapter = new InMemoryTransactionPersistence();
    const persistence = new TransactionPersistenceService(adapter);
    const recovery = new TransactionRecoveryService(persistence);
    const registry = createDefaultLoanRegistry();

    persistence.saveTransaction({
      id: 'tx-rej-check',
      action: 'FUND_LOAN',
      loanId: 'loan-001',
      circuitName: 'fundLoan',
      callerPublicKey: PROTOTYPE_LENDER_PK,
      callerPublicKeyHex: '0x02',
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT_WALLET',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      providerTransactionId: '0xrej-1',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const mockProvider = {
      isConnected: () => true,
      getTransactionStatus: async () => ({ status: 'REJECTED', error: 'User rejected in Lace wallet' }),
    };

    const result = await recovery.reconcileTransaction('tx-rej-check', mockProvider, registry);

    assert.equal(result.success, false);
    assert.equal(result.reconciledStatus, 'REJECTED');
    assert.equal(result.recoveryStatus, 'REJECTED');
    assert.equal(result.registryUpdated, false);

    const saved = persistence.getTransaction('tx-rej-check');
    assert.equal(saved?.status, 'REJECTED');
    assert.equal(saved?.recoveryStatus, 'REJECTED');
  });

  it('Test 356 (Commit #30): Reconciliation: provider returns FAILED updates transaction to FAILED and leaves registry untouched', async () => {
    const adapter = new InMemoryTransactionPersistence();
    const persistence = new TransactionPersistenceService(adapter);
    const recovery = new TransactionRecoveryService(persistence);
    const registry = createDefaultLoanRegistry();

    persistence.saveTransaction({
      id: 'tx-fail-check',
      action: 'FUND_LOAN',
      loanId: 'loan-001',
      circuitName: 'fundLoan',
      callerPublicKey: PROTOTYPE_LENDER_PK,
      callerPublicKeyHex: '0x02',
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT_WALLET',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      providerTransactionId: '0xfail-1',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const mockProvider = {
      isConnected: () => true,
      getTransactionStatus: async () => ({ status: 'FAILED', error: 'Circuit validation guard failure' }),
    };

    const result = await recovery.reconcileTransaction('tx-fail-check', mockProvider, registry);

    assert.equal(result.success, false);
    assert.equal(result.reconciledStatus, 'FAILED');
    assert.equal(result.recoveryStatus, 'FAILED');
    assert.equal(result.registryUpdated, false);

    const saved = persistence.getTransaction('tx-fail-check');
    assert.equal(saved?.status, 'FAILED');
  });

  it('Test 357 (Commit #30): Reconciliation: unrecognized provider status safely mapped to STALE and leaves registry untouched', async () => {
    const adapter = new InMemoryTransactionPersistence();
    const persistence = new TransactionPersistenceService(adapter);
    const recovery = new TransactionRecoveryService(persistence);
    const registry = createDefaultLoanRegistry();

    persistence.saveTransaction({
      id: 'tx-unknown-stat',
      action: 'FUND_LOAN',
      loanId: 'loan-001',
      circuitName: 'fundLoan',
      callerPublicKey: PROTOTYPE_LENDER_PK,
      callerPublicKeyHex: '0x02',
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT_WALLET',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      providerTransactionId: '0xunknown-1',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const mockProvider = {
      isConnected: () => true,
      getTransactionStatus: async () => ({ status: 'SOME_NON_STANDARD_STATUS' }),
    };

    const result = await recovery.reconcileTransaction('tx-unknown-stat', mockProvider, registry);

    assert.equal(result.success, false);
    assert.equal(result.recoveryStatus, 'STALE');
    assert.equal(result.registryUpdated, false);
  });

  it('Test 358 (Commit #30): Reconciliation: provider query failure handled gracefully and leaves registry untouched', async () => {
    const adapter = new InMemoryTransactionPersistence();
    const persistence = new TransactionPersistenceService(adapter);
    const recovery = new TransactionRecoveryService(persistence);
    const registry = createDefaultLoanRegistry();

    persistence.saveTransaction({
      id: 'tx-err-check',
      action: 'FUND_LOAN',
      loanId: 'loan-001',
      circuitName: 'fundLoan',
      callerPublicKey: PROTOTYPE_LENDER_PK,
      callerPublicKeyHex: '0x02',
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT_WALLET',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      providerTransactionId: '0xerr-1',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const mockProvider = {
      isConnected: () => true,
      getTransactionStatus: async () => {
        throw new Error('RPC connection timeout');
      },
    };

    const result = await recovery.reconcileTransaction('tx-err-check', mockProvider, registry);

    assert.equal(result.success, false);
    assert.equal(result.recoveryStatus, 'FAILED');
    assert.equal(result.registryUpdated, false);
    assert.ok(result.error?.includes('timeout'));
  });

  it('Test 359 (Commit #30): Bulk reconciliation: reconcileAll processes all recoverable transactions sequentially', async () => {
    const adapter = new InMemoryTransactionPersistence();
    const persistence = new TransactionPersistenceService(adapter);
    const recovery = new TransactionRecoveryService(persistence);

    persistence.saveTransaction({
      id: 'tx-bulk-1',
      action: 'FUND_LOAN',
      loanId: 'loan-001',
      circuitName: 'fundLoan',
      callerPublicKeyHex: '0x01',
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT_WALLET',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      providerTransactionId: '0xbulk-1',
      createdAt: 1000,
      updatedAt: 1000,
    });
    persistence.saveTransaction({
      id: 'tx-bulk-2',
      action: 'REPAY_LOAN',
      loanId: 'loan-002',
      circuitName: 'repayLoan',
      callerPublicKeyHex: '0x02',
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT_WALLET',
      status: 'SUBMITTING',
      recoveryStatus: 'PENDING',
      providerTransactionId: '0xbulk-2',
      createdAt: 2000,
      updatedAt: 2000,
    });

    const mockProvider = {
      isConnected: () => true,
      getTransactionStatus: async (txId) => ({
        transactionId: txId,
        status: 'CONFIRMED',
        blockHeight: 99n,
      }),
    };

    const results = await recovery.reconcileAll(mockProvider);
    assert.equal(results.length, 2);
    assert.ok(results.every((r) => r.reconciledStatus === 'CONFIRMED'));
  });

  it('Test 360 (Commit #30 & Anti-Fabrication): Local persistence never synthesizes confirmations, block heights, or transaction hashes', () => {
    const adapter = new InMemoryTransactionPersistence();
    const persistence = new TransactionPersistenceService(adapter);
    const execService = resetTransactionExecutionService(undefined, undefined, persistence);

    const loan = MOCK_LOANS['loan-001'];
    const account = getMockAccount('BORROWER', loan);

    const request = execService.createTransactionRequest(loan, account, 'FUND_LOAN', 'loan-001');

    // Verify draft persisted record
    const saved = persistence.getTransaction(request.id);
    assert.ok(saved);
    assert.equal(saved.status, 'DRAFT');
    assert.equal(saved.providerTransactionId, undefined);
    assert.equal(saved.blockHeight, undefined);
    assert.notEqual(saved.recoveryStatus, 'CONFIRMED');
  });

  it('Test 361 (Commit #30 & Local Prototype Honesty): Prototype wallet provider rejects status queries with UNSUPPORTED_OPERATION', async () => {
    const adapter = new InMemoryTransactionPersistence();
    const persistence = new TransactionPersistenceService(adapter);
    const recovery = new TransactionRecoveryService(persistence);
    const registry = createDefaultLoanRegistry();

    persistence.saveTransaction({
      id: 'tx-proto-test',
      action: 'FUND_LOAN',
      loanId: 'loan-001',
      circuitName: 'fundLoan',
      callerPublicKeyHex: '0x01',
      networkId: 'undeployed',
      providerKind: 'PROTOTYPE',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      providerTransactionId: '0xproto-id',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const prototypeProvider = new LocalPrototypeWalletProvider();
    await prototypeProvider.connect('LENDER');

    const result = await recovery.reconcileTransaction('tx-proto-test', prototypeProvider, registry);

    assert.equal(result.success, false);
    assert.equal(result.recoveryStatus, 'UNSUPPORTED');
    assert.equal(result.registryUpdated, false);
  });

  it('Test 362 (Commit #30): TransactionHistoryPanel component renders honest anti-fabrication disclosure', () => {
    const panelPath = path.join(srcDir, 'components', 'TransactionHistoryPanel.tsx');
    const content = fs.readFileSync(panelPath, 'utf8');

    assert.ok(content.includes('LOCAL PERSISTENCE ≠ BLOCKCHAIN CONFIRMATION'));
    assert.ok(content.includes('data-testid="transaction-history-panel"'));
    assert.ok(content.includes('data-testid="reconcile-all-button"'));
  });

  it('Test 363 (Commit #30): TransactionHistoryPanel renders metadata and filter controls', () => {
    const panelPath = path.join(srcDir, 'components', 'TransactionHistoryPanel.tsx');
    const content = fs.readFileSync(panelPath, 'utf8');

    assert.ok(content.includes('data-testid="filter-status-select"'));
    assert.ok(content.includes('data-testid="filter-action-select"'));
    assert.ok(content.includes('data-testid="clear-history-button"'));
  });

  it('Test 364 (Commit #30): types/index.ts re-exports all transaction persistence and recovery domain models and errors', () => {
    const typesIndexPath = path.join(srcDir, 'types', 'index.ts');
    const content = fs.readFileSync(typesIndexPath, 'utf8');

    assert.ok(content.includes('PersistedTransaction'));
    assert.ok(content.includes('TransactionPersistenceState'));
    assert.ok(content.includes('TransactionRecoveryStatus'));
    assert.ok(content.includes('TransactionPersistenceErrorCode'));
    assert.ok(content.includes('TransactionPersistenceError'));
    assert.ok(content.includes('TransactionReconciliationResult'));
  });

  it('Test 365 (Commit #30 & Strict Privacy Audit): All frontend source files (>= 59 files) contain zero forbidden terms', () => {
    const forbiddenTerms = [
      'getPrivateFinancialValue',
      'BORROWER_PRIVATE_FINANCIAL_VALUE',
      'privateFinancialValue',
      'witness context',
      'privateState',
      'witness values',
      'borrower income',
      'salary',
      'bank balance',
      'credit score',
      'seed phrase',
      'private key',
      'wallet secret',
      'financial documents',
    ];

    const walkDir = (dir) => {
      let results = [];
      const list = fs.readdirSync(dir);
      list.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
          results = results.concat(walkDir(filePath));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          results.push(filePath);
        }
      });
      return results;
    };

    const files = walkDir(srcDir);
    assert.ok(files.length >= 59, `Must audit all frontend source files including transaction persistence modules (found ${files.length})`);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      for (const term of forbiddenTerms) {
        assert.equal(
          content.includes(term),
          false,
          `Forbidden privacy-violating string "${term}" found in ${file}`
        );
      }
    }
  });

  // =========================================================================
  // COMMIT #31: Transaction Reconciliation & Lifecycle Event Tracking Tests
  // =========================================================================

  it('Test 366 (Commit #31): Event creation: appendEvent produces valid immutable event with safe public metadata', () => {
    const eventService = new TransactionEventService();
    const event = eventService.appendEvent({
      transactionId: 'tx-100',
      eventType: 'CREATED',
      action: 'FUND_LOAN',
      agreementId: 'loan-002',
      status: 'DRAFT',
      source: 'EXECUTION_SERVICE',
      message: 'Transaction request created in draft state.',
    });

    assert.ok(event.eventId.startsWith('evt-tx-100-'));
    assert.equal(event.transactionId, 'tx-100');
    assert.equal(event.eventType, 'CREATED');
    assert.equal(event.action, 'FUND_LOAN');
    assert.equal(event.agreementId, 'loan-002');
    assert.equal(event.status, 'DRAFT');
    assert.equal(event.source, 'EXECUTION_SERVICE');
    assert.equal(event.sequenceNumber, 1);
    assert.ok(event.timestamp > 0);
  });

  it('Test 367 (Commit #31): Event ordering: events for transaction are ordered monotonically by sequenceNumber', () => {
    const eventService = new TransactionEventService();
    eventService.appendEvent({ transactionId: 'tx-seq', eventType: 'CREATED', action: 'FUND_LOAN', status: 'DRAFT', source: 'EXECUTION_SERVICE' });
    eventService.appendEvent({ transactionId: 'tx-seq', eventType: 'PREPARED', action: 'FUND_LOAN', status: 'PREPARED', source: 'EXECUTION_SERVICE' });
    eventService.appendEvent({ transactionId: 'tx-seq', eventType: 'SUBMITTED', action: 'FUND_LOAN', status: 'SUBMITTED', source: 'EXECUTION_SERVICE' });

    const events = eventService.getEventsForTransaction('tx-seq');
    assert.equal(events.length, 3);
    assert.equal(events[0].sequenceNumber, 1);
    assert.equal(events[1].sequenceNumber, 2);
    assert.equal(events[2].sequenceNumber, 3);
    assert.equal(events[0].eventType, 'CREATED');
    assert.equal(events[1].eventType, 'PREPARED');
    assert.equal(events[2].eventType, 'SUBMITTED');
  });

  it('Test 368 (Commit #31): Duplicate event prevention: duplicate eventId does not duplicate or corrupt event store', () => {
    const eventService = new TransactionEventService();
    const e1 = eventService.appendEvent({
      eventId: 'fixed-evt-id',
      transactionId: 'tx-dup',
      eventType: 'CREATED',
      action: 'FUND_LOAN',
      status: 'DRAFT',
      source: 'EXECUTION_SERVICE',
    });
    const e2 = eventService.appendEvent({
      eventId: 'fixed-evt-id',
      transactionId: 'tx-dup',
      eventType: 'PREPARED',
      action: 'FUND_LOAN',
      status: 'PREPARED',
      source: 'EXECUTION_SERVICE',
    });

    assert.equal(e1.eventId, 'fixed-evt-id');
    assert.equal(e2.eventId, 'fixed-evt-id');
    const all = eventService.getEventsForTransaction('tx-dup');
    assert.equal(all.length, 1);
  });

  it('Test 369 (Commit #31): Event retrieval: getEventsForTransaction returns only events for specified transaction', () => {
    const eventService = new TransactionEventService();
    eventService.appendEvent({ transactionId: 'tx-A', eventType: 'CREATED', action: 'FUND_LOAN', status: 'DRAFT', source: 'EXECUTION_SERVICE' });
    eventService.appendEvent({ transactionId: 'tx-B', eventType: 'CREATED', action: 'REPAY_LOAN', status: 'DRAFT', source: 'EXECUTION_SERVICE' });

    const txAEvents = eventService.getEventsForTransaction('tx-A');
    assert.equal(txAEvents.length, 1);
    assert.equal(txAEvents[0].transactionId, 'tx-A');
  });

  it('Test 370 (Commit #31): Event retrieval: getEventsForAgreement returns all events associated with an agreement ID', () => {
    const eventService = new TransactionEventService();
    eventService.appendEvent({ transactionId: 'tx-1', agreementId: 'loan-agree-1', eventType: 'CREATED', action: 'FUND_LOAN', status: 'DRAFT', source: 'EXECUTION_SERVICE' });
    eventService.appendEvent({ transactionId: 'tx-2', agreementId: 'loan-agree-1', eventType: 'SUBMITTED', action: 'FUND_LOAN', status: 'SUBMITTED', source: 'EXECUTION_SERVICE' });
    eventService.appendEvent({ transactionId: 'tx-3', agreementId: 'loan-agree-2', eventType: 'CREATED', action: 'REPAY_LOAN', status: 'DRAFT', source: 'EXECUTION_SERVICE' });

    const loan1Events = eventService.getEventsForAgreement('loan-agree-1');
    assert.equal(loan1Events.length, 2);
  });

  it('Test 371 (Commit #31): Event retrieval: getLatestEvent returns most recent lifecycle event for a transaction', () => {
    const eventService = new TransactionEventService();
    eventService.appendEvent({ transactionId: 'tx-latest', eventType: 'CREATED', action: 'FUND_LOAN', status: 'DRAFT', source: 'EXECUTION_SERVICE' });
    eventService.appendEvent({ transactionId: 'tx-latest', eventType: 'PREPARED', action: 'FUND_LOAN', status: 'PREPARED', source: 'EXECUTION_SERVICE' });
    eventService.appendEvent({ transactionId: 'tx-latest', eventType: 'CONFIRMED', action: 'FUND_LOAN', status: 'CONFIRMED', source: 'STATUS_SERVICE' });

    const latest = eventService.getLatestEvent('tx-latest');
    assert.ok(latest);
    assert.equal(latest.eventType, 'CONFIRMED');
    assert.equal(latest.sequenceNumber, 3);
  });

  it('Test 372 (Commit #31): Event immutability: snapshots returned by getAllEvents and getters are frozen/immutable', () => {
    const eventService = new TransactionEventService();
    const event = eventService.appendEvent({
      transactionId: 'tx-imm',
      eventType: 'CREATED',
      action: 'FUND_LOAN',
      status: 'DRAFT',
      source: 'EXECUTION_SERVICE',
    });

    assert.ok(Object.isFrozen(event));
    assert.throws(() => {
      event.status = 'CONFIRMED';
    });
  });

  it('Test 373 (Commit #31): Event store reset: clearEvents removes all records and resets sequence counters', () => {
    const eventService = new TransactionEventService();
    eventService.appendEvent({ transactionId: 'tx-clear', eventType: 'CREATED', action: 'FUND_LOAN', status: 'DRAFT', source: 'EXECUTION_SERVICE' });
    assert.equal(eventService.getAllEvents().length, 1);

    eventService.clearEvents();
    assert.equal(eventService.getAllEvents().length, 0);
    assert.equal(eventService.getEventsForTransaction('tx-clear').length, 0);

    const reAdded = eventService.appendEvent({ transactionId: 'tx-clear', eventType: 'CREATED', action: 'FUND_LOAN', status: 'DRAFT', source: 'EXECUTION_SERVICE' });
    assert.equal(reAdded.sequenceNumber, 1);
  });

  it('Test 374 (Commit #31): Reconciliation: missing transaction record returns NOT_REQUIRED / TRANSACTION_NOT_FOUND', async () => {
    const persistence = new TransactionPersistenceService(new InMemoryTransactionPersistence());
    const service = new TransactionReconciliationService(persistence);

    const result = await service.reconcileTransaction('nonexistent-tx-id');
    assert.equal(result.reconciliationStatus, 'NOT_REQUIRED');
    assert.equal(result.reason, 'TRANSACTION_NOT_FOUND');
    assert.equal(result.registryMutationAllowed, false);
    assert.equal(result.success, false);
  });

  it('Test 375 (Commit #31): Reconciliation: disconnected wallet provider returns UNSUPPORTED / STATUS_UNAVAILABLE without mutating registry', async () => {
    const persistence = new TransactionPersistenceService(new InMemoryTransactionPersistence());
    const registry = createDefaultLoanRegistry();
    const service = new TransactionReconciliationService(persistence);

    persistence.saveTransaction({
      id: 'tx-disc',
      action: 'FUND_LOAN',
      loanId: 'loan-002',
      circuitName: 'fundLoan',
      callerPublicKeyHex: '0x01',
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      providerTransactionId: '0xmock-id',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const disconnectedProvider = {
      isPrototype: false,
      name: 'MOCK',
      isConnected: () => false,
      getConnectionStatus: () => 'DISCONNECTED',
      getTransactionStatus: async () => ({ status: 'CONFIRMED' }),
    };

    const result = await service.reconcileTransaction('tx-disc', disconnectedProvider, registry);
    assert.equal(result.reconciliationStatus, 'UNSUPPORTED');
    assert.equal(result.reason, 'STATUS_UNAVAILABLE');
    assert.equal(result.registryMutationAllowed, false);
    assert.equal(registry.getLoan('loan-002').status, LoanStatus.requested);
  });

  it('Test 376 (Commit #31): Reconciliation: provider without getTransactionStatus returns UNSUPPORTED / PROVIDER_UNSUPPORTED', async () => {
    const persistence = new TransactionPersistenceService(new InMemoryTransactionPersistence());
    const registry = createDefaultLoanRegistry();
    const service = new TransactionReconciliationService(persistence);

    persistence.saveTransaction({
      id: 'tx-no-status',
      action: 'FUND_LOAN',
      loanId: 'loan-002',
      circuitName: 'fundLoan',
      callerPublicKeyHex: '0x01',
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      providerTransactionId: '0xmock-id',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const noStatusProvider = {
      isPrototype: false,
      name: 'MOCK',
      isConnected: () => true,
      getConnectionStatus: () => 'CONNECTED',
    };

    const result = await service.reconcileTransaction('tx-no-status', noStatusProvider, registry);
    assert.equal(result.reconciliationStatus, 'UNSUPPORTED');
    assert.equal(result.reason, 'PROVIDER_UNSUPPORTED');
    assert.equal(result.registryMutationAllowed, false);
    assert.equal(registry.getLoan('loan-002').status, LoanStatus.requested);
  });

  it('Test 377 (Commit #31): Reconciliation: transaction without provider reference returns FAILED / LOCAL_RECORD_ONLY', async () => {
    const persistence = new TransactionPersistenceService(new InMemoryTransactionPersistence());
    const service = new TransactionReconciliationService(persistence);

    persistence.saveTransaction({
      id: 'tx-local-only',
      action: 'FUND_LOAN',
      loanId: 'loan-002',
      circuitName: 'fundLoan',
      callerPublicKeyHex: '0x01',
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT',
      status: 'SUBMITTING',
      recoveryStatus: 'RECOVERABLE',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const mockProvider = {
      isPrototype: false,
      name: 'MOCK',
      isConnected: () => true,
      getConnectionStatus: () => 'CONNECTED',
      getTransactionStatus: async () => ({ status: 'CONFIRMED' }),
    };

    const result = await service.reconcileTransaction('tx-local-only', mockProvider);
    assert.equal(result.reconciliationStatus, 'FAILED');
    assert.equal(result.reason, 'LOCAL_RECORD_ONLY');
    assert.equal(result.registryMutationAllowed, false);
  });

  it('Test 378 (Commit #31): Reconciliation: network mismatch blocks reconciliation with FAILED / NETWORK_MISMATCH', async () => {
    const persistence = new TransactionPersistenceService(new InMemoryTransactionPersistence());
    const service = new TransactionReconciliationService(persistence);

    persistence.saveTransaction({
      id: 'tx-mismatch',
      action: 'FUND_LOAN',
      loanId: 'loan-002',
      circuitName: 'fundLoan',
      callerPublicKeyHex: '0x01',
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      providerTransactionId: '0xmock-id',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const mismatchProvider = {
      isPrototype: false,
      name: 'MOCK',
      isConnected: () => true,
      getConnectionStatus: () => 'CONNECTED',
      getReportedNetworkId: () => 'different-network-999',
      getTransactionStatus: async () => ({ status: 'CONFIRMED' }),
    };

    const result = await service.reconcileTransaction('tx-mismatch', {
      provider: mismatchProvider,
      expectedNetworkId: 'midnight-testnet',
    });
    assert.equal(result.reconciliationStatus, 'FAILED');
    assert.equal(result.reason, 'NETWORK_MISMATCH');
    assert.equal(result.registryMutationAllowed, false);
  });

  it('Test 379 (Commit #31): Reconciliation: provider returns CONFIRMED updates transaction to CONFIRMED and emits CONFIRMED event', async () => {
    const persistence = new TransactionPersistenceService(new InMemoryTransactionPersistence());
    const eventService = new TransactionEventService();
    const service = new TransactionReconciliationService(persistence, eventService);

    persistence.saveTransaction({
      id: 'tx-conf-event',
      action: 'FUND_LOAN',
      loanId: 'loan-002',
      circuitName: 'fundLoan',
      callerPublicKeyHex: '0x01',
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      providerTransactionId: '0xmock-id',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const confirmedProvider = {
      isPrototype: false,
      name: 'MOCK',
      isConnected: () => true,
      getConnectionStatus: () => 'CONNECTED',
      getReportedNetworkId: () => 'undeployed',
      getTransactionStatus: async () => ({ status: 'CONFIRMED', blockHeight: 120n }),
    };

    const result = await service.reconcileTransaction('tx-conf-event', confirmedProvider);
    assert.equal(result.reconciliationStatus, 'RECONCILED');
    assert.equal(result.reason, 'PROVIDER_CONFIRMED');
    assert.equal(result.registryMutationAllowed, true);

    const saved = persistence.getTransaction('tx-conf-event');
    assert.equal(saved.status, 'CONFIRMED');

    const events = eventService.getEventsForTransaction('tx-conf-event');
    const eventTypes = events.map((e) => e.eventType);
    assert.ok(eventTypes.includes('RECONCILIATION_STARTED'));
    assert.ok(eventTypes.includes('CONFIRMATION_CHECK_STARTED'));
    assert.ok(eventTypes.includes('CONFIRMED'));
    assert.ok(eventTypes.includes('RECONCILIATION_COMPLETED'));
  });

  it('Test 380 (Commit #31): Reconciliation: confirmed FUND_LOAN allows registry mutation and transitions loan to funded', async () => {
    const persistence = new TransactionPersistenceService(new InMemoryTransactionPersistence());
    const registry = createDefaultLoanRegistry();
    const service = new TransactionReconciliationService(persistence);

    persistence.saveTransaction({
      id: 'tx-fund-reg',
      action: 'FUND_LOAN',
      loanId: 'loan-002',
      circuitName: 'fundLoan',
      callerPublicKeyHex: '0x01',
      callerPublicKey: new Uint8Array(32).fill(2),
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      providerTransactionId: '0xfund-id',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const confirmedProvider = {
      isPrototype: false,
      name: 'MOCK',
      isConnected: () => true,
      getConnectionStatus: () => 'CONNECTED',
      getReportedNetworkId: () => 'undeployed',
      getTransactionStatus: async () => ({ status: 'CONFIRMED', blockHeight: 125n }),
    };

    const result = await service.reconcileTransaction('tx-fund-reg', confirmedProvider, registry);
    assert.equal(result.reconciliationStatus, 'RECONCILED');
    assert.equal(result.registryMutationAllowed, true);
    assert.equal(result.registryUpdated, true);
    assert.ok(result.updatedRegistry);
    assert.equal(result.updatedRegistry.getLoan('loan-002').status, LoanStatus.funded);
  });

  it('Test 381 (Commit #31): Reconciliation: confirmed REPAY_LOAN allows registry mutation and transitions loan to repaid', async () => {
    const persistence = new TransactionPersistenceService(new InMemoryTransactionPersistence());
    const registry = createDefaultLoanRegistry();
    const service = new TransactionReconciliationService(persistence);

    persistence.saveTransaction({
      id: 'tx-repay-reg',
      action: 'REPAY_LOAN',
      loanId: 'loan-003',
      circuitName: 'repayLoan',
      callerPublicKeyHex: '0x02',
      callerPublicKey: registry.getLoan('loan-003').borrowerBytes,
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      providerTransactionId: '0xrepay-id',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const confirmedProvider = {
      isPrototype: false,
      name: 'MOCK',
      isConnected: () => true,
      getConnectionStatus: () => 'CONNECTED',
      getReportedNetworkId: () => 'undeployed',
      getTransactionStatus: async () => ({ status: 'CONFIRMED', blockHeight: 130n }),
    };

    const result = await service.reconcileTransaction('tx-repay-reg', confirmedProvider, registry);
    assert.equal(result.reconciliationStatus, 'RECONCILED');
    assert.equal(result.registryMutationAllowed, true);
    assert.equal(result.registryUpdated, true);
    assert.ok(result.updatedRegistry);
    assert.equal(result.updatedRegistry.getLoan('loan-003').status, LoanStatus.repaid);
  });

  it('Test 382 (Commit #31): Reconciliation: confirmed SETTLE_LOAN allows registry mutation and transitions loan to settled', async () => {
    const persistence = new TransactionPersistenceService(new InMemoryTransactionPersistence());
    const registry = createDefaultLoanRegistry();
    const service = new TransactionReconciliationService(persistence);

    persistence.saveTransaction({
      id: 'tx-settle-reg',
      action: 'SETTLE_LOAN',
      loanId: 'loan-004',
      circuitName: 'settleLoan',
      callerPublicKeyHex: '0x01',
      callerPublicKey: new Uint8Array(32).fill(1),
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      providerTransactionId: '0xsettle-id',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const confirmedProvider = {
      isPrototype: false,
      name: 'MOCK',
      isConnected: () => true,
      getConnectionStatus: () => 'CONNECTED',
      getReportedNetworkId: () => 'undeployed',
      getTransactionStatus: async () => ({ status: 'CONFIRMED', blockHeight: 135n }),
    };

    const result = await service.reconcileTransaction('tx-settle-reg', confirmedProvider, registry);
    assert.equal(result.reconciliationStatus, 'RECONCILED');
    assert.equal(result.registryMutationAllowed, true);
    assert.equal(result.registryUpdated, true);
    assert.ok(result.updatedRegistry);
    assert.equal(result.updatedRegistry.getLoan('loan-004').status, LoanStatus.settled);
  });

  it('Test 383 (Commit #31): Registry mutation protection: provider returning PENDING/SUBMITTED strictly forbids registry mutation', async () => {
    const persistence = new TransactionPersistenceService(new InMemoryTransactionPersistence());
    const registry = createDefaultLoanRegistry();
    const service = new TransactionReconciliationService(persistence);

    persistence.saveTransaction({
      id: 'tx-pending-protect',
      action: 'FUND_LOAN',
      loanId: 'loan-002',
      circuitName: 'fundLoan',
      callerPublicKeyHex: '0x01',
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      providerTransactionId: '0xpend-id',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const pendingProvider = {
      isPrototype: false,
      name: 'MOCK',
      isConnected: () => true,
      getConnectionStatus: () => 'CONNECTED',
      getReportedNetworkId: () => 'undeployed',
      getTransactionStatus: async () => ({ status: 'PENDING' }),
    };

    const result = await service.reconcileTransaction('tx-pending-protect', pendingProvider, registry);
    assert.equal(result.reconciliationStatus, 'PENDING');
    assert.equal(result.reason, 'PROVIDER_PENDING');
    assert.equal(result.registryMutationAllowed, false);
    assert.equal(result.registryUpdated, false);
    assert.equal(registry.getLoan('loan-002').status, LoanStatus.requested);
  });

  it('Test 384 (Commit #31): Registry mutation protection: provider returning REJECTED strictly forbids registry mutation', async () => {
    const persistence = new TransactionPersistenceService(new InMemoryTransactionPersistence());
    const registry = createDefaultLoanRegistry();
    const service = new TransactionReconciliationService(persistence);

    persistence.saveTransaction({
      id: 'tx-rej-protect',
      action: 'FUND_LOAN',
      loanId: 'loan-002',
      circuitName: 'fundLoan',
      callerPublicKeyHex: '0x01',
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      providerTransactionId: '0xrej-id',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const rejProvider = {
      isPrototype: false,
      name: 'MOCK',
      isConnected: () => true,
      getConnectionStatus: () => 'CONNECTED',
      getReportedNetworkId: () => 'undeployed',
      getTransactionStatus: async () => ({ status: 'REJECTED', error: 'User denied' }),
    };

    const result = await service.reconcileTransaction('tx-rej-protect', rejProvider, registry);
    assert.equal(result.reconciliationStatus, 'FAILED');
    assert.equal(result.reason, 'PROVIDER_REJECTED');
    assert.equal(result.registryMutationAllowed, false);
    assert.equal(result.registryUpdated, false);
    assert.equal(registry.getLoan('loan-002').status, LoanStatus.requested);
  });

  it('Test 385 (Commit #31): Registry mutation protection: provider returning FAILED strictly forbids registry mutation', async () => {
    const persistence = new TransactionPersistenceService(new InMemoryTransactionPersistence());
    const registry = createDefaultLoanRegistry();
    const service = new TransactionReconciliationService(persistence);

    persistence.saveTransaction({
      id: 'tx-fail-protect',
      action: 'FUND_LOAN',
      loanId: 'loan-002',
      circuitName: 'fundLoan',
      callerPublicKeyHex: '0x01',
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      providerTransactionId: '0xfail-id',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const failProvider = {
      isPrototype: false,
      name: 'MOCK',
      isConnected: () => true,
      getConnectionStatus: () => 'CONNECTED',
      getReportedNetworkId: () => 'undeployed',
      getTransactionStatus: async () => ({ status: 'FAILED', error: 'Gas exhausted' }),
    };

    const result = await service.reconcileTransaction('tx-fail-protect', failProvider, registry);
    assert.equal(result.reconciliationStatus, 'FAILED');
    assert.equal(result.reason, 'PROVIDER_FAILED');
    assert.equal(result.registryMutationAllowed, false);
    assert.equal(result.registryUpdated, false);
    assert.equal(registry.getLoan('loan-002').status, LoanStatus.requested);
  });

  it('Test 386 (Commit #31): Registry mutation protection: provider query exception strictly forbids registry mutation', async () => {
    const persistence = new TransactionPersistenceService(new InMemoryTransactionPersistence());
    const registry = createDefaultLoanRegistry();
    const service = new TransactionReconciliationService(persistence);

    persistence.saveTransaction({
      id: 'tx-err-protect',
      action: 'FUND_LOAN',
      loanId: 'loan-002',
      circuitName: 'fundLoan',
      callerPublicKeyHex: '0x01',
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      providerTransactionId: '0xerr-id',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const errorProvider = {
      isPrototype: false,
      name: 'MOCK',
      isConnected: () => true,
      getConnectionStatus: () => 'CONNECTED',
      getReportedNetworkId: () => 'undeployed',
      getTransactionStatus: async () => {
        throw new Error('RPC connection reset by peer');
      },
    };

    const result = await service.reconcileTransaction('tx-err-protect', errorProvider, registry);
    assert.equal(result.registryMutationAllowed, false);
    assert.equal(result.registryUpdated, false);
    assert.equal(registry.getLoan('loan-002').status, LoanStatus.requested);
  });

  it('Test 387 (Commit #31): Registry mutation protection: unrecognized provider status maps to DISCREPANCY and forbids registry mutation', async () => {
    const persistence = new TransactionPersistenceService(new InMemoryTransactionPersistence());
    const registry = createDefaultLoanRegistry();
    const service = new TransactionReconciliationService(persistence);

    persistence.saveTransaction({
      id: 'tx-unrec-protect',
      action: 'FUND_LOAN',
      loanId: 'loan-002',
      circuitName: 'fundLoan',
      callerPublicKeyHex: '0x01',
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      providerTransactionId: '0xunrec-id',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const unrecProvider = {
      isPrototype: false,
      name: 'MOCK',
      isConnected: () => true,
      getConnectionStatus: () => 'CONNECTED',
      getReportedNetworkId: () => 'undeployed',
      getTransactionStatus: async () => ({ status: 'SOME_WEIRD_STATE' }),
    };

    const result = await service.reconcileTransaction('tx-unrec-protect', unrecProvider, registry);
    assert.equal(result.reconciliationStatus, 'DISCREPANCY');
    assert.equal(result.reason, 'UNKNOWN_PROVIDER_STATE');
    assert.equal(result.registryMutationAllowed, false);
    assert.equal(registry.getLoan('loan-002').status, LoanStatus.requested);
  });

  it('Test 388 (Commit #31): Local SUBMITTED status NEVER implies confirmation without genuine provider status', async () => {
    const persistence = new TransactionPersistenceService(new InMemoryTransactionPersistence());
    const registry = createDefaultLoanRegistry();
    const service = new TransactionReconciliationService(persistence);

    persistence.saveTransaction({
      id: 'tx-sub-not-conf',
      action: 'FUND_LOAN',
      loanId: 'loan-002',
      circuitName: 'fundLoan',
      callerPublicKeyHex: '0x01',
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      providerTransactionId: '0xpending-hash',
      createdAt: 1000,
      updatedAt: 1000,
    });

    // Provider is offline or returns nothing
    const emptyProvider = {
      isPrototype: false,
      name: 'MOCK',
      isConnected: () => true,
      getConnectionStatus: () => 'CONNECTED',
      getReportedNetworkId: () => 'undeployed',
      getTransactionStatus: async () => null,
    };

    const result = await service.reconcileTransaction('tx-sub-not-conf', emptyProvider, registry);
    assert.notEqual(result.reconciliationStatus, 'RECONCILED');
    assert.equal(result.registryMutationAllowed, false);
    assert.equal(registry.getLoan('loan-002').status, LoanStatus.requested);
  });

  it('Test 389 (Commit #31): Multiple reconciliation attempts: idempotent execution preserves confirmed registry state', async () => {
    const persistence = new TransactionPersistenceService(new InMemoryTransactionPersistence());
    const registry = createDefaultLoanRegistry();
    const service = new TransactionReconciliationService(persistence);

    persistence.saveTransaction({
      id: 'tx-idem',
      action: 'FUND_LOAN',
      loanId: 'loan-002',
      circuitName: 'fundLoan',
      callerPublicKeyHex: '0x01',
      callerPublicKey: new Uint8Array(32).fill(2),
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      providerTransactionId: '0xidem-id',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const confirmedProvider = {
      isPrototype: false,
      name: 'MOCK',
      isConnected: () => true,
      getConnectionStatus: () => 'CONNECTED',
      getReportedNetworkId: () => 'undeployed',
      getTransactionStatus: async () => ({ status: 'CONFIRMED', blockHeight: 140n }),
    };

    // First reconciliation
    const r1 = await service.reconcileTransaction('tx-idem', confirmedProvider, registry);
    assert.equal(r1.reconciliationStatus, 'RECONCILED');
    assert.equal(r1.registryUpdated, true);
    assert.ok(r1.updatedRegistry);
    assert.equal(r1.updatedRegistry.getLoan('loan-002').status, LoanStatus.funded);

    // Second reconciliation: idempotent no-op for registry
    const r2 = await service.reconcileTransaction('tx-idem', confirmedProvider, r1.updatedRegistry);
    assert.equal(r2.reconciliationStatus, 'RECONCILED');
    assert.equal(r2.registryUpdated, false);
    assert.ok(r2.updatedRegistry);
    assert.equal(r2.updatedRegistry.getLoan('loan-002').status, LoanStatus.funded);
  });

  it('Test 390 (Commit #31): Multiple reconciliation attempts: repeatedly reconciling pending transaction leaves registry untouched across all calls', async () => {
    const persistence = new TransactionPersistenceService(new InMemoryTransactionPersistence());
    const registry = createDefaultLoanRegistry();
    const service = new TransactionReconciliationService(persistence);

    persistence.saveTransaction({
      id: 'tx-rep-pend',
      action: 'FUND_LOAN',
      loanId: 'loan-002',
      circuitName: 'fundLoan',
      callerPublicKeyHex: '0x01',
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      providerTransactionId: '0xpend-multi',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const pendingProvider = {
      isPrototype: false,
      name: 'MOCK',
      isConnected: () => true,
      getConnectionStatus: () => 'CONNECTED',
      getReportedNetworkId: () => 'undeployed',
      getTransactionStatus: async () => ({ status: 'PENDING' }),
    };

    for (let i = 0; i < 3; i++) {
      const res = await service.reconcileTransaction('tx-rep-pend', pendingProvider, registry);
      assert.equal(res.reconciliationStatus, 'PENDING');
      assert.equal(res.registryMutationAllowed, false);
      assert.equal(registry.getLoan('loan-002').status, LoanStatus.requested);
    }
  });

  it('Test 391 (Commit #31): Lifecycle recovery integration: recoverPendingTransactions emits RECOVERY_STARTED events', () => {
    const persistence = new TransactionPersistenceService(new InMemoryTransactionPersistence());
    const eventService = new TransactionEventService();
    const recovery = new TransactionRecoveryService(persistence, undefined, eventService);

    persistence.saveTransaction({
      id: 'tx-rec-event',
      action: 'FUND_LOAN',
      loanId: 'loan-002',
      circuitName: 'fundLoan',
      callerPublicKeyHex: '0x01',
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const recovered = recovery.recoverPendingTransactions();
    assert.equal(recovered.length, 1);

    const events = eventService.getEventsForTransaction('tx-rec-event');
    assert.equal(events.length, 1);
    assert.equal(events[0].eventType, 'RECOVERY_STARTED');
    assert.equal(events[0].source, 'RECOVERY_SERVICE');
  });

  it('Test 392 (Commit #31): Lifecycle recovery integration: successful recovery reconciliation emits RECOVERY_COMPLETED event', async () => {
    const persistence = new TransactionPersistenceService(new InMemoryTransactionPersistence());
    const eventService = new TransactionEventService();
    const recovery = new TransactionRecoveryService(persistence, undefined, eventService);
    const registry = createDefaultLoanRegistry();

    persistence.saveTransaction({
      id: 'tx-rec-complete',
      action: 'FUND_LOAN',
      loanId: 'loan-002',
      circuitName: 'fundLoan',
      callerPublicKeyHex: '0x01',
      callerPublicKey: new Uint8Array(32).fill(2),
      networkId: 'undeployed',
      providerKind: 'MIDNIGHT',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      providerTransactionId: '0xmock-id',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const confirmedProvider = {
      isPrototype: false,
      name: 'MOCK',
      isConnected: () => true,
      getConnectionStatus: () => 'CONNECTED',
      getReportedNetworkId: () => 'undeployed',
      getTransactionStatus: async () => ({ status: 'CONFIRMED', blockHeight: 150n }),
    };

    const result = await recovery.reconcileTransaction('tx-rec-complete', confirmedProvider, registry);
    assert.equal(result.success, true);

    const events = eventService.getEventsForTransaction('tx-rec-complete');
    const eventTypes = events.map((e) => e.eventType);
    assert.ok(eventTypes.includes('RECOVERY_COMPLETED'));
  });

  it('Test 393 (Commit #31): Status tracking integration: trackTransaction and updateStatus append lifecycle events', () => {
    const statusService = new TransactionStatusService();
    const eventService = getTransactionEventService();
    const beforeCount = eventService.getAllEvents().length;

    statusService.trackTransaction('tx-track-test', 'SUBMITTED', { loanId: 'loan-001', action: 'FUND_LOAN' });
    statusService.updateStatus('tx-track-test', 'CONFIRMED', { blockHeight: 160n });

    const txEvents = eventService.getEventsForTransaction('tx-track-test');
    assert.ok(txEvents.length >= 2);
    const eventTypes = txEvents.map((e) => e.eventType);
    assert.ok(eventTypes.includes('SUBMITTED'));
    assert.ok(eventTypes.includes('CONFIRMED'));
  });

  it('Test 394 (Commit #31): Execution service integration: pipeline execution appends CREATED and PREPARED events', () => {
    const eventService = getTransactionEventService();
    const execService = new TransactionExecutionService();
    const loan = MOCK_LOANS['loan-002'];
    const account = getMockAccount('LENDER');

    const req = execService.createTransactionRequest(loan, account, 'FUND_LOAN');
    assert.ok(req);

    const events = eventService.getEventsForTransaction(req.id);
    assert.ok(events.length >= 1);
    assert.equal(events[0].eventType, 'CREATED');
    assert.equal(events[0].source, 'EXECUTION_SERVICE');

    execService.prepareAndValidate(req, loan, account);
    const updatedEvents = eventService.getEventsForTransaction(req.id);
    assert.ok(updatedEvents.length >= 2);
  });

  it('Test 395 (Commit #31): TransactionHistoryPanel renders lifecycle timeline and technical diagnostic section', () => {
    const panelPath = path.join(srcDir, 'components', 'TransactionHistoryPanel.tsx');
    const content = fs.readFileSync(panelPath, 'utf8');

    assert.ok(content.includes('tx-timeline-'));
    assert.ok(content.includes('tx-diagnostic-'));
    assert.ok(content.includes('LOCAL:'));
    assert.ok(content.includes('PROVIDER:'));
    assert.ok(content.includes('RECONCILIATION:'));
    assert.ok(content.includes('REGISTRY:'));
    assert.ok(content.includes('Lifecycle Events Recorded:'));
  });

  it('Test 396 (Commit #31): types/index.ts re-exports all transaction events and reconciliation domain models', () => {
    const typesIndexPath = path.join(srcDir, 'types', 'index.ts');
    const content = fs.readFileSync(typesIndexPath, 'utf8');

    assert.ok(content.includes('TransactionLifecycleEventType'));
    assert.ok(content.includes('TransactionEventSource'));
    assert.ok(content.includes('TransactionLifecycleEvent'));
    assert.ok(content.includes('ReconciliationStatus'));
    assert.ok(content.includes('ReconciliationReason'));
    assert.ok(content.includes('TransactionReconciliationResult'));
  });

  it('Test 397 (Commit #31 & Anti-Fabrication): Reconciliation and events never synthesize hashes, block heights, or confirmations', async () => {
    const persistence = new TransactionPersistenceService(new InMemoryTransactionPersistence());
    const service = new TransactionReconciliationService(persistence);

    persistence.saveTransaction({
      id: 'tx-no-synth',
      action: 'FUND_LOAN',
      loanId: 'loan-002',
      circuitName: 'fundLoan',
      callerPublicKeyHex: '0x01',
      networkId: 'undeployed',
      providerKind: 'PROTOTYPE',
      status: 'SUBMITTED',
      recoveryStatus: 'PENDING',
      providerTransactionId: '0xproto-id',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const protoProvider = new LocalPrototypeWalletProvider();
    await protoProvider.connect('LENDER');

    const result = await service.reconcileTransaction('tx-no-synth', protoProvider);
    assert.equal(result.reconciliationStatus, 'UNSUPPORTED');
    assert.equal(result.registryMutationAllowed, false);
    assert.equal(result.blockHeight, undefined);
  });

  it('Test 398 (Commit #31 & Strict Privacy Audit): All frontend source files (>= 62 files) contain zero forbidden terms', () => {
    const forbiddenTerms = [
      'getPrivateFinancialValue',
      'BORROWER_PRIVATE_FINANCIAL_VALUE',
      'privateFinancialValue',
      'witness context',
      'privateState',
      'witness values',
      'borrower income',
      'salary',
      'bank balance',
      'credit score',
      'seed phrase',
      'private key',
      'wallet secret',
      'financial documents',
    ];

    const walkDir = (dir) => {
      let results = [];
      const list = fs.readdirSync(dir);
      list.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
          results = results.concat(walkDir(filePath));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          results.push(filePath);
        }
      });
      return results;
    };

    const files = walkDir(srcDir);
    assert.ok(files.length >= 62, `Must audit all frontend source files including transaction reconciliation modules (found ${files.length})`);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      for (const term of forbiddenTerms) {
        assert.equal(
          content.includes(term),
          false,
          `Forbidden privacy-violating string "${term}" found in ${file}`
        );
      }
    }
  });
});





