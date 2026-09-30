import { formatRoute, parseRoute, type Route, type View } from "@/lib/route";
import type { SelectedTurn, UiSliceState } from "@/store/uiSlice";

/**
 * Two-way binding between `uiSlice` and the hash route (P5-F12). Components
 * never touch `window.location` — they call a `uiSlice` setter (`selectTurn`,
 * `setView`, `setFilters`, `setInspectorTab`) and this module is the only thing
 * that turns that into an address, and the only thing that turns an address
 * change (a paste, Back/Forward) into store updates.
 *
 * No echo loops: each direction only writes when the value it is about to write
 * actually differs from what is already there. That alone is not sufficient,
 * though — the store's `subscribe` fires on *every* state change, not just
 * `uiSlice`'s route-shaped fields, and a caller (`AppFrame`'s own
 * `navigateTo`) can still write `location.hash` directly, outside this module.
 * Between that write and the `hashchange` task that will eventually update
 * `uiSlice.selectedTurn` to match, an unrelated store update (a trace
 * finishing loading, a health poll) fires this `subscribe` callback with
 * `uiSlice` still holding its *old* route — and the old route no longer
 * matches the hash that was just written. Comparing the freshly computed
 * route only against `lastRoute` (the last route this module itself is aware
 * of, from either direction), never against "whatever the hash happens to say
 * right now", is what keeps that stale read from overwriting a change this
 * module did not make yet.
 */

type StoreFields = Pick<UiSliceState, "view" | "selectedTurn" | "inspectorTab" | "filters">;

export interface UrlSyncStore {
  getState: () => StoreFields;
  subscribe: (listener: (state: StoreFields) => void) => () => void;
  setView: (view: View) => void;
  selectTurn: (turn: SelectedTurn | null) => void;
  setInspectorTab: (tab: string | null) => void;
  setFilters: (filters: string) => void;
}

function routeFromState(state: StoreFields): Route {
  if (state.selectedTurn) return { kind: "inspect", sessionId: state.selectedTurn.sessionId, turnId: state.selectedTurn.turnId, tab: state.inspectorTab };
  return { kind: "view", view: state.view, q: state.view === "traces" ? state.filters : "", sort: null };
}

function routesEqual(a: Route, b: Route): boolean {
  return formatRoute(a) === formatRoute(b);
}

/** Real navigation (a different view, a different turn) gets a history entry; a same-place detail change (typing a filter, switching an Inspector tab) replaces it — otherwise every keystroke would be its own Back stop. */
function isNavigation(from: Route, to: Route): boolean {
  if (from.kind !== to.kind) return true;
  if (to.kind === "inspect") return from.kind !== "inspect" || from.sessionId !== to.sessionId || from.turnId !== to.turnId;
  return from.kind === "view" && from.view !== to.view;
}

function applyRouteToStore(route: Route, store: UrlSyncStore): void {
  const state = store.getState();
  if (route.kind === "inspect") {
    const current = state.selectedTurn;
    if (current?.sessionId !== route.sessionId || current?.turnId !== route.turnId) {
      store.selectTurn({ sessionId: route.sessionId, turnId: route.turnId });
    }
    if (state.inspectorTab !== route.tab) store.setInspectorTab(route.tab);
    return;
  }
  if (state.view !== route.view) store.setView(route.view);
  if (state.selectedTurn !== null) store.selectTurn(null);
  const wantedFilters = route.view === "traces" ? route.q : state.filters;
  if (route.view === "traces" && state.filters !== wantedFilters) store.setFilters(wantedFilters);
}

/** Wires the binding up and returns a cleanup function. Call once, client-side only. */
export function bindUrlSync(store: UrlSyncStore, win: Window = window): () => void {
  let lastRoute = parseRoute(win.location.hash);

  // The address bar wins on load — a shared or reloaded link restores exactly what it named.
  applyRouteToStore(lastRoute, store);

  const onHashChange = () => {
    const route = parseRoute(win.location.hash);
    lastRoute = route;
    applyRouteToStore(route, store);
  };
  win.addEventListener("hashchange", onHashChange);

  const unsubscribe = store.subscribe((state) => {
    const route = routeFromState(state);
    // Not "does this match the hash right now" — the hash may already have moved on from a
    // direct `navigateTo` call whose `hashchange` has not run yet. Only a route this module has
    // not already accounted for (from either direction) is a real change to propagate.
    if (routesEqual(route, lastRoute)) return;
    const address = formatRoute(route);
    if (isNavigation(lastRoute, route)) win.location.hash = address;
    else win.location.replace(address);
    lastRoute = route;
  });

  return () => {
    win.removeEventListener("hashchange", onHashChange);
    unsubscribe();
  };
}
