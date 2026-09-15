# Round 4 — Agent 4: code smells, open lens

status: complete
HEAD at start: 2653a26 (branch claude/qtdn-design-planning-sdhse4)
Reviewer: Agent 4 (no assigned scope — "whatever smells")

Findings are appended as they are confirmed. Labels: **defect** / **risk** / **preference**;
severity Critical / High / Medium / Low.

---

## Findings

### SM-1 A rename within the speed debounce window is silently reverted in the file · **defect** · Low (downgraded from Medium after probing — see the result below)

*Recorded first as a hypothesis from the code, then probed in the browser. The probe
result and the downgrade from Medium to Low are at the end of this entry.*

`apps/mobile/app/note/[id].tsx:101-118` debounces the speed write by `SETTLE_MS = 600`
(`:28`) and parks the not-yet-written text in `unsaved.current`. Two of the three actions
that rewrite the same file defuse it; the third does not.

`remove()` `:162-171`:
```ts
    // The pending speed write still holds this note's text and its old folder. Left
    // armed, the unmount flush below would write the file straight back after the
    // delete, or leave a second copy at the old path after a move.
    unsaved.current = null;
```
`move()` `:173-174`: same line. `rename()` `:142-160`: **no such line**, and no other
defence.

Why the two siblings are safe and rename is not: `remove` and `move` end in `router.back()`,
which unmounts the screen and runs the speed effect's cleanup `clearTimeout(timer)` (`:115-117`),
so only the explicit unmount flush (`:121-126`) could still fire — and that is what they
null. `rename` stays on the screen, so **the timer is still armed**. Its callback
(`:109-113`) closes over `updated`, the pre-rename text:

```ts
    const timer = setTimeout(() => {
      source.current = updated;
      unsaved.current = null;
      void library.saveNote(id, from, updated);
    }, SETTLE_MS);
```

So for a rename completed under 600 ms after the last `Faster`/`Slower` tap: rename writes
title+speed, then at t=600 ms the timer writes back the *old title* with the new speed and
resets `source.current` to it. `setNote` (`:157`) has already put the new title in state,
so the header shows the new name while the file on disk holds the old one — and the library
list, which reads the file, shows the old one too.

The e2e test that exists for precisely this bug class, `e2e/specs/notes.spec.ts:192-206`
("keeps a speed that was set moments before a rename"), does not reach the window: it goes
tap -> `expect(text('35'))` -> open sheet -> fill field -> tap, which in practice exceeds
600 ms, so the timer has already fired and `source.current` is current. Contrast
`notes.spec.ts:81-118`, where the same author deliberately *did* exercise the sub-600 ms
path for delete and move. The rename test is shaped to pass rather than to catch.

Note also that a fix of `unsaved.current = null` inside `rename` would **not** be enough —
the live `setTimeout` is the thing that writes. The pending write has to be cancelled or
rebased onto the renamed text.

### SM-2 `apps/mobile/CLAUDE.md` still states a Metro override that was deleted · **defect** (doc) · Low

`apps/mobile/CLAUDE.md:37-41`:
> `metro.config.js` is configured explicitly because the app imports `@qtdn/chordpro`
> straight from TypeScript source outside the app directory: `watchFolders` covers the
> workspace root, `nodeModulesPaths` covers both locations, **and hierarchical lookup is
> disabled so resolution stays predictable.**

`apps/mobile/metro.config.js` is 18 lines and contains no such setting. Commit `4312918`
("fix(metro): drop the hierarchical-lookup override expo already handles") removed
`config.resolver.disableHierarchicalLookup = true;` and updated `README.md`, but not the
`CLAUDE.md` that asserts it. `grep -rn hierarchical` over the repo returns exactly one hit
and it is the stale sentence.

