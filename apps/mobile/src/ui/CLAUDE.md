# The design system

Dark-first, warm rather than clinical, stage-legible. qtdn is read at arm's length, in dim
rooms, while both hands are busy.

**Enforcement is mechanical, not a matter of discipline.** "Always enforced" cannot rest
on review, so the rules below are lint rules that fail CI.

## Tokens

`tokens.ts` is the single source of truth for color, spacing, radius, typefaces and the
type scale. It is **the only file in the app permitted to contain a color literal** — the
design-token lint rule rejects hex, `rgb()` and `hsl()` values everywhere else.

Names are semantic: `color.chord`, never `sage500`. Re-theming is then a change to one
file and nowhere else.

Colors carry their measured contrast ratio against `background` in a comment. All clear
WCAG AA (4.5:1). If you change a color, re-measure and update the comment.

**Green is the app's identity.** One identity green (`IDENTITY` in `tokens.ts`) serves
both `color.chord` and `color.accent`; `danger` is the only other hue. Chords are simply
the most frequent place you see it.

It is mid-saturation deliberately. Brighter greens score better against the background but
converge toward the lyric white — a pale mint measures 1.12:1 against `text` — so they
read as *pale* rather than green exactly where chords live, directly above a lyric. If you
change it, check the ratio against `text`, not just against `background`.

Chords and controls sharing one value means form has to carry the distinction: chords are
bare glyphs, controls are filled or bordered shapes. That holds in practice, but a green
button sitting directly beside green chords is the case to watch. If it ever reads
ambiguously, split the ramp by luminance within the same hue rather than introducing a
second hue.

## Typefaces

Assigned by what the text *is*, not by where it sits:

| Family | Role | Used for |
|---|---|---|
| Fraunces | display | Titles and headings. A variable serif with real character, so the app has a voice instead of defaulting to the system sans. |
| Newsreader | prose | Lyrics and body. Warm, high-legibility serif for the text you read continuously while your hands are busy. |
| JetBrains Mono | notation | Chords, tabs and captions. Chords and tabs are both notation rather than prose; one monospaced voice makes that distinction visible, and chord glyphs get predictable width above the lyric. |

Weight lives in the family name (`Newsreader_500Medium`) because each weight is a
separately loaded file. **Never pair these with `fontWeight`** — that triggers synthetic
bolding on top of an already-bold face. Adding a weight means editing `fonts.ts` and
`tokens.ts` together.

## The component set is closed

Screens compose from `components/` and may not introduce new visual primitives. If a
screen needs something the set doesn't have, the set grows deliberately — that is the
moment consistency is actually decided, rather than discovering an inconsistency three
screens later.

- `Text` is the only text primitive. It takes a `variant` from the type scale and a `tone`
  from the color roles, never a font size or a color. That is what stops a screen from
  introducing a fourteenth shade of grey. Its `style` prop is deliberately narrowed to
  layout properties only.
- `Screen` is the page shell: safe-area insets and the app background, in one place.
- `ChartView` renders a parsed chart read-only. It is the performance surface, so it shows
  no editing affordances at all. Each chord sits in a column above the text it belongs to,
  which keeps alignment correct as lines wrap without measuring text.

## Adding a component

1. Build it in `components/`, using only tokens.
2. Export it from `components/index.ts`.
3. **Add it to `app/gallery.tsx`.** A closed set only stays coherent if there is somewhere
   to see all of it at once. The gallery is that place, and it is also how the set gets
   reviewed.
4. Run `npm run lint` — the token rules will tell you if you reached for a raw value.

## Never transform user-authored text

`toUpperCase()` on a section or tab label turns `Dm7(9)` into `DM7(9)`, which is a
different chord name. Casing, truncation and other transforms are for app chrome — a
`FOLDERS` heading we wrote — never for text that came out of a note.

## Known limitations

The structured editor lists words, so a chord not pinned to a word's first character —
mid-word, or trailing at the end of a line like `[Gb7(#11)]` — has no word to sit on and
is not shown there. It is **preserved, not lost**: `setChordAt` only touches the offset it
is given, and the reading screen and raw editor both still show it. Reaching those chords
structurally needs a target that is not a word, which is a deliberate later decision.

## Known trade-off

`ChartView` gives each segment its own column, so a chord wider than the text run beneath
it stretches that run (`[C7M(9)]a` pushes the `a` out). This is the cost of correct
alignment under wrapping without text measurement. Revisit only with a real fix, not by
abandoning the wrap behavior.
