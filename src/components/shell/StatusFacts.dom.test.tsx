import { act, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { HealthResult } from "@/lib/health";
import { useAppStore } from "@/store/useAppStore";
import type { Turn } from "@/store/types";
import { StatusFacts } from "./StatusFacts";
import { StatusStrip } from "./StatusStrip";

const OK: HealthResult = { state: "ok", at: 1, health: { version: "0.3.0", corpus: null, models: {} } };

function turn(id: string, complete: number | null): Turn {
  return {
    id,
    sessionId: "s1",
    transcript: [],
    utteranceEndMs: null,
    decisions: [],
    retrievals: [],
    firstRetrievalMs: null,
    subQueries: [],
    evidence: [],
    quotaApplied: false,
    fullCorpusSearch: true,
    versions: [],
    activeVersion: 1,
    latencyMs: complete === null ? null : { firstRetrieval: 100, firstToken: 800, complete },
    cost: null,
    status: complete === null ? "answering" : "complete",
    errorMessage: null,
  };
}

const SHARED = { session: { id: "s_mock_0007", corpus: { docs: 12, chunks: 96 } }, turns: {} };

function load(state: { turns?: Turn[]; sessionId?: string | null; connection?: "open" | "closed" | "connecting"; corpus?: { docs: number; chunks: number } | null }) {
  act(() =>
    useAppStore.setState({
      turns: state.turns ?? [],
      shared: state.sessionId === null ? null : { ...SHARED, session: { ...SHARED.session, id: state.sessionId ?? SHARED.session.id } },
      connection: state.connection ?? "open",
      corpus: state.corpus === undefined ? { docs: 12, chunks: 96 } : state.corpus,
    }),
  );
}

beforeEach(() => load({}));

describe("StatusStrip: the values match the store (the acceptance test)", () => {
  it("shows the session id, the number of turns, and how long the newest turn took", () => {
    load({ turns: [turn("t1", 2100), turn("t2", 49080)] });
    render(<StatusStrip health={OK} />);
    const strip = screen.getByRole("contentinfo");
    expect(within(strip).getByText("s_mock_0007")).toHaveClass("font-mono", "truncate");
    expect(strip.querySelector('[data-fact="turns"]')).toHaveTextContent("Turns 2");
    expect(strip.querySelector('[data-fact="last-turn"]')).toHaveTextContent("Last turn 49.08s");
  });

  it("follows the store as it changes", () => {
    render(<StatusStrip health={OK} />);
    expect(screen.getByRole("contentinfo").querySelector('[data-fact="turns"]')).toHaveTextContent("Turns 0");
    load({ turns: [turn("t1", 840)] });
    expect(screen.getByRole("contentinfo").querySelector('[data-fact="turns"]')).toHaveTextContent("Turns 1");
    expect(screen.getByRole("contentinfo").querySelector('[data-fact="last-turn"]')).toHaveTextContent("840ms");
  });

  it("says n/a for a turn that has not finished, and a dash where there is no session yet", () => {
    load({ turns: [turn("t1", null)], sessionId: null });
    render(<StatusStrip health={OK} />);
    const strip = screen.getByRole("contentinfo");
    expect(strip.querySelector('[data-fact="last-turn"]')).toHaveTextContent("Last turn n/a");
    expect(strip.querySelector('[data-fact="session"]')).toHaveTextContent("—");
    expect(within(strip).queryByRole("button", { name: "Copy session id" })).toBeNull();
  });

  it("offers to copy the session id", () => {
    render(<StatusStrip health={OK} />);
    expect(screen.getByRole("button", { name: "Copy session id" })).toHaveClass("size-status");
  });

  it("shows the engine's health in words, and the corpus", () => {
    render(<StatusStrip health={OK} />);
    const strip = screen.getByRole("contentinfo");
    expect(strip.querySelector('[data-fact="health"]')).toHaveTextContent("Engine ok, version 0.3.0");
    expect(strip.querySelector('[data-fact="corpus"]')).toHaveTextContent("12 docs, 96 chunks");
  });

  it("says when the health is not known", () => {
    render(<StatusStrip health={{ state: "unknown" }} />);
    expect(screen.getByRole("contentinfo").querySelector('[data-fact="health"]')).toHaveTextContent("Engine health unknown");
  });

  it("shows the connection state without announcing it a second time", () => {
    render(<StatusStrip health={OK} />);
    expect(screen.getByText("Engine live")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("is 24 px tall by its token, only from 768 px, and pads by the notch", () => {
    render(<StatusStrip health={OK} />);
    expect(screen.getByRole("contentinfo")).toHaveClass("h-status", "hidden", "md:block", "pl-safe-left", "pr-safe-right");
  });
});

describe("StatusFacts (the same facts in the phone menu)", () => {
  it("shows the same values, from the same store", () => {
    load({ turns: [turn("t1", 1500)] });
    const { container } = render(<StatusFacts health={OK} />);
    expect(container.querySelector('[data-fact="session"]')).toHaveTextContent("s_mock_0007");
    expect(container.querySelector('[data-fact="turns"]')).toHaveTextContent("1");
    expect(container.querySelector('[data-fact="last-turn"]')).toHaveTextContent("1.50s");
    expect(container.querySelector('[data-fact="corpus"]')).toHaveTextContent("12 docs, 96 chunks");
  });

  it("is a description list with a term for each fact", () => {
    const { container } = render(<StatusFacts health={OK} />);
    expect([...container.querySelectorAll("dt")].map((term) => term.textContent)).toEqual(["Engine", "Session", "Turns", "Last turn", "Corpus"]);
  });

  it("puts long values in a column that can shrink, so nothing widens the menu", () => {
    const { container } = render(<StatusFacts health={OK} />);
    expect(container.querySelector("dl")?.className).toContain("minmax(0,1fr)");
    expect(container.querySelector('[data-fact="session"]')).toHaveClass("truncate");
  });

  it("agrees with the strip on every value", () => {
    load({ turns: [turn("t1", 2100), turn("t2", 3400)] });
    const strip = render(<StatusStrip health={OK} />);
    const facts = render(<StatusFacts health={OK} />);
    for (const fact of ["session", "turns", "last-turn", "corpus"]) {
      const inStrip = strip.container.querySelector(`[data-fact="${fact}"]`)?.textContent ?? "";
      const inFacts = facts.container.querySelector(`[data-fact="${fact}"]`)?.textContent ?? "";
      // The strip prefixes a label ("Turns 2"); the list has the value alone.
      expect(inStrip, fact).toContain(inFacts.trim());
    }
  });
});
