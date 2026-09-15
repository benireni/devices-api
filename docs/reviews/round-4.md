# Review round 4 — four-agent audit

Working file. **Committed and pushed after every finding is resolved**, so that a session
that runs out of tokens loses at most one finding's worth of work and anyone picking this
up can see exactly where it stopped.

Base commit: `cb6c257`. CI green on that commit.

## How to resume

1. Read the status table. Anything `OPEN` is unstarted; anything `IN PROGRESS` has a
   partial diff in the working tree that must be finished or discarded.
2. One finding per commit, pushed immediately. Never `git add -A` — stage named paths.
3. `npm run check` before each commit; `npm run e2e` before pushing a UI change.
4. Findings marked `REJECTED` were adjudicated against by reading the code. The reason is
   recorded. Do not re-litigate without new evidence.

## The process

Four reviewers, run in parallel against `cb6c257` with no shared context: agent 1 UI/UX,
agent 2 functional requirements, agent 3 non-functional requirements, agent 4 whatever
smelled. Each was required to cite `file:line` or show a reproduction, and to label every
finding defect / risk / preference.

**Agent 3 completed.** Agents 1, 2 and 4 were killed by a session rate limit partway
through, agent 2 with a reproduction half-written (preserved below as FN-1). They are
being re-run with instructions to append each finding to their own file under
`docs/reviews/round-4/` the moment it is confirmed, rather than composing a report at the
end — a report held in an agent's context until the last message is lost in full when the
agent dies, which is what happened here.

## Status

| # | Finding | Sev | Kind | Status |
|---|---|---|---|---|
| NF-1 | Latency fence arithmetically cannot fail on a quadratic scan | High | defect | OPEN |
| NF-2 | One unreadable file makes the whole library invisible, forever, silently | High | defect | OPEN |
| NF-3 | Opening one note costs a full library scan | High | defect | OPEN |
| NF-4 | No fence varies chart size, so "parse must stay linear" is unguarded | Med | defect | OPEN |
| NF-5 | `app.crashed` is written to a buffer the crash destroys | Med | defect | OPEN |
| NF-6 | 4.37 MB of unused fonts ship in the bundle | Med | defect | OPEN |
| NF-7 | Reading screen's saves are fire-and-forget, unlogged | Med | risk | OPEN |
| NF-8 | `e2e/server.mjs` serves the filesystem on every interface | Low | defect | OPEN |
| NF-9 | e2e flakiness reports itself as an app error | Low | risk | OPEN |
| NF-10 | Scans issue two strictly sequential store calls per note | Med | risk | OPEN |
| NF-11 | Dependency audit cannot fail | Low | risk | OPEN |
| NF-12 | Non-UUID `.chordpro` file lists but cannot open | Low | defect | OPEN |
| NF-13 | Compose re-renders whole chart on every chord tap | Low | risk (unmeasured) | OPEN |
| NF-14 | `snapshot()` counts folder membership in O(folders x notes) | Low | preference | OPEN |
| FN-1 | Lyric text containing `[`, `#` or `{` is reinterpreted as syntax | Critical | defect | CONFIRMED, fixing |
| FN-2 | Round-trip generator excludes the characters that break the round trip | High | defect | CONFIRMED, fixing with FN-1 |
| FN-3 | A newline pasted into a title truncates the directive | Low | defect | OPEN |

Agent 1 (UI/UX) and agent 4 (smells) produced no surviving findings before dying.

## Agent 3 — non-functional. Complete.

Method: medians over 9-200 reps after warm-up, `node:perf_hooks`, against the real
`Library` and `MemoryFileStore`.

### NF-1 Latency fence cannot fail on a quadratic scan · High · defect
`e2e/latency.mjs:129-142` compares adjacent steps: `growth > ratio * 2.5`. Sizes are
`[50,200,500,1000,2000]`, so ratios are `4,2.5,2,2` and thresholds `10,6.25,5,5`.
Quadratic growth over a step of ratio `r` is `r^2`: `16,6.25,4,4`. At both doubling steps
quadratic (4) sits under the threshold (5); at 200->500, `6.25 > 6.25` is false. Only the
noisiest row could fire. Demonstrated: making the scan genuinely O(N^2) produced a 9x
blow-up at 2000 notes and `EXIT=0`.
Fix: fit the exponent across the whole table, `log(last/first)/log(count_last/count_first)`,
fail above ~1.3.

### NF-2 One unreadable file blanks the library · High · defect
`library.ts:230-239` awaits each read in the scan loop with no per-file guard; the
rejection propagates through `snapshot()` to `useLibrary.reload()` (`hooks/useLibrary.ts:30-47`)
which has no catch and is called as `void reload()`. `setLoading(false)` never runs, so
`index.tsx:149` renders neither the empty state nor the list — a blank screen, retried and
re-failed on every focus. Nothing is logged. Also a plain TOCTOU: a file deleted between
`listFiles` and `read` throws.
Fix: guard the per-note read+parse inside `Library.readFolder`, skip, `log.warn('note.read.skipped')`;
give `useLibrary.reload` a catch that logs and clears loading.