Scar tissue from a recent fix: the instruction file an agent is told to trust now describes
a resolution strategy the bundler does not use — and the reason the line gives ("so
resolution stays predictable") is the opposite of the commit's reason for removing it
("the kind of override that works until a fresh install hoists something differently").

**Empirical result — SM-1 confirmed as a real mechanism, but narrow. Downgraded to Low.**

Probe: `/tmp/claude-0/-home-user-devices-api/8969ce88-37de-5b42-8c7f-fee65144d9e2/scratchpad/probe-sm1.mjs`,
driving the real web export through the same DOM a thumb would (no internals touched
except an init script that widens the one 600 ms `setTimeout` — the app has only two,
600 ms here and 200 ms for search debounce, so the lever is unambiguous).

With the debounce widened to 8000 ms, so the rename lands inside the window (at +739 ms):

```
speed before: true
rename completed at +739ms after last speed tap
--- folder rows after the timer fired ---
[ 'Acordes de passagem' ]
has OLD title row: true
has NEW title row: false
speed shown on reopen: [ '35' ]
```

The rename is gone; the speed survived. Exactly the predicted clobber.

With the real 600 ms debounce and the same script, the rename took 725 ms of wall clock in
headless chromium on a fast machine — just outside the window — and the rename stuck:

```
rename completed at +725ms after last speed tap
has OLD title row: false
has NEW title row: true
speed shown on reopen: [ '35' ]
```

**Verdict:** the defect is real in code and provably reproduces when the window is open,
but opening a sheet, typing a title and submitting inside 600 ms is not something a thumb
on a phone does. Severity **Low**, kind **defect**. Its value is (a) the asymmetry with
`remove`/`move`, which is a live invitation for the next person to add a fourth
file-rewriting action without the guard, and (b) the observation that the test written for
this exact bug class never enters the window it is named after.



### SM-3 `reset` is `begin` under a second name, kept alive by its own test · **preference** · Low

`apps/mobile/src/editing/history.ts:62-65`:
```ts
/** Replaces the document without recording a step — for loading, not editing. */
export function reset<T>(present: T): History<T> {
  return begin(present);
}
```

`grep -rn '\breset\b'` over `apps/`, `packages/` and `e2e/` returns exactly two code hits
for this symbol: the definition, and `apps/mobile/src/editing/__tests__/history.test.ts:3,59`.
**No screen calls it.** Both editors load through `begin`
(`app/compose/[id].tsx:78,137`; the tab editor likewise).

The abstraction has a whole rule written about it in `apps/mobile/src/editing/CLAUDE.md`:
> - **`reset` is for loading, not editing.** Replacing the document on open must not leave
>   a step that would undo back into the previous note.

…a rule governing a function nobody calls, sitting in the instruction file the next agent
is told to obey. And the test that keeps it alive:

```ts
  it('resets without leaving a step behind', () => {
    const edited = commit(begin('a'), 'b');
    const loaded = reset('fresh');
    expect(canUndo(loaded)).toBe(false);
```
asserts a property of `begin`, through an alias. It proves nothing `begin`'s own tests do
not already prove.

This is the 100%-coverage rule honoured in letter and defeated in spirit — not by lowering
a threshold but by the opposite move: the threshold makes an unused export *require* a
test, and a test was written for it rather than the export being deleted. The root
`CLAUDE.md` says the right question when coverage bites is "is this branch reachable? If it
is not, remove it." The same question applied to an unreachable *export* answers the same
way.

Fix: delete `reset` and its test, and the bullet in `editing/CLAUDE.md`. If the intent was
that loading must not be `commit`, that intent is already carried by `begin`'s name and by
how both editors use it.

### SM-4 An orphaned doc comment now documents the wrong function · **defect** (comment) · Low

`apps/mobile/app/compose/[id].tsx:500-505`:
```ts
/** Documents are new arrays on every edit, so identity is not a useful comparison. */
/** Whether a source line carries words, as opposed to metadata or a fence. */
function isLyric(source: string): boolean {
  const node = parse(source).chart.nodes[0];
  return node !== undefined && node.kind === 'lyric';
}

function sameLines(a: readonly string[], b: readonly string[]): boolean {
```

Two doc comments stacked on one function, and the first belongs to the second function
down. `git log -S` confirms the sequence: the "Documents are new arrays" line was written
for `sameLines` in `1d9ff9a` ("feat: add undo to the structured and tab editors"), and
`c418032` ("fix(screens): the flows a guitarist actually walks") inserted `isLyric`
*between* the comment and the function it described. `sameLines` is now undocumented and
`isLyric` carries a sentence about array identity that has nothing to do with it.

Trivial to fix, and worth fixing precisely because this file is where the reviewer looks
for the reasoning behind the fixes — a comment pointing at the wrong function is a comment
that will be trusted about the wrong thing.

### SM-5 `openTab` awaits a save with no catch, and a failure silently eats the tap · **defect** · Medium

`apps/mobile/app/compose/[id].tsx:162-172`:
```ts
  async function openTab(line?: number) {
    if (lines !== null && dirty) await library.saveNote(id, folder ?? null, lines.join('\n'));
    const query = [ ... ];
    router.push(`/tab/${id}${query.length === 0 ? '' : `?${query.join('&')}`}`);
  }
```
Called as `void openTab(...)` from three places (`:208`, `:239`, and the `Add tab` button
at `:239`).

If `saveNote` rejects, the `await` throws, `router.push` never runs, and `void` swallows
the rejection: **the user taps "Add tab" and nothing happens at all** — no navigation, no
message, and nothing in the log. `problem` is never set. Every other save site in this same
file is wrapped: `save()` at `:131-153` catches, logs `note.save.rejected` and sets
`problem` with the explicit comment "Never navigate away from work that was not written."
`openTab` is the one save in the file that does not, and it is the save whose whole purpose
(`:155-161`) is "committing first is what makes two writers safe".

It also produces an unhandled promise rejection, which the e2e fixture
(`e2e/support/fixtures.ts:16`) would report as "the app raised no runtime errors" failing —
i.e. it is a defect the harness is set up to catch but no test provokes.

This is a distinct site and a distinct failure mode from agent 3's NF-7 (which lists
`note/[id].tsx:112,:123,:310` and `index.tsx:46`, all genuinely fire-and-forget). Here the
result is a dead control and a divergent buffer, not just an unlogged write. **NF-7's fix
list should be extended with `compose/[id].tsx:166`.**

