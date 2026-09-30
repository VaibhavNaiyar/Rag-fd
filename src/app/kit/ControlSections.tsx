"use client";

import { Download, Filter, PanelRight, Play, RefreshCw, Settings } from "lucide-react";
import { useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { CopyButton } from "@/components/ui/CopyButton";
import { Divider } from "@/components/ui/Divider";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Input } from "@/components/ui/Input";
import { Kbd } from "@/components/ui/Kbd";
import { Menu } from "@/components/ui/Menu";
import { Panel } from "@/components/ui/Panel";
import { Popover } from "@/components/ui/Popover";
import { Segmented } from "@/components/ui/Segmented";
import { Select } from "@/components/ui/Select";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
import { StatusDot } from "@/components/ui/StatusDot";
import { Switch } from "@/components/ui/Switch";
import { TabPanel, Tabs, type TabItem } from "@/components/ui/Tabs";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { Tooltip } from "@/components/ui/Tooltip";
import { LONG_LABEL, SIXTY } from "./kitData";
import { Group, Section } from "./Section";

const SIX_TABS: TabItem[] = [
  { id: "overview", label: "Overview" },
  { id: "timeline", label: "Timeline", count: 6 },
  { id: "evidence", label: "Evidence", count: 8 },
  { id: "answer", label: "Answer" },
  { id: "raw", label: "Raw record" },
  { id: "diff", label: "Answer diff" },
];

const DENSITIES = [
  { value: "compact", label: "Compact" },
  { value: "default", label: "Default" },
  { value: "touch", label: "Touch" },
] as const;

