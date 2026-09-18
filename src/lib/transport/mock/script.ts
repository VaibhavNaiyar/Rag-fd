import { chunkUtterance } from "@/lib/chunker";
import { makeHit, type HitSpec } from "@/lib/transport/mock/corpus";
import type { Claim, ServerEvent } from "@/types/events";

/** SIMULATOR ONLY. A server event plus the offset it should be delivered at. */
export interface ScriptStep {
  atMs: number;
  event: ServerEvent;
}

export interface SubQuerySpec {
  text: string;
  /** Retrieval fires this many ms before the utterance ends. */
  leadMs: number;
  candidates: number;
  hits: HitSpec[];
}

export interface VersionSpec {
  body: string;
  claims: { text: string; subQueryIndex: number; hitIndexes: number[]; support: number }[];
  uncertainty: string[];
  /** Claim indexes (into this version's claims) carried over from the parent. */
  preserved?: number[];
  mutated?: number[];
}

export interface TurnSpec {
  utterance: string;
  /** Suppressed turns skip decomposition, retrieval and fusion entirely. */
  suppress?: { reason: string };
  subQueries: SubQuerySpec[];
  version: VersionSpec;
  /** Present on the refinement fixture: a second version from a late detail. */
  refinement?: { version: VersionSpec };
}

const TOKEN_MS = 22;

/** Split an answer body into stream-sized tokens, keeping citations intact. */
function tokenize(body: string): string[] {
  return body.match(/\[[^\]]+\]|\s+|\S+/g) ?? [body];
}

interface BuildContext {
  turnId: string;
  cursor: number;
  steps: ScriptStep[];
}

function push(ctx: BuildContext, afterMs: number, event: ServerEvent): void {
  ctx.cursor += afterMs;
  ctx.steps.push({ atMs: ctx.cursor, event });
}

/** Stream the transcript, advancing the cursor to the utterance end. */
function playTranscript(ctx: BuildContext, utterance: string): void {
  for (const chunk of chunkUtterance(utterance)) {
    ctx.cursor += chunk.delayMs;
    ctx.steps.push({
      atMs: ctx.cursor,
      event: {
        type: "transcript.chunk",
        turnId: ctx.turnId,
        text: chunk.text,
        atMs: ctx.cursor,
      },
    });
  }
}

function emitVersion(
  ctx: BuildContext,
  spec: VersionSpec,
  version: number,
  parent: number | null,
  subQueryIds: string[],
  hits: ReturnType<typeof makeHit>[],
): void {
  for (const token of tokenize(spec.body)) {
    push(ctx, TOKEN_MS, {
      type: "answer.token",
      turnId: ctx.turnId,
      version,
      text: token,
    });
  }

  const claims: Claim[] = spec.claims.map((claim, index) => ({
    id: `${ctx.turnId}_v${version}_c${index}`,
    text: claim.text,
    chunkIds: claim.hitIndexes.map((i) => hits[i]?.chunkId ?? ""),
    subQueryId: subQueryIds[claim.subQueryIndex] ?? subQueryIds[0] ?? "",
    support: claim.support,
  }));

  const idFor = (index: number) => claims[index]?.id ?? "";
  const supported = claims.filter((claim) => claim.support >= 0.5).length;

  push(ctx, 120, {
    type: "answer.version",
    turnId: ctx.turnId,
    version,
    parent,
    claims,
    preserved: (spec.preserved ?? []).map(idFor),
    mutated: (spec.mutated ?? []).map(idFor),
    uncertainty: spec.uncertainty,
    citationSupportRate: claims.length === 0 ? 1 : supported / claims.length,
    fabricatedCitations: 0,
  });
}

function buildSuppressedTurn(ctx: BuildContext, spec: TurnSpec, utteranceEndMs: number): ScriptStep[] {
  const reason = spec.suppress?.reason ?? "presentation_only";
  const decidedAt = Math.round(utteranceEndMs * 0.7);

  ctx.steps.push({
    atMs: decidedAt,
    event: {
      type: "controller.decision",
      turnId: ctx.turnId,
      decision: "suppress",
      reason,
      atMs: decidedAt,
      confidence: 0.94,
    },
  });
  ctx.steps.push({
    atMs: utteranceEndMs,
    event: { type: "utterance.end", turnId: ctx.turnId, atMs: utteranceEndMs },
  });

  ctx.cursor = utteranceEndMs;
  emitVersion(ctx, spec.version, 1, null, [`${ctx.turnId}_sq0`], []);

  push(ctx, 80, {
    type: "turn.complete",
    turnId: ctx.turnId,
    latencyMs: { firstRetrieval: null, firstToken: 180, complete: ctx.cursor - utteranceEndMs },
    cost: {
      turnUsd: 0.0006,
      turnTokens: 412,
      steps: [
        { step: "controller", usd: 0.0001 },
        { step: "synthesis", usd: 0.0005 },
      ],
    },
  });

  return ctx.steps;
}

