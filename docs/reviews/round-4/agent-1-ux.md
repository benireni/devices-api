# Round 4 — Agent 1 — UI/UX review

status: complete
HEAD at start: 2653a26 (branch claude/qtdn-design-planning-sdhse4)
date: 2026-09-15

Screenshots and driver scripts cited below live in this session's scratchpad:
`/tmp/claude-0/-home-user-devices-api/8969ce88-37de-5b42-8c7f-fee65144d9e2/scratchpad/`
(`shots/*.png`, `t*.mjs`). They are session-local; every finding also cites `file:line`
and says how to reproduce it, so nothing depends on them surviving.

Method: built the web export at the reviewed commit, served it, and drove it with
Playwright at iPhone 13 metrics in dark mode — screenshotting each screen and dumping the
accessibility tree and the measured box of every control.

Findings are appended as they are confirmed. "checked and sound" lines record
things ruled out. "hypothesis, unverified" records leads stopped mid-flight.

---
## UX-1 · The nut bar on a chord diagram is drawn above the ×/○ row, not at the top of the fretboard · Medium · defect

`apps/mobile/src/ui/components/ChordDiagram.tsx:39` puts the `atNut` style on the
*board* container, and `:68` implements it as `borderTopWidth: 2`. But the board's first
child row is the ×/○ marker `Text` (`:44-46`), which sits *inside* each string column,
above the fret cells. So the 2px "nut" lands above the markers and 20px clear of the
grid it is supposed to cap.

Measured in the running web export (`Ideia de sábado`, `Am7` diagram):

```
board (the element carrying borderTop: 2px solid #9B968E)  y = 126
  marker row (× ○ _ ○ _ ○)                                 y = 128 .. 146
  first fret cell                                          y = 146
```

Screenshot: `scratchpad/shots/08-diagram.png` (8× device scale). The bar reads as an
underline of the chord name `Am7`, not as a nut. Because only open shapes get it, an
open-position diagram appears to have its title underlined while every barre diagram
beside it does not — the inconsistency is what the eye picks up, which is the opposite of
the comment's intent at `:37-38` ("so an open shape is not mistaken for a barre sitting
at some unstated fret").

Secondary, same component: `styles.cell` (`:69-77`) sets `borderLeftWidth` and
`borderTopWidth` only, so the fret grid has no bottom line and no right edge. The lowest
fret row is open-ended (visible in the same screenshot: the six verticals just stop). A
chord box conventionally closes.

Fix: move `atNut` onto the fret grid — put the four fret cells in their own wrapper per
string, or lift the marker row out of the string column and above the board — and give
the last fret row a bottom border and the last string a right border.

Why no test caught it: `e2e/specs/chords.spec.ts` asserts which chords have a diagram,
never how one is drawn; `docs/images/` has no chord-strip screenshot.

---
## UX-2 · Chord slots in the structured editor are as narrow as 16pt, in the app's single most important gesture · High · defect

`apps/mobile/app/compose/[id].tsx:574` — `slot: { flexDirection: 'column', paddingRight: space.sm, minHeight: 44 }`. There is
`minHeight` but no `minWidth`, and the slots are laid out edge to edge with no gutter, so
every slot's neighbours are *different targets that write a chord onto a different
syllable*.

Measured on the running web export (Compose on `Garota de Ipanema`, iPhone 13 metrics,
CSS px = pt):

```
16.4 x 44   "No chord over this beat"     (every inter-word gap — 21 of them on this note)
16.8 x 44   "No chord over é"
27.3 x 44   "No chord over de"
33.2 x 44   "No chord over tão"
36.2 x 44   "No chord over por"
36.7 x 44   "G7M over Ah,"
```

Full audit in `scratchpad/` (script `t11.mjs`). 24 of the 43 slots on that one screen are
under 44pt wide; the narrowest are 16.4pt, i.e. 37% of the floor.

This directly contradicts two documents:
- `docs/VISUAL-LANGUAGE.md:172` — "**Minimum touch target: 44pt**, per Apple's HIG. Every
  pressable in the app meets it."
- `docs/DESIGN.md` §7 — "all controls ≥44pt" is listed under the accessibility floor.

And it contradicts the product premise: `VISUAL-LANGUAGE.md` §1 says the app is used
"while both hands are on the instrument", and D7/§6.1 make tap-to-place the primary
editor. A mis-tap here silently attaches a chord to the neighbouring word — it is not a
dead press, it is a wrong write, undone only by noticing it.

`ChordPicker`'s own chips (`ChordPicker.tsx:314-315`) set `minHeight: 44` *and*
`minWidth: 44`, and `Button.tsx:60-63` carries a comment explaining that exact fix
("a one-glyph label like `−` was landing at 39pt"). The editor's slots were not given the
same treatment.

Worth naming the tension honestly: the slot width is also the layout — widening every slot
to 44pt would space "Olha que coisa" out like a ransom note. So the fix is not `minWidth`.
Options, in order of how much I'd trust them:
1. `hitSlop` on the slot, asymmetric so neighbours do not both claim the same pixel — RN
   allows `{left, right}` and the slots are in a known order, so each can claim half the
   gutter plus its own `paddingRight`. Cheap, no layout change, and it raises the gap
   slots to roughly 32pt.
2. Increase `styles.gap` (`:576`, `minWidth: 18`) and `paddingRight` so an inter-word gap
   is at least 28-32pt wide, accepting looser lines in the editor only (the reading
   surface is a different component and is unaffected).
