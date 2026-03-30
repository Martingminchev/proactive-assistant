# Electron System Access Guide

Comprehensive guide for accessing system information in Electron applications.

---

## Table of Contents

1. [Active Window/Application Tracking](#1-active-windowapplication-tracking)
2. [File System Monitoring](#2-file-system-monitoring)
3. [System Resources (CPU, Memory)](#3-system-resources-cpu-memory)
4. [Screenshots and Screen Capture](#4-screenshots-and-screen-capture)
5. [Clipboard History Access](#5-clipboard-history-access)
6. [Native Node.js Modules in Electron](#6-native-nodejs-modules-in-electron)
7. [Security Considerations](#7-security-considerations)

---

## 1. Active Window/Application Tracking

### Recommended Package: `@paymoapp/active-window`

**Why this package:**
- Uses Node-API (N-API) version 6 for better compatibility
- Provides prebuilt binaries (no compilation needed in most cases)
- Supports Windows, macOS, and Linux (X11 only)
- Includes application icons as base64
- Has subscription/watch API for real-time updates

**Installation:**
```bash
npm install @paymoapp/active-window
```

**Basic Usage:**
```javascript
// main.js (Main Process)
const ActiveWindow = require('@paymoapp/active-window');

// Initialize the library
ActiveWindow.initialize();

// Request permissions on macOS
if (!ActiveWindow.requestPermissions()) {
  console.log('Screen recording permission required on macOS');
}

// Get active window synchronously
try {
  const windowInfo = ActiveWindow.getActiveWindow();
  console.log('Active Window:', {
    title: windowInfo.title,
    application: windowInfo.application,
    path: windowInfo.path,
    pid: windowInfo.pid,
    icon: windowInfo.icon, // Base64 encoded icon
  });
} catch (error) {
  console.error('Failed to get active window:', error);
}
```

**Real-time Monitoring:**
```javascript
// Subscribe to window changes
const watchId = ActiveWindow.subscribe((windowInfo) => {
  if (windowInfo) {
    console.log('Window changed to:', windowInfo.title);
    console.log('Application:', windowInfo.application);
  } else {
    console.log('No focused window');
  }
});

// Unsubscribe when done
// ActiveWindow.unsubscribe(watchId);
```

**IPC Communication to Renderer:**
```javascript
// main.js
const { ipcMain } = require('electron');

ipcMain.handle('get-active-window', () => {
  try {
    return ActiveWindow.getActiveWindow();
  } catch (error) {
    return null;
  }
});

// Set up periodic updates
setInterval(() => {
  const windowInfo = ActiveWindow.getActiveWindow();
  // Send to renderer via mainWindow.webContents.send
}, 1000);
```

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getActiveWindow: () => ipcRenderer.invoke('get-active-window'),
  onWindowChange: (callback) => ipcRenderer.on('window-change', callback)
});
```

### Alternative Package: `active-win` (renamed to `get-windows`)

**Note:** The `active-win` package has been deprecated and renamed to `get-windows`.

**Installation:**
```bash
npm install get-windows
```

**Usage (ESM only):**
```javascript
import { activeWindow } from 'get-windows';

const window = await activeWindow();
console.log(window);
/*
{
  title: 'Unicorns - Google Search',
  id: 5762,
  bounds: { x: 0, y: 0, height: 900, width: 1440 },
  owner: {
    name: 'Google Chrome',
    processId: 310,
    bundleId: 'com.google.Chrome',
    path: '/Applications/Google Chrome.app'
  },
  url: 'https://sindresorhus.com/unicorn', // macOS only, requires browser
  memoryUsage: 11015432
}
*/
```

### Platform-Specific Notes

| Platform | Limitations |
|----------|-------------|
| Windows | Returns memory address as window "handle" instead of ID |
| macOS | Requires screen recording permission; URL only available for supported browsers |
| Linux | X11 only - Wayland not supported for security reasons |

---

## 2. File System Monitoring

### Recommended Package: `chokidar`

**Why this package:**
- Industry standard for file watching in Node.js
- Handles edge cases and platform differences
- Supports recursive watching
- Efficient polling fallback for network drives

**Installation:**
```bash
npm install chokidar
```

**Basic Usage in Electron:**
```javascript
// main.js (Main Process)
const chokidar = require('chokidar');
const { ipcMain } = require('electron');

class FileSystemWatcher {
  constructor() {
    this.watchers = new Map();
  }

  watch(paths, options = {}) {
    const watcher = chokidar.watch(paths, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: false,
      followSymlinks: false,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100
      },
      ...options
    });

    watcher
      .on('add', path => this.handleEvent('add', path))
      .on('change', path => this.handleEvent('change', path))
      .on('unlink', path => this.handleEvent('delete', path))
      .on('addDir', path => this.handleEvent('addDir', path))
      .on('unlinkDir', path => this.handleEvent('deleteDir', path))
      .on('error', error => console.error('Watcher error:', error));

    const id = Date.now().toString();
    this.watchers.set(id, watcher);
    return id;
  }

  handleEvent(type, path) {
    console.log(`File ${type}:`, path);
    // Broadcast to renderer process
    if (global.mainWindow) {
      global.mainWindow.webContents.send('fs-change', { type, path });
    }
  }

  unwatch(id) {
    const watcher = this.watchers.get(id);
    if (watcher) {
      watcher.close();
      this.watchers.delete(id);
    }
  }
}

const fsWatcher = new FileSystemWatcher();

// IPC handlers
ipcMain.handle('fs-watch', (event, paths, options) => {
  return fsWatcher.watch(paths, options);
});

ipcMain.handle('fs-unwatch', (event, id) => {
  fsWatcher.unwatch(id);
});
```

**Preload Script:**
```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fileSystemAPI', {
  watch: (paths, options) => ipcRenderer.invoke('fs-watch', paths, options),
  unwatch: (id) => ipcRenderer.invoke('fs-unwatch', id),
  onChange: (callback) => ipcRenderer.on('fs-change', (event, data) => callback(data))
});
```

**Usage in Renderer:**
```javascript
// renderer.js
async function startWatching() {
  const watcherId = await window.fileSystemAPI.watch([
    '/path/to/watch',
    '/another/path'
  ], {
    ignored: ['node_modules', '*.tmp']
  });

  window.fileSystemAPI.onChange(({ type, path }) => {
    console.log(`File ${type}:`, path);
  });

  return watcherId;
}
```

### Native Alternative: Node.js `fs.watch` (Limited)

```javascript
const fs = require('fs');

// Less reliable than chokidar, but no dependency
fs.watch('/path/to/watch', { recursive: true }, (eventType, filename) => {
  console.log(`Event: ${eventType}, File: ${filename}`);
});
```

---

## 3. System Resources (CPU, Memory)

### Recommended Package: `systeminformation`

**Why this package:**
- 50+ functions for detailed hardware/system info
- No npm dependencies
- Cross-platform: Linux, macOS, Windows, FreeBSD, OpenBSD
- Works with Node.js, Bun, and Deno
- Well-maintained and documented

**Installation:**
```bash
npm install systeminformation
```

**Basic Usage:**
```javascript
// main.js
const si = require('systeminformation');

// CPU Information
async function getCPUInfo() {
  const cpu = await si.cpu();
  console.log('CPU:', {
    manufacturer: cpu.manufacturer,
    brand: cpu.brand,
    speed: cpu.speed,
    cores: cpu.cores,
    physicalCores: cpu.physicalCores
  });
}

// Current CPU Load
async function getCPULoad() {
  const load = await si.currentLoad();
  console.log('CPU Load:', {
    currentLoad: load.currentLoad,
    user: load.currentLoadUser,
    system: load.currentLoadSystem,
    cores: load.cpus.map(core => core.load)
  });
}

// Memory Information
async function getMemoryInfo() {
  const mem = await si.mem();
  console.log('Memory:', {
    total: mem.total,
    free: mem.free,
    used: mem.used,
    active: mem.active,
    available: mem.available
  });
  
  // Calculate usage percentage
  const usagePercent = ((mem.used / mem.total) * 100).toFixed(2);
  console.log(`Memory Usage: ${usagePercent}%`);
}

// Disk Information
async function getDiskInfo() {
  const disk = await si.fsSize();
  console.log('Disk:', disk.map(d => ({
    fs: d.fs,
    type: d.type,
    size: d.size,
    used: d.used,
    available: d.available,
    use: d.use // percentage
  })));
}

// Battery Information
async function getBatteryInfo() {
  const battery = await si.battery();
  console.log('Battery:', {
    hasBattery: battery.hasBattery,
    isCharging: battery.isCharging,
    percent: battery.percent,
    timeRemaining: battery.timeRemaining
  });
}
```

**Real-time Monitoring Service:**
```javascript
// services/systemMonitor.js
const si = require('systeminformation');
const EventEmitter = require('events');

class SystemMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.interval = options.interval || 5000;
    this.isRunning = false;
    this.timer = null;
  }

  async collectStats() {
    try {
      const [cpuLoad, mem, processes] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.processes()
      ]);

      return {
        timestamp: Date.now(),
        cpu: {
          load: cpuLoad.currentLoad,
          user: cpuLoad.currentLoadUser,
          system: cpuLoad.currentLoadSystem
        },
        memory: {
          total: mem.total,
          used: mem.used,
          free: mem.free,
          percent: ((mem.used / mem.total) * 100).toFixed(2)
        },
        processes: processes.list
          .sort((a, b) => b.cpu - a.cpu)
          .slice(0, 10) // Top 10 CPU processes
      };
    } catch (error) {
      console.error('Error collecting stats:', error);
      return null;
    }
  }

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.timer = setInterval(async () => {
      const stats = await this.collectStats();
      if (stats) {
        this.emit('stats', stats);
      }
    }, this.interval);
  }

  stop() {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

module.exports = SystemMonitor;
```

**IPC Integration:**
```javascript
// main.js
const SystemMonitor = require('./services/systemMonitor');

const monitor = new SystemMonitor({ interval: 2000 });

monitor.on('stats', (stats) => {
  // Send to all renderer processes
  BrowserWindow.getAllWindows().forEach(window => {
    window.webContents.send('system-stats', stats);
  });
});

ipcMain.handle('monitor-start', () => monitor.start());
ipcMain.handle('monitor-stop', () => monitor.stop());
```

### Alternative: `node-os-utils`

**Installation:**
```bash
npm install node-os-utils
```

**Usage:**
```javascript
const osu = require('node-os-utils');

// CPU usage
const cpuUsage = await osu.cpu.usage();
console.log(`CPU Usage: ${cpuUsage}%`);

// Memory info
const memInfo = await osu.mem.info();
console.log('Memory:', memInfo);

// Disk info
const driveInfo = await osu.drive.info();
console.log('Drive:', driveInfo);
```

---

## 4. Screenshots and Screen Capture

### Using Electron's Built-in `desktopCapturer`

**Main Process Setup:**
```javascript
// main.js
const { app, BrowserWindow, desktopCapturer, session, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

app.whenReady().then(() => {
  // Set up display media request handler (Electron 28+)
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      // Grant access to the first screen found
      callback({ video: sources[0], audio: 'loopback' });
    });
  }, { useSystemPicker: true });
});

