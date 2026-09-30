import { defineWorkspace } from "vitest/config";

/** Two projects: pure logic in Node, components and hooks in jsdom. */
export default defineWorkspace([
  {
    extends: "./vitest.config.ts",
    test: { name: "node", environment: "node", include: ["src/**/*.test.ts"] },
  },
  {
    extends: "./vitest.config.ts",
    test: {
      name: "dom",
      environment: "jsdom",
      include: ["src/**/*.dom.test.tsx"],
      setupFiles: ["src/test/setup.ts"],
    },
  },
]);
