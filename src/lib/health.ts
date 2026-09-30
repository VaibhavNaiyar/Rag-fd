import { apiUrl } from "@/lib/endpoints";

export interface EngineHealth {
  version: string;
  corpus: { docs: number; chunks: number; indexedAt?: number } | null;
  models: Record<string, string>;
}

/**
 * What is known about the engine. `unknown` is not an error: the engine may be off,
 * behind a proxy that blocks the request, or not there at all in a static preview, and
 * the console works from the stream in every one of those cases.
 */
export type HealthResult =
  | { state: "checking" }
  | { state: "ok"; health: EngineHealth; at: number }
  /** The engine answered 503 while it loads its models. */
  | { state: "loading" }
  | { state: "unknown" };

/** `GET /health`: from NEXT_PUBLIC_ENGINE_URL when set, else the same origin (or the dev port, see endpoints.ts). */
export function healthUrl(): string {
  const configured = process.env.NEXT_PUBLIC_ENGINE_URL;
  return configured ? `${configured.replace(/\/+$/, "")}/health` : apiUrl("/health");
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Reads a /health body. Anything that is not the engine's answer is `null`. */
export function parseHealth(body: unknown): EngineHealth | null {
  if (!isRecord(body) || body.status !== "ok" || typeof body.version !== "string") return null;

  const corpus = isRecord(body.corpus) && typeof body.corpus.docs === "number" && typeof body.corpus.chunks === "number"
    ? { docs: body.corpus.docs, chunks: body.corpus.chunks, ...(typeof body.corpus.indexedAt === "number" ? { indexedAt: body.corpus.indexedAt } : {}) }
    : null;

  const models: Record<string, string> = {};
  if (isRecord(body.models)) for (const [key, value] of Object.entries(body.models)) if (typeof value === "string") models[key] = value;

  return { version: body.version, corpus, models };
}

export interface FetchHealthOptions {
  signal?: AbortSignal;
  /** Give up after this many ms. Default 4000. */
  timeoutMs?: number;
  fetcher?: typeof fetch;
  now?: () => number;
}

/** Asks the engine how it is. Never throws: a failure of any kind is `{ state: "unknown" }`. */
export async function fetchHealth({ signal, timeoutMs = 4000, fetcher = fetch, now = Date.now }: FetchHealthOptions = {}): Promise<HealthResult> {
  const controller = new AbortController();
  const stop = () => controller.abort();
  signal?.addEventListener("abort", stop);
  const timer = setTimeout(stop, timeoutMs);

  try {
    const response = await fetcher(healthUrl(), { signal: controller.signal, headers: { Accept: "application/json" } });
    const body: unknown = await response.json().catch(() => null);
    if (response.status === 503 && isRecord(body) && body.status === "loading") return { state: "loading" };
    if (!response.ok) return { state: "unknown" };
    const health = parseHealth(body);
    return health ? { state: "ok", health, at: now() } : { state: "unknown" };
  } catch {
    // Offline, refused, blocked by CORS, timed out, aborted.
    return { state: "unknown" };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", stop);
  }
}

/** One line about the engine for the status strip and the menu. Says what is known and, when it is not, that it is not. */
export function describeHealth(result: HealthResult): string {
  switch (result.state) {
    case "checking":
      return "Checking the engine";
    case "loading":
      return "Engine is loading its models";
    case "unknown":
      return "Engine health unknown";
    case "ok":
      return `Engine ok, version ${result.health.version}`;
  }
}
