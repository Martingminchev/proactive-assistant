// =============================================================================
// NEXUS - Context Bridge Service
// Forwards context updates from ContextMonitor to renderer with throttling
// =============================================================================

import { WebContents } from 'electron';
import {
  ContextUpdatePayload,
  ContextUpdateType,
  SystemContext,
  ActiveWindowInfo,
  FileChangeEvent,
  ClipboardItem,
} from '../../shared/types';

const THROTTLE_MS: Record<ContextUpdateType, number> = {
  'window-change': 500,
  'clipboard': 1000,
  'resources': 5000,
  'file-change': 0,
};

const CLIPBOARD_PREVIEW_MAX_LEN = 100;

export class ContextBridge {
  private subscribers = new Set<WebContents>();
  private lastSent: Record<ContextUpdateType, number> = {
    'window-change': 0,
    'clipboard': 0,
    'resources': 0,
    'file-change': 0,
  };
  private previousActiveWindowKey: string = '';

  subscribe(webContents: WebContents): void {
    this.subscribers.add(webContents);
    webContents.once('destroyed', () => this.subscribers.delete(webContents));
  }

  unsubscribe(webContents: WebContents): void {
    this.subscribers.delete(webContents);
  }

  private shouldSend(type: ContextUpdateType): boolean {
    const now = Date.now();
    const throttle = THROTTLE_MS[type];
    if (throttle === 0) return true;
    if (now - this.lastSent[type] >= throttle) {
      this.lastSent[type] = now;
      return true;
    }
    return false;
  }

  private broadcast(payload: ContextUpdatePayload): void {
    const payloadWithTimestamp = { ...payload, timestamp: Date.now() };
    for (const wc of this.subscribers) {
      if (!wc.isDestroyed()) {
        wc.send('context:update', payloadWithTimestamp);
      }
    }
  }

  onContextUpdate(context: SystemContext): void {
    const payload: Partial<ContextUpdatePayload> = { timestamp: Date.now() };

    if (context.activeWindow) {
      const windowKey = `${context.activeWindow.application}|${context.activeWindow.title}`;
      if (windowKey !== this.previousActiveWindowKey) {
        this.previousActiveWindowKey = windowKey;
        if (this.shouldSend('window-change')) {
          this.broadcast({
            type: 'window-change',
            activeWindow: context.activeWindow,
            timestamp: Date.now(),
          });
        }
      }
    }

    if (context.systemResources && this.shouldSend('resources')) {
      this.broadcast({
        type: 'resources',
        systemResources: context.systemResources,
        activeWindow: context.activeWindow,
        timestamp: Date.now(),
      });
    }
  }

  onClipboardChange(item: ClipboardItem): void {
    if (!this.shouldSend('clipboard')) return;

    const preview =
      typeof item.content === 'string'
        ? item.content.length > CLIPBOARD_PREVIEW_MAX_LEN
          ? item.content.substring(0, CLIPBOARD_PREVIEW_MAX_LEN) + '...'
          : item.content
        : '[non-text]';

    this.broadcast({
      type: 'clipboard',
      clipboardPreview: preview,
      timestamp: Date.now(),
    });
  }

  onFileChange(_change: FileChangeEvent, recentFiles: FileChangeEvent[]): void {
    this.broadcast({
      type: 'file-change',
      recentFiles: recentFiles || [],
      timestamp: Date.now(),
    });
  }
}
