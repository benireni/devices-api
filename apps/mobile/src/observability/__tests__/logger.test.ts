import { beforeEach, describe, expect, it } from 'vitest';

import { Logger } from '../logger';

function at(seconds: number): Date {
  return new Date(Date.UTC(2026, 0, 1, 0, 0, seconds));
}

describe('Logger', () => {
  let clock: number;
  let log: Logger;

  beforeEach(() => {
    clock = 0;
    log = new Logger({ now: () => at(clock++) });
  });

  it('records an event with its level and data', () => {
    log.info('note.saved', { id: 'abc' });

    expect(log.read()).toEqual([
      { at: '2026-01-01T00:00:00.000Z', level: 'info', event: 'note.saved', data: { id: 'abc' } },
    ]);
  });

  it('defaults the data to an empty object', () => {
    log.debug('app.started');
    expect(log.read()[0]?.data).toEqual({});
  });

  it('reads newest first', () => {
    log.info('first');
    log.info('second');

    expect(log.read().map((entry) => entry.event)).toEqual(['second', 'first']);
  });

  it.each(['warn', 'error'] as const)('records at %s', (level) => {
    log[level]('something');
    expect(log.read()[0]?.level).toBe(level);
  });

  it('describes a thrown Error without losing its type', () => {
    log.error('bundle.import.failed', new TypeError('bad file'));
    expect(log.read()[0]?.data).toEqual({ reason: 'TypeError: bad file' });
  });

  it('describes a thrown non-Error, since a catch binding is unknown', () => {
    log.error('bundle.import.failed', 'just a string');
    expect(log.read()[0]?.data).toEqual({ reason: 'just a string' });
  });

  it('omits the reason when nothing was thrown', () => {
    log.error('note.save.rejected', undefined, { id: 'abc' });
    expect(log.read()[0]?.data).toEqual({ id: 'abc' });
  });

  it('discards entries below the minimum level', () => {
    const quiet = new Logger({ minimum: 'warn', now: () => at(0) });
    quiet.debug('noise');
    quiet.info('noise');
    quiet.warn('kept');

    expect(quiet.read().map((entry) => entry.event)).toEqual(['kept']);
  });

  it('drops the oldest entries once capacity is reached', () => {
    const small = new Logger({ capacity: 2, now: () => at(clock++) });
    small.info('a');
    small.info('b');
    small.info('c');

    expect(small.read().map((entry) => entry.event)).toEqual(['c', 'b']);
  });

  it('stamps entries from the real clock when none is injected', () => {
    const plain = new Logger();
    plain.info('app.started');

    expect(plain.read()[0]?.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('clears', () => {
    log.info('a');
    log.clear();
    expect(log.read()).toEqual([]);
  });

  it('exports one JSON object per line, oldest first', () => {
    log.info('a', { n: 1 });
    log.warn('b');

    const lines = log.export().split('\n').map((line): unknown => JSON.parse(line));

    expect(lines).toEqual([
      { at: '2026-01-01T00:00:00.000Z', level: 'info', event: 'a', data: { n: 1 } },
      { at: '2026-01-01T00:00:01.000Z', level: 'warn', event: 'b', data: {} },
    ]);
  });
});
