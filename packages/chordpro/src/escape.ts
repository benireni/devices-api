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

/**
 * Escapes lyric text for writing into a chart.
 *
 * `atLineStart` is true only for text that begins its line, because `#` and `{` are
 * inert anywhere else and escaping them would be noise in the file.
 */
export function escapeLyricText(text: string, atLineStart: boolean): string {
  let out = '';

  for (let index = 0; index < text.length; index += 1) {
    const character = text.charAt(index);
    const carriesMeaning = character === '[' || character === '\\';
    // `#` and `{` are inert anywhere but the first column, and escaping them elsewhere
    // would be noise in a file people are meant to be able to read.
    const opensTheLine = index === 0 && atLineStart && (character === '#' || character === '{');

    out += carriesMeaning || opensTheLine ? `\\${character}` : character;
  }

  return out;
}
