import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copyText } from "@/components/ui/clipboard";
import { CopyButton } from "./CopyButton";

// The clipboard itself is tested in Feedback.dom.test.tsx. Here it is replaced, so this file tests what the button does with the answer.
vi.mock("@/components/ui/clipboard", () => ({ copyText: vi.fn() }));

/** What a screen reader would be told: the text of the two live regions the announcer keeps in the layer root. */
const said = (politeness: "polite" | "assertive" = "polite") =>
  document.querySelector<HTMLElement>(`#layer-root [aria-live="${politeness}"]`)?.textContent ?? "";

beforeEach(() => {
  vi.mocked(copyText).mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  for (const region of document.querySelectorAll("#layer-root [aria-live]")) region.textContent = "";
});

const succeeds = () => vi.mocked(copyText).mockResolvedValue(true);
const fails = () => vi.mocked(copyText).mockResolvedValue(false);

describe("CopyButton", () => {
  it("copies its value and announces it (the acceptance test)", async () => {
    const user = userEvent.setup();
    succeeds();
    render(<CopyButton value="s_mock_0001" label="Copy session id" />);
    await user.click(screen.getByRole("button", { name: "Copy session id" }));
    expect(copyText).toHaveBeenCalledWith("s_mock_0001");
    await waitFor(() => expect(said()).toBe("Copied"));
  });

  it("says what it was told to say on success", async () => {
    const user = userEvent.setup();
    succeeds();
    render(<CopyButton value="x" label="Copy id" copiedMessage="Session id copied" />);
    await user.click(screen.getByRole("button"));
    await waitFor(() => expect(said()).toBe("Session id copied"));
  });

  it("keeps its name after copying: the announcement, not the label, reports the result", async () => {
    const user = userEvent.setup();
    succeeds();
    render(<CopyButton value="x" label="Copy session id" />);
    await user.click(screen.getByRole("button"));
    expect(screen.getByRole("button", { name: "Copy session id" })).toBeInTheDocument();
  });

  it("announces a failed copy assertively instead of dropping it", async () => {
    const user = userEvent.setup();
    fails();
    render(<CopyButton value="x" label="Copy id" />);
    await user.click(screen.getByRole("button"));
    await waitFor(() => expect(said("assertive")).toBe("Copy failed"));
    expect(said()).toBe("");
  });

  it("shows a check mark for a moment, then the copy icon again", async () => {
    succeeds();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { container } = render(<CopyButton value="x" label="Copy id" />);
    const iconName = () => container.querySelector("svg")?.getAttribute("class") ?? "";
    const before = iconName();
    await user.click(screen.getByRole("button"));
    await waitFor(() => expect(iconName()).not.toBe(before));
    await act(async () => void vi.advanceTimersByTime(1600));
    expect(iconName()).toBe(before);
  });

  it("does not show the check mark when the copy failed", async () => {
    const user = userEvent.setup();
    fails();
    const { container } = render(<CopyButton value="x" label="Copy id" />);
    const before = container.querySelector("svg")?.getAttribute("class");
    await user.click(screen.getByRole("button"));
    await waitFor(() => expect(said("assertive")).toBe("Copy failed"));
    expect(container.querySelector("svg")?.getAttribute("class")).toBe(before);
  });

  it("has a text variant that says Copied", async () => {
    const user = userEvent.setup();
    succeeds();
    render(<CopyButton value="x" label="Copy" variant="text" />);
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
  });

  it("uses the icon-button sizes, so it is 44 px on a touch screen", () => {
    succeeds();
    render(<CopyButton value="x" label="Copy id" />);
    expect(screen.getByRole("button", { name: "Copy id" })).toHaveClass("size-control-sm");
  });
});
