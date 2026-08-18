# qtdn — Design Document

> Status: design locked, pre-implementation.
> A minimalist iOS app for quick acoustic-guitar annotations: chords over lyrics, tabs,
> short audio references, organized in folders.

---

## 1. Scope

**What qtdn is.** A note-taking app for guitarists. A note is a song chart: chords
positioned over lyrics, optional tab blocks, optional short audio references. Notes live
in folders. Everything is editable on an iPhone with one hand.

**What qtdn is not (v1).** Not a collaboration tool, not a cloud service, not a tab
marketplace, not a DAW. No accounts, no server, no network calls.

**Design values, in priority order.**

1. **The format outlives the app.** Notes are plain text you could read in a terminal in
   ten years. Every other decision bends to this one.
2. **Clean annotations are structurally enforced,** not encouraged by convention.
3. **Boring, legible architecture.** A new contributor — or you in eight months — should
   be able to find any behavior by reading directory names.
4. **Offline is the normal case,** not a degraded mode.

---

## 2. Decisions

| # | Decision | Choice | Why |
|---|---|---|---|
| D1 | Client framework | Expo / React Native / TypeScript | Only mature iOS-quality path in the available languages. Native text input, real share extensions, strong media ecosystem. |
| D2 | Platform reach | iOS-first, web kept viable | Domain logic stays platform-agnostic so a web client is weeks, not a rewrite. |
| D3 | Sync (v1) | None. Local storage + manual file export/import | Ships the editor fastest. IDs and revisions present from day one so sync is additive. |
| D4 | Note format | ChordPro superset, plain text, raw-editable | Diffable, portable, hand-editable, and exactly what the future ML phase emits. |
| D5 | Organization | Flat folders, single level | A note has one home. Matches a library of hundreds, not millions. |
| D6 | Attachments | Short audio reference clips only | Keeps the export bundle light and device storage a non-issue. |
| D7 | Primary editor | Tap-to-place chords over lyrics | Structurally prevents malformed charts. |
| D8 | Tab editor | Dedicated monospace grid editor | Tabs are a six-string grid, not chords-on-syllables. Separate concern. |
| D9 | Raw access | Full raw ChordPro read/write mode | The paste-from-web path, the parser debugging path, the escape hatch. |
| D10 | v1 guitar features | Chord diagrams, hands-free auto-scroll | Transposition/capo built into the domain layer but not surfaced. |
| D11 | Aesthetic | Dark-first, stage-friendly | Readable at arm's length in a dim room. |
| D12 | Design enforcement | Tokens + closed component set + lint rules | Mechanical enforcement, not discipline. |
| D13 | Observability | Structured local logs + in-app viewer + Sentry | Real diagnostics on a device with no debugger attached. |
| D14 | Distribution | TestFlight, personal use | No review friction while the shape is still moving. |
| D15 | Backend (phase 2) | Go + Postgres + S3-compatible storage | Needed anyway for IAM and ML. Written in a language already fluent. |
| D16 | ML worker (phase 4) | Python, queue-driven, separate service | The entire audio-ML ecosystem is Python. |

### Decisions deliberately deferred

- Sync conflict policy beyond last-write-wins (phase 2).
- Whether shared folders are real-time or check-out/check-in (phase 3).
- YouTube URL ingestion — see §11, Risks.
- Android.

---

## 3. Stack

**v1 (client only)**

| Concern | Choice |
|---|---|
| Runtime | Expo SDK, dev builds (not Expo Go — native modules required) |
| Language | TypeScript, `strict: true`, no implicit `any` |
| Local store | `expo-sqlite` |
| Files access | `expo-document-picker` |
| Voice Memos intake | `expo-share-extension` (registers qtdn as a share target) |
| Audio playback | `expo-audio` |
| Navigation | `expo-router` |
| State | Zustand + repository layer. No global ORM magic. |
| Testing | Vitest for `domain/` and `data/`, Maestro for iOS flows |
| Crash reporting | `@sentry/react-native` |
| Chord shapes | `@tombatossals/chords-db` (MIT, JSON guitar shape dataset) |

**Phase 2+**

