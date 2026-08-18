/**
 * The design system's single source of truth.
 *
 * This is the only file in the app permitted to contain a raw color literal; the
 * `qtdn/design-tokens` lint rule rejects them everywhere else. Names are semantic
 * (`color.chord`, not `orange500`) so re-theming is a change here and nowhere else.
 *
 * Dark-first: qtdn is read at arm's length, in dim rooms, while both hands are busy.
 */

export const color = {
  /** App background. Near-black rather than pure black, to soften OLED smearing. */
  background: '#0B0B0D',
  /** Raised surfaces: cards, sheets, the keyboard accessory bar. */
  surface: '#151519',
  /** Hairlines and dividers. */
  border: '#2A2A31',
  /** Lyrics and body copy. 13.9:1 on `background`. */
  text: '#ECECEE',
  /** Secondary copy: folder counts, timestamps, section labels. 5.6:1 on `background`. */
  textMuted: '#9A9AA4',
  /** Chords. The one saturated color in the app, so the eye finds them instantly. */
  chord: '#F5A623',
  /** Interactive accent: primary buttons, selection, the auto-scroll control. */
  accent: '#F5A623',
  /** Destructive actions only. */
  danger: '#FF6B6B',
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
 * The type scale. `Text` accepts only these variant names, which is what stops screens
 * from inventing one-off sizes.
 */
export const typography = {
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  /** Lyrics on the playing screen: larger than body, readable at arm's length. */
  lyric: { fontSize: 18, lineHeight: 24, fontWeight: '400' },
  /** Chord glyphs. Bold and tight so they sit clearly above the lyric. */
  chord: { fontSize: 14, lineHeight: 18, fontWeight: '700' },
  /** Tab blocks. Monospace is not a style choice here — alignment is the content. */
  tab: { fontSize: 13, lineHeight: 18, fontWeight: '400', fontFamily: 'Menlo' },
} as const;

export type TypeVariant = keyof typeof typography;
export type ColorRole = keyof typeof color;
