import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SPEED,
  MAX_SPEED,
  MIN_SPEED,
  SPEED_STEP,
  adjustSpeed,
  advance,
  clampSpeed,
  readSpeed,
  shouldResync,
} from '../scroll';

describe('clampSpeed', () => {
  it('holds the speed inside its range', () => {
    expect(clampSpeed(-10)).toBe(MIN_SPEED);
    expect(clampSpeed(9999)).toBe(MAX_SPEED);
    expect(clampSpeed(30)).toBe(30);
  });

  it('rounds a fractional speed', () => {
    expect(clampSpeed(30.6)).toBe(31);
  });

  it('falls back rather than storing NaN', () => {
    expect(clampSpeed(Number.NaN)).toBe(DEFAULT_SPEED);
  });
});

describe('adjustSpeed', () => {
  it('steps up and down', () => {
    expect(adjustSpeed(30, 1)).toBe(30 + SPEED_STEP);
    expect(adjustSpeed(30, -1)).toBe(30 - SPEED_STEP);
  });

  it('stops at the ends instead of wrapping', () => {
    expect(adjustSpeed(MIN_SPEED, -1)).toBe(MIN_SPEED);
    expect(adjustSpeed(MAX_SPEED, 1)).toBe(MAX_SPEED);
  });
});

describe('readSpeed', () => {
  it('reads a stored value', () => {
    expect(readSpeed('40')).toBe(40);
  });

  it('falls back when the directive is absent', () => {
    expect(readSpeed(null)).toBe(DEFAULT_SPEED);
  });

  it('falls back on a value that is not a number', () => {
    expect(readSpeed('fast')).toBe(DEFAULT_SPEED);
  });

  it('clamps a stored value that is out of range', () => {
    expect(readSpeed('9999')).toBe(MAX_SPEED);
  });
});

describe('advance', () => {
  it('moves the speed in pixels over a second', () => {
    expect(advance(30, 1000)).toBe(30);
  });

  it('returns a fraction for a single frame, so slow speeds still move', () => {
    expect(advance(6, 16)).toBeCloseTo(0.096, 3);
  });

  it('does not move backwards in time', () => {
    expect(advance(30, 0)).toBe(0);
    expect(advance(30, -100)).toBe(0);
  });

  it('does not move when stopped', () => {
    expect(advance(0, 1000)).toBe(0);
  });
});

describe('shouldResync', () => {
  it('ignores the echo of a scroll it just performed', () => {
    expect(shouldResync(100, 100)).toBe(false);
    expect(shouldResync(100, 100.4)).toBe(false);
  });

  it('adopts a position the user dragged to', () => {
    expect(shouldResync(100, 400)).toBe(true);
    expect(shouldResync(400, 100)).toBe(true);
  });
});
