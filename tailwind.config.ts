import type { Config } from "tailwindcss";
import { tailwindScreens } from "./src/lib/breakpoints";

/**
 * Tailwind reads design tokens; it never defines them. Every colour, radius,
 * shadow, type size and duration below is a `var(--token)` from
 * `src/styles/tokens.css`, so the theme switch is one attribute on <html> and
 * there is exactly one place to audit for contrast.
 *
 * The palette is REPLACED, not extended. Tailwind's own blue, slate, white,
 * black and the rest do not exist here, so `bg-blue-500` compiles to nothing
 * (and `npm run check:tokens` rejects it). The same goes for radius, shadow and
 * type size. Anything marked "legacy" keeps the components that are still to be
 * replaced rendering; it is deleted in P12-F05 (see PHASES.md).
 */
const token = (name: string) => `var(--${name})`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  corePlugins: {
    // No gradients: `from-*`, `via-*` and `to-*` are off, and `backgroundImage`
    // below is empty, so `bg-gradient-to-*` does not exist either.
    gradientColorStops: false,
    // Focus is an outline (base.css), never a box-shadow ring. Switching the ring
    // utilities off also keeps Tailwind's default ring colours out of the CSS.
    ringWidth: false,
    ringColor: false,
    ringOpacity: false,
    ringOffsetWidth: false,
    ringOffsetColor: false,
  },
  theme: {
    // sm 480 · md 768 · lg 1024 · xl 1280 · 2xl 1536, from src/lib/breakpoints.ts.
    screens: tailwindScreens(),

    colors: {
      transparent: "transparent",
      current: "currentColor",
      inherit: "inherit",

      canvas: token("canvas"),
      surface: { DEFAULT: token("surface"), 2: token("surface-2"), 3: token("surface-3") },
      line: { DEFAULT: token("line"), strong: token("line-strong"), control: token("line-control") },
      ink: { DEFAULT: token("ink"), body: token("ink-body"), muted: token("ink-muted") },

      accent: {
        DEFAULT: token("accent"),
        hover: token("accent-hover"),
        press: token("accent-press"),
        ink: token("accent-ink"),
        soft: token("accent-soft"),
        edge: token("accent-edge"),
      },
      "on-accent": token("on-accent"),
      focus: { DEFAULT: token("focus-ring"), chrome: token("focus-on-chrome") },

      control: { DEFAULT: token("control"), hover: token("control-hover"), press: token("control-press") },
      "on-control": token("on-control"),
      chrome: { DEFAULT: token("chrome"), hover: token("chrome-hover"), line: token("chrome-line") },
      "on-chrome": { DEFAULT: token("on-chrome"), muted: token("on-chrome-muted") },

      ok: { DEFAULT: token("ok"), ink: token("ok-ink"), soft: token("ok-soft"), edge: token("ok-edge") },
      warn: { DEFAULT: token("warn"), ink: token("warn-ink"), soft: token("warn-soft"), edge: token("warn-edge") },
      error: {
        DEFAULT: token("error"),
        ink: token("error-ink"),
        soft: token("error-soft"),
        edge: token("error-edge"),
      },

      state: {
        wait: token("state-wait"),
        retrieve: token("state-retrieve"),
        refine: token("state-refine"),
        suppress: token("state-suppress"),
      },
      span: {
        listen: token("span-listen"),
        plan: token("span-plan"),
        retrieve: token("span-retrieve"),
        synthesise: token("span-synthesise"),
        cancel: token("span-cancel"),
      },
      diff: { added: token("diff-added"), removed: token("diff-removed"), rewritten: token("diff-rewritten") },
      scrim: token("scrim"),

      // Legacy colour names. Mapped straight to the semantic tokens (not to the
      // legacy CSS aliases), so they survive the alias block being deleted first.
      brand: token("ink"),
      primary: {
        DEFAULT: token("accent"),
        ink: token("accent-ink"),
        dark: token("accent-ink"),
        soft: token("accent-soft"),
      },
      sunken: token("surface-2"),
      raised: token("surface"),
      edge: {
        primary: token("accent-edge"),
        brand: token("line-strong"),
        ok: token("ok-edge"),
        warn: token("warn-edge"),
        error: token("error-edge"),
      },
    },

    // The bare `border` utility would otherwise fall back to a literal grey.
    borderColor: ({ theme }) => ({ ...theme("colors"), DEFAULT: token("line") }),
    // Legacy: `text-error` was used for words. The mark colour is 4.48:1 on the
    // canvas, so as text it resolves to the ink colour; `bg-error` keeps the mark.
    textColor: ({ theme }) => ({
      ...theme("colors"),
      error: {
        DEFAULT: token("error-ink"),
        ink: token("error-ink"),
        soft: token("error-soft"),
        edge: token("error-edge"),
      },
    }),

    fontFamily: {
      sans: [token("font-ui")],
      mono: [token("font-mono")],
    },
    // 12 px is the smallest size used for anything a reader has to read.
    fontSize: {
      caption: [token("text-caption"), { lineHeight: token("leading-caption") }],
      label: [token("text-label"), { lineHeight: token("leading-label"), fontWeight: token("weight-medium") }],
      body: [token("text-body"), { lineHeight: token("leading-body") }],
      heading: [token("text-heading"), { lineHeight: token("leading-heading"), fontWeight: token("weight-semibold") }],
      title: [token("text-title"), { lineHeight: token("leading-title"), fontWeight: token("weight-semibold") }],
      display: [token("text-display"), { lineHeight: token("leading-display"), fontWeight: token("weight-semibold") }],
      // Legacy.
      trace: [token("text-caption"), { lineHeight: token("leading-label") }],
    },

    // Nothing rounder than 6px. `full` is for the status dot and the spinner only.
    borderRadius: {
      none: "0px",
      1: token("radius-1"),
      2: token("radius-2"),
      3: token("radius-3"),
      full: "9999px",
      // Legacy.
      DEFAULT: token("radius-2"),
      sm: token("radius-1"),
      md: token("radius-2"),
      lg: token("radius-3"),
      pill: token("radius-2"),
    },

    // Elevation is for layers that float above the page, and nothing else.
    boxShadow: {
      none: "none",
      float: token("shadow-float"),
      overlay: token("shadow-overlay"),
      // Legacy.
      DEFAULT: token("shadow-float"),
      card: "none",
      lift: token("shadow-float"),
    },

    backgroundImage: {},

    // Keyframes are limited to the two motions the design allows.
    keyframes: {
      spin: { to: { transform: "rotate(360deg)" } },
      "sheet-in": {
        from: { transform: "var(--sheet-from, translateX(100%))" },
        to: { transform: "none" },
      },
    },
    animation: {
      none: "none",
      spin: "spin 1s linear infinite",
      "sheet-in": "sheet-in var(--dur-2) var(--ease-standard) both",
    },

    extend: {
      // Control, layout and safe-area measures (tokens.css, section 3). Adding them to
      // `spacing` gives h-control, min-h-hit, w-nav, px-gutter, pt-safe-top and so on.
      // Coarse pointers get 44px controls from the tokens themselves.
      spacing: {
        "control-sm": token("control-h-sm"),
        control: token("control-h-md"),
        row: token("row-h"),
        "row-compact": token("row-h-compact"),
        hit: token("hit-min"),
        topbar: token("topbar-h"),
        nav: token("nav-w"),
        status: token("status-h"),
        tabbar: token("tabbar-h"),
        gutter: token("gutter"),
        "safe-top": token("safe-top"),
        "safe-right": token("safe-right"),
        "safe-bottom": token("safe-bottom"),
        "safe-left": token("safe-left"),
      },
      width: { inspector: token("inspector-w") },
      minWidth: { inspector: token("inspector-min") },
      maxWidth: { console: token("console-max"), inspector: token("inspector-max") },
      zIndex: {
        base: token("z-base"),
        sticky: token("z-sticky"),
        chrome: token("z-chrome"),
        sheet: token("z-sheet"),
        popover: token("z-popover"),
        toast: token("z-toast"),
        palette: token("z-palette"),
      },
      transitionDuration: {
        1: token("dur-1"),
        2: token("dur-2"),
      },
      transitionTimingFunction: {
        standard: token("ease-standard"),
        // Legacy.
        oneui: token("ease-standard"),
      },
    },
  },
  plugins: [],
};

export default config;
