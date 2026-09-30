import type { AnswerVersion } from "@/store/types";
import type { TraceRecord } from "@/types/trace";

/**
 * Claim-level lineage between a refinement and its parent (the G5 proof: a late
 * detail rewrites what changed and carries the rest, rather than restarting).
 *
 * Two sources, two honesty levels:
 *
 * - **Live** ({@link diffLiveVersions}): both versions are in the store with full
 *   claim text, so every row has text and a rewritten claim gets a bounded
 *   word-level diff against its parent.
 * - **Trace-only** ({@link diffFromTrace}): the `/trace` record keeps only the
 *   *last* answer version — never earlier bodies — so a claim's own text is
 *   known (from `answer.claims`) but its **parent's** text is not. Rows still
 *   classify correctly from `refinement.{preserved,mutated,dropped}`, but a
 *   `removed` (dropped) claim has no text to show and no rewritten claim gets a
 *   word diff — `inlineDiffAvailable: false` says so rather than rendering a
 *   diff against text that was never fetched.
 *
 * A claim id is stable across a refinement: `preserved` and `mutated` both name
 * the *same id* the parent claim had, just with unchanged or rewritten text
 * (`Rag-bd/src/slr/stream/engine.py`'s grounder assigns a claim id once; a
 * refine either keeps a claim's text or replaces it in place, never reissuing
 * the id — the fixtures' `preserved` ids reuse the exact `t1_v1_c*` ids `t1`'s
 * answer emitted).
 */

export type ClaimState = "preserved" | "rewritten" | "added" | "removed";

export interface WordToken {
  text: string;
  state: "same" | "added" | "removed";
}

export interface ClaimDiffRow {
  claimId: string;
  state: ClaimState;
  /** Null only on the trace-only path for a `removed` claim — its text was never fetched (only the last version is kept). */
  text: string | null;
  /** Present only for a `rewritten` row where both the parent's and the child's text are known and neither exceeds the word cap. */
  wordDiff: WordToken[] | null;
}

export interface ClaimDiff {
  rows: ClaimDiffRow[];
  /** `refinement.parent_claims` / the parent version's claim count. */
  parentClaimCount: number;
  /** False on the trace-only path: a `rewritten` row's `wordDiff` is always null there, not just sometimes. */
  inlineDiffAvailable: boolean;
}

/** Above this many words on either side, the word diff is skipped (still classified as `rewritten`, `wordDiff: null`) — O(n·m) LCS is not worth it on a five-paragraph claim, which does not happen in practice but must not hang the tab if it does. */
const MAX_DIFF_WORDS = 400;

function words(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/** Word-level LCS diff (classic O(n·m) alignment). Bounded by {@link MAX_DIFF_WORDS} at the call site. */
function wordDiff(before: string, after: string): WordToken[] {
  const a = words(before);
  const b = words(after);
  const n = a.length;
  const m = b.length;
  const table: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[i]![j] = a[i] === b[j] ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }
  const tokens: WordToken[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      tokens.push({ text: a[i]!, state: "same" });
      i += 1;
      j += 1;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      tokens.push({ text: a[i]!, state: "removed" });
      i += 1;
    } else {
      tokens.push({ text: b[j]!, state: "added" });
      j += 1;
    }
  }
  while (i < n) {
    tokens.push({ text: a[i]!, state: "removed" });
    i += 1;
  }
  while (j < m) {
    tokens.push({ text: b[j]!, state: "added" });
    j += 1;
  }
  return tokens;
}

function boundedWordDiff(before: string, after: string): WordToken[] | null {
  if (words(before).length > MAX_DIFF_WORDS || words(after).length > MAX_DIFF_WORDS) return null;
  return wordDiff(before, after);
}

/** Both versions live in the store, with full claim text — every row gets text, and a rewritten claim gets its word diff. */
export function diffLiveVersions(parent: AnswerVersion, child: AnswerVersion): ClaimDiff {
  const parentById = new Map(parent.claims.map((claim) => [claim.id, claim]));
  const rows: ClaimDiffRow[] = [];

  for (const claim of child.claims) {
    if (child.preserved.includes(claim.id)) {
      rows.push({ claimId: claim.id, state: "preserved", text: claim.text, wordDiff: null });
    } else if (child.mutated.includes(claim.id)) {
      const before = parentById.get(claim.id);
      rows.push({ claimId: claim.id, state: "rewritten", text: claim.text, wordDiff: before ? boundedWordDiff(before.text, claim.text) : null });
    } else {
      rows.push({ claimId: claim.id, state: "added", text: claim.text, wordDiff: null });
    }
  }

  const childIds = new Set(child.claims.map((claim) => claim.id));
  for (const claim of parent.claims) {
    if (!childIds.has(claim.id)) rows.push({ claimId: claim.id, state: "removed", text: claim.text, wordDiff: null });
  }

  return { rows, parentClaimCount: parent.claims.length, inlineDiffAvailable: true };
}

/** Trace-only: only the last version's claims are known. Classification comes from `refinement`; a dropped claim and every word diff are `unavailable`. */
export function diffFromTrace(record: TraceRecord): ClaimDiff {
  const refinement = record.refinement;
  const claims = record.answer?.claims ?? [];
  if (!refinement) {
    // Not a refinement at all (or the trace predates this field) — every claim in the answer is simply itself.
    return { rows: claims.map((claim) => ({ claimId: claim.id, state: "added" as const, text: claim.text, wordDiff: null })), parentClaimCount: 0, inlineDiffAvailable: false };
  }

  const byId = new Map(claims.map((claim) => [claim.id, claim]));
  const preserved = new Set(refinement.preserved);
  const mutated = new Set(refinement.mutated);
  const rows: ClaimDiffRow[] = [];

  for (const claim of claims) {
    if (preserved.has(claim.id)) rows.push({ claimId: claim.id, state: "preserved", text: claim.text, wordDiff: null });
    else if (mutated.has(claim.id)) rows.push({ claimId: claim.id, state: "rewritten", text: claim.text, wordDiff: null });
    else rows.push({ claimId: claim.id, state: "added", text: claim.text, wordDiff: null });
  }
  for (const id of refinement.dropped) {
    if (!byId.has(id)) rows.push({ claimId: id, state: "removed", text: null, wordDiff: null });
  }

  return { rows, parentClaimCount: refinement.parent_claims, inlineDiffAvailable: false };
}
