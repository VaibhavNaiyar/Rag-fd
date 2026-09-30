/**
 * Hash routes (PHASES.md §3.6). The console is a static export, so the address of a
 * view lives after the `#`:
 *
 *   #/console
 *   #/traces?q=<filter>&sort=<column>
 *   #/metrics
 *   #/inspect/<sessionId>/<turnId>?tab=<lens>
 *
 * `parseRoute` and `formatRoute` are total: any string is a route (an unknown one is
 * the console), and a route always formats to an address that parses back to itself.
 * A view route keeps a filter and a sort only where the view has them (Traces).
 */

export type View = "console" | "traces" | "metrics";

export const VIEWS: readonly View[] = ["console", "traces", "metrics"];

export type Route =
  | { kind: "view"; view: View; q: string; sort: string | null }
  | { kind: "inspect"; sessionId: string; turnId: string; tab: string | null };

export const DEFAULT_ROUTE: Route = { kind: "view", view: "console", q: "", sort: null };

const isView = (value: string): value is View => (VIEWS as readonly string[]).includes(value);

function decode(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/** Reads a hash such as `#/traces?q=error`. Anything it does not understand is the console. */
export function parseRoute(hash: string): Route {
  const trimmed = hash.replace(/^#/, "").replace(/^\//, "");
  const at = trimmed.indexOf("?");
  const path = at < 0 ? trimmed : trimmed.slice(0, at);
  const query = new URLSearchParams(at < 0 ? "" : trimmed.slice(at + 1));
  const segments = path.split("/").map(decode);
  if (segments.some((segment) => segment === null)) return DEFAULT_ROUTE;
  const [first, second, third, ...rest] = segments as string[];

  if (first === "inspect" && second && third && rest.length === 0) {
    return { kind: "inspect", sessionId: second, turnId: third, tab: query.get("tab") || null };
  }
  if (first !== undefined && isView(first) && second === undefined) {
    return first === "traces" ? { kind: "view", view: first, q: query.get("q") ?? "", sort: query.get("sort") || null } : { kind: "view", view: first, q: "", sort: null };
  }
  return DEFAULT_ROUTE;
}

/** The address for a route, beginning `#/`. */
export function formatRoute(route: Route): string {
  if (route.kind === "inspect") {
    const query = new URLSearchParams();
    if (route.tab) query.set("tab", route.tab);
    const suffix = query.toString();
    return `#/inspect/${encodeURIComponent(route.sessionId)}/${encodeURIComponent(route.turnId)}${suffix ? `?${suffix}` : ""}`;
  }
  const query = new URLSearchParams();
  if (route.view === "traces") {
    if (route.q) query.set("q", route.q);
    if (route.sort) query.set("sort", route.sort);
  }
  const suffix = query.toString();
  return `#/${route.view}${suffix ? `?${suffix}` : ""}`;
}

/** The route that shows a view with nothing else in it. */
export const viewRoute = (view: View): Route => ({ kind: "view", view, q: "", sort: null });

/** The route as `formatRoute(parseRoute(...))` would leave it: what a stored or typed route means. */
export const normalizeRoute = (route: Route): Route => parseRoute(formatRoute(route));
