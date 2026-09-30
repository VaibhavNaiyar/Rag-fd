import type { Provenance, SpanKind, SpanMarker, SpanNode } from "@/lib/trace/spans";

/**
 * Pure geometry for the Waterfall (P7-F04): turns a span tree into percentages a
 * component places, with no DOM and no browser API, so it is unit- and
 * property-tested without rendering anything. Every width lands in [0, 100] and
 * nothing here ever produces `NaN` — a zero-length or inverted domain degrades to
 * a flat 0 rather than dividing by zero.
 */

export interface Domain {
  startMs: number;
  endMs: number;
}

/** The full domain of a tree: 0 (turn start) to the turn's own end. */
export function domainOf(root: SpanNode): Domain {
  return { startMs: 0, endMs: root.endMs ?? 0 };
}

export function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/** Where `ms` falls in `domain`, as a percentage clamped into [0, 100]. A zero-or-negative-span domain is always 0%. */
export function toPct(ms: number, domain: Domain): number {
  const span = domain.endMs - domain.startMs;
  if (!Number.isFinite(span) || span <= 0) return 0;
  return clampPct(((ms - domain.startMs) / span) * 100);
}

export interface BarGeometry {
  xPct: number;
  widthPct: number;
}

/** A bar's left offset and width, both in [0, 100], width never negative even if the window is inverted. */
export function barGeometry(startMs: number, endMs: number, domain: Domain): BarGeometry {
  const x = toPct(startMs, domain);
  const end = toPct(endMs, domain);
  return { xPct: x, widthPct: Math.max(0, end - x) };
}

export interface WaterfallRow {
  id: string;
  label: string;
  kind: SpanKind;
  depth: number;
  colorVar: string;
  provenance: Provenance;
  cancelled: boolean;
  cancelReason: string | null;
  /** Null exactly when the span's own window is unavailable — the row still exists (a `details`-only row), it just has no bar. */
  geometry: BarGeometry | null;
  markers: { id: string; xPct: number; marker: SpanMarker }[];
}

/** The turn root's children, flattened depth-first into rows (the root itself is the domain, not a row). */
export function buildWaterfallRows(root: SpanNode, domain: Domain = domainOf(root)): WaterfallRow[] {
  const rows: WaterfallRow[] = [];
  const visit = (span: SpanNode, depth: number) => {
    if (span.kind !== "turn") {
      rows.push({
        id: span.id,
        label: span.label,
        kind: span.kind,
        depth,
        colorVar: span.colorVar,
        provenance: span.provenance,
        cancelled: span.cancelled,
        cancelReason: span.cancelReason,
        geometry: span.startMs !== null && span.endMs !== null ? barGeometry(span.startMs, span.endMs, domain) : null,
        markers: span.markers.map((marker) => ({ id: marker.id, xPct: toPct(marker.atMs, domain), marker })),
      });
    }
    for (const child of span.children) visit(child, span.kind === "turn" ? 0 : depth + 1);
  };
  visit(root, 0);
  return rows;
}

export interface StackedRow {
  id: string;
  label: string;
  kind: SpanKind;
  depth: number;
  colorVar: string;
  provenance: Provenance;
  cancelled: boolean;
  cancelReason: string | null;
  /** Proportional to the same domain as the waterfall, so the two views agree — just anchored at the left edge instead of its true offset. */
  widthPct: number | null;
  durationMs: number | null;
}

/** The same rows for the narrow (< 520px) stacked layout: each keeps its true width (proportional duration) but starts at the left edge, since there is no shared axis to align against in a single column. */
export function stackedRows(root: SpanNode, domain: Domain = domainOf(root)): StackedRow[] {
  const span = domain.endMs - domain.startMs;
  return buildWaterfallRows(root, domain).map((row) => ({
    id: row.id,
    label: row.label,
    kind: row.kind,
    depth: row.depth,
    colorVar: row.colorVar,
    provenance: row.provenance,
    cancelled: row.cancelled,
    cancelReason: row.cancelReason,
    widthPct: row.geometry?.widthPct ?? null,
    durationMs: row.geometry && Number.isFinite(span) && span > 0 ? (row.geometry.widthPct / 100) * span : null,
  }));
}

