// =============================================================================
// NEXUS - Action Store
// Zustand store for action confirmation state management
// =============================================================================

import { create } from 'zustand';
import { IpcRendererEvent } from 'electron';
import {
  ActionConfirmationRequest,
  ActionConfirmationResponse,
  ActionPermissionMemory,
  ConfirmableActionType,
} from '../../shared/types';
import { logger } from '../utils/logger';

// =============================================================================
// State Interface
// =============================================================================

interface ActionState {
  // State
  pendingRequest: ActionConfirmationRequest | null;
  permissionMemory: ActionPermissionMemory[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setPendingRequest: (request: ActionConfirmationRequest | null) => void;
  confirmAction: (requestId: string, rememberChoice: boolean) => Promise<void>;
  denyAction: (requestId: string) => Promise<void>;
  hasPermission: (actionType: ConfirmableActionType, payload?: Record<string, any>) => boolean;
  clearPermission: (actionType: ConfirmableActionType, pattern?: string) => Promise<boolean>;
  clearAllPermissions: () => Promise<boolean>;
  loadPermissions: () => Promise<void>;
}

// =============================================================================
// Store Implementation
// =============================================================================

export const useActionStore = create<ActionState>((set, get) => ({
  pendingRequest: null,
  permissionMemory: [],
  isLoading: false,
  error: null,

  setPendingRequest: (request) => {
    set({ pendingRequest: request });
    if (request) {
      logger.info(`Action confirmation request received: ${request.actionType}`);
    }
  },

  confirmAction: async (requestId, rememberChoice) => {
    const { pendingRequest } = get();
    
    if (!pendingRequest || pendingRequest.id !== requestId) {
      logger.warn('Confirm action called with invalid request ID');
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const response: ActionConfirmationResponse = {
        requestId,
        approved: true,
        rememberChoice,
        timestamp: Date.now(),
      };

      await window.electronAPI?.respondToActionConfirmation(response);
      
      // Update local permission memory if user wants to remember
      if (rememberChoice) {
        const newPermission: ActionPermissionMemory = {
          actionType: pendingRequest.actionType,
          allowed: true,
          pattern: (pendingRequest.payload?.path as string) || (pendingRequest.payload?.filePath as string),
          createdAt: Date.now(),
        };
        
        set((state) => ({
          permissionMemory: [
            ...state.permissionMemory.filter(
              (p) => p.actionType !== newPermission.actionType
            ),
            newPermission,
          ],
        }));
      }

      set({ pendingRequest: null, isLoading: false });
      logger.info(`Action confirmed: ${pendingRequest.actionType}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to confirm action:', error);
      set({ error: errorMessage, isLoading: false });
    }
  },

  denyAction: async (requestId) => {
    const { pendingRequest } = get();
    
    if (!pendingRequest || pendingRequest.id !== requestId) {
      logger.warn('Deny action called with invalid request ID');
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const response: ActionConfirmationResponse = {
        requestId,
        approved: false,
        rememberChoice: false,
        timestamp: Date.now(),
      };

      await window.electronAPI?.respondToActionConfirmation(response);
      set({ pendingRequest: null, isLoading: false });
      logger.info(`Action denied: ${pendingRequest.actionType}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to deny action:', error);
      set({ error: errorMessage, isLoading: false });
    }
  },

  hasPermission: (actionType: ConfirmableActionType, payload?: Record<string, any>) => {
    const { permissionMemory } = get();
    
    const permission = permissionMemory.find(
      (p) => p.actionType === actionType && p.allowed
    );

    if (!permission) {
      return false;
    }

    // Check expiration
    if (permission.expiresAt && permission.expiresAt < Date.now()) {
      return false;
    }

    // Check pattern if provided
    if (permission.pattern && payload) {
      const path = payload.path || payload.filePath;
      if (path && !matchPattern(path, permission.pattern)) {
        return false;
      }
    }

    return true;
  },

  clearPermission: async (actionType: ConfirmableActionType, pattern?: string) => {
    set({ isLoading: true, error: null });

    try {
      const success = await window.electronAPI?.clearActionPermission(actionType, pattern);
      
      if (success) {
        set((state) => ({
          permissionMemory: state.permissionMemory.filter(
            (p) => !(p.actionType === actionType && (!pattern || p.pattern === pattern))
          ),
        }));
        logger.info(`Permission cleared: ${actionType}`);
      }
      
      set({ isLoading: false });
      return success ?? false;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to clear permission:', error);
      set({ error: errorMessage, isLoading: false });
      return false;
    }
  },

  clearAllPermissions: async () => {
    set({ isLoading: true, error: null });

    try {
      // Clear all via IPC
      await Promise.all(
        get().permissionMemory.map((p) =>
          window.electronAPI?.clearActionPermission(p.actionType, p.pattern)
        )
      );
      
      set({ permissionMemory: [], isLoading: false });
      logger.info('All permissions cleared');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to clear all permissions:', error);
      set({ error: errorMessage, isLoading: false });
      return false;
    }
  },

  loadPermissions: async () => {
    set({ isLoading: true, error: null });

    try {
      const permissions = await window.electronAPI?.getActionPermission();
      
      if (permissions) {
        // Clean up expired permissions
        const now = Date.now();
        const validPermissions = permissions.filter(
          (p: ActionPermissionMemory) => !p.expiresAt || p.expiresAt > now
        );
        
        set({ permissionMemory: validPermissions, isLoading: false });
        logger.info(`Loaded ${validPermissions.length} permissions`);
      } else {
        set({ permissionMemory: [], isLoading: false });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to load permissions:', error);
      set({ error: errorMessage, isLoading: false });
    }
  },
}));

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Simple glob pattern matching
 */
function matchPattern(value: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');

  try {
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(value);
  } catch {
    return false;
  }
}

// =============================================================================
// IPC Event Listeners Setup
// =============================================================================

export function setupActionIpcListeners(): () => void {
  if (typeof window === 'undefined' || !window.electronAPI) {
    return () => {};
  }

  // Listen for confirmation requests
  const unsubscribeRequest = window.electronAPI.onActionConfirmationRequest(
    (_: IpcRendererEvent, request: ActionConfirmationRequest) => {
      useActionStore.getState().setPendingRequest(request);
    }
  );

  // Listen for timeouts
  const unsubscribeTimeout = window.electronAPI.onActionConfirmationTimeout(
    (_: IpcRendererEvent, data: { requestId: string }) => {
      const { pendingRequest, setPendingRequest } = useActionStore.getState();
      if (pendingRequest?.id === data.requestId) {
        setPendingRequest(null);
        logger.info('Action confirmation timed out');
      }
    }
  );

  // Return cleanup function
  return () => {
    unsubscribeRequest();
    unsubscribeTimeout();
  };
}

// =============================================================================
// Store Initialization
// =============================================================================

// Set up listeners when in renderer environment
if (typeof window !== 'undefined' && window.electronAPI) {
  const cleanup = setupActionIpcListeners();
  
  // Load permissions on initialization
  useActionStore.getState().loadPermissions();
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', cleanup);
}

export default useActionStore;
