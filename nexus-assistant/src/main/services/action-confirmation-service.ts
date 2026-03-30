// =============================================================================
// NEXUS - Action Confirmation Service
// Handles user confirmation for sensitive actions with permission memory
// =============================================================================

import { EventEmitter } from 'events';
import { BrowserWindow } from 'electron';
import log from 'electron-log';
import Store from 'electron-store';
import {
  ActionConfirmationRequest,
  ActionConfirmationResponse,
  ActionPermissionMemory,
  ConfirmableActionType,
  ActionRiskLevel,
} from '../../shared/types';

// Default timeout for confirmation requests (30 seconds)
const DEFAULT_TIMEOUT_MS = 30000;

// Store key for permission memory
const PERMISSION_STORE_KEY = 'actionPermissions';

interface PendingConfirmation {
  request: ActionConfirmationRequest;
  resolve: (value: boolean) => void;
  timeoutId: NodeJS.Timeout;
}

class ActionConfirmationService extends EventEmitter {
  private mainWindow: BrowserWindow | null = null;
  private pendingConfirmations = new Map<string, PendingConfirmation>();
  private permissionStore: Store<{ [PERMISSION_STORE_KEY]: ActionPermissionMemory[] }>;
  private permissionMemory: ActionPermissionMemory[] = [];

  constructor() {
    super();
    
    // Initialize permission store
    this.permissionStore = new Store<{ [PERMISSION_STORE_KEY]: ActionPermissionMemory[] }>(
      {
        defaults: {
          [PERMISSION_STORE_KEY]: [],
        },
        serialize: (value) => JSON.stringify(value, null, 2),
        deserialize: (text) => JSON.parse(text),
      }
    );
    
    // Load existing permissions
    this.loadPermissions();
    
    log.info('ActionConfirmationService initialized');
  }