| Concern | Choice |
|---|---|
| API | Go, layered `internal/` packages, pgx, Postgres |
| Contract | OpenAPI spec generating both Go server stubs and the TS client |
| Object storage | S3-compatible (attachments) |
| ML worker | Python — Demucs (separation), madmom/Chordino (chords), librosa (beat/key), Whisper (lyrics) |

---

## 4. The note format

The canonical form of a note is a **plain UTF-8 text file** in a ChordPro superset.
It is the source of truth. SQLite is a derived index over these files, never the reverse.

### 4.1 Example

```chordpro
{x_qtdn_id: 018f3a1c-7b2e-7000-8a41-9c2b6d5e4f01}
{x_qtdn_rev: 7}
{x_qtdn_updated: 2026-08-18T14:22:03Z}
{title: Tempo Perdido}
{artist: Legião Urbana}
{key: G}
{capo: 2}
{tempo: 96}
{x_qtdn_scroll: 38}
{x_qtdn_audio: media/intro-riff.m4a}

{start_of_verse: Verse 1}
[G]Todos os dias quando [D]acordo
não tenho mais o [Em]tempo que passou
{end_of_verse}

{start_of_tab: Intro}
e|---------------------|
B|---------------------|
G|-----0-----0-----2---|
D|---0---0-------------|
A|-2-------------------|
E|---------------------|
{end_of_tab}
```

### 4.2 Rules

- Standard ChordPro directives are used wherever one exists. Every qtdn-specific
  directive is namespaced `x_qtdn_*`, so any other ChordPro tool can read our files and
  simply ignore what it doesn't know.
- `x_qtdn_id` is a **UUIDv7** — time-sortable, collision-free across devices, and the
  join key that makes phase-2 sync possible without a migration.
- `x_qtdn_rev` is a monotonically increasing integer per note. v1 only increments it;
  phase 2 uses it to detect divergence.
- Chords are inline in square brackets, attached to the character position they sit above.
- Tab blocks are opaque monospace text between tab fences. The parser preserves them
  byte-for-byte and never reflows them.
- Attachment paths are relative and only valid inside a bundle (§4.3).

### 4.3 The `.qtdn` bundle

A note with attachments is not a single file. Export produces a zip:

```
Tempo Perdido.qtdn
├── note.chordpro
└── media/
    └── intro-riff.m4a
```

A note with no attachments may be exported as a bare `.chordpro` file. Import accepts
both, plus foreign formats (§4.4). A folder export is a zip of bundles plus a
`folder.json` manifest.

### 4.4 Import of foreign formats

`chordsheetjs` handles parsing UltimateGuitar and chords-over-words text into a rough
structure. We use it **only at the import boundary** — it converts to our AST once, and
then we own the note. We do not depend on it for our canonical parse/serialize path,
because we need guarantees it does not offer (§5.2).

---

## 5. Architecture

### 5.1 Module boundaries

```
src/
  domain/            # Pure TypeScript. Zero React, zero React Native, zero I/O.
    chordpro/        #   parser, serializer, AST types
    music/           #   chord model, transposition, capo math, key detection
    chart/           #   operations on a parsed chart (insert chord, split line, ...)
  data/              # Persistence. Knows SQLite and the filesystem, not the UI.
    repositories/    #   NoteRepository, FolderRepository, AttachmentRepository
    bundle/          #   .qtdn import/export
    migrations/
  ui/
    tokens/          # The design system's single source of truth
    components/      # The closed component set
    screens/
  platform/          # iOS-specific adapters behind interfaces
    share/           #   share-extension intake
    picker/          #   document picker
    audio/
  observability/     # logger, log store, Sentry wiring
```

**The one rule that matters:** `domain/` imports nothing from `react`, `react-native`,
or `expo-*`. It runs in plain Node under Vitest with no mocking, and it is the module a
future web client or Go/Python service reuses. Enforce it with an ESLint
`no-restricted-imports` rule scoped to `src/domain/**`, so violating it fails CI rather
than review.

### 5.2 The round-trip invariant

The single most important correctness property in the codebase:

```
parse(serialize(ast)) deep-equals ast
serialize(parse(text)) === text        // for any text qtdn itself produced
```

