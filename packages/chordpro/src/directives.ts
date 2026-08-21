/**
 * Directive vocabulary.
 *
 * Adding a qtdn-specific field is a one-line change here plus a reader in the app —
 * the parser and serializer stay untouched, because they treat directives generically.
 * That genericity is deliberate: unrecognized directives round-trip unharmed, so a note
 * written by a newer version of qtdn (or by another ChordPro tool) never loses data
 * when an older client opens and saves it.
 */

/** Namespace for every qtdn-specific directive, so other ChordPro tools skip them. */
export const QTDN_PREFIX = 'x_qtdn_';

/** Directives qtdn writes itself. Listed for discoverability, not for validation. */
export const QTDN_DIRECTIVES = {
  /** UUIDv7 identifying the note across devices. */
  id: `${QTDN_PREFIX}id`,
  /** Monotonic revision counter, used by sync from phase 2 onward. */
  rev: `${QTDN_PREFIX}rev`,
  /** ISO-8601 timestamp of the last edit. */
  updated: `${QTDN_PREFIX}updated`,
  /** Relative path to an attached audio clip inside a `.qtdn` bundle. */
  audio: `${QTDN_PREFIX}audio`,
  /** Auto-scroll speed for the playing screen. */
  scroll: `${QTDN_PREFIX}scroll`,
} as const;

/** The section name qtdn treats as opaque monospace content rather than lyrics. */
export const TAB_SECTION = 'tab';

const START_PREFIX = 'start_of_';
const END_PREFIX = 'end_of_';

/** Returns the section name if `name` opens a section, otherwise `null`. */
export function sectionStartName(name: string): string | null {
  return name.startsWith(START_PREFIX) ? name.slice(START_PREFIX.length) : null;
}

/** Returns the section name if `name` closes a section, otherwise `null`. */
export function sectionEndName(name: string): string | null {
  return name.startsWith(END_PREFIX) ? name.slice(END_PREFIX.length) : null;
}

export function startDirective(section: string): string {
  return `${START_PREFIX}${section}`;
}

export function endDirective(section: string): string {
  return `${END_PREFIX}${section}`;
}

/**
 * The name of the directive a line holds, lowercased, or `null` if it is not one.
 *
 * Trims and lowercases, so `  {START_OF_TAB}` is the same fence as `{start_of_tab}`.
 * Shared rather than reimplemented per caller: the screens were testing for fences with
 * `startsWith('{start_of_tab')`, which disagreed with this on both counts.
 */
export function directiveName(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;

  const body = trimmed.slice(1, -1);
  const colon = body.indexOf(':');
  return (colon === -1 ? body : body.slice(0, colon)).trim().toLowerCase();
}

/** Whether a line opens a tab block. */
export function isTabStart(line: string): boolean {
  const name = directiveName(line);
  return name !== null && sectionStartName(name) === TAB_SECTION;
}

/** Whether a line closes a tab block. */
export function isTabEnd(line: string): boolean {
  const name = directiveName(line);
  return name !== null && sectionEndName(name) === TAB_SECTION;
}
