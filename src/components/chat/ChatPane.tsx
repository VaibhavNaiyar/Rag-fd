"use client";

import { Composer } from "@/components/chat/Composer";
import { Greeting } from "@/components/chat/Greeting";
import { MessageList } from "@/components/chat/MessageList";
import { TranscriptStrip } from "@/components/chat/TranscriptStrip";
import { cn } from "@/lib/cn";
import { useAppStore } from "@/store/useAppStore";

/**
 * The composer state machine, in one flex column.
 *
 * IDLE      no turns yet    → composer centred, greeting above
 * ACTIVE    at least 1 turn → composer docked, message list fills the space
 * LISTENING utterance open  → transcript strip mounts directly above the composer
 *
 * Only the justification changes between phases, which is what lets the View
 * Transition animate the composer's travel rather than a cross-fade.
 */
export function ChatPane() {
  const phase = useAppStore((state) => state.phase);
  const isListening = useAppStore((state) => state.isListening);

  return (
    <main
      className={cn(
        "mx-auto flex h-full w-full max-w-3xl min-w-0 flex-col px-4",
        phase === "idle" ? "justify-center" : "justify-end",
      )}
    >
      {phase === "idle" ? <Greeting /> : <MessageList />}
      {isListening && <TranscriptStrip />}
      <Composer />
    </main>
  );
}
