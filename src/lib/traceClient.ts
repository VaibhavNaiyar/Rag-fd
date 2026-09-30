import { apiUrl } from "@/lib/endpoints";
import { parseTraceRecord, type TraceRecord } from "@/types/trace";

/**
 * `GET /trace` and `GET /trace/{turn_id}` (`Rag-bd/src/slr/api/app.py`).
 *
 * The ring holds 500 records and is lost on restart, so a miss is an expected,
 * named outcome (`evicted`), not an error — R6, data honesty: the UI says what it
 * does not know rather than rendering a lie.
 */

export type FetchTraceResult =
  | { kind: "ok"; record: TraceRecord }
  /** 404: the ring never held this turn, or it rolled off, or the engine restarted. */
  | { kind: "evicted" }
  | { kind: "network" }
  | { kind: "cors" }
  /** A non-404 HTTP error. */
  | { kind: "http"; status: number }
  /** The engine answered, but not with a valid `trace_version: 1` record. */
  | { kind: "schema"; issues: string[] };

export interface FetchTraceOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  fetcher?: typeof fetch;
}

function withTimeout(outer: AbortSignal | undefined, timeoutMs: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const stop = () => controller.abort();
  outer?.addEventListener("abort", stop);
  const timer = setTimeout(stop, timeoutMs);
  return { signal: controller.signal, cancel: () => (clearTimeout(timer), outer?.removeEventListener("abort", stop)) };
}

/**
 * A `fetch` that never throws a `TypeError` we cannot classify: a network failure and a CORS
 * failure both surface as an opaque `TypeError` in every browser, and the only distinguishing
 * signal fetch gives is whether the request reached a server on a *different* origin at all.
 */
function classifyNetworkError(url: string): "network" | "cors" {
  try {
    return typeof window !== "undefined" && new URL(url, window.location.href).origin !== window.location.origin
      ? "cors"
      : "network";
  } catch {
    return "network";
  }
}

export async function fetchTrace(sessionId: string, turnId: string, options: FetchTraceOptions = {}): Promise<FetchTraceResult> {
  const { fetcher = fetch, timeoutMs = 8000 } = options;
  const url = apiUrl(`/trace/${encodeURIComponent(turnId)}?session_id=${encodeURIComponent(sessionId)}`);
  const { signal, cancel } = withTimeout(options.signal, timeoutMs);
  try {
    const response = await fetcher(url, { signal, headers: { Accept: "application/json" } });
    if (response.status === 404) return { kind: "evicted" };
    if (!response.ok) return { kind: "http", status: response.status };
    const body: unknown = await response.json().catch(() => null);
    const parsed = parseTraceRecord(body);
    if (parsed.ok) return { kind: "ok", record: parsed.record };
    return { kind: "schema", issues: parsed.kind === "invalid" ? parsed.issues : [`unsupported trace_version ${String(parsed.version)}`] };
  } catch {
    return { kind: classifyNetworkError(url) };
  } finally {
    cancel();
  }
}

export type FetchRecentResult =
  | { kind: "ok"; records: TraceRecord[]; skipped: number }
  | { kind: "network" }
  | { kind: "cors" }
  | { kind: "http"; status: number };

export interface FetchRecentParams {
  limit?: number;
  sessionId?: string;
}

/** `GET /trace?limit=&session_id=`. Records that fail to parse are dropped and counted in `skipped`, never thrown. */
export async function fetchRecent({ limit = 100, sessionId }: FetchRecentParams = {}, options: FetchTraceOptions = {}): Promise<FetchRecentResult> {
  const { fetcher = fetch, timeoutMs = 8000 } = options;
  const query = new URLSearchParams({ limit: String(Math.max(1, Math.min(limit, 200))) });
  if (sessionId) query.set("session_id", sessionId);
  const url = apiUrl(`/trace?${query.toString()}`);
  const { signal, cancel } = withTimeout(options.signal, timeoutMs);
  try {
    const response = await fetcher(url, { signal, headers: { Accept: "application/json" } });
    if (!response.ok) return { kind: "http", status: response.status };
    const body = (await response.json().catch(() => null)) as { traces?: unknown[] } | null;
    const raw = Array.isArray(body?.traces) ? body.traces : [];
    const records: TraceRecord[] = [];
    let skipped = 0;
    for (const entry of raw) {
      const parsed = parseTraceRecord(entry);
      if (parsed.ok) records.push(parsed.record);
      else skipped += 1;
    }
    return { kind: "ok", records, skipped };
  } catch {
    return { kind: classifyNetworkError(url) };
  } finally {
    cancel();
  }
}
