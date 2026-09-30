"use client";

import { cn } from "@/lib/cn";
import type { AnswerVersion } from "@/store/types";

export interface VersionPillsProps {
  versions: AnswerVersion[];
  activeVersion: number;
  onSelect: (version: number) => void;
}

/** v1 · v2 selector. Hidden until a refinement actually produces a second version. */
export function VersionPills({ versions, activeVersion, onSelect }: VersionPillsProps) {
  if (versions.length < 2) return null;

  return (
    <div
      role="group"
      aria-label="Answer versions"
      className="inline-flex items-center gap-0.5 rounded-pill border border-line bg-sunken p-0.5"
    >
      {versions.map((version) => {
        const active = version.version === activeVersion;
        return (
          <button
            key={version.version}
            type="button"
            onClick={() => onSelect(version.version)}
            aria-pressed={active}
            className={cn(
              "rounded-pill px-2.5 py-0.5 font-mono text-caption transition-colors duration-150 ease-oneui",
              active ? "bg-primary text-[var(--on-primary)]" : "text-ink-muted hover:text-ink-body",
            )}
          >
            v{version.version}
          </button>
        );
      })}
    </div>
  );
}
