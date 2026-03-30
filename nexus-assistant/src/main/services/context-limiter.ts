// =============================================================================
// NEXUS - Context Limiter
// Prevents context from overwhelming the system by enforcing limits
// =============================================================================

import { EventEmitter } from 'events';
import log from 'electron-log';
import {
  SystemContext,
  ClipboardItem,
  FileChangeEvent,
  ActiveWindowInfo,
  SystemResources,
} from '../../shared/types';

export interface ContextLimits {
  /** Max clipboard items to retain */
  maxClipboardItems: number;
  /** Max file change events to retain */
  maxFileHistory: number;
  /** Max age of clipboard items in ms (0 = no limit) */
  maxClipboardAgeMs: number;
  /** Max age of file events in ms (0 = no limit) */
  maxFileEventAgeMs: number;
  /** Max length of clipboard content strings */
  maxClipboardContentLength: number;
  /** Max length of window titles */
  maxWindowTitleLength: number;
  /** Sample rate for resource updates (1 = every update, 2 = every 2nd, etc) */
  resourceUpdateSampleRate: number;
  /** Max context history entries */
  maxContextHistory: number;
}

export const DEFAULT_CONTEXT_LIMITS: ContextLimits = {
  maxClipboardItems: 20,
  maxFileHistory: 50,
  maxClipboardAgeMs: 3600000, // 1 hour
  maxFileEventAgeMs: 86400000, // 24 hours
  maxClipboardContentLength: 10000, // 10KB per item
  maxWindowTitleLength: 200,
  resourceUpdateSampleRate: 1,
  maxContextHistory: 100,
};

interface ContextHistoryEntry {
  timestamp: number;
  context: SystemContext;
  source: 'poll' | 'event' | 'manual';
}

export class ContextLimiter extends EventEmitter {
  private limits: ContextLimits;
  private history: ContextHistoryEntry[] = [];
  private resourceUpdateCounter = 0;
  private lastTrimTime = 0;
  private readonly trimIntervalMs = 60000; // Trim every minute

  constructor(limits: Partial<ContextLimits> = {}) {
    super();
    this.limits = { ...DEFAULT_CONTEXT_LIMITS, ...limits };
  }

  /**
   * Apply limits to a context object, returning a sanitized copy
   */
  sanitizeContext(
    context: SystemContext,
    source: 'poll' | 'event' | 'manual' = 'poll'
  ): SystemContext {
    const now = Date.now();

    // Sample resource updates if needed
    let systemResources = context.systemResources;
    if (systemResources && this.limits.resourceUpdateSampleRate > 1) {
      this.resourceUpdateCounter++;
      if (this.resourceUpdateCounter % this.limits.resourceUpdateSampleRate !== 0) {
        // Skip this update, use previous from history if available
        // Use reverse loop instead of findLast for ES2022 compatibility
        for (let i = this.history.length - 1; i >= 0; i--) {
          if (this.history[i].context.systemResources) {
            systemResources = this.history[i].context.systemResources;
            break;
          }
        }
      }
    }

    const sanitized: SystemContext = {
      timestamp: context.timestamp,
      activeWindow: this.sanitizeWindow(context.activeWindow),
      systemResources,
      clipboardHistory: this.sanitizeClipboard(context.clipboardHistory),
      recentFiles: this.sanitizeFiles(context.recentFiles),
    };

    // Add to history
    this.addToHistory(sanitized, source);

    // Periodic trim
    if (now - this.lastTrimTime > this.trimIntervalMs) {
      this.trimHistory();
      this.lastTrimTime = now;
    }

    return sanitized;
  }

  /**
   * Sanitize active window info
   */
  private sanitizeWindow(window?: ActiveWindowInfo): ActiveWindowInfo | undefined {
    if (!window) return undefined;

    return {
      ...window,
      title: window.title?.slice(0, this.limits.maxWindowTitleLength) || '',
      // Remove potentially sensitive paths for privacy
      path: window.path ? '[redacted]' : undefined,
    };
  }

