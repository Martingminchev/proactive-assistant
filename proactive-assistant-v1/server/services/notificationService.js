/**
 * Notification Service
 * Sends rich native OS notifications with action buttons
 * Supports Windows, macOS, and Linux
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const os = require('os');

const execAsync = promisify(exec);

// Notification templates
const TEMPLATES = {
  stuck: {
    title: 'Stuck on {topic}?',
    body: 'You\'ve been debugging for {duration}. I have a solution.',
    priority: 'high',
    actions: [
      { id: 'show_fix', label: 'Show Fix', type: 'primary' },
      { id: 'im_fine', label: 'I\'m Fine', type: 'dismiss' },
      { id: 'snooze', label: 'Snooze', type: 'snooze', duration: 30 }
    ],
    sound: true,
    timeout: 30
  },
  contextRecovery: {
    title: 'Continue where you left off?',
    body: 'You were working on {file}. {todos} remaining.',
    priority: 'normal',
    actions: [
      { id: 'open_file', label: 'Open File', type: 'primary' },
      { id: 'dismiss', label: 'Dismiss', type: 'dismiss' }
    ],
    sound: false,
    timeout: 20
  },
  wellness: {
    title: 'Time for a break?',
    body: 'You\'ve been coding for {duration}.',
    priority: 'normal',
    actions: [
      { id: 'take_break', label: '5 Min Break', type: 'primary' },
      { id: 'snooze_30', label: 'Snooze 30min', type: 'snooze', duration: 30 },
      { id: 'not_now', label: 'Not Now', type: 'dismiss' }
    ],
    sound: false,
    timeout: 15
  },
  celebration: {
    title: '🔥 You\'re on fire!',
    body: '{achievement} Keep it up!',
    priority: 'low',
    actions: [
      { id: 'view_stats', label: 'View Stats', type: 'primary' },
      { id: 'dismiss', label: 'Dismiss', type: 'dismiss' }
    ],
    sound: true,
    timeout: 10
  },
  suggestion: {
    title: '{title}',
    body: '{description}',
    priority: 'normal',
    actions: [
      { id: 'apply', label: 'Apply', type: 'primary' },
      { id: 'learn_more', label: 'Learn More', type: 'link' },
      { id: 'dismiss', label: 'Dismiss', type: 'dismiss' }
    ],
    sound: false,
    timeout: 20
  },
  focus: {
    title: '🎯 Focus session complete!',
    body: 'You focused for {duration}. Great work!',
    priority: 'low',
    actions: [
      { id: 'start_break', label: 'Take a Break', type: 'primary' },
      { id: 'continue', label: 'Keep Going', type: 'dismiss' }
    ],
    sound: true,
    timeout: 10
  }
};

class NotificationService {
  constructor() {
    this.platform = os.platform();
    this.notificationHistory = [];
    this.maxHistorySize = 100;
    this.wsClients = new Set();
    this.actionHandlers = new Map();
    this.doNotDisturb = false;
    this.lastNotificationTime = 0;
    this.minInterval = 5000; // Minimum 5 seconds between notifications
    
    // Default settings
    this.settings = {
      enabled: true,
      soundEnabled: true,
      respectDoNotDisturb: true,
      minPriority: 'low',
      maxPerHour: 10,
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00'
      }
    };

    this.init();
  }

  async init() {
    console.log('📬 Notification Service initialized');
    console.log(`   Platform: ${this.platform}`);
    
    // Check for Do Not Disturb on startup
    if (this.settings.respectDoNotDisturb) {
      this.doNotDisturb = await this.checkDoNotDisturb();
    }

    // Load settings from file if exists
    this.loadSettings();
    
    // Register default action handlers
    this.registerDefaultHandlers();
  }

  /**
   * Register default action handlers
   */
  registerDefaultHandlers() {
    this.registerHandler('show_fix', async (notification, action) => {
      console.log('🔧 Showing fix for:', notification.data?.topic);
      return { type: 'show_fix', data: notification.data };
    });

    this.registerHandler('open_file', async (notification, action) => {
      console.log('📄 Opening file:', notification.data?.file);
      return { type: 'open_file', data: notification.data };
    });

    this.registerHandler('apply', async (notification, action) => {
      console.log('✅ Applying suggestion:', notification.data?.suggestionId);
      return { type: 'apply_suggestion', data: notification.data };
    });

    this.registerHandler('take_break', async (notification, action) => {
      console.log('☕ Starting break timer');
      return { type: 'start_break', duration: 5 * 60 * 1000 }; // 5 minutes
    });

    this.registerHandler('view_stats', async (notification, action) => {
      console.log('📊 Opening stats view');
      return { type: 'view_stats', data: notification.data };
    });

    this.registerHandler('dismiss', async (notification, action) => {
      console.log('❌ Dismissing notification:', notification.id);
      return { type: 'dismissed' };
    });

    this.registerHandler('snooze', async (notification, action) => {
      const duration = action.duration || 30;
      console.log(`⏰ Snoozing for ${duration} minutes`);
      return { type: 'snoozed', duration: duration * 60 * 1000 };
    });

    this.registerHandler('im_fine', async (notification, action) => {
      console.log('👍 User is fine, marking as resolved');
      return { type: 'resolved', data: notification.data };
    });

    this.registerHandler('start_break', async (notification, action) => {
      console.log('☕ Starting break after focus session');
      return { type: 'start_break', duration: 5 * 60 * 1000 };
    });

    this.registerHandler('continue', async (notification, action) => {
      console.log('🚀 Continuing focus session');
      return { type: 'continue_focus' };
    });
  }

  /**
   * Register a custom action handler
   */
  registerHandler(actionId, handler) {
    this.actionHandlers.set(actionId, handler);
  }

  /**
   * Check if Do Not Disturb is enabled
   */
  async checkDoNotDisturb() {
    try {
      switch (this.platform) {
        case 'darwin': // macOS
          try {
            const { stdout } = await execAsync('defaults -currentHost read ~/Library/Preferences/ByHost/com.apple.notificationcenterui doNotDisturb');
            return stdout.trim() === '1';
          } catch {
            return false;
          }
        
        case 'win32': // Windows
          try {
            // Check Windows Focus Assist (Windows 10/11)
            const { stdout } = await execAsync('powershell -Command "Get-ItemProperty -Path HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings -Name NOC_GLOBAL_SETTING_TOASTS_ENABLED -ErrorAction SilentlyContinue | Select-Object -ExpandProperty NOC_GLOBAL_SETTING_TOASTS_ENABLED"');
            return stdout.trim() === '0';
          } catch {
            return false;
          }
        
        case 'linux':
          try {
            // Check GNOME notification settings
            const { stdout } = await execAsync('gsettings get org.gnome.desktop.notifications show-banners');
            return stdout.trim() === 'false';
          } catch {
            return false;
          }
        
        default:
          return false;
      }
    } catch (error) {
      console.warn('Could not check Do Not Disturb status:', error.message);
      return false;
    }
  }

  /**
   * Check if currently in quiet hours
   */
  isQuietHours() {
    if (!this.settings.quietHours.enabled) return false;
    
    const now = new Date();
    const current = now.getHours() * 60 + now.getMinutes();
    
    const [startH, startM] = this.settings.quietHours.start.split(':').map(Number);
    const [endH, endM] = this.settings.quietHours.end.split(':').map(Number);
    
    const start = startH * 60 + startM;
    const end = endH * 60 + endM;
    
    if (start < end) {
      return current >= start && current < end;
    } else {
      // Spanning midnight
      return current >= start || current < end;
    }
  }

  /**
   * Check if notification should be throttled
   */
  shouldThrottle() {
    const now = Date.now();
    if (now - this.lastNotificationTime < this.minInterval) {
      return true;
    }
    
    // Check hourly limit
    const hourAgo = now - 60 * 60 * 1000;
    const recentCount = this.notificationHistory.filter(
      n => n.timestamp > hourAgo && !n.suppressed
    ).length;
    
    return recentCount >= this.settings.maxPerHour;
  }

  /**
   * Get priority level as number
   */
  getPriorityLevel(priority) {
    const levels = { low: 1, normal: 2, high: 3, critical: 4 };
    return levels[priority] || 1;
  }

  /**
   * Check if priority meets minimum threshold
   */
  meetsPriorityThreshold(priority) {
    return this.getPriorityLevel(priority) >= this.getPriorityLevel(this.settings.minPriority);
  }

  /**
   * Send a notification
   */
  async send(notification) {
    // Validate notification
    if (!notification.type || !notification.title) {
      throw new Error('Notification must have type and title');
    }

    // Generate unique ID
    const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Build complete notification
    const fullNotification = {
      id,
      timestamp: Date.now(),
      ...notification,
      actions: notification.actions || this.getDefaultActions(notification.type)
    };

    // Check if should send
    if (!this.settings.enabled) {
      console.log('📬 Notifications disabled, skipping');
      fullNotification.suppressed = true;
      fullNotification.suppressionReason = 'disabled';
      this.addToHistory(fullNotification);
      return { sent: false, id, reason: 'disabled' };
    }

    // Check Do Not Disturb
    if (this.settings.respectDoNotDisturb) {
      this.doNotDisturb = await this.checkDoNotDisturb();
      if (this.doNotDisturb) {
        console.log('📬 Do Not Disturb is on, queuing notification');
        fullNotification.suppressed = true;
        fullNotification.suppressionReason = 'dnd';
        this.addToHistory(fullNotification);
        return { sent: false, id, reason: 'do_not_disturb' };
      }
    }

    // Check quiet hours
    if (this.isQuietHours()) {
      console.log('📬 Quiet hours active, queuing notification');
      fullNotification.suppressed = true;
      fullNotification.suppressionReason = 'quiet_hours';
      this.addToHistory(fullNotification);
      return { sent: false, id, reason: 'quiet_hours' };
    }

    // Check priority threshold
    if (!this.meetsPriorityThreshold(notification.priority || 'normal')) {
      console.log('📬 Priority too low, skipping');
      fullNotification.suppressed = true;
      fullNotification.suppressionReason = 'priority';
      this.addToHistory(fullNotification);
      return { sent: false, id, reason: 'priority_too_low' };
    }

    // Check throttling
    if (this.shouldThrottle()) {
      console.log('📬 Too many notifications, throttling');
      fullNotification.suppressed = true;
      fullNotification.suppressionReason = 'throttled';
      this.addToHistory(fullNotification);
      return { sent: false, id, reason: 'throttled' };
    }

    // Send the notification
    try {
      const result = await this.sendNative(fullNotification);
      this.lastNotificationTime = Date.now();
      this.addToHistory(fullNotification);
      
      // Broadcast to WebSocket clients
      this.broadcastToClients(fullNotification);
      
      console.log(`📬 Notification sent: ${notification.title}`);
      return { sent: true, id, result };
    } catch (error) {
      console.error('❌ Failed to send notification:', error.message);
      fullNotification.error = error.message;
      this.addToHistory(fullNotification);
      return { sent: false, id, error: error.message };
    }
  }

  /**
   * Send native OS notification
   */
  async sendNative(notification) {
    const { title, body, priority, actions, timeout } = notification;
    
    switch (this.platform) {
      case 'darwin':
        return this.sendMacOS(notification);
      
      case 'win32':
        return this.sendWindows(notification);
      
      case 'linux':
        return this.sendLinux(notification);
      
      default:
        // Fallback to console
        console.log('📬 Notification:', { title, body, actions });
        return { platform: 'console' };
    }
  }

  /**
   * Send macOS notification using osascript
   */
  async sendMacOS(notification) {
    const { title, body, sound } = notification;
    
    // Build AppleScript for notification
    const soundParam = sound && this.settings.soundEnabled ? 'sound name "Glass"' : '';
    const script = `
      display notification "${this.escapeAppleScript(body || '')}" with title "${this.escapeAppleScript(title)}" ${soundParam}
    `;
    
    try {
      await execAsync(`osascript -e '${script}'`);
      return { platform: 'macos', method: 'osascript' };
    } catch (error) {
      console.warn('osascript failed, trying notify-send fallback');
      return this.sendLinux(notification); // Fallback
    }
  }

  /**
   * Send Windows notification using PowerShell
   */
  async sendWindows(notification) {
    const { title, body, priority } = notification;
    
    // Use PowerShell to show Windows notification
    const psScript = `
      Add-Type -AssemblyName System.Windows.Forms
      $notification = New-Object System.Windows.Forms.NotifyIcon
      $notification.Icon = [System.Drawing.SystemIcons]::Information
      $notification.BalloonTipTitle = "${this.escapePowerShell(title)}"
      $notification.BalloonTipText = "${this.escapePowerShell(body || '')}"
      $notification.Visible = $True
      $notification.ShowBalloonTip(5000)
      Start-Sleep -Seconds 6
      $notification.Dispose()
    `;
    
    try {
      await execAsync(`powershell -Command "${psScript}"`);
      return { platform: 'windows', method: 'powershell' };
    } catch (error) {
      console.warn('PowerShell notification failed:', error.message);
      return { platform: 'windows', method: 'fallback', error: error.message };
    }
  }

  /**
   * Send Linux notification using notify-send
   */
  async sendLinux(notification) {
    const { title, body, priority, timeout } = notification;
    
    // Build urgency level
    const urgency = { low: 'low', normal: 'normal', high: 'critical', critical: 'critical' }[priority] || 'normal';
    const expireTime = (timeout || 10) * 1000;
    
    // Build notify-send command
    const args = [
      `--urgency=${urgency}`,
      `--expire-time=${expireTime}`,
      `--app-name="Proactive Assistant"`,
      `"${this.escapeShell(title)}"`,
      `"${this.escapeShell(body || '')}"`
    ];
    
    try {
      await execAsync(`notify-send ${args.join(' ')}`);
      return { platform: 'linux', method: 'notify-send' };
    } catch (error) {
      console.warn('notify-send failed:', error.message);
      return { platform: 'linux', method: 'fallback', error: error.message };
    }
  }

  /**
   * Escape strings for shell commands
   */
  escapeShell(str) {
    return str.replace(/"/g, '\\"').replace(/`/g, '\\`');
  }

  escapeAppleScript(str) {
    return str.replace(/"/g, '\\"').replace(/'/g, "\\'");
  }

  escapePowerShell(str) {
    return str.replace(/"/g, '`"').replace(/\$/g, '`$');
  }

  /**
   * Get default actions for notification type
   */
  getDefaultActions(type) {
    const template = TEMPLATES[type];
    return template ? template.actions : [{ id: 'dismiss', label: 'Dismiss', type: 'dismiss' }];
  }

  /**
   * Add notification to history
   */
  addToHistory(notification) {
    this.notificationHistory.push(notification);
    
    // Trim history if too large
    if (this.notificationHistory.length > this.maxHistorySize) {
      this.notificationHistory = this.notificationHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Handle notification action
   */
  async handleAction(notificationId, actionId) {
    const notification = this.notificationHistory.find(n => n.id === notificationId);
    
    if (!notification) {
      throw new Error(`Notification ${notificationId} not found`);
    }

    const action = notification.actions.find(a => a.id === actionId);
    
    if (!action) {
      throw new Error(`Action ${actionId} not found in notification`);
    }

    const handler = this.actionHandlers.get(actionId);
    
    if (!handler) {
      console.warn(`No handler registered for action: ${actionId}`);
      return { handled: false, actionId, notificationId };
    }

    try {
      const result = await handler(notification, action);
      
      // Mark notification as actioned
      notification.actioned = true;
      notification.actionedAt = Date.now();
      notification.actionResult = result;
      
      console.log(`✅ Action handled: ${actionId}`);
      return { handled: true, actionId, notificationId, result };
    } catch (error) {
      console.error(`❌ Action handler failed: ${actionId}`, error.message);
      return { handled: false, actionId, notificationId, error: error.message };
    }
  }

  // ==================== TEMPLATE METHODS ====================

  /**
   * Fill template with data
   */
  fillTemplate(templateKey, data) {
    const template = TEMPLATES[templateKey];
    if (!template) {
      throw new Error(`Unknown template: ${templateKey}`);
    }

    let title = template.title;
    let body = template.body;

    // Replace placeholders
    Object.entries(data).forEach(([key, value]) => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      title = title.replace(regex, value);
      body = body.replace(regex, value);
    });

    return {
      type: templateKey,
      title,
      body,
      priority: template.priority,
      actions: template.actions,
      sound: template.sound,
      timeout: template.timeout,
      data
    };
  }

  /**
   * Send stuck notification
   */
  async sendStuckNotification(context) {
    const data = {
      topic: context.topic || 'this error',
      duration: context.duration || '25 minutes',
      error: context.error || null,
      file: context.file || null
    };

    const notification = this.fillTemplate('stuck', data);
    return this.send(notification);
  }

  /**
   * Send context recovery notification
   */
  async sendContextRecovery(context) {
    const data = {
      file: context.file || 'your project',
      todos: context.todos || '2 TODOs'
    };

    const notification = this.fillTemplate('contextRecovery', data);
    return this.send(notification);
  }

  /**
   * Send wellness notification
   */
  async sendWellnessNotification(type, context = {}) {
    const templates = {
      break: { duration: context.duration || '2 hours', title: 'Time for a break?' },
      eyeStrain: { duration: 'a while', title: 'Rest your eyes?' },
      posture: { duration: 'too long', title: 'Check your posture?' },
      hydration: { duration: '', title: 'Stay hydrated!' }
    };

    const template = templates[type] || templates.break;
    const data = {
      duration: template.duration,
      type
    };

    const notification = this.fillTemplate('wellness', data);
    notification.title = template.title;
    return this.send(notification);
  }

  /**
   * Send celebration notification
   */
  async sendCelebration(achievement) {
    const data = {
      achievement: achievement.text || 'Great progress today!'
    };

    const notification = this.fillTemplate('celebration', data);
    return this.send(notification);
  }

  /**
   * Send suggestion notification
   */
  async sendSuggestionNotification(suggestion) {
    const notification = this.fillTemplate('suggestion', {
      title: suggestion.title,
      description: suggestion.description
    });
    
    // Add suggestion data
    notification.data = { suggestionId: suggestion.id, ...suggestion };
    
    return this.send(notification);
  }

  /**
   * Send focus session complete notification
   */
  async sendFocusComplete(duration) {
    const data = {
      duration: typeof duration === 'number' 
        ? `${Math.floor(duration / 60)} minutes` 
        : duration
    };

    const notification = this.fillTemplate('focus', data);
    return this.send(notification);
  }

  // ==================== WEBSOCKET HANDLING ====================

  /**
   * Add WebSocket client
   */
  addWebSocketClient(ws) {
    this.wsClients.add(ws);
    console.log(`📡 WebSocket client connected. Total: ${this.wsClients.size}`);
    
    ws.on('close', () => {
      this.wsClients.delete(ws);
      console.log(`📡 WebSocket client disconnected. Total: ${this.wsClients.size}`);
    });
  }

  /**
   * Broadcast notification to all WebSocket clients
   */
  broadcastToClients(notification) {
    const message = JSON.stringify({
      type: 'notification',
      data: notification
    });

    this.wsClients.forEach(ws => {
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send(message);
      }
    });
  }

  /**
   * Broadcast action to clients
   */
  broadcastAction(notificationId, actionId, result) {
    const message = JSON.stringify({
      type: 'action',
      data: { notificationId, actionId, result }
    });

    this.wsClients.forEach(ws => {
      if (ws.readyState === 1) {
        ws.send(message);
      }
    });
  }

  // ==================== SETTINGS MANAGEMENT ====================

  /**
   * Load settings from file
   */
  loadSettings() {
    try {
      const settingsPath = path.join(__dirname, '..', 'data', 'notification-settings.json');
      if (fs.existsSync(settingsPath)) {
        const data = fs.readFileSync(settingsPath, 'utf8');
        this.settings = { ...this.settings, ...JSON.parse(data) };
        console.log('📬 Loaded notification settings');
      }
    } catch (error) {
      console.warn('Could not load notification settings:', error.message);
    }
  }

  /**
   * Save settings to file
   */
  saveSettings() {
    try {
      const dataDir = path.join(__dirname, '..', 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      const settingsPath = path.join(dataDir, 'notification-settings.json');
      fs.writeFileSync(settingsPath, JSON.stringify(this.settings, null, 2));
      console.log('📬 Saved notification settings');
    } catch (error) {
      console.error('Could not save notification settings:', error.message);
    }
  }

  /**
   * Update settings
   */
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
    console.log('📬 Updated notification settings');
    return this.settings;
  }

  /**
   * Get current settings
   */
  getSettings() {
    return this.settings;
  }

  // ==================== HISTORY & STATS ====================

  /**
   * Get notification history
   */
  getHistory(options = {}) {
    let history = [...this.notificationHistory];
    
    if (options.type) {
      history = history.filter(n => n.type === options.type);
    }
    
    if (options.limit) {
      history = history.slice(-options.limit);
    }
    
    return history;
  }

  /**
   * Get notification statistics
   */
  getStats() {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    const dayAgo = now - 24 * 60 * 60 * 1000;
    
    const stats = {
      total: this.notificationHistory.length,
      sent: this.notificationHistory.filter(n => !n.suppressed).length,
      suppressed: this.notificationHistory.filter(n => n.suppressed).length,
      actioned: this.notificationHistory.filter(n => n.actioned).length,
      lastHour: this.notificationHistory.filter(n => n.timestamp > hourAgo && !n.suppressed).length,
      lastDay: this.notificationHistory.filter(n => n.timestamp > dayAgo && !n.suppressed).length,
      byType: {}
    };
    
    // Count by type
    this.notificationHistory.forEach(n => {
      if (!n.suppressed) {
        stats.byType[n.type] = (stats.byType[n.type] || 0) + 1;
      }
    });
    
    return stats;
  }

  /**
   * Clear history
   */
  clearHistory() {
    this.notificationHistory = [];
    console.log('📬 Notification history cleared');
  }
}

// Create singleton instance
const notificationService = new NotificationService();

module.exports = notificationService;
