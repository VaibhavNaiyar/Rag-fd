import type { NextConfig } from "next";

/**
 * Static export. `next build` emits a self-contained `out/` directory that the
 * FastAPI backend mounts as its static root, so the whole system stays one
 * container and one `docker compose up` (gate G1).
 */
const nextConfig: NextConfig = {
  output: "export",
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  // The design kit (src/app/kit/page.kit.tsx) is a route only in a build made with
  // NEXT_PUBLIC_KIT=1, so the production export does not contain it.
  pageExtensions: process.env.NEXT_PUBLIC_KIT === "1" ? ["tsx", "ts", "kit.tsx"] : ["tsx", "ts"],
  // A production build is a few seconds cold. Turbopack's on-disk build cache saves little of
  // that and takes hundreds of megabytes in .next/cache, which is not worth it on a full disk
  // or in a container layer. NEXT_BUILD_CACHE=1 turns it back on.
  experimental: { turbopackFileSystemCacheForBuild: process.env.NEXT_BUILD_CACHE === "1" },
  // Next scaffolds agent-instruction markdown files on dev otherwise; this
  // project documents itself in README.md instead.
  agentRules: false,
};

export default nextConfig;
