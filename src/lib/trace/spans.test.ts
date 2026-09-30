import { describe, expect, it } from "vitest";
import { buildSpanTree, flattenSpans } from "@/lib/trace/spans";
import { fixtureRecord, loadTraceFixtures } from "@/test/fixtures";

describe("buildSpanTree", () => {
  it("windows every node exactly as otel.py's OtelExporter._export computes them, on every fixture", () => {
    for (const record of loadTraceFixtures().flatMap((f) => f.records)) {
      const tree = buildSpanTree(record);
      const t0 = 0;
      const endMs = record.utterance_end_ms;
      const latency = record.latency_ms;
      const doneMs = latency?.complete_abs ?? endMs ?? 0;
      const firstToken = latency?.first_token_abs ?? null;
      const firstSearch = record.first_retrieval_ms;
      const planMs = record.decomposition?.ms ?? null;

      expect(tree.startMs).toBe(t0);
      expect(tree.endMs).toBe(doneMs);

      const listen = tree.children.find((c) => c.kind === "listen");
      const plan = tree.children.find((c) => c.kind === "plan");
      const retrieve = tree.children.find((c) => c.kind === "retrieve");
      const synthesise = tree.children.find((c) => c.kind === "synthesise");

      if (endMs !== null) {
        expect(listen?.startMs).toBe(0);
        expect(listen?.endMs).toBe(endMs);
        if (planMs !== null) {
          expect(plan?.startMs).toBe(endMs);
          expect(plan?.endMs).toBe(endMs + planMs);
        } else {
          expect(plan).toBeUndefined();
        }
      } else {
        expect(listen).toBeUndefined();
      }

      if (firstSearch !== null) {
        expect(retrieve?.startMs).toBe(firstSearch);
        expect(retrieve?.endMs).toBe(firstToken ?? doneMs);
      } else {
        expect(retrieve).toBeUndefined();
      }

      if (firstToken !== null) {
        const modelledStart = endMs !== null && planMs !== null ? endMs + planMs : firstToken;
        expect(synthesise?.startMs).toBe(Math.min(modelledStart, firstToken));
        expect(synthesise?.endMs).toBe(doneMs);
        expect(synthesise?.markers.some((m) => m.kind === "first_token" && m.atMs === firstToken)).toBe(true);
      } else {
        expect(synthesise).toBeUndefined();
      }
    }
  });

  it("no NaN and no inverted windows anywhere in the tree, on every fixture", () => {
    for (const record of loadTraceFixtures().flatMap((f) => f.records)) {
      for (const span of flattenSpans(buildSpanTree(record))) {
        if (span.startMs !== null) expect(Number.isNaN(span.startMs)).toBe(false);
        if (span.endMs !== null) expect(Number.isNaN(span.endMs)).toBe(false);
        if (span.startMs !== null && span.endMs !== null) expect(span.endMs).toBeGreaterThanOrEqual(span.startMs);
      }
    }
  });

  it("a cancelled search is a child of retrieve, not its own top-level row, and carries its cancel reason", () => {
    const record = fixtureRecord("compound_01", "t1"); // compound_01: t1_p1 launches then is cancelled (topic_shift)
    const tree = buildSpanTree(record);
    const retrieve = tree.children.find((c) => c.kind === "retrieve");
    const cancelled = retrieve?.children.find((c) => c.id === "search-t1_p1");
    expect(cancelled?.cancelled).toBe(true);
    expect(cancelled?.cancelReason).toBe("topic_shift");
    // t1_p1 never produced a kept result, so it must not appear twice.
    expect(retrieve?.children.filter((c) => c.id === "search-t1_p1")).toHaveLength(1);
  });

  it("a completed search's duration comes from retrieval[].ms, not from the next event's timestamp", () => {
    const files = loadTraceFixtures();
    const compound = files.find((f) => f.fixture === "compound_01")?.records[0];
    expect(compound).toBeDefined();
    if (!compound) return;
    const tree = buildSpanTree(compound);
    const retrieve = tree.children.find((c) => c.kind === "retrieve");
    const launch = compound.retrieval_events.find((e) => "trigger" in e && e.sub_query_id === "t1_p2");
    const result = compound.retrieval.find((r) => r.sub_query_id === "t1_p2");
    expect(launch).toBeDefined();
    expect(result).toBeDefined();
    const child = retrieve?.children.find((c) => c.id === "search-t1_p2");
    if (launch && "at_ms" in launch && result) expect(child?.endMs).toBe(launch.at_ms + result.ms);
  });

  it("a suppressed turn with no retrieval still synthesises, with no retrieve or plan span", () => {
    const files = loadTraceFixtures();
    const suppressed = files.flatMap((f) => f.records).find((r) => r.mode === "suppress");
    expect(suppressed).toBeDefined();
    if (!suppressed) return;
    const tree = buildSpanTree(suppressed);
    expect(tree.children.find((c) => c.kind === "retrieve")).toBeUndefined();
    expect(tree.children.find((c) => c.kind === "plan")).toBeUndefined();
    expect(tree.children.find((c) => c.kind === "listen")).toBeDefined();
    expect(tree.children.find((c) => c.kind === "synthesise")).toBeDefined();
  });

  it("decision markers on listen carry every decision, in order, with their signals", () => {
    const record = fixtureRecord("compound_01", "t1");
    const tree = buildSpanTree(record);
    const listen = tree.children.find((c) => c.kind === "listen");
    expect(listen?.markers).toHaveLength(record.decisions.length);
    listen?.markers.forEach((marker, i) => {
      if (marker.kind !== "decision") throw new Error("expected a decision marker");
      expect(marker.atMs).toBe(record.decisions[i]?.at_ms);
      expect(marker.decision).toBe(record.decisions[i]?.decision);
    });
  });

  it("the turn node's metrics come straight from cost, never invented", () => {
    for (const record of loadTraceFixtures().flatMap((f) => f.records)) {
      const tree = buildSpanTree(record);
      expect(tree.metrics.costUsd).toBe(record.cost?.turnUsd ?? null);
      expect(tree.metrics.tokens).toBe(record.cost?.turnTokens ?? null);
    }
  });
});
