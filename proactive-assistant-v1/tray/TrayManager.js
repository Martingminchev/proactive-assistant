/**
 * Proactive AI Assistant - Tray Manager
 * 
 * Manages the system tray icon, states, animations, context menu,
 * and badge overlays for the application.
 */

const { Tray, Menu, nativeImage, nativeTheme, Notification } = require('electron');
const path = require('path');
const fs = require('fs');

/**
 * Icon states with their corresponding icon files
 */
const ICON_STATES = {
  WATCHING: 'watching',    // Default state - monitoring
  SUGGESTION: 'suggestion', // Has suggestion to show
  URGENT: 'urgent',         // Urgent notification
  FOCUS: 'focus',          // Focus mode active
  OFFLINE: 'offline',      // Connection lost
};

/**
 * Animation states for pulsing effect
 */
const ANIMATION_STATES = {
  IDLE: 'idle',
  PULSING: 'pulsing',
  URGENT: 'urgent',
};

class TrayManager {
  /**
   * Create a new TrayManager instance
   * @param {Object} options - Configuration options
   * @param {string} options.iconPath - Path to default tray icon
   * @param {Function} options.onClick - Click handler
   * @param {Function} options.onRightClick - Right-click handler
   * @param {Function} options.onQuit - Quit handler
   * @param {Function} options.onShowWindow - Show window handler
   * @param {Function} options.onFocusMode - Focus mode toggle handler
   */
  constructor(options = {}) {
    this.options = options;
    this.tray = null;
    this.currentState = ICON_STATES.WATCHING;
    this.animationState = ANIMATION_STATES.IDLE;
    this.badgeCount = 0;
    this.isFocusMode = false;
    this.animationInterval = null;
    this.animationFrame = 0;
    
    // Icon cache for different states
    this.iconCache = new Map();
    
    // Initialize tray
    this.initialize();
  }

  /**
   * Initialize the tray icon
   */
  initialize() {
    // Load initial icon
    const icon = this.loadIcon(this.options.iconPath);
    
    // Create tray instance
    this.tray = new Tray(icon);
    
    // Set tooltip
    this.tray.setToolTip('Proactive Assistant');
    
    // Attach event handlers
    this.tray.on('click', (event, bounds) => {
      if (this.options.onClick) {
        this.options.onClick(event, bounds);
      }
    });
    
    this.tray.on('right-click', (event, bounds) => {
      if (this.options.onRightClick) {
        this.options.onRightClick(event, bounds);
      }
    });
    
    // Handle double-click (optional behavior)
    this.tray.on('double-click', (event, bounds) => {
      if (this.options.onClick) {
        this.options.onClick(event, bounds);
      }
    });
    
    // Listen for system theme changes (macOS)
    if (process.platform === 'darwin') {
      nativeTheme.on('updated', () => {
        this.updateIconForTheme();
      });
    }
    
    console.log('[TrayManager] Tray initialized');
  }

  /**
   * Load and cache an icon
   * @param {string} iconPath - Path to icon file
   * @param {number} size - Desired icon size
   * @returns {nativeImage} - Electron native image
   */
  loadIcon(iconPath, size = null) {
    // Check cache first
    const cacheKey = `${iconPath}_${size}`;
    if (this.iconCache.has(cacheKey)) {
      return this.iconCache.get(cacheKey);
    }
    
    let image;
    
    try {
      if (fs.existsSync(iconPath)) {
        image = nativeImage.createFromPath(iconPath);
      } else {
        // Fallback: create a blank icon
        console.warn(`[TrayManager] Icon not found: ${iconPath}`);
        image = this.createFallbackIcon();
      }
      
      // Resize if needed
      if (size && !image.isEmpty()) {
        image = image.resize({ width: size, height: size });
      }
      
      // Cache the icon
      this.iconCache.set(cacheKey, image);
      
    } catch (error) {
      console.error('[TrayManager] Error loading icon:', error);
      image = this.createFallbackIcon();
    }
    
    return image;
  }

  /**
   * Create a fallback blank icon
   * @returns {nativeImage}
   */
  createFallbackIcon() {
    // Create a 16x16 transparent PNG as fallback
    const size = process.platform === 'darwin' ? 22 : 16;
    // Note: In production, you'd have actual icon files
    // This is a placeholder
    return nativeImage.createEmpty();
  }

