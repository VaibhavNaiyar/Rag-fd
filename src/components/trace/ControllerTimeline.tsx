"use client";

import { useId, useMemo, useState } from "react";
import { EmptyHint } from "@/components/ui/EmptyHint";
import { useElementWidth } from "@/hooks/useElementWidth";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { DECISION_VISUALS, reasonLabel, TRIGGER_LABELS } from "@/lib/decisions";
import { formatCount, formatLead, formatMs, formatUsd } from "@/lib/format";
import { retrievalLeadMs } from "@/store/selectors";
import type { Turn } from "@/store/types";

/**
 * The gate-2 visual.
 *
 * A horizontal track from the start of the utterance to its end, with the
 * controller's decisions and every retrieval plotted on it. The single thing a
 * judge must be able to read off this component, in a compressed 1080p frame,
 * is that a retrieval marker sits to the LEFT of the utterance-end rule — and
 * by how much, stated as a number rather than as a bar to be measured.
 *
 * Below `COMPACT_BREAKPOINT` the track sheds its axis chrome (the "0ms" origin
 * label, the long-form "utterance end …" caption) so the plot itself keeps its
 * full width on a phone rather than fighting text for room; the same numbers
 * are still one tap away in the tooltip.
 */

const COMPACT_BREAKPOINT = "(max-width: 420px)";

const HEIGHT = 104;
const TRACK_Y = 52;
const PAD_X = 10;
const END_RULE_TOP = 30;
const END_RULE_BOTTOM = 68;

interface Plot {
  x: (atMs: number) => number;
  domainEnd: number;
}

function usePlot(turn: Turn, width: number): Plot {
  return useMemo(() => {
    const events = [
      ...turn.transcript.map((chunk) => chunk.atMs),
      ...turn.decisions.map((decision) => decision.atMs),
      ...turn.retrievals.map((record) => record.atMs),
      turn.utteranceEndMs ?? 0,
    ];
    // While the utterance is still open the domain grows with it; once it closes
    // it is pinned, so markers stop sliding around mid-session.
    const domainEnd = Math.max(600, ...events) * (turn.utteranceEndMs === null ? 1.15 : 1.06);
    const usable = Math.max(1, width - PAD_X * 2);

    return {
      domainEnd,
      x: (atMs: number) => PAD_X + (Math.max(0, Math.min(atMs, domainEnd)) / domainEnd) * usable,
    };
  }, [turn.decisions, turn.retrievals, turn.transcript, turn.utteranceEndMs, width]);
}

interface TooltipState {
  x: number;
  title: string;
  detail?: string;
}

/** A small, non-obscuring readout pinned above the point that triggered it. */
function Tooltip({ tooltip, width }: { tooltip: TooltipState; width: number }) {
  const clampedX = Math.min(Math.max(tooltip.x, 4), width - 4);
  const align = tooltip.x < 44 ? "left" : tooltip.x > width - 44 ? "right" : "center";
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md border border-line bg-raised px-2 py-1 text-caption shadow-lift animate-rise-in"
      style={{
        left: clampedX,
        top: END_RULE_TOP - 16,
        transform: `translate(${align === "center" ? "-50%" : align === "left" ? "0" : "-100%"}, -100%)`,
      }}
    >
      <div className="font-mono font-semibold tabular text-ink">{tooltip.title}</div>
      {tooltip.detail && <div className="text-ink-muted">{tooltip.detail}</div>}
    </div>
  );
}

/**
 * Shared hover + tap handlers so mouse and touch both surface the same
 * tooltip. Plain helper, not a hook — deliberately not named `use*` so
 * `eslint-plugin-react-hooks` doesn't flag its call sites inside `.map()`
 * and conditionals as rules-of-hooks violations.
 */
function pointHandlers(setTooltip: (t: TooltipState | null) => void, point: TooltipState) {
  return {
    onMouseEnter: () => setTooltip(point),
    onMouseLeave: () => setTooltip(null),
    onFocus: () => setTooltip(point),
    onBlur: () => setTooltip(null),
    onClick: () => setTooltip(point),
  };
}

