import React, { memo, useMemo, useCallback, useState } from 'react';
import { Download, Copy, Check, Package, ChevronLeft, ChevronRight } from 'lucide-react';
import type { FileNode } from '../../lib/fileUtils';
import { compileFiles, downloadText } from '../../lib/fileUtils';
import Button from '../Button/Button';
import './CodeCompiler.css';

interface CodeCompilerProps {
  files: FileNode[];
  projectName: string;
}

const CodeCompiler = memo(function CodeCompiler({ files, projectName }: CodeCompilerProps) {
  const [currentPart, setCurrentPart] = useState(0);
  const [copied, setCopied] = useState(false);

  const compiled = useMemo(() => compileFiles(files, 115000), [files]);

  const totalChars = useMemo(
    () => compiled.parts.reduce((s, p) => s + p.length, 0),
    [compiled.parts]
  );

  const handleCopy = useCallback(() => {
    if (!compiled.parts[currentPart]) return;
    navigator.clipboard.writeText(compiled.parts[currentPart]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [compiled.parts, currentPart]);

  const handleDownload = useCallback((index: number) => {
    const suffix = compiled.parts.length > 1 ? `_part${index + 1}` : '';
    downloadText(compiled.parts[index], `${projectName}${suffix}.txt`);
  }, [compiled.parts, projectName]);

  const handleDownloadAll = useCallback(() => {
    compiled.parts.forEach((_, i) => handleDownload(i));
  }, [compiled.parts, handleDownload]);

  if (files.length === 0) {
    return (
      <div className="compiler-empty">
        <Package size={24} />
        <span>Select files in the tree to compile</span>
      </div>
    );
  }

  return (
    <div className="compiler">
      {/* Stats bar */}
      <div className="compiler-stats">
        <div className="compiler-stats-left">
          <span className="compiler-stat">
            <strong>{files.length}</strong> files
          </span>
          <span className="compiler-stat">
            <strong>{totalChars.toLocaleString()}</strong> chars
          </span>
          <span className="compiler-stat">
            <strong>{compiled.parts.length}</strong> {compiled.parts.length === 1 ? 'part' : 'parts'}
          </span>
        </div>
        <div className="compiler-stats-right">
          <Button variant="ghost" size="sm" icon={<Download size={11} />} onClick={handleDownloadAll}>
            Download all
          </Button>
        </div>
      </div>

      {/* Part navigation */}
      {compiled.parts.length > 1 && (
        <div className="compiler-parts-nav">
          <button
            className="compiler-nav-btn"
            disabled={currentPart === 0}
            onClick={() => setCurrentPart((p) => p - 1)}
          >
            <ChevronLeft size={14} />
          </button>

          {compiled.parts.map((part, i) => (
            <button
              key={i}
              className={`compiler-part-btn ${currentPart === i ? 'compiler-part-btn--active' : ''}`}
              onClick={() => setCurrentPart(i)}
            >
              Part {i + 1}
              <span className="compiler-part-chars">{part.length.toLocaleString()}</span>
            </button>
          ))}

          <button
            className="compiler-nav-btn"
            disabled={currentPart === compiled.parts.length - 1}
            onClick={() => setCurrentPart((p) => p + 1)}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* File list in current part */}
      <div className="compiler-filelist">
        {compiled.fileMap
          .filter((f) => f.part === currentPart)
          .map((f) => (
            <span key={f.path} className="compiler-file-tag">
              {f.path}
              <span className="compiler-file-tag-chars">{f.chars.toLocaleString()}</span>
            </span>
          ))}
      </div>

      {/* Actions */}
      <div className="compiler-actions">
        <Button
          variant="ghost"
          size="sm"
          icon={copied ? <Check size={11} /> : <Copy size={11} />}
          onClick={handleCopy}
        >
          {copied ? 'Copied!' : 'Copy part'}
        </Button>
        <Button
          variant="primary"
          size="sm"
          icon={<Download size={11} />}
          onClick={() => handleDownload(currentPart)}
        >
          Download part {currentPart + 1}
        </Button>
      </div>

      {/* Preview */}
      <div className="compiler-preview">
        <pre className="compiler-preview-code">{compiled.parts[currentPart]}</pre>
      </div>
    </div>
  );
});

export default CodeCompiler;