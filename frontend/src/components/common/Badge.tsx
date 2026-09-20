import React from 'react';

export interface BadgeProps {
  variant?: 'success' | 'warning' | 'danger' | 'accent' | 'neutral' | 'info';
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  children,
  className = '',
  title,
}) => {
  return (
    <span className={`badge badge-${variant} ${className}`} title={title}>
      {children}
    </span>
  );
};
