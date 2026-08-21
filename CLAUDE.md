# qtdn

A minimalist iOS app for quick acoustic-guitar annotations: chords over lyrics, tabs, and
short audio references, organized in folders.

**v0 is complete.** Notes and folders can be created, edited, organised, played and moved
in and out of the app. Audio and video attachments are P1 and deliberately absent, which
is the one thing that would end Expo Go compatibility.

Full rationale for every decision below lives in `docs/DESIGN.md`. Read it before
proposing anything architectural.

## Languages

Kotlin, Go, JavaScript, TypeScript, Python. **Not Swift** — that constraint is why the
client is React Native rather than SwiftUI, and it is not up for renegotiation without
asking. A Share Extension will eventually need a small amount of native glue; that is the
one accepted exception.

## Layout

```
packages/chordpro/   Pure TypeScript. Format, chords, fingerings, tab grid, edits.
apps/mobile/
  src/data/          The library: files on disk, import and export.
  src/player/        Auto-scroll.
  src/observability/ Structured logging.
  src/ui/            Tokens and the closed component set.
  app/               Screens, routed by file.
e2e/                 End-to-end tests, driving the web export through its own controls.
docs/                Design document, screenshots, and later ADRs.
```

Each of those directories has its own `CLAUDE.md` with the rules that apply there.

## Rules that must not be broken

1. **`packages/chordpro` imports no platform code.** No React, React Native or Expo. It
   runs under plain Node in tests with no mocking, and stays reusable by a web client or
   a server later. A lint rule fails CI if this is violated.
2. **`parse` and `serialize` are inverses.** Three editor modes read and write one AST;
   if this breaks, edits silently corrupt notes. Property-tested in
   `packages/chordpro/test/roundtrip.test.ts`. Never weaken these tests to make a change
   pass — fix the change.
3. **The file is the truth.** A note is a ChordPro text file. SQLite is a derived index,
   rebuildable at any time. Never make the database authoritative.
4. **Colors come from tokens.** `apps/mobile/src/ui/tokens.ts` is the only file allowed to
   contain a color literal. Enforced by lint.
5. **Coverage is 100%**, on lines, statements, functions and branches, for the domain core
   and the data layer. CI fails below it.

## Chord notation

Brazilian cifra, not the English convention. **There is no `maj` anywhere in this
codebase** — not in the picker, the demo charts, the tests or the generators.

| Chord | Written | Not |
|---|---|---|
| Major triad | `D` | `Dmaj` |
| Dominant seventh | `D7` | — |
| Major seventh | `D7M` | `Dmaj7` |
| Minor | `Dm` | — |
| Minor seventh | `Dm7` | — |
| Minor/major seventh | `Dm7M` | `Dm(maj7)` |
| Half-diminished | `Dm7(b5)` | — |
| Diminished | `D°` | — |

| Slash chord | `Dm7/G` | — |

`m` means minor and nothing else. Tensions go in parentheses, lowest first, in one group:
`D7(9)`, `D7(9,13)`, `D7(#11)`.

Symbols are **built, not chosen**: `buildChord` assembles root, quality, seventh,
suspension, tensions and bass into a symbol, and `parseChord` reads one back. The set of
chords a musician might want is effectively infinite; the parts are finite. `parseChord`
returns `null` for anything outside that vocabulary rather than mangling an imported
symbol into the nearest representable chord.

The parser treats a chord as opaque text between brackets, so this is a vocabulary
decision rather than a format one.

**The picker's list and the demo charts must agree**, or the tests prove nothing about the
symbols the app actually produces. `isExactlyEditable` is the predicate and
`demo.test.ts` enforces it over every chord in the shipped library. The property-test
generators are deliberately **wider** than the vocabulary and must stay that way: their
job is proving the parser survives a chart pasted from the web, which is full of `dim`,
`aug` and `maj7`. A generator narrowed to what the picker can build would prove nothing
about the input most likely to break it.

Roots carry fifteen spellings for twelve pitches, because a passing chord is written sharp
ascending and flat descending — `C6 C#° Dm7 D#° Em7` going up, `Em7 Eb° Dm7 Db° C6` coming
back down. Both are correct, and neither is a respelling of the other.

## Out of scope — do not build these

Adding these "while we're here" is the failure mode this section exists to prevent:

- **Transposition, capo, key and tempo handling.** Not planned. The format carries such
  directives generically, so adopting them later needs no migration.
- **Sync, accounts, sharing.** v1 is local-only with manual file export/import. The schema
  carries ownership columns and tombstones so these land additively in later phases.
- **Android, web client.** iOS-first. Keep code platform-agnostic where it is free to do
  so, but do not build for other platforms.

## Coverage

The 100% bar is not about the number. It is a forcing function: every gap found so far has
been a branch that *cannot execute* — a `?? ''` behind a length check, an `if (!frame)`
after `length > 0`. Each one was deleted by restructuring the code rather than chased with
a test that could not be written.

So when coverage fails, the first question is "is this branch reachable?". If it is not,
remove it. If it is, test it. **Lowering the threshold is not the third option.**

Only three things are excluded, and all three have no logic to cover: type-only files, the
composition root, and the Expo filesystem binding, which cannot run under Node. Adding to
that list needs the same justification — no logic, not merely inconvenient to reach.

Screens and components are deliberately outside coverage. They are reviewed by looking at
them, which is what `app/gallery.tsx` and the screenshots in `docs/images/` are for — and
driven end-to-end from `e2e/`, which is where integration bugs surface. Coverage proves
each unit does what it says; it says nothing about whether they are wired together.

## Commands

```bash
npm install
npm run check         # lint + typecheck + tests
npm run lint
npm run typecheck
npm run test          # or test:coverage, which enforces thresholds
npm run e2e           # drives the real app in a browser; needs a chromium
npm run build:ios     # bundles through Metro, exactly as a release build does
```

## Conventions

- Conventional Commits. One coherent change per commit; commits are pushed unsquashed.
- Commit messages explain *why*, not what the diff already shows.
- Tests before UI for anything in the domain layer.
- Never commit an `.env` or any credential.
