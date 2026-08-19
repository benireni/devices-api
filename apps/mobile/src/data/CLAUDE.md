# The note library

**The filesystem is the model.** A folder is a directory, a note is a `<uuid>.chordpro`
file inside it, an unfiled note sits at the library root. There is no database and no
manifest, so nothing exists that can disagree with the files — the entire class of bug
where an index says one thing and disk says another does not exist here.

## Why no SQLite yet

`DESIGN.md` names SQLite as the derived index. That is still the plan; it is not built,
because nothing needs it yet. Scanning a few hundred files at launch is instant, and
adding a database now would mean migrations, a sync path between file and row, and a
whole failure mode to debug — all in service of nothing.

**Introduce it when one of these is true**, not before:

- Full-text search across note bodies is a feature you actually want.
- The library is large enough that a launch scan is measurably slow.

When that day comes it is additive: the files stay authoritative and SQLite becomes a
cache that can be deleted and rebuilt.

For the same reason there is no state store. `useLibrary` re-reads on screen focus, which
has no cache to invalidate and no staleness to reason about. Reach for a store when a
scan is slow, not because a screen feels like it should have one.

## Testing

All logic lives in `Library`, which depends only on the `FileStore` port. Tests run under
plain Node against `MemoryFileStore` — no simulator, no mocking framework, no Expo import
anywhere in the test file. Keep it that way: if a change to `Library` needs a real
filesystem to test, the abstraction has sprung a leak.

`Environment` injects time and randomness for the same reason — ids are then reproducible,
so a failure is too.

## Things to preserve

- **Titles are read out of the note text**, never stored alongside it. A title that lives
  in two places is a title that can disagree with itself.
- **`saveNote` writes bytes verbatim.** Do not round-trip through the parser on save: the
  raw editor holds partially-typed text, and normalizing it mid-keystroke would rewrite
  what the user is in the middle of writing.
- **Folder names are validated** against path separators and `..` before touching disk.
  That check is the only thing keeping a note inside the library root.
- **Ids are UUIDv7**, so a directory listing is already in creation order and two offline
  devices cannot collide. Do not swap in a counter.

## Platform selection

`index.ts` picks `ExpoFileStore` on device and `MemoryFileStore` on web, where the build
exists only for CI's bundle check and documentation screenshots. Branch there, at
construction — never inside `Library`, which is the whole point of the port.

Note that `text()` and `move()` are async in `expo-file-system` while `create`, `delete`,
`write`, `list` and `exists` are synchronous. The port is uniformly async so callers never
have to track which is which.