// Capture screenshot IPC handler
ipcMain.handle('capture-screenshot', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 }
    });

    if (sources.length === 0) {
      throw new Error('No screen sources found');
    }

    // Return the first screen's thumbnail as data URL
    return sources[0].thumbnail.toDataURL();
  } catch (error) {
    console.error('Screenshot error:', error);
    throw error;
  }
});

// Capture specific window
ipcMain.handle('capture-window', async (event, windowName) => {
  const sources = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: { width: 1920, height: 1080 }
  });

  const targetWindow = sources.find(s => 
    s.name.toLowerCase().includes(windowName.toLowerCase())
  );

  if (targetWindow) {
    return targetWindow.thumbnail.toDataURL();
  }
  return null;
});
```

**Renderer Process:**
```javascript
// renderer.js
async function takeScreenshot() {
  try {
    const dataUrl = await electronAPI.captureScreenshot();
    
    // Display screenshot
    const img = document.getElementById('screenshot');
    img.src = dataUrl;
    
    // Or save to file
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    // Save blob to file...
  } catch (error) {
    console.error('Failed to capture screenshot:', error);
  }
}

// Using getDisplayMedia for video recording
async function startScreenRecording() {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      audio: true,
      video: {
        width: 1920,
        height: 1080,
        frameRate: 30
      }
    });

    const video = document.querySelector('video');
    video.srcObject = stream;
    video.onloadedmetadata = () => video.play();

    // Store stream for stopping later
    window.currentStream = stream;
  } catch (error) {
    console.error('Screen recording failed:', error);
  }
}

