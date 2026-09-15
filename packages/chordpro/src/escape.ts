/**
 * ChordPro gives three characters syntactic meaning inside what is otherwise ordinary
 * text: `[` opens a chord anywhere on a line, and a leading `#` or `{` turns the whole
 * line into a comment or a directive.
 *
 * A writer typing a lyric has no reason to know that. `[bis]` is an everyday repeat
 * marker in a Brazilian cifra, `#1` starts a sentence, and `{refrão 2x}` is a note to
 * self — and each one, written verbatim, comes back as something other than the words
 * that were typed. Two of the three come back as nothing at all, because the chart does
 * not render comments or directives.
 *
 * So the serializer escapes them and the parser reads them back, with a backslash.
 *
 * The two halves are deliberately not symmetric. Writing always doubles a backslash,
 * because what follows a segment's last character is the *next segment* — a chord
 * bracket, or another escape — and a rule that looked only within one segment wrote
 * `[A]\` before `[A]` and read back a literal bracket. Reading treats a backslash as an
 * escape only when what follows it is escapable, so a chart pasted from elsewhere, where
 * a stray backslash means nothing in particular, still reads as the words it shows. The
 * cost is that saving such a chart normalizes `\` to `\\`, which the chart reads the
 * same either way.
 */

/** The characters a backslash may escape. A backslash before anything else is literal. */
const ESCAPABLE = new Set(['[', '#', '{', '\\']);

export function isEscapable(character: string): boolean {
  return ESCAPABLE.has(character);
}

/** Escapes what carries meaning anywhere on a line: a chord bracket, and the escape. */
export function escapeLyricText(text: string): string {
  let out = '';
  for (const character of text) {
    out += character === '[' || character === '\\' ? `\\${character}` : character;
  }
  return out;
}

/**
 * Escapes a `#` or `{` that would make the whole assembled line something other than a
 * lyric.
 *
 * This runs on the finished line rather than on each segment, because what makes those
 * two characters dangerous is what comes *before* them, and a segment cannot see that.
 * The first attempt escaped only at column zero and was defeated by a single leading
 * space, since `parseDirective` trims before it tests — so `  {refrão 2x}` was still read
 * back as a directive and ` {start_of_chorus}` still restructured the document.
 *
 * Both characters are escaped at the first non-blank column even though only `{` is
 * reached through a trim today. The parser's two rules disagree about leading whitespace,
 * a writer has no way to know which is which, and matching the stricter of them costs one
 * backslash in a file.
 *
 * Neither character can come from anywhere but lyric text — a chord contributes `[`, `]`
 * and its own symbol — so the first non-blank character being one of them is unambiguous.
 */
export function escapeLineStart(line: string): string {
  const at = line.search(/\S/);
  const character = line.charAt(at);
  if (at === -1 || (character !== '#' && character !== '{')) return line;
  return `${line.slice(0, at)}\\${line.slice(at)}`;
}