Both directions are property-tested with generated charts. Everything downstream — the
structured editor, raw mode, export, and eventually ML-generated charts — depends on
these holding. If they break, notes silently corrupt on save.

### 5.3 Storage model

SQLite is a **derived index**, rebuildable from the files at any time. This is what makes
the app debuggable: if the database is ever wrong, delete it and reindex.

```sql
CREATE TABLE folders (
  id          TEXT PRIMARY KEY,      -- UUIDv7
  name        TEXT NOT NULL,
  position    INTEGER NOT NULL,
  owner_id    TEXT,                  -- dormant in v1, NULL. Present for phase 3.
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT                   -- tombstone, for phase-2 sync
);

CREATE TABLE notes (
  id          TEXT PRIMARY KEY,      -- UUIDv7, mirrors x_qtdn_id in the file
  folder_id   TEXT REFERENCES folders(id),
  title       TEXT NOT NULL,
  artist      TEXT,
  song_key    TEXT,
  capo        INTEGER NOT NULL DEFAULT 0,
  tempo       INTEGER,
  body        TEXT NOT NULL,         -- the full ChordPro source
  rev         INTEGER NOT NULL DEFAULT 1,
  owner_id    TEXT,                  -- dormant in v1
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT
);

CREATE TABLE attachments (
  id          TEXT PRIMARY KEY,
  note_id     TEXT NOT NULL REFERENCES notes(id),
  kind        TEXT NOT NULL,         -- 'audio'
  filename    TEXT NOT NULL,
  duration_ms INTEGER,
  bytes       INTEGER NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE VIRTUAL TABLE notes_fts USING fts5(title, artist, body, content=notes);
```

Three deliberate choices here, all cheap now and expensive later:

- **`owner_id` exists from migration 0001** even though v1 has no users. Retrofitting
  ownership onto a populated schema is the migration everyone regrets.
- **`deleted_at` tombstones instead of hard deletes.** Without them, phase-2 sync cannot
  distinguish "deleted on the other device" from "not yet created here."
- **UUIDv7 client-side IDs, never autoincrement.** Two devices must be able to create
  notes offline without colliding.

---

## 6. The editor

Three modes over **one parsed AST**. No mode owns its own representation.

### 6.1 Structured mode (primary)

Lyrics are typed as plain text. To place a chord: tap the syllable, and a chord picker
opens — a root wheel (C…B, with sharps/flats) plus a quality strip (maj, min, 7, m7,
maj7, sus2, sus4, dim, aug) and an optional bass note for slash chords. Tap places,
long-press on a placed chord edits or removes it.

The consequence worth naming: chords can only be attached to positions that exist, and
qualities can only come from the picker's vocabulary. Malformed charts become
unrepresentable rather than merely discouraged.

### 6.2 Tab mode

A six-row monospace grid. Tap a string/column intersection to place a fret number; the
grid extends horizontally as you go. Serializes into a `{start_of_tab}` block. Renders
identically to how it will read on the playing screen, because it's the same monospace
component.

### 6.3 Raw mode

Full-screen monospace editor over the ChordPro source, with syntax highlighting for
directives and chord brackets. Parse errors surface inline as non-blocking warnings —
raw mode is allowed to hold invalid text while you type, and only refuses to save if the
document doesn't parse.

This is the paste-from-web path and the parser-debugging path. It is not the default,
and the UI does not push you toward it.

### 6.4 Playing screen

Read-only rendering: large chord glyphs, dimmed lyrics, chord diagrams in a header strip
for the shapes used in the song, and hands-free auto-scroll at a per-song speed stored in
`x_qtdn_scroll`. Auto-scroll starts from a single large control and keeps the screen
awake. No editing affordances visible.

---

## 7. Design system

Dark-first, typography-led, stage-legible.

**Tokens** live in `ui/tokens/` as plain TypeScript objects — spacing scale, type scale,
color roles, radii, motion durations. Semantic names only (`color.chord`,
`color.lyric.muted`), never literal names like `gray700`, so a palette change is one file.

**Component set is closed.** Screens compose from `ui/components/` and may not introduce
new visual primitives. If a screen needs something the set doesn't have, the set grows
deliberately — that's the review moment where consistency is actually decided.