### SM-6 Two independent `.chordpro` constants, in the two files that must agree · **risk** · Low

`apps/mobile/src/data/library.ts:27`:
```ts
const EXTENSION = '.chordpro';
```
`apps/mobile/src/data/transfer.ts:5`:
```ts
export const EXTENSION = '.chordpro';
```

Same value, same name, two declarations, in the same directory. `library.ts` uses its copy
to decide what counts as a note when scanning (`:230`), to recover the id from a filename
(`:231`) and to build every note path (`:267`); `transfer.ts` uses its copy to name an
exported file (`:32`) and `share.ts:60` logs it. Each has its own tests.

What makes it a smell rather than a nit: **the neighbouring constant was already
de-duplicated on purpose.** `library.ts:29-30`:
```ts
/** The directive carrying a note's identity, shared with import. */
export const QTDN_ID = QTDN_DIRECTIVES.id;
```
and `transfer.ts:3` imports it. The pattern for "a constant these two files must agree on"
exists in this exact pair of files; the file extension is the one that did not get it.
Change one and export starts producing files the scanner will not list.

Fix: delete `library.ts:27`, import `EXTENSION` from `./transfer` — or move both to a
shared module if the dependency direction is wrong.

### SM-7 The Sort control silently changes *which* notes are listed, not only their order · **preference** · Medium

`apps/mobile/app/index.tsx:63`:
```ts
  const listed = order === 'title' ? notes.filter((note) => note.folder === null) : notes;
```
and `:169`:
```tsx
            <Section label={order === 'title' ? 'Notes' : 'All notes'}>
```

One control, labelled "Sort: …" (`:114`), governs two orthogonal things: the ordering and
the *scope* of the list. In `Title` order the library shows unfiled notes only; in
`Recently added` / `Recently edited` it shows every note in the library, filed ones
included, alongside the folder rows that already contain them.

Confirmed by the suite's own assertions, which encode it as intended:
- `e2e/specs/library.spec.ts:4-10` — default (Title) order: only `Ideia de sábado`, the
  unfiled note, is asserted visible.
- `e2e/specs/library.spec.ts:119-128` — after `Sort: Title -> Recently edited`, `Corcovado`
  (which lives in `Repertório`) is now a row on the library screen.

The reasoning is recorded in `c418032` and in the comment at `:59-62`, and it is sound as
far as it goes ("what was I working on last night" should not be hidden by filing). But
the resulting object is a control whose label describes half of what it does, and a section
heading that has to rename itself to cover for it. Two notes can vanish from the screen
because the user changed a sort.

This is one decision doing two jobs because there was no place to put the second one. The
honest shapes are either a scope control beside the sort ("Unfiled / Everything"), or
dropping the filter entirely and letting all three orders list everything. **Stated as a
preference**, and it touches UI, so it may overlap agent 1's lane — recorded here because
it is a case of the design fighting itself rather than of anything looking wrong.

### SM-8 `readNote` stats the file for a field no caller of `readNote` reads · **preference** · Low

