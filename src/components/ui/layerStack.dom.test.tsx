import { afterEach, describe, expect, it, vi } from "vitest";
import { LAYER_ROOT_ID, isTopLayer, layerDepth, registerLayer, resetLayers } from "./layerStack";

afterEach(() => {
  resetLayers();
  document.body.innerHTML = "";
  document.documentElement.style.overflow = "";
});

const press = (key: string, init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  document.body.dispatchEvent(event);
  return event;
};

function page(children: string[] = []): { layerRoot: HTMLElement; app: HTMLElement } {
  document.body.innerHTML = `<div id="app"><button>behind</button></div><div id="${LAYER_ROOT_ID}">${children.map((id) => `<div id="${id}"></div>`).join("")}</div>`;
  return { layerRoot: document.getElementById(LAYER_ROOT_ID) as HTMLElement, app: document.getElementById("app") as HTMLElement };
}

const layer = (id: string | null, modal: boolean, onEscape = vi.fn()) => ({
  modal,
  onEscape,
  getElement: () => (id ? document.getElementById(id) : null),
});

describe("escape", () => {
  it("closes only the top layer, then the next one on the following press", () => {
    page(["below", "above"]);
    const lower = vi.fn();
    const upper = vi.fn();
    const first = registerLayer(layer("below", true, lower));
    const second = registerLayer(layer("above", false, upper));

    press("Escape");
    expect(upper).toHaveBeenCalledTimes(1);
    expect(lower).not.toHaveBeenCalled();

    second.unregister();
    press("Escape");
    expect(lower).toHaveBeenCalledTimes(1);
    expect(upper).toHaveBeenCalledTimes(1);
    first.unregister();
  });

  it("stops the key, so a page-level Escape handler does not also run while a layer is open", () => {
    page(["sheet"]);
    const pageHandler = vi.fn();
    window.addEventListener("keydown", pageHandler);
    const open = registerLayer(layer("sheet", true));

    const handled = press("Escape");
    expect(handled.defaultPrevented).toBe(true);
    expect(pageHandler).not.toHaveBeenCalled();

    open.unregister();
    press("Escape");
    expect(pageHandler).toHaveBeenCalledTimes(1);
    window.removeEventListener("keydown", pageHandler);
  });

  it("ignores other keys and an Escape that belongs to an input method", () => {
    page(["sheet"]);
    const onEscape = vi.fn();
    registerLayer(layer("sheet", true, onEscape));
    press("Enter");
    press("Escape", { isComposing: true });
    expect(onEscape).not.toHaveBeenCalled();
  });

  it("does nothing, and takes no listener, when no layer is open", () => {
    page();
    const pageHandler = vi.fn();
    window.addEventListener("keydown", pageHandler);
    const event = press("Escape");
    expect(event.defaultPrevented).toBe(false);
    expect(pageHandler).toHaveBeenCalledTimes(1);
    window.removeEventListener("keydown", pageHandler);
  });
});

describe("inert", () => {
  it("makes the page inert behind a modal layer and restores it afterwards", () => {
    const { app, layerRoot } = page(["sheet"]);
    const open = registerLayer(layer("sheet", true));
    expect(app.hasAttribute("inert")).toBe(true);
    expect(layerRoot.hasAttribute("inert")).toBe(false);

    open.unregister();
    expect(app.hasAttribute("inert")).toBe(false);
  });

  it("does not inert the page for a layer that is not modal", () => {
    const { app } = page(["tip"]);
    const open = registerLayer(layer("tip", false));
    expect(app.hasAttribute("inert")).toBe(false);
    open.unregister();
  });

  it("keeps the layers above the top modal usable and makes the layers below it inert", () => {
    page(["menu", "sheet", "nested"]);
    const menu = registerLayer(layer("menu", false));
    const sheet = registerLayer(layer("sheet", true));
    const nested = registerLayer(layer("nested", false));

    expect(document.getElementById("menu")?.hasAttribute("inert")).toBe(true);
    expect(document.getElementById("sheet")?.hasAttribute("inert")).toBe(false);
    expect(document.getElementById("nested")?.hasAttribute("inert")).toBe(false);

    nested.unregister();
    sheet.unregister();
    expect(document.getElementById("menu")?.hasAttribute("inert")).toBe(false);
    menu.unregister();
  });

  it("does not remove an inert attribute it did not set", () => {
    const { app } = page(["sheet"]);
    const other = document.createElement("div");
    other.setAttribute("inert", "");
    document.body.appendChild(other);
    const open = registerLayer(layer("sheet", true));
    open.unregister();
    expect(other.hasAttribute("inert")).toBe(true);
    expect(app.hasAttribute("inert")).toBe(false);
  });
});

describe("scroll lock", () => {
  it("locks page scroll while any modal layer is open and restores the previous value after the last", () => {
    page(["a", "b"]);
    document.documentElement.style.overflow = "auto";
    const first = registerLayer(layer("a", true));
    const second = registerLayer(layer("b", true));
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.documentElement.hasAttribute("data-scroll-locked")).toBe(true);

    second.unregister();
    expect(document.documentElement.style.overflow).toBe("hidden");
    first.unregister();
    expect(document.documentElement.style.overflow).toBe("auto");
    expect(document.documentElement.hasAttribute("data-scroll-locked")).toBe(false);
  });

  it("leaves scrolling alone for layers that are not modal", () => {
    page(["tip"]);
    const open = registerLayer(layer("tip", false));
    expect(document.documentElement.style.overflow).toBe("");
    open.unregister();
  });
});

describe("bookkeeping", () => {
  it("tracks depth and which layer is on top", () => {
    page(["a", "b"]);
    const first = registerLayer(layer("a", false));
    const second = registerLayer(layer("b", false));
    expect(layerDepth()).toBe(2);
    expect(isTopLayer(second.id)).toBe(true);
    expect(isTopLayer(first.id)).toBe(false);
    second.unregister();
    expect(isTopLayer(first.id)).toBe(true);
    first.unregister();
    expect(layerDepth()).toBe(0);
  });

  it("unregistering twice is harmless", () => {
    page(["a"]);
    const open = registerLayer(layer("a", true));
    open.unregister();
    expect(() => open.unregister()).not.toThrow();
    expect(document.documentElement.hasAttribute("data-scroll-locked")).toBe(false);
  });
});
