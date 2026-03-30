import { useCallback, useEffect, useRef, useState } from 'react';
import type { ExtensionMessage, WebviewMessage } from '../types';

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState<T>(state: T): T;
}

declare global {
  interface Window {
    acquireVsCodeApi(): VsCodeApi;
  }
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason?: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export function useExtensionApi() {
  const vscodeRef = useRef<VsCodeApi | null>(null);
  const pendingRequestsRef = useRef<Map<string, PendingRequest>>(new Map());
  const messageListenerRef = useRef<((message: ExtensionMessage) => void) | null>(null);
  
  const [isReady, setIsReady] = useState(false);

  // Initialize VS Code API
  useEffect(() => {
    try {
      console.log('[Webview] Initializing VS Code API...');
      if (typeof window.acquireVsCodeApi === 'function') {
        vscodeRef.current = window.acquireVsCodeApi();
        console.log('[Webview] VS Code API acquired successfully');
        setIsReady(true);
        
        // Notify extension that webview is ready
        console.log('[Webview] Sending ready message to extension');
        postMessage({ type: 'ready' });
      } else {
        console.warn('[ProactiveAssistant] Running outside VS Code environment');
        // Mock for development
        vscodeRef.current = {
          postMessage: (msg: unknown) => console.log('[Mock Post]', msg),
          getState: () => ({}),
          setState: <T>(state: T) => state
        };
        setIsReady(true);
      }
    } catch (error) {
      console.error('[ProactiveAssistant] Failed to acquire VS Code API:', error);
    }
  }, []);

  // Set up message listener
  useEffect(() => {
    console.log('[Webview] Setting up message listener');
    
    const handleMessage = (event: MessageEvent) => {
      const message = event.data as ExtensionMessage;
      console.log(`[Webview] Received message from extension:`, message.type, message);
      
      // Handle response messages (check for requestId on any message type)
      if (message.requestId) {
        const pending = pendingRequestsRef.current.get(message.requestId);
        if (pending) {
          console.log(`[Webview] Resolving pending request: ${message.requestId}`);
          clearTimeout(pending.timeout);
          pending.resolve(message.payload);
          pendingRequestsRef.current.delete(message.requestId);
          return;
        }
      }
      
      // Forward to registered listener
      if (messageListenerRef.current) {
        console.log(`[Webview] Forwarding message to registered listener`);
        messageListenerRef.current(message);
      } else {
        console.warn(`[Webview] No message listener registered`);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      console.log('[Webview] Removing message listener');
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Post message to extension
  const postMessage = useCallback((message: Omit<WebviewMessage, 'requestId'> & { requestId?: string }) => {
    if (vscodeRef.current) {
      vscodeRef.current.postMessage(message);
    }
  }, []);

  // Send message and wait for response
  const sendRequest = useCallback(<T = unknown>(
    message: Omit<WebviewMessage, 'requestId'>,
    timeoutMs = 30000
  ): Promise<T> => {
    return new Promise((resolve, reject) => {
      if (!vscodeRef.current) {
        reject(new Error('VS Code API not available'));
        return;
      }

      const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const timeout = setTimeout(() => {
        pendingRequestsRef.current.delete(requestId);
        reject(new Error(`Request timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      pendingRequestsRef.current.set(requestId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout
      });

      vscodeRef.current.postMessage({
        ...message,
        requestId
      });
    });
  }, []);

  // Register message listener
  const onMessage = useCallback((callback: (message: ExtensionMessage) => void) => {
    messageListenerRef.current = callback;
  }, []);

  // Unregister message listener
  const offMessage = useCallback(() => {
    messageListenerRef.current = null;
  }, []);

  // Get persisted state
  const getState = useCallback(<T = unknown>(): T | undefined => {
    if (vscodeRef.current) {
      return vscodeRef.current.getState() as T | undefined;
    }
    return undefined;
  }, []);

  // Set persisted state
  const setState = useCallback(<T = unknown>(state: T) => {
    if (vscodeRef.current) {
      vscodeRef.current.setState(state);
    }
  }, []);

  return {
    isReady,
    postMessage,
    sendRequest,
    onMessage,
    offMessage,
    getState,
    setState
  };
}

// Convenience hooks for specific message types
export function useExtensionMessage(handler: (message: ExtensionMessage) => void) {
  const { onMessage, offMessage } = useExtensionApi();

  useEffect(() => {
    onMessage(handler);
    return () => offMessage();
  }, [handler, onMessage, offMessage]);
}

export function useSuggestions(handler: (suggestions: unknown) => void) {
  useExtensionMessage((message) => {
    if (message.type === 'suggestions') {
      handler(message.payload);
    }
  });
}

export function useStatus(handler: (status: unknown) => void) {
  useExtensionMessage((message) => {
    if (message.type === 'status') {
      handler(message.payload);
    }
  });
}

export function useStats(handler: (stats: unknown) => void) {
  useExtensionMessage((message) => {
    if (message.type === 'stats') {
      handler(message.payload);
    }
  });
}

export function useSettings(handler: (settings: unknown) => void) {
  useExtensionMessage((message) => {
    if (message.type === 'settings') {
      handler(message.payload);
    }
  });
}