  /**
   * Get the icon path for a specific state
   * @param {string} state - Icon state
   * @returns {string} - Path to icon file
   */
  getIconPathForState(state) {
    const iconsDir = path.join(__dirname, 'assets', 'icons');
    const ext = process.platform === 'win32' ? 'ico' : 'png';
    
    switch (state) {
      case ICON_STATES.WATCHING:
        return path.join(iconsDir, `tray.${ext}`);
      case ICON_STATES.SUGGESTION:
        return path.join(iconsDir, `tray-suggestion.${ext}`);
      case ICON_STATES.URGENT:
        return path.join(iconsDir, `tray-urgent.${ext}`);
      case ICON_STATES.FOCUS:
        return path.join(iconsDir, `tray-focus.${ext}`);
      case ICON_STATES.OFFLINE:
        return path.join(iconsDir, `tray-offline.${ext}`);
      default:
        return this.options.iconPath;
    }
  }

  /**
   * Set the tray icon state
   * @param {string} state - One of ICON_STATES values
   */
  setState(state) {
    if (!Object.values(ICON_STATES).includes(state)) {
      console.warn(`[TrayManager] Invalid state: ${state}`);
      return;
    }
    
    this.currentState = state;
    this.updateIcon();
    
    // Update tooltip based on state
    const tooltips = {
      [ICON_STATES.WATCHING]: 'Proactive Assistant - Watching',
      [ICON_STATES.SUGGESTION]: 'Proactive Assistant - New Suggestion',
      [ICON_STATES.URGENT]: 'Proactive Assistant - Urgent',
      [ICON_STATES.FOCUS]: 'Proactive Assistant - Focus Mode',
      [ICON_STATES.OFFLINE]: 'Proactive Assistant - Offline',
    };
    
    this.tray.setToolTip(tooltips[state] || 'Proactive Assistant');
    
    // Auto-animate for suggestion/urgent states
    if (state === ICON_STATES.SUGGESTION || state === ICON_STATES.URGENT) {
      this.startAnimation();
    } else {
      this.stopAnimation();
    }
  }

  /**
   * Update the tray icon based on current state
   */
  updateIcon() {
    const iconPath = this.getIconPathForState(this.currentState);
    const icon = this.loadIcon(iconPath);
    
    // Apply badge overlay if needed
    if (this.badgeCount > 0 && this.currentState !== ICON_STATES.FOCUS) {
      const badgedIcon = this.addBadgeToIcon(icon, this.badgeCount);
      this.tray.setImage(badgedIcon);
    } else {
      this.tray.setImage(icon);
    }
  }

  /**
   * Add a badge overlay to an icon
   * @param {nativeImage} icon - Base icon
   * @param {number} count - Badge count
   * @returns {nativeImage} - Icon with badge
   */
  addBadgeToIcon(icon, count) {
    // For macOS, we can use setTitle for badge
    if (process.platform === 'darwin') {
      this.tray.setTitle(count > 0 ? String(count) : '');
      return icon;
    }
    
    // For other platforms, we'd need to composite the badge
    // This is a simplified version - in production you'd use canvas/image manipulation
    return icon;
  }

  /**
   * Set badge count
   * @param {number} count - Number to display (0 to hide)
   */
  setBadge(count) {
    this.badgeCount = Math.max(0, Math.floor(count));
    this.updateIcon();
    
    // Update app badge (macOS dock / Windows taskbar)
    const { app } = require('electron');
    if (process.platform === 'darwin' || process.platform === 'win32') {
      app.setBadgeCount(this.badgeCount);
    }
  }

  /**
   * Get current badge count
   * @returns {number}
   */
  getBadgeCount() {
    return this.badgeCount;
  }

  /**
   * Start pulsing animation
   */
  startAnimation() {
    if (this.animationInterval) {
      return; // Already animating
    }
    
    this.animationState = ANIMATION_STATES.PULSING;
    this.animationFrame = 0;
    
    // Pulse every 500ms
    this.animationInterval = setInterval(() => {
      this.animationFrame = (this.animationFrame + 1) % 2;
      this.updateAnimationFrame();
    }, 500);
    
    console.log('[TrayManager] Animation started');
  }

  /**
   * Stop pulsing animation
   */
  stopAnimation() {
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
    }
    
    this.animationState = ANIMATION_STATES.IDLE;
    this.animationFrame = 0;
    this.updateIcon();
    
