import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Unit tests cover the pure layer only: chunking, the reducer and selectors. */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
