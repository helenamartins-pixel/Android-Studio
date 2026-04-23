import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Upload,
  FolderOpen,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Smartphone,
  Globe,
  ArrowRight,
  Layers,
  Code2,
} from "lucide-react";
import { useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type ProjectStatus = "uploading" | "extracting" | "pub_get" | "building" | "completed" | "failed";

function StatusBadge({ status }: { status: ProjectStatus }) {
  const config: Record<ProjectStatus, { label: string; icon: React.ReactNode; className: string }> = {
    uploading: { label: "Uploading", icon: <Loader2 className="w-3 h-3 animate-spin" />, className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
    extracting: { label: "Extracting", icon: <Loader2 className="w-3 h-3 animate-spin" />, className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
    pub_get: { label: "Installing", icon: <Loader2 className="w-3 h-3 animate-spin" />, className: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
    building: { label: "Building", icon: <Loader2 className="w-3 h-3 animate-spin" />, className: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
    completed: { label: "Completed", icon: <CheckCircle2 className="w-3 h-3" />, className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    failed: { label: "Failed", icon: <XCircle className="w-3 h-3" />, className: "bg-red-500/15 text-red-400 border-red-500/30" },
  };
  const c = config[status] || config.failed;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${c.className}`}>
      {c.icon} {c.label}
    </span>
  );
}

export default function Home() {
  const [, navigate] = useLocation();
  const [uploading, setUploading] = useState(false);
  const [buildType, setBuildType] = useState<"web" | "apk">("web");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: projects, isLoading: projectsLoading, refetch } = trpc.project.list.useQuery();

  const deleteMutation = trpc.project.delete.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Project deleted");
    },
  });

  const handleUpload = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".zip")) {
        toast.error("Please upload a ZIP file");
        return;
      }
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("name", file.name.replace(".zip", ""));
        formData.append("buildType", buildType);

        const response = await fetch("/api/flutter/upload", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();
        if (data.success && data.projectId) {
          toast.success("Project uploaded! Starting build pipeline...");
          navigate(`/ide/${data.projectId}`);
        } else {
          toast.error(data.error || "Upload failed");
        }
      } catch (err: any) {
        toast.error(err.message || "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [buildType, navigate]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="h-14 border-b border-border flex items-center px-6 shrink-0 bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Layers className="w-4 h-4 text-primary" />
          </div>
          <h1 className="text-sm font-bold text-foreground tracking-tight">Flutter Web IDE</h1>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-4xl mx-auto w-full space-y-10">
        {/* Upload Section */}
        <section className="space-y-5">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-foreground tracking-tight">New Project</h2>
            <p className="text-sm text-muted-foreground">Upload a Flutter project ZIP to compile in the cloud</p>
          </div>

          {/* Build Type Selector */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground font-medium">Build target:</span>
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setBuildType("web")}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all ${
                  buildType === "web"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Globe className="w-4 h-4" /> Web
              </button>
              <button
                onClick={() => setBuildType("apk")}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all ${
                  buildType === "apk"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Smartphone className="w-4 h-4" /> APK
              </button>
            </div>
          </div>

          {/* Upload Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-14 text-center transition-all cursor-pointer group ${
              dragOver
                ? "border-primary bg-primary/5 scale-[1.005]"
                : "border-border hover:border-primary/40 hover:bg-card/50"
            } ${uploading ? "pointer-events-none opacity-60" : ""}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
              }}
            />
            {uploading ? (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Uploading project...</p>
                  <p className="text-xs text-muted-foreground mt-1">This may take a moment for large projects</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Drop your Flutter project ZIP here
                  </p>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    or click to browse — .zip files up to 500MB
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Projects List */}
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-foreground tracking-tight">Your Projects</h2>
              <p className="text-sm text-muted-foreground">
                {projects?.length ? `${projects.length} project${projects.length > 1 ? "s" : ""}` : "No projects yet"}
              </p>
            </div>
          </div>

          {projectsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !projects || projects.length === 0 ? (
            <Card className="bg-card/50 border-border border-dashed">
              <CardContent className="py-16 text-center">
                <FolderOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-sm font-medium text-muted-foreground">
                  No projects yet
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Upload a Flutter project ZIP to get started
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {projects.map((project: any) => (
                <Card
                  key={project.id}
                  className="bg-card border-border hover:border-primary/30 transition-all cursor-pointer group hover:shadow-lg hover:shadow-primary/5"
                  onClick={() => navigate(`/ide/${project.id}`)}
                >
                  <CardContent className="py-4 px-5 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                      <Code2 className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                        {project.name}
                      </h3>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(project.createdAt).toLocaleDateString()}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          {project.buildType === "web" ? <Globe className="w-3 h-3" /> : <Smartphone className="w-3 h-3" />}
                          {project.buildType.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <StatusBadge status={project.status} />
                    <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary/60 transition-colors" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Delete this project?")) {
                          deleteMutation.mutate({ id: project.id });
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
