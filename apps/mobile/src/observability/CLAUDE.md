# Observability

qtdn runs offline, away from a laptop, with no debugger attached. When something
misbehaves at a rehearsal, the in-app log viewer is the only account of what happened.

## Rules

- **Log an `event`, not a sentence.** `note.saved`, `bundle.import.failed`,
  `library.reindexed`. A stable dot-separated name stays greppable, survives rewording,
  and becomes a metric name for free once there is a server to send it to. Never
  interpolate values into the event name — they belong in `data`.
- **Never log note content.** Titles, lyrics and chords stay on the device. `data` carries
  ids, counts, durations and outcomes.
- **`error` takes the thrown value directly**, because a `catch` binding is `unknown`. It
  describes an `Error` as `Name: message` and stringifies anything else, so a thrown
  string does not vanish.

## Shape

The store is a ring buffer in memory, capped and oldest-dropped. It is deliberately not
persisted: the value is the last few hundred events after something went wrong, not a
permanent record, and a log file that grows unbounded on a phone is its own bug.

`export()` produces JSON lines, which is what the viewer's share button sends.

## What is not here

Sentry, and any network reporting. Phase 1 is local-only, so there is nowhere to send a
crash. When the API arrives, this module is where that lands — the logger's shape is
already the shape of a payload.
