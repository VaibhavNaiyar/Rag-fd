#!/usr/bin/env node
/**
 * Mock engine: the engine's HTTP and WebSocket surface, backed by the trace fixtures.
 *
 *   node e2e/mock-engine/server.mjs [--port 4173] [--host 127.0.0.1] [--static out] [--realtime]
 *
 * One origin, like the single-container deployment:
 *   GET  /health, /fixtures, /trace, /trace/{turn_id}?session_id=
 *   WS   /stream        AG-UI frames out; replay, utterance.* and session.new in
 *   GET  everything else from the static export (out/)
 * plus test controls: GET /__mock/state, POST /__mock/reset, POST /__mock/preload.
 *
 * By default a replay delivers all its frames at once, so a test finishes the same
 * way every time. --realtime spaces them as the trace recorded them, divided by the
 * speed the client asked for.
 *
 * The frames come from `synthesize.mjs` (built from real trace records) unless
 * `e2e/fixtures/streams/<fixture>.ndjson` exists, recorded by scripts/record-stream.mjs
 * from a running engine; a recorded stream is used for the first replay of a session.
 *
 * Set MOCK_NOW (epoch ms) to freeze the clock the stored records are stamped with.
 */
import { createServer } from "node:http";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { MockSession } from "./synthesize.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../..");
const FIXTURES = path.join(REPO, "e2e", "fixtures");

const argv = process.argv.slice(2);
const option = (name, fallback) => {
  const at = argv.indexOf(name);
  return at >= 0 && argv[at + 1] ? argv[at + 1] : fallback;
};
const PORT = Number(option("--port", process.env.MOCK_PORT ?? 4173));
const HOST = option("--host", "127.0.0.1");
const STATIC_DIR = path.resolve(REPO, option("--static", "out"));
const REALTIME = argv.includes("--realtime");
const now = () => (process.env.MOCK_NOW ? Number(process.env.MOCK_NOW) : Date.now());

const CORPUS = { docs: 12, chunks: 96 };
const RING_SIZE = 500;

// ---------------------------------------------------------------- fixtures

// The engine lists fixtures by family, so the console's four featured cases are the
// first multi-turn one of each family. The enterprise corpus comes first, as it is
// the corpus the engine serves.
const FAMILY_ORDER = ["compound", "late_detail", "suppression", "unanswerable", "single"];
const rank = (scenario) => [scenario.corpus === "enterprise" ? 0 : 1, FAMILY_ORDER.indexOf(scenario.family), scenario.fixture];
const scenarios = readdirSync(path.join(FIXTURES, "traces"))
  .filter((name) => name.endsWith(".json"))
  .map((name) => JSON.parse(readFileSync(path.join(FIXTURES, "traces", name), "utf8")))
  .sort((a, b) => {
    const [ac, af, ai] = rank(a);
    const [bc, bf, bi] = rank(b);
    return ac - bc || af - bf || String(ai).localeCompare(String(bi));
  });

/** fixture id -> [{t, frame}] recorded from a real engine, when present. */
const recorded = new Map();
const streamsDir = path.join(FIXTURES, "streams");
if (existsSync(streamsDir)) {
  for (const name of readdirSync(streamsDir).filter((file) => file.endsWith(".ndjson"))) {
    const lines = readFileSync(path.join(streamsDir, name), "utf8").split("\n").filter(Boolean);
    recorded.set(name.replace(/\.ndjson$/, ""), lines.map((line) => JSON.parse(line)));
  }
}

const findScenario = (id) => scenarios.find((scenario) => scenario.fixture === id);

