import { describe, expect, it } from 'vitest';

import { isNoteId, uuidv7 } from '../ids';

const RANDOM = new Uint8Array([0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0, 0x11, 0x22]);

describe('uuidv7', () => {
  it('produces a well-formed v7 identifier', () => {
    expect(isNoteId(uuidv7(1_700_000_000_000, RANDOM))).toBe(true);
  });

  it('sorts lexicographically in creation order', () => {
    const ids = [1_700_000_000_000, 1_700_000_000_001, 1_800_000_000_000].map((t) =>
      uuidv7(t, RANDOM),
    );
    expect([...ids].sort()).toEqual(ids);
  });

  it('encodes timestamps beyond the 32-bit range', () => {
    // 2^32 ms is roughly 1970-02-19; anything modern exercises the high half.
    expect(uuidv7(0x1_0000_0000, RANDOM).startsWith('00010000-0000-7')).toBe(true);
  });

  it('rejects insufficient randomness rather than silently padding', () => {
    expect(() => uuidv7(0, new Uint8Array(4))).toThrow('needs 10 random bytes');
  });

  it('does not accept a v4 identifier', () => {
    expect(isNoteId('018f3a1c-7b2e-4000-8a41-9c2b6d5e4f01')).toBe(false);
  });
});
