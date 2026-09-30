/**
 * Turns stored trace records back into the AG-UI frames the engine sent.
 *
 * A trace record keeps the engine's own event log (`events`) but drops the heavy
 * parts: answer tokens, transcript chunks, the hits inside `retrieval.result` and
 * `fusion.final`, and the claims inside `answer.version`. This module restores
 * those from the rest of the record, then applies the same translation as
 * `Rag-bd/src/slr/api/agui.py`, ported to JavaScript.
 *
 * What the record cannot give back is invented, and labelled as such:
 *   - chunk text: the attribution quote when the grounding recorded one, otherwise
 *     a placeholder sentence;
 *   - per-token timing: tokens are spread evenly between first token and completion.
 *
 * So these streams are for layout and flow tests, not for timing measurements.
 * `scripts/record-stream.mjs` records the real thing from a running engine.
 */

const SEARCH_TOOL = "corpus_search";
const PLACEHOLDER = "Evidence text is not stored in a trace record; this sentence stands in for it.";
const MARKER = /\[[A-Za-z0-9_.:-]+\s*§[^\]\n]{1,24}\]/g;

/** engine event -> the step that starts once it has been reported (null: the last one just ends). */
const STEP_AFTER = { "utterance.end": "plan", subqueries: "retrieve", "fusion.final": "synthesise", "answer.version": null };

const pointer = (...parts) => parts.map((part) => `/${String(part).replace(/~/g, "~0").replace(/\//g, "~1")}`).join("");

const blankTurn = () => ({
  transcript: [],
  utteranceEndMs: null,
  decisions: [],
  subQueries: [],
  fusion: null,
  versions: {},
  latencyMs: null,
  cost: null,
});

// ---------------------------------------------------------------- record -> engine events

/** chunk id -> citation marker, learned from the claims (`[Doc_11 §0]` beside `chunkIds`). */
function citationsByChunk(record) {
  const map = new Map();
  for (const claim of record.answer?.claims ?? []) {
    const markers = [...String(claim.text).matchAll(MARKER)].map((match) => match[0]);
    (claim.chunkIds ?? []).forEach((chunkId, at) => {
      const marker = markers[at] ?? markers[0];
      if (marker && !map.has(chunkId)) map.set(chunkId, marker);
    });
  }
  return map;
}

/** citation marker -> quoted text, from `answer.grounding.attributions`. */
function quotesByCitation(record) {
  const map = new Map();
  for (const line of record.answer?.grounding?.attributions ?? []) {
    const found = /^(\[[^\]]+\])\s+"([\s\S]*)"$/.exec(line);
    if (found?.[1] && found[2]) map.set(found[1], found[2]);
  }
  return map;
}

function makeHitFactory(record) {
  const cited = citationsByChunk(record);
  const quotes = quotesByCitation(record);
  const docOrder = [];
  const byChunk = new Map();
  for (const result of record.retrieval ?? []) {
    for (const kept of result.kept ?? []) {
      const seen = byChunk.get(kept.chunk_id) ?? { score: 0, branches: [], subQueryIds: [] };
      seen.score = Math.max(seen.score, kept.score);
      seen.branches = [...new Set([...seen.branches, ...(kept.branches ?? [])])];
      seen.subQueryIds = [...new Set([...seen.subQueryIds, result.sub_query_id])];
      byChunk.set(kept.chunk_id, seen);
    }
  }
  return (chunkId, override = {}) => {
    const doc = chunkId.slice(0, chunkId.lastIndexOf("_"));
    if (!docOrder.includes(doc)) docOrder.push(doc);
    const suffix = chunkId.slice(chunkId.lastIndexOf("_") + 1);
    const citation = cited.get(chunkId) ?? `[Src_${docOrder.indexOf(doc) + 1} §${suffix}]`;
    const label = /^\[([^\]]+?)\s*(§[^\]]*)\]$/.exec(citation);
    const seen = byChunk.get(chunkId) ?? { score: 0.5, branches: ["bm25", "dense"], subQueryIds: [] };
    return {
      chunkId,
      docId: label?.[1] ?? doc,
      section: label?.[2] ?? `§${suffix}`,
      text: quotes.get(citation) ?? PLACEHOLDER,
      score: override.score ?? seen.score,
      branches: override.branches ?? seen.branches,
      subQueryIds: override.subQueryIds ?? seen.subQueryIds,
      citation,
    };
  };
}

/**
 * The engine events of one turn, each with `t`: ms from the start of the turn, on
 * the engine's clock (the same clock as `atMs`, `at_ms` and `latency_ms.*_abs`).
 */
