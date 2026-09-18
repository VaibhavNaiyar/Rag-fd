# Streaming Live RAG — operator console

Frontend for **Samsung PRISM GenAI Hackathon, Theme 04**. Next.js 16 · TypeScript · Tailwind · Zustand.

This is not a chat product. It is the instrument that makes the engine's behaviour
visible, because three of the theme's gates are invisible unless the UI shows them:

| Gate | What this UI makes visible |
|---|---|
| **G2** early retrieval | A retrieval marker on the timeline **left of** the utterance-end rule, with the lead stated in ms |
| **G3** multi-intent | One sentence splitting into N sub-query chips, each with its candidate count |
| **G4** grounding | Citation chips resolved against real chunks; an unresolvable marker renders as **unverified** in red |
| **G5** refinement | `v1 → v2` with preserved vs mutated claims and the line "no full-corpus search" |
| **G6** telemetry | Retrieval lead, TTFT, cost and citation support, per turn and per session |

Where a design decision trades trace legibility for chat polish, trace legibility wins.

---

## Running it

```bash
npm install
npm run dev          # talks to the engine's AG-UI stream at ws://<host>/stream
```

Open <http://localhost:3000>. Add `?demo=1` for the fixture bar.

```bash
npm run check        # typecheck + lint + tests
npm run build        # static export into ./out
```

### Environment

| Variable | Default | Meaning |
|---|---|---|
| `NEXT_PUBLIC_WS_URL` | derived from `window.location` | Absolute engine endpoint |

Leaving `NEXT_PUBLIC_WS_URL` unset is what the single-container deployment relies on.

---

## Deployment: one container

`npm run build` writes a self-contained static site to `out/`. FastAPI mounts it as
its static root, so the whole system is one image and one `docker compose up`
(gate G1). There is no second service to explain.

```python
from fastapi.staticfiles import StaticFiles
app.mount("/", StaticFiles(directory="web/out", html=True), name="console")
```

Mount this **after** `/stream` and any `/api` routes, or it will shadow them.

---

## The wire contract: AG-UI