export function ControlSections() {
  const { toast } = useToast();
  const [tab, setTab] = useState("overview");
  const [density, setDensity] = useState<(typeof DENSITIES)[number]["value"]>("default");
  const [live, setLive] = useState(true);
  const [all, setAll] = useState(false);
  const [notes, setNotes] = useState("");
  const [rightOpen, setRightOpen] = useState(false);
  const [bottomOpen, setBottomOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tabValue, setTabValue] = useState("timeline");
  const filters = useRef<HTMLButtonElement>(null);

  return (
    <>
      <Section id="buttons" title="Buttons" note="One primary action per view. Controls are 32 px (28 px small) and 44 px on a touch screen.">
        <Group title="Variants and sizes">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary">Primary</Button>
            <Button variant="neutral">Neutral</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="primary" size="sm">
              Small
            </Button>
            <Button variant="secondary" size="sm">
              Small
            </Button>
          </div>
        </Group>
        <Group title="States">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" icon={<Play size={14} />}>
              With icon
            </Button>
            <Button variant="primary" loading>
              Loading
            </Button>
            <Button variant="secondary" disabled>
              Disabled
            </Button>
          </div>
        </Group>
        <Group title="Icon buttons">
          <div className="flex flex-wrap items-center gap-2">
            <IconButton label="Refresh" icon={<RefreshCw size={16} />} />
            <IconButton label="Inspector" icon={<PanelRight size={16} />} pressed />
            <IconButton label="Settings" icon={<Settings size={16} />} size="sm" />
            <IconButton label="Download" icon={<Download size={16} />} disabled />
            <span data-surface="chrome" className="inline-flex items-center gap-1 rounded-2 bg-chrome p-1">
              <IconButton label="Refresh on chrome" icon={<RefreshCw size={16} />} surface="chrome" />
              <IconButton label="Inspector on chrome" icon={<PanelRight size={16} />} surface="chrome" pressed />
            </span>
            <CopyButton value="s_kit_0001" label="Copy session id" />
            <CopyButton value="s_kit_0001" label="Copy" variant="text" />
          </div>
        </Group>
      </Section>

      <Section id="badges" title="Badges, marks and keys" note="Words carry the meaning; colour and shape reinforce it.">
        <Group title="Tones">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Neutral</Badge>
            <Badge tone="accent">Accent</Badge>
            <Badge tone="ok">Healthy</Badge>
            <Badge tone="warn">Degraded</Badge>
            <Badge tone="error">Failed</Badge>
            <Badge mono>t3_v2_c1</Badge>
            <Badge tone="accent" glyph={<StatusDot decorative shape="filled" tone="retrieve" />}>
              Retrieve
            </Badge>
          </div>
        </Group>
        <Group title="Long labels: cut off with the full text in a tooltip, or wrapped">
          <div className="flex min-w-0 flex-col items-start gap-2">
            <Badge>{SIXTY}</Badge>
            <Badge>{LONG_LABEL}</Badge>
            <Badge wrap tone="warn">
              {LONG_LABEL}
            </Badge>
          </div>
        </Group>
        <Group title="Decision marks: shape as well as colour">
          <ul className="m-0 flex list-none flex-wrap gap-4 p-0 text-label text-ink-body">
            <li className="flex items-center gap-2">
              <StatusDot shape="ring" tone="wait" label="Wait" /> Wait
            </li>
            <li className="flex items-center gap-2">
              <StatusDot shape="filled" tone="retrieve" label="Retrieve" /> Retrieve
            </li>
            <li className="flex items-center gap-2">
              <StatusDot shape="diamond" tone="refine" label="Refine" /> Refine
            </li>
            <li className="flex items-center gap-2">
              <StatusDot shape="barred" tone="suppress" label="Suppress" /> Suppress
            </li>
          </ul>
        </Group>
        <Group title="Shortcut hints (both platforms)">
          <div className="flex flex-wrap items-center gap-4 text-label text-ink-body">
            <span className="flex items-center gap-2">
              Mac <Kbd keys={["mod", "K"]} platform="apple" />
            </span>
            <span className="flex items-center gap-2">
              Windows and Linux <Kbd keys={["mod", "K"]} platform="other" />
            </span>
            <span className="flex items-center gap-2">
              Close <Kbd keys={["esc"]} />
            </span>
          </div>
        </Group>
      </Section>

      <Section id="forms" title="Form controls" note="Labels, descriptions and errors are wired by id. Boundaries reach 3:1.">
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Session name" description="Shown in the top bar">
            <Input placeholder="Untitled session" />
          </Field>
          <Field label="Replay speed" error="Enter a number between 0.5 and 2" required>
            <Input defaultValue="4" inputMode="decimal" />
          </Field>
          <Field label="Corpus">
            <Select defaultValue="enterprise">
              <option value="enterprise">Enterprise</option>
              <option value="asqa">ASQA</option>
            </Select>
          </Field>
          <Field label="Notes" description="Grows with what you type, up to eight lines">
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Type a few lines" />
          </Field>
        </div>
        <Group title="Choices">
          <div className="flex min-w-0 flex-col items-start gap-1">
            <Switch label="Live updates" description="Follow the stream as it arrives" checked={live} onCheckedChange={setLive} />
            <Checkbox label="Select every turn" checked={all} indeterminate={false} onCheckedChange={setAll} />
            <Checkbox label="Some turns selected" checked={false} indeterminate onCheckedChange={() => undefined} />
            <Segmented label="Density" options={DENSITIES} value={density} onValueChange={setDensity} />
          </div>
        </Group>
      </Section>

      <Section id="tabs" title="Tabs" note="Tabs that do not fit move into a More menu. Nothing scrolls sideways.">
        <Group title="Underline, five sections">
          <Tabs label="Inspector sections" items={SIX_TABS.slice(0, 5)} value={tab} onValueChange={setTab} idPrefix="kit-a" />
          {SIX_TABS.slice(0, 5).map((item) => (
            <TabPanel key={item.id} idPrefix="kit-a" tabId={item.id} active={item.id === tab} className="pt-3 text-body text-ink-body">
              Content of {item.label}.
            </TabPanel>
          ))}
        </Group>
        <Group title="Six tabs: at 375 px the last ones move into More">
          <Tabs label="Six sections" items={SIX_TABS} value={tabValue} onValueChange={setTabValue} idPrefix="kit-b" />
          {SIX_TABS.map((item) => (
            <TabPanel key={item.id} idPrefix="kit-b" tabId={item.id} active={item.id === tabValue} className="pt-3 text-body text-ink-body">
              Content of {item.label}.
            </TabPanel>
          ))}
        </Group>
        <Group title="Segmented tabs">
          <Tabs label="Lens" variant="segmented" items={SIX_TABS.slice(0, 3)} value={tab} onValueChange={setTab} idPrefix="kit-c" controls={false} />
        </Group>
      </Section>

      <Section id="overlays" title="Tooltips, menus, popovers, sheets, toasts" note="Layers render in one root, close top-first with Escape, and are clamped to the viewport.">
        <Group title="Tooltip (hover or focus; Escape dismisses)">
          <div className="flex flex-wrap items-center gap-3">
            <Tooltip label="Copies the citation marker to the clipboard">
              <Button variant="secondary">Hover or focus me</Button>
            </Tooltip>
            <Badge tooltip="A per-sub-query quota capped how much any one intent could contribute" tone="accent">
              quota applied
            </Badge>
          </div>
        </Group>
        <Group title="Menu and popover">
          <div className="flex flex-wrap items-center gap-3">
            <Menu
              label="Turn actions"
              items={[
                { id: "open", label: "Open in inspector", shortcut: ["enter"], onSelect: () => toast({ message: "Opened in the inspector", tone: "info" }) },
                { id: "copy", label: "Copy turn id", onSelect: () => toast({ message: "Turn id copied", tone: "ok" }) },
                { id: "sep", type: "separator" },
                { id: "delete", label: "Delete turn", danger: true, onSelect: () => toast({ title: "Not deleted", message: "This is a demonstration", tone: "warn" }) },
              ]}
              trigger={(props) => (
                <Button {...props} variant="secondary">
                  Actions
                </Button>
              )}
            />
            <Button ref={filters} variant="secondary" icon={<Filter size={14} />} aria-expanded={filtersOpen} onClick={() => setFiltersOpen((open) => !open)}>
              Filters
            </Button>
            <Popover open={filtersOpen} onOpenChange={setFiltersOpen} anchorRef={filters} label="Filters" className="w-72 max-w-full p-3">
              <Field label="Status">
                <Select defaultValue="all">
                  <option value="all">All</option>
                  <option value="error">Error</option>
                </Select>
              </Field>
              <div className="mt-3 flex justify-end">
                <Button variant="primary" size="sm" onClick={() => setFiltersOpen(false)}>
                  Apply
                </Button>
              </div>
            </Popover>
          </div>
        </Group>
        <Group title="Layers at the edge of the screen: they open inward and stay on screen">
          <div className="flex justify-end gap-3">
            <Menu
              label="Edge actions"
              items={[
                { id: "one", label: "A menu item with a fairly long label that needs the room", onSelect: () => undefined },
                { id: "two", label: "Another item", onSelect: () => undefined },
              ]}
              trigger={(props) => (
                <Button {...props} variant="secondary">
                  Edge menu
                </Button>
              )}
            />
          </div>
        </Group>
        <Group title="Sheets">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={() => setRightOpen(true)}>
              Open right sheet
            </Button>
            <Button variant="secondary" onClick={() => setBottomOpen(true)}>
              Open bottom sheet
            </Button>
          </div>
          <Sheet open={rightOpen} onOpenChange={setRightOpen} title="Turn t3" description="The inspector, as a sheet below 1024 px">
            <div className="flex flex-col gap-3 p-3">
              <p className="text-body text-ink-body">Focus is trapped here. Escape or the scrim closes it, and focus goes back to the button.</p>
              <Field label="Filter events">
                <Input />
              </Field>
              <Button variant="primary" onClick={() => setRightOpen(false)}>
                Done
              </Button>
            </div>
          </Sheet>
          <Sheet open={bottomOpen} onOpenChange={setBottomOpen} side="bottom" title="Menu">
            <div className="flex flex-col gap-2 p-3">
              <Button variant="secondary" onClick={() => setBottomOpen(false)}>
                Close
              </Button>
            </div>
          </Sheet>
        </Group>
        <Group title="Toasts (at most three, four seconds, paused on hover and focus)">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => toast({ message: "Session reset", tone: "info" })}>
              Info
            </Button>
            <Button variant="secondary" onClick={() => toast({ title: "Copied", message: "Session id is on the clipboard", tone: "ok" })}>
              Success
            </Button>
            <Button variant="secondary" onClick={() => toast({ message: "Timing is reconstructed", tone: "warn" })}>
              Warning
            </Button>
            <Button variant="secondary" onClick={() => toast({ title: "Engine unreachable", message: "https://engine.example/stream/".repeat(6), tone: "error", action: { label: "Retry", onAction: () => undefined } })}>
              Error with a long URL
            </Button>
          </div>
        </Group>
      </Section>

      <Section id="surfaces" title="Panels, dividers, placeholders and alerts">
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          <Panel title="Retrieval timeline" count={6} actions={<IconButton label="Filter timeline" icon={<Filter size={14} />} size="sm" />}>
            <p className="text-body text-ink-body">The body is the scroll container.</p>
          </Panel>
          <Panel title="Flush panel" variant="flush" padded={false}>
            <p className="px-3 py-2 text-body text-ink-body">No border of its own, for a pane that has edges already.</p>
          </Panel>
        </div>
        <Divider />
        <div className="flex flex-wrap items-center gap-6">
          <Spinner label="Loading traces" />
          <div className="min-w-0 flex-1 basis-48">
            <Skeleton lines={3} label="Loading turn" />
          </div>
        </div>
        <EmptyState title="No turns yet" action={<Button variant="primary">Replay a test case</Button>}>
          Ask a question or replay a test case. Traces appear here as turns complete.
        </EmptyState>
        <div className="flex min-w-0 flex-col gap-2">
          <InlineAlert tone="info">Sessions are kept in memory only.</InlineAlert>
          <InlineAlert tone="ok" title="Index ready">
            96 chunks from 12 documents.
          </InlineAlert>
          <InlineAlert tone="warn" title="Degraded" onDismiss={() => undefined}>
            Timings for this turn are reconstructed, not measured.
          </InlineAlert>
          <InlineAlert tone="error" title="Engine unreachable" action={<Button size="sm">Retry</Button>}>
            {"https://engine.example/stream".repeat(8)}
          </InlineAlert>
        </div>
      </Section>
    </>
  );
}
