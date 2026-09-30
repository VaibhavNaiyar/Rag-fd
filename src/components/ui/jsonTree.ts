/**
 * The model behind the JSON viewer: a value flattened into the rows that are visible
 * given which nodes are open. Pure, so the tree logic is tested without a browser.
 */

export type JsonKind = "object" | "array" | "string" | "number" | "boolean" | "null";
export type JsonPathPart = string | number;

export interface JsonNode {
  /** Unique across the tree: the path as a string. */
  id: string;
  path: readonly JsonPathPart[];
  /** The key or index under its parent. `null` for the root. */
  key: JsonPathPart | null;
  depth: number;
  kind: JsonKind;
  /** A primitive for a leaf; the object or array itself for a collection. */
  value: unknown;
  /** How many children an object or array has. Zero for a leaf. */
  size: number;
  expandable: boolean;
  expanded: boolean;
  /** 1-based place among its siblings, and how many there are: for aria-posinset and aria-setsize. */
  position: number;
  siblings: number;
}

export function kindOf(value: unknown): JsonKind {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return "array";
  switch (typeof value) {
    case "object":
      return "object";
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    default:
      return "string";
  }
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** `$`, `$.retrieval[0].kept[2].chunk_id`, `$["a key"]`: the path in the form a developer would type. */
export function pathToString(path: readonly JsonPathPart[]): string {
  return path.reduce<string>((text, part) => {
    if (typeof part === "number") return `${text}[${part}]`;
    return IDENTIFIER.test(part) ? `${text}.${part}` : `${text}[${JSON.stringify(part)}]`;
  }, "$");
}

/** The children of an object or array, in order. A leaf has none. */
export function childrenOf(value: unknown): [JsonPathPart, unknown][] {
  if (Array.isArray(value)) return value.map((item, index): [JsonPathPart, unknown] => [index, item]);
  if (value !== null && typeof value === "object") return Object.entries(value as Record<string, unknown>);
  return [];
}

export interface Flattened {
  nodes: JsonNode[];
  /** True when the row limit was reached and some open nodes were not listed. */
  truncated: boolean;
}

export const DEFAULT_ROW_LIMIT = 2000;

/**
 * The rows to draw: every node from the root down, descending only into the nodes whose
 * id is in `expanded`. A value that contains itself is not followed again.
 */
export function flatten(root: unknown, expanded: ReadonlySet<string>, limit = DEFAULT_ROW_LIMIT): Flattened {
  const nodes: JsonNode[] = [];
  let truncated = false;
  const ancestors = new WeakSet<object>();

  const visit = (value: unknown, path: readonly JsonPathPart[], key: JsonPathPart | null, position: number, siblings: number): void => {
    if (nodes.length >= limit) {
      truncated = true;
      return;
    }
    const kind = kindOf(value);
    const children = kind === "object" || kind === "array" ? childrenOf(value) : [];
    const id = pathToString(path);
    const cyclic = typeof value === "object" && value !== null && ancestors.has(value);
    const expandable = children.length > 0 && !cyclic;
    const open = expandable && expanded.has(id);

    nodes.push({ id, path, key, depth: path.length, kind, value, size: children.length, expandable, expanded: open, position, siblings });

    if (!open || typeof value !== "object" || value === null) return;
    ancestors.add(value);
    children.forEach(([childKey, child], index) => visit(child, [...path, childKey], childKey, index + 1, children.length));
    ancestors.delete(value);
  };

  visit(root, [], null, 1, 1);
  return { nodes, truncated };
}

/** Every collection at a depth below `depth` is open: 0 opens nothing, 1 opens the root, 2 the root and its children. */
export function initialExpanded(root: unknown, depth: number): Set<string> {
  const open = new Set<string>();
  const ancestors = new WeakSet<object>();
  const visit = (value: unknown, path: readonly JsonPathPart[]): void => {
    if (path.length >= depth || typeof value !== "object" || value === null || ancestors.has(value)) return;
    open.add(pathToString(path));
    ancestors.add(value);
    for (const [key, child] of childrenOf(value)) visit(child, [...path, key]);
    ancestors.delete(value);
  };
  visit(root, []);
  return open;
}

/** The id of every collection in the value: what "Expand all" opens. */
export function allCollectionIds(root: unknown): Set<string> {
  return initialExpanded(root, Number.POSITIVE_INFINITY);
}

/** The muted text shown after a collection's key: `5 keys`, `1 key`, `12 items`, `empty`. */
export function summarise(node: Pick<JsonNode, "kind" | "size">): string {
  if (node.size === 0) return node.kind === "array" ? "empty array" : "empty object";
  if (node.kind === "array") return node.size === 1 ? "1 item" : `${node.size} items`;
  return node.size === 1 ? "1 key" : `${node.size} keys`;
}

/** A leaf as text: strings quoted and escaped, everything else as JSON writes it. */
export function formatLeaf(node: Pick<JsonNode, "kind" | "value">): string {
  if (node.kind === "string") return JSON.stringify(node.value);
  if (node.kind === "null") return "null";
  return String(node.value);
}

/** What "copy value" puts on the clipboard: a string as itself, anything else as indented JSON. */
export function copyableValue(value: unknown): string {
  return typeof value === "string" ? value : (JSON.stringify(value, null, 2) ?? "null");
}
