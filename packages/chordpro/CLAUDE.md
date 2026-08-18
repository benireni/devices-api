# @qtdn/chordpro — the note format

The canonical form of a note. Everything else in qtdn is downstream of this package.

**This package is pure TypeScript.** No React, React Native, Expo, filesystem or network.
A lint rule enforces it. It runs under plain Node in tests with no mocking, and stays
reusable by a future web client or Go/Python service.

## The format

A qtdn note is a plain UTF-8 text file in a ChordPro superset.

```chordpro
{x_qtdn_id: 018f3a1c-7b2e-7000-8a41-9c2b6d5e4f01}
{title: Tempo Perdido}

{start_of_verse: Verse 1}
[G]Todos os dias quando [D]acordo
{end_of_verse}

{start_of_tab: Intro}
e|-----0-----|
{end_of_tab}
```

- Chords sit inline in brackets, immediately before the text they land on.
- Every qtdn-specific directive is namespaced `x_qtdn_*` (see `src/directives.ts`), so
  other ChordPro tools read our files and ignore what they don't recognize.
- `x_qtdn_id` is a UUIDv7 — time-sortable, generated client-side so two offline devices
  never collide, and the join key that makes phase-2 sync possible without a migration.

## Invariants

**`parse` and `serialize` are inverses.** Property-tested in both directions in
`test/roundtrip.test.ts`:

```
parse(serialize(ast))    deep-equals ast
serialize(parse(text))   === text        // for any text qtdn itself produced
```

This is the gate for everything downstream. The structured editor, the tab editor and the
raw editor all read and write the same AST, so if these disagree, an edit made in one mode
corrupts the note when saved from another — silently, noticed much later. **Never weaken
these tests to make a change pass.**

Hand-written source may be normalized on the way through (spacing inside directives, a
repaired section terminator). That is expected; parsing the normalized output is stable.

## Design decisions to preserve

- **Parsing never throws.** Problems come back as `Diagnostic[]` and the parser recovers
  by treating the offending text literally. The raw editor has to hold broken text while
  it is still being typed, and surface problems as hints rather than a wall.
- **Directives are generic, not typed fields.** There is no `capo` or `tempo` property
  anywhere — read metadata with `getDirective(chart, name)`. Unknown directives round-trip
  unharmed, so an older client cannot destroy metadata written by a newer one.
- **Tab blocks are opaque.** Held verbatim, never reflowed. Column alignment is the
  content.
- **Nodes are readonly.** Edits produce a new tree, so the editor gets undo/redo by
  retaining previous roots.

## Extending

- **New qtdn directive:** add it to `QTDN_DIRECTIVES` in `src/directives.ts` and read it
  with `getDirective`. The parser and serializer need no change — that is the point.
- **New node kind:** add it to the `Node` union in `src/ast.ts`, handle it in the parser,
  and add a case to `writeNode` in `src/serialize.ts`. The switch is exhaustive, so
  TypeScript will point at what you missed. Then extend the generators in
  `test/arbitraries.ts` so the round-trip properties actually cover it — a node kind the
  generators don't produce is a node kind that isn't tested.

Generators produce charts in *canonical* form (the shape the parser itself emits), which
is what lets the round-trip test assert exact AST equality rather than settling for
stability after one pass. Keep them canonical.