export interface AxisTick {
  ms: number;
  xPct: number;
  label: string;
}

/** "Nice numbers" axis stepping (Heckbert 1990): ticks land on 1/2/5 × 10^n, never on an arithmetically ugly step. */
function niceStep(roughStep: number, round: boolean): number {
  if (roughStep <= 0 || !Number.isFinite(roughStep)) return 1;
  const exponent = Math.floor(Math.log10(roughStep));
  const fraction = roughStep / 10 ** exponent;
  let niceFraction: number;
  if (round) niceFraction = fraction < 1.5 ? 1 : fraction < 3 ? 2 : fraction < 7 ? 5 : 10;
  else niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return niceFraction * 10 ** exponent;
}

function formatTick(ms: number): string {
  if (Math.abs(ms) < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)}s`;
}

/** Axis ticks across `domain`, roughly `targetCount` of them, each with its `xPct` and a formatted label. */
export function axisTicks(domain: Domain, targetCount = 6): AxisTick[] {
  const span = domain.endMs - domain.startMs;
  if (!Number.isFinite(span) || span <= 0) return [{ ms: domain.startMs, xPct: 0, label: formatTick(domain.startMs) }];

  const step = niceStep(niceStep(span, false) / Math.max(1, targetCount - 1), true);
  if (step <= 0) return [{ ms: domain.startMs, xPct: 0, label: formatTick(domain.startMs) }];

  const niceMin = Math.floor(domain.startMs / step) * step;
  const niceMax = Math.ceil(domain.endMs / step) * step;
  const ticks: AxisTick[] = [];
  const guard = Math.ceil((niceMax - niceMin) / step) + 2;
  for (let i = 0, ms = niceMin; i < guard && ms <= niceMax + step / 2; i += 1, ms += step) {
    if (ms < domain.startMs - step * 1e-6 || ms > domain.endMs + step * 1e-6) continue;
    ticks.push({ ms: Math.round(ms * 1000) / 1000, xPct: toPct(ms, domain), label: formatTick(ms) });
  }
  return ticks;
}

export interface UtteranceEndRule {
  ms: number;
  xPct: number;
}

/** Where the utterance actually ended, as a vertical rule across every lane. Null while it has not ended yet. */
export function utteranceEndRule(utteranceEndMs: number | null, domain: Domain): UtteranceEndRule | null {
  return utteranceEndMs === null ? null : { ms: utteranceEndMs, xPct: toPct(utteranceEndMs, domain) };
}

export interface LeadVector {
  /** The utterance-end x. */
  fromXPct: number;
  /** The first-retrieval x. */
  toXPct: number;
  /** `utteranceEndMs - firstRetrievalMs`: positive means the search fired before the user stopped speaking (the G2 win). */
  leadMs: number;
  direction: "before" | "after";
}

/** The geometry of the retrieval lead: the gap between the utterance ending and the first search firing. */
export function leadVector(utteranceEndMs: number | null, firstRetrievalMs: number | null, domain: Domain): LeadVector | null {
  if (utteranceEndMs === null || firstRetrievalMs === null) return null;
  const leadMs = utteranceEndMs - firstRetrievalMs;
  return { fromXPct: toPct(utteranceEndMs, domain), toXPct: toPct(firstRetrievalMs, domain), leadMs, direction: leadMs > 0 ? "before" : "after" };
}

export interface ZoomWindow {
  startMs: number;
  endMs: number;
}

const MIN_ZOOM_SPAN_MS = 50;

/** Clamps a zoom window into `full`: never wider than the full domain, never narrower than 50ms (unless the domain itself is), never past either edge. */
export function clampZoom(zoom: ZoomWindow, full: Domain): ZoomWindow {
  const fullSpan = Math.max(0, full.endMs - full.startMs);
  const requested = Math.max(0, zoom.endMs - zoom.startMs);
  const span = Math.min(fullSpan, Math.max(MIN_ZOOM_SPAN_MS, requested));
  const start = Math.min(Math.max(full.startMs, zoom.startMs), full.endMs - span);
  return { startMs: start, endMs: start + span };
}
