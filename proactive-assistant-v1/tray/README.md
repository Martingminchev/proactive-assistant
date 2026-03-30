# Proactive Assistant - System Tray App

Electron-based system tray application for the Proactive AI Assistant.

## Features

- 🔔 System tray icon with state management (watching, suggestion, urgent, focus)
- 🎨 Smooth animations and transitions
- 📍 Smart window positioning under tray icon
- 🖱️ Click outside to close
- 🔒 Secure preload script with context isolation
- 🎯 Focus mode support
- 🏷️ Badge count for pending suggestions

## Quick Start

```bash
cd tray
npm install

# Development mode (connects to Vite dev server)
npm run dev

# Production mode (uses built client files)
npm start
```

## Building

```bash
# Build for current platform
npm run build

# Build for specific platforms
npm run build:win
npm run build:mac
npm run build:linux
```

## Project Structure

```
tray/
├── main.js           # Electron main process
├── preload.js        # Secure preload script
├── TrayManager.js    # Tray icon & state management
├── WindowManager.js  # Window positioning & animations
├── package.json      # Electron app dependencies
├── assets/
│   └── icons/        # Tray icons for all states
└── README.md         # This file
```

## Icons Required

Place icon files in `assets/icons/`:

| File | Purpose |
|------|---------|
| `tray.png` / `tray.ico` / `trayTemplate.png` | Default state |
| `tray-suggestion.png` | Has suggestions |
| `tray-urgent.png` | Urgent notification |
| `tray-focus.png` | Focus mode active |
| `tray-offline.png` | Connection lost |
| `icon.icns` | macOS app icon |
| `icon.ico` | Windows app icon |

### Icon Sizes

- **Tray icons**: 16x16 (Windows/Linux), 22x22 (macOS retina: 44x44)
- **macOS template**: Use `Template` suffix for auto dark/light mode
- **App icons**: 512x512 or larger

## API

The preload script exposes these APIs to the renderer:

```javascript
// Window control
window.electronAPI.window.minimize();
window.electronAPI.window.close();
window.electronAPI.window.show();

// Tray management
window.electronAPI.tray.setState('suggestion');
window.electronAPI.tray.setBadge(3);
window.electronAPI.tray.animate(true);
window.electronAPI.tray.notify('Title', 'Message');

// Suggestions
window.electronAPI.suggestion.accept('suggestion-id');
window.electronAPI.suggestion.dismiss('suggestion-id');

// Focus mode
window.electronAPI.focus.toggle();
window.electronAPI.focus.getState();
window.electronAPI.focus.onChange((data) => console.log(data.isFocusMode));

// System
window.electronAPI.shell.openExternal('https://example.com');
window.electronAPI.app.getVersion();
window.electronAPI.app.getPlatform();

// Platform detection
window.electronAPI.platform.isMac;
window.electronAPI.platform.isWindows;
window.electronAPI.platform.isLinux;
```

## Configuration

Environment variables:

```env
SERVER_PORT=3001      # Backend server port
NODE_ENV=development  # Development mode
```

## Platform Differences

| Feature | macOS | Windows | Linux |
|---------|-------|---------|-------|
| Tray position | Menu bar | System tray | Varies |
| Window position | Below icon | Above taskbar | Below icon |
| Badge | SetTitle | Overlay | Limited |
| Dark mode | Template icons | Manual | Manual |

## License

MIT
