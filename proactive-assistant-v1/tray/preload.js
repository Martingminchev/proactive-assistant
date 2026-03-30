/**
 * Proactive AI Assistant - Preload Script
 * 
 * Securely exposes Electron APIs to the renderer process
 * using context bridge. All IPC communication goes through here.
 */

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Window API - Control the main application window
 */
const windowAPI = {
  /**
   * Minimize/hide the window
   * @returns {Promise<void>}
   */
  minimize: () => ipcRenderer.invoke('window:minimize'),

  /**
   * Close/hide the window
   * @returns {Promise<void>}
   */
  close: () => ipcRenderer.invoke('window:close'),

  /**
   * Show the window
   * @returns {Promise<void>}
   */
  show: () => ipcRenderer.invoke('window:show'),

  /**
   * Listen for window events
   * @param {string} event - Event name ('show', 'hide', 'blur', 'focus')
   * @param {Function} callback - Event handler
   */
  on: (event, callback) => {
    const validEvents = ['show', 'hide', 'blur', 'focus'];
    if (validEvents.includes(event)) {
      ipcRenderer.on(`window:${event}`, callback);
    }
  },

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} callback - Event handler to remove
   */
  removeListener: (event, callback) => {
    ipcRenderer.removeListener(`window:${event}`, callback);
  },
};

/**
 * Tray API - Control the system tray icon
 */
const trayAPI = {
  /**
   * Set tray icon state
   * @param {string} state - 'watching' | 'suggestion' | 'urgent' | 'focus'
   * @returns {Promise<void>}
   */
  setState: (state) => ipcRenderer.invoke('tray:setState', state),

  /**
   * Set badge count on tray icon
   * @param {number} count - Number to display (0 to hide)
   * @returns {Promise<void>}
   */
  setBadge: (count) => ipcRenderer.invoke('tray:setBadge', count),

  /**
   * Start pulsing animation on tray icon
   * @param {boolean} shouldAnimate - Whether to animate
   * @returns {Promise<void>}
   */
  animate: (shouldAnimate) => ipcRenderer.invoke('tray:animate', shouldAnimate),

  /**
   * Show native notification from tray
   * @param {string} title - Notification title
   * @param {string} body - Notification body
   */
  notify: (title, body) => {
    ipcRenderer.send('tray:notify', { title, body });
  },
};

/**
 * Suggestion API - Handle AI suggestions
 */
const suggestionAPI = {
  /**
   * Accept a suggestion
   * @param {string} suggestionId - Unique identifier for the suggestion
   * @returns {Promise<void>}
   */
  accept: (suggestionId) => ipcRenderer.invoke('suggestion:accept', suggestionId),

  /**
   * Dismiss a suggestion
   * @param {string} suggestionId - Unique identifier for the suggestion
   * @returns {Promise<void>}
   */
  dismiss: (suggestionId) => ipcRenderer.invoke('suggestion:dismiss', suggestionId),
};

/**
 * Focus API - Manage focus mode
 */
const focusAPI = {
  /**
   * Toggle focus mode
   * @returns {Promise<boolean>} - New focus mode state
   */
  toggle: () => ipcRenderer.invoke('focus:toggle'),

  /**
   * Get current focus mode state
   * @returns {Promise<boolean>}
   */
  getState: () => ipcRenderer.invoke('focus:getState'),

  /**
   * Listen for focus mode changes
   * @param {Function} callback - Handler receiving { isFocusMode: boolean }
   */
  onChange: (callback) => {
    ipcRenderer.on('focus-mode-changed', (event, data) => callback(data));
  },

  /**
   * Remove focus mode change listener
   * @param {Function} callback - Handler to remove
   */
  removeListener: (callback) => {
    ipcRenderer.removeListener('focus-mode-changed', callback);
  },
};

/**
 * Shell API - System integration
 */
const shellAPI = {
  /**
   * Open URL in external browser
   * @param {string} url - URL to open
   * @returns {Promise<void>}
   */
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
};

/**
 * App API - Application information
 */
const appAPI = {
  /**
   * Get app version
   * @returns {Promise<string>}
   */
  getVersion: () => ipcRenderer.invoke('app:getVersion'),

  /**
   * Get platform name
   * @returns {Promise<string>} - 'win32' | 'darwin' | 'linux'
   */
  getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
};

/**
 * Platform utilities
 */
const platformAPI = {
  /**
   * Check if running on macOS
   * @returns {boolean}
   */
  isMac: process.platform === 'darwin',

  /**
   * Check if running on Windows
   * @returns {boolean}
   */
  isWindows: process.platform === 'win32',

  /**
   * Check if running on Linux
   * @returns {boolean}
   */
  isLinux: process.platform === 'linux',
};

// Expose APIs to renderer via context bridge
contextBridge.exposeInMainWorld('electronAPI', {
  window: windowAPI,
  tray: trayAPI,
  suggestion: suggestionAPI,
  focus: focusAPI,
  shell: shellAPI,
  app: appAPI,
  platform: platformAPI,
});

/**
 * For development debugging - log exposed APIs
 */
if (process.env.NODE_ENV === 'development') {
  console.log('[Preload] Electron APIs exposed:', Object.keys(window.electronAPI || {}));
}
