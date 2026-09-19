"use client";

import { AlertCircle, X } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { useAppStore } from "@/store/useAppStore";

export function ErrorBanner() {
  const lastError = useAppStore((state) => state.lastError);
  const dismissError = useAppStore((state) => state.dismissError);

  if (!lastError) return null;

  return (
    <div
      role="alert"
      className="flex items-center gap-2 border-b border-edge-error bg-error-soft px-3 py-2 text-caption text-error"
    >
      <AlertCircle size={14} aria-hidden className="shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="font-mono">{lastError.code}:</span> {lastError.message}
      </span>
      <IconButton
        size="sm"
        label="Dismiss"
        icon={<X size={14} aria-hidden />}
        onClick={dismissError}
      />
    </div>
  );
}
