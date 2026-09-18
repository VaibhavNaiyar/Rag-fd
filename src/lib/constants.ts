/** Values shared across components. Nothing here describes corpus content. */

/** §15 budget: cap stored snippet length so a 20-turn session stays under 150MB. */
export const EVIDENCE_SNIPPET_CHARS = 600;

/** Words per minute the client-side chunker emits typed input at. */
export const TYPED_STREAM_WPM = 150;

/** Words per emitted transcript chunk — matches how an ASR partial arrives. */
export const TYPED_CHUNK_WORDS = { min: 3, max: 5 } as const;

/** Layout breakpoints; kept in step with the media queries in globals.css. */
export const BREAKPOINT = { trace: 1280, sidebar: 768 } as const;

/** Reconnect backoff for the socket, in ms. Capped so a demo always recovers. */
export const RECONNECT_BACKOFF_MS = [500, 1000, 2000, 4000, 8000] as const;

/**
 * Demo fixtures. Names only — every payload lives in `evals/fixtures/`
 * server-side, so the UI replays exactly what the eval harness scores and
 * nothing about corpus content is hardcoded in frontend code.
 */
export interface FixtureDescriptor {
  id: string;
  hotkey: string;
  label: string;
  /** The gate this fixture exists to demonstrate. */
  proves: string;
}

export const DEMO_FIXTURES: readonly FixtureDescriptor[] = [
  {
    id: "compound_01",
    hotkey: "1",
    label: "Compound multi-intent request",
    proves: "G2 early retrieval · G3 decomposition",
  },
  {
    id: "late_detail_01",
    hotkey: "2",
    label: "Late-arriving detail",
    proves: "G5 refine, don't restart",
  },
  {
    id: "presentation_01",
    hotkey: "3",
    label: "Presentation-only turn",
    proves: "Suppression · zero retrieval",
  },
  {
    id: "unanswerable_01",
    hotkey: "4",
    label: "Outside the corpus",
    proves: "G4 uncertainty, no fabrication",
  },
] as const;

export const REPLAY_SPEEDS = [0.5, 1, 1.5, 2] as const;
