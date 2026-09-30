"use client";

import { useEffect, useRef } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { announce } from "@/components/ui/a11y";
import type { AnswerVersion } from "@/store/types";

export interface VersionSwitchProps {
  versions: AnswerVersion[];
  activeVersion: number;
  onSelect: (version: number) => void;
}

/** v1…vN (P6-F11, replaces `VersionPills`) — a `Segmented`, marks the live (newest) version, and announces politely when a new one arrives while an older one is being read. Hidden until a refinement actually produces a second version. */
export function VersionSwitch({ versions, activeVersion, onSelect }: VersionSwitchProps) {
  const seen = useRef(versions.length);

  useEffect(() => {
    if (versions.length > seen.current) {
      const latest = versions[versions.length - 1];
      if (latest) announce(`Version ${latest.version} is now available.`, "polite");
    }
    seen.current = versions.length;
  }, [versions]);

  if (versions.length < 2) return null;
  const live = versions[versions.length - 1]?.version;

  return (
    <Segmented
      label="Answer version"
      size="sm"
      value={String(activeVersion)}
      onValueChange={(value) => onSelect(Number(value))}
      options={versions.map((version) => ({
        value: String(version.version),
        label: version.version === live ? `v${version.version} (live)` : `v${version.version}`,
      }))}
    />
  );
}
