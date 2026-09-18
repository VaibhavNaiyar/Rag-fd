/**
 * The wire contract.
 *
 * This file mirrors the telemetry schema the backend emits, so the UI renders
 * exactly the record the graders read — no client-side reinterpretation. Change
 * it only in lockstep with the engine's event schema.
 */

/** Retrieval controller verdict for one transcript fragment. */
export type Decision = "wait" | "retrieve" | "suppress" | "refine";

/** Why a retrieval was launched. Drives the timeline marker's label. */
export type RetrievalTrigger = "provisional" | "multi_intent" | "refine";

/** Where a sub-query came from: guessed mid-utterance, or decomposed at the end. */
export type SubQuerySource = "provisional" | "decomposed";

/** Which arm of the hybrid retriever surfaced a chunk. */
export type RetrievalBranch = "bm25" | "dense";

/** A corpus chunk that survived fusion and reranking. */
export interface Hit {
  chunkId: string;
  docId: string;
  section: string;
  text: string;
  score: number;
  branches: RetrievalBranch[];
  subQueryIds: string[];
  /** Built server-side from real chunk metadata — the model never writes one. */
  citation: string;
}

/** One factual assertion in an answer, tied to the chunks that support it. */
export interface Claim {
  id: string;
  text: string;
  chunkIds: string[];
  subQueryId: string;
  /** 0–1 support score from the grounding verifier. */
  support: number;
}

export interface SubQueryItem {
  id: string;
  text: string;
  source: SubQuerySource;
}

export interface LatencyBreakdown {
  /** null when the turn was suppressed — no retrieval ever ran. */
  firstRetrieval: number | null;
  firstToken: number;
  complete: number;
}

export interface CostBreakdown {
  turnUsd: number;
  turnTokens: number;
  steps: { step: string; usd: number }[];
}

export interface CorpusInfo {
  docs: number;
  chunks: number;
  /** Epoch ms the index finished building; drives the "indexed 12s ago" line. */
  indexedAt?: number;
}

export type ServerEvent =
  | { type: "session.ready"; sessionId: string; corpus: CorpusInfo }
  | { type: "turn.start"; turnId: string }
  | { type: "transcript.chunk"; turnId: string; text: string; atMs: number }
  | {
      type: "controller.decision";
      turnId: string;
      decision: Decision;
      reason: string;
      atMs: number;
      confidence?: number;
    }
  | {
      type: "retrieval.started";
      turnId: string;
      subQueryId: string;
      trigger: RetrievalTrigger;
      atMs: number;
    }
  | { type: "retrieval.cancelled"; turnId: string; subQueryId: string; reason: string }
  | { type: "utterance.end"; turnId: string; atMs: number }
  | { type: "subqueries"; turnId: string; items: SubQueryItem[] }
  | { type: "retrieval.result"; turnId: string; subQueryId: string; candidates: number; kept: Hit[] }
  | {
      type: "fusion.final";
      turnId: string;
      hits: Hit[];
      quotaApplied: boolean;
      fullCorpusSearch: boolean;
    }
  | { type: "answer.token"; turnId: string; version: number; text: string }
  | {
      type: "answer.version";
      turnId: string;
      version: number;
      parent: number | null;
      claims: Claim[];
      /** Claim ids carried unchanged from the parent version. */
      preserved: string[];
      /** Claim ids the late detail rewrote. */
      mutated: string[];
      uncertainty: string[];
      citationSupportRate: number;
      fabricatedCitations: number;
    }
  | {
      type: "turn.complete";
      turnId: string;
      latencyMs: LatencyBreakdown;
      cost: CostBreakdown;
    }
  | { type: "error"; turnId?: string; code: string; message: string };

export type ServerEventType = ServerEvent["type"];

export type ClientEvent =
  | { type: "utterance.start" }
  | { type: "utterance.chunk"; text: string }
  | { type: "utterance.end" }
  /** Demo mode. Payloads live in `evals/fixtures/` server-side, never here. */
  | { type: "replay"; fixture: string; speed?: number }
  | { type: "session.new" };

/** Narrow an unknown socket frame to a ServerEvent without trusting the wire. */
export function isServerEvent(value: unknown): value is ServerEvent {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof (value as { type: unknown }).type === "string"
  );
}
