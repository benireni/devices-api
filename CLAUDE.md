# qtdn

A minimalist iOS app for quick acoustic-guitar annotations: chords over lyrics, tabs, and
short audio references, organized in folders.

**Phase 0.** The note format and its parser are proven before feature work sits on them.
The app renders one hard-coded chart to demonstrate the seam between layers.

Full rationale for every decision below lives in `docs/DESIGN.md`. Read it before
proposing anything architectural.

## Languages

Kotlin, Go, JavaScript, TypeScript, Python. **Not Swift** — that constraint is why the
client is React Native rather than SwiftUI, and it is not up for renegotiation without
asking. A Share Extension will eventually need a small amount of native glue; that is the
one accepted exception.

## Layout

```
packages/chordpro/   Pure TypeScript. The note format: AST, parser, serializer, queries.
apps/mobile/         The Expo app.
docs/                Design document, screenshots, and later ADRs.
```

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

## Out of scope — do not build these

Adding these "while we're here" is the failure mode this section exists to prevent:

- **Transposition, capo, key and tempo handling.** Not planned. The format carries such
  directives generically, so adopting them later needs no migration.
- **Sync, accounts, sharing.** v1 is local-only with manual file export/import. The schema
  carries ownership columns and tombstones so these land additively in later phases.
- **Android, web client.** iOS-first. Keep code platform-agnostic where it is free to do
  so, but do not build for other platforms.

## Commands

```bash
npm install
npm run check         # lint + typecheck + tests
npm run lint
npm run typecheck
npm run test          # or test:coverage, which enforces thresholds
npm run build:ios     # bundles through Metro, exactly as a release build does
```

## Conventions

- Conventional Commits. One coherent change per commit; commits are pushed unsquashed.
- Commit messages explain *why*, not what the diff already shows.
- Tests before UI for anything in the domain layer.
- Never commit an `.env` or any credential.
