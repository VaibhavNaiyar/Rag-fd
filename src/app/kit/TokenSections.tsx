import { Group, Section } from "./Section";

/** Full class names, so Tailwind sees them. Each swatch is a token, never a literal. */
const SWATCHES: { token: string; fill: string }[] = [
  { token: "--canvas", fill: "bg-canvas" },
  { token: "--surface", fill: "bg-surface" },
  { token: "--surface-2", fill: "bg-surface-2" },
  { token: "--surface-3", fill: "bg-surface-3" },
  { token: "--line", fill: "bg-line" },
  { token: "--line-strong", fill: "bg-line-strong" },
  { token: "--line-control", fill: "bg-line-control" },
  { token: "--ink", fill: "bg-ink" },
  { token: "--ink-body", fill: "bg-ink-body" },
  { token: "--ink-muted", fill: "bg-ink-muted" },
  { token: "--accent", fill: "bg-accent" },
  { token: "--accent-hover", fill: "bg-accent-hover" },
  { token: "--accent-press", fill: "bg-accent-press" },
  { token: "--accent-ink", fill: "bg-accent-ink" },
  { token: "--accent-soft", fill: "bg-accent-soft" },
  { token: "--control", fill: "bg-control" },
  { token: "--chrome", fill: "bg-chrome" },
  { token: "--ok", fill: "bg-ok" },
  { token: "--ok-soft", fill: "bg-ok-soft" },
  { token: "--warn", fill: "bg-warn" },
  { token: "--warn-soft", fill: "bg-warn-soft" },
  { token: "--error", fill: "bg-error" },
  { token: "--error-soft", fill: "bg-error-soft" },
];

/** Token pairs that are used together, drawn as they are used. Their contrast is proved in tokens.contrast.json. */
const PAIRS: { name: string; box: string }[] = [
  { name: "on-accent on accent", box: "bg-accent text-on-accent" },
  { name: "on-control on control", box: "bg-control text-on-control" },
  { name: "on-chrome on chrome", box: "bg-chrome text-on-chrome" },
  { name: "accent-ink on accent-soft", box: "border border-accent-edge bg-accent-soft text-accent-ink" },
  { name: "ok-ink on ok-soft", box: "border border-ok-edge bg-ok-soft text-ok-ink" },
  { name: "warn-ink on warn-soft", box: "border border-warn-edge bg-warn-soft text-warn-ink" },
  { name: "error-ink on error-soft", box: "border border-error-edge bg-error-soft text-error-ink" },
  { name: "ink-muted on surface-2", box: "bg-surface-2 text-ink-muted" },
];

const SPACES = [
  { name: "space-1 · 4", bar: "w-1" },
  { name: "space-2 · 8", bar: "w-2" },
  { name: "space-3 · 12", bar: "w-3" },
  { name: "space-4 · 16", bar: "w-4" },
  { name: "space-6 · 24", bar: "w-6" },
  { name: "space-8 · 32", bar: "w-8" },
  { name: "space-12 · 48", bar: "w-12" },
];

const TYPES = [
  { name: "caption 12/16", cls: "text-caption" },
  { name: "label 13/18", cls: "text-label" },
  { name: "body 14/20", cls: "text-body" },
  { name: "heading 16/24", cls: "text-heading" },
  { name: "title 20/28", cls: "text-title" },
  { name: "display 24/32", cls: "text-display" },
];

const RADII = [
  { name: "radius-0 · 0", cls: "rounded-none" },
  { name: "radius-1 · 2", cls: "rounded-1" },
  { name: "radius-2 · 4", cls: "rounded-2" },
  { name: "radius-3 · 6", cls: "rounded-3" },
];

export function TokenSections() {
  return (
    <>
      <Section id="colour" title="Colour" note="Every colour is a token. The pairs below are the ones used together; their contrast is checked in tokens.contrast.json.">
        <Group title="Semantic tokens">
          <ul className="m-0 grid list-none grid-cols-1 gap-x-4 gap-y-2 p-0 sm:grid-cols-2">
            {SWATCHES.map((swatch) => (
              <li key={swatch.token} className="flex min-w-0 items-center gap-2">
                <span aria-hidden className={`size-5 shrink-0 rounded-1 border border-line-strong ${swatch.fill}`} />
                <code className="min-w-0 break-words font-mono text-caption text-ink-body">{swatch.token}</code>
              </li>
            ))}
          </ul>
        </Group>
        <Group title="Pairs, as used">
          <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
            {PAIRS.map((pair) => (
              <li key={pair.name} className={`min-w-0 break-words rounded-2 px-3 py-2 text-label ${pair.box}`}>
                {pair.name}
              </li>
            ))}
          </ul>
        </Group>
      </Section>

      <Section id="type" title="Type" note="Inter for the interface, JetBrains Mono for ids, times and code. 12 px is the smallest size used for anything read.">
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {TYPES.map((sample) => (
            <li key={sample.name} className="min-w-0">
              <span className={`${sample.cls} block break-words text-ink`}>Retrieval starts before the utterance ends</span>
              <span className="font-mono text-caption text-ink-muted">{sample.name}</span>
            </li>
          ))}
          <li className="min-w-0">
            <span className="block break-words font-mono text-label text-ink">t3_v2_c1 · 1,240 ms · Doc_11 §0</span>
            <span className="font-mono text-caption text-ink-muted">mono 13/18, tabular</span>
          </li>
        </ul>
      </Section>

      <Section id="space" title="Space, radius, elevation" note="A 4 px grid. Radii stop at 6 px. Elevation is for layers that float, and nothing else.">
        <Group title="Space">
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {SPACES.map((space) => (
              <li key={space.name} className="flex min-w-0 items-center gap-3">
                <span aria-hidden className={`h-3 shrink-0 bg-accent-ink ${space.bar}`} />
                <span className="font-mono text-caption text-ink-muted">{space.name}</span>
              </li>
            ))}
          </ul>
        </Group>
        <Group title="Radius">
          <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
            {RADII.map((radius) => (
              <li key={radius.name} className="flex min-w-0 items-center gap-2">
                <span aria-hidden className={`size-8 shrink-0 border border-line-control bg-surface-2 ${radius.cls}`} />
                <span className="font-mono text-caption text-ink-muted">{radius.name}</span>
              </li>
            ))}
          </ul>
        </Group>
        <Group title="Elevation (floating layers only)">
          <div className="flex flex-wrap gap-4">
            <div className="rounded-2 bg-surface px-3 py-2 text-label shadow-float">shadow-float: menu, tooltip, popover</div>
            <div className="rounded-2 bg-surface px-3 py-2 text-label shadow-overlay">shadow-overlay: sheet, palette</div>
          </div>
        </Group>
      </Section>
    </>
  );
}
