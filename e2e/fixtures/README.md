# e2e fixtures

Real per-turn trace records, used by the unit tests, the mock engine and the
Playwright suite. Nothing in here is invented: every record is copied unmodified
from the engine's own benchmark output.

## Provenance

| | |
|---|---|
| Source | `Rag-bd/evals/results/turns.jsonl` (one JSON object per turn: `{corpus, fixture, family, expect, trace}`) |
| What is copied | the `trace` object, byte for byte, plus the `fixture`, `family`, `corpus` and `expect` fields as scenario metadata |
| How it was copied | read-only extraction; `Rag-bd` was not touched. Each file's `source.lines` gives the 1-based line numbers in the source |
| Trace contract | `trace_version: 1`, the 27 required fields of `Rag-bd/src/slr/telemetry/trace.py`, plus the optional `events`, `speculation`, `refinement` |
| Size | 6 files, 10 records, about 110 KB in total |

Do not edit a record. To refresh a scenario, run the benchmark in `Rag-bd`, then
copy the new line(s) the same way and update `source.lines`.

## Scenarios

| File | Family | Corpus | Turns (mode) | Exercises |
|---|---|---|---|---|
| `compound_01.json` | compound | enterprise | 1 (retrieve) | multi-intent request, provisional searches before the utterance ends, one cancelled search, decomposition into two sub-queries, 10 claims, 2 uncertainty notes, speculation dropped |
| `late_detail_01.json` | late_detail | enterprise | 2 (retrieve, refine) | a late detail refines the answer: version 2, parent 1, four claims preserved, `refinement` present |
| `presentation_03.json` | suppression | enterprise | 2 (retrieve, suppress) | a presentation-only turn: retrieval is suppressed (`presentation_restructure`), no searches |
| `unanswerable_01.json` | unanswerable | enterprise | 1 (retrieve) | the corpus cannot answer: zero claims, two uncertainty notes, two clarification readings |
| `late_detail_02.json` | late_detail | enterprise | 2 (retrieve, refine) | clarify first (zero claims, readings offered), then a refine that resolves it |
| `asqa_late_detail_01.json` | late_detail | asqa | 2 (retrieve, refine) | a trace that carries an engine error entry (`provisional t1_p1: CancelledError`) |

## What the records do not contain

- **No `degraded` case.** No stored record has a `degraded` array. The record with
  `errors` stands in for the error state; a degraded-step fixture will be added when
  the engine produces one.
- **Only the last answer version.** A record keeps the final `answer` and the
  `refinement` counts, not earlier bodies (see PHASES.md section 1.4).
- **No chunk text and no per-token timing.** The mock engine therefore labels the
  evidence text it invents as a placeholder; see `e2e/mock-engine/synthesize.mjs`.

## Data notes

- `enterprise` is the engine's **synthetic development corpus**: every company,
  venue, vendor and person in it is fictional (`Rag-bd/evals/corpora/enterprise/NOTICE`).
- `asqa_late_detail_01.json` comes from the ASQA question set (a public research
  dataset built on Wikipedia). It holds the question, the model's answer and short
  attributions, not passage text. Review that file before publishing the repository.
- The records contain corpus-derived text (utterances, answer bodies, attributions).
  Committing them is your decision (PHASES.md P0-S3, D5).
