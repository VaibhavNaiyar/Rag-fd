import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseTraceRecord, type TraceRecord } from "@/types/trace";

/**
 * Loads the P2 trace fixtures (`e2e/fixtures/traces/*.json`) for unit tests.
 * Node-only (reads the filesystem) — used from `src/**\/*.test.ts`, never from a
 * `.dom.test.tsx` file, and never bundled into the app.
 */

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "e2e", "fixtures", "traces");

export interface TraceFixtureFile {
  file: string;
  fixture: string;
  family: string;
  corpus: string;
  description: string;
  expect: { mode: string };
  records: TraceRecord[];
}

let cache: TraceFixtureFile[] | null = null;

/** Every scenario file, each record already parsed and validated. Throws if a fixture fails to parse — a broken fixture is a test-suite bug, not a runtime case. */
export function loadTraceFixtures(): TraceFixtureFile[] {
  if (cache) return cache;
  const files = readdirSync(FIXTURES_DIR).filter((name) => name.endsWith(".json"));
  cache = files.map((file) => {
    const raw = JSON.parse(readFileSync(join(FIXTURES_DIR, file), "utf-8")) as {
      fixture: string;
      family: string;
      corpus: string;
      description: string;
      expect: { mode: string };
      records: unknown[];
    };
    const records = raw.records.map((entry, index) => {
      const parsed = parseTraceRecord(entry);
      if (!parsed.ok) {
        throw new Error(`${file}[${index}] failed to parse: ${parsed.kind === "invalid" ? parsed.issues.join("; ") : `unsupported version ${String(parsed.version)}`}`);
      }
      return parsed.record;
    });
    return { file, fixture: raw.fixture, family: raw.family, corpus: raw.corpus, description: raw.description, expect: raw.expect, records };
  });
  return cache;
}

/** Every parsed record across every fixture file, flattened. */
export function allTraceRecords(): TraceRecord[] {
  return loadTraceFixtures().flatMap((f) => f.records);
}

/**
 * One record by session and turn id. `turn_id` alone is not unique — every
 * scenario's first turn is `t1` (`Rag-bd/src/slr/telemetry/trace.py`: "`turn_id`
 * repeats across sessions, so lookups must pass `session_id`") — so this takes
 * both, the same as the engine's own `/trace/{turn_id}?session_id=`.
 */
export function traceRecord(sessionId: string, turnId: string): TraceRecord {
  const found = allTraceRecords().find((record) => record.session_id === sessionId && record.turn_id === turnId);
  if (!found) throw new Error(`no fixture record for session "${sessionId}" turn "${turnId}"`);
  return found;
}

/** One fixture file's record by turn id, when the scenario (not the session id) is what a test wants to name. */
export function fixtureRecord(fixture: string, turnId: string): TraceRecord {
  const file = loadTraceFixtures().find((f) => f.fixture === fixture);
  const found = file?.records.find((record) => record.turn_id === turnId);
  if (!found) throw new Error(`no record turn_id="${turnId}" in fixture "${fixture}"`);
  return found;
}
