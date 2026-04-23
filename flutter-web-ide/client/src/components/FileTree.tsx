import { useState } from "react";
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from "lucide-react";

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
  collapsed?: boolean;
}

interface FileTreeProps {
  files: FileNode[];
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  depth?: number;
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  const iconColors: Record<string, string> = {
    dart: "text-blue-400",
    yaml: "text-pink-400",
    yml: "text-pink-400",
    json: "text-yellow-400",
    xml: "text-orange-400",
    md: "text-gray-400",
    txt: "text-gray-400",
    html: "text-orange-500",
    css: "text-blue-500",
    js: "text-yellow-500",
    ts: "text-blue-600",
    tsx: "text-blue-600",
    jsx: "text-yellow-500",
    png: "text-green-400",
    jpg: "text-green-400",
    svg: "text-purple-400",
    gradle: "text-emerald-400",
    kt: "text-purple-500",
    swift: "text-orange-500",
    lock: "text-gray-500",
  };
  return iconColors[ext || ""] || "text-muted-foreground";
}

export function FileTree({ files, selectedFile, onSelectFile, depth = 0 }: FileTreeProps) {
  return (
    <div className="select-none">
      {files.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          selectedFile={selectedFile}
          onSelectFile={onSelectFile}
          depth={depth}
        />
      ))}
    </div>
  );
}

function FileTreeNode({
  node,
  selectedFile,
  onSelectFile,
  depth,
}: {
  node: FileNode;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(!node.collapsed && depth < 2);
  const isSelected = selectedFile === node.path;

  if (node.type === "directory") {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={`w-full flex items-center gap-1 py-[3px] px-2 text-xs hover:bg-muted/50 transition-colors rounded-sm group`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          )}
          {expanded ? (
            <FolderOpen className="w-3.5 h-3.5 text-yellow-500/80 shrink-0" />
          ) : (
            <Folder className="w-3.5 h-3.5 text-yellow-500/80 shrink-0" />
          )}
          <span className="truncate text-sidebar-foreground font-medium">{node.name}</span>
        </button>
        {expanded && node.children && (
          <FileTree
            files={node.children}
            selectedFile={selectedFile}
            onSelectFile={onSelectFile}
            depth={depth + 1}
          />
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => onSelectFile(node.path)}
      className={`w-full flex items-center gap-1.5 py-[3px] px-2 text-xs transition-colors rounded-sm ${
        isSelected
          ? "bg-primary/15 text-primary"
          : "text-sidebar-foreground hover:bg-muted/50"
      }`}
      style={{ paddingLeft: `${depth * 16 + 24}px` }}
    >
      <File className={`w-3.5 h-3.5 shrink-0 ${getFileIcon(node.name)}`} />
      <span className="truncate">{node.name}</span>
    </button>
  );
}
