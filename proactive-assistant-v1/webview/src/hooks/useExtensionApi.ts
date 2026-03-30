import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Message from extension to webview
 */
export interface ExtensionMessage {
  type: string;
  payload?: unknown;
}

/**
 * Message from webview to extension
 */
export interface WebviewMessage {
  command: string;
  [key: string]: unknown;
}

/**
 * App state from extension
 */
export interface AppState {
  view: 'welcome' | 'suggestions' | 'stats' | 'settings' | 'focus';
  currentFile?: {
    path: string | null;
    name: string | null;
    duration: number;
  };
  suggestion?: {
    id: string;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    actions: Array<{
      id: string;
      label: string;
      type: string;
    }>;
  };
  stats?: {
    suggestionsAccepted: number;
    suggestionsDismissed: number;
    timeInFocusMode: number;
    linesOptimized: number;
    currentStreak: number;
  };
  flowState?: string;
  focusMode?: {
    active: boolean;
    timeRemaining?: number;
  };
}

/**
 * Type for message handlers
 */
type MessageHandler = (payload: unknown) => void;

/**
 * Hook for communicating with the VS Code extension host
 */
export function useExtensionApi() {
  const [isReady, setIsReady] = useState(false);
  const [appState, setAppState] = useState<AppState | null>(null);
  const handlersRef = useRef<Map<string, Set<MessageHandler>>>(new Map());
  const vscodeRef = useRef<WebviewApi<unknown> | null>(null);

  // Initialize API communication
  useEffect(() => {
    // Check if we're running in VS Code webview
    if (typeof acquireVsCodeApi === 'undefined') {
      console.warn('Not running in VS Code webview environment');
      // Set up mock for development
      setIsReady(true);
      return;
    }

    // Acquire VS Code API (can only be called once)
    const vscode = acquireVsCodeApi();
    vscodeRef.current = vscode;

    // Mark as ready
    setIsReady(true);

    // Handle messages from extension
    const handleMessage = (event: MessageEvent<ExtensionMessage>) => {
      const { type, payload, state } = event.data as ExtensionMessage & { state?: unknown };

      console.log('[Extension API] Received message:', { type, payload, state });

      if (!type) {
        console.warn('[Extension API] Message without type received:', event.data);
        return;
      }

      // Handle state updates (extension sends 'state', webview expects it as payload)
      if (type === 'stateUpdate') {
        const stateData = state ?? payload;
        if (stateData) {
          console.log('[Extension API] Setting app state:', stateData);
          setAppState(stateData as AppState);
        } else {
          console.warn('[Extension API] stateUpdate received without state or payload');
        }
      }

      // Call registered handlers
      const handlers = handlersRef.current.get(type);
      if (handlers) {
        handlers.forEach(handler => {
          try {
            // Pass payload or state depending on message type
            handler(type === 'stateUpdate' ? (state ?? payload) : payload);
          } catch (error) {
            console.error(`Error in message handler for ${type}:`, error);
          }
        });
      }
    };

    window.addEventListener('message', handleMessage);

    // Notify extension that webview is ready
    vscode.postMessage({ command: 'panelReady' });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  /**
   * Send a message to the extension
   */
  const postMessage = useCallback((command: string, data?: Record<string, unknown>) => {
    if (vscodeRef.current) {
      vscodeRef.current.postMessage({ command, ...data });
    } else if (typeof acquireVsCodeApi === 'undefined') {
      // Development fallback
      console.log('[Extension API] Would send:', { command, ...data });
    }
  }, []);

  /**
   * Send command with specific payload structure
   */
  const sendCommand = useCallback((command: string, payload?: unknown) => {
    if (vscodeRef.current) {
      const message: WebviewMessage = { command };
      if (payload !== undefined) {
        // Add payload properties to message
        if (typeof payload === 'object' && payload !== null) {
          Object.assign(message, payload);
        } else {
          message.payload = payload;
        }
      }
      vscodeRef.current.postMessage(message);
    } else if (typeof acquireVsCodeApi === 'undefined') {
      console.log('[Extension API] Would send:', { command, payload });
    }
  }, []);

  /**
   * Register a handler for a specific message type
   * Returns an unsubscribe function
   */
  const onMessage = useCallback((type: string, handler: MessageHandler): (() => void) => {
    if (!handlersRef.current.has(type)) {
      handlersRef.current.set(type, new Set());
    }

    handlersRef.current.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      handlersRef.current.get(type)?.delete(handler);
    };
  }, []);

  /**
   * Register a one-time handler for a specific message type
   */
  const onceMessage = useCallback((type: string, handler: MessageHandler): (() => void) => {
    const unsubscribe = onMessage(type, (payload) => {
      unsubscribe();
      handler(payload);
    });
    return unsubscribe;
  }, [onMessage]);

  /**
   * Send a message and wait for a response
   */
  const request = useCallback(<T = unknown>(
    command: string,
    payload?: unknown,
    responseType?: string,
    timeout = 5000
  ): Promise<T> => {
    return new Promise((resolve, reject) => {
      const responseEventType = responseType || `${command}Response`;

      const timeoutId = setTimeout(() => {
        unsubscribe();
        reject(new Error(`Request timeout: ${command}`));
      }, timeout);

      const unsubscribe = onceMessage(responseEventType, (responsePayload) => {
        clearTimeout(timeoutId);
        resolve(responsePayload as T);
      });

      sendCommand(command, payload);
    });
  }, [sendCommand, onceMessage]);

  /**
   * Request current state from extension
   */
  const requestState = useCallback(() => {
    postMessage('getCurrentState');
  }, [postMessage]);

  /**
   * Apply a suggestion
   */
  const applySuggestion = useCallback((suggestionId: string) => {
    postMessage('applySuggestion', { suggestionId });
  }, [postMessage]);

  /**
   * Dismiss a suggestion
   */
  const dismissSuggestion = useCallback((suggestionId: string, reason?: string) => {
    postMessage('dismissSuggestion', { suggestionId, reason });
  }, [postMessage]);

  /**
   * Snooze suggestions
   */
  const snoozeSuggestion = useCallback((duration: number) => {
    postMessage('snoozeSuggestion', { duration });
  }, [postMessage]);

  /**
   * Enable focus mode
   */
  const enableFocusMode = useCallback((duration?: number) => {
    postMessage('enableFocusMode', { duration });
  }, [postMessage]);

  /**
   * Disable focus mode
   */
  const disableFocusMode = useCallback(() => {
    postMessage('disableFocusMode');
  }, [postMessage]);

  /**
   * Toggle focus mode
   */
  const toggleFocusMode = useCallback((active: boolean, duration?: number) => {
    if (active) {
      enableFocusMode(duration);
    } else {
      disableFocusMode();
    }
  }, [enableFocusMode, disableFocusMode]);

  /**
   * Open settings
   */
  const openSettings = useCallback(() => {
    postMessage('openSettings');
  }, [postMessage]);

  /**
   * Show stats
   */
  const showStats = useCallback(() => {
    postMessage('showStats');
  }, [postMessage]);

  /**
   * Accept a suggestion
   */
  const acceptSuggestion = useCallback((id: string) => {
    postMessage('acceptSuggestion', { id });
  }, [postMessage]);

  /**
   * View a suggestion (navigate to file)
   */
  const viewSuggestion = useCallback((id: string) => {
    postMessage('viewSuggestion', { id });
  }, [postMessage]);

  return {
    isReady,
    appState,
    postMessage,
    sendCommand,
    onMessage,
    onceMessage,
    request,
    requestState,
    applySuggestion,
    dismissSuggestion,
    snoozeSuggestion,
    enableFocusMode,
    disableFocusMode,
    toggleFocusMode,
    openSettings,
    showStats,
    acceptSuggestion,
    viewSuggestion,
  };
}

export default useExtensionApi;

/**
 * VS Code Webview API type
 */
interface WebviewApi<T> {
  postMessage(message: unknown): void;
  setState(state: T): T;
  getState(): T | undefined;
}

// TypeScript declaration for VS Code API
declare global {
  function acquireVsCodeApi(): WebviewApi<unknown>;
}
