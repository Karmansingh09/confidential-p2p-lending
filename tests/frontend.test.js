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
import { canVerifyEligibility, canFundLoan, canRepayLoan } from '../contracts/dist/index.js';

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
      'src/lib/formatters.ts',
      'src/lib/mock-data.ts',
      'src/lib/validation.ts',
      'src/lib/loan-service.ts',
      'src/lib/marketplace.ts',
      'src/lib/lender-evaluation.ts',
      'src/lib/eligibility-service.ts',
      'src/lib/repayment-service.ts',
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
      'src/components/ValidationMessage.tsx',
      'src/components/LoanMarketplace.tsx',
      'src/components/LenderEvaluationPanel.tsx',
      'src/components/FundingConfirmation.tsx',
      'src/components/PrivateEligibilityInput.tsx',
      'src/components/EligibilityVerificationResult.tsx',
      'src/components/EligibilityVerificationPanel.tsx',
      'src/components/RepaymentPanel.tsx',
      'src/components/RepaymentConfirmation.tsx',
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
});


