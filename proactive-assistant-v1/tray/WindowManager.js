/**
 * Proactive AI Assistant - Window Manager
 * 
 * Manages the main application window: positioning, show/hide animations,
 * blur detection, and size constraints for the tray-based popup window.
 */

const { BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const EventEmitter = require('events');

/**
 * Window states
 */
const WINDOW_STATES = {
  HIDDEN: 'hidden',
  SHOWING: 'showing',
  VISIBLE: 'visible',
  HIDING: 'hiding',
};

/**
 * Animation types
 */
const ANIMATION_TYPES = {
  NONE: 'none',
  FADE: 'fade',
  SLIDE: 'slide',
  SCALE: 'scale',
};

class WindowManager extends EventEmitter {
  /**
   * Create a new WindowManager instance
   * @param {Object} options - Configuration options
   * @param {number} options.width - Window width (default: 320)
   * @param {number} options.minHeight - Minimum window height (default: 400)
   * @param {number} options.maxHeight - Maximum window height (default: 600)
   * @param {boolean} options.isDev - Development mode flag
   * @param {Function} options.getTrayBounds - Function to get tray icon bounds
   * @param {string} options.animation - Animation type ('fade', 'slide', 'scale', 'none')
   * @param {number} options.animationDuration - Animation duration in ms (default: 150)
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      width: options.width || 320,
      minHeight: options.minHeight || 400,
      maxHeight: options.maxHeight || 600,
      isDev: options.isDev || false,
      getTrayBounds: options.getTrayBounds || (() => null),
      animation: options.animation || ANIMATION_TYPES.FADE,
      animationDuration: options.animationDuration || 150,
    };
    
    this.window = null;
    this.state = WINDOW_STATES.HIDDEN;
    this.isFocusMode = false;
    this.hideOnBlur = true; // Auto-hide when clicking outside
    this.trayBounds = null;
    
    // Initialize the window
    this.initialize();
  }

  /**
   * Initialize the browser window
   */
  initialize() {
    // Create the browser window
    this.window = new BrowserWindow({
      width: this.options.width,
      height: this.options.minHeight,
      minWidth: this.options.width,
      minHeight: this.options.minHeight,
      maxWidth: this.options.width,
      maxHeight: this.options.maxHeight,
      
      // Window styling for tray popup
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      closable: true,
      fullscreenable: false,
      skipTaskbar: true, // Don't show in taskbar/dock
      
      // Visual properties
      transparent: true,
      backgroundColor: '#00000000',
      opacity: 0, // Start invisible for animation
      
      // Always on top, but not above fullscreen apps
      alwaysOnTop: true,
      visibleOnAllWorkspaces: true,
      
      // Security
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        enableRemoteModule: false,
        sandbox: true,
        allowRunningInsecureContent: false,
        experimentalFeatures: false,
      },
      
      // Show only when ready
      show: false,
    });

    // Load content
    this.loadContent();
    
    // Setup event handlers
    this.setupEventHandlers();
    
    console.log('[WindowManager] Window initialized');
  }

  /**
   * Load the appropriate content (dev server or built files)
   */
  loadContent() {
    if (this.options.isDev) {
      // Load from Vite dev server
      this.window.loadURL('http://localhost:5173');
      
      // Open DevTools in development
      this.window.webContents.openDevTools({ mode: 'detach' });
    } else {
      // Load built files
      const indexPath = path.join(__dirname, '..', 'client', 'dist', 'index.html');
      this.window.loadFile(indexPath);
    }
  }

  /**
   * Setup window event handlers
   */
  setupEventHandlers() {
    // Window ready to show
    this.window.once('ready-to-show', () => {
      console.log('[WindowManager] Window ready to show');
    });

    // Blur event - hide window when clicking outside
    this.window.on('blur', () => {
      this.emit('blur');
      
      if (this.hideOnBlur && !this.isFocusMode) {
        // Small delay to allow click events to process
        setTimeout(() => {
          if (this.window && !this.window.isDestroyed() && !this.window.isFocused()) {
            this.hide();
          }
        }, 100);
      }
    });

    // Focus event
    this.window.on('focus', () => {
      this.emit('focus');
    });

    // Close event - prevent default close, just hide
    this.window.on('close', (event) => {
      if (!this.isQuitting) {
        event.preventDefault();
        this.hide();
      }
    });

    // Handle window showing/hiding for animation
    this.window.on('show', () => {
      this.state = WINDOW_STATES.VISIBLE;
      this.emit('show');
    });

    this.window.on('hide', () => {
      this.state = WINDOW_STATES.HIDDEN;
      this.emit('hide');
    });

    // Handle navigation for security
    this.window.webContents.on('will-navigate', (event, url) => {
      // Only allow navigation to allowed URLs
      const allowedHosts = ['localhost', '127.0.0.1'];
      const parsedUrl = new URL(url);
      
      if (!allowedHosts.includes(parsedUrl.hostname)) {
        event.preventDefault();
        console.warn('[WindowManager] Blocked navigation to:', url);
      }
    });

    // Handle new window requests
    this.window.webContents.setWindowOpenHandler(({ url }) => {
      // Open external links in system browser
      const { shell } = require('electron');
      shell.openExternal(url);
      return { action: 'deny' };
    });
  }

  /**
   * Position window relative to tray icon
   * @param {Object} trayBounds - Tray icon bounds {x, y, width, height}
   */
  positionWindow(trayBounds) {
    if (!trayBounds) {
      trayBounds = this.options.getTrayBounds();
    }
    
    if (!trayBounds) {
      console.warn('[WindowManager] No tray bounds available');
      return;
    }
    
    this.trayBounds = trayBounds;
    
    // Get display where tray is located
    const display = screen.getDisplayNearestPoint({
      x: trayBounds.x,
      y: trayBounds.y,
    });
    
    const displayBounds = display.workArea;
    const windowBounds = this.window.getBounds();
    
    // Calculate position
    let x, y;
    
    if (process.platform === 'darwin') {
      // macOS: Position below tray icon
      x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2);
      y = Math.round(trayBounds.y + trayBounds.height + 4); // 4px gap
      
      // Check if window would go off screen bottom
      if (y + windowBounds.height > displayBounds.y + displayBounds.height) {
        // Position above tray instead
        y = Math.round(trayBounds.y - windowBounds.height - 4);
      }
    } else if (process.platform === 'win32') {
      // Windows: Position above taskbar (tray is usually at bottom)
      x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2);
      y = Math.round(displayBounds.y + displayBounds.height - windowBounds.height - 8);
      
      // If tray is at top (unusual), position below
      if (trayBounds.y < displayBounds.y + 100) {
        y = Math.round(trayBounds.y + trayBounds.height + 8);
      }
    } else {
      // Linux: Try to position near tray
      x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2);
      y = Math.round(trayBounds.y + trayBounds.height + 4);
      
      // Adjust if off screen
      if (y + windowBounds.height > displayBounds.y + displayBounds.height) {
        y = Math.round(trayBounds.y - windowBounds.height - 4);
      }
    }
    
    // Ensure window stays within display bounds horizontally
    const minX = displayBounds.x + 8;
    const maxX = displayBounds.x + displayBounds.width - windowBounds.width - 8;
    x = Math.max(minX, Math.min(x, maxX));
    
    // Set position
    this.window.setPosition(x, y);
    
    console.log('[WindowManager] Positioned at:', { x, y });
  }

  /**
   * Show the window with animation
   */
  show() {
    if (!this.window || this.window.isDestroyed()) {
      this.initialize();
    }
    
    if (this.state === WINDOW_STATES.VISIBLE || this.state === WINDOW_STATES.SHOWING) {
      return;
    }
    
    this.state = WINDOW_STATES.SHOWING;
    
    // Position before showing
    const trayBounds = this.options.getTrayBounds();
    if (trayBounds) {
      this.positionWindow(trayBounds);
    }
    
    // Show window
    this.window.show();
    this.window.focus();
    
    // Animate in
    this.animateShow();
    
    console.log('[WindowManager] Window shown');
  }

  /**
   * Hide the window with animation
   */
  hide() {
    if (!this.window || this.window.isDestroyed()) {
      return;
    }
    
    if (this.state === WINDOW_STATES.HIDDEN || this.state === WINDOW_STATES.HIDING) {
      return;
    }
    
    this.state = WINDOW_STATES.HIDING;
    
    // Animate out then hide
    this.animateHide(() => {
      if (this.window && !this.window.isDestroyed()) {
        this.window.hide();
      }
    });
    
    console.log('[WindowManager] Window hidden');
  }

  /**
   * Toggle window visibility
   */
  toggle() {
    if (this.isVisible()) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Check if window is visible
   * @returns {boolean}
   */
  isVisible() {
    return this.window && !this.window.isDestroyed() && this.window.isVisible();
  }

  /**
   * Animate window showing
   */
  animateShow() {
    const duration = this.options.animationDuration;
    
    switch (this.options.animation) {
      case ANIMATION_TYPES.FADE:
        this.animateOpacity(0, 1, duration);
        break;
        
      case ANIMATION_TYPES.SLIDE:
        this.window.setOpacity(1);
        // Slide animation would require more complex handling
        break;
        
      case ANIMATION_TYPES.SCALE:
        this.window.setOpacity(1);
        // Scale would require CSS transform in renderer
        break;
        
      case ANIMATION_TYPES.NONE:
      default:
        this.window.setOpacity(1);
        break;
    }
  }

  /**
   * Animate window hiding
   * @param {Function} callback - Called when animation completes
   */
  animateHide(callback) {
    const duration = this.options.animationDuration;
    
    switch (this.options.animation) {
      case ANIMATION_TYPES.FADE:
        this.animateOpacity(1, 0, duration, callback);
        break;
        
      case ANIMATION_TYPES.SLIDE:
      case ANIMATION_TYPES.SCALE:
      case ANIMATION_TYPES.NONE:
      default:
        if (callback) callback();
        break;
    }
  }

  /**
   * Animate opacity
   * @param {number} start - Start opacity (0-1)
   * @param {number} end - End opacity (0-1)
   * @param {number} duration - Duration in ms
   * @param {Function} callback - Completion callback
   */
  animateOpacity(start, end, duration, callback) {
    const startTime = Date.now();
    const delta = end - start;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out-cubic)
      const eased = 1 - Math.pow(1 - progress, 3);
      const opacity = start + delta * eased;
      
      if (this.window && !this.window.isDestroyed()) {
        this.window.setOpacity(opacity);
      }
      
      if (progress < 1) {
        setImmediate(animate);
      } else if (callback) {
        callback();
      }
    };
    
    animate();
  }

  /**
   * Set focus mode
   * @param {boolean} enabled - Whether focus mode is enabled
   */
  setFocusMode(enabled) {
    this.isFocusMode = enabled;
    
    if (this.window && !this.window.isDestroyed()) {
      if (enabled) {
        // In focus mode, window stays visible
        this.hideOnBlur = false;
        this.window.setAlwaysOnTop(true, 'screen-saver');
      } else {
        this.hideOnBlur = true;
        this.window.setAlwaysOnTop(true, 'pop-up-menu');
      }
    }
    
    // Notify renderer
    this.sendToRenderer('focus-mode-changed', { isFocusMode: enabled });
    
    console.log('[WindowManager] Focus mode:', enabled);
  }

  /**
   * Send message to renderer process
   * @param {string} channel - IPC channel
   * @param {*} data - Data to send
   */
  sendToRenderer(channel, data) {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(channel, data);
    }
  }

  /**
   * Resize window to content height
   * @param {number} contentHeight - Desired height in pixels
   */
  resizeToContent(contentHeight) {
    if (!this.window || this.window.isDestroyed()) {
      return;
    }
    
    const clampedHeight = Math.max(
      this.options.minHeight,
      Math.min(contentHeight, this.options.maxHeight)
    );
    
    const bounds = this.window.getBounds();
    this.window.setBounds({
      ...bounds,
      height: clampedHeight,
    });
    
    // Reposition if needed
    if (this.trayBounds) {
      this.positionWindow(this.trayBounds);
    }
  }

  /**
   * Set whether to hide on blur
   * @param {boolean} hide - Whether to hide when losing focus
   */
  setHideOnBlur(hide) {
    this.hideOnBlur = hide;
  }

  /**
   * Reload window content
   */
  reload() {
    if (this.window && !this.window.isDestroyed()) {
      this.window.reload();
    }
  }

  /**
   * Destroy the window and cleanup
   */
  destroy() {
    this.isQuitting = true;
    
    if (this.window) {
      this.window.destroy();
      this.window = null;
    }
    
    this.removeAllListeners();
    console.log('[WindowManager] Destroyed');
  }

  /**
   * Get window bounds
   * @returns {Object|null}
   */
  getBounds() {
    if (!this.window || this.window.isDestroyed()) {
      return null;
    }
    return this.window.getBounds();
  }

  /**
   * Get web contents
   * @returns {Object|null}
   */
  getWebContents() {
    if (!this.window || this.window.isDestroyed()) {
      return null;
    }
    return this.window.webContents;
  }
}

// Export constants and class
WindowManager.STATES = WINDOW_STATES;
WindowManager.ANIMATION_TYPES = ANIMATION_TYPES;

module.exports = WindowManager;