3. If neither is acceptable, amend `VISUAL-LANGUAGE.md` §5 and `DESIGN.md` §7 to say the
   floor holds for chrome and not for in-chart slots, and say why. What is not acceptable
   is a stated non-negotiable that the primary editor does not meet.

New test this needs (nothing in `e2e/` measures geometry today): a spec that walks every
`getByRole('button')` on Compose and asserts `boundingBox().width >= 44 &&
height >= 44`, allow-listing nothing. The same assertion over the gallery route would fence
the whole component set.

---

## UX-3 · The structured editor shows raw ChordPro to a user the design says should never see it · Medium · defect

Screenshot: `scratchpad/shots/09-compose.png`. Opening *Edit* on `Garota de Ipanema`
gives, as the first two lines on screen:

```
{title: Garota de Ipanema}
{artist: Tom Jobim / Vinicius de Moraes}
{start_of_verse: A}
...
{end_of_verse}
```

`compose/[id].tsx:424-428` hides `x_qtdn_*` directives with the comment "showing them made
the default editor's first screenful raw ChordPro, including a UUID" — the reasoning is
right and it was applied to exactly one prefix. Standard directives are still rendered as
their source text at `:430-440`.

Three consequences:

1. **The two surfaces disagree about the same content.** The reading screen renders
   `{start_of_verse: A}` as the section label `A` (`ChartView`), and the editor renders it
   as `{start_of_verse: A}`. `docs/DESIGN.md` §6.3 says raw mode "is not the default, and
   the UI does not push you toward it" — the default editor's first screenful is raw mode.
2. **Two different affordances edit the title.** The note screen's *Rename* is a
   `PromptSheet` (`note/[id].tsx:320-332`); Compose's is long-press → "Edit text", which
   loads `plainText(source)` — and `plainText` (`:557-562`) returns the *raw source* for a
   non-lyric line. So the same field is edited once through a labelled prompt and once by
   hand-editing `{title: Garota de Ipanema}` in a field whose placeholder says "Lyrics"
   (`:489`). Typing a `}` away silently turns the title directive into a lyric.
3. The line menu's subtitle (`describeLine`, `:518-529`) falls back to the raw source for
   these lines, so the confirmation text is also `{end_of_verse}`.

Proposal: render structure lines the way the reading surface does — `Verse A` for
`{start_of_verse: A}`, `Title · Garota de Ipanema` for `{title:}` — keeping the long-press
menu, and route "Edit text" on a directive line to a prompt for its *value* rather than a
free-text field over its source. That is where the format's own promise lives: the file
stays ChordPro, the editor stops spelling it out.

Taste, labelled: I would also drop `{end_of_verse}` from the editor entirely and let the
section be a container, but that is a bigger change than this review should propose.

---

## UX-4 · Compose teaches its two gestures only to a note that has no lyrics · Medium · defect

`compose/[id].tsx:217-222` renders the hint "Add a line, then tap a word to put a chord
over it. Hold a line for more." behind `!(lines ?? []).some(isLyric)`.

So the hint appears on a brand-new note and disappears for ever once one lyric line
exists. But the returning case — open an existing chart and *Edit* it — is the common one,
and on that screen there is nothing at all that says a word is tappable or that a line has
a menu. The screenshot (`09-compose.png`) has no affordance on any slot: no underline, no
chip outline, no caret. The chords are the same colour as on the read-only screen.

The comment says "after that the chart teaches it", which is the assumption I would
challenge: the chart teaches you that chords exist above words, not that tapping a word
opens a picker or that a long press deletes a verse. Long press in particular has no
discoverable entry point anywhere in the app, and it is the only route to *delete a line*,
*move a line* and *edit a section*.

Proposal: keep a persistent one-line caption in the editor footer area (it is chrome, not
content, so it does not grow with the note), or give unchorded slots a faint baseline rule
the way `styles.gap` (`:575-581`) already does for bars — the affordance exists, it is
just restricted to empty bars.

---

## UX-5 · Diminished chords have no diagram, and they are the idiom the product doc centres · Medium · preference (enrichment)

`packages/chordpro/src/fingering.ts:97` — `if (spec.quality === '°' || spec.quality === '+') return null;`

The root `CLAUDE.md` gives the diminished passing chord as the worked example of why the
app exists: "`C6 C#° Dm7 D#° Em7` going up, `Em7 Eb° Dm7 Db° C6` coming back down". The
demo library ships that exact line as `Acordes de passagem`. On that note the strip shows
three diagrams and then this (screenshot `scratchpad/shots/12-estudos-note.png`):

```
No shape: C#°, D#°, Eb°, Db°, Dm7(9), G7(b13), C7M(9), Dm7(11),
G7(#9), C6(9), Cm7(b9), F7(#11), Bb7M(13)
```

Thirteen of sixteen chords, three wrapped lines of muted grey standing between the title
and the first lyric — which is the outcome `ChordStrip.tsx:18-21` says the design was
trying to avoid ("a screen of nothing before the first lyric").

Tensions genuinely have no single honest shape and the `null` is right there. A diminished
seventh does: it is one symmetric movable shape, and `°` in cifra is the one quality in the
whole table that a guitarist reaches for a *fixed* box for. Adding `dim` to `ShapeKey` and
the two form tables would take four of those thirteen off the line, on the note the
documentation uses to explain the product.

Not out of scope: D10 lists chord diagrams as a shipped v1 feature; this is completing it,
not widening it.

