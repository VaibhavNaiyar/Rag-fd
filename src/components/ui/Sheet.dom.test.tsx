import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Menu } from "./Menu";
import { Sheet, type SheetSide } from "./Sheet";

function Host({ side, onChange = () => undefined }: { side?: SheetSide; onChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div id="app">
      <button onClick={() => setOpen(true)}>Open inspector</button>
      <button>Other control</button>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          onChange(next);
        }}
        title="Turn t3"
        description="Trace of the third turn"
        side={side}
      >
        <button>First inside</button>
        <input aria-label="Filter" />
        <button>Last inside</button>
      </Sheet>
    </div>
  );
}

async function open() {
  const user = userEvent.setup();
  render(<Host />);
  await user.click(screen.getByRole("button", { name: "Open inspector" }));
  return { user, dialog: screen.getByRole("dialog") };
}

describe("Sheet: semantics", () => {
  it("is a modal dialog named by its title and described by its description", async () => {
    const { dialog } = await open();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("dialog", { name: "Turn t3" })).toBe(dialog);
    expect(dialog.getAttribute("aria-describedby")).toBe(screen.getByText("Trace of the third turn").id);
  });

  it("is not in the document until opened", () => {
    render(<Host />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders in the layer root, so nothing on the page can clip it", async () => {
    const { dialog } = await open();
    expect(dialog.closest("#layer-root")).not.toBeNull();
  });

  it("puts the title in a heading and the close button in the header", async () => {
    await open();
    expect(screen.getByRole("heading", { name: "Turn t3", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });
});

describe("Sheet: focus (WAI-ARIA modal dialog)", () => {
  it("moves focus into the dialog when it opens", async () => {
    const { dialog } = await open();
    expect(dialog).toHaveFocus();
  });

  it("traps Tab: from the last control it goes to the first, and Shift+Tab the other way", async () => {
    const { user } = await open();
    const close = screen.getByRole("button", { name: "Close" });
    const last = screen.getByRole("button", { name: "Last inside" });

    last.focus();
    await user.tab();
    expect(close).toHaveFocus();

    await user.tab({ shift: true });
    expect(last).toHaveFocus();
  });

  it("keeps Tab inside when the dialog itself has focus", async () => {
    const { user, dialog } = await open();
    expect(dialog).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Last inside" })).toHaveFocus();
  });

  it("returns focus to the control that opened it when it closes", async () => {
    const { user } = await open();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Open inspector" })).toHaveFocus();
  });
});

describe("Sheet: closing", () => {
  it("closes on Escape", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Host onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Open inspector" }));
    await user.keyboard("{Escape}");
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it("closes from the close button", async () => {
    const { user } = await open();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on a press on the scrim, but not on a press inside the panel", async () => {
    const { user, dialog } = await open();
    await user.click(screen.getByRole("button", { name: "First inside" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    const scrim = dialog.previousElementSibling as HTMLElement;
    expect(scrim).toHaveAttribute("aria-hidden", "true");
    await user.click(scrim);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("Sheet: the page behind it", () => {
  it("makes the rest of the page inert while open, and live again after", async () => {
    const { user } = await open();
    // The test renderer wraps the app in a container that is the direct child of <body>; that is what is made inert.
    const app = document.getElementById("app") as HTMLElement;
    expect(app.closest("[inert]")).not.toBeNull();
    expect(document.getElementById("layer-root")?.closest("[inert]")).toBeNull();
    await user.keyboard("{Escape}");
    expect(app.closest("[inert]")).toBeNull();
  });

  it("locks page scroll while open", async () => {
    const { user } = await open();
    expect(document.documentElement.style.overflow).toBe("hidden");
    await user.keyboard("{Escape}");
    expect(document.documentElement.style.overflow).toBe("");
  });
});

describe("Sheet: layers on top of it", () => {
  function WithMenu() {
    const [open, setOpen] = useState(true);
    return (
      <div id="app">
        <Sheet open={open} onOpenChange={setOpen} title="Inspector">
          <Menu
            label="Turn actions"
            items={[{ id: "copy", label: "Copy id", onSelect: () => undefined }]}
            trigger={(props) => (
              <button {...props} type="button">
                Actions
              </button>
            )}
          />
        </Sheet>
      </div>
    );
  }

  it("Escape closes the menu first, and the sheet on the second press", async () => {
    const user = userEvent.setup();
    render(<WithMenu />);
    await user.click(screen.getByRole("button", { name: "Actions" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actions" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("leaves the menu usable while the sheet is open: only what is beneath the sheet is inert", async () => {
    const user = userEvent.setup();
    render(<WithMenu />);
    await user.click(screen.getByRole("button", { name: "Actions" }));
    const menu = screen.getByRole("menu");
    expect(menu.closest("[inert]")).toBeNull();
  });
});

describe("Sheet: size and motion", () => {
  it.each([
    ["right", "right-0"],
    ["left", "left-0"],
    ["bottom", "bottom-0"],
  ] as const)("the %s sheet is anchored to its edge", async (side, edge) => {
    const user = userEvent.setup();
    render(<Host side={side} />);
    await user.click(screen.getByRole("button", { name: "Open inspector" }));
    expect(screen.getByRole("dialog")).toHaveClass(edge);
  });

  it("is never wider than the viewport, and is full width below 480 px", async () => {
    const { dialog } = await open();
    expect(dialog.className).toContain("w-[min(var(--inspector-w),100vw)]");
    expect(dialog).toHaveClass("max-sm:w-full");
  });

  it("slides in with the one sheet animation, from the edge it belongs to", async () => {
    const { dialog } = await open();
    expect(dialog).toHaveClass("animate-sheet-in");
    expect(dialog.style.getPropertyValue("--sheet-from")).toBe("translateX(100%)");
  });

  it("respects the device's safe areas", async () => {
    const { dialog } = await open();
    expect(dialog).toHaveClass("pr-safe-right");
    expect(dialog.querySelector("header")).toHaveClass("pt-safe-top");
  });
});
