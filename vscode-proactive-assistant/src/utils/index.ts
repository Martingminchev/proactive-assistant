// Error handling utilities
export { ExtensionError, ErrorCodes, handleError, withErrorHandling } from './errors';

// Logger
export { Logger, createLogger } from './logger';

// Timed Status Bar Feature
export { TimedStatusBarFeature, formatRemainingMinutes } from './timedStatusBar';
export type { TimedStatusBarOptions, TimedStatusBarState } from './timedStatusBar';

// Types
export type { ErrorCode } from './errors';
export type { ILogger } from '../types';
