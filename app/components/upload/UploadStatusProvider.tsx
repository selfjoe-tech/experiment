"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

type Stage = "preparing" | "uploading" | "saving";
type Kind = "video" | "images";
type Task = {
  id: string;
  kind: Kind;
  status: "uploading" | "complete" | "error";
  progress: number;
  label: string;
  error?: string;
};
type UploadControls = {
  onProgress: (percent: number) => void;
  onStageChange: (stage: Stage) => void;
};
type UploadManager = {
  startUpload: (kind: Kind, work: (controls: UploadControls) => Promise<void>) => boolean;
};
const Context = createContext<UploadManager | null>(null);

export function useUploadStatus(): UploadManager {
  const context = useContext(Context);
  if (!context) throw new Error("UploadStatusProvider is missing.");
  return context;
}

/**
 * Keeps a browser-owned upload running through Next.js client-side navigation.
 * It cannot outlive a hard page reload, closed tab, or browser termination.
 */
export default function UploadStatusProvider({ children }: { children: React.ReactNode }) {
  const [task, setTask] = useState<Task | null>(null);
  const taskRef = useRef<Task | null>(null);

  const setCurrent = (next: Task | null) => {
    taskRef.current = next;
    setTask(next);
  };

  const changeTask = (id: string, patch: Partial<Task>) => {
    const current = taskRef.current;
    if (!current || current.id !== id) return;
    setCurrent({ ...current, ...patch });
  };

  const startUpload: UploadManager["startUpload"] = (kind, work) => {
    if (taskRef.current?.status === "uploading") return false;
    const id = crypto.randomUUID();
    setCurrent({ id, kind, progress: 0, label: "Preparing upload…", status: "uploading" });

    const controls: UploadControls = {
      onProgress: (percent) => {
        const current = taskRef.current;
        if (!current || current.id !== id) return;
        const safe = Math.max(0, Math.min(100, Math.floor(percent)));
        changeTask(id, { progress: Math.max(current.progress, safe) });
      },
      onStageChange: (stage) => {
        const subject = kind === "video" ? "video" : "images";
        const label =
          stage === "preparing" ? "Preparing upload…" :
          stage === "uploading" ? `Uploading ${subject}…` : `Saving ${subject}…`;
        changeTask(id, { label });
      },
    };

    void Promise.resolve().then(() => work(controls)).then(() => {
      changeTask(id, { status: "complete", progress: 100, label: "Upload complete" });
      window.setTimeout(() => {
        if (taskRef.current?.id === id && taskRef.current.status === "complete") {
          setCurrent(null);
        }
      }, 2000);
    }).catch((error: unknown) => {
      changeTask(id, {
        status: "error",
        label: "Upload failed",
        error: error instanceof Error ? error.message : "Upload failed. Please retry.",
      });
    });
    return true;
  };

  useEffect(() => {
    if (task?.status !== "uploading") return;
    const protect = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [task?.status]);

  return (
    <Context.Provider value={{ startUpload }}>
      {children}
      {task && <aside role="status" aria-live="polite"
        className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] right-3 z-[200] w-[min(370px,calc(100vw-24px))] rounded-2xl border border-white/15 bg-[#15161b] p-4 text-white shadow-[0_18px_70px_rgba(0,0,0,.7)] lg:bottom-6 lg:right-6">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{task.label}</p>
            {task.status === "uploading" &&
              <p className="mt-1 text-xs text-white/55">Keep this tab open while your upload finishes.</p>}
            {task.status === "error" && <p className="mt-1 text-xs leading-5 text-rose-300">{task.error}</p>}
          </div>
          {task.status !== "uploading" && <button type="button" aria-label="Dismiss upload status"
            onClick={() => setCurrent(null)}
            className="rounded-full p-1 text-white/60 transition hover:bg-white/10 hover:text-white">
            <X size={18} />
          </button>}
          <span className="shrink-0 text-sm font-medium tabular-nums">{task.progress}%</span>
        </div>
        <div role="progressbar" aria-label="Upload progress" aria-valuemin={0} aria-valuemax={100}
          aria-valuenow={task.progress}
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className={`h-full rounded-full transition-[width] duration-150 ${task.status === "error" ? "bg-rose-400" : "bg-pink-500"}`}
            style={{ width: `${task.progress}%` }} />
        </div>
      </aside>}
    </Context.Provider>
  );
}
