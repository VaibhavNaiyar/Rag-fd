/**
 * Sample data for the kit page. It is shaped like real turns but is not real data and
 * is never shown outside the kit (PHASES.md R6): the ids are obvious placeholders.
 */

export interface KitTurn {
  id: string;
  utterance: string;
  status: "complete" | "streaming" | "error";
  ttft: number | null;
  lead: number | null;
  cost: string;
  support: string;
  tokens: number;
  session: string;
}

const UTTERANCES = [
  "Book a venue for 30 people and a vegetarian lunch",
  "What is the cancellation window for the Riverside Hall?",
  "Actually make that 40 people",
  "Which vendors handle Jain catering?",
  "Summarise the travel policy for international trips",
  "Who approves an exception to the per diem?",
  "Reformat that as a table",
  "What is the capital of Australia?",
];

export const KIT_TURNS: KitTurn[] = UTTERANCES.map((utterance, index) => ({
  id: `t${index + 1}`,
  utterance,
  status: index === 3 ? "error" : index === 6 ? "streaming" : "complete",
  ttft: index === 3 ? null : 640 + index * 90,
  lead: index === 6 ? null : 1300 - index * 110,
  cost: `$0.00${20 + index * 3}`,
  support: `${88 + index}%`,
  tokens: 1200 + index * 240,
  session: "s_kit_0001",
}));

/** A record shaped like a trace record, with a very long answer string on purpose. */
export const KIT_RECORD = {
  trace_version: 1,
  session_id: "s_kit_0001",
  turn_id: "t3",
  latency_ms: { first_token_abs: 1240, complete_abs: 2810 },
  retrieval: [
    { sub_query_id: "t3_sq1", ms: 182, kept: [{ chunk_id: "Doc_11_0", score: 0.83 }, { chunk_id: "Doc_02_4", score: 0.61 }] },
    { sub_query_id: "t3_sq2", ms: 205, kept: [] },
  ],
  answer: {
    version: 2,
    body: "The Riverside Hall allows a full refund when the booking is cancelled fifteen or more calendar days before the event. ".repeat(5),
    unbroken: "c8ba5e906dda6e84".repeat(32),
  },
  degraded: false,
  uncertainty: null,
};

export const KIT_SERIES = [820, 760, 910, null, 690, 640, 700, 1240, 980, 720, 690, 660];

export const KIT_DISTRIBUTION = [640, 655, 690, 700, 720, 760, 780, 820, 830, 910, 980, 1240, 640, 700, 720, 690];

export const KIT_CODE = `retrieve(sub_query="Riverside Hall cancellation window", branches=["bm25", "dense"], quota_per_intent=4)\nfuse(chunks=8, rerank=True, full_corpus_search=False)\nsynthesise(version=2, refine_from=1, preserved=["t3_v1_c1", "t3_v1_c3"])  # ${"x".repeat(160)}`;

export const SIXTY = "A label that is deliberately sixty characters long, no fewer!";

/** Longer than any phone is wide, so the truncated badge shows its ellipsis at every width up to a tablet. */
export const LONG_LABEL = "A label of about a hundred and twenty characters that is far too long for a phone and has to be cut off or wrapped, not overflow";
