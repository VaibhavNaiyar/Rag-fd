import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const COLOUR = "Colours come from src/styles/tokens.css: use a token class such as bg-surface, or var(--token). Never a literal.";
const HEX = "(?<![\\w&#-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\\w-])";
const COLOUR_FUNCTION = "(?<![\\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\\(";
const COLOUR_PROPERTY =
  "^(?:color|background|backgroundColor|borderColor|borderTopColor|borderRightColor|borderBottomColor|borderLeftColor|outlineColor|fill|stroke|caretColor|accentColor|textDecorationColor|boxShadow|textShadow)$";

/** Flat config. eslint-config-next 16 ships flat configs directly — no FlatCompat. */
const config = [
  { ignores: [".next/**", "out/**", "node_modules/**"] },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // Unused bindings are an error unless deliberately marked with a leading _.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // The token rules (PHASES.md R1). Tests may spell colours out: they assert them.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/**/*.test.{ts,tsx}", "src/test/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: `Literal[value=/${HEX}/]`, message: COLOUR },
        { selector: `TemplateElement[value.raw=/${HEX}/]`, message: COLOUR },
        { selector: `Literal[value=/${COLOUR_FUNCTION}/]`, message: COLOUR },
        { selector: `TemplateElement[value.raw=/${COLOUR_FUNCTION}/]`, message: COLOUR },
        {
          selector: `JSXAttribute[name.name='style'] Property[key.name=/${COLOUR_PROPERTY}/] > Literal[value=/^(?!var\\(--|transparent$|currentColor$|inherit$|none$)/]`,
          message: "An inline colour must be var(--token).",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "tailwindcss/colors", message: "The default palette is not part of this design system. Use a token." }],
          patterns: [{ group: ["tailwindcss/colors/*"], message: "The default palette is not part of this design system. Use a token." }],
        },
      ],
    },
  },
];

export default config;
