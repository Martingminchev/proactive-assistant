# Build Troubleshooting Guide

## Error: Cannot find module '.../out/extension.js'

This error means the TypeScript code hasn't been compiled to JavaScript yet.

## Quick Fix

### Step 1: Open Terminal in VS Code

Press `` Ctrl+` `` (backtick) to open integrated terminal in VS Code.

### Step 2: Navigate to Extension Folder

```bash
cd "C:\Users\marti\Desktop\Projects\proactive-assistant\vscode-proactive-assistant"
```

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Compile TypeScript

```bash
# Using npx (if tsc is not in PATH)
npx tsc -p ./

# Or using npm script
npm run compile
```

### Step 5: Verify out/ folder exists

```bash
ls out/
# Should show: extension.js, extension.js.map, and other compiled files
```

### Step 6: Try Running Again

Press `F5` in VS Code to launch the extension.

---

## Common Issues

### Issue 1: "tsc is not recognized"

**Fix**: Use npx
```bash
npx tsc -p ./
```

### Issue 2: TypeScript compilation errors

**Fix**: Check for errors in terminal
```bash
npm run compile
```

Look for red error messages. Common causes:
- Missing imports
- Type mismatches
- Missing type definitions

### Issue 3: out/ folder is empty or missing

**Fix**: Create it manually and recompile
```bash
mkdir out
npm run compile
```

### Issue 4: "Cannot find module '@/*'"

**Fix**: Path aliases need baseUrl. Check tsconfig.json has:
```json
"baseUrl": ".",
"paths": {
  "@/*": ["src/*"]
}
```

### Issue 5: Permission errors on Windows

**Fix**: Run VS Code as administrator, or use PowerShell as admin:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## Alternative: Use VS Code Tasks

1. Press `Ctrl+Shift+P`
2. Type "Run Task"
3. Select "npm: compile"
4. This will compile the TypeScript

---

## Full Setup Script (PowerShell)

Save this as `fix-build.ps1` and run it:

```powershell
# Fix build script for Proactive AI Assistant

$ErrorActionPreference = "Stop"

Write-Host "🔧 Fixing build for Proactive AI Assistant..." -ForegroundColor Cyan

# Navigate to extension folder
$extPath = "C:\Users\marti\Desktop\Projects\proactive-assistant\vscode-proactive-assistant"
Set-Location $extPath

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    npm install
}

# Create out folder if missing
if (-not (Test-Path "out")) {
    Write-Host "📁 Creating out folder..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path "out" -Force
}

# Compile TypeScript
Write-Host "🔨 Compiling TypeScript..." -ForegroundColor Yellow
try {
    npx tsc -p ./
    Write-Host "✅ Compilation successful!" -ForegroundColor Green
} catch {
    Write-Host "❌ Compilation failed. Check errors above." -ForegroundColor Red
    exit 1
}

# Verify output
if (Test-Path "out/extension.js") {
    Write-Host "✅ out/extension.js created successfully!" -ForegroundColor Green
    Write-Host "" 
    Write-Host "🚀 Ready to run! Press F5 in VS Code." -ForegroundColor Green
} else {
    Write-Host "❌ out/extension.js not found. Build may have failed." -ForegroundColor Red
}
```

---

## Verify Build Output

After successful compilation, you should have:

```
vscode-proactive-assistant/
├── out/
│   ├── extension.js              ✅ Main entry
│   ├── extension.js.map          ✅ Source map
│   ├── extension.d.ts            ✅ Type declarations
│   ├── services/
│   │   ├── activityMonitor.js
│   │   ├── suggestionEngine.js
│   │   └── ... (all services)
│   ├── commands/
│   │   └── ... (all commands)
│   └── ...
```

---

## Still Not Working?

### Check 1: Is TypeScript installed?

```bash
npx tsc --version
# Should show: Version 5.x.x
```

### Check 2: Are there compilation errors?

```bash
npx tsc -p ./ --noEmit
# This shows errors without creating files
```

### Check 3: VS Code TypeScript version

1. Press `Ctrl+Shift+P`
2. Type "TypeScript: Select TypeScript Version"
3. Choose "Use Workspace Version"

### Check 4: Clean build

```bash
# Delete out folder and node_modules, rebuild
rm -rf out node_modules
npm install
npm run compile
```

---

## Success!

Once `out/extension.js` exists, you can press `F5` to run the extension.
