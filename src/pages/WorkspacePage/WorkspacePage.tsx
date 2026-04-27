import React, { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  FolderOpen, File, Code2, TreePine, Copy, Check,
  Download, List, FileText, Package,
} from 'lucide-react';
import Header from '../../components/Header/Header';
import FileTree from '../../components/FileTree/FileTree';
import CodeViewer from '../../components/CodeViewer/CodeViewer';
import CodeCompiler from '../../components/CodeCompiler/CodeCompiler';
import Button from '../../components/Button/Button';
import type { FileNode } from '../../lib/fileUtils';
import {
  readDirectoryHandle, flattenFiles, countNodes, formatSize,
  generateTreeText, generateMarkdownTree, generatePathList, downloadText,
} from '../../lib/fileUtils';
import './WorkspacePage.css';

type Tab = 'viewer' | 'compiler' | 'structure';

export default function WorkspacePage() {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [activeFile, setActiveFile] = useState<FileNode | null>(null);
  const [tab, setTab] = useState<Tab>('viewer');
  const [structureCopied, setStructureCopied] = useState(false);

  const stats = useMemo(() => countNodes(tree), [tree]);
  const allFiles = useMemo(() => flattenFiles(tree), [tree]);
  const selectedFiles = useMemo(
    () => allFiles.filter((f) => selectedPaths.has(f.path)),
    [allFiles, selectedPaths]
  );
  const totalSize = useMemo(
    () => allFiles.reduce((s, f) => s + f.size, 0),
    [allFiles]
  );

  const handleOpen = useCallback(async () => {
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: 'read' });
      setLoading(true);
      setProjectName(handle.name);
      const nodes = await readDirectoryHandle(handle);
      setTree(nodes);
      setSelectedPaths(new Set());
      setActiveFile(null);
    } catch (err: any) {
      if (err.name !== 'AbortError') console.error('Failed to open:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleToggleSelect = useCallback((path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  // ↓ Новый handler для toggle директории
  const handleToggleDir = useCallback((paths: string[]) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      // Если все пути уже выбраны — снимаем выделение, иначе выбираем все
      const allSelected = paths.every((p) => next.has(p));
      if (allSelected) {
        paths.forEach((p) => next.delete(p));
      } else {
        paths.forEach((p) => next.add(p));
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedPaths(new Set(allFiles.filter((f) => f.content).map((f) => f.path)));
  }, [allFiles]);

  const handleDeselectAll = useCallback(() => {
    setSelectedPaths(new Set());
  }, []);

  const handleFileClick = useCallback((file: FileNode) => {
    setActiveFile(file);
    setTab('viewer');
  }, []);

  const handleCopyStructure = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setStructureCopied(true);
    setTimeout(() => setStructureCopied(false), 2000);
  }, []);

  const treeText = useMemo(() => generateTreeText(tree), [tree]);
  const markdownTree = useMemo(() => generateMarkdownTree(tree), [tree]);
  const pathList = useMemo(() => generatePathList(tree), [tree]);

  // No project loaded
  if (tree.length === 0 && !loading) {
    return (
      <div className="workspace-page">
        <Header breadcrumbs={[{ label: 'Workspace' }]} />
        <div className="workspace-empty dot-grid">
          <motion.div
            className="workspace-empty-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <Code2 size={40} className="workspace-empty-icon" />
            <h2 className="workspace-empty-title">Load a project</h2>
            <p className="workspace-empty-text">
              Open a folder from your file system to browse code, compile files, and export structure.
            </p>
            <Button variant="primary" size="lg" icon={<FolderOpen size={16} />} onClick={handleOpen}>
              Open Folder
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-page">
      <Header
        breadcrumbs={[
          { label: 'Workspace', href: '/workspace' },
          { label: projectName },
        ]}
        actions={
          <Button variant="ghost" size="sm" icon={<FolderOpen size={13} />} onClick={handleOpen}>
            Open
          </Button>
        }
      />

      {loading ? (
        <div className="workspace-loading">
          <span className="workspace-loading-text">SCANNING FILES...</span>
        </div>
      ) : (
        <div className="workspace-layout">
          {/* Sidebar */}
          <aside className="workspace-sidebar">
            <div className="workspace-sidebar-header">
              <span className="workspace-sidebar-title">FILES</span>
              <span className="workspace-sidebar-stats">
                {stats.files} files · {stats.dirs} dirs · {formatSize(totalSize)}
              </span>
            </div>
            <div className="workspace-sidebar-actions">
              <Button variant="ghost" size="sm" onClick={handleSelectAll}>Select all</Button>
              <Button variant="ghost" size="sm" onClick={handleDeselectAll}>Clear</Button>
              <span className="workspace-selected-count">
                {selectedPaths.size} selected
              </span>
            </div>
            <div className="workspace-sidebar-tree">
              {/* ↓ Обновлённый FileTree с onToggleDir */}
              <FileTree
                nodes={tree}
                selectedPaths={selectedPaths}
                onToggleSelect={handleToggleSelect}
                onToggleDir={handleToggleDir}
                onFileClick={handleFileClick}
                activeFilePath={activeFile?.path || null}
              />
            </div>
          </aside>

          {/* Main content */}
          <main className="workspace-main">
            {/* Tabs */}
            <div className="workspace-tabs">
              <button
                className={`workspace-tab ${tab === 'viewer' ? 'workspace-tab--active' : ''}`}
                onClick={() => setTab('viewer')}
              >
                <FileText size={12} /> Viewer
              </button>
              <button
                className={`workspace-tab ${tab === 'compiler' ? 'workspace-tab--active' : ''}`}
                onClick={() => setTab('compiler')}
              >
                <Package size={12} /> Compiler
                {selectedPaths.size > 0 && (
                  <span className="workspace-tab-badge">{selectedPaths.size}</span>
                )}
              </button>
              <button
                className={`workspace-tab ${tab === 'structure' ? 'workspace-tab--active' : ''}`}
                onClick={() => setTab('structure')}
              >
                <TreePine size={12} /> Structure
              </button>
            </div>

            <div className="workspace-content">
              {tab === 'viewer' && <CodeViewer file={activeFile} />}

              {tab === 'compiler' && (
                <CodeCompiler files={selectedFiles} projectName={projectName} />
              )}

              {tab === 'structure' && (
                <div className="workspace-structure">
                  {/* Tree view */}
                  <div className="workspace-structure-block">
                    <div className="workspace-structure-header">
                      <span>TREE VIEW</span>
                      <div className="workspace-structure-btns">
                        <Button variant="ghost" size="sm" icon={structureCopied ? <Check size={11} /> : <Copy size={11} />} onClick={() => handleCopyStructure(treeText)}>Copy</Button>
                        <Button variant="ghost" size="sm" icon={<Download size={11} />} onClick={() => downloadText(treeText, `${projectName}_tree.txt`)}>Download</Button>
                      </div>
                    </div>
                    <pre className="workspace-structure-pre">{treeText}</pre>
                  </div>

                  {/* Markdown view */}
                  <div className="workspace-structure-block">
                    <div className="workspace-structure-header">
                      <span>MARKDOWN (for AI)</span>
                      <div className="workspace-structure-btns">
                        <Button variant="ghost" size="sm" icon={<Copy size={11} />} onClick={() => handleCopyStructure(markdownTree)}>Copy</Button>
                        <Button variant="ghost" size="sm" icon={<Download size={11} />} onClick={() => downloadText(markdownTree, `${projectName}_structure.md`)}>Download</Button>
                      </div>
                    </div>
                    <pre className="workspace-structure-pre workspace-structure-pre--md">{markdownTree}</pre>
                  </div>

                  {/* Path list */}
                  <div className="workspace-structure-block">
                    <div className="workspace-structure-header">
                      <span>PATH LIST</span>
                      <div className="workspace-structure-btns">
                        <Button variant="ghost" size="sm" icon={<Copy size={11} />} onClick={() => handleCopyStructure(pathList)}>Copy</Button>
                      </div>
                    </div>
                    <pre className="workspace-structure-pre workspace-structure-pre--paths">{pathList}</pre>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      )}
    </div>
  );
}