import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setMedia } from "@/test/setup";

/*
 * useTheme keeps its preference in a module-level store, so each test loads a
 * fresh copy of the module. The dom project's setup gives jsdom a controllable
 * matchMedia, which is how "system" is exercised.
 */
async function load() {
  vi.resetModules();
  const { useTheme } = await import("@/hooks/useTheme");
  return renderHook(() => useTheme());
}

const attribute = () => document.documentElement.getAttribute("data-theme");

describe("useTheme", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults to light and applies it", async () => {
    const { result } = await load();
    expect(result.current.theme).toBe("light");
    expect(result.current.resolved).toBe("light");
    expect(attribute()).toBe("light");
  });

  it("remembers a choice across a reload", async () => {
    const first = await load();
    act(() => first.result.current.setTheme("dark"));
    expect(attribute()).toBe("dark");
    expect(window.localStorage.getItem("slr.theme")).toBe("dark");
    first.unmount();

    document.documentElement.removeAttribute("data-theme");
    const second = await load();
    expect(second.result.current.theme).toBe("dark");
    expect(attribute()).toBe("dark");
  });

  it("removes the attribute for system and resolves to the operating system's setting", async () => {
    setMedia({ "(prefers-color-scheme: dark)": true });
    const { result } = await load();
    act(() => result.current.setTheme("system"));
    expect(attribute()).toBeNull();
    expect(result.current.theme).toBe("system");
    expect(result.current.resolved).toBe("dark");

    act(() => setMedia({ "(prefers-color-scheme: dark)": false }));
    expect(result.current.resolved).toBe("light");
  });

  it("cycles light, dark, system", async () => {
    const { result } = await load();
    act(() => result.current.cycleTheme());
    expect(result.current.theme).toBe("dark");
    act(() => result.current.cycleTheme());
    expect(result.current.theme).toBe("system");
    act(() => result.current.cycleTheme());
    expect(result.current.theme).toBe("light");
  });

  it("still switches theme when storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { result } = await load();
    expect(result.current.theme).toBe("light");
    act(() => result.current.setTheme("dark"));
    expect(attribute()).toBe("dark");
    vi.restoreAllMocks();
  });

  it("follows a change made in another tab", async () => {
    const { result } = await load();
    act(() => {
      window.localStorage.setItem("slr.theme", "dark");
      window.dispatchEvent(new StorageEvent("storage", { key: "slr.theme", newValue: "dark" }));
    });
    expect(result.current.theme).toBe("dark");
    expect(attribute()).toBe("dark");
  });
});