### NF-3 Opening one note costs a full library scan · High · defect
`app/note/[id].tsx:39` mounts `useLibrary()` solely for `destinations` at `:130-135` (the
Move list). `useLibrary` runs `library.snapshot()` on every focus, which reads and parses
every file. Measured: 4009 store calls to open one note in a 2000-note library, 99.95%
discarded. Recurs on every return from an editor. `app/folder/[name].tsx:23-24` has the
same shape.
Fix: `Library.folderNames()` (one `listDirectories`), `Library.notesIn(folder)`; add an
"open one note" row to the latency fence.

### NF-4 No fence varies chart size · Med · defect
`latency.mjs:26-45` uses one fixed 18-line `CHART` for every note at every size, so
per-note cost is a constant multiplier invisible to both fences — while `ci.yml` and
`latency.mjs:121-128` claim "the parse must stay linear". Demonstrated: reintroducing an
O(lines^2) read path passed green. The parser today *is* linear (measured 50 -> 51,200
lines); this is a missing guard, not a live regression.
Fix: second table holding note count fixed and varying chart length, same exponent fit.

### NF-5 `app.crashed` written to a buffer the crash destroys · Med · defect
`app/_layout.tsx:226-231` logs `app.crashed` then calls the default handler, which
terminates. `logger.ts:37` holds entries in memory; nothing persists them. So the one
event the handler exists to record is unreadable on the only launch that matters.
`DESIGN.md` section 8 specifies a rotating local log file; `observability/CLAUDE.md` says
"deliberately not persisted"; `docs/CLAUDE.md` makes `DESIGN.md` authoritative when they
disagree. A documented requirement was dropped without a recorded decision.
Fix: append `error`-level entries only to one capped file through the existing `FileStore`
port and load it at startup — or amend `DESIGN.md` and delete the comment that promises
what cannot happen.

### NF-6 4.37 MB of unused fonts ship · Med · defect
`src/ui/fonts.ts:1-3` imports from package roots, which are barrels that `require()` every
weight at module scope and are not tree-shaken. Measured from a real `build:ios`: 48 font
files, 4.90 MB shipped; 5 files, 0.52 MB actually loaded. The dead fonts outweigh the
2.7 MB Hermes bundle.
Fix: subpath imports (`@expo-google-fonts/fraunces/700Bold`), plus a CI assertion on the
asset count in `dist/metadata.json`.

### NF-7 Reading screen's saves are fire-and-forget · Med · risk
`app/note/[id].tsx:112` and `:123` call `void library.saveNote(...)` with no catch and no
log, while every other save path in the app catches and logs. `:123` is the unmount flush
that exists specifically so leaving mid-adjustment does not lose the last change — if it
rejects, the change is lost silently. Same gap at `index.tsx:46` and `note/[id].tsx:310`.
Fix: `.catch(cause => log.error('note.save.rejected', cause, { id }))` on all four.

### NF-8 `e2e/server.mjs` serves the filesystem on every interface · Low · defect
Path is joined from the request with no containment check; `listen(PORT, cb)` binds
0.0.0.0. Measured over a raw socket: six `../` leaks `/etc/passwd` (shallower depths fall
through to `index.html`, which is why a casual probe looks safe). Also no `error` handler
on the stream, and `existsSync` -> `createReadStream` is a TOCTOU.
Fix: bind 127.0.0.1, resolve-and-contain, attach error handlers, 404 for missing assets.

### NF-9 e2e flakiness reports itself as an app error · Low · risk
A clean run gave 14 failed / 2 flaky / 71 passed, all 14 `net::ERR_CONNECTION_REFUSED`;
every app-level assertion that executed passed. `playwright.config.ts:50` sets
`stdout: 'ignore'` so the server's own account is discarded, and `fixtures.ts:23` renders
the cascade as "the app raised no runtime errors", pointing the reader at the app rather
than the harness.
Fix: NF-8's error handlers, `stdout: 'pipe'`, and distinguish connection-refused from an
app-originated console error.

### NF-10 Two strictly sequential store calls per note · Med · risk
`library.ts:233-236` awaits `read` then `modifiedAt` per note in a `for` loop — 4000
serialised round-trips at 2000 notes. `latency.mjs:145` fences the count but nothing
fences concurrency, and `MemoryFileStore` prices a round-trip at zero. `modifiedAt` is
only consumed by the `edited` sort order.
Fix: bounded `Promise.all` window; skip `modifiedAt` unless the active order needs it; add
a max-sequential-await-depth column to the fence.

