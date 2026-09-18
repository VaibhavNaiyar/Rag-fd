/**
 * The citation marker format, kept separate from the React renderers.
 *
 * This is a contract with the engine's answer formatter, not a presentation
 * detail: a marker the pattern misses renders as plain text, and a marker it
 * matches but the evidence cannot resolve renders as "unverified". Both are
 * failures a judge would see, so the pattern is tested on its own.
 */

/** A doc id, a section marker, and nothing that could swallow a whole line. */
const CITATION_PATTERN = /\[[A-Za-z0-9_.:-]+\s*§[^\]\n]{1,24}\]/g;

export interface MarkerMatch {
  marker: string;
  start: number;
  end: number;
}

/** Every citation marker in a string, in order, with its span. */
export function findCitationMarkers(text: string): MarkerMatch[] {
  const matches: MarkerMatch[] = [];
  // A fresh regex per call: the global flag makes a shared instance stateful.
  const pattern = new RegExp(CITATION_PATTERN.source, "g");

  for (const match of text.matchAll(pattern)) {
    if (match.index === undefined) continue;
    matches.push({
      marker: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return matches;
}

export function containsCitation(text: string): boolean {
  return findCitationMarkers(text).length > 0;
}
