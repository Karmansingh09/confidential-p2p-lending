import React from 'react';

export interface TabItem<K extends string = string> {
  key: K;
  label: React.ReactNode;
  badge?: React.ReactNode;
}

export interface TabsProps<K extends string = string> {
  tabs: TabItem<K>[];
  activeTab: K;
  onChange: (key: K) => void;
  className?: string;
}

export function Tabs<K extends string = string>({
  tabs,
  activeTab,
  onChange,
  className = '',
}: TabsProps<K>) {
  return (
    <div className={`ui-tabs ${className}`} role="tablist">
      {tabs.map((t) => {
        const isActive = t.key === activeTab;
        return (
          <button
            key={t.key}
            type="button"
            className={`tab-button ${isActive ? 'active' : ''}`}
            onClick={() => onChange(t.key)}
            role="tab"
            aria-selected={isActive}
          >
            <span className="tab-label">{t.label}</span>
            {t.badge !== undefined && <span className="tab-badge">{t.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}
