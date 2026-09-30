"use client";

import { ListTree } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FixtureTable } from "@/components/console/FixtureTable";
import { useAppStore } from "@/store/useAppStore";

/**
 * The idle state (P6-F12, replaces `Greeting`). No headline, no suggestion
 * cards — those read as marketing, and a judge or a tester wants the test
 * cases themselves, not a curated four. "No turns yet" plus a way to browse
 * every fixture the engine can replay.
 */
export function EmptyConsole() {
  const fixtures = useAppStore((state) => state.fixtures);
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-auto w-full max-w-md pb-8">
      <EmptyState title="No turns yet" action={fixtures.length > 0 && <Button variant="secondary" icon={<ListTree size={14} aria-hidden />} onClick={() => setOpen(true)}>Browse {fixtures.length} test cases</Button>}>
        Type a request below, or run one of the engine&rsquo;s recorded test cases.
      </EmptyState>
      <FixtureTable open={open} onOpenChange={setOpen} />
    </div>
  );
}
