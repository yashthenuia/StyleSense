"use client";
import { useEffect, useState } from "react";

interface ProgressBarProps {
  status: "idle" | "running" | "complete";
  estimatedSeconds?: number;
  label?: string;
}

export function ProgressBar({ status, estimatedSeconds = 60, label = "Processing" }: ProgressBarProps) {
  const [elapsed, setElapsed] = useState(0);
  const progress = estimatedSeconds > 0 ? Math.min((elapsed / estimatedSeconds) * 100, 95) : 0;

  useEffect(() => {
    if (status !== "running") return;

    const interval = setInterval(() => {
      setElapsed((prev) => prev + 0.1);
    }, 100);

    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    if (status === "running") {
      setElapsed(0);
    }
  }, [status]);

  if (status === "idle") return null;

  const seconds = Math.ceil(elapsed);
  const remaining = Math.max(0, estimatedSeconds - seconds);

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          {label}
        </span>
        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          {status === "complete" ? "Done" : `${seconds}s / ${estimatedSeconds}s`}
        </span>
      </div>
      <div
        className="w-full h-2 overflow-hidden"
        style={{
          background: "var(--surface2)",
          border: "1px solid var(--border)",
        }}
      >
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${status === "complete" ? 100 : progress}%`,
            background:
              status === "complete"
                ? "var(--gold)"
                : progress > 80
                  ? "var(--rose)"
                  : "var(--gold)",
          }}
        />
      </div>
    </div>
  );
}
