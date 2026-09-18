"use client";

import { useMemo } from "react";
import { EmptyHint } from "@/components/ui/EmptyHint";
import { useElementWidth } from "@/hooks/useElementWidth";
import { DECISION_VISUALS, reasonLabel, TRIGGER_LABELS } from "@/lib/decisions";
import { formatLead, formatMs } from "@/lib/format";
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
 */

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
    // it is pinned, so markers stop sliding around mid-demo.
    const domainEnd = Math.max(600, ...events) * (turn.utteranceEndMs === null ? 1.15 : 1.06);
    const usable = Math.max(1, width - PAD_X * 2);

    return {
      domainEnd,
      x: (atMs: number) => PAD_X + (Math.max(0, Math.min(atMs, domainEnd)) / domainEnd) * usable,
    };
  }, [turn.decisions, turn.retrievals, turn.transcript, turn.utteranceEndMs, width]);
}

function RetrievalMarker({
  x,
  cancelled,
  index,
}: {
  x: number;
  cancelled: boolean;
  index: number;
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
    </g>
  );
}

export function ControllerTimeline({ turn }: { turn: Turn }) {
  const { ref, width } = useElementWidth<HTMLDivElement>(340);
  const plot = usePlot(turn, width);

  const lead = retrievalLeadMs(turn);
  const endX = turn.utteranceEndMs === null ? null : plot.x(turn.utteranceEndMs);
  const firstX = turn.firstRetrievalMs === null ? null : plot.x(turn.firstRetrievalMs);
  const suppressDecision = turn.decisions.find((decision) => decision.decision === "suppress");

  return (
    <div ref={ref} className="w-full">
      <svg
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        role="img"
        aria-label={
          lead === null
            ? "Controller timeline for the current turn"
            : `Retrieval began ${formatLead(lead)} before the utterance ended`
        }
        className="block overflow-visible"
      >
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

        {/* Transcript ticks — the shape of the incoming stream. */}
        {turn.transcript.map((chunk, index) => (
          <line
            key={`t-${index}`}
            x1={plot.x(chunk.atMs)}
            y1={TRACK_Y - 4}
            x2={plot.x(chunk.atMs)}
            y2={TRACK_Y + 4}
            stroke="var(--state-wait)"
            strokeWidth={1}
            opacity={0.5}
          />
        ))}

        {/* The lead span: the number a judge should not have to measure. */}
        {lead !== null && lead > 0 && firstX !== null && endX !== null && (
          <g className="animate-marker-in">
            <line
              x1={firstX}
              y1={END_RULE_TOP - 6}
              x2={endX}
              y2={END_RULE_TOP - 6}
              stroke="var(--state-retrieve)"
              strokeWidth={1.5}
            />
            <line x1={firstX} y1={END_RULE_TOP - 11} x2={firstX} y2={END_RULE_TOP - 1} stroke="var(--state-retrieve)" strokeWidth={1.5} />
            <line x1={endX} y1={END_RULE_TOP - 11} x2={endX} y2={END_RULE_TOP - 1} stroke="var(--state-retrieve)" strokeWidth={1.5} />
            <text
              x={(firstX + endX) / 2}
              y={END_RULE_TOP - 14}
              textAnchor="middle"
              className="fill-[var(--ui-primary-ink)] font-mono text-[11px] font-semibold"
            >
              {formatLead(lead)} early
            </text>
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

        {turn.retrievals.map((record, index) => (
          <RetrievalMarker
            key={`${record.subQueryId}-${record.atMs}`}
            x={plot.x(record.atMs)}
            cancelled={record.cancelledReason !== undefined}
            index={index}
          />
        ))}

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
            <text
              x={Math.min(endX + 6, width - 4)}
              y={END_RULE_BOTTOM + 12}
              textAnchor={endX > width - 90 ? "end" : "start"}
              className="fill-[var(--ink-muted)] font-mono text-[10px]"
            >
              utterance end {formatMs(turn.utteranceEndMs ?? 0)}
            </text>
          </g>
        )}

        <text x={PAD_X} y={TRACK_Y + 20} className="fill-[var(--ink-muted)] font-mono text-[10px]">
          0ms
        </text>
      </svg>

      <DecisionLog turn={turn} />
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
            <span className="min-w-0">
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