`apps/mobile/src/data/library.ts:146-150`:
```ts
    return {
      ...summarize(id, folder, chart),
      updatedAt: await this.files.modifiedAt(path),
      source,
    };
```
`updatedAt` has exactly one consumer in the app: `ordering.ts:83-87`, the `edited` sort,
which operates on the `NoteSummary[]` inside a `LibrarySnapshot`. No screen reads
`updatedAt` off the `Note` that `readNote` returns — `grep -rn updatedAt apps` shows every
non-test hit is in `library.ts`, `ordering.ts` or `ports.ts`.

So every note open pays an extra sequential store round-trip for a dead field, and the note
screen opens on *every focus* (`app/note/[id].tsx:70-83`), as do compose, tab and the raw
editor. This corroborates agent 3's NF-10 ("`modifiedAt` is only consumed by the `edited`
sort order") at a second site NF-10 does not name; worth folding into the same fix.

### SM-9 Two more unguarded `void async` calls, same class as SM-5 · **risk** · Low

`apps/mobile/app/index.tsx:84-90`:
```ts
  async function newNote(title: string) {
    setProblem(null);
    setNaming(false);
    const id = await library.createNote(null, title.trim());
    await reload();
    router.push(`/compose/${id}?new=1`);
  }
```
called as `void newNote(title)` (`:193`). No `try`/`catch`, while `importFile` directly
above it (`:66-82`) catches, logs `note.import.failed` and sets `problem` — with a comment
saying exactly why ("It used to say nothing, and the only record was a log screen with no
way into it"). `createNote` writes to disk through `ensureFolder` + `write`, either of which
can reject; the sheet has already closed by then, so the user sees the sheet dismiss and
nothing happen.

`apps/mobile/app/folder/[name].tsx` should be checked for the same shape.

### SM-10 A folder name is logged four lines below the comment forbidding it — and this refutes one of agent 3's negative results · **defect** · Medium

`apps/mobile/app/folder/[name].tsx:31-42`, in full:
```ts
  async function rename(next: string) {
    try {
      await library.renameFolder(name, next);
      // Folder names are song and album names. `observability/CLAUDE.md`: never log content.
      log.info('folder.renamed', {});
      setRenaming(false);
      router.replace(`/folder/${encodeURIComponent(next.trim())}`);
    } catch (cause) {
      log.error('folder.rename.rejected', cause, { from: name });
    }
```

`:34-35` goes out of its way to log an **empty object** rather than the name, citing the
rule by file. `:39`, in the same function, puts the name in `data` as `from`.

It leaks twice over, because `cause` is interpolated too. `library.ts:291-296`:
```ts
function assertFolderName(name: string): string {
  const clean = name.trim();
  if (clean === '' || INVALID_FOLDER.test(clean)) {
    throw new Error(`"${name}" is not a valid folder name.`);
```
and `library.ts:214-216`:
```ts
    if (await this.files.exists(this.folderPath(clean))) {
      throw new Error(`A folder named "${clean}" already exists.`);
```
`Logger.error` (`observability/logger.ts:57-62`) runs the cause through `describe`, which
returns `` `${cause.name}: ${cause.message}` ``. So the *new* folder name lands in `reason`
and the *old* one in `from` — the complete rename, in a log the user can export and share
through `logs.tsx`.

`observability/CLAUDE.md` states the rule without qualification:
> - **Never log note content.** Titles, lyrics and chords stay on the device. `data` carries
>   ids, counts, durations and outcomes.

Every other call site obeys it: `library.ts:190` logs `{ id, bytes }` not the source;
`:175` logs `folder: 'root' | 'filed'` rather than the folder name; `folder/[name].tsx:46`
logs `{ notes: notes.length }`. `:39` is the single exception in 33 call sites.

**Challenge to the dossier:** agent 3's negative results end with "No PII in any log call
site." That is wrong, and `folder/[name].tsx:39` is the counterexample, with the
project's own comment on the line above it as the adjudication. (I am not disputing the
rest of agent 3's negatives — see "what I checked and found sound" below, where several
of them are independently confirmed.)

Fix: `log.error('folder.rename.rejected', undefined, {})`, or keep the cause but make the
two `Library` errors carry a code rather than the name, leaving the user-facing message to
be composed at the screen (which is where it is displayed anyway, `folder/[name].tsx:40`).

### SM-11 The one mechanically enforced design rule guards colors only — and the hole has already been fallen into · **defect** · Low

