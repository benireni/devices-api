/**
 * Auto-scroll speed.
 *
 * Held in pixels per second, which is the unit the scrolling actually happens in — a
 * unitless 1-to-10 dial would have to be translated somewhere, and that translation is
 * exactly the thing that drifts between the stored value and what the screen does.
 */

export const MIN_SPEED = 0;
export const MAX_SPEED = 120;
export const SPEED_STEP = 5;

/** A comfortable reading pace for a chart at the default type size. */
export const DEFAULT_SPEED = 25;

export function clampSpeed(speed: number): number {
  if (Number.isNaN(speed)) return DEFAULT_SPEED;
  return Math.min(MAX_SPEED, Math.max(MIN_SPEED, Math.round(speed)));
}

export function adjustSpeed(speed: number, steps: number): number {
  return clampSpeed(speed + steps * SPEED_STEP);
}

/** Reads a stored `x_qtdn_scroll` value, falling back when it is absent or nonsense. */
export function readSpeed(directive: string | null): number {
  if (directive === null) return DEFAULT_SPEED;
  const parsed = Number.parseInt(directive, 10);
  return Number.isNaN(parsed) ? DEFAULT_SPEED : clampSpeed(parsed);
}

/**
 * How far to scroll for a frame of the given length.
 *
 * Returns a fractional offset so slow speeds still move: rounding per frame would make
 * anything under one pixel per frame stand perfectly still.
 */
export function advance(speed: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return (clampSpeed(speed) * elapsedMs) / 1000;
}

/**
 * Whether a scroll position reported by the view should replace the one being driven.
 *
 * Every automatic scroll is echoed back as a scroll event, so adopting each one would
 * make the loop chase its own tail. Anything beyond a pixel is a real gesture: the user
 * has dragged the chart, and playback should continue from where they left it.
 */
export function shouldResync(driven: number, reported: number): boolean {
  return Math.abs(reported - driven) > 1;
}
