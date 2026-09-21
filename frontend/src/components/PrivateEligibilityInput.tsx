import React, { useState } from 'react';

interface PrivateEligibilityInputProps {
  threshold: bigint;
  onSubmit: (witnessAmount: bigint) => void;
  onCancel?: () => void;
  disabled?: boolean;
}

export const PrivateEligibilityInput: React.FC<PrivateEligibilityInputProps> = ({
  threshold,
  onSubmit,
  onCancel,
  disabled = false,
}) => {
  const [inputValue, setInputValue] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = inputValue.trim();
    if (!trimmed) {
      setError('Please enter a synthetic qualifying amount');
      return;
    }

    try {
      const amount = BigInt(trimmed);
      if (amount <= 0n) {
        setError('Amount must be greater than zero');
        return;
      }

      // Clear input immediately to prevent persistence in component state or DOM
      setInputValue('');

      // Submit directly to caller
      onSubmit(amount);
    } catch {
      setError('Please enter a valid integer amount');
    }
  };

  const handleSyntheticFill = (syntheticVal: bigint) => {
    setError(null);
    setInputValue(syntheticVal.toString());
  };

  return (
    <form className="private-eligibility-input-form" onSubmit={handleSubmit}>
      <div className="input-security-banner">
        <span className="security-icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        </span>
        <div className="security-text">
          <strong>Confidential Witness Prover Input</strong>
          <p>
            The entered value is processed strictly in your local prover environment.
            It is never transmitted to the public ledger or any network node.
          </p>
        </div>
      </div>

      <div className="security-warning-note">
        <span className="warning-icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        </span>
        <span>
          <strong>Important:</strong> Do not enter wallet signing credentials, personal passwords, or secret recovery phrases.
        </span>
      </div>

      <div className="form-group">
        <label htmlFor="confidential-witness-input">
          Confidential Proof Amount (Local Witness)
        </label>
        <div className="password-input-wrapper">
          <input
            id="confidential-witness-input"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Enter qualifying integer amount (e.g. 50000)"
            disabled={disabled}
            className={`witness-password-input ${error ? 'input-error' : ''}`}
          />
        </div>
        {error && <span className="input-error-msg">{error}</span>}
        <span className="form-hint">
          Public threshold required: <strong>{threshold.toLocaleString()} units</strong>
        </span>
      </div>

      <div className="synthetic-presets">
        <span className="presets-label">Synthetic Test Values:</span>
        <button
          type="button"
          className="preset-btn"
          onClick={() => handleSyntheticFill(threshold + 5000n)}
          disabled={disabled}
        >
          Passing: {(threshold + 5000n).toLocaleString()}
        </button>
        <button
          type="button"
          className="preset-btn preset-btn-danger"
          onClick={() => handleSyntheticFill(threshold > 5000n ? threshold - 5000n : 1000n)}
          disabled={disabled}
        >
          Failing: {(threshold > 5000n ? threshold - 5000n : 1000n).toLocaleString()}
        </button>
      </div>

      <div className="form-actions">
        {onCancel && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={disabled}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="btn btn-primary btn-generate-proof"
          disabled={disabled}
        >
          Generate Confidential Proof
        </button>
      </div>
    </form>
  );
};
