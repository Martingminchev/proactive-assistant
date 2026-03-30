// =============================================================================
// NEXUS - useContextBridge
// Subscribes to throttled context updates from main process
// Returns context and available quick actions (debounced evaluation)
// =============================================================================

import { useEffect, useState, useRef, useCallback } from 'react';
import type { ContextUpdatePayload, ActiveWindowInfo, SystemResources, FileChangeEvent } from '../../shared/types';
import type { QuickActionDefinition } from '../../shared/types';
import { getAvailableActions } from '../constants/quickActions';

export interface AppContext {
  activeWindow?: ActiveWindowInfo;
  clipboardPreview?: string;
  recentFiles?: FileChangeEvent[];
  systemResources?: SystemResources;
  timestamp: number;
}

const emptyContext: AppContext = { timestamp: 0 };
const DEBOUNCE_MS = 300;

export function useContextBridge(): { context: AppContext; availableActions: QuickActionDefinition[] } {
  const [context, setContext] = useState<AppContext>(emptyContext);
  const [availableActions, setAvailableActions] = useState<QuickActionDefinition[]>(
    getAvailableActions({})
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const evaluateActions = useCallback((ctx: AppContext) => {
    const actions = getAvailableActions({
      activeWindow: ctx.activeWindow,
      clipboardPreview: ctx.clipboardPreview,
    });
    setAvailableActions(actions);
  }, []);

  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.subscribeContext();

    const unsubscribe = window.electronAPI.onContextUpdate((_, payload: ContextUpdatePayload) => {
      setContext((prev) => {
        const next: AppContext = {
          ...prev,
          timestamp: payload.timestamp,
        };
        if (payload.activeWindow !== undefined) next.activeWindow = payload.activeWindow;
        if (payload.clipboardPreview !== undefined) next.clipboardPreview = payload.clipboardPreview;
        if (payload.recentFiles !== undefined) next.recentFiles = payload.recentFiles;
        if (payload.systemResources !== undefined) next.systemResources = payload.systemResources;

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          debounceRef.current = null;
          evaluateActions(next);
        }, DEBOUNCE_MS);

        return next;
      });
    });

    window.electronAPI.getContext().then((ctx) => {
      const appCtx: AppContext = {
        activeWindow: ctx.activeWindow,
        clipboardPreview: ctx.clipboardHistory?.[0]
          ? typeof ctx.clipboardHistory[0].content === 'string'
            ? ctx.clipboardHistory[0].content.substring(0, 100)
            : '[non-text]'
          : undefined,
        recentFiles: ctx.recentFiles,
        systemResources: ctx.systemResources,
        timestamp: ctx.timestamp,
      };
      setContext(appCtx);
      evaluateActions(appCtx);
    });

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      unsubscribe();
      window.electronAPI?.unsubscribeContext();
    };
  }, [evaluateActions]);

  return { context, availableActions };
}
