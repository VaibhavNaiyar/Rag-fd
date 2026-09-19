/**
 * Where the engine is.
 *
 * Unset env means "same origin": the single-container deployment serves this
 * console from the engine itself. `npm run dev` serves it from :3000 instead,
 * so in development the engine defaults to port 8000 on the same host.
 */
const ENGINE_DEV_PORT = 8000;

function engineOrigin(): { http: string; ws: string } | null {
  if (typeof window === "undefined") return null;
  const { protocol, hostname, host } = window.location;
  const secure = protocol === "https:";
  const where = process.env.NODE_ENV === "development" ? `${hostname}:${ENGINE_DEV_PORT}` : host;
  return { http: `${secure ? "https" : "http"}://${where}`, ws: `${secure ? "wss" : "ws"}://${where}` };
}

/** The AG-UI stream. */
export function streamUrl(): string {
  const configured = process.env.NEXT_PUBLIC_WS_URL;
  if (configured) return configured;
  const origin = engineOrigin();
  return origin ? `${origin.ws}/stream` : "";
}

/** The engine's HTTP API (fixtures, health, traces), derived from the stream's address. */
export function apiUrl(path: string): string {
  const configured = process.env.NEXT_PUBLIC_WS_URL;
  if (configured) {
    const url = new URL(configured);
    url.protocol = url.protocol === "wss:" ? "https:" : "http:";
    url.pathname = path;
    return url.toString();
  }
  const origin = engineOrigin();
  return origin ? `${origin.http}${path}` : path;
}
