import { Children, cloneElement, isValidElement, type ReactNode } from "react";
import type { Components } from "react-markdown";
import { CitationRef } from "@/components/console/CitationRef";
import { findCitationMarkers } from "@/lib/citationPattern";
import { resolveCitation } from "@/store/selectors";
import type { Hit } from "@/types/events";

/**
 * Citation post-processing for markdown answer bodies.
 *
 * The model emits `[Doc_12 §2]` markers inside prose. Rather than parsing the
 * markdown ourselves, we let react-markdown build the tree and then split the
 * text nodes it produces, so a marker inside a list item or a table cell is
 * handled by the same code path as one in a paragraph.
 */

/** Replace every marker in a string with a resolved chip. */
function chipify(text: string, hits: Hit[], keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;

  findCitationMarkers(text).forEach((match, index) => {
    if (match.start > cursor) nodes.push(text.slice(cursor, match.start));
    nodes.push(
      <CitationRef
        key={`${keyPrefix}-${index}`}
        marker={match.marker}
        hit={resolveCitation(hits, match.marker)}
      />,
    );
    cursor = match.end;
  });

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

/** Walk a rendered subtree, chipifying every string leaf. */
function transform(children: ReactNode, hits: Hit[], keyPrefix = "c"): ReactNode {
  return Children.map(children, (child, childIndex) => {
    if (typeof child === "string") return chipify(child, hits, `${keyPrefix}-${childIndex}`);
    if (!isValidElement<{ children?: ReactNode }>(child)) return child;
    // Never rewrite the inside of a code span — a marker there is literal text.
    if (child.type === "code" || child.props.children === undefined) return child;
    return cloneElement(
      child,
      undefined,
      transform(child.props.children, hits, `${keyPrefix}-${childIndex}`),
    );
  });
}

/**
 * Markdown element overrides that inject citation chips.
 *
 * Takes the evidence rather than the whole turn, so the caller can memoise on an
 * array whose identity only changes when fusion returns — not on every streamed
 * token, which would rebuild these renderers sixty times a second.
 */
export function createCitationRenderers(hits: Hit[]): Components {
  const wrap = (Tag: keyof HTMLElementTagNameMap) => {
    // react-markdown passes the mdast `node` through; it must not reach the DOM.
    const Renderer = ({
      children,
      node: _node,
      ...props
    }: {
      children?: ReactNode;
      node?: unknown;
    }) => {
      const Element = Tag as unknown as React.ElementType;
      return <Element {...props}>{transform(children, hits)}</Element>;
    };
    Renderer.displayName = `Cited(${Tag})`;
    return Renderer;
  };

  return {
    p: wrap("p"),
    li: wrap("li"),
    td: wrap("td"),
    th: wrap("th"),
    strong: wrap("strong"),
    em: wrap("em"),
    blockquote: wrap("blockquote"),
    h1: wrap("h1"),
    h2: wrap("h2"),
    h3: wrap("h3"),
  };
}
