/**
 * LEGACY re-export, deleted in P12-F06 with the rest of the old shell.
 *
 * The real content moved to `lib/labels.ts` (P5-F03), which is exhaustive
 * against the engine's own reason codes and adds search-call and glyph/tone
 * metadata the new Console and Inspector need. `DECISION_VISUALS` is the old
 * name for what is now `DECISION_LABELS`; both shapes are compatible (`label`,
 * `colorVar`, `pillClass`), so the legacy components below keep working.
 */
export { DECISION_LABELS as DECISION_VISUALS, REASON_LABELS, SOURCE_LABELS, TRIGGER_LABELS, reasonLabel } from "@/lib/labels";
