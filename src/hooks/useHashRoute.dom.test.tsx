import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { formatRoute, viewRoute } from "@/lib/route";
import { navigateTo, useHashRoute } from "./useHashRoute";

function Probe() {
  const { route, navigate } = useHashRoute();
  return (
    <>
      <p data-testid="route">{formatRoute(route)}</p>
      <button onClick={() => navigate(viewRoute("metrics"))}>Metrics</button>
      <button onClick={() => navigate({ kind: "view", view: "traces", q: "a b", sort: null }, { replace: true })}>Filter</button>
    </>
  );
}

const shown = () => screen.getByTestId("route").textContent;

beforeEach(() => {
  window.location.hash = "";
});

afterEach(() => {
  window.location.hash = "";
});

describe("useHashRoute", () => {
  it("is the console when there is no hash, and for a hash it does not know", async () => {
    render(<Probe />);
    expect(shown()).toBe("#/console");
    act(() => void (window.location.hash = "#/nowhere"));
    await waitFor(() => expect(shown()).toBe("#/console"));
  });

  it("reads the hash the page was opened with", () => {
    window.location.hash = "#/traces?q=error";
    render(<Probe />);
    expect(shown()).toBe("#/traces?q=error");
  });

  it("follows the address bar when it changes", async () => {
    render(<Probe />);
    act(() => void (window.location.hash = "#/inspect/s_1/t3?tab=raw"));
    await waitFor(() => expect(shown()).toBe("#/inspect/s_1/t3?tab=raw"));
  });

  it("navigates by writing the hash, which adds a history entry", async () => {
    render(<Probe />);
    const before = window.history.length;
    act(() => screen.getByRole("button", { name: "Metrics" }).click());
    await waitFor(() => expect(shown()).toBe("#/metrics"));
    expect(window.location.hash).toBe("#/metrics");
    expect(window.history.length).toBe(before + 1);
  });

  it("replaces the entry instead when asked, so Back does not step through every keystroke", async () => {
    render(<Probe />);
    act(() => screen.getByRole("button", { name: "Metrics" }).click());
    await waitFor(() => expect(shown()).toBe("#/metrics"));
    const length = window.history.length;
    act(() => screen.getByRole("button", { name: "Filter" }).click());
    await waitFor(() => expect(shown()).toBe("#/traces?q=a+b"));
    expect(window.history.length).toBe(length);
  });

  it("goes back and forward with the browser's history (the acceptance test)", async () => {
    render(<Probe />);
    act(() => void navigateTo(viewRoute("traces")));
    await waitFor(() => expect(shown()).toBe("#/traces"));
    act(() => void navigateTo(viewRoute("metrics")));
    await waitFor(() => expect(shown()).toBe("#/metrics"));

    act(() => window.history.back());
    await waitFor(() => expect(shown()).toBe("#/traces"));
    act(() => window.history.forward());
    await waitFor(() => expect(shown()).toBe("#/metrics"));
  });

  it("does nothing, and adds no entry, to go where it already is", async () => {
    render(<Probe />);
    act(() => void navigateTo(viewRoute("metrics")));
    await waitFor(() => expect(shown()).toBe("#/metrics"));
    const length = window.history.length;
    act(() => void navigateTo(viewRoute("metrics")));
    expect(window.history.length).toBe(length);
  });

  it("gives the same route object until the hash changes, so it is safe in a dependency list", async () => {
    const seen = new Set<unknown>();
    function Collect() {
      const { route } = useHashRoute();
      seen.add(route);
      return <p>{formatRoute(route)}</p>;
    }
    const { rerender } = render(<Collect />);
    rerender(<Collect />);
    rerender(<Collect />);
    expect(seen.size).toBe(1);
  });

  it("is the console on the server, so the static export does not depend on the address", async () => {
    const { renderToString } = await import("react-dom/server");
    window.location.hash = "#/metrics";
    expect(renderToString(<Probe />)).toContain("#/console");
  });
});
