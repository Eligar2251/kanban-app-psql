export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  content?: string;
  size: number;
  extension: string;
  isBinary: boolean;
}

const IGNORE_PATTERNS = [
  'node_modules', '.git', '.next', 'dist', 'build', '.cache',
  '.DS_Store', 'Thumbs.db',
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
];

const TEXT_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'json', 'css', 'scss', 'less',
  'html', 'htm', 'xml', 'svg', 'md', 'mdx', 'txt',
  'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf',
  'sh', 'bash', 'zsh', 'fish', 'bat', 'cmd', 'ps1',
  'py', 'rb', 'php', 'java', 'kt', 'swift', 'go',
  'rs', 'c', 'cpp', 'h', 'hpp', 'cs',
  'sql', 'graphql', 'gql', 'prisma',
  'dockerfile', 'dockerignore', 'gitignore', 'editorconfig',
  'env', 'env.local', 'env.example',
  'lock', 'log', 'map',
  'vue', 'svelte', 'astro',
]);

function shouldIgnore(name: string): boolean {
  const lower = name.toLowerCase();
  return IGNORE_PATTERNS.some((p) => lower === p);
}

function getExtension(name: string): string {
  const parts = name.split('.');
  if (parts.length < 2) return '';
  return parts[parts.length - 1].toLowerCase();
}

function isTextFile(name: string): boolean {
  const ext = getExtension(name);
  if (!ext) {
    const lower = name.toLowerCase();
    return ['dockerfile', 'makefile', 'readme', 'license', 'changelog'].some(
      (n) => lower.includes(n)
    );
  }
  return TEXT_EXTENSIONS.has(ext);
}

function getBinaryLabel(name: string): string {
  const ext = getExtension(name);
  const labels: Record<string, string> = {
    png: 'PNG Image', jpg: 'JPEG Image', jpeg: 'JPEG Image',
    gif: 'GIF Image', webp: 'WebP Image', svg: 'SVG Image',
    ico: 'Icon', bmp: 'Bitmap Image', tiff: 'TIFF Image',
    mp3: 'Audio (MP3)', mp4: 'Video (MP4)', avi: 'Video (AVI)',
    mov: 'Video (MOV)', wav: 'Audio (WAV)', ogg: 'Audio (OGG)',
    woff: 'Web Font (WOFF)', woff2: 'Web Font (WOFF2)',
    ttf: 'TrueType Font', eot: 'EOT Font', otf: 'OpenType Font',
    zip: 'ZIP Archive', tar: 'TAR Archive', gz: 'GZIP Archive',
    rar: 'RAR Archive', '7z': '7-Zip Archive',
    pdf: 'PDF Document', doc: 'Word Document', docx: 'Word Document',
    xls: 'Excel Spreadsheet', xlsx: 'Excel Spreadsheet',
    ppt: 'PowerPoint', pptx: 'PowerPoint',
    exe: 'Executable', dll: 'Library (DLL)',
    so: 'Shared Library', dylib: 'Dynamic Library',
    db: 'Database File', sqlite: 'SQLite Database',
  };
  return labels[ext] || `Binary file (.${ext || '?'})`;
}

