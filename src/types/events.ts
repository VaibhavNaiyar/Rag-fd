/**
 * The wire contract.
 *
 * Server -> client is AG-UI (https://docs.ag-ui.com): every frame is a standard
 * AG-UI event, validated against `@ag-ui/core`'s own schemas on arrival. What
 * this file adds is the shape of OUR payloads inside those events, mirrored from
 * the engine's translator (`Rag-bd/src/slr/api/agui.py`):
 *
 * - a turn is one run (`runId` = turn id, `threadId` = session id)
 * - the pipeline stages are steps: `listen` → `plan` → `retrieve` → `synthesise`
 * - a retrieval is a `corpus_search` tool call: {@link SearchArgs} in, {@link SearchResult} out
 * - answer text is one text message per version, `messageId` = `<turnId>:v<n>`
 * - everything else is {@link SharedState}, via STATE_SNAPSHOT then STATE_DELTA
 *
 * Client -> server stays three input messages ({@link ClientEvent}): AG-UI has no
 * event for input that arrives while a run is under way, which is exactly what
 * early retrieval needs. Change this file only in lockstep with the translator.
 */

/** Retrieval controller verdict for one transcript fragment. */
export type Decision = "wait" | "retrieve" | "suppress" | "refine";

/**
 * Why a retrieval was launched. Drives the timeline marker's label.
 * `full_utterance` is the end-of-utterance search that always follows a
 * provisional/multi-intent/refine launch — the trace record's
 * `retrieval_events` carries it (`Rag-bd/src/slr/stream/engine.py`); the live
 * AG-UI stream does not currently emit it as a `corpus_search` trigger, so a
 * switch over this union must still handle it to stay exhaustive against the
 * trace contract (SD-03).
 */
export type RetrievalTrigger = "provisional" | "multi_intent" | "refine" | "full_utterance";

/** Every trigger value, for an exhaustive switch or a runtime membership check. */
export const RETRIEVAL_TRIGGERS: readonly RetrievalTrigger[] = ["provisional", "multi_intent", "refine", "full_utterance"];

/**
 * Every reason code the rules controller emits (`Rag-bd/src/slr/controller/rules.py`),
 * plus the two cancellation reasons and the model-controller's error fallback.
 * The wire type of `reason` stays `string` — the model controller (`controller/model.py`)
 * can emit free-form LLM text — but this array is what a label lookup enumerates
 * against before falling back to humanising the raw code.
 */
export const KNOWN_REASON_CODES = [
  "intent_stable",
  "clause_complete",
  "multi_intent_detected",
  "late_constraint",
  "insufficient_content",
  "awaiting_next_intent",
  "provisional_budget_spent",
  "intent_unstable",
  "presentation_restructure",
  "no_information_need",
  "utterance_complete",
  "topic_shift",
  "controller_error",
] as const;

/** Where a sub-query came from: guessed mid-utterance, or decomposed at the end. */
export type SubQuerySource = "provisional" | "decomposed";

/** Which arm of the hybrid retriever surfaced a chunk. */
export type RetrievalBranch = "bm25" | "dense";

/** A pipeline stage, as an AG-UI step name. */
export type PipelineStep = "listen" | "plan" | "retrieve" | "synthesise";

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
  /** Model tokens per model. Also sent as RUN_FINISHED.usage in AG-UI's own shape. */
  models: { model: string; inputTokens: number; outputTokens: number }[];
}

export interface CorpusInfo {
  docs: number;
  chunks: number;
  /** Epoch ms the index finished building; drives the "indexed 12s ago" line. */
  indexedAt?: number;
}

export interface DecisionRecord {
  decision: Decision;
  reason: string;
  atMs: number;
  confidence?: number;
}

/** One answer version's grounding record. Its text streams separately as a text message. */
export interface VersionRecord {
  parent: number | null;
  claims: Claim[];
  /** Claim ids carried unchanged from the parent version. */
  preserved: string[];
  /** Claim ids the late detail rewrote. */
  mutated: string[];
  uncertainty: string[];
  citationSupportRate: number;
  fabricatedCitations: number;
  /** Readings to choose between, when the request was split and none could be verified. */
  clarification?: string[];
}

export interface SharedTurn {
  transcript: { text: string; atMs: number }[];
  utteranceEndMs: number | null;
  decisions: DecisionRecord[];
  subQueries: SubQueryItem[];
  fusion: { hits: Hit[]; quotaApplied: boolean; fullCorpusSearch: boolean } | null;
  /** Keyed by version number. */
  versions: Record<string, VersionRecord>;
  latencyMs: LatencyBreakdown | null;
  cost: CostBreakdown | null;
}

/** The AG-UI shared state the engine maintains for one session. */
export interface SharedState {
  session: { id: string; corpus: CorpusInfo } | null;
  /** Keyed by turn id, in the order the turns happened. */
  turns: Record<string, SharedTurn>;
}

/** Name of the one tool the engine calls. */
export const SEARCH_TOOL = "corpus_search";

/** `corpus_search` arguments. A reused call answers a decomposed sub-query from a search already running. */
export type SearchArgs =
  | { query: string; trigger: RetrievalTrigger; atMs: number }
  | { query: string; reused: true };

/** `corpus_search` result. */
export type SearchResult =
  | { cancelled: true; reason: string }
  | { candidates: number; kept: Hit[]; reused: boolean };

/** Split `<turnId>:v<n>`, the id of one answer version's text message. */
export function parseMessageId(messageId: string): { turnId: string; version: number } | null {
  const at = messageId.lastIndexOf(":v");
  if (at <= 0) return null;
  const version = Number(messageId.slice(at + 2));
  return Number.isInteger(version) && version > 0 ? { turnId: messageId.slice(0, at), version } : null;
}

export type ClientEvent =
  | { type: "utterance.start" }
  | { type: "utterance.chunk"; text: string }
  | { type: "utterance.end" }
  /** Replay mode. Payloads live in `evals/fixtures/` server-side, never here. */
  | { type: "replay"; fixture: string; speed?: number }
  | { type: "session.new" };

/** One replayable test case, as `GET /fixtures` lists it for the corpus being served. */
export interface FixtureInfo {
  id: string;
  /** The folder it lives in: compound, late_detail, suppression, single, unanswerable. */
  family: string;
  description: string;
  /** What is said, turn by turn. */
  turns: string[];
}
