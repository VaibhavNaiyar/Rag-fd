import type { Hit, RetrievalBranch } from "@/types/events";

/**
 * SIMULATOR ONLY — loaded exclusively when NEXT_PUBLIC_TRANSPORT=mock.
 *
 * Stand-in corpus metadata so the UI can be built and reviewed before the engine
 * exists. The shipped build talks to the real `/stream` and this module is never
 * imported. Nothing here is corpus content the eval harness scores.
 */

export interface HitSpec {
  docId: string;
  section: string;
  text: string;
  score: number;
  branches: RetrievalBranch[];
}

let chunkCounter = 0;

/** Build a Hit with a server-shaped citation string, as the engine would. */
export function makeHit(spec: HitSpec, subQueryIds: string[]): Hit {
  chunkCounter += 1;
  return {
    chunkId: `chunk_${String(chunkCounter).padStart(4, "0")}`,
    docId: spec.docId,
    section: spec.section,
    text: spec.text,
    score: spec.score,
    branches: spec.branches,
    subQueryIds,
    citation: `[${spec.docId} §${spec.section}]`,
  };
}

export function resetHitCounter(): void {
  chunkCounter = 0;
}

export const MOCK_CORPUS = { docs: 312, chunks: 1284 } as const;
