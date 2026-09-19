"use client";

import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { useAppStore } from "@/store/useAppStore";

/**
 * The request was split into several readings and the documents confirmed none
 * of them, so the engine asks which one was meant instead of guessing.
 *
 * Choosing a reading speaks "Sorry, I meant …" through the same timed stream
 * as typed input, so the engine treats it as a self-correction and refines this
 * answer rather than starting a new search.
 */
export function ClarifyPrompt({ options }: { options: string[] }) {
  const sendUtterance = useAppStore((state) => state.sendUtterance);
  const isListening = useAppStore((state) => state.isListening);
  if (options.length === 0) return null;

  return (
    <div className="mt-4 rounded-md border border-l-[3px] border-line border-l-primary bg-primary-soft px-3.5 py-3">
      <p className="flex items-center gap-1.5 text-label font-semibold text-primary-ink">
        <HelpCircle size={14} aria-hidden />
        None of these could be verified. Which did you mean?
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            disabled={isListening}
            onClick={() => sendUtterance(`Sorry, I meant ${option}`)}
            className={cn(
              "rounded-pill border border-edge-primary bg-raised px-3 py-1 text-caption text-primary-ink",
              "transition-colors hover:bg-primary hover:text-white disabled:opacity-40",
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
