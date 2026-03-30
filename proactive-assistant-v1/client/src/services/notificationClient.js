/**
 * Notification Client Service
 * Handles notifications from the server via WebSocket and in-app display
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const WS_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/^http/, 'ws');

class NotificationClient {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.listeners = new Map();
    this.inAppNotifications = [];
    this.inAppEnabled = true;
    this.permission = 'default';
    this.showNativeNotifications = true;
    this.lastNotificationTime = 0;
    this.minInterval = 2000; // Minimum 2 seconds between notifications
    
    // Bind methods
    this.handleWebSocketMessage = this.handleWebSocketMessage.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    
    // Initialize
    this.init();
  }

  /**
   * Initialize the notification client
   */
  init() {
    // Request notification permission
    this.requestPermission();
    
    // Connect to WebSocket
    this.connectWebSocket();
    
    // Listen for visibility changes
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    console.log('📬 Notification Client initialized');
  }

  /**
   * Request browser notification permission
   */
  async requestPermission() {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      this.permission = 'unsupported';
      return;
    }

    if (Notification.permission === 'granted') {
      this.permission = 'granted';
      return;
    }

    if (Notification.permission === 'denied') {
      this.permission = 'denied';
      console.warn('Notification permission denied');
      return;
    }

    try {
      const result = await Notification.requestPermission();
      this.permission = result;
      console.log('Notification permission:', result);
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  }

  /**
   * Connect to WebSocket server
   */
  connectWebSocket() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      this.ws = new WebSocket(`${WS_URL}/notifications`);
      
      this.ws.onopen = () => {
        console.log('📡 Notification WebSocket connected');
        this.reconnectAttempts = 0;
        this.emit('connected', {});
      };
      
      this.ws.onmessage = this.handleWebSocketMessage;
      
      this.ws.onclose = () => {
        console.log('📡 Notification WebSocket closed');
        this.emit('disconnected', {});
        this.attemptReconnect();
      };
      
      this.ws.onerror = (error) => {
        console.error('📡 WebSocket error:', error);
        this.emit('error', error);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      this.attemptReconnect();
    }
  }

  /**
   * Attempt to reconnect WebSocket
   */
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('Max WebSocket reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connectWebSocket();
    }, this.reconnectDelay);
  }

  /**
   * Handle WebSocket messages
   */
  handleWebSocketMessage(event) {
    try {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'notification':
          this.handleServerNotification(message.data);
          break;
        case 'action':
          this.handleServerAction(message.data);
          break;
        default:
          console.log('Unknown WebSocket message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  /**
   * Handle notification from server
   */
  handleServerNotification(notification) {
    // Check throttling
    const now = Date.now();
    if (now - this.lastNotificationTime < this.minInterval) {
      console.log('Notification throttled');
      return;
    }
    this.lastNotificationTime = now;

    // Add to in-app notifications
    if (this.inAppEnabled) {
      this.addInAppNotification(notification);
    }

    // Show native notification if enabled and document is hidden
    if (this.showNativeNotifications && document.hidden) {
      this.showNativeNotification(notification);
    }

    // Emit event for components
    this.emit('notification', notification);
  }

  /**
   * Handle action from server
   */
  handleServerAction(data) {
    this.emit('action', data);
  }

  /**
   * Handle visibility change
   */
  handleVisibilityChange() {
    if (!document.hidden) {
      // Clear native notifications when app becomes visible
      // (In-app notifications will remain)
    }
  }

  // ==================== IN-APP NOTIFICATIONS ====================

  /**
   * Add notification to in-app queue
   */
  addInAppNotification(notification) {
    const enrichedNotification = {
      ...notification,
      clientId: `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      receivedAt: Date.now(),
      read: false,
      dismissed: false
    };

    this.inAppNotifications.unshift(enrichedNotification);
    
    // Limit queue size
    if (this.inAppNotifications.length > 50) {
      this.inAppNotifications = this.inAppNotifications.slice(0, 50);
    }

    this.emit('inAppNotification', enrichedNotification);
  }

  /**
   * Get in-app notifications
   */
  getInAppNotifications(options = {}) {
    let notifications = [...this.inAppNotifications];
    
    if (options.unreadOnly) {
      notifications = notifications.filter(n => !n.read);
    }
    
    if (options.limit) {
      notifications = notifications.slice(0, options.limit);
    }
    
    return notifications;
  }

  /**
   * Mark notification as read
   */
  markAsRead(clientId) {
    const notification = this.inAppNotifications.find(n => n.clientId === clientId);
    if (notification) {
      notification.read = true;
      this.emit('notificationRead', { clientId });
    }
    return notification;
  }

  /**
   * Dismiss in-app notification
   */
  dismissInApp(clientId) {
    const notification = this.inAppNotifications.find(n => n.clientId === clientId);
    if (notification) {
      notification.dismissed = true;
      this.emit('notificationDismissed', { clientId });
    }
    return notification;
  }

  /**
   * Clear all in-app notifications
   */
  clearInApp() {
    this.inAppNotifications = [];
    this.emit('notificationsCleared', {});
  }

  /**
   * Set in-app notifications enabled
   */
  setInAppEnabled(enabled) {
    this.inAppEnabled = enabled;
  }

  // ==================== NATIVE NOTIFICATIONS ====================

  /**
   * Show native browser notification
   */
  showNativeNotification(notification) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    const { title, body, icon, tag } = notification;
    
    const nativeNotif = new Notification(title, {
      body: body || '',
      icon: icon || '/icon-192x192.png',
      tag: tag || notification.id,
      requireInteraction: notification.priority === 'high' || notification.priority === 'critical',
      silent: notification.sound === false
    });

    nativeNotif.onclick = () => {
      window.focus();
      nativeNotif.close();
      this.emit('nativeClick', { notification });
    };

    nativeNotif.onclose = () => {
      this.emit('nativeClose', { notification });
    };
  }

  /**
   * Set native notifications enabled
   */
  setNativeEnabled(enabled) {
    this.showNativeNotifications = enabled;
    
    if (enabled && this.permission !== 'granted') {
      this.requestPermission();
    }
  }

  // ==================== EVENT HANDLING ====================

  /**
   * Subscribe to events
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    
    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from events
   */
  off(event, callback) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  /**
   * Emit event
   */
  emit(event, data) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      });
    }
  }

  // ==================== ACTION HANDLING ====================

  /**
   * Handle notification action
   */
  async handleAction(notificationId, actionId) {
    try {
      const response = await fetch(`${API_BASE}/notifications/${notificationId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      this.emit('actionHandled', { notificationId, actionId, result });
      return result;
    } catch (error) {
      console.error('Error handling action:', error);
      this.emit('actionError', { notificationId, actionId, error });
      throw error;
    }
  }

  /**
   * Register custom action handler
   */
  registerActionHandler(actionId, handler) {
    this.on('action', (data) => {
      if (data.actionId === actionId) {
        handler(data);
      }
    });
  }

  // ==================== API METHODS ====================

  /**
   * Send custom notification via API
   */
  async sendNotification(notification) {
    const response = await fetch(`${API_BASE}/notifications/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notification)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get notification history
   */
  async getHistory(options = {}) {
    const params = new URLSearchParams();
    if (options.type) params.append('type', options.type);
    if (options.limit) params.append('limit', options.limit);

    const response = await fetch(`${API_BASE}/notifications/history?${params}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.history;
  }

  /**
   * Get notification stats
   */
  async getStats() {
    const response = await fetch(`${API_BASE}/notifications/stats`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get notification settings
   */
  async getSettings() {
    const response = await fetch(`${API_BASE}/notifications/settings`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  }

  /**
   * Update notification settings
   */
  async updateSettings(settings) {
    const response = await fetch(`${API_BASE}/notifications/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  }

  /**
   * Check Do Not Disturb status
   */
  async checkDnd() {
    const response = await fetch(`${API_BASE}/notifications/dnd-status`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.doNotDisturb;
  }

  // ==================== TEMPLATE METHODS ====================

  /**
   * Send stuck notification
   */
  async sendStuck(context) {
    const response = await fetch(`${API_BASE}/notifications/stuck`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(context)
    });

    return response.json();
  }

  /**
   * Send wellness notification
   */
  async sendWellness(type, duration) {
    const response = await fetch(`${API_BASE}/notifications/wellness`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, duration })
    });

    return response.json();
  }

  /**
   * Send celebration
   */
  async sendCelebration(text) {
    const response = await fetch(`${API_BASE}/notifications/celebration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });

    return response.json();
  }

  // ==================== CLEANUP ====================

  /**
   * Destroy the client
   */
  destroy() {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.listeners.clear();
    console.log('📬 Notification Client destroyed');
  }
}

// Create singleton instance
const notificationClient = new NotificationClient();

export default notificationClient;
export { NotificationClient };
