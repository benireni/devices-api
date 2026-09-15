# Round 4 — Agent 2 — Functional requirements review

status: COMPLETE
HEAD at start: 2653a26 (branch claude/qtdn-design-planning-sdhse4)
Lens: functional requirements — is what is specified what is built, and does it work?

Findings are appended as they are confirmed. Labels: **defect** / **risk** / **preference**.
Severity: Critical / High / Medium / Low.

---
## FN-1 Lyric text typed in the app is written unescaped, so `[`, `#` and `{` become syntax · **Critical** · defect

**CONFIRMED** at the domain level and traced to a UI path. This is a violation of rule 2 of
the root `CLAUDE.md` ("parse and serialize are inverses") reachable from the app's own
structured editor, with silent lyric loss.

### The path

`apps/mobile/app/compose/[id].tsx:485-498` — `LineEditor` is an unvalidated free-text
`TextField`. Its value goes to `onEditDone`, `:196-200`:

```tsx
onEditDone={(text) => {
  const node = lyricAt(lines ?? [], index);
  replace(index, node === null ? text : renderLine(setText(node, text)));
  setEditing(null);
}}
```

`renderLine` is `serialize({ nodes: [line] })` (`:564-566`), and `setText`
(`packages/chordpro/src/edit.ts:161-188`) copies the string into `Segment.text` verbatim.
`serialize` (`packages/chordpro/src/serialize.ts:37-43`) writes `segment.text` verbatim.
There is no escape anywhere in the package — `grep -rn 'escap' packages/chordpro/src`
returns nothing. The resulting line is saved to the file by `save()` at `:131-153`.

Note also the `node === null` arm: for a non-lyric line (a directive or fence reached
through long-press → "Edit text") the typed text is written into the file **completely
raw**, with not even a `setText` in the way.

### Reproduction

`/tmp/claude-0/.../scratchpad/r4/fn1c.mjs` replays the compose screen's exact pipeline
(`lyricAt` / `setText` / `renderLine` / `replace`) against the real package. Actual output:

```
=== bracket typed into a lyric
  before file : "...{start_of_verse: Verse 1}\n[F7M]Olha que coisa mais linda\n..."
  user typed  : "Olha [bis] que coisa mais linda"
  saved file  : "...\n[F7M]Olha [bis] que coisa mais linda\n..."
  what compose shows back (plainText of that line): "Olha  que coisa mais linda"
  slots       : [{"c":"F7M","t":"Olha"},{"c":null,"t":" "},{"c":"bis","t":" "},
                 {"c":null,"t":"que"}, ...]
```

The word `[bis]` is **gone from the lyric** and has become a chord symbol `bis` hovering
over a space. The chart the musician reads now says `Olha  que coisa mais linda`. Nothing
is logged and no diagnostic is raised (`diagnostics: []`).

```
=== hash typed into a chordless lyric
  user typed  : "#1 hit do verao"
  saved file  : "#1 hit do verao"
  line is no longer a lyric — node kind: comment
```

