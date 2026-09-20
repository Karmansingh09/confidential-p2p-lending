import React from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: string[];
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  badge,
  actions,
  breadcrumb,
  className = '',
}) => {
  return (
    <div className={`page-header-block ${className}`}>
      <div className="page-header-text">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav className="page-breadcrumb" aria-label="Breadcrumb">
            {breadcrumb.map((crumb, idx) => (
              <span key={idx} className="breadcrumb-item">
                {idx > 0 && <span className="breadcrumb-separator">/</span>}
                <span className={idx === breadcrumb.length - 1 ? 'active' : ''}>{crumb}</span>
              </span>
            ))}
          </nav>
        )}
        <div className="page-title-row">
          <h1 className="page-title">{title}</h1>
          {badge}
        </div>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  );
};
