import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { viewRoute, type Route } from "@/lib/route";
import { resetActiveView, useActiveView } from "./useActiveView";

function Probe({ route }: { route: Route }) {
  return <p>{useActiveView(route)}</p>;
}

const inspect: Route = { kind: "inspect", sessionId: "s", turnId: "t1", tab: null };

beforeEach(() => resetActiveView());

describe("useActiveView", () => {
  it("is the route's own view", () => {
    const { rerender } = render(<Probe route={viewRoute("traces")} />);
    expect(screen.getByText("traces")).toBeInTheDocument();
    rerender(<Probe route={viewRoute("metrics")} />);
    expect(screen.getByText("metrics")).toBeInTheDocument();
  });

  it("is the console when the page opens on an Inspector address, with no view before it", () => {
    render(<Probe route={inspect} />);
    expect(screen.getByText("console")).toBeInTheDocument();
  });

  it("remembers the view the Inspector was opened over, and returns to it (the acceptance test)", () => {
    const { rerender } = render(<Probe route={viewRoute("traces")} />);
    rerender(<Probe route={inspect} />);
    expect(screen.getByText("traces")).toBeInTheDocument();
    rerender(<Probe route={viewRoute("traces")} />);
    expect(screen.getByText("traces")).toBeInTheDocument();
  });

  it("follows the reader from one view to another with the Inspector open in between", () => {
    const { rerender } = render(<Probe route={viewRoute("metrics")} />);
    rerender(<Probe route={inspect} />);
    expect(screen.getByText("metrics")).toBeInTheDocument();
    rerender(<Probe route={viewRoute("console")} />);
    rerender(<Probe route={inspect} />);
    expect(screen.getByText("console")).toBeInTheDocument();
  });

  it("shares what it remembers between components", () => {
    const first = render(<Probe route={viewRoute("metrics")} />);
    first.unmount();
    render(<Probe route={inspect} />);
    expect(screen.getByText("metrics")).toBeInTheDocument();
  });
});
