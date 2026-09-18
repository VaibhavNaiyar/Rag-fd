import type { TurnSpec } from "@/lib/transport/mock/script";

/**
 * SIMULATOR ONLY — the stand-in for `evals/fixtures/` until the engine lands.
 *
 * Each scenario is shaped to exercise one gate end to end, so every trace
 * surface can be built and reviewed against realistic timings. The shipped
 * client sends `{ type: "replay", fixture }` and the real payloads live
 * server-side; this file is never bundled when NEXT_PUBLIC_TRANSPORT is unset.
 */

const COMPOUND: TurnSpec = {
  utterance:
    "Walk me through how the retrieval controller decides when to fire, and tell me what the fusion step does with overlapping chunks, and what the latency budget is per turn.",
  subQueries: [
    {
      text: "How does the retrieval controller decide when to trigger a search?",
      leadMs: 1300,
      candidates: 48,
      hits: [
        {
          docId: "Doc_12",
          section: "2.1",
          text: "The controller evaluates each incremental transcript fragment against an intent-stability threshold. A retrieval is issued only once the fragment carries enough content words to form a search-ready query, which prevents thrashing on partial thoughts.",
          score: 0.91,
          branches: ["dense", "bm25"],
        },
        {
          docId: "Doc_12",
          section: "2.3",
          text: "Decisions are emitted as one of wait, retrieve or suppress, each with a machine-readable reason code and a confidence score, so the policy can be audited offline.",
          score: 0.84,
          branches: ["dense"],
        },
      ],
    },
    {
      text: "What does the fusion step do with overlapping chunks?",
      leadMs: 620,
      candidates: 61,
      hits: [
        {
          docId: "Doc_31",
          section: "4.2",
          text: "Candidates from every sub-query are merged with reciprocal rank fusion. Near-duplicate chunks are collapsed by content hash, and a per-sub-query quota guarantees no single intent starves the others out of the context window.",
          score: 0.88,
          branches: ["bm25", "dense"],
        },
        {
          docId: "Doc_07",
          section: "3.4",
          text: "Deduplication runs before reranking so the cross-encoder never spends budget scoring two copies of the same passage.",
          score: 0.79,
          branches: ["bm25"],
        },
      ],
    },
    {
      text: "What is the per-turn latency budget?",
      leadMs: 180,
      candidates: 34,
      hits: [
        {
          docId: "Doc_44",
          section: "6.1",
          text: "The per-turn budget allocates 400ms to retrieval and reranking combined, with time to first token targeted under 900ms measured from the end of the utterance.",
          score: 0.86,
          branches: ["dense"],
        },
      ],
    },
  ],
  version: {
    body: "The controller scores each incoming transcript fragment for intent stability and only issues a search once the fragment is search-ready, which is what keeps partial thoughts from triggering a retrieval [Doc_12 §2.1]. Every decision is logged as wait, retrieve or suppress with a reason code and a confidence value [Doc_12 §2.3].\n\nFusion merges the candidates from all sub-queries with reciprocal rank fusion, collapses near-duplicate chunks by content hash, and applies a per-sub-query quota so one intent cannot crowd the others out of the context window [Doc_31 §4.2]. Deduplication runs ahead of reranking so the cross-encoder never scores the same passage twice [Doc_07 §3.4].\n\nThe budget allows 400ms for retrieval and reranking together, with time to first token targeted below 900ms from the end of the utterance [Doc_44 §6.1].",
    claims: [
      {
        text: "The controller only retrieves once a fragment is search-ready.",
        subQueryIndex: 0,
        hitIndexes: [0],
        support: 0.94,
      },
      {
        text: "Decisions are logged with reason codes and confidence.",
        subQueryIndex: 0,
        hitIndexes: [1],
        support: 0.89,
      },
      {
        text: "Fusion uses RRF with content-hash deduplication and a per-sub-query quota.",
        subQueryIndex: 1,
        hitIndexes: [2, 3],
        support: 0.92,
      },
      {
        text: "Retrieval and reranking share a 400ms budget; TTFT targets under 900ms.",
        subQueryIndex: 2,
        hitIndexes: [4],
        support: 0.87,
      },
    ],
    uncertainty: [],
  },
};

