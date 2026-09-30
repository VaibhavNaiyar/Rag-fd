import type { View } from "@/lib/route";

/**
 * UI state that is not the conversation itself: which view is open, what the
 * Inspector shows, the Traces filter and columns, saved views, density, the
 * Inspector's find query. `urlSync.ts` (P5-F12) binds the route-shaped fields
 * (`view`, `selectedTurn`, `inspectorTab`, and Traces' `filters`) two ways with
 * the hash; this slice does not read or write `location.hash` itself.
 *
 * `inspectorWidth` is deliberately **not** here: `Workbench.tsx` (P4-F12)
 * already owns it through `useStoredNumber`, a `useSyncExternalStore` hook with
 * its own cross-tab sync. Duplicating it into this slice would give the
 * Inspector's width two sources of truth for no benefit.
 */

export type Density = "compact" | "default" | "touch";

export interface SavedView {
  name: string;
  filter: string;
}

export interface SelectedTurn {
  sessionId: string;
  turnId: string;
}

export interface UiSliceState {
  view: View;
  selectedTurn: SelectedTurn | null;
  inspectorTab: string | null;
  density: Density;
  /** The Traces view's filter expression text (P8-F03's grammar parses this). */
  filters: string;
  /** Visible Traces columns, in order. Null means "the default set" — not yet customised. */
  columns: string[] | null;
  savedViews: SavedView[];
  /** The Inspector's scoped find query (P7-F14). */
  findQuery: string;
}

export interface UiSliceActions {
  setView: (view: View) => void;
  selectTurn: (turn: SelectedTurn | null) => void;
  setInspectorTab: (tab: string | null) => void;
  setDensity: (density: Density) => void;
  setFilters: (filters: string) => void;
  setColumns: (columns: string[] | null) => void;
  saveView: (view: SavedView) => void;
  removeSavedView: (name: string) => void;
  setFindQuery: (query: string) => void;
}

export type UiSlice = UiSliceState & UiSliceActions;

const DEFAULT_STATE: UiSliceState = {
  view: "console",
  selectedTurn: null,
  inspectorTab: null,
  density: "default",
  filters: "",
  columns: null,
  savedViews: [],
  findQuery: "",
};

/** The subset that survives a reload — everything else (the route-shaped fields, `findQuery`) is either ephemeral or the URL's job to restore. */
interface Persisted {
  density: Density;
  columns: string[] | null;
  savedViews: SavedView[];
}

const STORAGE_KEY = "slr.ui.v1";

function isDensity(value: unknown): value is Density {
  return value === "compact" || value === "default" || value === "touch";
}

function readPersisted(): Partial<Persisted> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const candidate = parsed as Record<string, unknown>;
    const out: Partial<Persisted> = {};
    if (isDensity(candidate.density)) out.density = candidate.density;
    if (Array.isArray(candidate.columns) && candidate.columns.every((c) => typeof c === "string")) out.columns = candidate.columns as string[];
    if (Array.isArray(candidate.savedViews)) {
      const views = candidate.savedViews.filter(
        (v): v is SavedView => typeof v === "object" && v !== null && typeof (v as SavedView).name === "string" && typeof (v as SavedView).filter === "string",
      );
      out.savedViews = views;
    }
    return out;
  } catch {
    // Blocked or corrupt storage: the defaults apply, same as a first visit.
    return {};
  }
}

function writePersisted(state: Persisted): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Not being able to remember a preference is not a reason to refuse it for this visit.
  }
}

type Get = () => UiSliceState;
type Set = (updater: (state: UiSliceState) => Partial<UiSliceState>) => void;

export function createUiSlice(set: Set, get: Get): UiSlice {
  const persisted = readPersisted();
  const savePersisted = () => {
    const state = get();
    writePersisted({ density: state.density, columns: state.columns, savedViews: state.savedViews });
  };

  return {
    ...DEFAULT_STATE,
    ...persisted,

    setView: (view) => set(() => ({ view })),
    selectTurn: (selectedTurn) => set(() => ({ selectedTurn })),
    setInspectorTab: (inspectorTab) => set(() => ({ inspectorTab })),

    setDensity: (density) => {
      set(() => ({ density }));
      savePersisted();
    },

    setFilters: (filters) => set(() => ({ filters })),

    setColumns: (columns) => {
      set(() => ({ columns }));
      savePersisted();
    },

    saveView: (view) => {
      set((state) => ({ savedViews: [...state.savedViews.filter((v) => v.name !== view.name), view] }));
      savePersisted();
    },

    removeSavedView: (name) => {
      set((state) => ({ savedViews: state.savedViews.filter((v) => v.name !== name) }));
      savePersisted();
    },

    setFindQuery: (findQuery) => set(() => ({ findQuery })),
  };
}
