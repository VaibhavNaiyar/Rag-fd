"use client";

import { Segmented } from "@/components/ui/Segmented";
import { SkipLink } from "@/components/ui/a11y";
import { ToastProvider } from "@/components/ui/Toast";
import { useTheme, type ThemePreference } from "@/hooks/useTheme";
import { ControlSections } from "./ControlSections";
import { DataSections } from "./DataSections";
import { StateMatrix } from "./StateMatrix";
import { TokenSections } from "./TokenSections";

const CONTENTS = [
  ["colour", "Colour"],
  ["type", "Type"],
  ["space", "Space, radius, elevation"],
  ["buttons", "Buttons"],
  ["badges", "Badges and marks"],
  ["forms", "Form controls"],
  ["tabs", "Tabs"],
  ["overlays", "Layers"],
  ["surfaces", "Panels and alerts"],
  ["table", "Data table"],
  ["metrics", "Readouts and charts"],
  ["code", "JSON and code"],
  ["states", "States"],
] as const;

const THEMES = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const satisfies readonly { value: ThemePreference; label: string }[];

/**
 * The design kit: every token, every primitive and every state, on one page, in both
 * themes. It exists so a view is built from parts that have already been looked at, and
 * so the same page can be measured at every viewport (overflow and accessibility).
 * It is only compiled in when NEXT_PUBLIC_KIT=1; the production export does not have it.
 */
export function KitSections() {
  const { theme, setTheme } = useTheme();

  return (
    <ToastProvider>
      <SkipLink targetId="kit-main" />
      <main id="kit-main" tabIndex={-1} className="mx-auto flex min-w-0 max-w-5xl flex-col gap-8 px-gutter py-6 outline-none">
        <header className="flex min-w-0 flex-col gap-3">
          <h1 className="text-display text-ink">Design kit</h1>
          <p className="max-w-prose text-body text-ink-muted">Tokens, primitives and states for the console. Nothing here is real data.</p>
          <Segmented label="Theme" options={THEMES} value={theme} onValueChange={setTheme} />
          <nav aria-label="Kit sections">
            <ul className="m-0 flex list-none flex-wrap gap-x-4 p-0 text-label">
              {CONTENTS.map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`} className="inline-flex min-h-control items-center text-accent-ink underline underline-offset-2">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </header>

        <TokenSections />
        <ControlSections />
        <DataSections />
        <StateMatrix />
      </main>
    </ToastProvider>
  );
}