export function engineEvents(record) {
  const turnId = record.turn_id;
  const makeHit = makeHitFactory(record);
  const results = new Map((record.retrieval ?? []).map((result) => [result.sub_query_id, result]));
  const cancelledAt = new Map(
    (record.retrieval_events ?? []).filter((event) => event.event === "retrieval_cancelled").map((event) => [event.sub_query_id, event.at_ms]),
  );
  const firstToken = record.latency_ms?.first_token_abs ?? 0;
  const complete = record.latency_ms?.complete_abs ?? firstToken;
  const planEnd = (record.utterance_end_ms ?? 0) + (record.decomposition?.ms ?? 0);

  const timed = [];
  let clock = 0;
  const push = (t, event, order) => {
    clock = Math.max(clock, t);
    timed.push({ t: clock, event, order });
  };
  let order = 0;

  for (const original of record.events ?? []) {
    order += 1;
    const event = { ...original };
    switch (event.type) {
      case "retrieval.cancelled":
        push(cancelledAt.get(event.subQueryId) ?? clock, event, order);
        break;
      case "subqueries":
        push(planEnd, event, order);
        break;
      case "retrieval.result": {
        const recorded = results.get(event.subQueryId);
        event.kept = (recorded?.kept ?? []).map((kept) =>
          makeHit(kept.chunk_id, { score: kept.score, branches: kept.branches, subQueryIds: [event.subQueryId] }),
        );
        push(clock, event, order);
        break;
      }
      case "fusion.final":
        event.hits = (record.fusion?.chunk_ids ?? []).map((chunkId) => makeHit(chunkId));
        push(clock, event, order);
        break;
      case "answer.version": {
        const isFinal = record.answer?.version === event.version;
        const tokens = isFinal ? String(record.answer?.body ?? "").match(/\S+\s*/g) ?? [] : [];
        const start = Math.max(clock, firstToken);
        tokens.forEach((text, at) => {
          push(start + ((Math.max(complete, start) - start) * at) / Math.max(tokens.length, 1), { type: "answer.token", turnId, version: event.version, text }, order);
        });
        if (isFinal) {
          event.claims = record.answer.claims ?? [];
          if ((record.answer.clarification ?? []).length > 0) event.clarification = record.answer.clarification;
        } else {
          event.claims = [];
        }
        push(Math.max(clock, complete), event, order);
        break;
      }
      case "turn.complete":
        push(Math.max(clock, complete), event, order);
        break;
      default:
        push(typeof event.atMs === "number" ? event.atMs : clock, event, order);
    }
  }

  // Transcript chunks are not in the event log; they arrive on the `at_ms` clock.
  const chunks = (record.chunks ?? []).map((chunk, at) => ({
    t: chunk.at_ms,
    order: -1 - (record.chunks.length - at),
    event: { type: "transcript.chunk", turnId, text: chunk.text, atMs: chunk.at_ms },
  }));
  return [...chunks, ...timed].sort((a, b) => a.t - b.t || a.order - b.order).map(({ t, event }) => ({ t, event }));
}

// ---------------------------------------------------------------- engine events -> AG-UI

const usageOf = (cost) => {
  const models = (cost?.models ?? []).map((entry) => ({
    model: entry.model,
    inputTokens: entry.inputTokens,
    outputTokens: entry.outputTokens,
    totalTokens: entry.inputTokens + entry.outputTokens,
  }));
  return models.length > 0 ? models : undefined;
};

/** One per session. Feed it engine events in order; it returns AG-UI frames. */
export class AgUiTranslator {
  constructor(threadId) {
    this.threadId = threadId;
    this.state = { session: null, turns: {} };
    this.run = null;
    this.step = null;
    this.message = null;
    this.calls = new Set();
    this.results = new Map();
  }

  snapshot() {
    return { type: "STATE_SNAPSHOT", snapshot: structuredClone(this.state) };
  }

  patch(...ops) {
    // The frame gets its own copy: this.state keeps mutating, and a frame that shared
    // an object with it would change after it was "sent".
    const delta = structuredClone(ops);
    for (const op of ops) this.apply(op);
    return { type: "STATE_DELTA", delta };
  }

  apply(op) {
    const keys = op.path.split("/").slice(1).map((key) => key.replace(/~1/g, "/").replace(/~0/g, "~"));
    let target = this.state;
    for (const key of keys.slice(0, -1)) target = Array.isArray(target) ? target[Number(key)] : target[key];
    const last = keys[keys.length - 1];
    if (Array.isArray(target)) {
      if (last === "-") target.push(op.value);
      else target[Number(last)] = op.value;
    } else target[last] = op.value;
  }