function RetrievalMarker({
  x,
  cancelled,
  index,
  label,
  handlers,
}: {
  x: number;
  cancelled: boolean;
  index: number;
  label: string;
  handlers: ReturnType<typeof pointHandlers>;
}) {
  return (
    <g
      className="animate-marker-in"
      style={{ transformBox: "fill-box", transformOrigin: "center", animationDelay: `${index * 40}ms` }}
    >
      {!cancelled && (
        <circle
          cx={x}
          cy={TRACK_Y}
          r={5}
          fill="var(--state-retrieve)"
          className="animate-pulse-ring"
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        />
      )}
      <circle
        cx={x}
        cy={TRACK_Y}
        r={5}
        fill={cancelled ? "var(--canvas)" : "var(--state-retrieve)"}
        stroke="var(--state-retrieve)"
        strokeWidth={2}
        strokeDasharray={cancelled ? "2 2" : undefined}
      />
      {cancelled && (
        <line
          x1={x - 6}
          y1={TRACK_Y + 6}
          x2={x + 6}
          y2={TRACK_Y - 6}
          stroke="var(--ink-muted)"
          strokeWidth={1.5}
        />
      )}
      {/* Larger, invisible hit target — a 5px marker is too small to hover/tap reliably. */}
      <circle
        cx={x}
        cy={TRACK_Y}
        r={12}
        fill="transparent"
        tabIndex={0}
        role="button"
        aria-label={label}
        className="cursor-pointer outline-none"
        {...handlers}
      />
    </g>
  );
}

