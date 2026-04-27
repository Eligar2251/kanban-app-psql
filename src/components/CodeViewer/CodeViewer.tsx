import React, { memo, useMemo } from 'react';
import { Copy, Check } from 'lucide-react';
import type { FileNode } from '../../lib/fileUtils';
import './CodeViewer.css';

interface CodeViewerProps {
  file: FileNode | null;
}

const CodeViewer = memo(function CodeViewer({ file }: CodeViewerProps) {
  const [copied, setCopied] = React.useState(false);

  const lines = useMemo(() => {
    if (!file?.content) return [];
    return file.content.split('\n');
  }, [file?.content]);

  const handleCopy = React.useCallback(() => {
    if (!file?.content) return;
    navigator.clipboard.writeText(file.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [file?.content]);

  if (!file) {
    return (
      <div className="code-viewer-empty">
        <span>Select a file to view its contents</span>
      </div>
    );
  }

  if (!file.content) {
    return (
      <div className="code-viewer-empty">
        <span>Binary file — cannot display</span>
      </div>
    );
  }

  return (
    <div className="code-viewer">
      <div className="code-viewer-header">
        <span className="code-viewer-path">{file.path}</span>
        <div className="code-viewer-meta">
          <span className="code-viewer-lines">{lines.length} lines</span>
          <span className="code-viewer-chars">{file.content.length.toLocaleString()} chars</span>
          <button className="code-viewer-copy" onClick={handleCopy} title="Copy">
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
        </div>
      </div>
      <div className="code-viewer-content">
        <div className="code-viewer-gutter">
          {lines.map((_, i) => (
            <span key={i} className="code-viewer-line-num">{i + 1}</span>
          ))}
        </div>
        <pre className="code-viewer-code">
          <code>{file.content}</code>
        </pre>
      </div>
    </div>
  );
});

export default CodeViewer;