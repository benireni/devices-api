export { Logger, LEVELS, DEFAULT_OPTIONS } from './logger';
export type { Level, LogEntry, LoggerOptions } from './logger';

import { Logger } from './logger';

/** The app's logger. One instance, so the viewer sees everything. */
export const log = new Logger();
