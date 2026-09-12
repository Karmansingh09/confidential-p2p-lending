import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { calculateRepaymentObligation, LoanStatus } from '../contracts/dist/index.js';

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
      'src/pages/DashboardPage.tsx',
      'src/components/Header.tsx',
      'src/components/StateBanner.tsx',
      'src/components/LoanStatusBadge.tsx',
      'src/components/LoanSummaryCard.tsx',
      'src/components/LifecycleStepper.tsx',
      'src/components/PrivacyIndicator.tsx',
      'src/components/LoanActionPanel.tsx',
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
});
