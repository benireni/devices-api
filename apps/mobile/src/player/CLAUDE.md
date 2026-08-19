# Playback

Auto-scroll, so a chart can be read through without touching the screen.

## Speed

Held in **pixels per second**, the unit the scrolling actually happens in. A unitless
1-to-10 dial would need translating somewhere, and that translation is precisely what
drifts apart from what the screen does. Stored per song in `x_qtdn_scroll`, because tempo
is a property of the song and not a global preference.

`readSpeed` falls back to the default for an absent or nonsense directive rather than
throwing — a hand-edited note should not be able to break the player.

## The loop

The offset is a float in a ref, never in state. At the default speed a frame advances less
than half a pixel, so rounding per frame would leave the chart perfectly still, and holding
it in state would re-render sixty times a second for nothing.

Every automatic scroll is echoed back as a scroll event. Adopting each one would make the
loop chase its own tail, so `shouldResync` ignores anything within a pixel and treats
larger jumps as a real gesture — the user dragged the chart, and playback continues from
where they left it.

## Keep-awake

Activated when playback starts and released when it stops. `useKeepAwake` cannot be
conditionally inactive — passing `undefined` still acquires the lock — so the imperative
`activateKeepAwakeAsync`/`deactivateKeepAwake` pair is used inside the effect that owns the
loop. A chart that holds the display on after you have stopped playing is a flat battery.

## Testing

All logic lives in `scroll.ts` and is tested under plain Node. `useAutoScroll.ts` is
excluded from coverage as a platform binding: animation frames, a ScrollView ref and the
keep-awake lock, with no decisions of its own. If a change to it needs a test, extract the
decision into `scroll.ts` first — that is what happened to `shouldResync`.
