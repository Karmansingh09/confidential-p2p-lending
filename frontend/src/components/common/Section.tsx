import React from 'react';

export interface SectionProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export const Section: React.FC<SectionProps> = ({
  title,
  description,
  action,
  className = '',
  children,
}) => {
  return (
    <section className={`section-block ${className}`}>
      <div className="section-header">
        <div className="section-header-text">
          <h2 className="section-title">{title}</h2>
          {description && <p className="section-description">{description}</p>}
        </div>
        {action && <div className="section-header-action">{action}</div>}
      </div>
      <div className="section-content">{children}</div>
    </section>
  );
};
