"use client";

import { ArrowUp, Radio, Square } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { Textarea } from "@/components/ui/Textarea";
import { useHotkeys } from "@/hooks/useHotkeys";
import { cn } from "@/lib/cn";
import { withViewTransition } from "@/lib/viewTransition";
import { featuredFixtures } from "@/store/selectors";
import { useAppStore } from "@/store/useAppStore";

/**
 * The input (P6-F06). `⌘/Ctrl+Enter` sends, plain `Enter` writes a newline
 * (the previous console sent on plain `Enter`, which made a multi-line request
 * impossible to type); `Esc` stops. No pill: the send control is a square
 * `IconButton`, radius-2, like every other control in the system.
 */
export function Composer() {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const phase = useAppStore((state) => state.phase);
  const isListening = useAppStore((state) => state.isListening);
  const connection = useAppStore((state) => state.connection);
  const sendUtterance = useAppStore((state) => state.sendUtterance);
  const stopStreaming = useAppStore((state) => state.stopStreaming);
  const replayFixture = useAppStore((state) => state.replayFixture);
  const fixtures = useAppStore((state) => state.fixtures);

  const submit = useCallback(() => {
    const text = value.trim();
    if (!text || isListening) return;
    setValue("");
    // Only the first send moves the composer, so only that one is a transition.
    if (phase === "idle") withViewTransition(() => sendUtterance(text));
    else sendUtterance(text);
  }, [isListening, phase, sendUtterance, value]);

  useHotkeys([
    { key: "enter", mod: true, allowInInput: true, handler: submit },
    { key: "escape", allowInInput: true, handler: () => isListening && stopStreaming() },
  ]);

  const disabled = connection === "closed";
  const firstFixture = featuredFixtures(fixtures)[0];

  return (
    <div className="composer-shell pb-safe-bottom pt-1">
      <div
        className={cn(
          "flex items-end gap-2 rounded-2 border bg-surface-2 px-3 py-2.5",
          "transition-[border-color,box-shadow] duration-2 ease-standard",
          "focus-within:border-accent focus-within:shadow-float",
          disabled ? "border-line opacity-60" : "border-line",
        )}
      >
        <IconButton
          size="sm"
          label={firstFixture ? `Replay transcript: ${firstFixture.label}` : "Replay transcript"}
          icon={<Radio size={16} aria-hidden />}
          disabled={disabled || isListening}
          onClick={() => firstFixture && replayFixture(firstFixture.fixture.id)}
          className="mb-0.5"
        />

        <label className="sr-only" htmlFor="composer-input">
          Your request
        </label>
        <Textarea
          id="composer-input"
          ref={textareaRef}
          minRows={1}
          maxRows={8}
          value={value}
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
          placeholder={
            disabled
              ? "Waiting for the engine: start the backend on port 8000 and this connects by itself."
              : isListening
                ? "Streaming your utterance…"
                : "Ask one natural request. It can hide several questions. (⌘/Ctrl+Enter to send)"
          }
          className="flex-1 border-none bg-transparent px-0 py-0 text-body text-ink-body outline-none placeholder:text-ink-muted"
        />

        {isListening ? (
          <IconButton size="sm" label="Stop streaming (Esc)" icon={<Square size={14} aria-hidden fill="currentColor" />} onClick={stopStreaming} className="mb-0.5" />
        ) : (
          <IconButton
            size="sm"
            label="Send request (⌘/Ctrl+Enter)"
            icon={<ArrowUp size={16} aria-hidden />}
            disabled={disabled || value.trim().length === 0}
            onClick={submit}
            className={cn("mb-0.5", value.trim().length > 0 && !disabled && "bg-accent text-on-accent hover:bg-accent-hover")}
          />
        )}
      </div>
    </div>
  );
}
