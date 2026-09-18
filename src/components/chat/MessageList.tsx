"use client";

import { ArrowDown } from "lucide-react";
import { AssistantMessage } from "@/components/chat/AssistantMessage";
import { UserBubble } from "@/components/chat/UserBubble";
import { Button } from "@/components/ui/Button";
import { useStickToBottom } from "@/hooks/useStickToBottom";
import { useAppStore } from "@/store/useAppStore";
import type { Turn } from "@/store/types";

function transcriptText(turn: Turn): string {
  return turn.transcript.map((chunk) => chunk.text).join(" ");
}

/** A rendering key that changes whenever anything visible in the list changes. */
function streamSignature(turns: Turn[]): string {
  const last = turns[turns.length - 1];
  if (!last) return "0";
  const body = last.versions.reduce((total, version) => total + version.body.length, 0);
  return `${turns.length}:${last.transcript.length}:${body}:${last.status}`;
}

export function MessageList() {
  const turns = useAppStore((state) => state.turns);
  const { ref, isPinned, scrollToBottom } = useStickToBottom<HTMLDivElement>(streamSignature(turns));

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={ref} className="scroll-thin h-full overflow-y-auto pb-4 pt-6">
        <ol className="space-y-8">
          {turns.map((turn) => (
            <li key={turn.id} className="space-y-3">
              <UserBubble text={transcriptText(turn)} />
              <AssistantMessage turn={turn} />
            </li>
          ))}
        </ol>
      </div>

      {!isPinned && (
        <Button
          variant="outline"
          size="sm"
          onClick={scrollToBottom}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 shadow-lift"
        >
          <ArrowDown size={13} aria-hidden />
          Jump to latest
        </Button>
      )}
    </div>
  );
}
