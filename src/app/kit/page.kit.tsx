import type { Metadata } from "next";
import { KitSections } from "./KitSections";

export const metadata: Metadata = {
  title: "Design kit",
  robots: { index: false, follow: false },
};

/**
 * The kit route. This file is named page.kit.tsx, and next.config.ts counts "kit.tsx"
 * as a page extension only when NEXT_PUBLIC_KIT=1, so `npm run build` has no /kit at all
 * and `npm run build:e2e` makes a separate build that does.
 */
export default function KitPage() {
  return <KitSections />;
}
