import type { ConnectionStatus } from "@/lib/transport";
import type {
  Claim,
  CorpusInfo,
  CostBreakdown,
  Decision,
  Hit,
  LatencyBreakdown,
  RetrievalTrigger,
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
  id: string;
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
  traceOpen: boolean;
  sidebarOpen: boolean;
  /** Drives the bidirectional chat <-> trace highlight. */
  hoveredChunkId: string | null;

  /* — engine — */
  corpus: CorpusInfo | null;
  connection: ConnectionStatus;
  transportKind: "websocket" | "mock";
  lastError: { code: string; message: string } | null;
}
