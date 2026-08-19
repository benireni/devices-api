import type { Environment } from '../ports';

/**
 * A deterministic {@link Environment}.
 *
 * The clock advances on every read so generated ids stay distinct — a fixed clock
 * combined with fixed randomness produces identical UUIDs, and notes then overwrite each
 * other, which is a confusing way for a test to fail.
 */
export function deterministicEnvironment(): Environment {
  let tick = 0;
  return {
    now: () => 1_700_000_000_000 + tick++,
    randomBytes: (count) => new Uint8Array(count).fill(0xab),
  };
}