The engine speaks [AG-UI](https://docs.ag-ui.com), the open protocol for agent ↔
UI streams. Every frame is a standard AG-UI event, validated on arrival against
`@ag-ui/core`'s own schemas; one that fails is dropped with a warning, never
rendered. `src/types/events.ts` holds only the shape of OUR payloads inside those
events, mirrored from the engine's translator (`slr/api/agui.py`). **Change it only
in lockstep with the backend.**

### Server → client

| AG-UI event | Carries |
|---|---|
| `RUN_STARTED` / `RUN_FINISHED` / `RUN_ERROR` | one run per turn (`runId` = turn id, `threadId` = session). `RUN_FINISHED.usage` is token spend per model |
| `STEP_STARTED` / `STEP_FINISHED` | the pipeline stage: `listen` → `plan` → `retrieve` → `synthesise` |
| `TOOL_CALL_START` / `ARGS` / `END` | one `corpus_search` per retrieval: `{query, trigger, atMs}`. **This is the G2 evidence** |
| `TOOL_CALL_RESULT` | candidate count and kept hits, or `{cancelled, reason}` (the thrash guard) |
| `TEXT_MESSAGE_START` / `CONTENT` / `END` | the answer, one message per version (`<turnId>:v<n>`) |
| `STATE_SNAPSHOT` / `STATE_DELTA` | shared state, patched with `fast-json-patch`: per turn the echoed transcript, controller decisions, `utteranceEndMs` (the line every lead is measured against), sub-queries, fusion (`quotaApplied`, `fullCorpusSearch`), each version's claims / `preserved` / `mutated` / uncertainty / support rate, latency and cost |

A session opens as its own short run (`RUN_STARTED`, `STATE_SNAPSHOT`,
`RUN_FINISHED`), so every frame sits inside a run. The engine also serves
`POST /agui` (AG-UI over SSE), so any off-the-shelf AG-UI client can talk to it.

### Client → server

`utterance.start` · `utterance.chunk` · `utterance.end` · `replay` · `session.new`

These stay three small input messages (plus two controls) because AG-UI has no
event for input arriving while a run is already under way, and that is exactly
what full-duplex early retrieval needs.

### Two contract rules the backend must hold

1. **Citations are built server-side.** The UI resolves each `[Doc_12 §2.1]` marker
   in the answer body against `Hit.citation`. A marker with no matching hit renders
   in red as "unverified" — deliberately impossible to miss. The model must never
   author a citation string.
2. **The transcript is echoed.** The user bubble and the timeline both read from
   the server's transcript, not the client's draft, so what a judge sees is what the
   engine consumed.

---

## Typed input still streams

The most important frontend decision here: pressing Enter does **not** send one blob.
`src/lib/chunker.ts` breaks the text into 3–5 word groups and releases them at
~150wpm as `utterance.chunk` events, then sends `utterance.end`.

The engine's streaming path — controller, provisional retrieval, decomposition —
therefore runs identically whether the input was typed, replayed or spoken. Without
this, a live demo silently bypasses the controller and **G2 becomes unobservable**.

---

## Layout

Three zones in one CSS grid. The trace rail animates its own column, so opening it
never reflows the sidebar.

```
 260px                     1fr                      0 ↔ 380px
┌──────────┬────────────────────────────────┬──────────────────┐
│ SIDEBAR  │  message list (scrolls)        │  TRACE RAIL      │
│ sessions │  transcript strip (listening)  │  controller      │
│ corpus   │  COMPOSER                      │  sub-queries     │
│ theme    │        max-w-3xl, centered     │  evidence        │
│          │                                │  versions        │
│          │                                │  telemetry       │
└──────────┴────────────────────────────────┴──────────────────┘
```

Below 1280px the rail becomes an overlay drawer; below 768px the sidebar does too.
**Record at 1920×1080 with both panels open** — that is the layout this is tuned for.

### The composer state machine

| Phase | Condition | Composer |
|---|---|---|
| `idle` | no turns yet | vertically centred, greeting + fixture chips above |
| `active` | ≥ 1 turn | docked to the bottom, message list fills above |
| `listening` | utterance open | transcript strip mounts directly above it |

Only the flex justification changes between phases, which is what lets the View
Transition API animate the composer's 420ms travel rather than cross-fading it.
Browsers without the API get the instant change; `prefers-reduced-motion` too.

---

## Project structure

```
src/
├── app/                  layout, page (the whole app is one client tree)
├── styles/
│   ├── tokens.css        EVERY colour, font and radius — the only place literals live
│   └── globals.css       shell grid, prose, view-transition, reduced-motion
├── types/events.ts       our payloads inside AG-UI events
├── store/
│   ├── types.ts          Turn / AnswerVersion / AppState
│   ├── reducer.ts        AG-UI events → turns (state patches, tool calls, text)
│   ├── tokenBatcher.ts   coalesces TEXT_MESSAGE_CONTENT onto animation frames
│   ├── selectors.ts      every derived read (lead time, grouping, rollups)
│   └── useAppStore.ts    Zustand store + imperative connection handles
├── lib/
│   ├── transport/        Transport interface · socket.ts (AG-UI schema validation)
│   ├── chunker.ts        text → timed chunks at speaking pace
│   ├── citations.tsx     markdown renderers that inject citation chips
│   ├── citationPattern.ts  the marker format, pure and tested
│   ├── decisions.ts      decision → label/colour/icon, defined once
│   ├── viewTransition.ts flushSync + startViewTransition
│   ├── format.ts         every number a judge reads goes through here
│   └── constants.ts      budgets, breakpoints, fixture names
├── hooks/                theme, hotkeys, stick-to-bottom, media query, element width
└── components/
    ├── ui/               Button, IconButton, Pill, DecisionPill, Stat, TraceSection…
    ├── shell/            AppShell, Sidebar, TopBar, ConnectionBadge, ErrorBanner
    ├── chat/             Greeting, MessageList, AssistantMessage, Composer…
    ├── trace/            ControllerTimeline, SubQueryList, EvidenceList, VersionDiff…
    └── demo/             DemoBar
```

### Conventions

- **No literal colours in components.** Everything resolves through a token in
  `tokens.css`. Tailwind only maps names onto those variables.
- **Tailwind opacity modifiers are never used on token colours** (`border-primary/30`
  does not work when the colour is a CSS variable). Blended edges are their own
  tokens: `--edge-primary`, `--edge-ok`, and so on.
- **Derived values live in `selectors.ts`**, so chat, trace and metrics cannot
  disagree about what the same turn means.
- **Pipeline state visuals live in `decisions.ts`**, so a decision can never be blue
  in one component and grey in another.

---

## Demo mode

`?demo=1` reveals a bar with four fixtures bound to number keys, a speed slider and
`R` to reset.

| Key | Fixture | Proves |
|---|---|---|
| `1` | compound multi-intent utterance | G2 early retrieval + G3 decomposition |
| `2` | late-arriving detail | G5 refine, don't restart |
| `3` | presentation-only turn | suppression, zero retrieval |
| `4` | question the corpus can't answer | G4 uncertainty, no fabrication |

**Fixture payloads live server-side in `evals/fixtures/`.** The client sends only
`{ type: "replay", fixture: "compound_01" }` — nothing about corpus content is
hardcoded in frontend code, and the console replays exactly what the eval harness
scores. The same four fixtures are the suggestion chips on the idle screen, so an
unscripted judge clicking around still lands on the behaviours that matter.

---

## Accessibility

- Body text ≥ 4.5:1; large text and UI components ≥ 3:1.
- `--ui-primary` (#0381FE) is **3.77:1 on white**: legal for fills and large text,
  **not** for small text. Small text and links use `--ui-primary-ink` (4.71:1).
- `--warn` (#FFC600) is ~1.7:1 on white and is a fill/border only. Warning *words*
  use `--warn-ink`.
- **No state is encoded in colour alone.** Every controller decision carries an icon
  and a text label — a grayscale screenshot stays readable.
- `aria-live="polite"` on the streaming answer; `aria-live="off"` on the trace rail,
  which would otherwise flood a screen reader.
- Keyboard: `⌘K` new session · `⌘/` toggle trace · `Esc` stop streaming · `1`–`4`
  fixtures and `R` reset in demo mode.

---

## Testing

```bash
npm run test
```

30 tests over the pure layer. The one worth knowing about is
`src/store/reducer.test.ts`: every event in it goes through AG-UI's own schema
first, the way the socket receives it, then through the real reducer, and it
asserts the trace state a judge would read — retrieval lead > 0, cancelled
searches keep their marker, v1 survives a refinement with `fullCorpusSearch: false`
on v2, a patch that does not apply is flagged rather than rendered. The backend's
`tests/test_agui.py` checks the other side: every live stream is protocol-correct.

---

## Deliberately not built

Auth · persistence beyond the session · file upload (the corpus is ingested
server-side) · settings panels · mobile-first layouts · message editing ·
regeneration · export.

**Real microphone capture is not built.** The mic button triggers *replay* and is
labelled "Replay transcript" on hover, so nobody thinks speech recognition was faked.

If time appears, spend it on `ControllerTimeline` and `VersionDiff`. Those two
components are the demo.