function stopScreenRecording() {
  if (window.currentStream) {
    window.currentStream.getTracks().forEach(track => track.stop());
    window.currentStream = null;
  }
}
```

### Using `screenshot-desktop` Package

**Installation:**
```bash
npm install screenshot-desktop
```

**Usage:**
```javascript
const screenshot = require('screenshot-desktop');

// Capture entire screen
async function captureFullScreen() {
  const imgBuffer = await screenshot();
  fs.writeFileSync('screenshot.png', imgBuffer);
}

// Capture specific display
async function captureDisplay() {
  const displays = await screenshot.listDisplays();
  console.log('Available displays:', displays);
  
  const imgBuffer = await screenshot({ screen: displays[0].id });
  fs.writeFileSync('display1.png', imgBuffer);
}

// Capture specific region (platform-dependent)
async function captureRegion() {
  // Note: Region capture may not work on all platforms
  const imgBuffer = await screenshot();
  // Use sharp or similar to crop
}
```

### Platform Permissions

| Platform | Permission Required |
|----------|-------------------|
| macOS | System Preferences > Security & Privacy > Screen Recording |
| Windows | No special permission required |
| Linux | Varies by distribution |

---

## 5. Clipboard History Access

### Important Note

**Electron's built-in clipboard API does NOT provide history access.** You must implement your own history tracking by polling the clipboard.

### Recommended Implementation

```javascript
// services/clipboardHistory.js
const { clipboard, ipcMain } = require('electron');
const crypto = require('crypto');

