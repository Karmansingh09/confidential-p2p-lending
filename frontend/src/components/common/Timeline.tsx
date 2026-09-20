import React from 'react';

export interface TimelineStep {
  id: string;
  label: string;
  status: 'completed' | 'active' | 'upcoming' | 'error';
  timestamp?: string;
  description?: string;
  badge?: string;
}

export interface TimelineProps {
  steps: TimelineStep[];
  className?: string;
}

export const Timeline: React.FC<TimelineProps> = ({ steps, className = '' }) => {
  return (
    <div className={`fintech-timeline ${className}`} role="list">
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        return (
          <div
            key={step.id}
            className={`timeline-step timeline-step-${step.status}`}
            role="listitem"
          >
            <div className="timeline-marker-col">
              <div className="timeline-node">
                {step.status === 'completed' && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {step.status === 'active' && <span className="timeline-pulse-dot" />}
                {step.status === 'error' && <span className="timeline-error-x">&times;</span>}
              </div>
              {!isLast && <div className="timeline-connector-line" />}
            </div>

            <div className="timeline-content-col">
              <div className="timeline-header-row">
                <span className="timeline-label">{step.label}</span>
                {step.badge && <span className="timeline-badge">{step.badge}</span>}
                {step.timestamp && <span className="timeline-timestamp">{step.timestamp}</span>}
              </div>
              {step.description && <p className="timeline-desc">{step.description}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
};
