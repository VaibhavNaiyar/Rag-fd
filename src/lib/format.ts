/** Display formatters. Every number a judge reads is rendered through here. */

/** `1,284` — thousands separated, locale-stable so SSR and client agree. */
export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

/** `840ms` under a second, `2.14s` above it. */
export function formatMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  if (Math.abs(ms) < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/** Signed lead time, e.g. `1,300ms` — always the magnitude, sign is implied by the label. */
export function formatLead(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  return `${formatCount(Math.round(Math.abs(ms)))}ms`;
}

/** Sub-cent costs need four decimals to be meaningful at all. */
export function formatUsd(usd: number | null | undefined): string {
  if (usd === null || usd === undefined) return "—";
  if (usd === 0) return "$0.0000";
  if (usd < 0.0001) return "<$0.0001";
  return `$${usd.toFixed(4)}`;
}

/** `92%` — rates arrive as 0–1 from the grounding verifier. */
export function formatRate(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) return "—";
  return `${Math.round(rate * 100)}%`;
}

/** Retrieval scores are compared, not read precisely — two decimals is plenty. */
export function formatScore(score: number): string {
  return score.toFixed(2);
}

const RELATIVE_UNITS: [limitMs: number, divisorMs: number, unit: string][] = [
  [60_000, 1_000, "s"],
  [3_600_000, 60_000, "m"],
  [86_400_000, 3_600_000, "h"],
];

/** `12s ago`, `4m ago`, `2d ago`. Coarse on purpose — a session is minutes long. */
export function formatRelative(epochMs: number, now: number = Date.now()): string {
  const delta = Math.max(0, now - epochMs);
  if (delta < 5_000) return "just now";
  for (const [limit, divisor, unit] of RELATIVE_UNITS) {
    if (delta < limit) return `${Math.floor(delta / divisor)}${unit} ago`;
  }
  return `${Math.floor(delta / 86_400_000)}d ago`;
}

/** Evidence snippets are capped for display; the full text stays server-side. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

/** Derive a session title from its first utterance. */
export function titleFromText(text: string, max = 44): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (!flat) return "New session";
  return truncate(flat, max);
}
