# qtdn — visual language

A handoff document. Everything here is lifted from
`apps/mobile/src/ui/tokens.ts`, which is the running app's single source of truth — not
an aspirational spec. If a value here disagrees with that file, that file is right.

---

## 1. What the app is

qtdn is an iOS app for guitarists writing quick chord charts: chords positioned over
lyrics, tab blocks, organised in folders. The repertoire it is built around is Brazilian —
bossa nova and MPB, Jobim — so the harmony is dense: seventh chords, tensions, altered
dominants, slash bass notes.

**Where it is used shapes every decision.** It is read at arm's length, in a dim room,
while both hands are on the instrument. It is not read at a desk.

Three consequences that are not negotiable:

- **Dark-first.** Light mode does not exist yet.
- **Legible before pretty.** Type sizes are set for viewing distance, not for density.
- **One-handed reach.** Anything pressed mid-song is large and near the bottom.

---

## 2. Principles

**Warm, not clinical.** The greys lean toward paper rather than slate. A screen of lyrics
should read like a songbook at night, not like a terminal. This is the single strongest
signal in the palette and the easiest to lose.

**Green is the identity.** One green carries the whole app. It is the colour of every
chord and every control, and the only hue in the palette besides `danger`.

**Typography does the work.** There is no illustration, no imagery, no iconography beyond
chord diagrams. Hierarchy comes from three typefaces with clearly separated jobs.

**The rules are enforced mechanically.** Lint rejects a raw colour literal anywhere
outside the token file. This is not a guideline anyone can quietly drift from.

---

## 3. Colour

| Role | Hex | Contrast vs background | Used for |
|---|---|---|---|
| `background` | `#0E0F11` | — | The app ground. Near-black, slightly warm, to soften OLED smearing |
| `surface` | `#181A1D` | 1.1:1 | Raised surfaces: tab blocks, cards, bottom sheets |
| `border` | `#2A2D32` | 1.4:1 | Hairlines and dividers only |
| `text` | `#E9E5DE` | 15.3:1 | Lyrics and body copy. Warm off-white — paper, not printer paper |
| `textMuted` | `#9B968E` | 6.5:1 | Secondary copy: folder counts, section labels, timestamps |
| `chord` | `#8FCB6E` | 10.0:1 | Chord symbols. The most frequent expression of the identity green |
| `accent` | `#8FCB6E` | 10.0:1 | Interactive: primary buttons, selection, the auto-scroll control |
| `danger` | `#D08A92` | 7.1:1 | Destructive actions only |
| `backdrop` | `rgba(0,0,0,0.6)` | — | Scrim behind a modal sheet |

Every text role clears WCAG AA (4.5:1) against the background.

### Why this green specifically

Mid-saturation on purpose. Brighter greens score *better* against the background — a pale
mint reaches 13.6:1 — but they converge toward the lyric white, sitting at 1.12:1 against
`text` where this one sits at 1.53:1. Since chords appear directly above lyrics, a
brighter green reads as **pale rather than green** in the one place it matters.

**If you change the green, measure it against `text`, not just against `background`.**

### Rules

- `chord` and `accent` are deliberately the same value. Form separates them: chords are
  bare glyphs, controls are filled or bordered shapes. If that ever reads ambiguously,
  split the ramp by luminance **within the same hue** — do not introduce a second hue.
- `danger` appears only on destructive actions. Never as an accent, never for emphasis.
- No gradients. No drop shadows. Depth comes from `surface` and `border`.

---

## 4. Typography

Three families, **assigned by what the text is** rather than by where it sits.

| Family | Role | Carries |
|---|---|---|
| **Fraunces** 700 Bold | display | Titles, headings, navigation titles |
| **Newsreader** 400/500 | prose | Lyrics and body copy — text read continuously |
| **JetBrains Mono** 400/700 | notation | Chords, tabs, captions, metadata |

The split is the point: **prose is set in a serif, notation in a monospace.** Chords and
tabs are both notation rather than language, and one monospaced voice makes that
distinction visible. It also gives chord glyphs predictable width above a lyric.

### The scale

`Text` accepts only these variants — there are no one-off sizes anywhere in the app.

| Variant | Family | Size / line-height |
|---|---|---|
| `title` | Fraunces 700 | 30 / 38 |
| `heading` | Fraunces 700 | 21 / 28 |
| `body` | Newsreader 400 | 17 / 24 |
| `lyric` | Newsreader 400 | 19 / 26 |
| `chord` | JetBrains Mono 700 | 14 / 18 |
| `caption` | JetBrains Mono 400 | 12 / 16 |
| `tab` | JetBrains Mono 400 | 13 / 18 |

