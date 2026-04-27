import React, { memo, useState, useCallback, useMemo } from 'react';
import {
  ChevronRight, ChevronDown, Folder, FileText,
  Check, Image, Music, Film, FileArchive, FileType, Minus,
} from 'lucide-react';
import type { FileNode } from '../../lib/fileUtils';
import { formatSize, getChildFilePaths } from '../../lib/fileUtils';
import './FileTree.css';

interface FileTreeProps {
  nodes: FileNode[];
  selectedPaths: Set<string>;
  onToggleSelect: (path: string) => void;
  onToggleDir: (paths: string[]) => void;
  onFileClick: (file: FileNode) => void;
  activeFilePath: string | null;
}

interface TreeNodeProps {
  node: FileNode;
  depth: number;
  selectedPaths: Set<string>;
  onToggleSelect: (path: string) => void;
  onToggleDir: (paths: string[]) => void;
  onFileClick: (file: FileNode) => void;
  activeFilePath: string | null;
}

const EXT_ICONS: Record<string, React.ReactNode> = {
  png: <Image size={14} />, jpg: <Image size={14} />, jpeg: <Image size={14} />,
  gif: <Image size={14} />, webp: <Image size={14} />, svg: <Image size={14} />,
  ico: <Image size={14} />, bmp: <Image size={14} />,
  mp3: <Music size={14} />, wav: <Music size={14} />, ogg: <Music size={14} />,
  mp4: <Film size={14} />, avi: <Film size={14} />, mov: <Film size={14} />,
  zip: <FileArchive size={14} />, tar: <FileArchive size={14} />,
  gz: <FileArchive size={14} />, rar: <FileArchive size={14} />,
  woff: <FileType size={14} />, woff2: <FileType size={14} />,
  ttf: <FileType size={14} />, eot: <FileType size={14} />,
};

const EXT_COLORS: Record<string, string> = {
  ts: '#3178C6', tsx: '#3178C6', js: '#F7DF1E', jsx: '#F7DF1E',
  css: '#264DE4', scss: '#CF649A', json: '#5A5A72',
  html: '#E34C26', md: '#083FA1', py: '#3776AB',
  rs: '#DEA584', go: '#00ADD8', sql: '#E38C00',
  yaml: '#CB171E', yml: '#CB171E', sh: '#4EAA25',
  png: '#8B5CF6', jpg: '#8B5CF6', jpeg: '#8B5CF6',
  gif: '#8B5CF6', webp: '#8B5CF6', svg: '#F97316',
  mp3: '#EC4899', mp4: '#EC4899',
};

const TreeNode = memo(function TreeNode({
  node, depth, selectedPaths, onToggleSelect, onToggleDir, onFileClick, activeFilePath,
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);

  const isSelected = selectedPaths.has(node.path);
  const isActive = node.path === activeFilePath;
  const extColor = EXT_COLORS[node.extension] || '#5A5A72';

  // For directories: check if all/some/none children selected
  const dirSelectState = useMemo(() => {
    if (node.type !== 'directory') return 'none';
    const childPaths = getChildFilePaths(node);
    if (childPaths.length === 0) return 'none';
    const selectedCount = childPaths.filter((p) => selectedPaths.has(p)).length;
    if (selectedCount === 0) return 'none';
    if (selectedCount === childPaths.length) return 'all';
    return 'partial';
  }, [node, selectedPaths]);

  const handleToggle = useCallback(() => {
    if (node.type === 'directory') {
      setExpanded((p) => !p);
    } else {
      onFileClick(node);
    }
  }, [node, onFileClick]);

  const handleCheck = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.type === 'file') {
      onToggleSelect(node.path);
    } else {
      const childPaths = getChildFilePaths(node);
      onToggleDir(childPaths);
    }
  }, [node, onToggleSelect, onToggleDir]);

  const icon = node.type === 'directory'
    ? <Folder size={14} className="file-tree-icon file-tree-icon--dir" />
    : EXT_ICONS[node.extension]
      ? <span className="file-tree-icon" style={{ color: extColor }}>{EXT_ICONS[node.extension]}</span>
      : <FileText size={14} className="file-tree-icon" style={{ color: extColor }} />;

  const checkState = node.type === 'file'
    ? (isSelected ? 'checked' : 'none')
    : dirSelectState;

  return (
    <>
      <div
        className={`file-tree-node ${isActive ? 'file-tree-node--active' : ''} ${node.isBinary ? 'file-tree-node--binary' : ''}`}
        style={{ paddingLeft: depth * 16 + 8 }}
        onClick={handleToggle}
      >
        {/* Checkbox */}
        <button
          className={`file-tree-check ${
            checkState === 'checked' || checkState === 'all'
              ? 'file-tree-check--checked'
              : checkState === 'partial'
              ? 'file-tree-check--partial'
              : ''
          }`}
          onClick={handleCheck}
        >
          {(checkState === 'checked' || checkState === 'all') && <Check size={10} />}
          {checkState === 'partial' && <Minus size={10} />}
        </button>

        {/* Expand chevron for dirs */}
        {node.type === 'directory' ? (
          <span className="file-tree-chevron">
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        ) : (
          <span className="file-tree-chevron-spacer" />
        )}

        {/* Icon */}
        {icon}

        {/* Name */}
        <span className="file-tree-name">
          {node.name}
          {node.type === 'directory' && '/'}
        </span>

        {/* Binary indicator */}
        {node.isBinary && node.type === 'file' && (
          <span className="file-tree-binary-tag">BIN</span>
        )}

        {/* Size */}
        <span className="file-tree-size">{formatSize(node.size)}</span>
      </div>

      {/* Children */}
      {node.type === 'directory' && expanded && node.children && (
        node.children.map((child) => (
          <TreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            selectedPaths={selectedPaths}
            onToggleSelect={onToggleSelect}
            onToggleDir={onToggleDir}
            onFileClick={onFileClick}
            activeFilePath={activeFilePath}
          />
        ))
      )}
    </>
  );
});

const FileTree = memo(function FileTree({
  nodes, selectedPaths, onToggleSelect, onToggleDir, onFileClick, activeFilePath,
}: FileTreeProps) {
  return (
    <div className="file-tree">
      {nodes.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          selectedPaths={selectedPaths}
          onToggleSelect={onToggleSelect}
          onToggleDir={onToggleDir}
          onFileClick={onFileClick}
          activeFilePath={activeFilePath}
        />
      ))}
    </div>
  );
});

export default FileTree;