Second, smaller: the line reads `No shape: ...` with no reason. `No diagram — tensions and
slash basses change the notes: ...` costs one line and answers the question a first-time
user actually has, which is whether the app is broken.

---

## checked and sound

- Touch targets in `Button`, `ListRow` and `ChordPicker`'s chips all measure >= 44 x 44 in
  the running build. The web export reports header chevrons and caption-sized pressables
  ("Sort: Title", "Logs", "Actions") at 16pt tall, but that is react-native-web ignoring
  `hitSlop`; on iOS `hitSlop={space.lg}` puts each at 48pt. Not a finding.
- `ChordDiagram` fret placement is arithmetically correct for open forms, E-form and
  A-form barres — I walked `Am7`, `Gm7`, `G7M`, `C6` and `Em7` against `fingering.ts` and
  every dot, `×` and `○` lands on the right string and row. The bug in UX-1 is the nut
  bar's position only.
- `ChartView` keeps chords over the right segment when a line wraps, including
  `Ah, por que tudo é tão / D7(b9) triste?` where the chord follows the wrap.
- `Sheet` clips its scrolling body above the action row rather than under it; the
  half-visible chip row at the fold is real scroll affordance, not an overlap.
- Sheet dismissal, the backdrop `Dismiss` button and `accessibilityRole="header"` on sheet
  titles (`Text.tsx:24`) are all present and correct.

---
## UX-6 · The only tab in the shipped library cannot be opened by the tab editor · High · defect

Reproduction (screenshot `scratchpad/shots/14-tab.png`, script `t14.mjs`):
Estudos → `Acordes de passagem` → Actions → Edit → tap the `{start_of_tab: …} — tap to edit`
row. The tab screen renders:

> **Voicing de Dm7(9) sem tônica** · Rename
> This tab was not written by the grid editor. Editing it here would change its spacing,
> so it stays in the raw editor.
> [Open source]  ·  Undo (disabled) · Save (disabled)

Cause: `apps/mobile/src/data/demo.ts:64-70` seeds

```
e|--5--|
```

`packages/chordpro/src/tab.ts:71-72` takes the body between the pipes — `--5--`, five
characters — and rejects it because `body.length % CELL_WIDTH !== 0` with `CELL_WIDTH = 3`.
Every one of the six rows fails the same way, so `parseTabGrid` returns `null`,
`tab/[id].tsx:81-87` sets `unreadable`, logs `tab.unreadable`, and the grid editor refuses
its own library.

Why this is worse than an ordinary content bug:

- `demo.ts:5-8` says the demo library exists "to seed the web build with charts worth
  looking at" and "for rendering documentation screenshots". It is the shop window. The
  one tab in it is a dead end.
- D8 in `DESIGN.md` makes the dedicated grid editor a headline v1 feature, and the only
  tab a new user can reach demonstrates the feature refusing to work.
- `DESIGN.md` §4.1's own canonical example — `e|---------------------|`, 21 dashes — *is*
  a multiple of 3 and parses. So the format doc and the demo content disagree, silently.
- The refusal is unfalsifiable from the outside: the message says "was not written by the
  grid editor", which is true but tells the user nothing they can act on, and offers only
  the raw editor — the escape hatch `DESIGN.md` §6.3 says "the UI does not push you
  toward".

Fix (content, not format): pad the demo rows to a multiple of three, e.g.
`e|--5---|` / `A|------|`. The one-cell-wide voicing is the point of that example, so
`e|-5-|` × 1 column would also do.

Fix (worth arguing): `parseTabGrid` could round the body up to the next multiple of three
rather than refusing, since padding trailing dashes changes no fret's position. That keeps
the "never reflow someone's tab" promise for anything with an actual alignment (a body
whose *content* would move), while accepting the overwhelmingly common hand-typed case of
"my dashes don't happen to be a multiple of three". I would take this one, and I expect
disagreement.

New test this needs: `e2e/specs/tabs.spec.ts` builds its grids from scratch, so nothing
ever opened a *seeded* tab. Add a spec that opens every tab block in the demo library and
asserts the grid renders — one assertion that would have caught this on the day the demo
was written.

---
## UX-7 · The playing screen breaks at accessibility text sizes, which is the one screen Dynamic Type is promised on · Medium · defect

`docs/DESIGN.md` §7, accessibility floor: "**Dynamic Type respected on the playing
screen**". It is not, above roughly 1.5x.

Method: loaded the reading screen in the web export and scaled every text node's
`font-size` and `line-height`, which is exactly what RN's `allowFontScaling` (on by
default for `Text`) does on device — container `View` dimensions and paddings do not
scale. Script `t16.mjs`; screenshots `scratchpad/shots/17-dynamictype-1.35x.png` and
`17-dynamictype-2x.png`.

- **1.35x** (xxxLarge, the largest non-accessibility size): holds. Header fits, `Play`
  fits, diagram markers stay over their strings. Good.
- **2x** (about AX2; iOS goes to roughly 3.1x at AX5): two failures.

**(a) The auto-scroll bar's `Play` label is cut to "Pla" and overflows the bar.**
`ScrollControl.tsx:42-80` is a fixed row: `Awake`, `−`, the readout (`minWidth: 48`), `+`
— all intrinsic width — and `Play` with `style={{ flex: 1 }}`. Every sibling grows with
the type scale while `Play` absorbs the loss, and `Button` (`Button.tsx:64`) keeps
`paddingHorizontal: space.lg` regardless. The one control the design calls "one large
control... pressed mid-song with one hand" is the one that degrades first.
Fix: `flexWrap: 'wrap'` on `styles.bar` so the bar becomes two rows, or drop `flex: 1`
from `Play` and let the readout absorb the slack instead.