export async function readDirectoryHandle(
  dirHandle: FileSystemDirectoryHandle,
  basePath: string = ''
): Promise<FileNode[]> {
  const nodes: FileNode[] = [];

    for await (const [name, handle] of (dirHandle as any).entries() as AsyncIterableIterator<[string, FileSystemHandle]>) {
    if (shouldIgnore(name)) continue;

    const path = basePath ? `${basePath}/${name}` : name;

    if (handle.kind === 'directory') {
      const children = await readDirectoryHandle(
        handle as FileSystemDirectoryHandle,
        path
      );
      nodes.push({
        name,
        path,
        type: 'directory',
        children,
        size: children.reduce((sum, c) => sum + c.size, 0),
        extension: '',
        isBinary: false,
      });
    } else {
      const file = await (handle as FileSystemFileHandle).getFile();
      const isBinary = !isTextFile(name);
      let content = '';

      if (!isBinary && file.size < 2 * 1024 * 1024) {
        try {
          content = await file.text();
        } catch {
          content = `// [Could not read file: ${name}]`;
        }
      } else {
        content = `// [${getBinaryLabel(name)}]\n// Size: ${formatSize(file.size)}\n// Path: ${path}`;
      }

      nodes.push({
        name,
        path,
        type: 'file',
        content,
        size: file.size,
        extension: getExtension(name),
        isBinary,
      });
    }
  }

  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function flattenFiles(nodes: FileNode[]): FileNode[] {
  const result: FileNode[] = [];
  function walk(items: FileNode[]) {
    for (const item of items) {
      if (item.type === 'file') result.push(item);
      if (item.children) walk(item.children);
    }
  }
  walk(nodes);
  return result;
}

export function getAllPaths(node: FileNode): string[] {
  const paths: string[] = [node.path];
  if (node.children) {
    for (const child of node.children) {
      paths.push(...getAllPaths(child));
    }
  }
  return paths;
}

export function getChildFilePaths(node: FileNode): string[] {
  if (node.type === 'file') return [node.path];
  const paths: string[] = [];
  if (node.children) {
    for (const child of node.children) {
      paths.push(...getChildFilePaths(child));
    }
  }
  return paths;
}

export function countNodes(nodes: FileNode[]): { files: number; dirs: number } {
  let files = 0;
  let dirs = 0;
  function walk(items: FileNode[]) {
    for (const item of items) {
      if (item.type === 'file') files++;
      else { dirs++; if (item.children) walk(item.children); }
    }
  }
  walk(nodes);
  return { files, dirs };
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function generateTreeText(
  nodes: FileNode[],
  prefix: string = ''
): string {
  let result = '';
  nodes.forEach((node, index) => {
    const last = index === nodes.length - 1;
    const connector = last ? '└── ' : '├── ';
    const childPrefix = last ? '    ' : '│   ';

    result += prefix + connector + node.name + '\n';

    if (node.children && node.children.length > 0) {
      result += generateTreeText(node.children, prefix + childPrefix);
    }
  });
  return result;
}

export function generateMarkdownTree(nodes: FileNode[], depth: number = 0): string {
  let result = '';
  const indent = '  '.repeat(depth);
  for (const node of nodes) {
    if (node.type === 'directory') {
      result += `${indent}- 📁 **${node.name}/**\n`;
      if (node.children) result += generateMarkdownTree(node.children, depth + 1);
    } else {
      const icon = node.isBinary ? '🖼️' : '📄';
      result += `${indent}- ${icon} \`${node.name}\`\n`;
    }
  }
  return result;
}

export function generatePathList(nodes: FileNode[]): string {
  const files = flattenFiles(nodes);
  return files.map((f) => f.path).join('\n');
}

export function compileFiles(
  files: FileNode[],
  maxChars: number = 115000
): { parts: string[]; fileMap: { part: number; path: string; chars: number }[] } {
  const parts: string[] = [];
  const fileMap: { part: number; path: string; chars: number }[] = [];
  let currentPart = '';
  let partIndex = 0;

  for (const file of files) {
    if (!file.content) continue;

    const divider = '='.repeat(80);
    const binaryTag = file.isBinary ? ' [BINARY]' : '';
    const header = `\n${divider}\n// FILE: ${file.path}${binaryTag}\n${divider}\n\n`;
    const block = header + file.content + '\n';
    const blockLen = block.length;

    if (currentPart.length + blockLen > maxChars && currentPart.length > 0) {
      parts.push(currentPart);
      partIndex++;
      currentPart = '';
    }

    currentPart += block;
    fileMap.push({ part: partIndex, path: file.path, chars: blockLen });
  }

  if (currentPart.length > 0) {
    parts.push(currentPart);
  }

  return { parts, fileMap };
}

export function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}