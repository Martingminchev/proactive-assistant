/**
 * Centralized configuration constants for the Proactive Assistant
 * 
 * This file contains all hardcoded values that were previously scattered
 * throughout the codebase. Using named constants improves:
 * - Maintainability: Change values in one place
 * - Readability: Meaningful names explain what values represent
 * - Type safety: Using `as const` prevents accidental mutations
 */

export const PIECES_OS_CONFIG = {
  PORTS: [1000, 39300, 5323] as const,
  HOST: 'localhost',
  RETRY_ATTEMPTS: 3,
  BASE_DELAY_MS: 1000,
  MAX_DELAY_MS: 10000,
  REQUEST_TIMEOUT_MS: 5000,
  HEALTH_CHECK_INTERVAL_MS: 30000,
} as const;

export const ACTIVITY_MONITOR_CONFIG = {
  IDLE_THRESHOLD_MS: 5 * 60 * 1000,  // 5 minutes
  DEEP_FLOW_THRESHOLD_MS: 5 * 60 * 1000,  // 5 minutes steady typing
  STUCK_THRESHOLD_MS: 20 * 60 * 1000,  // 20 minutes with error
  TYPING_WINDOW_MS: 60 * 1000,  // 1 minute window for velocity
  SAMPLE_INTERVAL_MS: 5000,  // 5 second sampling
  MIN_TYPING_VELOCITY: 50,  // 50 chars/min for deep flow
  FRUSTRATION_BACKSPACE_RATIO: 0.3,  // 30% backspace ratio
  ACTIVITY_HISTORY_LIMIT: 1000,  // Max events to keep in history
  CONTEXT_CONTENT_LINES: 5,  // Lines to capture above/below cursor
  CONTEXT_CONTENT_MAX_LENGTH: 1000,  // Max chars of context content
} as const;

export const INTERRUPTION_MANAGER_CONFIG = {
  MIN_INTERRUPTION_INTERVAL_MS: 30 * 60 * 1000,  // 30 minutes
  MAX_SUGGESTIONS_PER_SESSION: 5,
  COOLDOWN_AFTER_DISMISS_MS: 5 * 60 * 1000,  // 5 minutes
  MAX_DISMISSALS_BEFORE_BLACKLIST: 3,
  FOCUS_MODE_DURATION_MS: 60 * 60 * 1000,  // 1 hour
  QUIET_HOURS_START: '22:00',
  QUIET_HOURS_END: '08:00',
  DISMISSAL_RETENTION_DAYS: 30,  // Keep dismissals for 30 days
  RESPECT_DEEP_FLOW: true,
  IDLE_DURATION_THRESHOLD_MS: 10 * 60 * 1000,  // > 10 min for level boost
} as const;

export const SUGGESTION_ENGINE_CONFIG = {
  DEFAULT_TIMEOUT_MS: 30000,  // 30 seconds
  MAX_SUGGESTIONS_HISTORY: 100,
  MAX_SUGGESTION_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 500,
  MIN_CONTEXT_LENGTH: 10,
  CODE_FIX_ENABLED: true,
  AI_ENHANCEMENT_ENABLED: true,
  RATE_LIMIT_INTERVAL_MS: 30 * 60 * 1000,  // 30 minutes between suggestions
  MAX_TOKENS: 1000,
  DEFAULT_CONFIDENCE: 0.8,
} as const;

export const FLOW_STATE_CONFIG = {
  STUCK_THRESHOLD_MS: 2 * 60 * 1000,  // 2 minutes without progress
  FRUSTRATED_THRESHOLD_MS: 30 * 1000,  // 30 seconds of rapid errors
  CELEBRATION_DEBOUNCE_MS: 5 * 60 * 1000,  // 5 minutes
} as const;
