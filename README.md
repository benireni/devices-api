# qtdn

A minimalist iOS app for quick acoustic-guitar annotations: chords over lyrics, tabs, and
short audio references, organized in folders.

Design and rationale live in [`docs/DESIGN.md`](docs/DESIGN.md).

## Status

Phase 0. The note format and its parser are proven before any feature work sits on top of
them. The app currently renders one hard-coded chart to demonstrate the seam between the
domain core and the component set.

## Layout

```
packages/chordpro/   Pure TypeScript. The note format: AST, parser, serializer, queries.
apps/mobile/         The Expo app: design tokens, component set, screens.
docs/                Design document and, later, architecture decision records.
```

`packages/chordpro` imports nothing from React, React Native or Expo, and a lint rule
fails CI if that ever changes. It runs under plain Node in tests with no mocking, and
stays reusable by a web client or a server later.

## Getting started

Requires Node 22+ and, to run on a device, Xcode.

```bash
npm install
npm run check          # lint, typecheck and unit tests
npm start --workspace @qtdn/mobile
```

Expo Go is not usable here: qtdn needs native modules (share extension, SQLite), so it
runs as a development build. `npm run ios --workspace @qtdn/mobile` compiles and installs
one on a simulator or a connected device.

## Commands

| Command | What it does |
|---|---|
| `npm run lint` | ESLint across the workspace, including the architecture rules |
| `npm run typecheck` | `tsc` over the domain package and the app |
| `npm run test` | Vitest unit and property tests |
| `npm run test:coverage` | The same, with thresholds enforced |
| `npm run build:ios` | Bundles the app through Metro, exactly as a release build does |

## The note format

A note is a plain-text file in a ChordPro superset. It is the source of truth; SQLite is
a derived index, rebuildable from the files at any time.

```chordpro
{title: Tempo Perdido}
{start_of_verse: Verse 1}
[G]Todos os dias quando [D]acordo
{end_of_verse}
```

qtdn-specific directives are namespaced `x_qtdn_*` so other ChordPro tools read our files
and ignore what they don't recognize. Unknown directives round-trip unharmed, which is
what lets an older client open and save a note written by a newer one without losing data.

The property that everything else depends on is that `parse` and `serialize` are
inverses. Three editing modes — structured, tab, and raw — read and write the same AST,
so if that invariant broke, an edit made in one mode would silently corrupt the note when
saved from another. It is tested with generated charts in
`packages/chordpro/test/roundtrip.test.ts` and is not allowed to regress.