**(b) The header title runs underneath the `Actions` button.** Visible in the 2x
screenshot: "Ideia de sáb**ado**" is overprinted by "Actions".
Labelled **risk rather than defect**: this is react-navigation's own header, and on iOS
the native header truncates a long title beside a `headerRight` where react-native-web
does not. It needs a device check before anyone spends a diff on it. I could not do that
check here.

Related, same cause, smaller: `ChordDiagram`'s `CELL_WIDTH`/`CELL_HEIGHT`
(`ChordDiagram.tsx:8-9`) are fixed constants while the `×`/`○` markers (`:44`) are a
scaling `Text` with no width constraint, so above ~1.7x the marker glyph exceeds the 13pt
cell and the string columns stop being equal. Visible as uneven verticals at 2x. Fixing it
is one `width: CELL_WIDTH` on the marker `Text`'s wrapper.

New test this needs: the `iphone` project in `e2e/playwright.config.ts` could gain a second
project that injects a font-size multiplier and re-runs the reading and compose specs with
one extra assertion — no horizontal overflow on `ScrollControl`, no two visible elements
whose boxes intersect. It would have caught (a) mechanically.

---

## UX-8 · A brand-new note opens onto three lines of ChordPro syntax and a grey dash · Medium · defect

Screenshot `scratchpad/shots/16-compose-empty.png`. Library → New note → "Teste UX" →
Create lands on:

```
{title: Teste UX}

{start_of_verse}

    ▬                    <- 26 x 44pt grey rule, the empty-bar slot
{end_of_verse}

Add a line, then tap a word to put a chord over it. Hold a line for more.
[Add line] [Add tab] [Add section]
```

This is the first screen of the app's primary job, and it is UX-3 at its worst: the only
content on it is format internals. `compose/[id].tsx:424-428` hides `x_qtdn_*` for exactly
this reason and stops one prefix short.

Three separate things compound here:

1. `{title:}` / `{start_of_verse}` / `{end_of_verse}` are shown raw (UX-3).
2. The empty-bar rule (`styles.gap`, `:575-581`) renders as an unexplained 26pt dash.
   `isBar` (`:532-534`) is careful about when to show it and the comment explains the
   reasoning well — but on an empty note it is the only mark on screen and means nothing
   to someone who has never placed a chord.
3. **`Save` is the primary button on a screen with nothing to save**, while `Add line` —
   the thing the hint tells you to press — is a secondary bordered button three inches
   higher up. The visual hierarchy points at the wrong control on the one screen where a
   first-time user has no idea what to do.

Proposal: on a note with no lyric line, promote `Add line` to `variant="primary"` and
demote `Save` (it is already a no-op — `dirty` is false, so the discard guard would not
even fire). Cheap, and it makes the hint and the hierarchy agree.

---

## UX-9 · "Add line" lives at the bottom of the scrolling chart, not in the chrome · Medium · preference

`compose/[id].tsx:224-251` puts the `Add line` / `Add tab` / `Add section` row *inside*
the `ScrollView`, after every line of the note. The footer (`:269-294`) holds only `Close`,
`Undo`, `Save`.

On the demo's four-line charts the tools are still on screen. On a real song — the full
"Garota de Ipanema" is about 48 lines — adding a verse means scrolling to the very bottom
of the note every time, and back up. `VISUAL-LANGUAGE.md` §1 lists "**One-handed reach.**
Anything pressed mid-song is large and near the bottom" as non-negotiable; `Add line` is
the most-pressed control on this screen while writing, and it is the one that moves.

Counter-argument I can see: the tools are positioned where the new line will land
(`appendPoint`), so putting them at the end is honest about the insertion point. That is a
real argument, and it is why I label this preference and not defect. But the same
information is already carried by "Insert line above/below" in the long-press menu, so the
footer button can mean "append" without ambiguity.

Proposal: move the three tools into the footer as a second row, or replace `Close` (which
duplicates the header chevron and the edge-swipe, both already guarded by
`useDiscardGuard`) with `Add line`.

---

## UX-10 · Nothing on the screen says whether a note has unsaved edits · Medium · defect

Compose and the tab editor both track `dirty` (`compose/[id].tsx:174`,
`tab/[id].tsx:142-144`) and both use it — for the discard guard. Neither shows it.

On screen, a note with a chord just placed and a note saved five minutes ago look
identical: `Save` is the same filled green either way, the title bar says `Compose` either
way. The only cue is that `Undo` stops being dimmed, which says "something is undoable",
not "something is unwritten".

The consequence is not lost data — `useDiscardGuard` is good and catches the chevron, the
edge-swipe and `Close` alike (`useDiscardGuard.ts:4-13` explains why, correctly). The
consequence is that the user cannot answer "is it saved?" without trying to leave, and
the reading screen's own speed saves are silent too (`note/[id].tsx:109-118` writes after
a 600ms settle with no indication at all).

Proposal, cheapest first: put `• Unsaved` as a `caption`/`textMuted` line in the footer
while `dirty`, or switch `Save` to `variant="secondary"` when clean so the filled green
means "there is something here to write". Either makes the state legible at a glance and
costs no layout.

---
## UX-11 · `danger` is used for six error *messages*, and the design document forbids exactly that · Low · defect

`docs/VISUAL-LANGUAGE.md` §3, Rules: "`danger` appears **only on destructive actions**.
Never as an accent, never for emphasis." `apps/mobile/src/ui/tokens.ts:46` repeats it:
"Destructive actions only."