`apps/mobile/app/_layout.tsx:65-72`:
```tsx
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: color.background },
            headerTintColor: color.text,
            headerTitleStyle: { fontFamily: 'Fraunces_700Bold' },
            contentStyle: { backgroundColor: color.background },
          }}
        />
```

Three of the four values come from tokens. The fourth is a hardcoded typeface —
and it is `fontFamily.display` verbatim (`src/ui/tokens.ts:87`). The file already imports
`{ color } from '@/ui/tokens'` at `:11`; the fix is one word.

`grep -rn "Fraunces\|Newsreader\|JetBrains" apps/mobile` returns exactly one hit outside
`tokens.ts` and `fonts.ts`: this line. So it is the only place in the app that names a
typeface directly, which is what makes it a scar rather than a pattern.

Why it survived: `eslint.config.mjs:16-17,74-87` defines the design-token rule over colors
only —
```js
const COLOR_LITERAL = String.raw`/^(#(?:[0-9a-fA-F]{3,4}|...)|(?:rgb|rgba|hsl|hsla)\(.*)$/`;
```
— while `src/ui/CLAUDE.md` claims a broader scope:
> `tokens.ts` is the single source of truth for color, spacing, radius, typefaces and the
> type scale.
> **Enforcement is mechanical, not a matter of discipline.** "Always enforced" cannot rest
> on review, so the rules below are lint rules that fail CI.

Four of the five token families rest on discipline; one is enforced. Discipline has already
failed once, in the app's root layout, which is the first file anyone reads.

Two smaller holes in the same rule, neither currently exploited (so: **risk**, not defect):
a CSS **named** colour (`'black'`, `'white'`, `'transparent'`) is not matched by
`COLOR_LITERAL`, and the selector matches `Literal` only, so a template literal escapes.
I grepped `apps/mobile` for named colours and found none — the rule is honoured in
substance today.

Fix: add a `no-restricted-syntax` entry for `Property[key.name='fontFamily'] > Literal`
outside `tokens.ts`, and extend `COLOR_LITERAL` with the CSS named colours actually worth
banning.

> **Note on HEAD.** HEAD moved during this review: `2653a26` -> `a435323`
> (`59160ca` docs, `a50141a` lint ignores, `a435323` the FN-1 escaping fix). All citations
> below were re-checked against `a435323`. At the time of writing the working tree also
> carries an in-flight experiment by another agent — `packages/chordpro/src/escape.ts` has
> `escapeLyricText` reduced to `return atLineStart ? text : text;`, evidently to demonstrate
> a test gap for FN-6. **That is not committed and is not mine; I have left it alone.** My
> browser probes ran against a web export built from `2653a26`, which predates both the
> escaping fix and that experiment; nothing I report depends on either.

### SM-12 The tab editor records undo steps for edits that change nothing — the one thing `editing/CLAUDE.md` says undo must never do · **defect** · Medium

`apps/mobile/src/editing/CLAUDE.md` states the rule:
> - **Equality is the caller's business.** Documents are new arrays or objects on every
>   edit, so reference identity is never the right comparison. Pass the comparison that
>   suits the document; `commit` drops a no-op edit so undo never appears to do nothing.

`history.ts:32` makes the default explicit:
```ts
export function commit<T>(history: History<T>, present: T, equal: (a: T, b: T) => boolean = Object.is): History<T> {
```

The structured editor obeys it — `app/compose/[id].tsx:90` passes `sameLines`. The tab
editor does not. `app/tab/[id].tsx:47-49`:
```ts
  const edit = (next: TabGrid) => {
    setHistory((current) => commit(current, next));
  };
```
No comparator, so `Object.is` is used — and `setFret` (`packages/chordpro/src/tab.ts:93-104`)
spreads a fresh object on every call, so reference identity is *always* false. `commit`'s
no-op guard can never fire in this editor.

**Reproduced in the browser** against the real web export
(`scratchpad/probe-tab2.mjs`, `probe-tab3.mjs` — Corcovado -> Edit -> Add tab):

```
Undo disabled on a fresh grid: true
dash count unchanged: true (49)
=> Undo ENABLED after a no-op clear: true
after Undo, dash count still: 49
```
Selecting an already-empty cell and pressing **Clear this position** (`tab/[id].tsx:271-280`)
changes nothing on screen, yet arms Undo — and pressing Undo then does nothing.

```
after first write, dashes: 48
grid identical after the duplicate write: true
one Undo leaves the grid exactly as it was: true
Undo still enabled -> a second step for the same state: true
```
Writing fret 5 into the same cell twice (easy: `place()` at `:100-109` advances the
selection, so correcting a mis-aimed tap means re-selecting the cell you already wrote)
records **two** steps. One Undo appears to do nothing; the second is the one that works.

`editing/CLAUDE.md`'s own words for this: "produces an undo that skips a step, which is
worse than no undo — the user presses it and something they did not expect comes back."

The existing spec does not reach it: `e2e/specs/tabs.spec.ts:39-54` ("undoes a fret") writes
one fret and undoes it, which is the case that works.

Fix: give `edit` a structural comparator, the way `compose` does — e.g.
`commit(current, next, sameGrid)` where `sameGrid` compares `columns` and each row's frets.
`@qtdn/chordpro` is the natural home for it, beside `setFret`.

### SM-13 The only tab in the shipped demo library is one the app's own tab editor refuses to open · **defect** · Low

`apps/mobile/src/data/demo.ts:65-72`:
```ts
    '{start_of_tab: Voicing de Dm7(9) sem tônica}',
    'e|--5--|',
    ...
```
Cells are **five** characters wide. `packages/chordpro/src/tab.ts:16` fixes them at three
(`const CELL_WIDTH = 3`) and `parseTabGrid` (`:72`) rejects any body whose length is not a
multiple of it. Verified directly:

```
parseTabGrid(demo) = null
what the editor writes: ["e|----5----|","B|---------|", …]
re-parses: true
```

So tapping the demo's tab block in the structured editor lands on
"This tab was not written by the grid editor…" (`app/tab/[id].tsx:200-216`), with Save and
Undo disabled. A first-run user's only tab cannot be edited by the tab editor, and the
screenshots in `docs/images/` — which `demo.test.ts:10-13` says this seed exists to render
— show a tab in a format the app itself does not produce.

Not a deliberate choice, as far as the history shows: `8459f59` ("seed the demo library
with Jobim charts") predates `2a48449` ("add the tab grid editor") by eleven commits, so the
hand-written spacing was simply never revisited when the grid format arrived.

What makes it a smell rather than cosmetic is the asymmetry with the chord rule. The root
`CLAUDE.md` says:
> **The picker's list and the demo charts must agree**, or the tests prove nothing about the
> symbols the app actually produces.
and `demo.test.ts:59-74` enforces exactly that with `isExactlyEditable`. The identical
argument applies to tabs — the grid editor's list and the demo's tabs must agree — and
there is no `parseTabGrid(...) !== null` assertion anywhere over the seeded library.

Instead, `e2e/specs/tabs.spec.ts:125-137` ("leaves tab it did not write alone") *uses* the
demo tab as the fixture for the refuse path, which quietly converts an accident into a
fixture and closes the question. Every other tab test has to press `Add tab` first
(`:11, :29, :44, :61, :80`), because there is no readable tab in the library to open.

Fix, cheapest first: re-render the demo block at three-character cells, add the
`parseTabGrid` assertion to `demo.test.ts` beside the chord one, and give the
"leaves tab it did not write alone" spec a fixture it writes itself (as
`tabs.spec.ts:105-123` already does for the wide-tab case).

### SM-14 A tap on the playback speed control rewrites the whole note through the parser — from the screen documented to have no editing affordances at all · **defect** · Medium

`apps/mobile/app/note/[id].tsx:101-113`:
```ts
  useEffect(() => {
    const current = source.current;
    if (current === null) return;
    if (readSpeed(getDirective(parse(current).chart, 'x_qtdn_scroll')) === speed) return;

    const updated = serialize(setDirective(parse(current).chart, 'x_qtdn_scroll', String(speed)));
```
`serialize(parse(...))` is a full round-trip of the note, not a targeted edit, and its
result is written back with `library.saveNote`. `serialize`'s own contract
(`packages/chordpro/src/serialize.ts:5-11`) says what that costs:
> Input written by hand may be normalized (spacing inside directives, a repaired section
> terminator)

Two documented intentions are in tension with this:

`apps/mobile/src/ui/CLAUDE.md`:
> `ChartView` renders a parsed chart read-only. It is **the performance surface, so it
> shows no editing affordances at all.**

and `note/[id].tsx:193-200`, the comment justifying moving Delete off this screen:
> This screen is the performance surface and it auto-scrolls…

`apps/mobile/src/data/CLAUDE.md`:
> - **`saveNote` writes bytes verbatim.** Do not round-trip through the parser on save: the
>   raw editor holds partially-typed text, and normalizing it mid-keystroke would rewrite
>   what the user is in the middle of writing.

`saveNote` is kept honest; the reading screen simply does the round-trip itself before
calling it. The rule is satisfied in letter at the layer it names and defeated one caller up.

**Reproduced end to end in the real app** (`scratchpad/probe-norm.mjs`), driving only the
UI — Estudos -> Acordes de passagem -> Actions -> Source, change `{title: ` to `{title:`,
Save, back, then **one tap on `Faster`**:

```
raw editor kept it verbatim: true
after one tap on Faster, title directive is: {title: Acordes de passagem}
still verbatim: false
scroll directive written: true
```

A unit-level check of the same path shows it also *inserts a line the user never wrote*:

```
--- BEFORE ---                          --- AFTER one tap on Faster ---
{title:Wave}                            {title: Wave}
{ artist :  Tom Jobim }                 {artist: Tom Jobim}
                                        {x_qtdn_scroll: 30}
{start_of_verse}                        {start_of_verse}
[D7M]Vou te contar                      [D7M]Vou te contar
{end_of_chorus}                         {end_of_chorus}
                                        {end_of_verse}     <-- appended by the repair
```

So a user who fixed a pasted chart by hand in the raw editor, then went to the reading
screen and nudged the scroll speed, finds their text reformatted and a fence added. The
one screen the design insists must not edit the note is the screen that reformats it.

Reachability today is via the raw editor (the only path that writes non-canonical bytes —
`createNote` and `prepareImport` both emit canonical text), and it widens the moment
`UIFileSharingEnabled` lands and files arrive from the Files app.

Fix: write the directive as a line edit on the source text rather than through
`parse`/`serialize` — `setDirective` already operates on a chart, so what is missing is a
source-level equivalent. Or accept the round-trip and say so in `note/[id].tsx` and
`data/CLAUDE.md`, rather than leaving two documents asserting the opposite.

(Related but separate from agent 3's NF-7, which is about the same two `saveNote` calls
being unlogged. This is about what is being written, not whether the write is observed.)

---

## Corrections and challenges to the dossier

1. **NF-10 / "No PII in any log call site" — refuted.** See SM-10.
   `apps/mobile/app/folder/[name].tsx:39` logs a folder name in `data`, four lines under a
   comment citing the rule that forbids it, and the `cause` it also logs carries the *new*
   folder name from `library.ts:206` / `:294`.
2. **NF-12's citation is wrong.** It says export names files after the song at
   "`transfer.ts:221`". `apps/mobile/src/data/transfer.ts` is 57 lines long; the function is
   `exportFilename` at `:25-33`. The claim is correct, the line reference is not.
3. **NF-7's fix list is incomplete.** It names `note/[id].tsx:112,:123,:310` and
   `index.tsx:46`. Also unguarded, with a worse failure mode: `compose/[id].tsx:166`
   (SM-5), `index.tsx:84-90` and `folder/[name].tsx:44-49` and `:62-67` (SM-9). And
   `new-folder.tsx:13-20` catches but does not log — the only catch in the app that
   swallows the reason entirely:
   ```ts
       } catch (cause) {
         setError(cause instanceof Error ? cause.message : 'Could not create that folder.');
       }
   ```
4. **I did not re-open the coverage question.** Agent 3's reading of it matches mine on the
   evidence I gathered incidentally (`npm run check` at `2653a26`: exit 0, 100/100/100/100
   across `packages/chordpro/src` and `apps/mobile/src/data`). SM-3 is not a challenge to
   that — it is a case where the *policy works as designed* and the designed outcome was a
   test written to keep an unused export alive, rather than the export being deleted.

## What I looked at and found genuinely sound

Stated because criticism is only worth reading if the reviewer also says what is good.

- **`packages/chordpro` chord vocabulary — the picker/demo agreement rule is real, not
  decorative.** `ChordPicker.tsx:1-16` builds every chip row from `NOTES`, `QUALITIES`,
  `SEVENTHS`, `SUSPENSIONS`, `TENSIONS` exported by `chord.ts`, so `isExactlyEditable`
  (`chord.ts:254-257`) genuinely tests the picker and not a parallel list. `parseChord` does
  keep its *own* longest-match orderings (`['m','°','+']`, `['7M','7','6']`,
  `['sus4','sus2']`) — a candidate for divergence — but `chord.test.ts:96-125` property-tests
  `buildChord`/`parseChord` over specs drawn from the exported constants, so adding a
  quality without teaching the parser fails immediately. Checked and sound.
- **Rule 4, colors from tokens.** Every colour reference in `apps/mobile/app` and
  `apps/mobile/src/ui` resolves through `color.*`; I found no literal and no CSS named
  colour anywhere outside `tokens.ts`. The lint rule has holes (SM-11) but nothing has
  fallen into the colour ones.
- **The closed component set is actually closed.** All sixteen components exported from
  `src/ui/components/index.ts` are imported by `app/gallery.tsx:6-23`. The rule in
  `ui/CLAUDE.md` ("Add it to `app/gallery.tsx`") is unenforced by lint and honoured anyway.
- **`useDiscardGuard`** (`src/hooks/useDiscardGuard.ts`) is the right shape: it hangs off
  `beforeRemove`, which covers the header chevron and the edge-swipe as well as the Close
  button, and its comment says exactly why. The unsubscribe is returned correctly and the
  blocked action is replayed rather than reconstructed.
- **`history.ts`** is a clean immutable model — `DEPTH` bounding in `commit` is correct
  (`past.slice(Math.max(0, past.length - DEPTH))`), `amend` is the right primitive for the
  chord builder's multi-tap act, and the absence of redo is argued rather than forgotten.
  Only `reset` (SM-3) and the tab editor's missing comparator (SM-12) let it down.
- **`readSpeed` / `clampSpeed` / `advance`** (`player/scroll.ts`) — the `MAX_FRAME_MS` cap,
  the float-in-a-ref offset and `shouldResync`'s one-pixel deadband are each justified by a
  named failure, and `MIN_SPEED = 5` rather than 0 is exactly the kind of decision that
  usually gets lost. I re-derived the arithmetic and could not find a hole. Agent 3's
  positive verdict on the keep-awake single-owner lock matches mine.
- **`Library`'s path handling.** `folderPath`/`notePath` are the only two places a path is
  concatenated and both validate, with the comment at `library.ts:250-258` explaining why
  guarding the callers instead would be bypassable. `INVALID_FOLDER` covers separators and
  `^\.+$`. `isNoteId` gates every note path.
- **The e2e suite's own design.** `support/app.ts` encodes the three real traps (a sheet
  over its opener, a sheet still on screen while it slides away, rows whose accessible name
  includes the subtitle) in one place, and the "assert, do not sleep" rule is kept — the
  three `waitForTimeout` calls in `notes.spec.ts` are each accompanied by a comment saying
  the wait *is* the subject. That is the right exception.
- **`escape.ts` / the FN-1 fix** landed while I was reviewing (`a435323`) and reads sound:
  the asymmetry between writing (always double a backslash) and reading (escape only what
  is escapable) is argued from a concrete failure, and the cost is stated. Agent 2 owns this
  area and I deliberately stayed out of it.

## Summary

| # | Finding | Kind | Sev |
|---|---|---|---|
| SM-1 | Rename inside the 600 ms speed debounce is reverted; `rename` lacks the guard `remove`/`move` have | defect | Low |
| SM-2 | `apps/mobile/CLAUDE.md` still states a Metro override deleted in `4312918` | defect (doc) | Low |
| SM-3 | `reset` is `begin` renamed; its only caller is the test that keeps it covered | preference | Low |
| SM-4 | Orphaned doc comment now documents `isLyric` instead of `sameLines` | defect (comment) | Low |
| SM-5 | `compose.openTab` awaits a save with no catch — a failed save silently eats the tap | defect | Medium |
| SM-6 | Two independent `.chordpro` constants in the two files that must agree | risk | Low |
| SM-7 | "Sort" also changes which notes are listed | preference | Medium |
| SM-8 | `readNote` stats the file for `updatedAt`, which no caller of it reads | preference | Low |
| SM-9 | Three more unguarded `void async` actions; one catch that never logs | risk | Low |
| SM-10 | A folder name is logged four lines below the comment forbidding it | defect | Medium |
| SM-11 | The one mechanically enforced design rule covers colours only; `_layout.tsx:69` hardcodes a typeface | defect | Low |
| SM-12 | The tab editor records undo steps for edits that change nothing | defect | Medium |
| SM-13 | The only tab in the shipped demo library is one the tab editor refuses to open | defect | Low |
| SM-14 | A tap on the speed control rewrites the whole note through the parser, from the read-only performance surface | defect | Medium |

status: **complete**
