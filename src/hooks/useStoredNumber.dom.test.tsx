import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useStoredNumber, writeStoredNumber } from "./useStoredNumber";

function Probe({ id = "a" }: { id?: string }) {
  const [value, setValue] = useStoredNumber("slr.test.width", 400);
  return (
    <>
      <p data-testid={id}>{value}</p>
      <button onClick={() => setValue(value + 16)}>Grow {id}</button>
    </>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useStoredNumber", () => {
  it("is the fallback when nothing is stored", () => {
    render(<Probe />);
    expect(screen.getByTestId("a")).toHaveTextContent("400");
  });

  it("is the stored value when there is one", () => {
    window.localStorage.setItem("slr.test.width", "512");
    render(<Probe />);
    expect(screen.getByTestId("a")).toHaveTextContent("512");
  });

  it.each(["", "wide", "NaN", "Infinity"])("falls back for a stored value that is not a number: %j", (stored) => {
    window.localStorage.setItem("slr.test.width", stored);
    render(<Probe />);
    expect(screen.getByTestId("a")).toHaveTextContent("400");
  });

  it("writes the value and shows it", () => {
    render(<Probe />);
    act(() => screen.getByRole("button", { name: "Grow a" }).click());
    expect(screen.getByTestId("a")).toHaveTextContent("416");
    expect(window.localStorage.getItem("slr.test.width")).toBe("416");
  });

  it("tells every hook that reads the same key", () => {
    render(
      <>
        <Probe id="a" />
        <Probe id="b" />
      </>,
    );
    act(() => screen.getByRole("button", { name: "Grow b" }).click());
    expect(screen.getByTestId("a")).toHaveTextContent("416");
    expect(screen.getByTestId("b")).toHaveTextContent("416");
  });

  it("follows a change made in another tab", () => {
    render(<Probe />);
    window.localStorage.setItem("slr.test.width", "600");
    act(() => void window.dispatchEvent(new StorageEvent("storage", { key: "slr.test.width", newValue: "600" })));
    expect(screen.getByTestId("a")).toHaveTextContent("600");
  });

  it("ignores another tab's change to some other key", () => {
    render(<Probe />);
    act(() => void window.dispatchEvent(new StorageEvent("storage", { key: "something.else", newValue: "1" })));
    expect(screen.getByTestId("a")).toHaveTextContent("400");
  });

  it("is not an error when storage is blocked: the fallback is used and the value is just not kept", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    render(<Probe />);
    expect(screen.getByTestId("a")).toHaveTextContent("400");
    expect(() => act(() => screen.getByRole("button", { name: "Grow a" }).click())).not.toThrow();
  });

  it("renders the fallback on the server, so hydration matches", () => {
    window.localStorage.setItem("slr.test.width", "999");
    expect(renderToString(<Probe />)).toContain("400");
  });

  it("can be written from outside a component", () => {
    render(<Probe />);
    act(() => writeStoredNumber("slr.test.width", 720));
    expect(screen.getByTestId("a")).toHaveTextContent("720");
  });
});