export function ControllerTimeline({ turn }: { turn: Turn }) {
  const uid = useId();
  const { ref, width } = useElementWidth<HTMLDivElement>(340);
  const plot = usePlot(turn, width);
  const compact = useMediaQuery(COMPACT_BREAKPOINT);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const lead = retrievalLeadMs(turn);
  const endX = turn.utteranceEndMs === null ? null : plot.x(turn.utteranceEndMs);
  const firstX = turn.firstRetrievalMs === null ? null : plot.x(turn.firstRetrievalMs);
  const suppressDecision = turn.decisions.find((decision) => decision.decision === "suppress");
  const gradientId = `lead-gradient-${uid}`;
  const arrowId = `lead-arrow-${uid}`;

  return (
    <div ref={ref} className="relative w-full">
      <svg
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        role="group"
        aria-label={
          lead === null
            ? "Controller timeline for the current turn"
            : `Retrieval began ${formatLead(lead)} before the utterance ended`
        }
        className="block overflow-visible"
      >
        <defs>
          {/* The G2 lead vector: Samsung Blue deepening from its navy stop to the
              brand blue, with an arrowhead so it reads as a directional lead —
              not just a bar to be measured with a ruler. */}
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--sam-blue)" />
            <stop offset="100%" stopColor="var(--ui-primary)" />
          </linearGradient>
          <marker id={arrowId} viewBox="0 0 8 8" refX="6.5" refY="4" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="var(--ui-primary)" />
          </marker>
        </defs>

        {/* The track: the utterance, from first word to last. */}
        <line
          x1={PAD_X}
          y1={TRACK_Y}
          x2={width - PAD_X}
          y2={TRACK_Y}
          stroke="var(--border-strong)"
          strokeWidth={2}
          strokeLinecap="round"
        />

        {/* Transcript ticks — the shape of the incoming stream. Each is a small
            hoverable point so a judge can read the exact chunk arrival time. */}
        {turn.transcript.map((chunk, index) => {
          const x = plot.x(chunk.atMs);
          const handlers = pointHandlers(setTooltip, {
            x,
            title: `chunk ${index + 1} · ${formatMs(chunk.atMs)}`,
            detail: chunk.text.length > 42 ? `${chunk.text.slice(0, 42)}…` : chunk.text,
          });
          return (
            <g key={`t-${index}`}>
              <line
                x1={x}
                y1={TRACK_Y - 4}
                x2={x}
                y2={TRACK_Y + 4}
                stroke="var(--state-wait)"
                strokeWidth={1}
                opacity={0.5}
              />
              <rect
                x={x - 5}
                y={TRACK_Y - 10}
                width={10}
                height={20}
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={`Transcript chunk ${index + 1} at ${formatMs(chunk.atMs)}`}
                className="cursor-pointer outline-none"
                {...handlers}
              />
            </g>
          );
        })}

        {/* The lead span: the number a judge should not have to measure. */}
        {lead !== null && lead > 0 && firstX !== null && endX !== null && (
          <g className="animate-marker-in">
            <line
              x1={firstX}
              y1={END_RULE_TOP - 6}
              x2={endX - 6}
              y2={END_RULE_TOP - 6}
              stroke={`url(#${gradientId})`}
              strokeWidth={2.5}
              strokeLinecap="round"
              markerEnd={`url(#${arrowId})`}
            />
            <line x1={firstX} y1={END_RULE_TOP - 11} x2={firstX} y2={END_RULE_TOP - 1} stroke="var(--ui-primary)" strokeWidth={1.5} />
            {!compact && (
              <text
                x={(firstX + endX) / 2}
                y={END_RULE_TOP - 14}
                textAnchor="middle"
                className="fill-[var(--ui-primary-ink)] font-mono text-[11px] font-semibold"
              >
                {formatLead(lead)} early
              </text>
            )}
          </g>
        )}

        {/* Suppressed turns get one grey marker where the decision landed. */}
        {suppressDecision && turn.retrievals.length === 0 && (
          <g className="animate-marker-in">
            <circle
              cx={plot.x(suppressDecision.atMs)}
              cy={TRACK_Y}
              r={5}
              fill="var(--canvas)"
              stroke="var(--state-suppress)"
              strokeWidth={2}
            />
            <line
              x1={plot.x(suppressDecision.atMs) - 6}
              y1={TRACK_Y + 6}
              x2={plot.x(suppressDecision.atMs) + 6}
              y2={TRACK_Y - 6}
              stroke="var(--state-suppress)"
              strokeWidth={1.5}
            />
          </g>
        )}

        {turn.retrievals.map((record, index) => {
          const x = plot.x(record.atMs);
          const title = `${record.cancelledReason ? "cancelled" : TRIGGER_LABELS[record.trigger]} search · ${formatMs(record.atMs)}`;
          return (
            <RetrievalMarker
              key={`${record.subQueryId}-${record.atMs}`}
              x={x}
              cancelled={record.cancelledReason !== undefined}
              index={index}
              label={title}
              handlers={pointHandlers(setTooltip, {
                x,
                title,
                detail: record.cancelledReason ? reasonLabel(record.cancelledReason) : `"${record.query}"`,
              })}
            />
          );
        })}

        {/* The utterance-end rule, always visible once it lands. */}
        {endX !== null && (
          <g className="animate-marker-in">
            <line
              x1={endX}
              y1={END_RULE_TOP}
              x2={endX}
              y2={END_RULE_BOTTOM}
              stroke="var(--ink)"
              strokeWidth={2}
            />
            {!compact && (
              <text
                x={Math.min(endX + 6, width - 4)}
                y={END_RULE_BOTTOM + 12}
                textAnchor={endX > width - 90 ? "end" : "start"}
                className="fill-[var(--ink-muted)] font-mono text-[10px]"
              >
                utterance end {formatMs(turn.utteranceEndMs ?? 0)}
              </text>
            )}
            <rect
              x={endX - 8}
              y={END_RULE_TOP - 4}
              width={16}
              height={END_RULE_BOTTOM - END_RULE_TOP + 8}
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-label={`Utterance end at ${formatMs(turn.utteranceEndMs ?? 0)}`}
              className="cursor-pointer outline-none"
              {...pointHandlers(setTooltip, {
                x: endX,
                title: `utterance end · ${formatMs(turn.utteranceEndMs ?? 0)}`,
                detail: turn.latencyMs
                  ? `first token ${formatMs(turn.latencyMs.firstToken)} later${
                      turn.cost ? ` · ${formatCount(turn.cost.turnTokens)} tok · ${formatUsd(turn.cost.turnUsd)}` : ""
                    }`
                  : undefined,
              })}
            />
          </g>
        )}

        {!compact && (
          <text x={PAD_X} y={TRACK_Y + 20} className="fill-[var(--ink-muted)] font-mono text-[10px]">
            0ms
          </text>
        )}
      </svg>

      {tooltip && <Tooltip tooltip={tooltip} width={width} />}

      <Legend turn={turn} lead={lead} />
      <DecisionLog turn={turn} />
    </div>
  );
}

