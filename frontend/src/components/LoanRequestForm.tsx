import React, { useState } from 'react';
import {
  validateLoanRequestForm,
  parsePercentageToBasisPoints,
  type LoanRequestFormValues,
  type LoanRequestFormErrors,
  type ValidatedLoanRequestData,
} from '../lib/validation.ts';
import { ValidationMessage } from './ValidationMessage.tsx';

interface LoanRequestFormProps {
  onSubmit: (data: ValidatedLoanRequestData) => void;
  onValuesChange: (
    amount: bigint | null,
    bps: bigint | null,
    duration: bigint | null,
    threshold: bigint | null
  ) => void;
  onBack?: () => void;
  isSubmitting?: boolean;
}

export const LoanRequestForm: React.FC<LoanRequestFormProps> = ({
  onSubmit,
  onValuesChange,
  onBack,
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

  // Determine active preset
  const isMicro = formValues.principalAmount === '10000' && formValues.interestRatePercent === '4.00';
  const isStandard = formValues.principalAmount === '25000' && formValues.interestRatePercent === '5.00';
  const isGrowth = formValues.principalAmount === '50000' && formValues.interestRatePercent === '7.50';

  return (
    <form className="loan-params-form-panel" onSubmit={handleSubmit} noValidate>
      {/* Panel Header */}
      <div className="params-panel-header">
        <div>
          <h2 className="params-panel-title">Loan Agreement Parameters</h2>
          <p className="params-panel-subtitle">Define the terms of the proposed loan.</p>
        </div>

        {/* Preset Segmented Control */}
        <div className="params-presets-container font-mono">
          <span className="presets-label">PRESETS:</span>
          <div className="presets-segmented-control" role="group" aria-label="Loan Presets">
            <button
              type="button"
              className={`preset-btn ${isMicro ? 'active' : ''}`}
              onClick={() => handlePrefill('10000', '4.00', '50', '20000')}
              title="10,000 Micro-Units at 4.00% over 50 blocks"
            >
              <span className="preset-name">MICRO</span>
              <span className="preset-val">10K</span>
            </button>
            <button
              type="button"
              className={`preset-btn ${isStandard ? 'active' : ''}`}
              onClick={() => handlePrefill('25000', '5.00', '100', '30000')}
              title="25,000 Micro-Units at 5.00% over 100 blocks"
            >
              <span className="preset-name">STANDARD</span>
              <span className="preset-val">25K</span>
            </button>
            <button
              type="button"
              className={`preset-btn ${isGrowth ? 'active' : ''}`}
              onClick={() => handlePrefill('50000', '7.50', '250', '60000')}
              title="50,000 Micro-Units at 7.50% over 250 blocks"
            >
              <span className="preset-name">GROWTH</span>
              <span className="preset-val">50K</span>
            </button>
          </div>
        </div>
      </div>

      {/* Form Fields */}
      <div className="params-fields-stack">
        {/* 1. Principal Amount */}
        <div className="param-field-group">
          <div className="field-label-row">
            <label htmlFor="principalAmount" className="field-label">
              Requested Principal Amount <span className="required-star">*</span>
            </label>
            <span className="field-meta-tag font-mono">CAPITAL COMMITMENT</span>
          </div>
          <div className="param-input-wrap">
            <input
              id="principalAmount"
              name="principalAmount"
              type="text"
              inputMode="numeric"
              placeholder="e.g. 25000"
              value={formValues.principalAmount}
              onChange={(e) => handleChange('principalAmount', e.target.value)}
              onBlur={() => handleBlur('principalAmount')}
              className={`param-input font-mono ${
                errors.principalAmount && touched.principalAmount ? 'input-error' : ''
              }`}
              disabled={isSubmitting}
            />
            <span className="param-unit-badge font-mono">MICRO-UNITS</span>
          </div>
          <ValidationMessage
            error={touched.principalAmount ? errors.principalAmount : undefined}
            hint="Total borrowing capital to be funded by lender"
          />
        </div>

        {/* 2. Proposed Interest Rate */}
        <div className="param-field-group">
          <div className="field-label-row">
            <label htmlFor="interestRatePercent" className="field-label">
              Proposed Interest Rate (% Annual/Term) <span className="required-star">*</span>
            </label>
            <span className="field-meta-tag font-mono">SIMPLE INTEREST</span>
          </div>
          <div className="param-input-wrap">
            <input
              id="interestRatePercent"
              name="interestRatePercent"
              type="text"
              placeholder="e.g. 5.00"
              value={formValues.interestRatePercent}
              onChange={(e) => handleChange('interestRatePercent', e.target.value)}
              onBlur={() => handleBlur('interestRatePercent')}
              className={`param-input font-mono ${
                errors.interestRatePercent && touched.interestRatePercent ? 'input-error' : ''
              }`}
              disabled={isSubmitting}
            />
            <span className="param-unit-badge font-mono">
              {currentBps !== null ? `${currentBps.toString()} BPS` : '%'}
            </span>
          </div>
          <ValidationMessage
            error={touched.interestRatePercent ? errors.interestRatePercent : undefined}
            hint="Simple interest obligation: 1% = 100 Basis Points (0.01% to 100.00%)"
          />
        </div>

        {/* 3. Term Duration in Blocks */}
        <div className="param-field-group">
          <div className="field-label-row">
            <label htmlFor="durationBlocks" className="field-label">
              Term Duration in Blocks <span className="required-star">*</span>
            </label>
            <span className="field-meta-tag font-mono">MATURITY WINDOW</span>
          </div>
          <div className="param-input-wrap">
            <input
              id="durationBlocks"
              name="durationBlocks"
              type="text"
              inputMode="numeric"
              placeholder="e.g. 100"
              value={formValues.durationBlocks}
              onChange={(e) => handleChange('durationBlocks', e.target.value)}
              onBlur={() => handleBlur('durationBlocks')}
              className={`param-input font-mono ${
                errors.durationBlocks && touched.durationBlocks ? 'input-error' : ''
              }`}
              disabled={isSubmitting}
            />
            <span className="param-unit-badge font-mono">BLOCKS</span>
          </div>
          <ValidationMessage
            error={touched.durationBlocks ? errors.durationBlocks : undefined}
            hint="Maturity period in Midnight ledger blocks"
          />
        </div>

        {/* 4. Eligibility Qualification Threshold */}
        <div className="param-field-group">
          <div className="field-label-row">
            <label htmlFor="eligibilityThreshold" className="field-label">
              Public Eligibility Qualification Threshold <span className="required-star">*</span>
            </label>
            <span className="field-meta-tag font-mono text-accent">ZK UNDERWRITING</span>
          </div>
          <div className="param-input-wrap">
            <input
              id="eligibilityThreshold"
              name="eligibilityThreshold"
              type="text"
              inputMode="numeric"
              placeholder="e.g. 30000"
              value={formValues.eligibilityThreshold}
              onChange={(e) => handleChange('eligibilityThreshold', e.target.value)}
              onBlur={() => handleBlur('eligibilityThreshold')}
              className={`param-input font-mono ${
                errors.eligibilityThreshold && touched.eligibilityThreshold ? 'input-error' : ''
              }`}
              disabled={isSubmitting}
            />
            <span className="param-unit-badge font-mono">QUALIFICATION MIN</span>
          </div>
          <ValidationMessage
            error={touched.eligibilityThreshold ? errors.eligibilityThreshold : undefined}
            hint="Underwriting benchmark: you will prove privateValue ≥ this threshold in ZK. Private values remain in your client enclave."
          />
        </div>
      </div>

      {/* Form Action Controls */}
      <div className="params-actions-bar">
        {onBack && (
          <button
            type="button"
            className="btn-params-back font-mono"
            onClick={onBack}
            disabled={isSubmitting}
          >
            &larr; Back
          </button>
        )}
        <button
          type="button"
          className="btn-params-clear font-mono"
          onClick={() => handlePrefill('', '', '', '')}
          disabled={isSubmitting}
        >
          Clear Fields
        </button>
        <button
          type="submit"
          className="btn-params-submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Preparing Request...' : 'Create Loan Request (Local Simulation)'}
        </button>
      </div>
    </form>
  );
};

export default LoanRequestForm;
