import React from 'react';
import { CopyButton } from './CopyButton.tsx';

export interface CodeBlockProps {
  code: string;
  language?: string;
  showCopy?: boolean;
  className?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language = 'compact',
  showCopy = true,
  className = '',
}) => {
  return (
    <div className={`fintech-codeblock ${className}`}>
      <div className="codeblock-header">
        <span className="codeblock-lang">{language}</span>
        {showCopy && <CopyButton value={code} label="Copy Code" />}
      </div>
      <pre className="codeblock-content">
        <code>{code}</code>
      </pre>
    </div>
  );
};
