/**
 * UUIDv7 — a time-ordered identifier.
 *
 * Chosen over an autoincrement key because notes are created on a device, offline, with
 * no coordinator: two devices must be able to create notes at the same moment without
 * colliding. Being time-sortable also means a directory listing is already in creation
 * order, which is why the library never stores a separate sequence number.
 *
 * Layout: 48-bit big-endian milliseconds, 4-bit version, 12 random bits, 2-bit variant,
 * 62 random bits.
 */
export function uuidv7(nowMs: number, random: Uint8Array): string {
  if (random.length < 10) {
    throw new Error(`uuidv7 needs 10 random bytes, received ${String(random.length)}`);
  }

  const bytes = new Uint8Array(16);

  // 48-bit timestamp. Split to stay inside the 32-bit range of bitwise operators.
  const millis = Math.floor(nowMs);
  const high = Math.floor(millis / 0x1_0000_0000);
  const low = millis >>> 0;
  bytes[0] = (high >>> 8) & 0xff;
  bytes[1] = high & 0xff;
  bytes[2] = (low >>> 24) & 0xff;
  bytes[3] = (low >>> 16) & 0xff;
  bytes[4] = (low >>> 8) & 0xff;
  bytes[5] = low & 0xff;

  for (let i = 0; i < 10; i += 1) {
    bytes[6 + i] = random[i] ?? 0;
  }

  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70; // version 7
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80; // variant 10

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isNoteId(value: string): boolean {
  return UUID_PATTERN.test(value);
}
