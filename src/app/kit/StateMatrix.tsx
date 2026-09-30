"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Panel } from "@/components/ui/Panel";
import { Skeleton } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
import { StatusDot } from "@/components/ui/StatusDot";
import { Section } from "./Section";

/**
 * Every state a view has to design (PHASES.md §3.1, principle 6): empty, loading,
 * streaming, error, degraded, cancelled, offline. Each is built from the primitives
 * only, so the views built later show the same thing in the same way.
 */
export function StateMatrix() {
  return (
    <Section id="states" title="States" note="Empty, loading, streaming, error, degraded, cancelled, offline.">
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <Panel title="Empty" level={3}>
          <EmptyState title="No turns yet" action={<Button variant="primary">Replay a test case</Button>}>
            Ask a question or replay a test case.
          </EmptyState>
        </Panel>

        <Panel title="Loading" level={3}>
          <div className="flex flex-col gap-3">
            <Spinner label="Loading the trace" />
            <Skeleton lines={4} label="Loading turn t3" />
          </div>
        </Panel>

        <Panel title="Streaming" level={3}>
          <div className="flex min-w-0 flex-col gap-2">
            <Badge tone="accent" glyph={<StatusDot decorative shape="filled" tone="retrieve" />}>
              Streaming
            </Badge>
            <p className="text-body text-ink-body">The Riverside Hall allows a full refund when the booking is cancelled fifteen or more</p>
            <span className="inline-flex items-center gap-2 text-caption text-ink-muted">
              <Spinner size="sm" label="Answer arriving" /> Answer arriving
            </span>
          </div>
        </Panel>

        <Panel title="Error" level={3}>
          <InlineAlert tone="error" title="Engine unreachable" action={<Button size="sm">Retry</Button>}>
            The stream closed before the turn finished.
          </InlineAlert>
        </Panel>

        <Panel title="Degraded" level={3}>
          <div className="flex min-w-0 flex-col gap-2">
            <Badge tone="warn">Degraded</Badge>
            <InlineAlert tone="warn" title="Timing is reconstructed">
              This record has no event log, so the waterfall is modelled from its totals, not measured.
            </InlineAlert>
          </div>
        </Panel>

        <Panel title="Cancelled" level={3}>
          <div className="flex min-w-0 flex-col gap-2">
            <Badge glyph={<StatusDot decorative shape="barred" tone="suppress" />}>Cancelled</Badge>
            <InlineAlert tone="info">The controller cancelled this search because the intent changed.</InlineAlert>
          </div>
        </Panel>

        <Panel title="Offline" level={3}>
          <div className="flex min-w-0 flex-col gap-2">
            <Badge glyph={<StatusDot decorative shape="ring" tone="wait" />}>Offline</Badge>
            <InlineAlert tone="warn" title="You are offline" action={<Button size="sm">Try again</Button>}>
              Showing the last data that was loaded.
            </InlineAlert>
          </div>
        </Panel>
      </div>
    </Section>
  );
}
