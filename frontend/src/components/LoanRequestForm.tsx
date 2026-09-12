import React, { useState } from 'react';
import {
  validateLoanRequestForm,
  parsePercentageToBasisPoints,
  type LoanRequestFormValues,
  type LoanRequestFormErrors,
  type ValidatedLoanRequestData,
} from '../lib/validation.js';
import { ValidationMessage } from './ValidationMessage.js';

interface LoanRequestFormProps {
  onSubmit: (data: ValidatedLoanRequestData) => void;
  onValuesChange: (
    amount: bigint | null,
    bps: bigint | null,
    duration: bigint | null,
    threshold: bigint | null
  ) => void;
  isSubmitting?: boolean;
}

export const LoanRequestForm: React.FC<LoanRequestFormProps> = ({
  onSubmit,
  onValuesChange,
  isSubmitting = false,
}) => {
  const [formValues, setFormValues] = useState<LoanRequestFormValues>({
    principalAmount: '25000',
    interestRatePercent: '5.00',
    durationBlocks: '100',
    eligibilityThreshold: '30000',
  });

  const [errors, setErrors] = useState<LoanRequestFormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const notifyPreview = (values: LoanRequestFormValues) => {
    const amount = /^\d+$/.test(values.principalAmount.trim())
      ? BigInt(values.principalAmount.trim())
      : null;

    const rateResult = parsePercentageToBasisPoints(values.interestRatePercent);
    const bps = rateResult.bps;

    const duration = /^\d+$/.test(values.durationBlocks.trim())
      ? BigInt(values.durationBlocks.trim())
      : null;

    const threshold = /^\d+$/.test(values.eligibilityThreshold.trim())
      ? BigInt(values.eligibilityThreshold.trim())
      : null;

    onValuesChange(amount, bps, duration, threshold);
  };

  const handleChange = (field: keyof LoanRequestFormValues, value: string) => {
    const nextValues = { ...formValues, [field]: value };
    setFormValues(nextValues);
    notifyPreview(nextValues);

    if (touched[field]) {
      const result = validateLoanRequestForm(nextValues);
      setErrors(result.errors);
    }
  };

  const handleBlur = (field: keyof LoanRequestFormValues) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const result = validateLoanRequestForm(formValues);
    setErrors(result.errors);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({
      principalAmount: true,
      interestRatePercent: true,
      durationBlocks: true,
      eligibilityThreshold: true,
    });

    const result = validateLoanRequestForm(formValues);
    setErrors(result.errors);

    if (result.isValid && result.data) {
      onSubmit(result.data);
    }
  };

  const handlePrefill = (
    amount: string,
    rate: string,
    duration: string,
    threshold: string
  ) => {
    const prefillValues = {
      principalAmount: amount,
      interestRatePercent: rate,
      durationBlocks: duration,
      eligibilityThreshold: threshold,
    };
    setFormValues(prefillValues);
    setErrors({});
    notifyPreview(prefillValues);
  };

  const currentBps = parsePercentageToBasisPoints(formValues.interestRatePercent).bps;

  return (
    <form className="loan-request-form-card" onSubmit={handleSubmit} noValidate>
      <div className="form-header">
        <div>
          <h3>Loan Agreement Parameters</h3>
          <span className="form-subtitle">Enter terms to be proposed to prospective lenders</span>
        </div>
        <div className="prefill-chips">
          <span className="chips-label">Presets:</span>
          <button
            type="button"
            className="chip-btn"
            onClick={() => handlePrefill('10000', '4.00', '50', '20000')}
          >
            Micro (10k)
          </button>
          <button
            type="button"
            className="chip-btn"
            onClick={() => handlePrefill('25000', '5.00', '100', '30000')}
          >
            Standard (25k)
          </button>
          <button
            type="button"
            className="chip-btn"
            onClick={() => handlePrefill('50000', '7.50', '250', '60000')}
          >
            Growth (50k)
          </button>
        </div>
      </div>

      <div className="form-fields-container">
        {/* Principal Amount */}
        <div className="form-group">
          <label htmlFor="principalAmount">
            Requested Principal Amount <span className="required-star">*</span>
          </label>
          <div className="input-with-unit">
            <input
              id="principalAmount"
              name="principalAmount"
              type="text"
              inputMode="numeric"
              placeholder="e.g. 25000"
              value={formValues.principalAmount}
              onChange={(e) => handleChange('principalAmount', e.target.value)}
              onBlur={() => handleBlur('principalAmount')}
              className={errors.principalAmount && touched.principalAmount ? 'input-error' : ''}
              disabled={isSubmitting}
            />
            <span className="input-unit">MICRO-UNITS</span>
          </div>
          <ValidationMessage
            error={touched.principalAmount ? errors.principalAmount : undefined}
            hint="Total borrowing capital to be funded by lender"
          />
        </div>

        {/* Interest Rate */}
        <div className="form-group">
          <label htmlFor="interestRatePercent">
            Proposed Interest Rate (% Annual/Term) <span className="required-star">*</span>
          </label>
          <div className="input-with-unit">
            <input
              id="interestRatePercent"
              name="interestRatePercent"
              type="text"
              placeholder="e.g. 5.00"
              value={formValues.interestRatePercent}
              onChange={(e) => handleChange('interestRatePercent', e.target.value)}
              onBlur={() => handleBlur('interestRatePercent')}
              className={
                errors.interestRatePercent && touched.interestRatePercent ? 'input-error' : ''
              }
              disabled={isSubmitting}
            />
            <span className="input-unit">
              {currentBps !== null ? `${currentBps.toString()} BPS` : '%'}
            </span>
          </div>
          <ValidationMessage
            error={touched.interestRatePercent ? errors.interestRatePercent : undefined}
            hint="Simple interest obligation: 1% = 100 Basis Points (0.01% to 100.00%)"
          />
        </div>

        {/* Duration Blocks */}
        <div className="form-group">
          <label htmlFor="durationBlocks">
            Term Duration in Blocks <span className="required-star">*</span>
          </label>
          <div className="input-with-unit">
            <input
              id="durationBlocks"
              name="durationBlocks"
              type="text"
              inputMode="numeric"
              placeholder="e.g. 100"
              value={formValues.durationBlocks}
              onChange={(e) => handleChange('durationBlocks', e.target.value)}
              onBlur={() => handleBlur('durationBlocks')}
              className={errors.durationBlocks && touched.durationBlocks ? 'input-error' : ''}
              disabled={isSubmitting}
            />
            <span className="input-unit">BLOCKS</span>
          </div>
          <ValidationMessage
            error={touched.durationBlocks ? errors.durationBlocks : undefined}
            hint="Maturity period in Midnight ledger blocks"
          />
        </div>

        {/* Eligibility Threshold */}
        <div className="form-group">
          <label htmlFor="eligibilityThreshold">
            Public Eligibility Qualification Threshold <span className="required-star">*</span>
          </label>
          <div className="input-with-unit">
            <input
              id="eligibilityThreshold"
              name="eligibilityThreshold"
              type="text"
              inputMode="numeric"
              placeholder="e.g. 30000"
              value={formValues.eligibilityThreshold}
              onChange={(e) => handleChange('eligibilityThreshold', e.target.value)}
              onBlur={() => handleBlur('eligibilityThreshold')}
              className={
                errors.eligibilityThreshold && touched.eligibilityThreshold ? 'input-error' : ''
              }
              disabled={isSubmitting}
            />
            <span className="input-unit">QUALIFICATION MIN</span>
          </div>
          <ValidationMessage
            error={touched.eligibilityThreshold ? errors.eligibilityThreshold : undefined}
            hint="Underwriting benchmark: you will prove privateValue ≥ this threshold in ZK"
          />
        </div>
      </div>

      <div className="form-actions-bar">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => handlePrefill('', '', '', '')}
          disabled={isSubmitting}
        >
          Clear Fields
        </button>
        <button
          type="submit"
          className="btn-primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Preparing Request...' : 'Create Loan Request (Local Simulation)'}
        </button>
      </div>
    </form>
  );
};
