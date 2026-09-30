import { z } from "zod";

/**
 * The `/trace` record contract (`trace_version: 1`), mirrored from the engine's
 * own field list (`Rag-bd/src/slr/telemetry/trace.py:REQUIRED_FIELDS`, 27 names)
 * plus the four fields it tolerates as absent: `speculation`, `refinement`,
 * `events`, `degraded`. Four of the 27 are nullable even when present
 * (`first_retrieval_ms`, `before_utterance_end`, `decomposition`, `fusion`) —
 * a suppressed turn legitimately has no retrieval.
 *
 * R10 (frozen contract): this file describes the wire shape; it never redefines
 * it. Fields the engine adds that no schema here names are dropped by zod's
 * default object parsing, not rejected — an unknown field is not a parse error.
 */

const signalsSchema = z
  .object({
    cos_prev: z.number(),
    stable_run: z.number(),
    ms: z.number(),
    boundary: z.boolean().optional(),
    segment: z.string().optional(),
    suppression: z.record(z.string(), z.unknown()).optional(),
    sufficiency: z
      .object({ content: z.number(), entities: z.array(z.string()) })
      .partial()
      .optional(),
    refinement: z
      .object({
        cue: z.boolean(),
        correction: z.boolean(),
        cos_previous: z.number().nullable(),
        is_request: z.boolean(),
        bar: z.number(),
      })
      .partial()
      .optional(),
  })
  .partial()
  .passthrough();

const decisionSchema = z.object({
  decision: z.enum(["wait", "retrieve", "suppress", "refine"]),
  reason: z.string(),
  confidence: z.number(),
  at_ms: z.number(),
  query: z.string().nullable().optional(),
  signals: signalsSchema.optional().default({}),
});

const chunkSchema = z.object({ text: z.string(), at_ms: z.number() });

/** A search launching. */
const retrievalLaunchSchema = z.object({
  sub_query_id: z.string(),
  query: z.string(),
  trigger: z.enum(["provisional", "multi_intent", "refine", "full_utterance"]),
  at_ms: z.number(),
  before_utterance_end: z.boolean(),
});

/** The thrash guard killing a search already in flight (`event: "retrieval_cancelled"`). */
const retrievalCancelSchema = z.object({
  sub_query_id: z.string(),
  event: z.literal("retrieval_cancelled"),
  reason: z.string(),
  at_ms: z.number(),
});

const retrievalEventSchema = z.union([retrievalCancelSchema, retrievalLaunchSchema]);

const subQuerySchema = z.object({
  id: z.string(),
  text: z.string(),
  source: z.enum(["provisional", "decomposed", "refine"]),
  span: z.string().optional(),
  confidence: z.number().optional(),
  /** Which earlier sub-query this one reuses evidence from. The engine spells this
   *  `reused_from` on the retrieve path and `refines` on the refine path (SD-05:
   *  same meaning, two field names) — both are read here as one optional string. */
  reused_from: z.string().nullable().optional(),
  refines: z.string().nullable().optional(),
});

const decompositionSchema = z
  .object({
    method: z.string(),
    /** Decompose path (`llm`/`rule`): the raw candidate readings, a merge count, a cap count, timing, few-shot examples used. */
    raw: z.array(z.object({ text: z.string(), span: z.string().optional(), confidence: z.number().optional() })).optional(),
    merged: z.number().optional(),
    capped: z.number().optional(),
    ms: z.number().optional(),
    examples: z.array(z.string()).optional(),
    /** Refine path (`refine_llm`/`refine_rule`): which claims and sub-queries the new detail touches. */
    affected_claims: z.array(z.string()).optional(),
    affected_sub_queries: z.array(z.string()).optional(),
    claim_similarity: z.record(z.string(), z.number()).optional(),
  })
  .partial()
  .passthrough()
  .nullable();

const keptHitSchema = z.object({
  chunk_id: z.string(),
  score: z.number(),
  branches: z.array(z.string()),
});

const retrievalResultSchema = z.object({
  sub_query_id: z.string(),
  candidates: z.number(),
  branch_counts: z.record(z.string(), z.number()).default({}),
  kept: z.array(keptHitSchema),
  reranked: z.boolean(),
  reused: z.boolean(),
  ms: z.number(),
});

const fusionSchema = z
  .object({
    final_count: z.number(),
    quota_applied: z.boolean(),
    quota_promoted: z.array(z.string()).default([]),
    per_sub_query: z.record(z.string(), z.number()).default({}),
    full_corpus_search: z.boolean(),
    carried_from_session: z.number().default(0),
    chunk_ids: z.array(z.string()),
    flagged_chunk_ids: z.array(z.string()).default([]),
  })
  .nullable();

const claimSchema = z.object({
  id: z.string(),
  text: z.string(),
  chunkIds: z.array(z.string()),
  subQueryId: z.string(),
  support: z.number(),
});

const groundingSchema = z
  .object({
    generated_claims: z.number(),
    supported_claims: z.number(),
    demoted_claims: z.number(),
    auto_cited: z.number(),
    recited: z.number(),
    ungrounded_numbers: z.number(),
    attributions: z.array(z.unknown()).default([]),
    fabricated_markers: z.array(z.unknown()).default([]),
    verifier: z.string(),
  })
  .partial()
  .passthrough();