### NF-11 Dependency audit cannot fail · Low · risk
`ci.yml` runs `npm audit --audit-level=high` with `continue-on-error: true`. Agent 3 walked
every high and critical: all are build tooling (vitest UI server, metro, vite, image-size);
none reaches the device bundle, so the job's comment is accurate *today*. The gap is that
it cannot tell runtime from build-time and can never fail.
Fix: blocking `npm audit --omit=dev --audit-level=high`, advisory full audit alongside.

### NF-12 Non-UUID `.chordpro` file lists but cannot open · Low · defect
`library.ts:230-231` lists whatever it finds; `:263-267` refuses any id that is not a
UUIDv7. The row shows with its real title and every tap gives "Can't open this note".
Latent today (no `UIFileSharingEnabled`, both write paths mint UUIDs) but export names
files after the song (`transfer.ts:221`), so it lands the moment file sharing does.
Fix: filter `readFolder` on `isNoteId(id)`, log the skip.

### NF-13 Compose re-renders the whole chart per chord tap · Low · risk, unmeasured
`compose/[id].tsx:186-211` maps every line to an unmemoized `<Line>` with four fresh
closures each. Domain work measured cheap (0.99 ms for 190 lines). The open question is
element count: a full 48-line song is ~2514 elements rebuilt per tap, and every shipped
demo chart is an excerpt at ~109, so no test has rendered a realistic note.
Agent 3 explicitly declined to propose the memo without a device measurement.
Fix: measure first — seed one full-length chart, instrument `applyChord`.

### NF-14 Folder counts are O(folders x notes) · Low · preference
`library.ts:84-87` filters all notes per folder. Measured 1-9% of snapshot time; never
dominant. Worth folding into NF-3 since it touches the same function, not worth its own diff.

### Agent 3's negative results

Parse is linear to 3.6 MB. `sortNotes` is not a bottleneck and an explicit `Intl.Collator`
measured *slower* — hypothesis withdrawn. Undo is bounded at 50. Atomic writes are correct
and stranded `.writing` temp files are invisible to scans. Search debounce is race-free.
Auto-scroll is well built for battery and `useKeepAwake` is a correct single-owner lock.
Coverage is honestly 100% with every exclusion justified and nothing exempt by omission.
`packages/chordpro` is genuinely pure. No PII in any log call site.

## Agent 2 — functional. Died mid-reproduction.

### FN-1 Lyric text carrying ChordPro metacharacters is silently reinterpreted · Critical · defect
Agent 2's hypothesis, verified. Lyric text typed through the structured editor reaches
`serialize` unescaped (`serialize.ts:37-42` writes `segment.text` verbatim), and
`setText` (`edit.ts:161`) does not sanitize. Probe, editing a chordless lyric line and
reparsing what was written:

```
typed "Olha [bis] que coisa"  -> lyric segments [[null,"Olha "],["bis"," que coisa"]]
typed "#1 hit do verao"       -> COMMENT text="1 hit do verao"
typed "{refrao 2x}"           -> directive refrao 2x=null
typed "na praia} do sol"      -> lyric (unaffected)
```

Three distinct losses, all reachable from Edit text on any line:
- `[bis]` becomes a **chord**. `bis` is a repeat marker in everyday Brazilian cifras, so
  this is not an exotic input — the word leaves the lyric and appears as a chord symbol.
- A line starting `#` becomes a **comment**, and `ChartView.tsx:28-30` does not render
  comments while playing. The line the writer typed **disappears from the chart.**
- A line starting `{` becomes a **directive**, likewise not rendered. `{refrao 2x}` is a
  plausible thing to type.

The string round-trip stays stable — `serialize(parse(s)) === s` — which is why no
existing test notices. It is the *AST* round-trip that breaks, and it breaks in the
direction that loses the writer's words.

### FN-2 The round-trip generator excludes the characters that break the round trip · High · defect
`test/arbitraries.ts:55`:
```ts
const LYRIC_CHARS = Array.from("abcdefghijklmnopqrstuvwxyzáéíóúãõç ,.!?'-");
```
No `[`, no `#`, no `{`. The property at `roundtrip.test.ts:16-24` is the gate the root
`CLAUDE.md` calls "the invariant everything else depends on", and its generator cannot
produce the input that violates it.

The same file already records learning this exact lesson once, at `arbitraries.ts:58-61`,
about `{` in directive values: *"It used to be left out, and leaving it out is what let
the round-trip property pass over a tab line that could close its own fence — the
generator was shaped around the defect."* The lyric generator still has the identical
blind spot. FN-1 is what that blind spot was hiding.

### FN-3 A newline in a title truncates the directive · Low · defect
Probe of `setDirective` + round-trip over titles: `}`, `{` and `:` all survive; a value
containing a newline writes `{title: Linha` and the directive is gone on reread. Not
typeable into a single-line field, but reachable by pasting.
