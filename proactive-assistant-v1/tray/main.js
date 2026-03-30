/**
 * Proactive AI Assistant - Electron Main Process
 * 
 * Handles tray icon, window management, IPC communication,
 * and single instance lock for the system tray application.
 */

const { app, BrowserWindow, ipcMain, nativeImage, dialog, shell } = require('electron');
const path = require('path');
const TrayManager = require('./TrayManager');
const WindowManager = require('./WindowManager');

// Application configuration
const CONFIG = {
  isDev: process.argv.includes('--dev'),
  windowWidth: 320,
  windowMinHeight: 400,
  serverPort: process.env.SERVER_PORT || 3001,
  clientDevUrl: 'http://localhost:5173',
};

// Global references to prevent garbage collection
let trayManager = null;
let windowManager = null;
let isQuitting = false;

/**
 * Request single instance lock
 */
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('Another instance is already running. Quitting...');
  app.quit();
  process.exit(0);
}

/**
 * Handle second instance launch
 */
app.on('second-instance', (event, commandLine, workingDirectory) => {
  console.log('Second instance detected, focusing existing window...');
  if (windowManager) {
    windowManager.show();
  }
});

/**
 * Initialize the application
 */
async function initializeApp() {
  console.log('Initializing Proactive Assistant Tray App...');
  console.log('Mode:', CONFIG.isDev ? 'Development' : 'Production');

  // Create window manager first
  windowManager = new WindowManager({
    width: CONFIG.windowWidth,
    minHeight: CONFIG.windowMinHeight,
    isDev: CONFIG.isDev,
    getTrayBounds: () => trayManager ? trayManager.getBounds() : null,
  });

  // Create tray manager
  trayManager = new TrayManager({
    iconPath: getIconPath(),
    onClick: () => handleTrayClick(),
    onRightClick: () => handleTrayRightClick(),
    onQuit: () => quitApp(),
    onShowWindow: () => windowManager.show(),
    onFocusMode: () => toggleFocusMode(),
  });

  // Initialize IPC handlers
  initializeIpcHandlers();

  // Connect window manager to tray
  windowManager.on('blur', () => {
    // Optional: auto-hide on blur (disabled by default for better UX)
    // windowManager.hide();
  });

  windowManager.on('show', () => {
    trayManager.setHighlightMode(true);
  });

  windowManager.on('hide', () => {
    trayManager.setHighlightMode(false);
  });

  console.log('Application initialized successfully');
}

/**
 * Get the appropriate icon path based on platform
 */
function getIconPath() {
  const iconsDir = path.join(__dirname, 'assets', 'icons');
  
  if (process.platform === 'darwin') {
    return path.join(iconsDir, 'trayTemplate.png');
  } else if (process.platform === 'win32') {
    return path.join(iconsDir, 'tray.ico');
  } else {
    return path.join(iconsDir, 'tray.png');
  }
}

/**
 * Handle tray icon click (toggle window)
 */
function handleTrayClick() {
  if (windowManager.isVisible()) {
    windowManager.hide();
  } else {
    windowManager.show();
    // Update position relative to tray
    const trayBounds = trayManager.getBounds();
    if (trayBounds) {
      windowManager.positionWindow(trayBounds);
    }
  }
}

/**
 * Handle tray right-click (show context menu)
 */
function handleTrayRightClick() {
  trayManager.showContextMenu();
}

/**
 * Toggle focus mode
 */
function toggleFocusMode() {
  const isFocusMode = trayManager.toggleFocusMode();
  windowManager.setFocusMode(isFocusMode);
  
  // Notify renderer process
  windowManager.sendToRenderer('focus-mode-changed', { isFocusMode });
}

/**
 * Quit the application
 */
function quitApp() {
  isQuitting = true;
  
  // Cleanup
  if (trayManager) {
    trayManager.destroy();
    trayManager = null;
  }
  
  if (windowManager) {
    windowManager.destroy();
    windowManager = null;
  }
  
  app.quit();
}

/**
 * Initialize IPC handlers for renderer communication
 */
function initializeIpcHandlers() {
  // Window control
  ipcMain.handle('window:minimize', () => {
    windowManager.hide();
  });

  ipcMain.handle('window:close', () => {
    windowManager.hide();
  });

  ipcMain.handle('window:show', () => {
    windowManager.show();
  });

  // Tray icon management
  ipcMain.handle('tray:setState', (event, state) => {
    trayManager.setState(state);
  });

  ipcMain.handle('tray:setBadge', (event, count) => {
    trayManager.setBadge(count);
  });

  ipcMain.handle('tray:animate', (event, shouldAnimate) => {
    if (shouldAnimate) {
      trayManager.startAnimation();
    } else {
      trayManager.stopAnimation();
    }
  });

  // Suggestions
  ipcMain.handle('suggestion:accept', (event, suggestionId) => {
    console.log('Suggestion accepted:', suggestionId);
    trayManager.setState('watching');
    trayManager.setBadge(0);
  });

  ipcMain.handle('suggestion:dismiss', (event, suggestionId) => {
    console.log('Suggestion dismissed:', suggestionId);
    trayManager.setBadge(Math.max(0, trayManager.getBadgeCount() - 1));
  });

  // Focus mode
  ipcMain.handle('focus:toggle', () => {
    toggleFocusMode();
    return trayManager.isFocusMode;
  });

  ipcMain.handle('focus:getState', () => {
    return trayManager.isFocusMode;
  });

  // External links
  ipcMain.handle('shell:openExternal', (event, url) => {
    shell.openExternal(url);
  });

  // App info
  ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
  });

  ipcMain.handle('app:getPlatform', () => {
    return process.platform;
  });

  // Notifications from renderer
  ipcMain.on('tray:notify', (event, { title, body }) => {
    trayManager.showNotification(title, body);
  });
}

/**
 * App event handlers
 */
app.whenReady().then(initializeApp);

app.on('window-all-closed', (event) => {
  // Prevent default behavior - we want to keep running in tray
  event.preventDefault();
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  // Final cleanup
  if (trayManager) {
    trayManager.destroy();
  }
});

app.on('activate', () => {
  // macOS: re-create window when dock icon is clicked
  if (windowManager && !windowManager.isVisible()) {
    windowManager.show();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});

// Handle Squirrel events on Windows
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Export for testing
module.exports = { initializeApp, CONFIG };
