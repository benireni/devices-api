# e2e

End-to-end tests, on Playwright Test.

They run against the **web export**, whose file store is in memory and seeded with the
demo library. Nothing here touches a device, and nothing here reaches into the app: the
suite types into the same fields and presses the same buttons a thumb would.

```bash
npm run e2e          # builds the web export, then runs the suite
npm run e2e:report   # opens the HTML report from the last CI-style run
```

A chromium is needed: `npx playwright install chromium` once, or `CHROMIUM_PATH` pointing
at one that is already on the machine.

## Why this exists next to 100% unit coverage

Coverage proves each unit does what it says. It cannot prove the units are wired
together. Both bugs this suite has found were invisible to 300-odd passing unit tests:

- the note screen read its file once on mount, so returning from an editor showed the
  chart from *before* the edit — the file was right, the screen was not;
- the structured editor held a buffer read on mount while the tab editor wrote the same
  note directly, so saving after adding a tab erased the tab.

Both are integration failures. Neither is reachable from a unit test, because in a unit
test there is only ever one screen.

## Isolation

There are no fixtures and nothing to reset. Each test loads the page, which boots a fresh
in-memory store and reseeds the demo library, so tests cannot see each other's writes and
run in parallel safely.

The corollary is that **`app.open()` is a reset, not navigation**. To get back to a screen
the test has already visited, use `app.back()` — reloading would throw away everything the
test just did.

## Rules

1. **Drive the app, never its internals.** No test hooks, no injected state, no reaching
   into the store. If a flow cannot be performed through the UI, that is a finding.
2. **Use `support/app.ts`.** It encodes the traps — sheets that sit over the screen that
   opened them and share its labels, sheets that are still on screen while they slide
   away, rows whose accessible name includes their subtitle. Rediscovering those in a spec
   means the next spec rediscovers them too.
3. **Assert, do not sleep.** Playwright's assertions retry; `waitForTimeout` hides a race
   rather than fixing it. The one exception is `longPress`, where the wait *is* the
   gesture.
4. **A test names a behaviour, not a screen.** "asks before deleting, and says what will
   be lost" survives a redesign; "clicking the third button" does not.
5. **When a spec fails, suspect the app first.** That is the entire point of the suite.
