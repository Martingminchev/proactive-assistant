// =============================================================================
// NEXUS - Logger Utility
// Unified logging for renderer process with electron-log integration
// =============================================================================

// Simple logger that works in renderer process
// In production, this can be enhanced to send logs to main process

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  args: any[];
}

// In-memory log storage for "View Logs" feature
const logHistory: LogEntry[] = [];
const MAX_LOG_HISTORY = 1000;

// Helper to create timestamp
const getTimestamp = () => new Date().toISOString();

// Helper to format log entry
const formatLogEntry = (level: LogLevel, message: string, args: any[]): LogEntry => ({
  timestamp: getTimestamp(),
  level,
  message,
  args,
});

// Store log entry
const storeLog = (entry: LogEntry) => {
  logHistory.push(entry);
  if (logHistory.length > MAX_LOG_HISTORY) {
    logHistory.shift();
  }
};

// Send log to main process via IPC if available
const sendToMain = (level: LogLevel, message: string, args: any[]) => {
  try {
    if (window.electronAPI && typeof window !== 'undefined') {
      // We can't directly use electron-log in renderer, but we can 
      // potentially extend IPC to forward logs to main process
      // For now, just use console which electron-log can capture
    }
  } catch {
    // Ignore errors from logging
  }
};

export const logger = {
  debug: (message: string, ...args: any[]) => {
    const entry = formatLogEntry('debug', message, args);
    storeLog(entry);
    sendToMain('debug', message, args);
    console.debug(`[${entry.timestamp}] [DEBUG] ${message}`, ...args);
  },

  info: (message: string, ...args: any[]) => {
    const entry = formatLogEntry('info', message, args);
    storeLog(entry);
    sendToMain('info', message, args);
    console.info(`[${entry.timestamp}] [INFO] ${message}`, ...args);
  },

  warn: (message: string, ...args: any[]) => {
    const entry = formatLogEntry('warn', message, args);
    storeLog(entry);
    sendToMain('warn', message, args);
    console.warn(`[${entry.timestamp}] [WARN] ${message}`, ...args);
  },

  error: (message: string, ...args: any[]) => {
    const entry = formatLogEntry('error', message, args);
    storeLog(entry);
    sendToMain('error', message, args);
    console.error(`[${entry.timestamp}] [ERROR] ${message}`, ...args);
  },

  // Get recent logs for debugging
  getLogs: (limit: number = 100): LogEntry[] => {
    return logHistory.slice(-limit);
  },

  // Get all logs
  getAllLogs: (): LogEntry[] => {
    return [...logHistory];
  },

  // Clear logs
  clearLogs: (): void => {
    logHistory.length = 0;
  },

  // Export logs as string
  exportLogs: (): string => {
    return logHistory
      .map((entry) => {
        const argsStr = entry.args.length > 0 
          ? ' ' + entry.args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
          : '';
        return `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}${argsStr}`;
      })
      .join('\n');
  },
};

// Helper to log IPC calls
export const logIpcCall = (channel: string, ...args: any[]) => {
  logger.debug(`[IPC Call] ${channel}`, ...args);
};

export const logIpcResponse = (channel: string, result: any, duration?: number) => {
  logger.debug(`[IPC Response] ${channel}${duration ? ` (${duration}ms)` : ''}`, result);
};

export const logIpcError = (channel: string, error: any) => {
  logger.error(`[IPC Error] ${channel}`, error);
};

export default logger;
