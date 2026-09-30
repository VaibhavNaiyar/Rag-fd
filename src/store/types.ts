import type { ConnectionStatus } from "@/lib/transport";
import type {
  Claim,
  CorpusInfo,
  CostBreakdown,
  Decision,
  FixtureInfo,
  Hit,
  LatencyBreakdown,
  RetrievalTrigger,
  SharedState,
  SubQuerySource,
} from "@/types/events";

/** One rendered answer. A turn holds several once a late detail refines it. */
export interface AnswerVersion {
  version: number;
  parent: number | null;
  /** Tokens accumulated by the rAF-batched stream writer. */
  body: string;
  claims: Claim[];
  /** Claim ids carried unchanged from the parent version. */
  preserved: string[];
  /** Claim ids the refinement rewrote. */
  mutated: string[];
  uncertainty: string[];
  citationSupportRate: number;
  fabricatedCitations: number;
  /** Readings to choose between, when the request was split and none could be verified. */
  clarification: string[];
  /** false on a refinement — the G5 proof, read straight off `fusion.final`. */
  fullCorpusSearch: boolean;
  complete: boolean;
}

export interface ControllerDecisionRecord {
  decision: Decision;
  reason: string;
  atMs: number;
  confidence?: number;
}

export interface RetrievalRecord {
  subQueryId: string;
  /** What was searched, from the `corpus_search` call's arguments. */
  query: string;
  trigger: RetrievalTrigger;
  atMs: number;
  /** Set when the thrash guard kills an in-flight search. */
  cancelledReason?: string;
}

export interface SubQueryRecord {
  id: string;
  text: string;
  source: SubQuerySource;
  /** Populated by `retrieval.result` once the branch reports back. */
  candidates?: number;
  keptCount?: number;
}

export type TurnStatus = "listening" | "retrieving" | "answering" | "complete" | "error";

export interface Turn {
  /** The wire's turn id (`runId`) — not unique on its own; `turn_id` repeats across sessions and after a reconnect. Store lookups use {@link turnKey}, never this alone. */
  id: string;
  /** The session this turn belongs to. Paired with {@link id}, it is the turn's real identity (SD-01). */
  sessionId: string;
  transcript: { text: string; atMs: number }[];
  utteranceEndMs: number | null;
  decisions: ControllerDecisionRecord[];
  retrievals: RetrievalRecord[];
  /** Absolute ms of the earliest retrieval; the timeline's lead span uses it. */
  firstRetrievalMs: number | null;
  subQueries: SubQueryRecord[];
  evidence: Hit[];
  quotaApplied: boolean;
  fullCorpusSearch: boolean;
  versions: AnswerVersion[];
  activeVersion: number;
  latencyMs: LatencyBreakdown | null;
  cost: CostBreakdown | null;
  status: TurnStatus;
  errorMessage: string | null;
}

export interface SessionSummary {
  id: string;
  title: string;
  updatedAt: number;
  turnCount: number;
}

export type Phase = "idle" | "active";

export interface AppState {
  /* — conversation — */
  sessions: SessionSummary[];
  activeSessionId: string | null;
  turns: Turn[];
  phase: Phase;

  /* — live input — */
  isListening: boolean;
  /** What the client is currently streaming out, shown without a round trip. */
  draftTranscript: string;

  /* — chrome — */
  sidebarOpen: boolean;
  /** Drives the bidirectional highlight between citation chips and evidence cards. */
  hoveredChunkId: string | null;

  /* — engine — */
  corpus: CorpusInfo | null;
  /** Replayable test cases for the corpus the engine is serving (`GET /fixtures`). */
  fixtures: FixtureInfo[];
  connection: ConnectionStatus;
  lastError: { code: string; message: string } | null;

  /* — AG-UI bookkeeping — */
  /** The engine's shared state, exactly as its STATE_SNAPSHOT/STATE_DELTA stream built it. */
  shared: SharedState | null;
  /** The run in flight; its id is the turn id. */
  openRun: string | null;
  /** `corpus_search` calls whose arguments are still streaming, by tool call id. */
  calls: Record<string, { turnId: string; args: string }>;
}
