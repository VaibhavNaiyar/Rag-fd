import type { NextConfig } from "next";

/**
 * Static export. `next build` emits a self-contained `out/` directory that the
 * FastAPI backend mounts as its static root, so the whole system stays one
 * container and one `docker compose up` (gate G1).
 */
const nextConfig: NextConfig = {
  output: "export",
  distDir: ".next",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  // Next scaffolds agent-instruction markdown files on dev otherwise; this
  // project documents itself in README.md instead.
  agentRules: false,
};

export default nextConfig;
