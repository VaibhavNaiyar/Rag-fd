"use client";

import { ArrowUp, Radio, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/lib/cn";
import { withViewTransition } from "@/lib/viewTransition";
import { featuredFixtures } from "@/store/selectors";
import { useAppStore } from "@/store/useAppStore";

const MAX_TEXTAREA_PX = 200;

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

  // Grow with the content, then scroll — no layout jump mid-sentence.
  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, MAX_TEXTAREA_PX)}px`;
  }, [value]);

  const submit = useCallback(() => {
    const text = value.trim();
    if (!text || isListening) return;
    setValue("");

    // Only the first send moves the composer, so only that one is a transition.
    if (phase === "idle") withViewTransition(() => sendUtterance(text));
    else sendUtterance(text);
  }, [isListening, phase, sendUtterance, value]);

  const disabled = connection === "closed";
  const firstFixture = featuredFixtures(fixtures)[0];

  return (
    <div className="composer-shell pb-4 pt-1">
      <div
        className={cn(
          "flex items-end gap-2 rounded-lg border bg-sunken px-3 py-2.5",
          "transition-[border-color,box-shadow] duration-200 ease-oneui",
          "focus-within:border-primary focus-within:shadow-card",
          disabled ? "border-line opacity-60" : "border-line",
        )}
      >
        <IconButton
          size="sm"
          label={
            firstFixture ? `Replay transcript: ${firstFixture.label}` : "Replay transcript"
          }
          icon={<Radio size={16} aria-hidden />}
          disabled={disabled || isListening}
          onClick={() => firstFixture && replayFixture(firstFixture.fixture.id)}
          className="mb-0.5"
        />

        <label className="sr-only" htmlFor="composer-input">
          Your request
        </label>
        <textarea
          id="composer-input"
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={
            disabled
              ? "Waiting for the engine: start the backend on port 8000 and this connects by itself."
              : isListening
                ? "Streaming your utterance…"
                : "Ask one natural request. It can hide several questions."
          }
          className={cn(
            "scroll-thin max-h-[200px] min-h-[24px] flex-1 resize-none bg-transparent",
            "text-body text-ink-body outline-none placeholder:text-ink-muted",
          )}
        />

        {isListening ? (
          <IconButton
            size="sm"
            label="Stop streaming (Esc)"
            icon={<Square size={14} aria-hidden fill="currentColor" />}
            onClick={stopStreaming}
            className="mb-0.5 bg-sunken text-ink-body"
          />
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={disabled || value.trim().length === 0}
            aria-label="Send request"
            className={cn(
              "mb-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-pill",
              "bg-primary text-white transition-[filter,opacity] duration-150 ease-oneui",
              "hover:brightness-110 disabled:opacity-30",
            )}
          >
            <ArrowUp size={16} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
