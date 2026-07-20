import { useEffect, useState } from "react";
import { Loader2, Check, AlertCircle, Info } from "lucide-react";
import { subscribeSaveStatus, type SaveStatus } from "@/lib/save-status";
import { cn } from "@/lib/utils";

export function SaveStatusIndicator() {
  const [status, setStatus] = useState<SaveStatus>({ state: "idle" });

  useEffect(() => subscribeSaveStatus(setStatus), []);

  if (status.state === "idle") return null;

  const styles: Record<Exclude<SaveStatus["state"], "idle">, string> = {
    saving: "bg-slate-900/90 text-white border-slate-700",
    saved: "bg-emerald-600/95 text-white border-emerald-500",
    error: "bg-red-600/95 text-white border-red-500",
    "not-saved": "bg-amber-500/95 text-white border-amber-400",
  };

  const icon =
    status.state === "saving" ? (
      <Loader2 className="h-4 w-4 animate-spin" />
    ) : status.state === "saved" ? (
      <Check className="h-4 w-4" />
    ) : status.state === "error" ? (
      <AlertCircle className="h-4 w-4" />
    ) : (
      <Info className="h-4 w-4" />
    );

  const label =
    status.message ??
    (status.state === "saving"
      ? "Saving…"
      : status.state === "saved"
      ? "Info saved"
      : status.state === "error"
      ? "Save failed"
      : "Not saved");

  return (
    <div
      className={cn(
        "pointer-events-none fixed right-3 top-[68px] z-50 flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur-sm sm:right-4 sm:top-[76px] sm:text-sm",
        styles[status.state],
      )}
      role="status"
      aria-live="polite"
    >
      {icon}
      <span>{label}</span>
    </div>
  );
}
