import type { Config } from "tailwindcss";

/**
 * Tailwind reads design tokens; it never defines them. Every literal colour and
 * font lives in `src/styles/tokens.css`, so the theme switch is one attribute
 * on <html> and there is exactly one place to audit for contrast.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: "var(--sam-blue)",
        primary: {
          DEFAULT: "var(--ui-primary)",
          ink: "var(--ui-primary-ink)",
          dark: "var(--ui-primary-dark)",
          soft: "var(--ui-primary-soft)",
        },
        canvas: "var(--canvas)",
        surface: "var(--surface)",
        sunken: "var(--sunken)",
        raised: "var(--raised)",
        line: "var(--border)",
        edge: {
          primary: "var(--edge-primary)",
          brand: "var(--edge-brand)",
          ok: "var(--edge-ok)",
          warn: "var(--edge-warn)",
          error: "var(--edge-error)",
        },
        ink: {
          DEFAULT: "var(--ink)",
          body: "var(--ink-body)",
          muted: "var(--ink-muted)",
        },
        ok: "var(--ok)",
        "ok-soft": "var(--ok-soft)",
        warn: "var(--warn)",
        "warn-ink": "var(--warn-ink)",
        "warn-soft": "var(--warn-soft)",
        error: "var(--error)",
        "error-soft": "var(--error-soft)",
      },
      fontFamily: {
        sans: ["var(--font-ui)"],
        mono: ["var(--font-mono)"],
      },
      fontSize: {
        display: ["28px", { lineHeight: "36px", fontWeight: "600" }],
        title: ["20px", { lineHeight: "28px", fontWeight: "600" }],
        body: ["15px", { lineHeight: "24px" }],
        label: ["13px", { lineHeight: "18px", fontWeight: "500" }],
        caption: ["12px", { lineHeight: "16px" }],
        trace: ["12px", { lineHeight: "18px" }],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        lift: "var(--shadow-lift)",
      },
      transitionTimingFunction: {
        oneui: "cubic-bezier(.2, .8, .2, 1)",
      },
      keyframes: {
        "marker-in": {
          "0%": { opacity: "0", transform: "scale(.6)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "pulse-ring": {
          "0%": { opacity: ".55", transform: "scale(.7)" },
          "100%": { opacity: "0", transform: "scale(2.6)" },
        },
        "rise-in": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "message-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 50%" },
          "100%": { backgroundPosition: "-200% 50%" },
        },
        "flash-update": {
          "0%,100%": { backgroundColor: "transparent" },
          "35%": { backgroundColor: "var(--ui-primary-soft)" },
        },
      },
      animation: {
        "marker-in": "marker-in 240ms cubic-bezier(.2,.8,.2,1) both",
        "pulse-ring": "pulse-ring 900ms cubic-bezier(.2,.8,.2,1) 2",
        "rise-in": "rise-in 140ms cubic-bezier(.2,.8,.2,1) both",
        "message-in": "message-in 180ms cubic-bezier(.2,.8,.2,1) both",
        shimmer: "shimmer 1800ms linear infinite",
        "flash-update": "flash-update 900ms ease-out 1",
      },
    },
  },
  plugins: [],
};

export default config;