`ChartView.tsx:28-30` renders `comment` and `directive` as nothing ("Metadata and comments
are read by the app, not shown while playing"), so the line **disappears entirely** from
the reading view.

```
=== directive-shaped lyric
  user typed  : "{refrao 2x}"
  line is no longer a lyric — node kind: directive     -> also invisible in the reader
```

Worst structural case, same script:

```
=== section-opening lyric
  user typed  : "{start_of_chorus}"    (into a line inside {start_of_verse})
  saved file  : "...\n[G7(9)]{start_of_chorus}\n{end_of_verse}"
```
and typed into a chordless line it produces a bare `{start_of_chorus}`, which reparses as
`[{"kind":"section","name":"chorus","label":null,"children":[]}]` plus an
`unclosed-section` diagnostic — i.e. one typed lyric restructures the document.

Raw round-trip proof (`fn1b.mjs`, chordless line, `parse(serialize(ast)) !== ast` in every
case):

| typed | AST after `setText` | reparsed as |
|---|---|---|
| `Olha [bis] que coisa` | one segment, text `Olha [bis] que coisa` | two segments, chord `bis` |
| `#1 hit do verao` | lyric | `comment` |
| `{refrao 2x}` | lyric | `directive` |
| `{start_of_chorus}` | lyric | `section` (+ unclosed-section) |
| `{end_of_tab}` | lyric | `directive` (+ unmatched-section-end) |
| `` (empty) | lyric, one empty segment | `blank` |
| `   ` (spaces) | lyric | `blank` |

### Why the property test does not catch it

`packages/chordpro/test/arbitraries.ts:55`:

```ts
const LYRIC_CHARS = Array.from('abcdefghijklmnopqrstuvwxyzáéíóúãõç ,.!?\'-');
```

`[`, `]`, `#`, `{` and `}` are all excluded, so `roundtrip.test.ts` never generates a
lyric that can express this. The file's own header says generators produce *canonical*
charts — which is a legitimate choice for the parse/serialize pair — but it means the
package has **no test that `setText`'s output is canonical**. `setText` is the one function
in the package that takes arbitrary user text into the AST, and it is the one that can
leave the canonical set. `edit.test.ts` has no such closure property either (checked).

This is the gap, precisely stated: the invariant is proved over the set the parser emits,
and `setText` can produce ASTs outside that set.

### Severity

Critical. Silent data loss in the primary artefact (the lyric), in the app's default
editor, on input a Brazilian songbook actually contains (`[bis]` is standard notation for
"repeat", `2x`, `{...}` stage directions). "The file is the truth" (rule 3) makes it
permanent — the next open reads the corrupted file.

### Fix, stated as options

1. **Escape on the way out** — `serialize` writes `\[`, and `parse` reads it back; requires
   a format change and a note in `chordpro/CLAUDE.md`. Cleanest, but it is a superset
   extension other ChordPro tools will not read the same way.
2. **Refuse, per the package's own rule** ("Refuse rather than guess"): make `setText`
   reject text it cannot represent, or have the compose screen validate the field and
   surface a hint — consistent with `parseChord`/`parseTabGrid` returning `null`.
3. **Sanitise at the editor boundary** — strip/substitute the metacharacters, which loses
   the user's text silently and is the worst of the three.

Whichever is chosen, the enforcing test is a new property: for arbitrary `text: string`,
`parse(serialize({nodes:[setText(line, text)]}))` deep-equals `{nodes:[setText(line, text)]}`
— or `setText` refuses. That test fails today.

### Proposed regression tests
- `packages/chordpro/test/edit.test.ts`: the closure property above, `fc.string()` unrestricted.
- `e2e/`: type `Olha [bis] que coisa` in compose, save, reopen, assert the lyric reads back
  verbatim. Half-written spec preserved at
  `/tmp/claude-0/.../scratchpad/agent2-bracket-probe.spec.ts`.

---

**Checked and sound — chord vocabulary.** Probe `scratchpad/r4/vocab.mjs` against the real
package. All 12 rows of the notation table in the root `CLAUDE.md` build, parse and
`isExactlyEditable` exactly as written (`D`, `D7`, `D7M`, `Dm`, `Dm7`, `Dm7M`, `Dm7(b5)`,
`D°`, `Dm7/G`, `D7(9)`, `D7(9,13)`, `D7(#11)`) — 0 mismatches. Enumerating the whole
builder space (17 roots x 4 qualities x 4 sevenths x 3 suspensions x {no tension, each
single tension} x {no bass, bass}) gives 16320 symbols, **0 containing `maj`**, **0 that
`parseChord` refuses**, **0 that are not `isExactlyEditable`**. All 36 two-tension
combinations are exactly editable too. `buildChord`'s output set is closed under
`parseChord`/`normalize`, which is the property the picker depends on.

Foreign symbols are refused rather than mangled, as `packages/chordpro/CLAUDE.md` requires:
`Dmaj`, `Dmaj7`, `Dm(maj7)`, `Ddim`, `Daug`, `D6/9`, `Dsus`, `Cb`, `E#`, `Dadd9`, `N.C.`,
`Dm7b5`, `D/`, `D//G`, `D7(9`, `` all give `parseChord === null`.
`C+7`, `C°7M`, `C7(13,9)` and `D7(b5,#5)` parse (readable) but are correctly **not**
`isExactlyEditable`, which is the documented split between "can be read" and "can be
edited".

---

**Note on numbering.** While this review was running the main session updated
`docs/reviews/round-4.md` and claimed FN-2 ("round-trip generator excludes the characters
that break the round trip" — the `LYRIC_CHARS` point I folded into FN-1 above) and FN-3
("a newline pasted into a title truncates the directive"). To avoid collision my own
numbering continues at **FN-4**.

## FN-4 `DESIGN.md` §6.1 specifies the picker in English convention, contradicting the locked cifra rule · **Medium** · defect (documentation)

`docs/DESIGN.md:277-280`:

> To place a chord: tap the syllable, and a chord picker opens — a root wheel (C…B, with
> sharps/flats) plus **a quality strip (maj, min, 7, m7, maj7, sus2, sus4, dim, aug)** and
> an optional bass note for slash chords. Tap places, long-press on a placed chord edits
> or removes it.

The root `CLAUDE.md:54-55` says the exact opposite, as an absolute:

> Brazilian cifra, not the English convention. **There is no `maj` anywhere in this
> codebase** — not in the picker, the demo charts, the tests or the generators.

This is not a harmless stale sentence, because `docs/CLAUDE.md` sets the precedence
explicitly:

> `DESIGN.md` records decisions and their reasoning. Directory-level `CLAUDE.md` files
> record the rules that follow from those decisions. **When they disagree, `DESIGN.md` is
> the intent and the `CLAUDE.md` is stale.**

So the documented resolution of this conflict points a reader at `maj7`, `dim` and `aug`
— the one vocabulary the codebase exists to refuse. `DESIGN.md`'s own stale-marker at the
top names only §5.1 and §10, so §6.1 reads as current.

The code is right: `ChordPicker.tsx:1-16` imports `NOTES`/`QUALITIES`/`SEVENTHS`/
`SUSPENSIONS`/`TENSIONS` from the package and builds the symbol, and `chord.ts:46-54` has
no `maj`, `dim` or `aug` in any of them. §6.1 also describes a *list* of qualities, which
is the enumerate-everything approach `chord.ts:1-12` was written to replace, and
"long-press on a placed chord edits or removes it" is not the gesture that shipped
(`compose/[id].tsx:451-458`: tap opens the picker, long-press opens the *line* menu).

**Fix:** rewrite §6.1's picker sentence in cifra terms (root / quality / seventh /
suspension / tensions / bass, built not chosen), or add §6.1 to the stale-marker list at
the top of the file with a pointer to the notation table. Severity is Medium rather than
Low because the doc precedence rule makes this actively misleading rather than merely
out of date, and the `maj`-free rule is enforced by nothing but people reading it.

---

## FN-5 `DESIGN.md` §6.3 specifies two raw-mode behaviours that do not exist, one of which cannot exist · **Low** · defect (spec/code drift)

`docs/DESIGN.md:294-298`:

> Full-screen monospace editor over the ChordPro source, **with syntax highlighting for
> directives and chord brackets**. Parse errors surface inline as non-blocking warnings —
> raw mode is allowed to hold invalid text while you type, and **only refuses to save if
> the document doesn't parse**.

Neither holds in `apps/mobile/app/edit/[id].tsx`:

- **Syntax highlighting**: `:76-78` renders a bare `<TextField source .../>`; `TextField.tsx:24-41`
  is a plain `TextInput` with one flat `color: color.text`. No highlighting anywhere.
- **Refusing to save**: `save()` at `:47-57` never consults `diagnostics`. It cannot: the
  package's own contract (`parse.ts:11-16`, "Never throws… the result always covers the
  entire input") means "doesn't parse" is not a state that exists. `:41` states the
  shipped policy — "Diagnostics are advisory while typing" — which is the *better*
  decision, but it is the opposite of what §6.3 says and no ADR records the change.

Not a correctness defect in the code — flagged because §6.3 is the section a future
contributor would implement against, and one of its two requirements is unsatisfiable by
construction. **Fix:** amend §6.3 to say diagnostics are always advisory and never block a
save (with the "parse never throws" reason), and either drop syntax highlighting or move
it to a roadmap item. `docs/adr/` exists for exactly this and is empty.

---

**HEAD moved during this review.** `git rev-parse --short HEAD` is now `59160ca`
("docs(review): agent 2's lead was right, and worse than it looked"), and the working tree
carries the main session's **uncommitted** fix for FN-1: a new
`packages/chordpro/src/escape.ts`, edits to `parse.ts` / `serialize.ts` / `arbitraries.ts`
/ `parse.test.ts`, and a new `test/escape.test.ts`. FN-1 above was proved against the
pre-fix code and stands as the record of the defect. Everything from FN-6 on is measured
against the **working tree as it stands now**, escape fix included.

## FN-6 The in-flight escape fix is defeated by one leading space · **High** · defect

The new `escapeLyricText` (`packages/chordpro/src/escape.ts:37-51`) escapes `{` and `#`
only at the very first character of the line:

```ts
const opensTheLine = index === 0 && atLineStart && (character === '#' || character === '{');
```

But `parseDirective` (`packages/chordpro/src/parse.ts:219-222`) **trims before testing**:

```ts
function parseDirective(raw: string): RawDirective | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}') || trimmed.length < 2) {
```

So a lyric that begins with any whitespace before the `{` is written unescaped and read
back as a directive — the original FN-1 defect, unchanged, one space away.

Reproduction: `scratchpad/r4/hole.mjs`, run against the working tree, going through
`setText` (the compose screen's own path):

```
BREAK  setText "  {refrao 2x}"
   ast  : {"kind":"lyric","segments":[{"chord":null,"text":"  {refrao 2x}"}]}
   file : "  {refrao 2x}"
   back : [{"kind":"directive","name":"refrao 2x","value":null}]

BREAK  setText " {start_of_chorus}"
   ast  : {"kind":"lyric","segments":[{"chord":null,"text":" {start_of_chorus}"}]}
   file : " {start_of_chorus}"
   back : [{"kind":"section","name":"chorus","label":null,"children":[]}]
```

A leading tab does it too (`"\t{refrao}"` -> `directive`). The line still vanishes from the
reader (`ChartView.tsx:28-30`), and the `{start_of_chorus}` case still swallows the rest of
the document into a section.

`#` is **not** affected, because the parser's comment test at `parse.ts:88` is
`raw.startsWith('#')` on the untrimmed line, so `  #1 hit` stays a lyric — confirmed `OK`
in the same run. That asymmetry between the two checks is the actual trap: the escape rule
was written to match one of them.

### Why the new property test does not catch it

`arbitraries.ts:79-81` is unchanged by the fix:

```ts
const nonBlankLyricText = fc
  .tuple(fc.constantFrom(...LYRIC_CHARS.filter((c) => c !== ' ')), lyricText)
  .map(([first, rest]) => first + rest);
```

The first character of a chordless lyric line can never be a space, so the generator cannot
express the one input that breaks it. `LYRIC_CHARS` was correctly widened to include
`[]{}#\` — and the filter one line below re-narrows it in exactly the spot that matters.
`vitest run packages/chordpro` on this working tree: **243 passed**, including the widened
round-trip property. The generator is still shaped around the defect, which is the
criticism the fix's own comment (`arbitraries.ts:55-60`) makes of the previous generator.

Note that a leading space in a lyric *is* canonical — `parse('  hello')` yields
`{chord:null,text:'  hello'}` — so this is inside the set the property is supposed to cover,
not an exotic hand-built AST.

### Fix
Make the escape rule agree with the parser's own test rather than with a guess about it.
Either escape the first *non-whitespace* character when it is `{` (and keep `#` at index 0,
matching `parse.ts:88`), or — cleaner — have the parser decide: expose one predicate that
both `escapeLyricText` and `parseDirective`/the comment check consult, so the two can only
ever agree. Then drop the `.filter((c) => c !== ' ')` from `nonBlankLyricText` and replace
it with a filter on what the *parser* would reject (a line that trims to empty), which is
the honest statement of "non-blank".

## FN-7 A whitespace-only or empty lyric line still round-trips to `blank` · **Medium** · defect

Same run, same working tree:

```
BREAK  whitespace-only lyric
   ast : {"kind":"lyric","segments":[{"chord":null,"text":"   "}]}
   file : "   "
   back : [{"kind":"blank"}]
BREAK  empty lyric
   ast : {"kind":"lyric","segments":[{"chord":null,"text":""}]}
   file : ""
   back : [{"kind":"blank"}]
```

`parse.ts:83-86` turns any line that trims to empty into a `blank` node, and `serialize`
writes a whitespace-only lyric as-is, so `parse(serialize(ast))` is not `ast`. Reachable
from the UI: clearing a line's text in the compose editor and pressing Done
(`compose/[id].tsx:196-200`) produces exactly this AST.

Impact is lower than FN-6 — the compose screen already treats a blank source line as an
empty lyric (`compose/[id].tsx:542-547`, `EMPTY_LINE`), so nothing visibly breaks today,
and a chord placed on such a line is written as `[C]` which parses back as a lyric. But it
is a live counterexample to the invariant in `packages/chordpro/CLAUDE.md`, and it is the
reason the generator has to keep `nonBlankLyricText` — i.e. FN-6 and FN-7 have to be fixed
together or the narrowing stays.

**Fix options:** treat a whitespace-only lyric as `blank` inside `serialize`/`compose` so
the AST cannot hold one (model so the impossible cannot be written — the package's own
second rule); or have `parse` emit `blank` only for a genuinely empty line and keep
whitespace-only lines as lyrics. The first is smaller and matches how the editor already
behaves.

---

## FN-8 "Add line" writes a lyric *inside* a tab block, which then cannot be edited or deleted · **High** · defect

`packages/chordpro/src/lines.ts:163-179`, `appendPoint`:

```ts
  const name = directiveName(previous);
  const closes = name === null ? null : sectionEndName(name);

  return closes === null ? lines.length : index - 1;
```

The intent (documented at `:156-162`) is "the end of the last open block, not the end of
the file", so a new line lands inside the verse rather than after `{end_of_verse}`. But
`sectionEndName('end_of_tab')` returns `'tab'`, not `null` — a tab fence is a section end
too — so the same rule inserts the new line **inside the tab block**.

### How it is reached

`app/tab/[id].tsx:118-119` appends a new tab at the very end of the note:

```ts
    if (start < 0) {
      next = [...lines, '', ...block];
```

so after "Add tab" the note ends with `{end_of_tab}`. The next "Add line"
(`app/compose/[id].tsx:227-233`) calls `appendPoint`, inserts `''` there, and immediately
opens the editor on it — and `Line` checks `editing` **before** `inTab`
(`compose/[id].tsx:392-406`), so the user is given an ordinary lyric field with nothing
saying where the text is going.

### Reproduction

`scratchpad/r4/appendpoint.mjs`, against the real package, on a note whose last block is a
six-row tab:

```
lines.length            : 11
appendPoint()           : 10   -> the line currently there: "{end_of_tab}"
is that inside the tab? : true

file after Add line + "uma linha nova" + Save:
   9 "E|-------------------|"
  10 "uma linha nova"
  11 "{end_of_tab}"

tab block body rows     : 7 (the grid needs exactly 6)
parseTabGrid(...)       : null
=> tab editor shows     : "This tab was not written by the grid editor" — permanently unreadable
chart node kinds        : ["directive","directive","blank","tab"]
```

### Why it does not self-correct

1. The lyric is now tab content. `ChartView` renders a `tab` node's lines verbatim in
   monospace, so on the playing screen the words appear as a seventh string.
2. `parseTabGrid` (`tab.ts:61-62`, `lines.length !== STRINGS.length`) refuses the block
   forever, so `tab/[id].tsx:81-87` shows "This tab was not written by the grid editor" and
   **disables Save and Undo** (`:315`, `:324`). The grid editor is lost for that block.
3. The line cannot be removed from compose either: the `inTab` branch at
   `compose/[id].tsx:398-405` renders

   ```tsx
     <Pressable onPress={onTab} style={styles.tabBody}>
   ```

   with **no `onLongPress`**, so the line menu — the only route to Delete — is unreachable
   for any line inside a tab. `removeLine` would handle it correctly if it could be called.

The only recovery is the raw editor, which `apps/mobile/CLAUDE.md` and `DESIGN.md` §6.3
both describe as the escape hatch the app is not supposed to push you toward.

### Fix
`appendPoint` should treat a tab end as the end of the file, not as a block to append
inside: `return closes === null || closes === TAB_SECTION ? lines.length : index - 1;`
(`TAB_SECTION` is already imported in `lines.ts:2`). A tab block's contents are opaque by
the module's own rule, so appending into one is never right.

Worth pairing with: give the `inTab` row an `onLongPress={onEdit}` so a stray line inside
a block can be deleted without the raw editor, and add `insideTab` to the guard that
decides whether `setEditing` may open a text field at all.

### Proposed tests
- `packages/chordpro/test/lines.test.ts`: `appendPoint` returns `lines.length` when the
  last non-blank line is `{end_of_tab}`; and a property — for any `lines`,
  `tabOwners(lines)[appendPoint(lines)] === null`.
- `e2e/`: add a tab, then Add line, then reopen the tab and assert the grid renders rather
  than the "not written by the grid editor" notice.

---

### FN-8 addendum — the fix should state the invariant, not patch the symptom

A property probe (`scratchpad/r4/edits.mjs`) found a second way in that the narrow fix
misses: `appendPoint` also lands inside an **unclosed** tab when a later `end_of_*` closes
something else. Counterexample from 20k runs:

```
appendPoint lands inside a tab :
  {"lines":["[C]abc","","{end_of_tab}","[C]abc","{end_of_tab}","","{start_of_tab}","e|--|","{end_of_verse}"],
   "at":8}
```

so the fix is better written as the invariant itself, which is also the test:

```ts
const at = /* existing computation */;
return tabOwners(lines)[at] === null ? at : lines.length;
```

Property: `for any lines, tabOwners(lines)[appendPoint(lines)] === null`. That fails today
and passes with the guard.

---

## Checked and sound

**`setText` chord tracking** (`edit.ts:161-188`). 5k-run properties in
`scratchpad/r4/edits.mjs`: a pure append never moves or drops a chord (chord map identical
before and after), and no edit ever *invents* a chord (the chord count after `setText` is
never greater than before). The prefix/suffix diff does what its comment claims.

**`moveLine` / `removeLine` fence balance** (`lines.ts:31-57`). 20k runs over generated
line arrays: neither operation orphans a fence, **except** on input whose fences already
cross (`{start_of_verse} … {start_of_tab} … {end_of_verse} … {end_of_tab}`), where deleting
the verse fence takes the tab's opening fence with it and strands `{end_of_tab}`. Crossed
fences are only producible through the raw editor, and `removeLine`'s documented rule is
"takes the whole block with it", so this is a consequence of already-malformed input rather
than a defect. Noted rather than filed.

**Fingerings** (`fingering.ts`). Spot-checked the derived shapes against the instrument:
`F` -> E-form barre at 1, `B` -> A-form barre at 2, `C6` -> A-form at 3, `E7M` -> open
`[0,2,1,1,0,0]`, `Cm7(b5)` -> `[null,3,4,3,4,null]` (C, F#, Bb, Eb — a correct
half-diminished). `shapeKey` correctly returns `null` for every spec where a plain shape
would be a lie: any bass, any suspension, any tension other than the half-diminished `b5`,
and `°`/`+`. `parseChord` accepting `C°7M` and `C+7` does not leak a wrong diagram, because
`shapeKey` refuses both.

**`serialize(parse(t))` is total and stable.** 20k-run fuzz over text built from the
characters a web-pasted chart actually contains (`scratchpad/r4/fuzz-rt.mjs`): it never
throws, is idempotent after one pass, and `parse(serialize(parse(t)))` always deep-equals
`parse(t)`. The two `throw`s in `serialize` (`:52`, `:62`) are unreachable from `parse`,
because `readTabBlock` consumes its own terminator and `start_of_tab` never becomes a
`section` node — they guard hand-built ASTs only, which is the right place for them.

**Adversarial inputs** (`scratchpad/r4/adversarial.mjs`): `{end_of_tab}` inside a tab body,
nested `start_of_tab`, uppercase fences, a labelled `{end_of_tab: Intro}`, indented fences,
unclosed tab and unclosed verse at EOF, crossed fences, nested same-name sections, empty
file, lone `\n`, CRLF, BOM, combining marks, emoji, RTL and zero-width characters, NBSP,
a 50,000-character line, 2,000 chords on one line, `[]`, `[C[9]]`, `{}`, `{:}`,
`{title: a: b: c}` — **none throws and none drifts in the AST**. The normalizations that
occur are the documented ones (fence case and indentation, a dropped `{end_of_tab}` label,
a repaired terminator, `{:}` -> `{: }`, BOM stripped). CRLF is handled at the import
boundary by `transfer.ts:54`, which is the right place given tab blocks are byte-exact.

**Chord vocabulary** — see the earlier entry. 16320 built symbols, 0 with `maj`, closed
under `parseChord`/`normalize`.

**Picker / demo agreement.** `apps/mobile/src/data/__tests__/demo.test.ts:59-74` walks
every chord in the seeded library through `isExactlyEditable` and asserts no offenders;
`:37-51` pins the extended harmony the screenshots claim. The rule in the root `CLAUDE.md`
is checked, not merely asserted. The only chord literals outside the demo are in `e2e/`
(`C°7M`, `C7(13,9)`), and those are deliberate not-exactly-editable probes.

**Search and sort.** `search.ts:16-21` folds NFD + `\p{Diacritic}` + case, so `cancao`
finds `canção`; `matches` requires every term and returns `false` for an empty query, which
is what lets the caller distinguish "no search" from "no results". `query.ts:56-81`
searches the *reader's* text, so `can[D7(b9)]ção` is findable, and skips `x_qtdn_*` values
so a hex fragment does not match every note through its id. `sortNotes` (`ordering.ts:34-49`)
is deterministic on duplicate titles (`Array.prototype.sort` is stable and the input is
folder- then filename-ordered), reads creation order out of the UUIDv7 rather than storing
a second timestamp, and sorts an unknown `updatedAt` last rather than to the epoch.
`readOrder` narrows an unknown stored value.

**Undo.** `editing/history.ts` — bounded at `DEPTH = 50`, a no-op commit is dropped, and
`amend` is what makes a multi-tap chord build one undo step. Redo's absence is a recorded
decision (`:8-11`), not an omission.

**Auto-scroll semantics.** `player/scroll.ts` — `MIN_SPEED = 5` so "playing" always moves,
`advance` returns a fractional offset so slow speeds are not rounded to zero,
`MAX_FRAME_MS` caps a backgrounded gap, `hasReachedEnd` stops a finished song, and
`shouldResync`'s 1px threshold keeps the loop from chasing its own echo. `readSpeed`
falls back to the default for absent or non-numeric `x_qtdn_scroll`, and clamps.
Speed is persisted into the note; awake deliberately is not, with the reason recorded.

**Tombstones are correctly absent.** The brief asks about them; `DESIGN.md:222-226` says in
so many words "**Not built in Phase 1.** The library scans the filesystem directly… The
schema below is the target". `library.ts:18-25` agrees. The root `CLAUDE.md`'s "The schema
carries ownership columns and tombstones" reads as present tense about a schema that does
not exist yet, which is mildly misleading, but no code is wrong.

---

## FN-9 `rename` does not disarm the pending speed write, unlike `remove` and `move` · **Low** · risk

`app/note/[id].tsx:99-115` arms a 600 ms timer holding the note's whole text in
`unsaved.current`. Both destructive actions explicitly disarm it first, with the reason
written down (`:157-160`):

```ts
  async function remove() {
    // The pending speed write still holds this note's text and its old folder. …
    unsaved.current = null;
```
```ts
  async function move(destination: string) {
    unsaved.current = null;
```

`rename` (`:137-155`) does not. If the timer is still armed when the rename is written, it
fires afterwards with the pre-rename text and **the new title is lost**; the unmount flush
at `:118-122` does the same on a fast exit. `rename` also builds from `source.current`,
which the timer has not yet advanced to `unsaved.current`, so a pending speed change is
dropped the other way — the exact failure the comment at `:138-141` says it is avoiding.

The window is 600 ms and the rename flow (Actions -> Rename -> type -> submit) is longer
than that, so this is a latent inconsistency rather than an observed bug. Filed because the
other two call sites treat it as a real hazard and this one does not, which is how a
`SETTLE_MS` increase or a slower device turns it into one.

**Fix:** in `rename`, read `unsaved.current ?? source.current ?? note.source` as the base,
and set `unsaved.current = null` before saving — the same two lines the other two have.
Same shape applies to the share action at `:302-306`, whose `.then()` has no rejection
handler (adjacent to NF-7; not filed separately).

## FN-10 `x_qtdn_id` is written but never read, so the file and its name can diverge unnoticed · **Low** · risk

`packages/chordpro/CLAUDE.md` and `DESIGN.md:129-130` both call `x_qtdn_id` "the join key
that makes phase-2 sync possible". A grep for every reader shows it is written in three
places (`library.ts:165`, `demo.ts:90`, `transfer.ts:56`) and **read in none** — identity
comes from the filename (`library.ts:230-231`, `:263-267`).

That is a defensible v1 choice and mostly self-consistent: import re-stamps the directive
(`prepareImport`), so the app's own paths keep the two in step. The gap is that nothing
notices when they drift. The raw editor saves bytes verbatim (`library.ts:185-191`), so a
user can edit or delete the `{x_qtdn_id}` line and the note keeps working, silently
exporting with a wrong or missing id — and phase 2's join key is then wrong from the start.
Related to NF-12, which covers the non-UUID *filename* half of the same seam.

**Fix (cheap, and useful now):** in `Library.readFolder`, compare
`getDirective(chart, QTDN_ID)` with the filename id and `log.warn('note.id.mismatch', …)`
when they differ. It costs nothing (the chart is already parsed there), and it turns a
phase-2 data problem into a line in the log viewer today.

---

## Proposed tests

Ordered by what they would have caught.

1. **`packages/chordpro/test/edit.test.ts` — the closure property `setText` has never had.**
   For arbitrary unrestricted `fc.string()` and any starting line,
   `parse(serialize({nodes:[setText(line, text)]}))` deep-equals `{nodes:[setText(line, text)]}`.
   Catches FN-1, FN-6 and FN-7 in one assertion, and is the honest statement of what the
   editor is allowed to write.
2. **`arbitraries.ts` — drop `.filter((c) => c !== ' ')` from `nonBlankLyricText`** and
   replace it with a filter on what the parser actually rejects (text that trims to empty).
   The current filter is the reason the widened `LYRIC_CHARS` does not catch FN-6.
3. **`packages/chordpro/test/lines.test.ts` — `tabOwners(lines)[appendPoint(lines)] === null`**
   as a property, plus the concrete case of a note ending `{end_of_tab}`. Catches FN-8.
4. **`e2e/specs/editing.spec.ts` — a leading space.** The three new syntax tests all start
   the lyric at column 0; add `'  {refrão 2x}'` and `'  [bis] no começo'`. One space is the
   whole of FN-6.
5. **`e2e/specs/editing.spec.ts` — add a tab, then Add line**, then reopen the tab and
   assert the grid renders rather than "This tab was not written by the grid editor".
   Catches FN-8 at the level a user meets it.
6. **`e2e` — a lyric inside a tab block can be deleted.** Long-press a tab body row and
   expect the line menu; today that row has no `onLongPress` at all.
7. **`apps/mobile/src/data/__tests__/transfer.test.ts` — an import corpus.** A real
   UltimateGuitar chords-over-words paste, a CRLF file, a file with a BOM, a file with no
   `{title}`, and a 0-byte file: assert each imports, keeps its text, and re-exports
   unchanged on a second pass. `DESIGN.md` §4.4 describes a foreign-format importer
   (`chordsheetjs`) that is not built and has no ADR recording the change; until that is
   settled, a corpus is what pins the behaviour that actually ships.
8. **A rename/speed interleaving test** for FN-9, driving `rename` while the settle timer
   is armed.

---

status: complete
Final HEAD observed: **821a0de** — the escape fix has since been committed. FN-6, FN-7 and
FN-8 were re-run against that commit and all still reproduce, unchanged:

```
BREAK  setText "  {refrao 2x}"      -> directive
BREAK  setText " {start_of_chorus}" -> section
OK     setText "  #1 hit"
BREAK  setText "   "                -> blank
BREAK  setText ""                   -> blank
appendPoint() : 10 -> "{end_of_tab}"   is that inside the tab? true
parseTabGrid(...) : null  => "This tab was not written by the grid editor"
```

FN-1 was measured against 2653a26, before the fix, and is the record of the original
defect. FN-4, FN-5, FN-9 and FN-10 are unaffected by the fix.
