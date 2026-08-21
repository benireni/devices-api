import type { ChordSpec } from './chord';

/**
 * Guitar fingerings, derived rather than tabulated.
 *
 * A table of every chord would be enormous and still incomplete. Instead each quality has
 * one or two **movable shapes**, and the fingering is that shape placed at the fret where
 * the root falls. Two forms cover the neck: the barre rooted on the low E string and the
 * one rooted on the A string, and the lower of the two positions wins.
 *
 * A diagram is only offered when it would be honest. Tensions, suspensions and slash
 * basses change which notes are played, and drawing a plain C7 under `C7(9,13)` would
 * teach the wrong shape — so those return `null` and the chart simply shows no diagram.
 */

/** Low E to high e: the order a chord diagram is drawn, left to right. */
export const DIAGRAM_STRINGS = ['E', 'A', 'D', 'G', 'B', 'e'] as const;

/** Enharmonic spellings share a pitch: a diagram is about where your fingers go. */
const PITCHES: Readonly<Record<string, number>> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
};

const OPEN_E = 4;
const OPEN_A = 9;

/** `null` is a muted string. Offsets are relative to the barre. */
type Shape = readonly (number | null)[];

export type ShapeKey = 'maj' | 'min' | 'dom7' | 'min7' | 'maj7' | '6' | 'min6' | 'm7b5';

/**
 * The A form carries every shape, so a key always resolves there; the E form is the
 * alternative that often sits lower on the neck. Typing them this way rather than as
 * string-keyed records makes the complete lookup total and the partial one honest.
 */
const E_FORM: Partial<Readonly<Record<ShapeKey, Shape>>> = {
  maj: [0, 2, 2, 1, 0, 0],
  min: [0, 2, 2, 0, 0, 0],
  dom7: [0, 2, 0, 1, 0, 0],
  min7: [0, 2, 0, 0, 0, 0],
  maj7: [0, 2, 1, 1, 0, 0],
  '6': [0, 2, 2, 1, 2, 0],
  min6: [0, 2, 2, 0, 2, 0],
};

const A_FORM: Readonly<Record<ShapeKey, Shape>> = {
  maj: [null, 0, 2, 2, 2, 0],
  min: [null, 0, 2, 2, 1, 0],
  dom7: [null, 0, 2, 0, 2, 0],
  min7: [null, 0, 2, 0, 1, 0],
  maj7: [null, 0, 2, 1, 2, 0],
  '6': [null, 0, 2, 2, 2, 2],
  min6: [null, 0, 2, 2, 1, 2],
  m7b5: [null, 0, 1, 0, 1, null],
};

export interface Fingering {
  /** Fret the shape sits at. `0` means open position, at the nut. */
  readonly baseFret: number;
  /** Absolute fret per string, low E first. `null` is muted. */
  readonly frets: readonly (number | null)[];
}

/** The shape family for a chord, or `null` when no honest diagram exists. */
export function shapeKey(spec: ChordSpec): ShapeKey | null {
  if (spec.bass !== null || spec.sus !== '') return null;

  const halfDiminished =
    spec.quality === 'm' &&
    spec.seventh === '7' &&
    spec.tensions.length === 1 &&
    spec.tensions[0] === 'b5';
  if (halfDiminished) return 'm7b5';

  if (spec.tensions.length > 0) return null;
  if (spec.quality === '°' || spec.quality === '+') return null;

  const minor = spec.quality === 'm';
  if (spec.seventh === '') return minor ? 'min' : 'maj';
  if (spec.seventh === '7') return minor ? 'min7' : 'dom7';
  if (spec.seventh === '7M') return minor ? null : 'maj7';
  return minor ? 'min6' : '6';
}

/**
 * The shapes a guitarist actually plays in first position.
 *
 * The movable forms are complete and correct and, for these chords, wrong in practice:
 * deriving `C` from the A form puts it at the third fret as a barre, which is not what
 * anyone plays and is worse than showing nothing. Open strings cannot be derived from a
 * movable shape, so the common ones are named.
 *
 * Keyed by pitch class and shape, so `Db` and `C#` find the same box.
 */
const OPEN_FORMS: Readonly<Record<string, Shape>> = {
  '0:maj': [null, 3, 2, 0, 1, 0], // C
  '0:dom7': [null, 3, 2, 3, 1, 0], // C7
  '0:maj7': [null, 3, 2, 0, 0, 0], // C7M
  '2:maj': [null, null, 0, 2, 3, 2], // D
  '2:min': [null, null, 0, 2, 3, 1], // Dm
  '2:dom7': [null, null, 0, 2, 1, 2], // D7
  '2:min7': [null, null, 0, 2, 1, 1], // Dm7
  '4:maj': [0, 2, 2, 1, 0, 0], // E
  '4:min': [0, 2, 2, 0, 0, 0], // Em
  '4:dom7': [0, 2, 0, 1, 0, 0], // E7
  '4:min7': [0, 2, 0, 0, 0, 0], // Em7
  '5:maj7': [null, null, 3, 2, 1, 0], // F7M
  '7:maj': [3, 2, 0, 0, 0, 3], // G
  '7:dom7': [3, 2, 0, 0, 0, 1], // G7
  '9:maj': [null, 0, 2, 2, 2, 0], // A
  '9:min': [null, 0, 2, 2, 1, 0], // Am
  '9:dom7': [null, 0, 2, 0, 2, 0], // A7
  '9:min7': [null, 0, 2, 0, 1, 0], // Am7
  '11:min': [null, 2, 4, 4, 3, 2], // Bm
  '11:dom7': [null, 2, 1, 2, 0, 2], // B7
};

export function fingering(spec: ChordSpec): Fingering | null {
  const key = shapeKey(spec);
  const pitch = PITCHES[spec.root];
  if (key === null || pitch === undefined) return null;

  // First position wins where it exists: it is what a guitarist reaches for, and a
  // diagram nobody plays teaches the wrong shape.
  const open = OPEN_FORMS[`${String(pitch)}:${key}`];
  if (open !== undefined) return { baseFret: 0, frets: open };

  const aShape = A_FORM[key];
  const aFret = (pitch - OPEN_A + 12) % 12;

  const eShape = E_FORM[key];
  if (eShape === undefined) return place(aShape, aFret);

  const eFret = (pitch - OPEN_E + 12) % 12;
  return eFret <= aFret ? place(eShape, eFret) : place(aShape, aFret);
}

function place(shape: Shape, baseFret: number): Fingering {
  return {
    baseFret,
    frets: shape.map((offset) => (offset === null ? null : offset + baseFret)),
  };
}