It is used as an error-message colour in six places:

- `app/index.tsx:214` — import failure
- `app/note/[id].tsx:262` — rename/move/share failure
- `app/folder/[name].tsx:91` — folder rename failure
- `app/compose/[id].tsx:264` — save failure
- `app/tab/[id].tsx:196` and `:303` — read/save failure
- `app/edit/[id].tsx:81` — parse diagnostics, which are explicitly *not* errors
  (`:41` "Diagnostics are advisory while typing: a half-written chart is not an error
  state") yet are painted in the destructive hue

Screenshot: `scratchpad/shots/22-source-diag.png` — "2 issues — line 2: Chord bracket is
never closed." in pink, beside an enabled green `Save`.

I do not think the code is wrong here; I think the document is. A palette with two hues
has to spend one of them on "something went wrong", and the alternative — muted grey for
an error — would be worse. But the rule as written is violated in six files and the token
comment promises something the app does not do, which is how a design system stops being
trustworthy.

Proposal: amend `VISUAL-LANGUAGE.md` §3 and `tokens.ts:46` to "Destructive actions, and
text reporting a failure. Never as an accent or for emphasis." Then fix the one genuine
outlier: `edit/[id].tsx:81` paints advisory diagnostics in `danger` on the same line whose
own comment says they are not an error state — `textMuted` or `accent` is the honest tone
there, with `danger` reserved for `problem`.

Same family, smaller: `app/logs.tsx:73` maps the `warn` level to `tone="chord"`. `chord`
and `accent` are the same hex so nothing looks wrong, but a log level is not a chord, and
`ui/CLAUDE.md:30-34` is specifically about keeping those two roles from blurring.

---

## UX-12 · "Clear" wipes the log with no confirmation, next to the button you actually came for · Medium · defect

`app/logs.tsx:50-57`. `Clear` is a plain secondary `Button` — no `danger` variant, no
`ConfirmSheet` — sitting immediately left of the primary `Export`, both 174pt wide in the
same row (screenshot `scratchpad/shots/20-logs.png`).

Every other destructive action in the app confirms and says what will be lost:
`note/[id].tsx:346-357` ("… will be removed from this device. This cannot be undone"),
`folder/[name].tsx:172-187` (names the note count). This one does not, and its content is
the *least* recoverable thing in the app: `observability/CLAUDE.md` and
`DESIGN.md` §8 both say the log is the only account of what happened at a rehearsal with
no laptop, and `logger.ts` holds it in memory only — once cleared it is gone in a way a
note never is.

The failure is concrete: you open Logs because something misbehaved, your thumb lands one
button left of `Export`, and the evidence is gone.

Fix: `variant="danger"` and a `ConfirmSheet` ("Clear the log? The record of this session
goes with it."), or reverse the order so the destructive button is furthest from the
thumb's resting position.

---

## UX-13 · The raw editor has none of the syntax highlighting the design specifies, and names only one of its issues · Medium · defect

`DESIGN.md` §6.3: "Full-screen monospace editor over the ChordPro source, **with syntax
highlighting for directives and chord brackets**." `app/edit/[id].tsx:77` renders a plain
`TextField source`, and `TextField.tsx:120-137` is a bare `TextInput` with one colour.
Screenshot `scratchpad/shots/22-source-diag.png`: `{title: X}`, `[Am7`, `{start_of_verse}`
and the lyric are all the same `text` off-white.

This is not cosmetic on this particular screen. §6.3 and `DESIGN.md` D9 both say raw mode
exists for "the paste-from-web path" — a wall of someone else's ChordPro — and for
debugging the parser. Telling a bracket from a brace by eye is the entire job.

`DESIGN.md`'s own preamble names §5.1 and §10 as the stale sections where the code wins.
§6.3 is not on that list, so this is undeclared drift rather than an accepted gap. Either
build it or add §6.3 to the stale list with a reason — the review-round convention in this
repo is that a decision that changed gets recorded.

Second, smaller, same screen: `describe()` (`:102-108`) prints `"2 issues — line 2: …"` and
then shows only the first. The count tells you there is another one and the screen gives
you no way to reach it. Either name the count and let the user step through (`Next issue`),
or stop advertising a number you will not show.

Third: the diagnostic cites a line number and the editor has no line numbers. On a pasted
60-line chart "line 34" means counting. A gutter is a real change; a cheaper version is to
say the offending text rather than the index.

---

## UX-14 · A failed library scan now renders as "No notes yet" · Medium · risk

Flagged against a fix landing in parallel — `hooks/useLibrary.ts` changed under me at
`821a0de`, and the NF-2 repair now catches a scan failure, logs `library.scan.failed` and
clears `loading` in a `finally`.

That is right, and it leaves the screen in a state I would not ship: `app/index.tsx:149`
renders `isEmpty && !loading` as

> **No notes yet** — Start a note, or make a folder to group them.

So a device whose storage is refusing, or whose notes directory has gone, tells the user
their library is empty and invites them to start writing. A blank screen was a bug; "your
library is empty" is a false statement about the user's own data, and the natural next
action (write a new note) is the one that could end up somewhere unexpected.

Proposal: carry the failure out of `reload` as state — `{ loading, failed }` — and give
`index.tsx` a third branch:

> **Can't read your notes** — Something is wrong with this device's storage. Your files are
> still there. Logs has the details.

with a route into `/logs`, which is exactly what `observability/CLAUDE.md` says that screen
is for. The note screen already models this correctly at `note/[id].tsx:222-227`
("Can't open this note"), so there is a pattern to copy.

I have not seen the final shape of the NF-2 fix — re-check before acting on this.

---
## UX-15 · The gallery and the handoff document have both drifted from the token file they exist to mirror · Medium · defect

`ui/CLAUDE.md:67-74` makes the gallery the enforcement point for a closed component set:
"Add it to `app/gallery.tsx`. A closed set only stays coherent if there is somewhere to see
all of it at once." `docs/CLAUDE.md` makes `VISUAL-LANGUAGE.md` the outside-the-codebase
mirror of `tokens.ts`. Both have fallen behind, and in each case because the list is
retyped by hand rather than derived.

**The gallery**
- `app/gallery.tsx:45` — `const TYPE_VARIANTS = ['title','heading','body','lyric','chord','caption','tab']`.
  `tokens.ts:98-115` has **eight** variants; `label` (added for control labels, with its
  own comment at `:103-108` explaining why "Play", "Stop" and "Save" were previously the
  smallest type on screen) is missing. So the one variant introduced to fix a legibility
  bug is the one variant you cannot see in the place the set is reviewed.
- `app/gallery.tsx:34-43` — `COLOR_ROLES` lists eight of nine; `backdrop` is absent.

Confirmed by driving `/gallery` (`scratchpad/shots/23-gallery.png`) — the TYPE SCALE
section renders seven rows.

**`docs/VISUAL-LANGUAGE.md`**
- §4 "The scale" (lines 99-105): same seven variants, no `label`, under the sentence
  "`Text` accepts only these variants — there are no one-off sizes anywhere in the app."
  That sentence is now false.
- §6 "The component set" (lines 140-148) lists nine components.
  `apps/mobile/src/ui/components/` holds sixteen. `ChordStrip`, `ChordPicker`,
  `ConfirmSheet`, `OptionSheet`, `PromptSheet`, `Screen` and `ErrorBoundary` are not in the
  document that a designer is told is the component set.
- §6's `ScrollControl` row says "−/speed/+ and one large Play button" — the `Awake` toggle
  shipped in `dd2792d` and is not there.
- §6's `ChordDiagram` row says "a thicker top line when the shape is at the nut", which is
  the *intent* UX-1 shows the code does not achieve. The document describes a diagram the
  app does not draw.

Fix, and this is the part worth doing rather than the transcription: derive both gallery
lists from the tokens —
`const TYPE_VARIANTS = Object.keys(typography) as TypeVariant[]` and the same for
`color` — so a new token cannot ship without appearing. The descriptions can stay a
`Partial<Record<…, string>>` lookup with a fallback. Then the gallery enforces the rule
`ui/CLAUDE.md` says it enforces, instead of recording whether someone remembered.

For `VISUAL-LANGUAGE.md`, the honest repair is to regenerate §3 and §4 from `tokens.ts`
and to date §6, since a hand-written component table will drift again.

---

## UX-16 · Small things worth one line each · Low

Each verified in the running build; none is worth its own diff alone.

1. **The reading screen prints the note's title twice** — the navigator header
   (`note/[id].tsx:203`) and again as `variant="title"` at `:246-248`. On an iPhone 13
   that is about 60pt of the fold, on the one screen whose whole job is showing as much
   chart as possible. The folder screen and compose do not repeat their titles. Screenshot
   `03-note.png`. *preference*
2. **The `Folder` button on the library is a noun among verbs** — `index.tsx:228`, sitting
   between `Import` and `New note`. It creates a folder. `New folder` fits: the row is
   three `flex: 1` buttons at 112pt and "New note" already renders on one line at the same
   width. *preference*
3. **Creating a folder is the only create that is a full screen, not a sheet.**
   `index.tsx:230` pushes `/new-folder`; every other create/rename in the app is a
   `PromptSheet` (new note, rename note, rename folder, name tab). `new-folder.tsx` also
   has no Cancel control — the header chevron and the edge-swipe are the only exits —
   while `PromptSheet` always offers one. *defect, consistency*
4. **`New note` never says where the note will land.** The same `PromptSheet` title,
   "New note", is used from the library (`index.tsx:189`, creates unfiled) and from inside
   a folder (`folder/[name].tsx:146`, creates in that folder). `OptionSheet` has a
   `subtitle` prop for exactly this and `folder/[name].tsx:120` uses it for the actions
   sheet. One line — `in Repertório` / `Not in a folder` — closes the gap. *defect*
5. **The empty-folder state says what is, not what to do.** `folder/[name].tsx:74`:
   "Empty folder / Nothing in *name* yet." `EmptyState`'s own contract
   (`EmptyState.tsx:72`) is "One line saying what to do next", and the library's empty
   state honours it ("Start a note, or make a folder to group them"). *preference*
6. **Log timestamps are raw UTC ISO-8601.** `logs.tsx:36-38` prints
   `2026-09-15T03:28:30.765Z`. The screen exists to be read at a rehearsal against the
   clock on the wall; that is local time, and milliseconds are noise at this level.
   *preference*
7. **The logs screen reads the buffer once** (`logs.tsx:16`, `useState(() => log.read())`)
   so it never updates while open, and there is no level filter — five entries fill a
   screenful and `library.scanned` fires on every focus, so an `error` is quickly buried.
   *preference (enrichment)*
8. **The picker's Quality row calls the bare triad "major"** (`ChordPicker.tsx:138`) while
   every other "none" option in the same sheet is `—` (Seventh, Bass, Suspension). The root
   `CLAUDE.md` says "There is no `maj` anywhere in this codebase — not in the picker";
   this is prose rather than a symbol so I do not think it breaks the spirit, but it is
   both literally the forbidden string and inconsistent with its three sibling rows.
   *preference*
9. **`NOTES` has seventeen root spellings; the root `CLAUDE.md` says fifteen.**
   `packages/chordpro/src/chord.ts:25-43` lists C C# Db D D# Eb E F F# Gb G G# Ab A A# Bb B.
   The picker renders all seventeen over three rows (`scratchpad/shots/10-picker.png`).
   A doc/code disagreement rather than a UI bug — flagging it because it is the picker's
   largest row and agent 2 or 4 may want it. *defect, documentation*
10. **The gap slot's subtitle reads `over “this beat”`** (`compose/[id].tsx:452`), with
    smart quotes around a phrase that is not a quotation. `over this beat` (unquoted) and
    `over “graça”` (quoted) would keep the quotes meaning "the user's own word".
    *preference*

---
## UX-17 · Moving a note drops you where it no longer is, with no word that it moved · Medium · defect

Reproduction (`t20.mjs`, screenshots `25-move.png`, `26-after-move.png`):
Repertório → Corcovado → Actions → Move → Estudos. You land on
`/folder/Repertório`, the row is gone, and nothing anywhere says a move happened.

`note/[id].tsx:173-187` ends with `router.back()`. The destination sheet closes, the screen
pops, and the note you were just reading has vanished from the list you are now looking at.
`log.info('note.moved')` goes to a screen the user is not on.

The codebase already argues the opposite position for the identical situation.
`compose/[id].tsx:139-146`:

> "A new note is created straight into this editor, so there is no note screen behind it —
> going back landed on the library, and the chart you had just written was something you
> then had to go and find. Replacing puts it on screen and leaves the library one step
> back, where it belongs."

That is exactly this case. Fix: `router.replace(\`/note/${id}?folder=${to}\`)` (or the
unfiled form when `to` is null) so a move ends with the note on screen in its new home, and
the folder you moved it out of is one step back.

Delete is fine as it stands — `ConfirmSheet` said the note would be removed, so its
disappearance is expected. Move never promised anything.

---

## UX-18 · The chord picker displays a chord that does not exist and will not be created · Medium · defect

`ChordPicker.tsx:49` seeds state from `EMPTY_SPEC`, and `chord.ts:70-77` sets its root to
`'C'`. So opening the picker on a slot with **no chord** gives (screenshot
`scratchpad/shots/10-picker.png`):

- the sheet title, set in the chord face, reading **`C`**
- the `C` chip filled green as "selected" in the Root row
- `major` and `—` filled green in Quality and Seventh
- a primary green **Done** button

Nothing has been written. `applyChord` only runs from `commit`, which only runs from a chip
press (`:63-69`), so pressing `Done` writes nothing at all — while the largest, brightest
element on the sheet has been asserting `C` the whole time.

The sheet's own code shows the team already solved the neighbouring version of this
problem. `:76-78`:

> "The note's own symbol while locked: showing what the builder would produce is what made
> the sheet claim a chord it had not been given."

The `locked` path was fixed. The empty path still claims a chord it has not been given.

Fix: while `current === null` and no chip has been pressed, title the sheet `—` (or the
word itself) and render no chip as selected; the first press both selects and writes, which
is already how it behaves.

Related, worth arguing separately: **there is no Cancel in this sheet.** Every chip press
writes immediately and `Done` merely dismisses, so an accidental tap on a root while
inspecting an existing chord changes the chart. Recovery exists — `building` (`:60-61`,
`:116-122`) collapses the whole build into one undo step, which is a good design — but it
lives on the Compose footer, behind dismissing the sheet. A `Cancel` that restores
`current` would cost three lines and remove the only unguarded destructive edit in the
editor.

---
## UX-19 · The structured editor's structure rows are invisible to the accessibility tree, and the line menu is unreachable without a long press · Medium · defect

Measured on the running build (`t23.mjs`), Compose on `Acordes de passagem`: 45 elements
carry `role="button"`, and **none** of them is a structure line or the tab row. The tab
fence — the only route from Compose into the tab editor — renders as

```
<div tabindex="0">{start_of_tab: Voicing de Dm7(9) sem tônica} — tap to edit</div>
```

with no `role` and no `aria-label`. Same for `{title:}`, `{start_of_verse: …}`,
`{end_of_verse}` and the tab body rows.

Source: `compose/[id].tsx:414-422` (`isTabStart` branch), `:430-440` (metadata branch) and
`:398-406` (tab body) are `Pressable`s with no `accessibilityRole` and no
`accessibilityLabel`. Contrast `:444-459`, where every chord slot has both and the label is
genuinely good — "`F7M over Olha`", "`No chord over this beat`". The care was spent on the
slots and not on their neighbours.

Two consequences on device:

1. VoiceOver focuses these rows (RN's `Pressable` sets `accessible`) but announces them as
   text, with no "button" trait and no hint, so the tab editor has no discoverable entry.
2. The line menu — `Edit text`, `Insert above/below`, `Move up/down`, `Delete` — is bound to
   `onLongPress` only, everywhere (`:416`, `:434`, `:443`, `:457`). VoiceOver does not
   deliver a long press from its own rotor, so for a VoiceOver user **there is no way at
   all to delete a line, move a line, or rename a section** without going to the raw editor.
   `ChartView`'s read-only surface is fine; it is the editor that closes.

Fix: `accessibilityRole="button"` plus a real label on all three branches
(`Tab: Voicing de Dm7(9) sem tônica. Opens the grid editor`, `Section: Diminutos entre
graus`), and add `accessibilityActions={[{name: 'longpress'}]}` with an
`onAccessibilityAction` that opens the line menu — RN maps that to VoiceOver's actions
rotor, which is the standard remedy for a long-press-only affordance.

This also pairs with UX-4: a long press that VoiceOver cannot reach is a long press most
sighted users have not found either.

---

## Proposals — tests that would have caught these

Everything above was found by looking at the running app. That is the pattern: three rounds
of review and a 100%-covered domain core, and what survives is what no assertion reads. The
suite in `e2e/` is well built and its `support/app.ts` is genuinely good; what it lacks is
any assertion about *geometry, appearance or completeness*.

Five specs I would add, in the order I would add them:

1. **Touch-target fence** (catches UX-2, and stops it recurring).
   One spec walking `getByRole('button')` on Compose, the reading screen, the tab editor,
   the picker and `/gallery`, asserting `width >= 44 && height >= 44` on every visible one,
   with no allow-list. `e2e/CLAUDE.md` rule 1 already says "if a flow cannot be performed
   through the UI, that is a finding"; this is the same rule applied to reachability.

2. **Open every seeded tab** (catches UX-6).
   `tabs.spec.ts` builds its grids from scratch, so no test has ever opened a tab that
   existed before the test did. Iterate the demo library, open each `{start_of_tab}` row,
   assert the grid renders and `This tab was not written by the grid editor` is absent.

3. **Token and component completeness** (catches UX-15).
   A unit test, not an e2e one: assert `TYPE_VARIANTS` in `gallery.tsx` equals
   `Object.keys(typography)` and `COLOR_ROLES` covers `Object.keys(color)`. Better still,
   derive them and delete the possibility. A second test asserting every file in
   `ui/components/` is exported from `index.ts` *and* mentioned in `gallery.tsx` would
   close the other half.

4. **A scaled-type project** (catches UX-7a mechanically).
   A second Playwright project that injects a font-size multiplier and re-runs the reading
   and compose specs, with one added assertion: `ScrollControl`'s scrollWidth does not
   exceed its clientWidth, and no two visible controls' boxes intersect. That single
   assertion is the whole of the `Play`-button failure.

5. **A screenshot baseline for the chord strip** (catches UX-1, and the class it belongs
   to). `docs/CLAUDE.md` already says `images/` holds screenshots "rendered from the real
   app… Regenerate them when the component set changes visibly". There is no chord-diagram
   image in it. One `ChordStrip` screenshot per open shape and per barre shape, compared on
   CI, would have failed the day the nut bar landed above the markers — and every future
   diagram change becomes a picture someone looks at.

## Proposals — enrichment, in priority order

1. **Diminished and augmented shapes** (UX-5). Completes D10 on the repertoire the product
   documentation is built around.
2. **Human-readable structure rows in Compose** (UX-3, UX-8). The largest single
   improvement to what the primary editor communicates, and the one that makes the app's
   own claim — "you should not have to go to raw mode" — true.
3. **A saved/unsaved indicator** (UX-10) and **replace-on-move** (UX-17). Both small, both
   about the user always being able to answer "did that work, and where am I".
4. **`Add line` in the chrome** (UX-9). The difference between writing a song and scrolling
   to the bottom of one.
5. **Level filter and local timestamps on the log screen** (UX-16.6, UX-16.7). Cheap, and
   the screen exists precisely for the moment when you are not at a laptop.

## Scope challenges — none

Nothing above requires transposition, capo, key, tempo, sync, accounts, Android or a web
client. UX-5 (diminished shapes) is the only item that adds capability rather than
correcting something, and it sits inside D10's "chord diagrams", which is a shipped v1
feature rather than a new one. If the adjudication is that D10 is closed, the fallback is
UX-5's second half alone: say *why* there is no shape.

## Not findings, checked

- `useDiscardGuard` is correct and covers the header chevron, the edge-swipe and `Close`
  alike. Driven: placing a chord then pressing `Close` gives "Discard changes? This note
  goes back to the last time it was saved." (`scratchpad/shots/29-discard.png`).
- The chord builder's undo granularity is right: `building` (`ChordPicker`/`compose`)
  collapses `D` → `Dm` → `Dm7` into one undo step, so undo removes the chord rather than
  walking back through it.
- Delete confirmations name what will be lost, including the folder's note count, and both
  put `Cancel` left of the destructive action.
- Search is debounced, cancels stale results, respects the persisted sort order, and has an
  empty state that quotes the query back.
- `ChartView` and the reading screen show no editing affordances, as `DESIGN.md` §6.4
  requires; the `Actions` control is in the header and does not travel with the scroll.
- `Text.tsx:24` gives `title` and `heading` the `header` role, so sheets and screens have
  heading navigation.
- Auto-scroll restarts from the top when played at the end of a song, stops at the end, and
  releases the wake lock; `Awake` is independent of playback and not persisted, as designed.
- `ScrollControl` disables `Play` correctly when the chart fits the screen — though it says
  nothing about why, which is the one thing I would add (a `caption` reading `Fits the
  screen` beside the readout).

## status: complete

HEAD at finish: `b32c3de`. UX-1, UX-2 and UX-6 re-verified against that commit after the
parallel fixes landed; all three still live.
