import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { HydrationMarker } from "@/components/shell/HydrationMarker";
import { ThemeColorSync } from "@/components/shell/ThemeColorSync";
import "@/styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Streaming Live RAG",
  description:
    "Full-duplex retrieval console: retrieval starts before the utterance ends, compound requests decompose, and late detail refines the answer instead of restarting it.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the page reach under notches; base.css pads the body by the safe-area insets.
  viewportFit: "cover",
  colorScheme: "light dark",
  // No themeColor here: it would have to be a colour literal. ThemeColorSync sets the
  // meta tag from the --chrome token instead.
};

/**
 * Runs before first paint and applies the stored theme choice, so a reader who
 * chose dark (or "system") never sees a flash of the light default. Mirrors
 * useTheme.ts: "dark" sets the attribute, "system" removes it, anything else is light.
 */
const THEME_BOOT = `(function(){var r=document.documentElement;try{var t=window.localStorage.getItem("slr.theme");if(t==="dark")r.setAttribute("data-theme","dark");else if(t==="system")r.removeAttribute("data-theme");else r.setAttribute("data-theme","light")}catch(e){r.setAttribute("data-theme","light")}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="bg-canvas text-ink-body">
        <ThemeColorSync />
        <HydrationMarker />
        {children}
      </body>
    </html>
  );
}
