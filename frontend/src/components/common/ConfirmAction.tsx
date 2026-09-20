import React, { useState } from 'react';

export interface ConfirmActionProps {
  label: string;
  confirmLabel?: string;
  description?: string;
  variant?: 'primary' | 'danger' | 'secondary';
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
}

export const ConfirmAction: React.FC<ConfirmActionProps> = ({
  label,
  confirmLabel = 'Confirm Action',
  description,
  variant = 'primary',
  onConfirm,
  isLoading = false,
  disabled = false,
  className = '',
}) => {
  const [confirming, setConfirming] = useState(false);

  const handleTrigger = () => {
    setConfirming(true);
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirming(false);
  };

  const handleConfirm = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirming(false);
    await onConfirm();
  };

  if (confirming) {
    return (
      <div className={`confirm-action-popover ${className}`}>
        {description && <p className="confirm-action-desc">{description}</p>}
        <div className="confirm-action-buttons">
          <button
            type="button"
            className={`btn btn-${variant} btn-sm`}
            onClick={handleConfirm}
            disabled={disabled || isLoading}
          >
            {isLoading ? 'Executing...' : confirmLabel}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`btn btn-${variant} ${className}`}
      onClick={handleTrigger}
      disabled={disabled || isLoading}
    >
      {label}
    </button>
  );
};