  /**
   * Sanitize clipboard history
   */
  private sanitizeClipboard(items?: ClipboardItem[]): ClipboardItem[] | undefined {
    if (!items || items.length === 0) return undefined;

    const now = Date.now();
    
    return items
      // Filter by age
      .filter(item => {
        if (this.limits.maxClipboardAgeMs === 0) return true;
        const age = now - (item.timestamp || now);
        return age <= this.limits.maxClipboardAgeMs;
      })
      // Limit content length
      .map(item => ({
        ...item,
        content: typeof item.content === 'string' 
          ? item.content.slice(0, this.limits.maxClipboardContentLength)
          : item.content,
      }))
      // Limit count
      .slice(0, this.limits.maxClipboardItems);
  }

  /**
   * Sanitize file change events
   */
  private sanitizeFiles(files?: FileChangeEvent[]): FileChangeEvent[] | undefined {
    if (!files || files.length === 0) return undefined;

    const now = Date.now();

    return files
      // Filter by age
      .filter(file => {
        if (this.limits.maxFileEventAgeMs === 0) return true;
        const age = now - file.timestamp;
        return age <= this.limits.maxFileEventAgeMs;
      })
      // Remove duplicates (keep most recent)
      .filter((file, index, self) => 
        index === self.findIndex(f => f.path === file.path)
      )
      // Limit count
      .slice(0, this.limits.maxFileHistory);
  }

  /**
   * Add context to history
   */
  private addToHistory(context: SystemContext, source: 'poll' | 'event' | 'manual'): void {
    this.history.push({
      timestamp: Date.now(),
      context,
      source,
    });

    // Immediate trim if over limit
    if (this.history.length > this.limits.maxContextHistory) {
      this.trimHistory();
    }
  }

  /**
   * Trim history to limits
   */
  private trimHistory(): void {
    if (this.history.length <= this.limits.maxContextHistory) return;

    const beforeCount = this.history.length;
    
    // Keep most recent entries
    this.history = this.history.slice(-this.limits.maxContextHistory);
    
    const removed = beforeCount - this.history.length;
    if (removed > 0) {
      log.debug(`[ContextLimiter] Trimmed ${removed} old context entries`);
      this.emit('trimmed', { removed, remaining: this.history.length });
    }
  }

  /**
   * Get context statistics
   */
  getStats(): {
    historySize: number;
    clipboardItems: number;
    fileEvents: number;
    oldestEntry?: number;
    newestEntry?: number;
  } {
    const oldest = this.history[0]?.timestamp;
    const newest = this.history[this.history.length - 1]?.timestamp;
    
    // Get current context stats
    const current = this.history[this.history.length - 1]?.context;

    return {
      historySize: this.history.length,
      clipboardItems: current?.clipboardHistory?.length || 0,
      fileEvents: current?.recentFiles?.length || 0,
      oldestEntry: oldest,
      newestEntry: newest,
    };
  }

  /**
   * Get context history
   */
  getHistory(durationMs?: number): ContextHistoryEntry[] {
    if (!durationMs) return [...this.history];
    
    const cutoff = Date.now() - durationMs;
    return this.history.filter(h => h.timestamp >= cutoff);
  }

  /**
   * Find context changes between two points in time
   */
  getChanges(sinceTimestamp: number): {
    windowChanged: boolean;
    clipboardAdded: number;
    filesChanged: number;
    resourcesChanged: boolean;
  } {
    const recent = this.history.filter(h => h.timestamp >= sinceTimestamp);
    if (recent.length < 2) {
      return { windowChanged: false, clipboardAdded: 0, filesChanged: 0, resourcesChanged: false };
    }

    const first = recent[0].context;
    const last = recent[recent.length - 1].context;

    return {
      windowChanged: first.activeWindow?.title !== last.activeWindow?.title,
      clipboardAdded: (last.clipboardHistory?.length || 0) - (first.clipboardHistory?.length || 0),
      filesChanged: (last.recentFiles?.length || 0) - (first.recentFiles?.length || 0),
      resourcesChanged: first.systemResources?.cpu.usage !== last.systemResources?.cpu.usage,
    };
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.history = [];
    this.emit('cleared');
    log.debug('[ContextLimiter] History cleared');
  }

  /**
   * Update limits
   */
  updateLimits(newLimits: Partial<ContextLimits>): void {
    this.limits = { ...this.limits, ...newLimits };
    this.emit('limitsUpdated', this.limits);
    this.trimHistory();
  }

  /**
   * Get current limits
   */
  getLimits(): ContextLimits {
    return { ...this.limits };
  }
}