class ClipboardHistory {
  constructor(options = {}) {
    this.maxItems = options.maxItems || 100;
    this.pollInterval = options.pollInterval || 1000;
    this.history = [];
    this.lastHash = null;
    this.timer = null;
    this.isRunning = false;
  }

  // Generate hash of clipboard content
  getContentHash(content) {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  // Get current clipboard content
  getCurrentContent() {
    const formats = clipboard.availableFormats();
    
    if (formats.includes('image/png') || formats.includes('image/jpeg')) {
      const image = clipboard.readImage();
      if (!image.isEmpty()) {
        return {
          type: 'image',
          data: image.toDataURL(),
          timestamp: Date.now()
        };
      }
    }

    if (formats.includes('text/plain') || formats.includes('text/html')) {
      const text = clipboard.readText();
      const html = clipboard.readHTML();
      
      if (text) {
        return {
          type: 'text',
          text: text,
          html: html || null,
          timestamp: Date.now()
        };
      }
    }

    if (formats.includes('text/rtf')) {
      return {
        type: 'rtf',
        rtf: clipboard.readRTF(),
        timestamp: Date.now()
      };
    }

    return null;
  }

  // Check for new clipboard content
  checkClipboard() {
    const content = this.getCurrentContent();
    if (!content) return;

    const hash = this.getContentHash(
      content.type === 'image' ? content.data : content.text || ''
    );

    if (hash !== this.lastHash) {
      this.lastHash = hash;
      
      // Check for duplicates
      const isDuplicate = this.history.some(item => 
        this.getContentHash(
          item.type === 'image' ? item.data : item.text || ''
        ) === hash
      );

      if (!isDuplicate) {
        this.addToHistory(content);
      }
    }
  }

  addToHistory(content) {
    this.history.unshift({
      id: Date.now().toString(),
      ...content
    });

    // Trim to max items
    if (this.history.length > this.maxItems) {
      this.history = this.history.slice(0, this.maxItems);
    }

    // Notify listeners
    this.onChange?.(this.history);
  }

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.timer = setInterval(() => this.checkClipboard(), this.pollInterval);
  }

