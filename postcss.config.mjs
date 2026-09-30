// postcss-import must run first: it inlines the @import lines in globals.css, so
// Tailwind sees the whole stylesheet and can place the @layer blocks in
// base.css, prose.css and legacy.css around its own base, components and utilities.
const config = {
  plugins: { "postcss-import": {}, tailwindcss: {}, autoprefixer: {} },
};
export default config;
