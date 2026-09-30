"use client";

import { InlineAlert } from "@/components/ui/InlineAlert";
import { cn } from "@/lib/cn";
import { useAppStore } from "@/store/useAppStore";

/**
 * The request was split into several readings and none could be verified, so
 * the engine asks which one was meant (P6-F10, replaces `ClarifyPrompt`).
 *
 * Choosing a reading speaks "Sorry, I meant …" through the same timed stream as
 * typed input, so the engine treats it as a self-correction and refines this
 * answer rather than starting a new search.
 */
export function ClarifyChoices({ options }: { options: string[] }) {
  const sendUtterance = useAppStore((state) => state.sendUtterance);
  const isListening = useAppStore((state) => state.isListening);
  if (options.length === 0) return null;

  return (
    <div className="mt-3">
      <InlineAlert tone="info" title="None of these could be verified — which did you mean?">
        <div className="mt-1.5 flex flex-wrap gap-2">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              disabled={isListening}
              onClick={() => sendUtterance(`Sorry, I meant ${option}`)}
              className={cn(
                "min-w-0 max-w-full min-h-hit break-words rounded-3 border border-accent-edge bg-surface px-3 py-1 text-left text-caption text-accent-ink",
                "transition-colors duration-1 ease-standard hover:bg-accent hover:text-on-accent disabled:opacity-40",
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </InlineAlert>
    </div>
  );
}
