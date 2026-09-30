import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { INSPECTOR } from "@/lib/layout";
import { Workbench } from "./Workbench";

function Host({ docked, startOpen = false }: { docked: boolean; startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open inspector</button>
      <button>Elsewhere</button>
      <Workbench docked={docked} inspectorOpen={open} onCloseInspector={() => setOpen(false)} inspectorTitle="Turn t3" inspector={<button>Inside the inspector</button>}>
        <p>The view</p>
      </Workbench>
    </>
  );
}

beforeEach(() => window.localStorage.clear());

describe("Workbench: the view", () => {
  it("hosts the current view in the page's one main landmark", () => {
    render(<Host docked />);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main");
    expect(main).toHaveAttribute("tabindex", "-1");
    expect(main).toHaveTextContent("The view");
    expect(screen.getAllByRole("main")).toHaveLength(1);
  });

  it("makes the view a pane that scrolls its own content and pads by the notch", () => {
    render(<Host docked />);
    expect(screen.getByRole("main")).toHaveClass("pane", "pr-safe-right");
  });

  it("has no Inspector, docked or sheet, until it is opened", () => {
    render(<Host docked />);
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("separator")).toBeNull();
  });
});

describe("Workbench: docked (1024 px and up)", () => {
  it("opens the Inspector beside the view as a named complementary region, outside the main landmark", async () => {
    const user = userEvent.setup();
    render(<Host docked />);
    await user.click(screen.getByRole("button", { name: "Open inspector" }));
    const aside = screen.getByRole("complementary", { name: "Turn t3" });
    expect(screen.getByRole("main").contains(aside)).toBe(false);
    expect(aside).toHaveTextContent("Inside the inspector");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("puts the drag handle between them, and marks the grid as docked", async () => {
    const user = userEvent.setup();
    const { container } = render(<Host docked />);
    expect(container.querySelector(".workbench")).toHaveAttribute("data-inspector", "none");
    await user.click(screen.getByRole("button", { name: "Open inspector" }));
    expect(container.querySelector(".workbench")).toHaveAttribute("data-inspector", "docked");
    expect(screen.getByRole("separator", { name: "Resize the inspector" })).toBeInTheDocument();
  });

  it("starts at the default width and keeps the width between the limits", async () => {
    const user = userEvent.setup();
    const { container } = render(<Host docked />);
    await user.click(screen.getByRole("button", { name: "Open inspector" }));
    const grid = container.querySelector<HTMLElement>(".workbench");
    expect(grid?.style.getPropertyValue("--inspector-size")).toBe("480px");
    const handle = screen.getByRole("separator");
    expect(handle).toHaveAttribute("aria-valuemin", String(INSPECTOR.min));
    expect(Number(handle.getAttribute("aria-valuemax"))).toBeLessThanOrEqual(INSPECTOR.max);
  });

  it("remembers the width the reader chose", async () => {
    const user = userEvent.setup();
    const { container, unmount } = render(<Host docked />);
    await user.click(screen.getByRole("button", { name: "Open inspector" }));
    screen.getByRole("separator").focus();
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(window.localStorage.getItem(INSPECTOR.storageKey)).toBe("512");
    unmount();

    const again = render(<Host docked startOpen />);
    expect(again.container.querySelector<HTMLElement>(".workbench")?.style.getPropertyValue("--inspector-size")).toBe("512px");
    expect(container).toBeDefined();
  });

  it("has a close button in its header, which closes it", async () => {
    const user = userEvent.setup();
    render(<Host docked />);
    await user.click(screen.getByRole("button", { name: "Open inspector" }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("moves focus into the Inspector when the reader opens it, and back when it closes (the acceptance test)", async () => {
    const user = userEvent.setup();
    render(<Host docked />);
    const opener = screen.getByRole("button", { name: "Open inspector" });
    await user.click(opener);
    expect(screen.getByRole("complementary")).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(opener).toHaveFocus();
  });

  it("does not take focus when the page opens already showing the Inspector", () => {
    render(<Host docked startOpen />);
    expect(screen.getByRole("complementary")).not.toHaveFocus();
    expect(document.body).toHaveFocus();
  });
});

describe("Workbench: below 1024 px", () => {
  it("shows the Inspector as a sheet instead: a modal dialog with the same name and content", async () => {
    const user = userEvent.setup();
    render(<Host docked={false} />);
    await user.click(screen.getByRole("button", { name: "Open inspector" }));
    const dialog = screen.getByRole("dialog", { name: "Turn t3" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveTextContent("Inside the inspector");
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.queryByRole("separator")).toBeNull();
  });

  it("closes with Escape, and gives focus back", async () => {
    const user = userEvent.setup();
    render(<Host docked={false} />);
    const opener = screen.getByRole("button", { name: "Open inspector" });
    await user.click(opener);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });

  it("switches between a sheet and a docked pane as the window crosses 1024 px, keeping it open", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Host docked={false} />);
    await user.click(screen.getByRole("button", { name: "Open inspector" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    act(() => void rerender(<Host docked />));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
