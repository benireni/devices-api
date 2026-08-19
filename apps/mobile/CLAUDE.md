# @qtdn/mobile — the iOS app

Expo (React Native, TypeScript), iOS-first. Design system rules live in
`src/ui/CLAUDE.md`.

## How this runs

React Native renders **real native views** driven by JavaScript. Expo is a distribution of
React Native: a curated set of native modules with one API, plus the build tooling. Metro
is the bundler — it takes TypeScript and JSX and emits a JS bundle (Hermes bytecode for
release). Hermes is the engine that runs it on device.

An installed app is a native shell plus that bundle. In development the bundle is served
from your machine with fast refresh; in a release build it is embedded in the `.ipa`.

**Expo Go works today, and will stop working.** Expo Go is a pre-built sandbox containing
a fixed set of native modules. Every dependency qtdn currently has — including
`expo-sqlite` — is in that set, so scanning a QR code is the fastest route to a phone
right now.

The Voice Memos **share extension** is what ends this. Expo Go cannot host a native module
it was not built with, so at that point qtdn moves to a **development build**: our own
native shell, built once, that then loads JS the same way.

```bash
npm start --workspace @qtdn/mobile      # dev server — Expo Go or a dev build
npm run ios --workspace @qtdn/mobile    # compile and install a dev build
```

Do not cite SQLite as a reason for the dev build; it is not one.

Native projects are generated, not hand-edited. `app.json` is the source of truth and
`expo prebuild` regenerates `ios/`. Never edit generated Xcode files — the change will be
silently discarded. Native behavior is added through config plugins instead.

## Monorepo wiring

`metro.config.js` is configured explicitly because the app imports `@qtdn/chordpro`
straight from TypeScript source outside the app directory: `watchFolders` covers the
workspace root, `nodeModulesPaths` covers both locations, and hierarchical lookup is
disabled so resolution stays predictable.

**Relative imports in `packages/` must be extensionless.** Metro does not rewrite
`./parse.js` to `./parse.ts`, and the base tsconfig uses `moduleResolution: "bundler"`,
so `from './parse'` is the form that works in Metro, tsc and Vitest alike.

## Routing

`expo-router`, file-based over react-navigation. A file in `app/` is a route; `_layout.tsx`
is the shell. Give every screen a real title via `<Stack.Screen options={{ title }} />`,
or it falls back to the file name.

- `app/index.tsx` — placeholder song screen; the folder list replaces it in Phase 1.
- `app/gallery.tsx` — the component gallery. Grow the component set here first.

## Fonts

Loaded in `app/_layout.tsx` via `useFonts`, with the splash screen held until they
resolve; text renders invisible until then. Font loading failure hides the splash anyway
and degrades to a system fallback rather than hanging. Adding a weight means editing
`src/ui/fonts.ts` and `src/ui/tokens.ts` together.

## CI

`npm run build:ios` bundles through Metro exactly as a release build does, which catches
broken imports and cross-package resolution the type checker cannot see. It deliberately
stops short of an `.ipa`: that needs a macOS runner and Apple credentials, and belongs
with EAS when the app goes to TestFlight.