const LATE_DETAIL: TurnSpec = {
  utterance:
    "Summarise the deployment requirements for the streaming service, and actually make that just the single-container path.",
  subQueries: [
    {
      text: "What are the deployment requirements for the streaming service?",
      leadMs: 980,
      candidates: 52,
      hits: [
        {
          docId: "Doc_19",
          section: "7.1",
          text: "The service ships as a single container image. The API, the static console bundle and the in-process index are all mounted by one FastAPI application, so the full system starts from one compose command.",
          score: 0.93,
          branches: ["dense", "bm25"],
        },
        {
          docId: "Doc_19",
          section: "7.4",
          text: "A multi-node deployment splits the index onto a dedicated retrieval service and requires a shared object store for chunk payloads.",
          score: 0.81,
          branches: ["bm25"],
        },
        {
          docId: "Doc_22",
          section: "1.2",
          text: "Container startup builds the index from the mounted corpus directory and reports readiness only after the first health probe succeeds.",
          score: 0.77,
          branches: ["dense"],
        },
      ],
    },
  ],
  version: {
    body: "Deployment comes in two shapes. The single-container path mounts the API, the console bundle and the in-process index inside one FastAPI application, so the whole system starts from a single compose command [Doc_19 §7.1]. The multi-node path splits the index onto a dedicated retrieval service and adds a shared object store for chunk payloads [Doc_19 §7.4]. In both cases startup builds the index from the mounted corpus directory and readiness is only reported after the first health probe passes [Doc_22 §1.2].",
    claims: [
      {
        text: "The single-container path runs API, console and index in one FastAPI app.",
        subQueryIndex: 0,
        hitIndexes: [0],
        support: 0.95,
      },
      {
        text: "The multi-node path needs a separate retrieval service and object store.",
        subQueryIndex: 0,
        hitIndexes: [1],
        support: 0.86,
      },
      {
        text: "Startup builds the index from the mounted corpus and gates readiness on a health probe.",
        subQueryIndex: 0,
        hitIndexes: [2],
        support: 0.9,
      },
    ],
    uncertainty: [],
  },
  refinement: {
    version: {
      body: "Narrowing to the single-container path: the API, the console bundle and the in-process index all run inside one FastAPI application, so the system starts from a single compose command [Doc_19 §7.1]. Startup builds the index from the mounted corpus directory and readiness is reported only once the first health probe passes [Doc_22 §1.2]. No external object store or separate retrieval service is involved on this path.",
      claims: [
        {
          text: "The single-container path runs API, console and index in one FastAPI app.",
          subQueryIndex: 0,
          hitIndexes: [0],
          support: 0.95,
        },
        {
          text: "Startup builds the index from the mounted corpus and gates readiness on a health probe.",
          subQueryIndex: 0,
          hitIndexes: [2],
          support: 0.9,
        },
        {
          text: "The single-container path needs no object store or separate retrieval service.",
          subQueryIndex: 0,
          hitIndexes: [0],
          support: 0.83,
        },
      ],
      // Two claims carried through untouched; one was rewritten by the late detail.
      preserved: [0, 1],
      mutated: [2],
      uncertainty: [],
    },
  },
};

const PRESENTATION_ONLY: TurnSpec = {
  utterance: "Actually, shorten that last answer and give it to me as three bullet points.",
  suppress: { reason: "presentation_only" },
  subQueries: [],
  version: {
    body: "- The single-container path runs the API, the console and the index inside one FastAPI application [Doc_19 §7.1].\n- Startup builds the index from the mounted corpus directory [Doc_22 §1.2].\n- Readiness is only reported once the first health probe passes [Doc_22 §1.2].",
    claims: [],
    uncertainty: [],
  },
};

const UNANSWERABLE: TurnSpec = {
  utterance: "What did the team decide about pricing in last quarter's board meeting?",
  subQueries: [
    {
      text: "What pricing decisions were made in the board meeting?",
      leadMs: 740,
      candidates: 29,
      hits: [
        {
          docId: "Doc_58",
          section: "2.2",
          text: "The document set covers system architecture, retrieval configuration and deployment topology. Commercial terms and pricing are maintained outside this corpus.",
          score: 0.44,
          branches: ["bm25"],
        },
      ],
    },
  ],
  version: {
    body: "The corpus covers system architecture, retrieval configuration and deployment topology; commercial material is explicitly held outside it [Doc_58 §2.2]. I have nothing here that records a pricing decision, so I am not going to infer one.",
    claims: [
      {
        text: "The corpus scope excludes commercial and pricing material.",
        subQueryIndex: 0,
        hitIndexes: [0],
        support: 0.72,
      },
    ],
    uncertainty: [
      "No board meeting minutes appear anywhere in the indexed corpus.",
      "No pricing decision, figure or effective date is supported by any retrieved chunk.",
    ],
  },
};

export const MOCK_SCENARIOS: Record<string, TurnSpec> = {
  compound_01: COMPOUND,
  late_detail_01: LATE_DETAIL,
  presentation_01: PRESENTATION_ONLY,
  unanswerable_01: UNANSWERABLE,
};

/**
 * Typed input has no fixture behind it, so the simulator improvises: it splits
 * the utterance on coordinating conjunctions the way the decomposer would, and
 * answers from the compound fixture's evidence. Enough to exercise the UI path.
 */
export function scenarioForTypedText(text: string): TurnSpec {
  const parts = text
    .split(/\s+(?:and|also|plus|then)\s+|[?;]\s*/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 8);

  const subQueries = (parts.length > 0 ? parts : [text]).slice(0, 3);
  const template = COMPOUND.subQueries;

  return {
    utterance: text,
    subQueries: subQueries.map((part, index) => {
      const source = template[index] ?? template[0];
      return {
        text: part.endsWith("?") ? part : `${part}?`,
        leadMs: 1200 - index * 420,
        candidates: source?.candidates ?? 40,
        hits: source?.hits ?? [],
      };
    }),
    version: {
      body: COMPOUND.version.body,
      claims: COMPOUND.version.claims.slice(0, subQueries.length),
      uncertainty: [],
    },
  };
}
