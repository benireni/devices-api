/**
 * Building chord symbols in Brazilian cifra notation.
 *
 * A symbol is assembled from independent choices rather than picked from a list: root,
 * quality, seventh, suspension, tensions and an optional bass note. The list of every
 * chord a musician might want is effectively infinite, so enumerating it was never going
 * to work — but the parts are small and finite, and combining them can only produce a
 * well-formed symbol.
 *
 * Nothing here touches the parser: a chord is opaque text between brackets. This is
 * vocabulary, not format.
 */

export const NOTES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

/** The third and fifth. An empty quality is the major triad, which cifra leaves bare. */
export const QUALITIES = ['', 'm', '°', '+'] as const;

/** `7` is the dominant seventh, `7M` the major seventh. There is no `maj`. */
export const SEVENTHS = ['', '7', '7M', '6'] as const;

export const SUSPENSIONS = ['', 'sus4', 'sus2'] as const;

/** Ordered low to high, which is the order they are written in. */
export const TENSIONS = ['b5', '#5', '9', 'b9', '#9', '11', '#11', '13', 'b13'] as const;

export type Quality = (typeof QUALITIES)[number];
export type Seventh = (typeof SEVENTHS)[number];
export type Suspension = (typeof SUSPENSIONS)[number];

export interface ChordSpec {
  readonly root: string;
  readonly quality: Quality;
  readonly seventh: Seventh;
  readonly sus: Suspension;
  readonly tensions: readonly string[];
  /** The bass note of a slash chord, or `null` when the root is in the bass. */
  readonly bass: string | null;
}

export const EMPTY_SPEC: ChordSpec = {
  root: 'C',
  quality: '',
  seventh: '',
  sus: '',
  tensions: [],
  bass: null,
};

/** Assembles a spec into a symbol: `Dm7M(9)/A`. */
export function buildChord(spec: ChordSpec): string {
  const ordered = TENSIONS.filter((tension) => spec.tensions.includes(tension));
  const parens = ordered.length === 0 ? '' : `(${ordered.join(',')})`;
  const bass = spec.bass === null ? '' : `/${spec.bass}`;

  return `${spec.root}${spec.quality}${spec.seventh}${spec.sus}${parens}${bass}`;
}

/**
 * Reads a symbol back into a spec, so editing an existing chord starts from what is
 * already there.
 *
 * Returns `null` for anything outside this vocabulary — an imported chart may hold
 * symbols the builder cannot express, and quietly mangling one into the nearest
 * representable chord would be worse than admitting it.
 */
export function parseChord(symbol: string): ChordSpec | null {
  const [head, bassPart, ...extra] = symbol.split('/');
  if (head === undefined || extra.length > 0) return null;

  const bass = bassPart === undefined ? null : matchNote(bassPart);
  if (bassPart !== undefined && (bass === null || bass !== bassPart)) return null;

  const root = matchNote(head);
  if (root === null) return null;

  let rest = head.slice(root.length);

  const tensions: string[] = [];
  const open = rest.lastIndexOf('(');
  if (open !== -1 && rest.endsWith(')')) {
    for (const raw of rest.slice(open + 1, -1).split(',')) {
      const tension = TENSIONS.find((candidate) => candidate === raw.trim());
      if (tension === undefined) return null;
      tensions.push(tension);
    }
    rest = rest.slice(0, open);
  }

  let quality: Quality = '';
  for (const candidate of ['m', '°', '+'] as const) {
    if (rest.startsWith(candidate)) {
      quality = candidate;
      rest = rest.slice(candidate.length);
      break;
    }
  }

  let seventh: Seventh = '';
  for (const candidate of ['7M', '7', '6'] as const) {
    if (rest.startsWith(candidate)) {
      seventh = candidate;
      rest = rest.slice(candidate.length);
      break;
    }
  }

  let sus: Suspension = '';
  for (const candidate of ['sus4', 'sus2'] as const) {
    if (rest.startsWith(candidate)) {
      sus = candidate;
      rest = rest.slice(candidate.length);
      break;
    }
  }

  return rest === '' ? { root, quality, seventh, sus, tensions, bass } : null;
}

