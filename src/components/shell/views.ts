import { ChartColumn, ListTree, SquareTerminal, type LucideIcon } from "lucide-react";
import type { View } from "@/lib/route";

/** The name and icon of each view, once, for the nav rail and the tab bar. */
export const VIEW_META: Record<View, { label: string; icon: LucideIcon }> = {
  console: { label: "Console", icon: SquareTerminal },
  traces: { label: "Traces", icon: ListTree },
  metrics: { label: "Metrics", icon: ChartColumn },
};