`lyric` is deliberately larger than `body` — it is read at arm's length.

### Rules

- **Never apply a `fontWeight`.** Each weight is a separately loaded file and the weight
  lives in the family name. Adding `fontWeight` on top triggers synthetic bolding over an
  already-bold face.
- **Never transform user-authored text.** `toUpperCase()` on a section label turns
  `Dm7(9)` into `DM7(9)` — a different chord. Casing is for chrome we wrote, never for
  text that came out of a note. (This shipped once and had to be fixed.)

---

## 5. Space, shape, targets

**Spacing** is a 4pt scale, and nothing outside it is used:
`xs 4 · sm 8 · md 12 · lg 16 · xl 24 · xxl 32`

**Radii**: `sm 6` (chips, cells) · `md 10` (buttons, fields) · `lg 16` (sheet top corners)

**Minimum touch target: 44pt**, per Apple's HIG. Every pressable in the app meets it.

Borders are `1px` or `StyleSheet.hairlineWidth`. Nothing heavier.

---

## 6. The component set

Closed by design — screens compose from these and may not introduce new visual
primitives.

| Component | Anatomy |
|---|---|
| `Text` | The only text primitive. Takes a `variant` from the scale and a `tone` from the colour roles, never a raw size or colour |
| `Button` | 44pt min height, `md` radius, `lg` horizontal padding. **primary** = filled `accent` with `background`-coloured label; **secondary** = 1px `border`; **danger** = 1px `danger`. Pressed 0.7 opacity, disabled 0.4 |
| `ListRow` | 44pt min height, title + optional subtitle + right-aligned meta, hairline bottom border |
| `TextField` | `surface` fill, `md` radius. A `source` variant switches to monospace + multiline + autocorrect off, for editing chart source |
| `Sheet` | Bottom sheet: `surface`, `lg` top corners, `lg` padding, max 80% height, `backdrop` scrim. Title + optional subtitle + content + a row of actions |
| `EmptyState` | Centred heading + one line saying what to do next. A blank screen is never left unexplained |
| `ChartView` | The reading surface: chords in `chord` green above lyrics in `text` |
| `ChordDiagram` | Fingering box: 6 string columns × 4 fret rows, 13×18pt cells, hairline grid, `chord`-green dots, `×`/`○` markers above, a thicker top line when the shape is at the nut |
| `ScrollControl` | Auto-scroll bar: −/speed/+ and one large Play button |

---

## 7. Chord notation

Any design showing chords must get this right — it is Brazilian **cifra**, not the
English convention. **There is no `maj` anywhere.**

| Chord | Written | Not |
|---|---|---|
| Major triad | `D` | `Dmaj` |
| Dominant seventh | `D7` | — |
| Major seventh | `D7M` | `Dmaj7` |
| Minor | `Dm` | — |
| Minor seventh | `Dm7` | — |
| Half-diminished | `Dm7(b5)` | — |
| Diminished | `D°` | — |
| Slash chord | `Dm7/G` | — |

Tensions go in parentheses, lowest first, one group: `D7(9)`, `D7(9,13)`, `D7(#11)`.

Realistic chart content for mockups:

```
F7M                    G7(9)
Olha que coisa mais linda
                Gm7   Gb7(#11)
mais cheia de graça
```

---

## 8. Anti-patterns

Things that would look wrong in this app:

- Gradients, drop shadows, glows, glassmorphism
- Emoji, or dingbat glyphs used as icons
- A second accent hue
- Rounded-corner cards with a coloured left border
- Inter, Roboto, Arial, or any system-default sans
- Purely decorative illustration — nothing here is decorative
- Light mode (does not exist)
- Fake iOS status bars or keyboards in mockups

---

## 9. What does not exist yet

Honest gaps, so nothing is assumed present:

- **No icon set.** The app currently uses text labels for every action. An icon system is
  unclaimed territory.
- **No motion language.** No durations, easings or transitions are defined beyond
  React Navigation and modal defaults.
- **No light mode**, and no plan for one.
- **No brand mark.** The app icon is the open question — currently the letters `qtdn` set
  in Fraunces, which reads as texture at home-screen size and says nothing about what the
  app does.
- **No illustration or empty-state art.**

---

## 10. Constraints for an app icon

- Full-bleed square, **no rounded corners** — iOS applies its own mask
- Must read at **60pt**, not just at 1024px
- Palette above; no gradients, no shadows, no emoji
- Should survive **grayscale** — if the mark collapses without the green, it is leaning
  on colour rather than form
- Judge it against a real home screen, never against white
