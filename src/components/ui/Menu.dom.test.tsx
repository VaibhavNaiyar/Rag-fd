import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Menu, type MenuEntry } from "./Menu";

function setup(items?: MenuEntry[]) {
  const onOpen = vi.fn();
  const onRename = vi.fn();
  const onDelete = vi.fn();
  const entries: MenuEntry[] = items ?? [
    { id: "open", label: "Open trace", shortcut: ["enter"], onSelect: onOpen },
    { id: "rename", label: "Rename", onSelect: onRename },
    { id: "sep", type: "separator" },
    { id: "archive", label: "Archive", disabled: true, onSelect: vi.fn() },
    { id: "delete", label: "Delete", danger: true, onSelect: onDelete },
  ];
  render(
    <>
      <button>Before</button>
      <Menu
        label="Row actions"
        items={entries}
        trigger={(props) => (
          <button {...props} type="button">
            Actions
          </button>
        )}
      />
      <button>After</button>
    </>,
  );
  return { onOpen, onRename, onDelete, trigger: () => screen.getByRole("button", { name: "Actions" }) };
}

describe("Menu: opening", () => {
  it("is closed to begin with, and its trigger says it opens a menu", () => {
    const { trigger } = setup();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger()).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(trigger()).not.toHaveAttribute("aria-controls");
  });

  it("opens on click, focuses the first item, and points the trigger at the menu", async () => {
    const user = userEvent.setup();
    const { trigger } = setup();
    await user.click(trigger());

    const menu = screen.getByRole("menu", { name: "Row actions" });
    expect(screen.getByRole("menuitem", { name: /Open trace/ })).toHaveFocus();
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(trigger()).toHaveAttribute("aria-controls", menu.id);
  });

  it("opens on the first item with Arrow Down, and on the last with Arrow Up", async () => {
    const user = userEvent.setup();
    const { trigger } = setup();
    trigger().focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: /Open trace/ })).toHaveFocus();
    await user.keyboard("{Escape}");

    trigger().focus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveFocus();
  });

  it("opens with Enter and with Space, as a button does", async () => {
    const user = userEvent.setup();
    const { trigger } = setup();
    trigger().focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.keyboard(" ");
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("toggles closed when the trigger is pressed again", async () => {
    const user = userEvent.setup();
    const { trigger } = setup();
    await user.click(trigger());
    await user.click(trigger());
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("Menu: keyboard", () => {
  it("moves between items with the arrows, wraps, and skips a disabled one", async () => {
    const user = userEvent.setup();
    const { trigger } = setup();
    await user.click(trigger());

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Rename" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    // Past the separator and the disabled "Archive".
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: /Open trace/ })).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveFocus();
  });

  it("goes to the first and last item with Home and End", async () => {
    const user = userEvent.setup();
    const { trigger } = setup();
    await user.click(trigger());
    await user.keyboard("{End}");
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("menuitem", { name: /Open trace/ })).toHaveFocus();
  });

  it("jumps to the next item that starts with the typed letters (typeahead)", async () => {
    const user = userEvent.setup();
    const { trigger } = setup();
    await user.click(trigger());
    await user.keyboard("d");
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveFocus();
    await user.keyboard("r");
    // "r" alone starts a new word after the timeout; typed quickly it is "dr", which matches nothing.
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveFocus();
  });

  it("cycles through items that share a first letter", async () => {
    const user = userEvent.setup();
    const { trigger } = setup([
      { id: "a", label: "Copy id", onSelect: vi.fn() },
      { id: "b", label: "Copy link", onSelect: vi.fn() },
      { id: "c", label: "Delete", onSelect: vi.fn() },
    ]);
    await user.click(trigger());
    await user.keyboard("c");
    expect(screen.getByRole("menuitem", { name: "Copy link" })).toHaveFocus();
  });

  it("runs the item with Enter, closes, and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    const { trigger, onRename } = setup();
    await user.click(trigger());
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger()).toHaveFocus();
  });

  it("runs an item on click too", async () => {
    const user = userEvent.setup();
    const { trigger, onDelete } = setup();
    await user.click(trigger());
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("does not run a disabled item, and reports it as disabled", async () => {
    const user = userEvent.setup();
    const { trigger } = setup();
    await user.click(trigger());
    const archive = screen.getByRole("menuitem", { name: "Archive" });
    expect(archive).toHaveAttribute("aria-disabled", "true");
    await user.click(archive);
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("closes on Escape and gives focus back to the trigger", async () => {
    const user = userEvent.setup();
    const { trigger } = setup();
    await user.click(trigger());
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger()).toHaveFocus();
  });

  it("closes on Tab and lets focus move on from the trigger", async () => {
    const user = userEvent.setup();
    const { trigger } = setup();
    await user.click(trigger());
    await user.tab();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
    expect(trigger()).not.toHaveFocus();
  });

  it("closes on a press outside, and does not steal focus from where the reader went", async () => {
    const user = userEvent.setup();
    const { trigger } = setup();
    await user.click(trigger());
    await user.click(screen.getByRole("button", { name: "After" }));
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });
});

describe("Menu: content", () => {
  it("marks the danger item, hints a shortcut, and draws separators", async () => {
    const user = userEvent.setup();
    const { trigger } = setup();
    await user.click(trigger());
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveClass("text-error-ink");
    expect(screen.getByRole("menuitem", { name: /Open trace/ }).querySelector("kbd")).not.toBeNull();
    expect(screen.getByRole("menu").querySelectorAll('[role="separator"]')).toHaveLength(1);
  });

  it("renders in the layer root, as a fixed layer with a size limit, so it cannot widen the page", async () => {
    const user = userEvent.setup();
    const { trigger } = setup();
    await user.click(trigger());
    const layer = screen.getByRole("menu").parentElement as HTMLElement;
    expect(layer.closest("#layer-root")).not.toBeNull();
    expect(layer).toHaveClass("fixed");
    expect(layer.className).toContain("max-w-80");
    expect(layer.style.maxWidth).not.toBe("");
  });

  it("gives every item a 36 px row that becomes 44 px on touch", async () => {
    const user = userEvent.setup();
    const { trigger } = setup();
    await user.click(trigger());
    expect(screen.getByRole("menuitem", { name: "Rename" })).toHaveClass("min-h-row");
  });
});
