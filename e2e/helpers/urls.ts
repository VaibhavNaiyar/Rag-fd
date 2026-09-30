/**
 * The three builds the tests serve side by side (scripts/build-variants.mjs makes them).
 * No Playwright import here: playwright.config.ts uses this too.
 *
 *   app     the console as `npm run build` makes it
 *   legacy  the previous shell, kept behind NEXT_PUBLIC_LEGACY_SHELL until P12
 *   kit     the app plus the /kit design page
 */
export type Variant = "app" | "legacy" | "kit";

export const PORTS: Record<Variant, number> = { app: 4173, legacy: 4174, kit: 4175 };

/** Where each variant's static export lands. */
export const FOLDERS: Record<Variant, string> = { app: "out", legacy: "out-legacy", kit: "out-kit" };

export const VARIANTS = Object.keys(PORTS) as Variant[];

/** An absolute URL on one variant's server, so a spec says which build it is testing. */
export const appUrl = (variant: Variant, path = "/"): string => `http://127.0.0.1:${PORTS[variant]}${path}`;
