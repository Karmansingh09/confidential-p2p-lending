import React from 'react';
import type { LoanDetailsModel, ProtocolPhase, LifecycleStepInfo } from '../types/index.ts';
import { getLifecyclePhase } from '../lib/formatters.ts';

interface LifecycleStepperProps {
  loan: LoanDetailsModel;
  compact?: boolean;
}

export const LifecycleStepper: React.FC<LifecycleStepperProps> = ({ loan, compact = false }) => {
  const currentPhase = getLifecyclePhase(loan);

  const steps: LifecycleStepInfo[] = [
    {
      phase: 'REQUESTED',
      title: '1. Requested',
      description: 'Terms initialized on-chain',
      isComplete: true,
      isCurrent: currentPhase === 'REQUESTED',
    },
    {
      phase: 'ELIGIBILITY_VERIFIED',
      title: '2. ZK Verified',
      description: 'Off-chain proof accepted',
      isComplete:
        loan.isEligibilityVerified &&
        ['ELIGIBILITY_VERIFIED', 'FUNDED', 'REPAID', 'SETTLED'].includes(currentPhase),
      isCurrent: currentPhase === 'ELIGIBILITY_VERIFIED',
    },
    {
      phase: 'FUNDED',
      title: '3. Funded',
      description: 'Lender capital committed',
      isComplete: ['FUNDED', 'REPAID', 'SETTLED'].includes(currentPhase),
      isCurrent: currentPhase === 'FUNDED',
    },
    {
      phase: 'REPAID',
      title: '4. Repaid',
      description: 'Principal + interest satisfied',
      isComplete: ['REPAID', 'SETTLED'].includes(currentPhase),
      isCurrent: currentPhase === 'REPAID',
    },
    {
      phase: 'SETTLED',
      title: '5. Settled',
      description: 'Terminal agreement closed',
      isComplete: currentPhase === 'SETTLED',
      isCurrent: currentPhase === 'SETTLED',
    },
  ];

  if (compact) {
    return (
      <div className="compact-stepper" title={`Current Phase: ${currentPhase}`}>
        {steps.map((step, idx) => (
          <React.Fragment key={step.phase}>
            <div
              className={`compact-step-dot ${step.isComplete ? 'complete' : ''} ${step.isCurrent ? 'current' : ''}`}
              title={step.title}
            />
            {idx < steps.length - 1 && (
              <div className={`compact-step-line ${step.isComplete && !step.isCurrent ? 'complete' : ''}`} />
            )}
          </React.Fragment>
        ))}
        <span className="compact-step-label font-mono">
          {currentPhase}
        </span>
      </div>
    );
  }

  return (
    <div className="lifecycle-stepper-container">
      <div className="lifecycle-header">
        <h3>Protocol Lifecycle Progression</h3>
        <span className="current-phase-indicator">Current: <strong>{currentPhase}</strong></span>
      </div>

      <div className="stepper-track">
        {steps.map((step, idx) => (
          <div
            key={step.phase}
            className={`stepper-step ${step.isComplete ? 'complete' : ''} ${
              step.isCurrent ? 'current' : ''
            }`}
          >
            <div className="step-circle">
              {step.isComplete && !step.isCurrent ? (
                <span>&#10003;</span>
              ) : (
                <span>{idx + 1}</span>
              )}
            </div>
            <div className="step-content">
              <div className="step-title">{step.title}</div>
              <div className="step-desc">{step.description}</div>
            </div>
            {idx < steps.length - 1 && <div className="step-connector" />}
          </div>
        ))}
      </div>
    </div>
  );
};