    console.log('[TrayManager] Animation stopped');
  }

  /**
   * Update animation frame
   */
  updateAnimationFrame() {
    // Alternate between states for pulse effect
    if (this.currentState === ICON_STATES.URGENT) {
      // More urgent pulsing
      const iconPath = this.animationFrame === 0 
        ? this.getIconPathForState(ICON_STATES.URGENT)
        : this.getIconPathForState(ICON_STATES.WATCHING);
      const icon = this.loadIcon(iconPath);
      this.tray.setImage(icon);
    } else if (this.currentState === ICON_STATES.SUGGESTION) {
      // Subtle pulse for suggestions
      const iconPath = this.getIconPathForState(ICON_STATES.SUGGESTION);
      const icon = this.loadIcon(iconPath);
      // In production, you'd adjust opacity or color here
      this.tray.setImage(icon);
    }
  }

  /**
   * Update icon for system theme (macOS)
   */
  updateIconForTheme() {
    // macOS template icons automatically adapt to theme
    // For custom icons, reload based on dark/light mode
    this.updateIcon();
  }

  /**
   * Set highlight mode (macOS only)
   * @param {boolean} highlight - Whether to highlight
   */
  setHighlightMode(highlight) {
    if (process.platform === 'darwin' && this.tray) {
      this.tray.setHighlightMode(highlight ? 'always' : 'never');
    }
  }

  /**
   * Show context menu on right-click
   */
  showContextMenu() {
    const template = [
      {
        label: 'Proactive Assistant',
        enabled: false,
      },
      { type: 'separator' },
      {
        label: 'Open',
        click: () => {
          if (this.options.onShowWindow) {
            this.options.onShowWindow();
          }
        },
      },
      {
        label: 'Focus Mode',
        type: 'checkbox',
        checked: this.isFocusMode,
        click: () => {
          if (this.options.onFocusMode) {
            this.options.onFocusMode();
          }
        },
      },
      { type: 'separator' },
      {
        label: `State: ${this.currentState}`,
        enabled: false,
      },
      {
        label: this.badgeCount > 0 ? `Suggestions: ${this.badgeCount}` : 'No new suggestions',
        enabled: false,
      },
      { type: 'separator' },
      {
        label: 'Settings...',
        click: () => {
          // Open settings window
          console.log('[TrayManager] Settings clicked');
        },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          if (this.options.onQuit) {
            this.options.onQuit();
          }
        },
      },
    ];
    
    const contextMenu = Menu.buildFromTemplate(template);
    this.tray.popUpContextMenu(contextMenu);
  }

  /**
   * Toggle focus mode
   * @returns {boolean} - New focus mode state
   */
  toggleFocusMode() {
    this.isFocusMode = !this.isFocusMode;
    
    if (this.isFocusMode) {
      this.setState(ICON_STATES.FOCUS);
      this.stopAnimation();
      this.setBadge(0);
    } else {
      this.setState(ICON_STATES.WATCHING);
    }
    
    console.log('[TrayManager] Focus mode:', this.isFocusMode);
    return this.isFocusMode;
  }

  /**
   * Show a native notification
   * @param {string} title - Notification title
   * @param {string} body - Notification body
   */
  showNotification(title, body) {
    // Show native notification
    if (Notification.isSupported()) {
      const notification = new Notification({
        title,
        body,
        icon: this.options.iconPath,
        silent: false,
      });
      
      notification.on('click', () => {
        if (this.options.onShowWindow) {
          this.options.onShowWindow();
        }
      });
      
      notification.show();
    }
    
    // Update tray state to suggestion
    this.setState(ICON_STATES.SUGGESTION);
    this.setBadge(this.badgeCount + 1);
  }

  /**
   * Get tray bounds for window positioning
   * @returns {Object|null} - Tray bounds {x, y, width, height}
   */
  getBounds() {
    if (!this.tray) return null;
    return this.tray.getBounds();
  }

  /**
   * Destroy tray and cleanup
   */
  destroy() {
    this.stopAnimation();
    
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
    
    this.iconCache.clear();
    console.log('[TrayManager] Destroyed');
  }
}

// Export constants and class
TrayManager.STATES = ICON_STATES;
TrayManager.ANIMATION_STATES = ANIMATION_STATES;

module.exports = TrayManager;
