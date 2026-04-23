import { trpc } from "@/lib/trpc";
import { FileTree, type FileNode } from "@/components/FileTree";
import { CodeEditor } from "@/components/CodeEditor";
import { BuildTerminal } from "@/components/BuildTerminal";
import { PipelineStatus } from "@/components/PipelineStatus";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  ArrowLeft,
  Download,
  Globe,
  Smartphone,
  Loader2,
  FolderTree,
  RefreshCw,
  FileCode2,
  Layers,
} from "lucide-react";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

type ProjectStatus = "uploading" | "extracting" | "pub_get" | "building" | "completed" | "failed";

export default function IDE() {
  const params = useParams<{ projectId: string }>();
  const projectId = parseInt(params.projectId || "0");
  const [, navigate] = useLocation();

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<ProjectStatus>("uploading");
  const [saving, setSaving] = useState(false);

  // Fetch project details
  const { data: project, refetch: refetchProject } = trpc.project.get.useQuery(
    { id: projectId },
    { enabled: projectId > 0, refetchInterval: 5000 }
  );

  // Fetch file tree
  const { data: files, refetch: refetchFiles } = trpc.project.getFiles.useQuery(
    { projectId },
    {
      enabled: projectId > 0 && currentStatus !== "uploading",
      refetchInterval: currentStatus === "completed" || currentStatus === "failed" ? false : 8000,
    }
  );

  // Fetch file content
  const { data: fileContent, isLoading: fileLoading } = trpc.project.readFile.useQuery(
    { projectId, filePath: selectedFile || "" },
    { enabled: !!selectedFile }
  );

  // Save file mutation
  const saveMutation = trpc.project.saveFile.useMutation({
    onSuccess: () => {
      setSaving(false);
      toast.success("File saved");
    },
    onError: () => {
      setSaving(false);
      toast.error("Failed to save file");
    },
  });

  // Rebuild mutation
  const rebuildMutation = trpc.project.rebuild.useMutation({
    onSuccess: () => {
      toast.success("Rebuild started");
      refetchProject();
    },
  });

  // Update status from project data
  useEffect(() => {
    if (project?.status) {
      setCurrentStatus(project.status as ProjectStatus);
    }
  }, [project?.status]);

  const handleStatusChange = useCallback((status: string) => {
    setCurrentStatus(status as ProjectStatus);
    if (status === "completed" || status === "failed") {
      refetchProject();
      refetchFiles();
    }
  }, [refetchProject, refetchFiles]);

  const handleSaveFile = useCallback(
    (content: string) => {
      if (!selectedFile) return;
      setSaving(true);
      saveMutation.mutate({ projectId, filePath: selectedFile, content });
    },
    [projectId, selectedFile, saveMutation]
  );

  const handleDownload = useCallback(() => {
    window.open(`/api/flutter/download/${projectId}`, "_blank");
  }, [projectId]);

  const handleRebuild = useCallback(
    (type: "web" | "apk") => {
      rebuildMutation.mutate({ projectId, buildType: type });
    },
    [projectId, rebuildMutation]
  );

  // Memoize file tree
  const fileTree = useMemo(() => (files as FileNode[]) || [], [files]);

  if (!project) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background gap-4">
        <FileCode2 className="w-12 h-12 text-muted-foreground/30" />
        <p className="text-muted-foreground font-medium">Loading project...</p>
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top Bar */}
      <header className="h-11 bg-card border-b border-border flex items-center px-3 shrink-0 gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7 shrink-0"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </Button>

        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center shrink-0">
            <Layers className="w-3 h-3 text-primary" />
          </div>
          <span className="text-xs font-bold text-foreground truncate max-w-[180px]">
            {project?.name || "Loading..."}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono uppercase tracking-wider shrink-0">
            {project?.buildType}
          </span>
        </div>

        {/* Pipeline Status - centered */}
        <div className="flex-1 flex justify-center">
          <PipelineStatus status={currentStatus} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] gap-1 px-2 text-muted-foreground hover:text-foreground"
            onClick={() => {
              refetchFiles();
              toast.info("Files refreshed");
            }}
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </Button>

          <div className="w-px h-4 bg-border mx-0.5" />

          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] gap-1 px-2 text-muted-foreground hover:text-foreground"
            onClick={() => handleRebuild("web")}
            disabled={rebuildMutation.isPending}
          >
            <Globe className="w-3 h-3" /> Build Web
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] gap-1 px-2 text-muted-foreground hover:text-foreground"
            onClick={() => handleRebuild("apk")}
            disabled={rebuildMutation.isPending}
          >
            <Smartphone className="w-3 h-3" /> Build APK
          </Button>

          {currentStatus === "completed" && (
            <>
              <div className="w-px h-4 bg-border mx-0.5" />
              <Button
                size="sm"
                className="h-7 text-[11px] gap-1 px-3"
                onClick={handleDownload}
              >
                <Download className="w-3 h-3" /> Download
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Main IDE Area */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* Sidebar - File Explorer */}
          <ResizablePanel defaultSize={18} minSize={12} maxSize={30}>
            <div className="h-full flex flex-col bg-sidebar">
              <div className="h-8 border-b border-sidebar-border flex items-center px-3 shrink-0">
                <FolderTree className="w-3.5 h-3.5 text-sidebar-foreground/50 mr-2" />
                <span className="text-[11px] font-semibold text-sidebar-foreground/70 uppercase tracking-widest">
                  Explorer
                </span>
              </div>
              <div className="flex-1 overflow-auto py-1">
                {fileTree.length > 0 ? (
                  <FileTree
                    files={fileTree}
                    selectedFile={selectedFile}
                    onSelectFile={setSelectedFile}
                  />
                ) : (
                  <div className="p-4 text-xs text-muted-foreground/40 text-center">
                    {currentStatus === "completed" || currentStatus === "failed"
                      ? "No files found"
                      : "Files will appear after extraction..."}
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle className="w-[1px] bg-border hover:bg-primary/50 transition-colors" />

          {/* Editor + Terminal */}
          <ResizablePanel defaultSize={82}>
            <ResizablePanelGroup direction="vertical">
              {/* Editor Area */}
              <ResizablePanel defaultSize={60} minSize={20}>
                {selectedFile && fileContent !== undefined && fileContent !== null ? (
                  <CodeEditor
                    content={fileContent}
                    filePath={selectedFile}
                    onSave={handleSaveFile}
                    saving={saving}
                  />
                ) : selectedFile && fileLoading ? (
                  <div className="h-full flex items-center justify-center bg-card">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center bg-card gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center">
                      <FileCode2 className="w-8 h-8 text-muted-foreground/20" />
                    </div>
                    <p className="text-sm text-muted-foreground/40 font-medium">
                      Select a file from the explorer to edit
                    </p>
                    <p className="text-xs text-muted-foreground/25">
                      Ctrl+S to save changes
                    </p>
                  </div>
                )}
              </ResizablePanel>

              <ResizableHandle className="h-[1px] bg-border hover:bg-primary/50 transition-colors" />

              {/* Terminal */}
              <ResizablePanel defaultSize={40} minSize={15}>
                <BuildTerminal
                  projectId={projectId}
                  onStatusChange={handleStatusChange}
                />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Status Bar */}
      <footer className="h-6 bg-[oklch(0.12_0.015_260)] border-t border-border flex items-center px-3 shrink-0">
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground/70 w-full">
          <span className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${
              currentStatus === "completed" ? "bg-emerald-400" 
              : currentStatus === "failed" ? "bg-red-400" 
              : "bg-primary animate-pulse"
            }`} />
            {currentStatus === "pub_get" ? "PUB GET" : currentStatus.toUpperCase()}
          </span>
          {selectedFile && (
            <>
              <div className="w-px h-3 bg-border" />
              <span className="font-mono">{selectedFile}</span>
            </>
          )}
          <span className="ml-auto flex items-center gap-1.5">
            <Layers className="w-3 h-3" />
            Flutter Web IDE
          </span>
        </div>
      </footer>
    </div>
  );
}
