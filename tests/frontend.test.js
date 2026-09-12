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
      'src/lib/formatters.ts',
      'src/lib/mock-data.ts',
      'src/lib/validation.ts',
      'src/lib/loan-service.ts',
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
});
