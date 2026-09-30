import { AppFrame } from "@/components/shell/AppFrame";
import { AppShell } from "@/components/shell/AppShell";

/**
 * The new frame is the console. The previous three-column shell is kept, behind
 * NEXT_PUBLIC_LEGACY_SHELL=1 (`npm run dev:legacy`, `npm run build:legacy`), until it is
 * deleted with the rest of the old code in P12. The flag is read at build time, so a
 * build contains one or the other.
 */
export default function Page() {
  return process.env.NEXT_PUBLIC_LEGACY_SHELL === "1" ? <AppShell /> : <AppFrame />;
}
