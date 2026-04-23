import { CheckCircle2, Circle, Loader2, XCircle, Upload, FolderOpen, Package, Hammer, Rocket } from "lucide-react";

type ProjectStatus = "uploading" | "extracting" | "pub_get" | "building" | "completed" | "failed";

interface PipelineStatusProps {
  status: ProjectStatus;
}

const steps = [
  { key: "uploading", label: "Upload", icon: Upload },
  { key: "extracting", label: "Extract", icon: FolderOpen },
  { key: "pub_get", label: "Pub Get", icon: Package },
  { key: "building", label: "Build", icon: Hammer },
  { key: "completed", label: "Ready", icon: Rocket },
];

const statusOrder: Record<string, number> = {
  uploading: 0,
  extracting: 1,
  pub_get: 2,
  building: 3,
  completed: 4,
  failed: -1,
};

export function PipelineStatus({ status }: PipelineStatusProps) {
  const currentIndex = statusOrder[status] ?? -1;
  const isFailed = status === "failed";

  return (
    <div className="flex items-center gap-1 px-2">
      {steps.map((step, index) => {
        const StepIcon = step.icon;
        let state: "done" | "active" | "pending" | "failed" = "pending";

        if (isFailed) {
          if (index < currentIndex || currentIndex === -1) state = "failed";
          else state = "pending";
        } else if (index < currentIndex) {
          state = "done";
        } else if (index === currentIndex) {
          state = "active";
        }

        return (
          <div key={step.key} className="flex items-center gap-1">
            {index > 0 && (
              <div
                className={`w-6 h-[2px] rounded-full transition-colors ${
                  state === "done"
                    ? "bg-emerald-500"
                    : state === "active"
                    ? "bg-primary"
                    : state === "failed"
                    ? "bg-red-500"
                    : "bg-border"
                }`}
              />
            )}
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
                state === "done"
                  ? "text-emerald-400 bg-emerald-500/10"
                  : state === "active"
                  ? "text-primary bg-primary/10"
                  : state === "failed"
                  ? "text-red-400 bg-red-500/10"
                  : "text-muted-foreground/50"
              }`}
            >
              {state === "done" ? (
                <CheckCircle2 className="w-3 h-3" />
              ) : state === "active" ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : state === "failed" ? (
                <XCircle className="w-3 h-3" />
              ) : (
                <Circle className="w-3 h-3" />
              )}
              <span className="hidden sm:inline">{step.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
