/** Values shared across components. Nothing here describes corpus content. */

/** §15 budget: cap stored snippet length so a 20-turn session stays under 150MB. */
export const EVIDENCE_SNIPPET_CHARS = 600;

/** Words per minute the client-side chunker emits typed input at. */
export const TYPED_STREAM_WPM = 150;

/** Words per emitted transcript chunk — matches how an ASR partial arrives. */
export const TYPED_CHUNK_WORDS = { min: 3, max: 5 } as const;

/** Layout breakpoints; kept in step with the media queries in globals.css. */
export const BREAKPOINT = { sidebar: 768 } as const;

/** Reconnect backoff for the socket, in ms. Capped so a live session always recovers. */
export const RECONNECT_BACKOFF_MS = [500, 1000, 2000, 4000, 8000] as const;

/**
 * Fixture families, in the order the replay keys 1–4 take them. The fixtures
 * themselves come from the engine (`GET /fixtures`) for whichever corpus it is
 * serving, so nothing about corpus content is hardcoded here and the console
 * replays exactly what the eval harness scores.
 */
export const FIXTURE_FAMILIES: readonly { family: string; label: string; proves: string }[] = [
  { family: "compound", label: "Compound multi-intent request", proves: "G2 early retrieval · G3 decomposition" },
  { family: "late_detail", label: "Late-arriving detail", proves: "G5 refine, don't restart" },
  { family: "suppression", label: "Presentation-only turn", proves: "Suppression · zero retrieval" },
  { family: "unanswerable", label: "Outside the corpus", proves: "G4 uncertainty, no fabrication" },
  { family: "single", label: "Single-intent question", proves: "No over-fragmentation" },
];

export const REPLAY_SPEEDS = [0.5, 1, 1.5, 2] as const;
