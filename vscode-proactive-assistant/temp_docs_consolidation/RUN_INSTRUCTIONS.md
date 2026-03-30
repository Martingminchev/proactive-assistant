# 🚀 How to Run the Extension

## ✅ Build Status: READY

All TypeScript compilation errors have been fixed!

---

## Step 1: Open in VS Code

1. Open VS Code
2. File → Open Folder
3. Select: `C:\Users\marti\Desktop\Projects\proactive-assistant\vscode-proactive-assistant`

---

## Step 2: Install Dependencies (First Time Only)

Open terminal in VS Code (`` Ctrl+` ``) and run:

```bash
npm install
```

---

## Step 3: Compile TypeScript

In the terminal:

```bash
npm run compile
```

You should see:
```
> proactive-ai-assistant@0.1.0 compile
> tsc -p ./

(no errors = success!)
```

---

## Step 4: Run the Extension

Press **`F5`** in VS Code

This will:
1. Launch a new VS Code window (Extension Development Host)
2. Load your extension automatically
3. You should see the 🤖 icon in the status bar (bottom right)

---

## Step 5: Test the Extension

### Basic Test
1. **Status Bar**: Look for 🤖 icon in bottom right
2. **Open Panel**: Press `Ctrl+Shift+A` (or `Cmd+Shift+A` on Mac)
3. **Commands**: Press `Ctrl+Shift+P` and type "Proactive" to see all commands

### Advanced Test
1. Type code in any editor for 5+ minutes
2. The 🤖 icon should change colors:
   - Blue = watching
   - Green = deep flow
   - Red = stuck (if you have errors for 20+ min)
3. Try Focus Mode: `Ctrl+Shift+F`

---

## Troubleshooting

### "Cannot find module '.../out/extension.js'"

**Fix**: You need to compile first!
```bash
npm run compile
```

### "npm is not recognized"

**Fix**: Make sure Node.js is installed and in your PATH

### PowerShell execution policy error

**Fix**: Run PowerShell as Administrator and execute:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Then retry `npm run compile`

### Compilation errors

If you see TypeScript errors:
1. Check that you're in the right folder (`vscode-proactive-assistant`)
2. Make sure dependencies are installed (`npm install`)
3. Try cleaning and rebuilding:
   ```bash
   npm run clean
   npm run compile
   ```

---

## Build Commands

```bash
# Compile TypeScript
npm run compile

# Watch for changes (auto-recompile)
npm run watch

# Build webview UI
npm run build:webview

# Full rebuild
npm run rebuild

# Package for distribution
npm run package
```

---

## What's Working Now

✅ Extension activates without errors
✅ Status bar shows 🤖 icon
✅ Panel opens with `Ctrl+Shift+A`
✅ Focus mode works
✅ All 8 commands registered
✅ Activity monitoring
✅ Suggestion generation (when stuck)
✅ Smart interruption (30-min rule)

---

## Next Steps

1. **Test thoroughly** - Use it for a day
2. **Package it** - `npm run package` creates .vsix file
3. **Install .vsix** - In VS Code: Extensions → ... → Install from VSIX
4. **Or publish** - Follow docs/RELEASE_PROCESS.md

---

**Ready to go! Press F5 and try it out! 🎉**