  /**
   * Set the main window reference for sending IPC messages
   */
  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
    log.info('ActionConfirmationService: Main window set');
  }

  /**
   * Load permission memory from store
   */
  private loadPermissions(): void {
    try {
      this.permissionMemory = this.permissionStore.get(PERMISSION_STORE_KEY) || [];
      
      // Clean up expired permissions
      const now = Date.now();
      const validPermissions = this.permissionMemory.filter(
        (p) => !p.expiresAt || p.expiresAt > now
      );
      
      if (validPermissions.length !== this.permissionMemory.length) {
        this.permissionMemory = validPermissions;
        this.savePermissions();
        log.info(`Cleaned up ${this.permissionMemory.length - validPermissions.length} expired permissions`);
      }
      
      log.info(`Loaded ${this.permissionMemory.length} action permissions`);
    } catch (error) {
      log.error('Failed to load permissions:', error);
      this.permissionMemory = [];
    }
  }

  /**
   * Save permission memory to store
   */
  private savePermissions(): void {
    try {
      this.permissionStore.set(PERMISSION_STORE_KEY, this.permissionMemory);
    } catch (error) {
      log.error('Failed to save permissions:', error);
    }
  }

  /**
   * Request user confirmation for an action
   * Returns a promise that resolves to true if approved, false otherwise
   */
  public async requestConfirmation(
    actionType: ConfirmableActionType,
    riskLevel: ActionRiskLevel,
    title: string,
    description: string,
    payload?: Record<string, any>,
    options: {
      timeoutMs?: number;
      source?: 'user' | 'agent' | 'system';
    } = {}
  ): Promise<boolean> {
    const { timeoutMs = DEFAULT_TIMEOUT_MS, source = 'agent' } = options;

    // Check if we already have permission for this action type
    if (this.hasPermission(actionType, payload)) {
      log.info(`Auto-approved ${actionType} based on permission memory`);
      return true;
    }

    // Auto-approve low risk actions
    if (riskLevel === 'low') {
      log.info(`Auto-approved ${actionType} (low risk)`);
      return true;
    }

    // Create confirmation request
    const request: ActionConfirmationRequest = {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      actionType,
      riskLevel,
      title,
      description,
      payload,
      timeoutMs,
      timestamp: Date.now(),
      source,
    };

    // Show main window to ensure user sees the confirmation
    if (this.mainWindow) {
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore();
      }
      this.mainWindow.show();
      this.mainWindow.focus();
    }

    return new Promise((resolve) => {
      // Set up timeout
      const timeoutId = setTimeout(() => {
        this.handleTimeout(request.id);
      }, timeoutMs);

      // Store pending confirmation
      this.pendingConfirmations.set(request.id, {
        request,
        resolve,
        timeoutId,
      });

      // Send request to renderer
      this.sendRequestToRenderer(request);

      log.info(`Confirmation requested: ${actionType} (${riskLevel}) - ${title}`);
    });
  }

  /**
   * Send confirmation request to the renderer process
   */
  private sendRequestToRenderer(request: ActionConfirmationRequest): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('action:confirmation-request', request);
    } else {
      log.warn('Cannot send confirmation request: main window not available');
    }
  }

  /**
   * Handle user response to a confirmation request
   */
  public handleResponse(response: ActionConfirmationResponse): void {
    const { requestId, approved, rememberChoice } = response;
    
    const pending = this.pendingConfirmations.get(requestId);
    if (!pending) {
      log.warn(`Received response for unknown request: ${requestId}`);
      return;
    }

    // Clear timeout
    clearTimeout(pending.timeoutId);
    this.pendingConfirmations.delete(requestId);

    // Store permission if user wants to remember
    if (rememberChoice && approved) {
      this.setPermission(pending.request.actionType, true, pending.request.payload);
    }

    // Resolve the promise
    pending.resolve(approved);

    log.info(`Confirmation ${approved ? 'approved' : 'denied'}: ${pending.request.actionType}`);
  }

  /**
   * Handle timeout for a confirmation request
   */
  private handleTimeout(requestId: string): void {
    const pending = this.pendingConfirmations.get(requestId);
    if (!pending) {
      return;
    }

    this.pendingConfirmations.delete(requestId);

    // Notify renderer about timeout
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('action:confirmation-timeout', { requestId });
    }

    // Resolve as denied
    pending.resolve(false);

    log.info(`Confirmation timed out: ${pending.request.actionType}`);
    this.emit('timeout', pending.request);
  }

  /**
   * Check if we have permission for an action type
   */
  public hasPermission(actionType: ConfirmableActionType, payload?: Record<string, any>): boolean {
    const permission = this.permissionMemory.find(
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
      // Simple glob matching for file paths
      if (payload.path || payload.filePath) {
        const path = payload.path || payload.filePath;
        if (!this.matchPattern(path, permission.pattern)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Set permission for an action type
   */
  public setPermission(
    actionType: ConfirmableActionType,
    allowed: boolean,
    payload?: Record<string, any>,
    options: {
      expiresAt?: number;
      pattern?: string;
    } = {}
  ): void {
    const { expiresAt, pattern } = options;

    // Remove existing permission for this action type
    this.permissionMemory = this.permissionMemory.filter(
      (p) => !(p.actionType === actionType && p.pattern === pattern)
    );

    // Add new permission
    this.permissionMemory.push({
      actionType,
      allowed,
      pattern: pattern || this.generatePatternFromPayload(payload),
      expiresAt,
      createdAt: Date.now(),
    });

    this.savePermissions();
    log.info(`Permission set: ${actionType} = ${allowed}`);
  }

  /**
   * Clear permission for an action type
   */
  public clearPermission(actionType: ConfirmableActionType, pattern?: string): void {
    const beforeCount = this.permissionMemory.length;
    
    this.permissionMemory = this.permissionMemory.filter(
      (p) => !(p.actionType === actionType && (!pattern || p.pattern === pattern))
    );

    if (this.permissionMemory.length !== beforeCount) {
      this.savePermissions();
      log.info(`Permission cleared: ${actionType}`);
    }
  }

  /**
   * Get all stored permissions
   */
  public getPermissions(): ActionPermissionMemory[] {
    return [...this.permissionMemory];
  }

  /**
   * Clear all permissions
   */
  public clearAllPermissions(): void {
    this.permissionMemory = [];
    this.savePermissions();
    log.info('All permissions cleared');
  }

  /**
   * Get pending confirmation count
   */
  public getPendingCount(): number {
    return this.pendingConfirmations.size;
  }

  /**
   * Cancel all pending confirmations
   */
  public cancelAll(): void {
    for (const [id, pending] of this.pendingConfirmations) {
      clearTimeout(pending.timeoutId);
      pending.resolve(false);
      log.info(`Cancelled pending confirmation: ${id}`);
    }
    this.pendingConfirmations.clear();
  }

  /**
   * Generate a pattern from payload for permission matching
   */
  private generatePatternFromPayload(payload?: Record<string, any>): string | undefined {
    if (!payload) return undefined;

    // For file operations, use the directory path with wildcard
    if (payload.path || payload.filePath) {
      const path = payload.path || payload.filePath;
      const lastSlash = path.lastIndexOf('/');
      if (lastSlash > 0) {
        return path.substring(0, lastSlash) + '/*';
      }
    }

    return undefined;
  }

  /**
   * Simple glob pattern matching
   */
  private matchPattern(value: string, pattern: string): boolean {
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
}

// Export singleton instance
let serviceInstance: ActionConfirmationService | null = null;

export function getActionConfirmationService(): ActionConfirmationService {
  if (!serviceInstance) {
    serviceInstance = new ActionConfirmationService();
  }
  return serviceInstance;
}

export function resetActionConfirmationService(): void {
  if (serviceInstance) {
    serviceInstance.cancelAll();
    serviceInstance.removeAllListeners();
  }
  serviceInstance = null;
}

export { ActionConfirmationService };
