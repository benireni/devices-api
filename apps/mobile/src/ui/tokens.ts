/**
 * The design system's single source of truth.
 *
 * This is the only file in the app permitted to contain a raw color literal; the
 * design-token lint rule rejects them everywhere else. Names are semantic
 * (`color.chord`, not `sage500`) so re-theming is a change here and nowhere else.
 *
 * Dark-first: qtdn is read at arm's length, in dim rooms, while both hands are busy.
 */

/**
 * The identity green.
 *
 * qtdn is a green app. This is the color on every chart and every control, and the only
 * hue in the palette besides `danger`.
 *
 * Mid-saturation on purpose. Brighter greens measure better against the background but
 * converge toward the lyric white (a pale mint sits at 1.12:1 against `text`), so they
 * read as *pale* rather than green when they sit directly above a lyric. This one holds
 * its hue where it actually appears.
 */
const IDENTITY = '#8FCB6E';

/**
 * Palette.
 *
 * Warm rather than clinical — the greys lean toward paper, not toward slate, so a
 * screen full of lyrics reads like a songbook at night instead of a terminal.
 * Contrast ratios are measured against `background` and all clear WCAG AA (4.5:1).
 */
export const color = {
  /** App background. Near-black, slightly warm, to soften OLED smearing. */
  background: '#0E0F11',
  /** Raised surfaces: tab blocks, cards, sheets, the keyboard accessory bar. */
  surface: '#181A1D',
  /** Hairlines and dividers. */
  border: '#2A2D32',
  /** Lyrics and body copy. Warm off-white — paper, not printer paper. 15.3:1. */
  text: '#E9E5DE',
  /** Secondary copy: folder counts, timestamps, section labels. 6.5:1. */
  textMuted: '#9B968E',
  /** Chords. The most frequent expression of the identity green. 10.0:1. */
  chord: IDENTITY,
  /** Interactive: buttons, selection, the auto-scroll control. 10.0:1. */
  accent: IDENTITY,
  /** Destructive actions only. 7.1:1. */
  danger: '#D08A92',
} as const;

/** 4pt base scale. Every margin and padding in the app comes from here. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
} as const;

/** Minimum touch target, per Apple's Human Interface Guidelines. */
export const HIT_SLOP = 44;

/**
 * Typefaces, assigned by what the text *is* rather than by where it sits.
 *
 * - Fraunces for display. A variable serif with real character in its shapes, so the
 *   app has a voice instead of defaulting to the system sans.
 * - Newsreader for prose. Warm, high-legibility serif for lyrics, which is the text
 *   you read continuously while your hands are busy.
 * - JetBrains Mono for notation. Chords and tabs are both notation rather than prose,
 *   and giving them one monospaced voice makes that distinction visible — with the
 *   side benefit that chord glyphs occupy predictable width above the lyric.
 *
 * Weight lives in the family name because each weight is a separately loaded file.
 * Never pair these with `fontWeight`: that triggers synthetic bolding on top of an
 * already-bold face.
 */
export const fontFamily = {
  display: 'Fraunces_700Bold',
  prose: 'Newsreader_400Regular',
  proseMedium: 'Newsreader_500Medium',
  notation: 'JetBrainsMono_700Bold',
  notationRegular: 'JetBrainsMono_400Regular',
} as const;

/**
 * The type scale. `Text` accepts only these variant names, which is what stops screens
 * from inventing one-off sizes.
 */
export const typography = {
  title: { fontFamily: fontFamily.display, fontSize: 30, lineHeight: 38 },
  heading: { fontFamily: fontFamily.display, fontSize: 21, lineHeight: 28 },
  body: { fontFamily: fontFamily.prose, fontSize: 17, lineHeight: 24 },
  caption: { fontFamily: fontFamily.notationRegular, fontSize: 12, lineHeight: 16 },
  /** Lyrics on the playing screen: larger than body, readable at arm's length. */
  lyric: { fontFamily: fontFamily.prose, fontSize: 19, lineHeight: 26 },
  /** Chord glyphs. Bold monospace so they sit clearly above the lyric. */
  chord: { fontFamily: fontFamily.notation, fontSize: 14, lineHeight: 18 },
  /** Tab blocks. Monospace is not a style choice here — alignment is the content. */
  tab: { fontFamily: fontFamily.notationRegular, fontSize: 13, lineHeight: 18 },
} as const;

export type TypeVariant = keyof typeof typography;
export type ColorRole = keyof typeof color;