/**
 * A small, persistent key to the plot's marker vocabulary.
 *
 * The tooltips carry the exact numbers, but a reader shouldn't need to hover
 * every point just to learn what a filled dot versus a dashed ring means —
 * that's exactly the gap between a chart you can screenshot and one you can
 * actually read. Only shows swatches for marks the plot actually used.
 */
function Legend({ turn, lead }: { turn: Turn; lead: number | null }) {
  const hasRetrieval = turn.retrievals.some((r) => r.cancelledReason === undefined);
  const hasCancelled = turn.retrievals.some((r) => r.cancelledReason !== undefined);
  const hasEnd = turn.utteranceEndMs !== null;
  const hasLead = lead !== null && lead > 0;
  if (!hasRetrieval && !hasCancelled && !hasEnd && !hasLead) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-2 text-caption text-ink-muted">
      {hasLead && (
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 shrink-0 rounded-full" style={{ background: "var(--ai-glow)" }} />
          lead time
        </span>
      )}
      {hasRetrieval && (
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--state-retrieve)" }} />
          retrieval
        </span>
      )}
      {hasCancelled && (
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-full border-[1.5px] border-dashed"
            style={{ borderColor: "var(--state-retrieve)" }}
          />
          cancelled
        </span>
      )}
      {hasEnd && (
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-0.5 shrink-0" style={{ background: "var(--ink)" }} />
          utterance end
        </span>
      )}
    </div>
  );
}

/**
 * The decision log under the track.
 *
 * At rail width there is no room for readable labels beside each marker, so the
 * sequence is spelled out here in words — which is also what keeps the component
 * legible in grayscale and to a screen reader.
 */
function DecisionLog({ turn }: { turn: Turn }) {
  if (turn.decisions.length === 0) {
    return <EmptyHint>No controller decision yet for this turn.</EmptyHint>;
  }

  const triggerFor = (atMs: number) =>
    turn.retrievals.find((record) => Math.abs(record.atMs - atMs) < 120);

  return (
    <ol className="mt-1 space-y-1">
      {turn.decisions.map((decision, index) => {
        const visual = DECISION_VISUALS[decision.decision];
        const trigger = decision.decision === "retrieve" ? triggerFor(decision.atMs) : undefined;

        return (
          <li
            key={`${decision.atMs}-${index}`}
            className="flex animate-rise-in items-baseline gap-2 text-caption"
          >
            <span className="w-11 shrink-0 text-right font-mono tabular text-ink-muted">
              {formatMs(decision.atMs)}
            </span>
            <span
              aria-hidden
              className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: visual.colorVar }}
            />
            <span className="min-w-0 break-words">
              <span className="font-medium text-ink-body">{visual.label}</span>
              <span className="text-ink-muted"> · {reasonLabel(decision.reason)}</span>
              {trigger && (
                <span className="text-ink-muted"> ({TRIGGER_LABELS[trigger.trigger]})</span>
              )}
              {decision.confidence !== undefined && (
                <span className="ml-1 font-mono tabular text-ink-muted">
                  {decision.confidence.toFixed(2)}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