  stop() {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getHistory() {
    return this.history;
  }

  clearHistory() {
    this.history = [];
    this.lastHash = null;
  }

  // Restore item to clipboard
  restoreItem(item) {
    switch (item.type) {
      case 'text':
        clipboard.writeText(item.text);
        if (item.html) {
          clipboard.writeHTML(item.html);
        }
        break;
      case 'image':
        const { nativeImage } = require('electron');
        const image = nativeImage.createFromDataURL(item.data);
        clipboard.writeImage(image);
        break;
      case 'rtf':
        clipboard.writeRTF(item.rtf);
        break;
    }
  }
}

module.exports = ClipboardHistory;
```

**Integration with Electron:**
```javascript
// main.js
const ClipboardHistory = require('./services/clipboardHistory');

const clipboardHistory = new ClipboardHistory({
  maxItems: 50,
  pollInterval: 500
});

clipboardHistory.onChange = (history) => {
  BrowserWindow.getAllWindows().forEach(window => {
    window.webContents.send('clipboard-history-updated', history);
  });
};

// IPC handlers
ipcMain.handle('clipboard-start', () => {
  clipboardHistory.start();
});

ipcMain.handle('clipboard-stop', () => {
  clipboardHistory.stop();
});

ipcMain.handle('clipboard-get-history', () => {
  return clipboardHistory.getHistory();
});

ipcMain.handle('clipboard-restore', (event, item) => {
  clipboardHistory.restoreItem(item);
});

ipcMain.handle('clipboard-clear', () => {
  clipboardHistory.clearHistory();
});
```

### Alternative Package: `electron-clipboard-watcher`

**Installation:**
```bash
npm install electron-clipboard-watcher
```

**Note:** This package is older and may have compatibility issues with newer Electron versions.

---

## 6. Native Node.js Modules in Electron

### Using `@electron/rebuild` (Recommended)

**Installation:**
```bash
npm install --save-dev @electron/rebuild
```

**Rebuild all native modules:**
```bash
# Via npx
npx electron-rebuild

# Or via node_modules
./node_modules/.bin/electron-rebuild

# On Windows
.\node_modules\.bin\electron-rebuild.cmd
```

**Package.json scripts:**
```json
{
  "scripts": {
    "rebuild": "electron-rebuild",
    "postinstall": "electron-rebuild"
  }
}
```

### Manual Build with node-gyp

```bash
# Set environment variables (Unix/Linux/macOS)
export npm_config_target=28.0.0  # Electron version
export npm_config_arch=x64
export npm_config_target_arch=x64
export npm_config_disturl=https://electronjs.org/headers
export npm_config_runtime=electron
export npm_config_build_from_source=true

# Install dependencies
HOME=~/.electron-gyp npm install

# Or rebuild specific module
HOME=~/.electron-gyp node-gyp rebuild --target=28.0.0 --arch=x64 --dist-url=https://electronjs.org/headers
```

### Windows-specific Considerations

The `win_delay_load_hook` must be set to `true` in the module's `binding.gyp`:

```json
{
  "variables": {
    "win_delay_load_hook": "true"
  }
}
```

### Using N-API for Better Compatibility

When developing your own native modules, use N-API for better ABI stability:

```cpp
// hello.cc
#include <napi.h>

Napi::String Method(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  return Napi::String::New(env, "Hello from native module!");
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set(Napi::String::New(env, "hello"), Napi::Function::New(env, Method));
  return exports;
}

NODE_API_MODULE(hello, Init)
```

```json
// binding.gyp
{
  "targets": [{
    "target_name": "hello",
    "sources": ["hello.cc"],
    "include_dirs": [
      "<!@(node -p \"require('node-addon-api').include\")"
    ],
    "dependencies": [
      "<!(node -p \"require('node-addon-api').gyp\")"
    ],
    "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
    "win_delay_load_hook": "true"
  }]
}
```

### Prebuilt Binaries with `prebuild`

For distributing native modules, use `prebuild`:

```bash
npm install --save-dev prebuild
```

```json
// package.json
{
  "scripts": {
    "prebuild": "prebuild --all --strip",
    "prebuild-electron": "prebuild -r electron -t 28.0.0 -t 29.0.0 --strip"
  }
}
```

---

## 7. Security Considerations

### Critical Security Checklist

#### ✅ Enable Context Isolation (Default since Electron 12)

```javascript
// main.js
const mainWindow = new BrowserWindow({
  webPreferences: {
    contextIsolation: true,  // CRITICAL: Keep enabled!
    preload: path.join(__dirname, 'preload.js')
  }
});
```

#### ✅ Disable Node Integration for Remote Content

```javascript
// main.js - NEVER do this for remote content
const mainWindow = new BrowserWindow({
  webPreferences: {
    nodeIntegration: false,  // Default since Electron 5
    nodeIntegrationInWorker: false,
    contextIsolation: true
  }
});
```

#### ✅ Use Preload Scripts with Context Bridge

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

// Expose ONLY necessary APIs
contextBridge.exposeInMainWorld('electronAPI', {
  // System info - read only
  getSystemStats: () => ipcRenderer.invoke('get-system-stats'),
  
  // Clipboard - controlled access
  getClipboardHistory: () => ipcRenderer.invoke('clipboard-get-history'),
  restoreClipboardItem: (item) => ipcRenderer.invoke('clipboard-restore', item),
  
  // File system - limited access
  watchDirectory: (path) => ipcRenderer.invoke('fs-watch', path),
  
  // Event listeners
  onSystemStats: (callback) => ipcRenderer.on('system-stats', callback)
});
```

#### ✅ Validate IPC Message Senders

```javascript
// main.js
const { ipcMain } = require('electron');

ipcMain.handle('sensitive-operation', (event, data) => {
  // Validate the sender
  const webContents = event.sender;
  const window = BrowserWindow.fromWebContents(webContents);
  
  // Only allow from specific window or origin
  if (!window || window.id !== expectedWindowId) {
    throw new Error('Unauthorized');
  }
  
  // Proceed with operation
});
```

#### ✅ Use Content Security Policy

```html
<!-- index.html -->
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self'; 
               style-src 'self' 'unsafe-inline'; 
               img-src 'self' data:;
               connect-src 'self';
               media-src 'self';
               object-src 'none';
               frame-src 'none';">
```

#### ✅ Enable Process Sandboxing

```javascript
// main.js
const { app } = require('electron');

app.enableSandbox(); // Enable renderer sandboxing
```

### Permission Handling

```javascript
// main.js
const { session } = require('electron');

session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
  const allowedPermissions = ['clipboard-read', 'clipboard-write'];
  
  if (allowedPermissions.includes(permission)) {
    callback(true);
  } else {
    console.warn(`Permission denied: ${permission}`);
    callback(false);
  }
});
```

### Security Best Practices Summary

| Practice | Why It Matters |
|----------|---------------|
| Context Isolation | Prevents renderer from accessing Electron/Node APIs directly |
| No Node Integration | Prevents XSS from becoming RCE |
| CSP Headers | Prevents injection attacks |
| Validate IPC Senders | Prevents unauthorized cross-window access |
| Keep Electron Updated | Patches known vulnerabilities |
| Use Preload Scripts | Controlled API exposure to renderer |
| Sandbox | Limits renderer process capabilities |

### Common Vulnerabilities to Avoid

```javascript
// ❌ NEVER: Loading remote content with Node integration
mainWindow.loadURL('https://untrusted-site.com');
// with nodeIntegration: true

// ❌ NEVER: Evaluating untrusted code
ipcMain.on('run-code', (event, code) => {
  eval(code); // DANGEROUS!
});

// ❌ NEVER: Shell open with untrusted input
ipcMain.on('open-link', (event, url) => {
  shell.openExternal(url); // Could be malicious URL
});

// ✅ SAFE: Validate before opening
const { shell } = require('electron');
const { URL } = require('url');

ipcMain.on('open-link', (event, urlString) => {
  try {
    const url = new URL(urlString);
    const allowedProtocols = ['https:', 'http:'];
    
    if (allowedProtocols.includes(url.protocol)) {
      shell.openExternal(urlString);
    }
  } catch (e) {
    console.error('Invalid URL');
  }
});
```

---

## Package Summary

| Capability | Recommended Package | Alternative |
|------------|-------------------|-------------|
| Active Window | `@paymoapp/active-window` | `get-windows` (formerly `active-win`) |
| File Watching | `chokidar` | Node.js `fs.watch` |
| System Resources | `systeminformation` | `node-os-utils` |
| Screenshots | `desktopCapturer` (built-in) | `screenshot-desktop` |
| Clipboard History | Custom implementation | `electron-clipboard-watcher` |
| Native Modules | `@electron/rebuild` | `node-gyp` |

---

## Additional Resources

- [Electron Security Guide](https://electronjs.org/docs/latest/tutorial/security)
- [Native Modules Guide](https://electronjs.org/docs/latest/tutorial/using-native-node-modules)
- [Context Isolation](https://electronjs.org/docs/latest/tutorial/context-isolation)
- [desktopCapturer API](https://electronjs.org/docs/latest/api/desktop-capturer)
- [systeminformation Documentation](https://systeminformation.io/)
