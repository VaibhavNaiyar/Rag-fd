/** Types for synthesize.mjs, so TypeScript tests can import it. */

export interface TraceRecordLike {
  session_id: string;
  turn_id: string;
  started_at: number;
  [key: string]: unknown;
}

export interface EngineEvent {
  type: string;
  [key: string]: unknown;
}

export interface TimedFrame {
  t: number;
  frame: { type: string; [key: string]: unknown };
}

export function engineEvents(record: TraceRecordLike): { t: number; event: EngineEvent }[];
export function renumber<T>(value: T, mapping: Map<string, string>): T;

export class MockSession {
  constructor(options: { sessionId: string; corpus: { docs: number; chunks: number } });
  sessionId: string;
  turns: number;
  opening(): TimedFrame["frame"][];
  play(records: TraceRecordLike[], options: { startedAt: number }): { frames: TimedFrame[]; records: TraceRecordLike[] };
}

export function framesForScenario(
  records: TraceRecordLike[],
  options?: { sessionId?: string; corpus?: { docs: number; chunks: number }; startedAt?: number },
): { frames: TimedFrame[]; records: TraceRecordLike[] };
