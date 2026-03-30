# Setup script for Proactive AI Assistant VS Code Extension
# Usage: .\scripts\setup.ps1

Write-Host "🤖 Proactive AI Assistant - Setup Script" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js version
Write-Host -NoNewline "📦 Checking Node.js version... "
try {
    $nodeVersion = node -v
    $majorVersion = [int]($nodeVersion -replace 'v', '').Split('.')[0]
    
    if ($majorVersion -lt 18) {
        Write-Host "❌ Node.js version too old ($nodeVersion)" -ForegroundColor Red
        Write-Host "   Please upgrade to Node.js 18+ from https://nodejs.org/"
        exit 1
    }
    Write-Host "✓ $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found" -ForegroundColor Red
    Write-Host "   Please install Node.js 18+ from https://nodejs.org/"
    exit 1
}

# Check npm
Write-Host -NoNewline "📦 Checking npm... "
try {
    $npmVersion = npm -v
    Write-Host "✓ $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ npm not found" -ForegroundColor Red
    exit 1
}

# Check VS Code
Write-Host -NoNewline "💻 Checking VS Code... "
$codeCmd = Get-Command code -ErrorAction SilentlyContinue
$vscodeCmd = Get-Command vscode -ErrorAction SilentlyContinue

if ($codeCmd -or $vscodeCmd) {
    Write-Host "✓ VS Code found" -ForegroundColor Green
} else {
    Write-Host "⚠️ VS Code not found in PATH" -ForegroundColor Yellow
    Write-Host "   You can still use the extension but 'code' command won't work"
}

# Install root dependencies
Write-Host ""
Write-Host "📥 Installing extension dependencies..."
npm install
if ($LASTEXITCODE -ne 0) { exit 1 }

# Install webview dependencies
Write-Host ""
Write-Host "📥 Installing webview dependencies..."
Set-Location webview
npm install
if ($LASTEXITCODE -ne 0) { exit 1 }
Set-Location ..

# Compile TypeScript
Write-Host ""
Write-Host "🔨 Compiling TypeScript..."
npm run compile
if ($LASTEXITCODE -ne 0) { exit 1 }

# Build webview
Write-Host ""
Write-Host "🎨 Building webview..."
npm run build:webview
if ($LASTEXITCODE -ne 0) { exit 1 }

# Verify build
Write-Host ""
Write-Host "✅ Verifying build..."
if ((Test-Path "out") -and (Test-Path "out/extension.js")) {
    Write-Host "✓ Extension compiled successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Extension compilation failed" -ForegroundColor Red
    exit 1
}

if ((Test-Path "out/webview") -and (Test-Path "out/webview/index.html")) {
    Write-Host "✓ Webview built successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Webview build failed" -ForegroundColor Red
    exit 1
}

# Check for Pieces OS
Write-Host ""
Write-Host -NoNewline "🔌 Checking Pieces OS... "
$piecesFound = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:1000/.health" -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -eq 200) { $piecesFound = $true }
} catch {}
try {
    $response = Invoke-WebRequest -Uri "http://localhost:39300/.health" -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -eq 200) { $piecesFound = $true }
} catch {}
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5323/.health" -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -eq 200) { $piecesFound = $true }
} catch {}

if ($piecesFound) {
    Write-Host "✓ Pieces OS detected" -ForegroundColor Green
} else {
    Write-Host "⚠️ Pieces OS not detected" -ForegroundColor Yellow
    Write-Host "   The extension will work but suggestions need Pieces OS."
    Write-Host "   Download from: https://pieces.app/"
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "🎉 Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Open this folder in VS Code"
Write-Host "  2. Press F5 to run the extension"
Write-Host "  3. Or run: npm run package"
Write-Host ""
Write-Host "Documentation:"
Write-Host "  📖 QUICKSTART.md - Get started quickly"
Write-Host "  📖 README.md - Full documentation"
Write-Host "  📖 docs/USAGE.md - Usage guide"
Write-Host ""
