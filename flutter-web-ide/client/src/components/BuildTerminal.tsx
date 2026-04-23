import { useEffect, useRef, useState } from "react";
import { Terminal as TerminalIcon, Trash2, ArrowDown } from "lucide-react";

interface BuildTerminalProps {
  projectId: number;
  onStatusChange?: (status: string) => void;
}

interface LogEntry {
  step: string;
  message: string;
  timestamp: number;
}

const stepColors: Record<string, string> = {
  upload: "\x1b[36m",    // cyan
  extract: "\x1b[33m",   // yellow
  pub_get: "\x1b[35m",   // magenta
  build: "\x1b[34m",     // blue
  complete: "\x1b[32m",  // green
  error: "\x1b[31m",     // red
};

export function BuildTerminal({ projectId, onStatusChange }: BuildTerminalProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  useEffect(() => {
    if (!projectId) return;

    const eventSource = new EventSource(`/api/flutter/logs/${projectId}/stream`);

    eventSource.onopen = () => {
      setConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "log") {
          setLogs((prev) => [...prev, { step: data.step, message: data.message, timestamp: Date.now() }]);
        } else if (data.type === "status") {
          onStatusChange?.(data.status);
        }
      } catch {}
    };

    eventSource.onerror = () => {
      setConnected(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [projectId, onStatusChange]);

  // Auto-scroll
  useEffect(() => {
    if (autoScrollRef.current && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const handleScroll = () => {
    if (!terminalRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = terminalRef.current;
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 50;
  };

  const scrollToBottom = () => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
      autoScrollRef.current = true;
    }
  };

  return (
    <div className="h-full flex flex-col bg-[oklch(0.11_0.01_260)]">
      {/* Terminal header */}
      <div className="h-8 bg-card border-b border-border flex items-center px-3 shrink-0">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Build Output</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400" : "bg-muted-foreground"}`} />
          <span className="text-[10px] text-muted-foreground">{connected ? "Live" : "Disconnected"}</span>
          <button
            onClick={() => setLogs([])}
            className="p-1 hover:bg-muted rounded transition-colors"
            title="Clear logs"
          >
            <Trash2 className="w-3 h-3 text-muted-foreground" />
          </button>
          <button
            onClick={scrollToBottom}
            className="p-1 hover:bg-muted rounded transition-colors"
            title="Scroll to bottom"
          >
            <ArrowDown className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Terminal content */}
      <div
        ref={terminalRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto p-3 font-mono text-xs leading-5"
      >
        {logs.length === 0 ? (
          <div className="text-muted-foreground/50 italic">
            Waiting for build output...
          </div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="whitespace-pre-wrap break-all">
              <span className={getStepColor(log.step)}>[{log.step}]</span>{" "}
              <span className="text-foreground/80">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function getStepColor(step: string): string {
  const colors: Record<string, string> = {
    upload: "text-cyan-400",
    extract: "text-yellow-400",
    pub_get: "text-purple-400",
    build: "text-blue-400",
    complete: "text-emerald-400",
    error: "text-red-400",
  };
  return colors[step] || "text-muted-foreground";
}
