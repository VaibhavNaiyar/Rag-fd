#!/usr/bin/env node
/**
 * record-stream — records one fixture's AG-UI stream from a RUNNING engine.
 *
 *   node scripts/record-stream.mjs --fixture compound_01
 *   node scripts/record-stream.mjs --fixture late_detail_01 --url ws://localhost:8000/stream --speed 8
 *
 * It opens the engine's /stream socket, asks it to replay the fixture (the same
 * `replay` message the console sends), and writes what comes back:
 *
 *   e2e/fixtures/streams/<fixture>.ndjson       one {"t": ms, "frame": {…}} per line, the frames as received
 *   e2e/fixtures/streams/<fixture>.trace.json   {session_id, records: […]} from GET /trace for that session
 *
 * The mock engine (e2e/mock-engine/server.mjs) replays a recorded stream in place of
 * the synthesised one. Start the engine first; this script does not start it.
 *
 * Options
 *   --fixture <id>    required; an id from GET /fixtures
 *   --url <ws-url>    the engine's stream, default ws://localhost:8000/stream
 *   --speed <n>       replay speed sent to the engine, default 8 (1 is real time)
 *   --out <dir>       output directory, default e2e/fixtures/streams
 *   --timeout <s>     give up after this many seconds, default 180
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import WebSocket from "ws";

const argv = process.argv.slice(2);
const option = (name, fallback) => {
  const at = argv.indexOf(name);
  return at >= 0 && argv[at + 1] ? argv[at + 1] : fallback;
};

const fixture = option("--fixture");
if (!fixture) {
  console.error("record-stream: --fixture <id> is required (see GET /fixtures)");
  process.exit(2);
}
const streamUrl = option("--url", "ws://localhost:8000/stream");
const speed = Number(option("--speed", "8"));
const outDir = path.resolve(option("--out", "e2e/fixtures/streams"));
const timeoutMs = Number(option("--timeout", "180")) * 1000;

const httpBase = new URL(streamUrl);
httpBase.protocol = httpBase.protocol === "wss:" ? "https:" : "http:";
httpBase.pathname = "/";
const api = (route) => new URL(route, httpBase).toString();

async function json(route) {
  const response = await fetch(api(route));
  if (!response.ok) throw new Error(`${route} answered ${response.status}`);
  return response.json();
}

let listing;
try {
  listing = await json("/fixtures");
} catch (error) {
  console.error(`record-stream: cannot reach the engine at ${httpBase.origin}: ${error.cause?.message ?? error.message}`);
  process.exit(1);
}
const { fixtures } = listing;
const wanted = fixtures.find((item) => item.id === fixture);
if (!wanted) {
  console.error(`record-stream: no fixture "${fixture}". The engine lists: ${fixtures.map((item) => item.id).join(", ")}`);
  process.exit(2);
}
const expectedRuns = wanted.turns.length;

const frames = [];
let sessionId = null;
let openingDone = false;
let started = 0;
let finishedRuns = 0;

const socket = new WebSocket(streamUrl);
const giveUp = setTimeout(() => {
  console.error(`record-stream: timed out after ${timeoutMs / 1000}s with ${finishedRuns} of ${expectedRuns} turns finished`);
  process.exit(1);
}, timeoutMs);

socket.on("error", (error) => {
  console.error(`record-stream: cannot reach ${streamUrl}: ${error.message}`);
  process.exit(1);
});

socket.on("message", async (raw) => {
  const frame = JSON.parse(String(raw));
  if (!openingDone) {
    // The engine opens a session with a short run of its own; that is not part of the recording.
    if (frame.type === "STATE_SNAPSHOT") sessionId = frame.snapshot?.session?.id ?? sessionId;
    if (frame.type === "RUN_FINISHED") {
      openingDone = true;
      started = Date.now();
      socket.send(JSON.stringify({ type: "replay", fixture, speed }));
    }
    return;
  }
  frames.push({ t: Date.now() - started, frame });
  if (frame.type === "RUN_ERROR") finish(`the engine reported ${frame.code}: ${frame.message}`);
  if (frame.type === "RUN_FINISHED" && !String(frame.runId).endsWith(":open")) {
    finishedRuns += 1;
    if (finishedRuns >= expectedRuns) finish();
  }
});

let finishing = false;
async function finish(problem) {
  if (finishing) return;
  finishing = true;
  clearTimeout(giveUp);
  socket.close();
  mkdirSync(outDir, { recursive: true });
  const base = path.join(outDir, fixture);
  writeFileSync(`${base}.ndjson`, `${frames.map((entry) => JSON.stringify(entry)).join("\n")}\n`);
  let records = [];
  try {
    records = (await json(`/trace?limit=200&session_id=${encodeURIComponent(sessionId ?? "")}`)).traces ?? [];
  } catch (error) {
    console.error(`record-stream: could not read /trace (${error.message}); the trace file will be empty`);
  }
  writeFileSync(`${base}.trace.json`, `${JSON.stringify({ session_id: sessionId, fixture, records }, null, 2)}\n`);
  console.log(`record-stream: ${fixture}: ${frames.length} frames, ${records.length} trace record(s) -> ${path.relative(process.cwd(), base)}.{ndjson,trace.json}`);
  if (problem) {
    console.error(`record-stream: recorded up to a problem: ${problem}`);
    process.exit(1);
  }
  process.exit(0);
}
