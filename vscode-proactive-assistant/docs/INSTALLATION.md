# Installation Guide

Complete installation instructions for the Proactive AI Assistant VS Code extension.

---

## 📋 Prerequisites

### Required

| Requirement | Version | Download |
|-------------|---------|----------|
| VS Code | 1.74+ | [code.visualstudio.com](https://code.visualstudio.com/) |
| Pieces OS | Latest | [pieces.app](https://pieces.app) |
| Node.js | 18.x+ | [nodejs.org](https://nodejs.org/) (for development) |

### Supported Platforms

- ✅ Windows 10/11
- ✅ macOS 10.15+
- ✅ Linux (Ubuntu 20.04+, Fedora 34+)

---

## 🛒 Method 1: VS Code Marketplace (Recommended)

### Step 1: Install Pieces OS

1. Visit [pieces.app](https://pieces.app) and download Pieces OS for your platform
2. Run the installer and follow the setup wizard
3. Launch Pieces OS (it runs in the system tray/background)
4. Complete the initial Pieces OS setup

### Step 2: Install the Extension

1. Open VS Code
2. Click the Extensions icon in the Activity Bar (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for **"Proactive AI Assistant"**
4. Click **Install**

![Marketplace Install](https://via.placeholder.com/600x300/2D2D2D/FFFFFF?text=Marketplace+Install+Screenshot)

### Step 3: Verify Installation

1. Look for the 💡 icon in your Activity Bar
2. Click it to open the Proactive Assistant panel
3. Check that the status shows "Connected" or "Connecting"

---

## 📦 Method 2: VSIX Installation

Use this method for offline installation or pre-release versions.

### Download the VSIX

1. Go to the [Releases](https://github.com/example/proactive-ai-assistant/releases) page
2. Download the latest `.vsix` file

### Install in VS Code

**Via UI:**
1. Open VS Code
2. Go to Extensions view (`Ctrl+Shift+X`)
3. Click the `...` (More Actions) menu
4. Select **"Install from VSIX..."**
5. Choose the downloaded file

**Via CLI:**
```bash
code --install-extension proactive-ai-assistant-0.1.0.vsix
```

### Verify Installation

```bash
# List installed extensions
code --list-extensions | grep proactive

# Should output: proactive-assistant.proactive-ai-assistant
```

---

## 🏗️ Method 3: From Source

For development, debugging, or customizing the extension.

### Step 1: Clone the Repository

```bash
git clone https://github.com/example/proactive-ai-assistant.git
cd proactive-ai-assistant/vscode-proactive-assistant
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Compile TypeScript

```bash
# One-time compile
npm run compile

# Or watch mode (recommended for development)
npm run watch
```

### Step 4: Launch Extension Host

1. Open the project in VS Code:
   ```bash
   code .
   ```

2. Press `F5` or go to **Run** → **Start Debugging**
3. This opens a new VS Code window with the extension loaded

### Step 5: Verify Development Setup

In the Extension Development Host window:
1. Open the Command Palette (`Ctrl+Shift+P`)
2. Type "Proactive Assistant"
3. You should see all available commands

---

## ⚙️ First Run Setup

### Initial Configuration

After installation, configure the extension:

1. **Open Settings**: `Ctrl+,` → Search for "Proactive Assistant"

2. **Configure Pieces OS** (if not using defaults):
   ```json
   {
     "proactiveAssistant.piecesOs.host": "localhost",
     "proactiveAssistant.piecesOs.port": 5323
   }
   ```

3. **Set Quiet Hours** (optional):
   ```json
   {
     "proactiveAssistant.quietHours.enabled": true,
     "proactiveAssistant.quietHours.start": "22:00",
     "proactiveAssistant.quietHours.end": "08:00"
   }
   ```

4. **Adjust Sensitivity**:
   ```json
   {
     "proactiveAssistant.interruptionThreshold": 0.7
   }
   ```
   - Lower values = More suggestions
   - Higher values = Fewer, more confident suggestions

### Welcome Page

On first run, the extension shows a welcome page with:
- Feature overview
- Quick configuration tips
- Keyboard shortcut reference

To reopen: Command Palette → "Proactive Assistant: Show Welcome"

---

## 🔌 Connecting to Pieces OS

### Automatic Connection

The extension automatically attempts to connect to Pieces OS on startup.

### Manual Connection Check

1. Open the Output panel (`Ctrl+Shift+U`)
2. Select **"Proactive AI Assistant"** from the dropdown
3. Look for connection messages

### Troubleshooting Connection

If connection fails:

1. **Verify Pieces OS is running**:
   - Windows: Check system tray
   - macOS: Check menu bar
   - Linux: Check running processes: `ps aux | grep pieces`

2. **Check the port**:
   ```bash
   # Windows
   netstat -an | findstr 5323
   
   # macOS/Linux
   lsof -i :5323
   ```

3. **Restart Pieces OS**:
   - Quit and relaunch Pieces OS
   - Reload VS Code window (`Ctrl+Shift+P` → "Developer: Reload Window")

---

## 🧪 Verification Checklist

After installation, verify everything works:

- [ ] Extension appears in installed extensions list
- [ ] 💡 icon visible in Activity Bar
- [ ] Panel opens without errors
- [ ] Status shows "Connected" (after Pieces OS is running)
- [ ] Test command: `Ctrl+Shift+A` opens panel
- [ ] Test focus mode: `Ctrl+Shift+F` toggles state
- [ ] Settings are accessible and editable

---

## 🔄 Updating the Extension

### Via Marketplace

Updates are automatic. VS Code checks daily for updates.

Manual check:
1. Extensions view
2. Look for update indicator on Proactive Assistant
3. Click **Update**

### Via VSIX

1. Download new `.vsix` file
2. Install as above (it will replace the existing version)

### From Source

```bash
git pull origin main
npm install
npm run compile
```

---

## ❌ Uninstallation

### Via VS Code

1. Extensions view
2. Find "Proactive AI Assistant"
3. Click **Uninstall**
4. Reload VS Code when prompted

### Via CLI

```bash
code --uninstall-extension proactive-assistant.proactive-ai-assistant
```

### Clean Up (Optional)

Remove extension data:
```bash
# Extension storage location varies by OS:
# Windows: %APPDATA%\Code\User\globalStorage\proactive-assistant.proactive-ai-assistant
# macOS: ~/Library/Application Support/Code/User/globalStorage/...
# Linux: ~/.config/Code/User/globalStorage/...
```

---

## 📞 Getting Help

If you encounter issues during installation:

1. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
2. Search [existing issues](https://github.com/example/proactive-ai-assistant/issues)
3. Open a new issue with:
   - VS Code version
   - OS version
   - Extension version
   - Error messages (from Output panel)

---

## 📚 Next Steps

- [Usage Guide](USAGE.md) — Learn how to use the extension
- [Configuration Reference](CONFIGURATION.md) — Customize settings
- [FAQ](FAQ.md) — Common questions answered
