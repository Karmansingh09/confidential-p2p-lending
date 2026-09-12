export interface LoanRequestFormValues {
  principalAmount: string;
  interestRatePercent: string;
  durationBlocks: string;
  eligibilityThreshold: string;
}

export interface LoanRequestFormErrors {
  principalAmount?: string;
  interestRatePercent?: string;
  durationBlocks?: string;
  eligibilityThreshold?: string;
  general?: string;
}

export interface ValidatedLoanRequestData {
  principalAmount: bigint;
  interestRateBasisPoints: bigint;
  durationBlocks: bigint;
  eligibilityThreshold: bigint;
}

/**
 * Safely parses a percentage string (e.g. "5", "5.00", "7.5", "0.01") into integer basis points.
 * 1% = 100 basis points (bps). 0.01% = 1 bp. 100% = 10,000 bps.
 * Avoids all floating-point precision hazards by using integer arithmetic.
 */
export function parsePercentageToBasisPoints(input: string): {
  bps: bigint | null;
  error?: string;
} {
  const cleaned = input.trim().replace(/%$/, '').trim();
  if (!cleaned) {
    return { bps: null, error: 'Interest rate is required.' };
  }

  // Allow integer or decimal with up to 2 decimal places
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    return {
      bps: null,
      error: 'Enter a valid percentage with up to 2 decimal places (e.g., 5.00 or 7.5).',
    };
  }

  const [wholePart, fracPart = ''] = cleaned.split('.');
  const paddedFrac = fracPart.padEnd(2, '0');

  const bps = BigInt(wholePart) * 100n + BigInt(paddedFrac);

  if (bps <= 0n) {
    return {
      bps: null,
      error: 'Interest rate must be greater than 0% (at least 0.01% / 1 basis point).',
    };
  }

  if (bps > 10000n) {
    return {
      bps: null,
      error: 'Interest rate cannot exceed 100.00% (10,000 basis points).',
    };
  }

  return { bps };
}

/**
 * Formats basis points back into a human-readable percentage string.
 * Example: 500n -> "5.00%"
 */
export function basisPointsToPercentage(bps: bigint): string {
  const whole = bps / 100n;
  const frac = (bps % 100n).toString().padStart(2, '0');
  return `${whole}.${frac}%`;
}

/**
 * Validates all public loan request form fields according to protocol constraints.
 */
export function validateLoanRequestForm(values: LoanRequestFormValues): {
  isValid: boolean;
  errors: LoanRequestFormErrors;
  data?: ValidatedLoanRequestData;
} {
  const errors: LoanRequestFormErrors = {};

  // 1. Principal Amount
  const cleanAmount = values.principalAmount.trim();
  if (!cleanAmount) {
    errors.principalAmount = 'Loan amount is required.';
  } else if (!/^\d+$/.test(cleanAmount) || BigInt(cleanAmount) <= 0n) {
    errors.principalAmount = 'Loan amount must be a positive integer greater than zero.';
  }

  // 2. Interest Rate
  const rateResult = parsePercentageToBasisPoints(values.interestRatePercent);
  if (rateResult.error) {
    errors.interestRatePercent = rateResult.error;
  }

  // 3. Duration Blocks
  const cleanDuration = values.durationBlocks.trim();
  if (!cleanDuration) {
    errors.durationBlocks = 'Loan duration is required.';
  } else if (!/^\d+$/.test(cleanDuration) || BigInt(cleanDuration) <= 0n) {
    errors.durationBlocks = 'Duration must be a positive integer greater than zero blocks.';
  }

  // 4. Eligibility Threshold
  const cleanThreshold = values.eligibilityThreshold.trim();
  if (!cleanThreshold) {
    errors.eligibilityThreshold = 'Eligibility threshold is required.';
  } else if (!/^\d+$/.test(cleanThreshold) || BigInt(cleanThreshold) <= 0n) {
    errors.eligibilityThreshold = 'Eligibility threshold must be a positive integer greater than zero.';
  }

  const isValid = Object.keys(errors).length === 0;

  if (isValid && rateResult.bps !== null) {
    return {
      isValid: true,
      errors: {},
      data: {
        principalAmount: BigInt(cleanAmount),
        interestRateBasisPoints: rateResult.bps,
        durationBlocks: BigInt(cleanDuration),
        eligibilityThreshold: BigInt(cleanThreshold),
      },
    };
  }

  return { isValid: false, errors };
}
