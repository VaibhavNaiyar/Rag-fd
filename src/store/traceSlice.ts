import { fetchTrace, type FetchTraceResult } from "@/lib/traceClient";
import { turnKey } from "@/store/reducer";
import type { TraceRecord } from "@/types/trace";

/**
 * Enrichment for the Inspector: one `/trace` fetch per turn, cached by
 * {@link turnKey} (never by the bare turn id — SD-01), de-duplicated so two
 * callers wanting the same turn at once share one request, and capped so a long
 * session cannot grow this without bound.
 *
 * No polling: a trace record is immutable once the turn is done (R6 — nothing
 * here invents freshness a finished turn does not have).
 */

export type TraceStatus = "idle" | "loading" | "ready" | "missing" | "error";

export interface TraceEntry {
  status: TraceStatus;
  record: TraceRecord | null;
  /** Set only when `status === "error"` — a human-readable reason, never the raw fetch kind. */
  error: string | null;
  fetchedAt: number | null;
}

const IDLE_ENTRY: TraceEntry = { status: "idle", record: null, error: null, fetchedAt: null };

export interface TraceSliceState {
  traces: Record<string, TraceEntry>;
  /** Keys in least- to most-recently-touched order, for the LRU cap. Not meant to be read directly — components read `traces`. */
  traceOrder: string[];
}

export interface TraceSliceActions {
  /** Fetches a turn's trace unless it is already loading or already has one. Safe to call from every component that wants a turn's trace — concurrent callers share one in-flight request. */
  ensureTrace: (sessionId: string, turnId: string) => void;
  /** A non-reactive read (for use inside an action). Components should select `traces[turnKey(...)]` directly, so they re-render on the fetch settling. */
  traceFor: (sessionId: string, turnId: string) => TraceEntry;
  /** Drops a cached trace so the next `ensureTrace` re-fetches it. */
  invalidateTrace: (sessionId: string, turnId: string) => void;
}

export type TraceSlice = TraceSliceState & TraceSliceActions;

const LRU_CAP = 200;

function describeError(result: Exclude<FetchTraceResult, { kind: "ok" } | { kind: "evicted" }>): string {
  switch (result.kind) {
    case "network":
      return "Could not reach the engine.";
    case "cors":
      return "The engine refused the request (CORS).";
    case "http":
      return `The engine answered ${result.status}.`;
    case "schema":
      return `The trace record did not match the contract: ${result.issues[0] ?? "unknown issue"}.`;
  }
}

function evict(traces: Record<string, TraceEntry>, order: string[]): { traces: Record<string, TraceEntry>; order: string[] } {
  if (order.length <= LRU_CAP) return { traces, order };
  const drop = order.slice(0, order.length - LRU_CAP);
  const keptOrder = order.slice(order.length - LRU_CAP);
  const keptTraces = { ...traces };
  for (const key of drop) delete keptTraces[key];
  return { traces: keptTraces, order: keptOrder };
}

function touch(order: string[], key: string): string[] {
  return [...order.filter((k) => k !== key), key];
}

type Get = () => TraceSliceState;
type Set = (updater: (state: TraceSliceState) => Partial<TraceSliceState>) => void;

export interface TraceSliceDeps {
  fetchTrace?: typeof fetchTrace;
}

export function createTraceSlice(set: Set, get: Get, deps: TraceSliceDeps = {}): TraceSlice {
  const fetcher = deps.fetchTrace ?? fetchTrace;
  /** In-flight fetches for this slice instance, keyed the same way as the cache — an imperative handle outside rendered state, scoped per store so two independent stores (e.g. two tests) never de-duplicate against each other. */
  const inFlight = new Map<string, Promise<void>>();

  return {
    traces: {},
    traceOrder: [],

    traceFor: (sessionId, turnId) => get().traces[turnKey(sessionId, turnId)] ?? IDLE_ENTRY,

    invalidateTrace: (sessionId, turnId) => {
      const key = turnKey(sessionId, turnId);
      set((state) => {
        const traces = { ...state.traces };
        delete traces[key];
        return { traces, traceOrder: state.traceOrder.filter((k) => k !== key) };
      });
    },

    ensureTrace: (sessionId, turnId) => {
      const key = turnKey(sessionId, turnId);
      const existing = get().traces[key];
      if (existing && (existing.status === "loading" || existing.status === "ready")) return;
      if (inFlight.has(key)) return;

      set((state) => ({
        traces: { ...state.traces, [key]: { status: "loading", record: null, error: null, fetchedAt: null } },
        traceOrder: touch(state.traceOrder, key),
      }));

      const promise = fetcher(sessionId, turnId)
        .then((result) => {
          set((state) => {
            const entry: TraceEntry =
              result.kind === "ok"
                ? { status: "ready", record: result.record, error: null, fetchedAt: Date.now() }
                : result.kind === "evicted"
                  ? { status: "missing", record: null, error: null, fetchedAt: Date.now() }
                  : { status: "error", record: null, error: describeError(result), fetchedAt: Date.now() };
            const { traces, order } = evict({ ...state.traces, [key]: entry }, touch(state.traceOrder, key));
            return { traces, traceOrder: order };
          });
        })
        .finally(() => inFlight.delete(key));
      inFlight.set(key, promise);
    },
  };
}