/** The scenario whose first utterance shares the most words with what was typed. */
function bestScenario(text) {
  const words = new Set(text.toLowerCase().match(/[a-z']+/g) ?? []);
  const score = (scenario) => (scenario.records[0].utterance.toLowerCase().match(/[a-z']+/g) ?? []).filter((word) => words.has(word)).length;
  return [...scenarios].sort((a, b) => score(b) - score(a))[0] ?? scenarios[0];
}

// ---------------------------------------------------------------- state

/** Recent trace records, oldest first, as the engine's in-memory ring holds them. */
let ring = [];
let sessionCounter = 0;

const remember = (records) => {
  ring = [...ring, ...records].slice(-RING_SIZE);
};

const reset = () => {
  ring = [];
  sessionCounter = 0;
};

const newSession = () => {
  sessionCounter += 1;
  return new MockSession({ sessionId: `s_mock_${String(sessionCounter).padStart(4, "0")}`, corpus: CORPUS });
};

function preload() {
  const session = newSession();
  for (const scenario of scenarios) remember(session.play(scenario.records, { startedAt: now() }).records);
}

// ---------------------------------------------------------------- http

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".map": "application/json",
};

function send(response, status, body, type = "application/json; charset=utf-8") {
  response.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  });
  response.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function serveStatic(pathname, response) {
  const clean = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const candidates = [path.join(STATIC_DIR, clean), path.join(STATIC_DIR, clean, "index.html"), path.join(STATIC_DIR, `${clean}.html`)];
  for (const candidate of candidates) {
    if (candidate.startsWith(STATIC_DIR) && existsSync(candidate) && statSync(candidate).isFile()) {
      return send(response, 200, readFileSync(candidate), TYPES[path.extname(candidate)] ?? "application/octet-stream");
    }
  }
  const notFound = path.join(STATIC_DIR, "404.html");
  if (existsSync(notFound)) return send(response, 404, readFileSync(notFound), TYPES[".html"]);
  return send(response, 404, { detail: "not found" });
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  const { pathname } = url;
  if (request.method === "OPTIONS") return send(response, 204, "");

  if (pathname === "/health") {
    return send(response, 200, {
      status: "ok",
      version: "mock-engine",
      corpus: { ...CORPUS, indexedAt: now() - 60_000 },
      models: scenarios[0]?.records[0]?.models ?? {},
    });
  }
  if (pathname === "/fixtures") {
    return send(response, 200, {
      corpus: "enterprise",
      fixtures: scenarios.map((scenario) => ({
        id: scenario.fixture,
        family: scenario.family,
        description: scenario.description,
        turns: scenario.records.map((record) => record.utterance),
      })),
    });
  }
  if (pathname === "/trace") {
    const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") ?? 20), 200));
    const sessionId = url.searchParams.get("session_id");
    const items = ring.filter((record) => !sessionId || record.session_id === sessionId);
    return send(response, 200, { traces: items.slice(-limit) });
  }
  if (pathname.startsWith("/trace/")) {
    const turnId = decodeURIComponent(pathname.slice("/trace/".length));
    const sessionId = url.searchParams.get("session_id");
    const found = [...ring].reverse().find((record) => record.turn_id === turnId && (!sessionId || record.session_id === sessionId));
    return found ? send(response, 200, found) : send(response, 404, { detail: "no such turn in the recent trace ring" });
  }
  if (pathname === "/__mock/state") return send(response, 200, { sessions: sessionCounter, ring: ring.length, scenarios: scenarios.length, recorded: [...recorded.keys()] });
  if (pathname === "/__mock/reset" && request.method === "POST") {
    reset();
    return send(response, 200, { ok: true });
  }
  if (pathname === "/__mock/preload" && request.method === "POST") {
    preload();
    return send(response, 200, { ok: true, ring: ring.length });
  }
  return serveStatic(pathname, response);
});

// ---------------------------------------------------------------- websocket

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  if (new URL(request.url ?? "/", "http://localhost").pathname !== "/stream") return socket.destroy();
  wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws));
});

wss.on("connection", (ws) => {
  let session = newSession();
  let utterance = null;
  let timers = [];

  const emit = (frame) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(frame));
  };
  const cancelTimers = () => {
    for (const timer of timers) clearTimeout(timer);
    timers = [];
  };
  const play = (frames, speed = 1) => {
    if (!REALTIME) return frames.forEach(({ frame }) => emit(frame));
    for (const { t, frame } of frames) timers.push(setTimeout(() => emit(frame), t / Math.max(speed, 0.1)));
  };
  const open = () => {
    cancelTimers();
    session = newSession();
    session.opening().forEach(emit);
  };
  const run = (scenario, records, speed) => {
    if (session.turns === 0 && records.length === scenario.records.length && recorded.has(scenario.fixture)) {
      const frames = recorded.get(scenario.fixture).map(({ t, frame }) => ({ t, frame: "threadId" in frame ? { ...frame, threadId: session.sessionId } : frame }));
      session.turns += records.length;
      remember(records.map((record, at) => ({ ...record, session_id: session.sessionId, started_at: now() + at })));
      return play(frames, speed);
    }
    const played = session.play(records, { startedAt: now() });
    remember(played.records);
    return play(played.frames, speed);
  };

  session.opening().forEach(emit);

  ws.on("message", (raw) => {
    let message;
    try {
      message = JSON.parse(String(raw));
    } catch {
      return emit({ type: "RUN_ERROR", message: "frame is not JSON", code: "bad_json" });
    }
    switch (message?.type) {
      case "session.new":
        return open();
      case "replay": {
        const scenario = findScenario(message.fixture);
        if (!scenario) return emit({ type: "RUN_ERROR", message: `unknown fixture ${message.fixture}`, code: "bad_request" });
        return run(scenario, scenario.records, message.speed ?? 1);
      }
      case "utterance.start":
        utterance = [];
        return undefined;
      case "utterance.chunk":
        utterance?.push(String(message.text ?? ""));
        return undefined;
      case "utterance.end": {
        const scenario = bestScenario((utterance ?? []).join(" "));
        utterance = null;
        return run(scenario, scenario.records.slice(0, 1), 1);
      }
      default:
        return emit({ type: "RUN_ERROR", message: "unknown client event", code: "bad_request" });
    }
  });
  ws.on("close", cancelTimers);
});

server.listen(PORT, HOST, () => {
  const where = existsSync(path.join(STATIC_DIR, "index.html")) ? `static ${path.relative(REPO, STATIC_DIR)}/` : "API only (no static export found; run npm run build)";
  console.log(`mock engine on http://${HOST}:${PORT}  ${scenarios.length} scenarios, ${recorded.size} recorded streams, ${where}${REALTIME ? ", realtime" : ""}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => process.exit(0)));