  openCall(callId, args) {
    this.calls.add(callId);
    return [
      { type: "TOOL_CALL_START", toolCallId: callId, toolCallName: SEARCH_TOOL },
      { type: "TOOL_CALL_ARGS", toolCallId: callId, delta: JSON.stringify(args) },
      { type: "TOOL_CALL_END", toolCallId: callId },
    ];
  }

  result(callId, content) {
    const n = (this.results.get(callId) ?? 0) + 1;
    this.results.set(callId, n);
    return { type: "TOOL_CALL_RESULT", messageId: `${callId}:result${n > 1 ? `:${n}` : ""}`, toolCallId: callId, role: "tool", content: JSON.stringify(content) };
  }

  closeMessage() {
    if (this.message === null) return [];
    const messageId = this.message;
    this.message = null;
    return [{ type: "TEXT_MESSAGE_END", messageId }];
  }

  closeStep() {
    if (this.step === null) return [];
    const stepName = this.step;
    this.step = null;
    return [{ type: "STEP_FINISHED", stepName }];
  }

  openStep(stepName) {
    this.step = stepName;
    return [{ type: "STEP_STARTED", stepName }];
  }

  endRun() {
    const out = [...this.closeMessage(), ...this.closeStep()];
    this.run = null;
    return out;
  }

  queryOf(turnId, callId) {
    return (this.state.turns[turnId]?.subQueries ?? []).find((item) => item.id === callId)?.text ?? "";
  }

  cancelOpenRun() {
    if (this.run === null) return [];
    return [...this.endRun(), { type: "RUN_FINISHED", threadId: this.threadId, runId: this.runIdOf, outcome: { type: "cancelled" } }];
  }

  translate(event) {
    let out = this.translateOne(event);
    const after = STEP_AFTER[event.type];
    if (event.type in STEP_AFTER && this.run !== null && this.step !== after) {
      out = [...out, ...this.closeStep()];
      if (after) out = [...out, ...this.openStep(after)];
    }
    return out;
  }

  translateOne(event) {
    const kind = event.type;
    const turnId = event.turnId ?? "";
    const turn = pointer("turns", turnId);

    switch (kind) {
      case "session.ready": {
        const out = this.cancelOpenRun();
        this.state = { session: { id: event.sessionId, corpus: event.corpus }, turns: {} };
        this.calls.clear();
        this.results.clear();
        const opening = `${event.sessionId}:open`;
        return [
          ...out,
          { type: "RUN_STARTED", threadId: this.threadId, runId: opening },
          this.snapshot(),
          { type: "RUN_FINISHED", threadId: this.threadId, runId: opening },
        ];
      }
      case "turn.start": {
        const out = this.cancelOpenRun();
        this.run = turnId;
        this.runIdOf = turnId;
        out.push({ type: "RUN_STARTED", threadId: this.threadId, runId: turnId });
        out.push(this.patch({ op: "add", path: turn, value: blankTurn() }));
        return [...out, ...this.openStep("listen")];
      }
      case "transcript.chunk":
        return [this.patch({ op: "add", path: `${turn}/transcript/-`, value: { text: event.text, atMs: event.atMs } })];
      case "controller.decision": {
        const decision = {};
        for (const key of ["decision", "reason", "atMs", "confidence"]) if (key in event) decision[key] = event[key];
        return [this.patch({ op: "add", path: `${turn}/decisions/-`, value: decision })];
      }
      case "retrieval.started":
        return this.openCall(event.subQueryId, { query: event.query ?? "", trigger: event.trigger, atMs: event.atMs });
      case "retrieval.cancelled":
        return [this.result(event.subQueryId, { cancelled: true, reason: event.reason })];
      case "utterance.end":
        return [this.patch({ op: "replace", path: `${turn}/utteranceEndMs`, value: event.atMs })];
      case "subqueries":
        return [this.patch({ op: "replace", path: `${turn}/subQueries`, value: event.items })];
      case "retrieval.result": {
        const out = [];
        if (!this.calls.has(event.subQueryId)) out.push(...this.openCall(event.subQueryId, { query: this.queryOf(turnId, event.subQueryId), reused: true }));
        out.push(this.result(event.subQueryId, { candidates: event.candidates, kept: event.kept, reused: Boolean(event.reused) }));
        return out;
      }
      case "fusion.final":
        return [
          this.patch({
            op: "replace",
            path: `${turn}/fusion`,
            value: { hits: event.hits, quotaApplied: event.quotaApplied, fullCorpusSearch: event.fullCorpusSearch },
          }),
        ];
      case "answer.token": {
        if (!event.text) return [];
        const messageId = `${turnId}:v${event.version}`;
        const out = [];
        if (this.message !== messageId) {
          out.push(...this.closeMessage());
          this.message = messageId;
          out.push({ type: "TEXT_MESSAGE_START", messageId, role: "assistant" });
        }
        out.push({ type: "TEXT_MESSAGE_CONTENT", messageId, delta: event.text });
        return out;
      }
      case "answer.version": {
        const version = {};
        for (const [key, value] of Object.entries(event)) if (!["type", "turnId", "version"].includes(key)) version[key] = value;
        return [...this.closeMessage(), this.patch({ op: "add", path: `${turn}/versions/${event.version}`, value: version })];
      }
      case "turn.complete": {
        const delta = this.patch(
          { op: "replace", path: `${turn}/latencyMs`, value: event.latencyMs },
          { op: "replace", path: `${turn}/cost`, value: event.cost },
        );
        const usage = usageOf(event.cost);
        return [delta, ...this.endRun(), { type: "RUN_FINISHED", threadId: this.threadId, runId: turnId, ...(usage ? { usage } : {}) }];
      }
      case "error": {
        const out = turnId && turnId === this.run ? this.endRun() : [];
        return [...out, { type: "RUN_ERROR", message: event.message, code: event.code }];
      }
      default:
        throw new Error(`no AG-UI mapping for engine event ${JSON.stringify(kind)}`);
    }
  }
}