/**
 * Tensions that describe the same degree. At most one of each may be chosen, because
 * `C7(9,b9)` names a ninth that is both natural and flattened.
 */
const FAMILIES: readonly (readonly string[])[] = [
  ['b5', '#5'],
  ['9', 'b9', '#9'],
  ['11', '#11'],
  ['13', 'b13'],
];

export interface ChordOptions {
  readonly sevenths: readonly Seventh[];
  readonly suspensions: readonly Suspension[];
  readonly tensions: readonly string[];
}

/**
 * Which choices remain musically coherent given what is already selected.
 *
 * The rules, and why each exists:
 *
 * - A diminished chord already carries a diminished fifth and a minor third, so `7M` and
 *   `6` do not apply to it; `°` and `°7` are the whole vocabulary. An augmented chord is
 *   complete in itself — the augmented dominant and augmented major seventh are written
 *   as alterations on the plain forms, `C7(#5)` and `C7M(#5)`, which this builder can
 *   already express.
 * - A suspension replaces the third, so it cannot combine with a quality that states one.
 *   `Cmsus4` claims a minor third and no third at once.
 * - `b5` and `#5` restate the fifth that `°` and `+` have already altered.
 * - `sus4` and an eleventh are the same note, as are `sus2` and a ninth.
 */
export function optionsFor(spec: ChordSpec): ChordOptions {
  const sevenths: readonly Seventh[] =
    spec.quality === '°' ? ['', '7'] : spec.quality === '+' ? [''] : SEVENTHS;

  const suspensions: readonly Suspension[] = spec.quality === '' ? SUSPENSIONS : [''];

  const tensions = TENSIONS.filter((tension) => {
    if ((spec.quality === '°' || spec.quality === '+') && (tension === 'b5' || tension === '#5')) {
      return false;
    }
    if (spec.sus === 'sus4' && tension === '11') return false;
    if (spec.sus === 'sus2' && tension === '9') return false;
    return true;
  });

  return { sevenths, suspensions, tensions };
}

/** Drops any selection the current quality or suspension has just invalidated. */
export function normalize(spec: ChordSpec): ChordSpec {
  const options = optionsFor(spec);
  const seventh = options.sevenths.includes(spec.seventh) ? spec.seventh : '';
  const sus = options.suspensions.includes(spec.sus) ? spec.sus : '';

  const kept: string[] = [];
  for (const tension of TENSIONS) {
    if (!spec.tensions.includes(tension)) continue;
    if (!optionsFor({ ...spec, seventh, sus }).tensions.includes(tension)) continue;
    if (FAMILIES.some((family) => family.includes(tension) && kept.some((k) => family.includes(k)))) {
      continue;
    }
    kept.push(tension);
  }

  return { ...spec, seventh, sus, tensions: kept };
}

/** Applies a change and drops whatever it invalidated. */
export function update(spec: ChordSpec, patch: Partial<ChordSpec>): ChordSpec {
  return normalize({ ...spec, ...patch });
}

/** Adds or removes a tension, replacing any other member of its family. */
export function toggleTension(spec: ChordSpec, tension: string): ChordSpec {
  if (spec.tensions.includes(tension)) {
    return update(spec, { tensions: spec.tensions.filter((value) => value !== tension) });
  }

  const kept = spec.tensions.filter(
    (value) => !FAMILIES.some((group) => group.includes(tension) && group.includes(value)),
  );
  return update(spec, { tensions: [...kept, tension] });
}

/** The longest note name the text begins with, so `C#` wins over `C`. */
function matchNote(text: string): string | null {
  const matches = NOTES.filter((note) => text.startsWith(note)).sort((a, b) => b.length - a.length);
  return matches[0] ?? null;
}
