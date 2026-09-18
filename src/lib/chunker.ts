import { TYPED_CHUNK_WORDS, TYPED_STREAM_WPM } from "@/lib/constants";

/**
 * Client-side transcript chunker.
 *
 * Typed input is never sent as one blob. It is broken into 3–5 word groups and
 * released at speaking pace, so the engine's streaming path — controller,
 * provisional retrieval, decomposition — runs identically whether the input was
 * typed, replayed or spoken. Without this, a live demo silently bypasses the
 * controller and G2 becomes unobservable.
 */

export interface TimedChunk {
  text: string;
  /** Delay from the previous chunk, in ms. */
  delayMs: number;
}

/** Deterministic 3–5 word grouping: no randomness, so runs are reproducible. */
export function chunkUtterance(text: string, wpm: number = TYPED_STREAM_WPM): TimedChunk[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const msPerWord = 60_000 / wpm;
  const { min, max } = TYPED_CHUNK_WORDS;
  const span = max - min + 1;

  const chunks: TimedChunk[] = [];
  let index = 0;
  let group = 0;

  while (index < words.length) {
    // Cycle through the allowed group sizes rather than picking randomly.
    const size = min + (group % span);
    const slice = words.slice(index, index + size);
    chunks.push({
      text: slice.join(" "),
      delayMs: Math.round(slice.length * msPerWord),
    });
    index += size;
    group += 1;
  }

  return chunks;
}

export interface UtteranceStreamOptions {
  text: string;
  /** 1 = speaking pace. Higher is faster; the demo bar drives this. */
  speed?: number;
  onChunk: (chunk: TimedChunk, index: number) => void;
  onEnd: () => void;
}

export interface UtteranceStreamHandle {
  /** Stop mid-utterance without firing onEnd. */
  cancel: () => void;
}

/** Release `text` as timed chunks. Returns a handle so the Stop key can cancel. */
export function streamUtterance({
  text,
  speed = 1,
  onChunk,
  onEnd,
}: UtteranceStreamOptions): UtteranceStreamHandle {
  const chunks = chunkUtterance(text);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;
  let cursor = 0;

  const step = () => {
    if (cancelled) return;
    if (cursor >= chunks.length) {
      onEnd();
      return;
    }
    const chunk = chunks[cursor];
    if (!chunk) {
      onEnd();
      return;
    }
    timer = setTimeout(() => {
      if (cancelled) return;
      onChunk(chunk, cursor);
      cursor += 1;
      step();
    }, chunk.delayMs / speed);
  };

  step();

  return {
    cancel: () => {
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
    },
  };
}
