/**
 * Structured logging.
 *
 * Entries carry a stable `event` name rather than a prose message, so logs stay greppable
 * and each name becomes a metric for free once there is a server to send them to. The
 * store is a ring buffer held in memory: qtdn runs offline with no debugger attached, and
 * what matters is being able to read the last few hundred events after something went
 * wrong at rehearsal.
 */

export const LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type Level = (typeof LEVELS)[number];

export interface LogEntry {
  readonly at: string;
  readonly level: Level;
  /** Stable, dot-separated identifier: `note.saved`, `bundle.import.failed`. */
  readonly event: string;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface LoggerOptions {
  /** Entries kept before the oldest are dropped. */
  readonly capacity: number;
  /** Entries below this level are discarded. */
  readonly minimum: Level;
  readonly now: () => Date;
}

export const DEFAULT_OPTIONS: LoggerOptions = {
  capacity: 500,
  minimum: 'debug',
  now: () => new Date(),
};

export class Logger {
  private readonly entries: LogEntry[] = [];
  private readonly options: LoggerOptions;

  constructor(options: Partial<LoggerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  debug(event: string, data: Record<string, unknown> = {}): void {
    this.record('debug', event, data);
  }

  info(event: string, data: Record<string, unknown> = {}): void {
    this.record('info', event, data);
  }

  warn(event: string, data: Record<string, unknown> = {}): void {
    this.record('warn', event, data);
  }

  /** Accepts the thrown value directly, since a `catch` binding is `unknown`. */
  error(event: string, cause?: unknown, data: Record<string, unknown> = {}): void {
    this.record('error', event, {
      ...data,
      ...(cause === undefined ? {} : { reason: describe(cause) }),
    });
  }

  /** Newest first, which is the order anyone reading a log actually wants. */
  read(): readonly LogEntry[] {
    return [...this.entries].reverse();
  }

  clear(): void {
    this.entries.length = 0;
  }

  /** JSON lines, ready to drop into a file or a share sheet. */
  export(): string {
    return this.entries.map((entry) => JSON.stringify(entry)).join('\n');
  }

  private record(level: Level, event: string, data: Record<string, unknown>): void {
    if (LEVELS.indexOf(level) < LEVELS.indexOf(this.options.minimum)) return;

    this.entries.push({ at: this.options.now().toISOString(), level, event, data });

    if (this.entries.length > this.options.capacity) {
      this.entries.splice(0, this.entries.length - this.options.capacity);
    }
  }
}

function describe(cause: unknown): string {
  return cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
}