/**
 * Compile a turn specification into a timed event script.
 *
 * Retrieval is scheduled relative to the utterance end so `leadMs` reads the way
 * a judge reads the timeline: retrieval began N ms before the user finished.
 */
export function buildTurnScript(turnId: string, spec: TurnSpec): ScriptStep[] {
  const ctx: BuildContext = { turnId, cursor: 0, steps: [] };

  push(ctx, 0, { type: "turn.start", turnId });
  push(ctx, 120, {
    type: "controller.decision",
    turnId,
    decision: "wait",
    reason: "insufficient_content",
    atMs: ctx.cursor + 120,
    confidence: 0.31,
  });

  const transcriptStart = ctx.cursor;
  playTranscript(ctx, spec.utterance);
  const utteranceEndMs = ctx.cursor;

  if (spec.suppress) return buildSuppressedTurn(ctx, spec, utteranceEndMs);

  const subQueryIds = spec.subQueries.map((_, index) => `${turnId}_sq${index + 1}`);

  // Retrieval markers are placed absolutely, so they land left of the end rule.
  let firstRetrievalMs: number | null = null;
  spec.subQueries.forEach((sub, index) => {
    const startedAt = Math.max(transcriptStart + 200, utteranceEndMs - sub.leadMs);
    if (firstRetrievalMs === null || startedAt < firstRetrievalMs) firstRetrievalMs = startedAt;

    ctx.steps.push({
      atMs: startedAt - 40,
      event: {
        type: "controller.decision",
        turnId,
        decision: "retrieve",
        reason: index === 0 ? "intent_stable" : "multi_intent_detected",
        atMs: startedAt - 40,
        confidence: 0.78 + index * 0.05,
      },
    });
    ctx.steps.push({
      atMs: startedAt,
      event: {
        type: "retrieval.started",
        turnId,
        subQueryId: subQueryIds[index] ?? "",
        trigger: index === 0 ? "provisional" : "multi_intent",
        atMs: startedAt,
      },
    });
  });

  ctx.steps.push({
    atMs: utteranceEndMs,
    event: { type: "utterance.end", turnId, atMs: utteranceEndMs },
  });
  ctx.cursor = utteranceEndMs;

  push(ctx, 90, {
    type: "subqueries",
    turnId,
    items: spec.subQueries.map((sub, index) => ({
      id: subQueryIds[index] ?? "",
      text: sub.text,
      source: index === 0 ? "provisional" : "decomposed",
    })),
  });

  const allHits = spec.subQueries.flatMap((sub, index) =>
    sub.hits.map((hit) => makeHit(hit, [subQueryIds[index] ?? ""])),
  );

  spec.subQueries.forEach((sub, index) => {
    const subQueryId = subQueryIds[index] ?? "";
    push(ctx, 140, {
      type: "retrieval.result",
      turnId,
      subQueryId,
      candidates: sub.candidates,
      kept: allHits.filter((hit) => hit.subQueryIds.includes(subQueryId)),
    });
  });

  push(ctx, 140, {
    type: "fusion.final",
    turnId,
    hits: [...allHits].sort((a, b) => b.score - a.score),
    quotaApplied: spec.subQueries.length > 1,
    fullCorpusSearch: true,
  });

  emitVersion(ctx, spec.version, 1, null, subQueryIds, allHits);
  const firstTokenMs = ctx.cursor - utteranceEndMs;

  if (spec.refinement) {
    push(ctx, 420, {
      type: "controller.decision",
      turnId,
      decision: "refine",
      reason: "late_constraint",
      atMs: ctx.cursor + 420,
      confidence: 0.88,
    });
    push(ctx, 60, {
      type: "retrieval.started",
      turnId,
      subQueryId: subQueryIds[0] ?? "",
      trigger: "refine",
      atMs: ctx.cursor + 60,
    });
    push(ctx, 180, {
      type: "fusion.final",
      turnId,
      hits: [...allHits].sort((a, b) => b.score - a.score),
      quotaApplied: true,
      // The G5 proof: the refinement reused session state, no full re-search.
      fullCorpusSearch: false,
    });
    emitVersion(ctx, spec.refinement.version, 2, 1, subQueryIds, allHits);
  }

  push(ctx, 80, {
    type: "turn.complete",
    turnId,
    latencyMs: {
      firstRetrieval: firstRetrievalMs === null ? null : firstRetrievalMs - utteranceEndMs,
      firstToken: firstTokenMs,
      complete: ctx.cursor - utteranceEndMs,
    },
    cost: {
      turnUsd: 0.0021 + spec.subQueries.length * 0.0004,
      turnTokens: 1180 + spec.subQueries.length * 210,
      steps: [
        { step: "controller", usd: 0.0002 },
        { step: "decompose", usd: 0.0004 },
        { step: "rerank", usd: 0.0006 },
        { step: "synthesis", usd: 0.0009 + spec.subQueries.length * 0.0004 },
      ],
    },
  });

  return ctx.steps;
}