// ---------------------------------------------------------------- sessions

/**
 * Rewrites turn ids inside records (`t1` -> `t3`, and every id built on them:
 * sub-queries `t1_sq1`, claims `t1_v1_c1`). Two passes, so a chain like t1->t2,
 * t2->t3 cannot rewrite twice.
 */
export function renumber(value, mapping) {
  const entries = [...mapping].filter(([from, to]) => from !== to);
  if (entries.length === 0) return structuredClone(value);
  let json = JSON.stringify(value);
  entries.forEach(([from], at) => {
    json = json.split(`"${from}_`).join(`"\u0001${at}_`);
    json = json.split(`"turn_id":"${from}"`).join(`"turn_id":"\u0001${at}"`);
    json = json.split(`"turnId":"${from}"`).join(`"turnId":"\u0001${at}"`);
  });
  entries.forEach(([, to], at) => {
    json = json.split(`\u0001${at}`).join(to);
  });
  return JSON.parse(json);
}

export class MockSession {
  constructor({ sessionId, corpus }) {
    this.sessionId = sessionId;
    this.corpus = corpus;
    this.translator = new AgUiTranslator(sessionId);
    this.turns = 0;
  }

  /** The frames that announce the session: the opening run with the initial state. */
  opening() {
    return this.translator.translate({ type: "session.ready", sessionId: this.sessionId, corpus: this.corpus });
  }

  /**
   * Frames for the records of one scenario, played as consecutive turns of this
   * session. Returns `{frames: [{t, frame}], records}`; `records` are the trace
   * records as this engine would now store them (renumbered, in this session).
   */
  play(records, { startedAt }) {
    const mapping = new Map(records.map((record, at) => [record.turn_id, `t${this.turns + at + 1}`]));
    const renumbered = records.map((record) => {
      const copy = renumber(record, mapping);
      copy.session_id = this.sessionId;
      return copy;
    });
    const frames = [];
    let offset = 0;
    for (const record of renumbered) {
      this.turns += 1;
      record.started_at = startedAt + offset;
      // The record's own event log opens with `turn.start`.
      for (const { t, event } of engineEvents(record)) for (const frame of this.translator.translate(event)) frames.push({ t: offset + t, frame });
      offset += (record.latency_ms?.complete_abs ?? 0) + 400;
    }
    return { frames, records: renumbered };
  }
}

/** A whole scenario in a fresh session, opening frames first. Used by tests and the recorder's self-check. */
export function framesForScenario(records, { sessionId = "s_mock_0001", corpus = { docs: 12, chunks: 96 }, startedAt = 0 } = {}) {
  const session = new MockSession({ sessionId, corpus });
  const opening = session.opening().map((frame) => ({ t: 0, frame }));
  const { frames, records: stored } = session.play(records, { startedAt });
  return { frames: [...opening, ...frames], records: stored };
}
