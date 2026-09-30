import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Shared by the two projects declared in vitest.workspace.ts: `node` runs the pure
 * layer (chunking, the reducer, selectors, the token contract), `dom` runs
 * components and hooks in jsdom.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