**Enforcement is mechanical**, because "always-enforced" cannot rest on discipline:

- `react-native/no-color-literals` and `react-native/no-inline-styles` as errors.
- `no-restricted-imports` blocking `react-native`'s `StyleSheet` outside `ui/`.
- A custom lint rule rejecting numeric spacing values not drawn from the scale.
- CI fails on any of the above.

Accessibility floor: minimum 4.5:1 contrast for lyric text on the dark ground, Dynamic
Type respected on the playing screen, all controls ≥44pt.

---

## 8. Observability

- **Structured logger** in `observability/`, JSON lines, levels (`debug`/`info`/`warn`/`error`),
  every entry carrying a stable `event` name rather than a prose message — so logs stay
  greppable and later become metric names for free.
- **Rotating local log file**, capped, with an in-app viewer screen and a share-sheet
  export. This is what you use when something misbehaves at rehearsal with no laptop.
- **Sentry** for crashes and unhandled rejections, with PII scrubbing on (note content
  never leaves the device).
- **Domain-level events worth logging from day one:** parse failure, save rejection,
  bundle import/export outcome, attachment intake source (share extension vs picker),
  and database reindex.

---

## 9. Roadmap

**Phase 0 — Foundations.** Repo, TypeScript config, lint rules, CI. `domain/chordpro`
parser + serializer with the round-trip property tests passing. Design tokens and the
first component primitives. *No UI yet — the format is proven first.*

**Phase 1 — v1 app.** Folder and note CRUD, structured editor, tab editor, raw mode,
playing screen with chord diagrams and auto-scroll, audio attachment via share extension
and document picker, `.qtdn` export/import, in-app log viewer. TestFlight build.

**Phase 2 — Sync.** Go API, Postgres, S3-compatible attachment storage, OpenAPI contract,
push/pull sync using the `rev` and tombstones already in the schema. Last-write-wins per
note to start, since there is still only one user.

**Phase 3 — IAM and sharing.** Accounts, then folder-level ACLs and an invite flow.
`owner_id` stops being dormant. This is where concurrent editing needs a real answer.

**Phase 4 — Transcription.** Python worker behind a job queue: upload audio → separation →
chord/beat/key detection → optional lyric alignment → emit a ChordPro document. Because
the output is just our canonical format, it lands in the app as an ordinary note with no
special-case handling. Predictions are marked low-confidence and always land in a draft
state for review.

---

## 10. Repository layout

New repository, `qtdn`. Monorepo from the start so phase 2 doesn't require a migration:

```
qtdn/
├── apps/
│   ├── mobile/          # Expo app
│   └── api/             # Go service (phase 2)
├── packages/
│   └── chordpro/        # extractable domain core, if a web client needs it
├── services/
│   └── transcribe/      # Python worker (phase 4)
├── docs/
│   ├── DESIGN.md        # this document
│   ├── FORMAT.md        # the qtdn ChordPro profile spec
│   └── adr/             # architecture decision records
└── openapi/             # contract, once phase 2 begins
```

Decisions get recorded as ADRs going forward, so the reasoning survives the conversation
that produced it.

---

## 11. Risks

| Risk | Assessment |
|---|---|
| **Tap-to-place is the largest single build in v1.** | It's also the feature that delivers the core promise. Mitigation: build it against the AST from day one so the editor is replaceable without touching storage. |
| **YouTube URL ingestion violates YouTube's ToS** and is a plausible App Store rejection. | Design the pipeline as audio-file-in. URL ingestion stays a separate, later question with a different answer. |
| **Chord recognition accuracy is genuinely limited** for acoustic guitar, especially extended and slash chords. | Set expectations in the UI: phase-4 output is a draft to correct, never a finished chart. |
| **TestFlight builds expire after 90 days.** | Fine for personal use; just a periodic re-upload. Revisit if others start depending on it. |
| **Round-trip bugs corrupt notes silently.** | Property tests in Phase 0, before any UI exists. Non-negotiable gate. |
| **Expo native modules require dev builds**, so Expo Go is unavailable. | Accepted from day one rather than discovered mid-build; EAS build configured in Phase 0. |