const answerSchema = z
  .object({
    version: z.number(),
    parent: z.number().nullable(),
    body: z.string(),
    claims: z.array(claimSchema),
    preserved: z.array(z.string()),
    mutated: z.array(z.string()),
    full_corpus_search: z.boolean(),
    claim_count: z.number(),
    word_count: z.number(),
    clarification: z.array(z.string()),
    grounding: groundingSchema.optional(),
  })
  .nullable();

const latencySchema = z
  .object({
    first_retrieval_rel_end: z.number().nullable(),
    first_token_after_end: z.number().nullable(),
    complete_after_end: z.number().nullable(),
    first_token_abs: z.number().nullable(),
    complete_abs: z.number().nullable(),
  })
  .partial()
  .nullable();

const costStepSchema = z.object({ step: z.string(), usd: z.number() });
const costModelSchema = z.object({ model: z.string(), inputTokens: z.number(), outputTokens: z.number() });
const costEntrySchema = z
  .object({ step: z.string(), kind: z.string(), model: z.string(), ms: z.number(), usd: z.number() })
  .partial()
  .passthrough();

const costSchema = z
  .object({
    turnUsd: z.number(),
    turnTokens: z.number(),
    steps: z.array(costStepSchema).default([]),
    models: z.array(costModelSchema).default([]),
    entries: z.array(costEntrySchema).default([]),
  })
  .nullable();

const speculationSchema = z.object({
  reused: z.string(),
  kept: z.boolean(),
  reason: z.string(),
  cos: z.number().nullable(),
});

const refinementSchema = z.object({
  preserved: z.array(z.string()),
  mutated: z.array(z.string()),
  dropped: z.array(z.string()),
  parent_claims: z.number(),
});

const degradedStepSchema = z.object({ step: z.string(), reason: z.string(), after_text: z.boolean() });

const traceEventSchema = z.record(z.string(), z.unknown());

export const TraceRecordSchema = z.object({
  trace_version: z.literal(1),
  session_id: z.string(),
  turn_id: z.string(),
  started_at: z.number(),
  mode: z.enum(["wait", "retrieve", "suppress", "refine"]).nullable(),
  controller: z.string(),
  utterance: z.string(),
  utterance_end_ms: z.number().nullable(),
  chunks: z.array(chunkSchema),
  decisions: z.array(decisionSchema),
  retrieval_events: z.array(retrievalEventSchema),
  first_retrieval_ms: z.number().nullable(),
  before_utterance_end: z.boolean().nullable(),
  sub_queries: z.array(subQuerySchema),
  decomposition: decompositionSchema,
  retrieval: z.array(retrievalResultSchema),
  fusion: fusionSchema,
  answer: answerSchema,
  citations: z.array(z.string()),
  citation_support_rate: z.number().nullable(),
  fabricated_citations: z.number(),
  fabricated_citations_blocked: z.number(),
  uncertainty: z.array(z.string()),
  latency_ms: latencySchema,
  cost: costSchema,
  models: z.record(z.string(), z.string()),
  errors: z.array(z.string()),
  // Tolerated when absent — not in REQUIRED_FIELDS.
  speculation: speculationSchema.optional(),
  refinement: refinementSchema.optional(),
  events: z.array(traceEventSchema).optional(),
  degraded: z.array(degradedStepSchema).optional(),
});

export type TraceRecord = z.infer<typeof TraceRecordSchema>;
export type TraceDecision = z.infer<typeof decisionSchema>;
export type TraceSignals = z.infer<typeof signalsSchema>;
export type TraceSubQuery = z.infer<typeof subQuerySchema>;
export type TraceRetrievalResult = z.infer<typeof retrievalResultSchema>;
export type TraceFusion = NonNullable<z.infer<typeof fusionSchema>>;
export type TraceAnswer = NonNullable<z.infer<typeof answerSchema>>;
export type TraceGrounding = z.infer<typeof groundingSchema>;
export type TraceLatency = NonNullable<z.infer<typeof latencySchema>>;
export type TraceCost = NonNullable<z.infer<typeof costSchema>>;
export type TraceClaim = z.infer<typeof claimSchema>;
export type TraceRefinement = z.infer<typeof refinementSchema>;
export type TraceSpeculation = z.infer<typeof speculationSchema>;
export type TraceDegradedStep = z.infer<typeof degradedStepSchema>;

export type ParseTraceResult =
  | { ok: true; record: TraceRecord }
  | { ok: false; kind: "unsupported"; version: unknown }
  | { ok: false; kind: "invalid"; issues: string[] };

/** Never throws: a malformed or future-versioned record is a typed result, not an exception. */
export function parseTraceRecord(input: unknown): ParseTraceResult {
  if (input && typeof input === "object" && "trace_version" in input) {
    const version = (input as { trace_version: unknown }).trace_version;
    if (version !== 1) return { ok: false, kind: "unsupported", version };
  }
  const result = TraceRecordSchema.safeParse(input);
  if (result.success) return { ok: true, record: result.data };
  return { ok: false, kind: "invalid", issues: result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) };
}
